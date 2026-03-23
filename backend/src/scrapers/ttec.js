/**
 * T&TEC Scraper — Trinidad and Tobago Electricity Commission
 * Source: https://www.ttec.co.tt
 *
 * Scrapes planned and unplanned outage notices.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const TTEC_URL = 'https://www.ttec.co.tt/outages';

const DISTRICT_MAP = {
  'port of spain': 'POS',
  'san fernando': 'SFO',
  arima: 'ARI',
  chaguanas: 'CHG',
  'point fortin': 'PTF',
  'diego martin': 'DGO',
  tunapuna: 'TUP',
  'san juan': 'SJU',
  penal: 'PED',
  siparia: 'SIP',
  'rio claro': 'RCL',
  mayaro: 'RCL',
  'sangre grande': 'SNG',
  couva: 'COU',
  tobago: 'TOB',
};

async function scrapeTTEC() {
  try {
    const { data: html } = await axios.get(TTEC_URL, { timeout: 10000 });
    const $ = cheerio.load(html);

    const outages = [];
    $('.outage, .notice, .views-row, article, tr').each((_, el) => {
      const title = $(el).find('h2, h3, td:first-child, .title').text().trim();
      const body = $(el).find('p, td, .body').text().trim();
      if (title && title.length > 5) outages.push({ title, body });
    });

    const db = getDB();

    for (const outage of outages) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'T&TEC' AND title = $1 AND created_at > NOW() - INTERVAL '12 hours'`,
        [outage.title]
      );
      if (rows.length) continue;

      const district_code = resolveDistrict(outage.title + ' ' + outage.body);
      const isPlanned = /planned|scheduled/i.test(outage.title + outage.body);

      await createAlert({
        type: 'power_outage',
        severity: isPlanned ? 'info' : 'warning',
        title: outage.title,
        body: outage.body || 'Power outage reported. Check T&TEC for updates.',
        source: 'T&TEC',
        district_code,
        expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      });

      console.log(`[T&TEC] New outage: ${outage.title}`);
    }
  } catch (err) {
    console.error('[T&TEC] Scraper error:', err.message);
  }
}

function resolveDistrict(text) {
  const lower = text.toLowerCase();
  for (const [name, code] of Object.entries(DISTRICT_MAP)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

module.exports = { scrapeTTEC };
