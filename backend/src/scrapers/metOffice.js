/**
 * Met Office TT Scraper — Trinidad and Tobago Meteorological Service
 * Source: https://www.metoffice.gov.tt
 *
 * Scrapes weather warnings and tropical weather advisories.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const MET_WARNINGS_URL = 'https://www.metoffice.gov.tt/warnings';

async function scrapeMetOffice() {
  try {
    const { data: html } = await axios.get(MET_WARNINGS_URL, { timeout: 10000 });
    const $ = cheerio.load(html);

    const warnings = [];
    $('.warning, .advisory, article, .views-row').each((_, el) => {
      const title = $(el).find('h1, h2, h3, .title').first().text().trim();
      const body = $(el).find('p, .body').first().text().trim();
      if (title) warnings.push({ title, body });
    });

    const db = getDB();

    for (const w of warnings) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'Met Office TT' AND title = $1 AND created_at > NOW() - INTERVAL '6 hours'`,
        [w.title]
      );
      if (rows.length) continue;

      const severity = inferSeverity(w.title);

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

function inferSeverity(title) {
  const t = title.toLowerCase();
  if (t.includes('hurricane') || t.includes('tropical storm') || t.includes('extreme')) return 'critical';
  if (t.includes('warning') || t.includes('watch') || t.includes('heavy rain')) return 'warning';
  return 'info';
}

module.exports = { scrapeMetOffice };
