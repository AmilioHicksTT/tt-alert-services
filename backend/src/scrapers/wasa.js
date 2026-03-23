/**
 * WASA Scraper — Water and Sewerage Authority
 * Source: https://www.wasa.gov.tt
 *
 * Scrapes active disruptions and public advisory notices.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

const WASA_DISRUPTIONS_URL = 'https://www.wasa.gov.tt/WASA_Media_ActiveDisruptions.php';
const WASA_ADVISORIES_URL = 'https://www.wasa.gov.tt/WASA_Media_PublicAdvisoryNotices.html';

const DISTRICT_MAP = {
  'port of spain': 'POS',
  'san fernando': 'SFO',
  arima: 'ARI',
  chaguanas: 'CHG',
  'point fortin': 'PTF',
  'diego martin': 'DGO',
  tunapuna: 'TUP',
  piarco: 'TUP',
  'san juan': 'SJU',
  laventille: 'SJU',
  penal: 'PED',
  debe: 'PED',
  siparia: 'SIP',
  'rio claro': 'RCL',
  mayaro: 'RCL',
  'sangre grande': 'SNG',
  couva: 'COU',
  tabaquite: 'COU',
  'princes town': 'PTF2',
  tobago: 'TOB',
  scarborough: 'TOB',
  'north oropouche': 'COU',
  caroni: 'CHG',
  'el socorro': 'SJU',
  valsayn: 'SJU',
  curepe: 'TUP',
  'st augustine': 'TUP',
};

async function scrapeWASA() {
  try {
    const notices = [];

    // 1. Scrape active disruptions page
    try {
      const { data: html } = await axios.get(WASA_DISRUPTIONS_URL, { timeout: 15000 });
      const $ = cheerio.load(html);

      // Look for disruption content blocks (skip nav/header/footer boilerplate)
      $('div.row p, div.row li, div.card, div.col-md-4, div.col-md-6, div.col-lg-4').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 40 && text.length < 500 &&
            /\b(disruption|outage|interrupt|no water|water supply|customers|affected|restoration)\b/i.test(text) &&
            !/^\s*Active Disruptions\s*$/i.test(text)) {
          const existing = notices.find((n) => n.body === text);
          if (!existing) {
            notices.push({ title: 'Water Service Disruption', body: text });
          }
        }
      });
    } catch (e) {
      console.warn('[WASA] Disruptions page error:', e.message);
    }

    // 2. Scrape public advisory notices (media releases table)
    try {
      const { data: html } = await axios.get(WASA_ADVISORIES_URL, { timeout: 15000 });
      const $ = cheerio.load(html);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const date = cells.eq(0).text().trim();
          const headline = cells.eq(1).text().trim();

          // Only process advisories from the last 7 days
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate) && parsedDate < sevenDaysAgo) return;

          if (headline && /disruption|outage|interrupt|water supply|burst|leak/i.test(headline)) {
            notices.push({ title: headline, body: `${headline}. Date: ${date}. Source: WASA Media Release.` });
          }
        }
      });

      // Check for PDF advisory links
      $('a[href*=".pdf"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text && /disruption|outage|service/i.test(text)) {
          const existing = notices.find((n) => n.title === text);
          if (!existing) {
            notices.push({ title: text, body: `${text}. See WASA website for full advisory.` });
          }
        }
      });
    } catch (e) {
      console.warn('[WASA] Advisories page error:', e.message);
    }

    console.log(`[WASA] Found ${notices.length} notices`);
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
        body: notice.body || 'Water supply disruption reported. Check WASA website for details.',
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
