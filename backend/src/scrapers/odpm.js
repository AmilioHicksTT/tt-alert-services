/**
 * ODPM Scraper — Office of Disaster Preparedness and Management
 * Source: https://odpm.gov.tt
 *
 * Scrapes active advisories and emergency notices from the ODPM WordPress site.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

// ODPM migrated from Drupal to WordPress — scrape the homepage and search for alerts
const ODPM_URL = 'https://odpm.gov.tt';

async function scrapeODPM() {
  try {
    const { data: html } = await axios.get(ODPM_URL, { timeout: 15000 });
    const $ = cheerio.load(html);

    const alerts = [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // WordPress site — look for post entries, articles, alert banners
    $('article, .et_pb_post, .post, .entry, .alert-banner, .advisory').each((_, el) => {
      const title = $(el).find('h1, h2, h3, h4, .entry-title, .post-title').first().text().trim();
      const body = $(el).find('p, .entry-content, .post-content, .excerpt').first().text().trim();

      // Check post date if available (WordPress uses <time> or .post-meta)
      const dateStr = $(el).find('time, .post-date, .entry-date, .published').attr('datetime')
        || $(el).find('time, .post-date, .entry-date, .post-meta .date').first().text().trim();
      if (dateStr) {
        const postDate = new Date(dateStr);
        if (!isNaN(postDate) && postDate < sevenDaysAgo) return;
      }

      if (title && title.length > 10 && isRelevantAlert(title + ' ' + body)) {
        alerts.push({ title, body });
      }
    });

    // Also check for any linked PDFs or advisories
    $('a[href*=".pdf"], a[href*="advisory"], a[href*="warning"], a[href*="alert"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && isRelevantAlert(text)) {
        const existing = alerts.find((a) => a.title === text);
        if (!existing) {
          alerts.push({ title: text, body: `See ODPM website for full advisory: ${$(el).attr('href') || ''}` });
        }
      }
    });

    console.log(`[ODPM] Found ${alerts.length} alerts`);
    const db = getDB();

    for (const item of alerts) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'ODPM' AND title = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [item.title]
      );
      if (rows.length) continue;

      const type = inferAlertType(item.title);
      const severity = inferSeverity(item.title);

      await createAlert({
        type,
        severity,
        title: item.title,
        body: item.body || 'Advisory issued by the Office of Disaster Preparedness and Management.',
        source: 'ODPM',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      console.log(`[ODPM] New alert: ${item.title}`);
    }
  } catch (err) {
    console.error('[ODPM] Scraper error:', err.message);
  }
}

function isRelevantAlert(text) {
  return /\b(flood|warning|advisory|alert|hurricane|storm|landslide|earthquake|tsunami|evacuation|emergency|closure|road|weather|rain)\b/i.test(text);
}

function inferAlertType(title) {
  const t = title.toLowerCase();
  if (t.includes('flood')) return 'flood';
  if (t.includes('road') || t.includes('closure')) return 'road_closure';
  if (t.includes('weather') || t.includes('tropical') || t.includes('hurricane') || t.includes('rain') || t.includes('storm')) return 'weather';
  if (t.includes('landslide')) return 'landslide';
  return 'emergency';
}

function inferSeverity(title) {
  const t = title.toLowerCase();
  if (t.includes('critical') || t.includes('emergency') || t.includes('hurricane') || t.includes('tsunami')) return 'critical';
  if (t.includes('warning') || t.includes('flood watch') || t.includes('tropical storm')) return 'warning';
  return 'info';
}

module.exports = { scrapeODPM };
