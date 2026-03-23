/**
 * T&TEC Scraper — Trinidad and Tobago Electricity Commission
 * Source: https://ttec.co.tt/cis/outages_public.html
 *
 * Scrapes scheduled power outage notices from the public outage table.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createAlert } = require('../services/alertService');
const { getDB } = require('../config/database');

// T&TEC loads outage data dynamically from this static HTML file
const TTEC_URL = 'https://ttec.co.tt/cis/outages_public.html';

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
  barrackpore: 'PTF2',
  tobago: 'TOB',
  scarborough: 'TOB',
  lowlands: 'TOB',
  maraval: 'DGO',
  'santa cruz': 'SJU',
  aranguez: 'SJU',
  wallerfield: 'TUP',
};

async function scrapeTTEC() {
  try {
    const { data: html } = await axios.get(TTEC_URL, { timeout: 15000 });
    const $ = cheerio.load(html);

    const outages = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Table has 4 columns: Date (DD/MM/YYYY), Distribution Area, Location, Time
    $('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 4) return;

      const dateStr = cells.eq(0).text().trim();
      const area = cells.eq(1).text().trim();
      const location = cells.eq(2).text().trim();
      const time = cells.eq(3).text().trim();

      // Skip header rows
      if (/^date$/i.test(dateStr) || /^location$/i.test(location)) return;
      // Skip cancelled entries
      if (/cancelled/i.test($(row).text())) return;

      // Parse DD/MM/YYYY and skip past dates
      const dateParts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateParts) {
        const outageDate = new Date(dateParts[3], dateParts[2] - 1, dateParts[1]);
        if (outageDate < today) return;
      }

      if (location && time) {
        const title = `Scheduled Outage — ${area || 'Trinidad & Tobago'}`;
        const body = `Power will be interrupted in ${location}. Time: ${time}. Date: ${dateStr}`;
        outages.push({ title, body, location, area });
      }
    });

    console.log(`[T&TEC] Found ${outages.length} scheduled outages`);
    const db = getDB();

    for (const outage of outages) {
      const { rows } = await db.query(
        `SELECT id FROM alerts WHERE source = 'T&TEC' AND title = $1 AND created_at > NOW() - INTERVAL '12 hours'`,
        [outage.title]
      );
      if (rows.length) continue;

      const district_code = resolveDistrict(outage.location + ' ' + outage.area);

      await createAlert({
        type: 'power_outage',
        severity: 'info',
        title: outage.title,
        body: outage.body,
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
