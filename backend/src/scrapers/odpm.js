/**
 * ODPM Scraper — Office of Disaster Preparedness and Management
 * Source: https://www.odpm.gov.tt
 *
 * Scrapes active advisories and flood warnings published on the ODPM website.
 * When ODPM provides an official API, replace the scraping logic with API calls.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const ODPM_URL = 'https://www.odpm.gov.tt/node/116'; // Alerts & Warnings page

async function scrapeODPM() {
  try {
    const { data: html } = await axios.get(ODPM_URL, { timeout: 10000 });
    const $ = cheerio.load(html);

    const alerts = [];
    // ODPM lists advisories in .views-row blocks — adjust selector to actual page structure
    $('.views-row, .advisory-item, article').each((_, el) => {
      const title = $(el).find('h2, h3, .views-field-title').text().trim();
      const body = $(el).find('.views-field-body, .field-body, p').first().text().trim();
      const dateText = $(el).find('.date-display-single, time').text().trim();

      if (title && body) {
        alerts.push({ title, body, date: dateText });
      }
    });

    const db = getDB();

    for (const item of alerts) {
      // Deduplicate: skip if an alert with same title from ODPM already exists today
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
        body: item.body,
        source: 'ODPM',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      console.log(`[ODPM] New alert: ${item.title}`);
    }
  } catch (err) {
    console.error('[ODPM] Scraper error:', err.message);
  }
}

function inferAlertType(title) {
  const t = title.toLowerCase();
  if (t.includes('flood')) return 'flood';
  if (t.includes('road') || t.includes('closure')) return 'road_closure';
  if (t.includes('weather') || t.includes('tropical') || t.includes('hurricane')) return 'weather';
  if (t.includes('landslide')) return 'landslide';
  return 'emergency';
}

function inferSeverity(title) {
  const t = title.toLowerCase();
  if (t.includes('critical') || t.includes('emergency') || t.includes('hurricane')) return 'critical';
  if (t.includes('warning') || t.includes('flood watch')) return 'warning';
  return 'info';
}

module.exports = { scrapeODPM };
