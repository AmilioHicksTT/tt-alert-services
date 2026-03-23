/**
 * Met Office TT Scraper — Trinidad and Tobago Meteorological Service
 * Source: https://www.metoffice.gov.tt
 *
 * Scrapes weather warnings from the warnings page.
 * The page uses JavaScript to load alertsData — we parse the inline script.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const MET_WARNINGS_URL = 'https://www.metoffice.gov.tt/warnings';
const MET_ALERT_URL = 'https://www.metoffice.gov.tt/alert';

async function scrapeMetOffice() {
  try {
    const warnings = [];

    // Approach 1: Try the warnings page — look for alertsData JS variable
    try {
      const { data: html } = await axios.get(MET_WARNINGS_URL, { timeout: 15000 });
      const $ = cheerio.load(html);

      // The warnings page stores data in a JS variable: alertsData = [...]
      $('script').each((_, script) => {
        const content = $(script).html() || '';
        const match = content.match(/alertsData\s*=\s*(\[[\s\S]*?\]);/);
        if (match) {
          try {
            const alerts = JSON.parse(match[1]);
            for (const alert of alerts) {
              const title = alert.title || alert.headline || alert.event || 'Weather Warning';
              const body = alert.description || alert.summary || alert.body || '';
              const severity = alert.severity || alert.assessment_color || '';
              if (title) {
                warnings.push({ title, body, rawSeverity: severity });
              }
            }
          } catch (e) {
            console.warn('[MetOffice] Could not parse alertsData:', e.message);
          }
        }
      });

      // Fallback: scrape visible warning elements
      if (!warnings.length) {
        $('.warning-card, .day-card, .alert-item, article').each((_, el) => {
          const title = $(el).find('h1, h2, h3, .title, .warning-title').first().text().trim();
          const body = $(el).find('p, .body, .description').first().text().trim();
          if (title && title.length > 5 && !/no warnings/i.test(title)) {
            warnings.push({ title, body, rawSeverity: '' });
          }
        });
      }
    } catch (e) {
      console.warn('[MetOffice] Warnings page error:', e.message);
    }

    // Approach 2: Try /alert page as fallback
    if (!warnings.length) {
      try {
        const { data: html } = await axios.get(MET_ALERT_URL, { timeout: 15000 });
        const $ = cheerio.load(html);

        $('script').each((_, script) => {
          const content = $(script).html() || '';
          const match = content.match(/alertsData\s*=\s*(\[[\s\S]*?\]);/);
          if (match) {
            try {
              const alerts = JSON.parse(match[1]);
              for (const alert of alerts) {
                const title = alert.title || alert.headline || 'Weather Warning';
                const body = alert.description || '';
                warnings.push({ title, body, rawSeverity: alert.severity || '' });
              }
            } catch (e) { /* ignore parse error */ }
          }
        });

        if (!warnings.length) {
          $('.alert-banner, .warning, article').each((_, el) => {
            const title = $(el).find('h1, h2, h3').first().text().trim();
            const body = $(el).find('p').first().text().trim();
            if (title && !/no.*active/i.test(title)) {
              warnings.push({ title, body, rawSeverity: '' });
            }
          });
        }
      } catch (e) {
        console.warn('[MetOffice] Alert page error:', e.message);
      }
    }

    console.log(`[MetOffice] Found ${warnings.length} warnings`);
    const db = getDB();

    for (const w of warnings) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'Met Office TT' AND title = $1 AND created_at > NOW() - INTERVAL '6 hours'`,
        [w.title]
      );
      if (rows.length) continue;

      const severity = inferSeverity(w.title + ' ' + (w.rawSeverity || ''));

      await createAlert({
        type: 'weather',
        severity,
        title: w.title,
        body: w.body || 'Weather advisory issued by the Trinidad & Tobago Meteorological Service.',
        source: 'Met Office TT',
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });

      console.log(`[MetOffice] New warning: ${w.title}`);
    }
  } catch (err) {
    console.error('[MetOffice] Scraper error:', err.message);
  }
}

function inferSeverity(text) {
  const t = text.toLowerCase();
  if (t.includes('red') || t.includes('hurricane') || t.includes('tropical storm') || t.includes('extreme')) return 'critical';
  if (t.includes('orange') || t.includes('amber') || t.includes('warning') || t.includes('watch') || t.includes('heavy rain')) return 'warning';
  if (t.includes('yellow') || t.includes('advisory')) return 'info';
  return 'info';
}

module.exports = { scrapeMetOffice };
