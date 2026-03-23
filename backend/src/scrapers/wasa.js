/**
 * WASA Scraper — Water and Sewerage Authority
 * Source: https://www.wasa.gov.tt
 *
 * Scrapes outage notices and supply disruption advisories.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const WASA_NOTICES_URL = 'https://www.wasa.gov.tt/notices';

// District name -> code mapping for normalising WASA text
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

async function scrapeWASA() {
  try {
    const { data: html } = await axios.get(WASA_NOTICES_URL, { timeout: 10000 });
    const $ = cheerio.load(html);

    const notices = [];
    $('.notice, .advisory, .views-row, article').each((_, el) => {
      const title = $(el).find('h2, h3, .title').text().trim();
      const body = $(el).find('p, .body').first().text().trim();
      if (title) notices.push({ title, body });
    });

    const db = getDB();

    for (const notice of notices) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'WASA' AND title = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [notice.title]
      );
      if (rows.length) continue;

      const district_code = resolveDistrict(notice.title + ' ' + notice.body);

      await createAlert({
        type: 'water_outage',
        severity: 'warning',
        title: notice.title,
        body: notice.body || 'Water supply disruption. Check WASA website for details.',
        source: 'WASA',
        district_code,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      });

      console.log(`[WASA] New notice: ${notice.title}`);
    }
  } catch (err) {
    console.error('[WASA] Scraper error:', err.message);
  }
}

function resolveDistrict(text) {
  const lower = text.toLowerCase();
  for (const [name, code] of Object.entries(DISTRICT_MAP)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

module.exports = { scrapeWASA };
