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
    let currentDate = '';

    // The page is an HTML table with date header rows and outage detail rows
    $('tr').each((_, row) => {
      const cells = $(row).find('td');
      const text = $(row).text().trim();

      // Date header rows contain a date string (bold, spans full width)
      if (cells.length <= 2 && text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)) {
        currentDate = text;
        return;
      }

      // Outage detail rows: Area, Location, Time (3+ columns)
      if (cells.length >= 3) {
        const area = cells.eq(cells.length - 3).text().trim();
        const location = cells.eq(cells.length - 2).text().trim();
        const time = cells.eq(cells.length - 1).text().trim();

        // Skip cancelled entries and header rows
        if (location && time && !/cancelled/i.test(text) && !/location/i.test(location)) {
          const title = `Scheduled Outage — ${area || 'Trinidad & Tobago'}`;
          const body = `Power will be interrupted in ${location}. Time: ${time}${currentDate ? `. Date: ${currentDate}` : ''}`;
          outages.push({ title, body, location, area });
        }
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
