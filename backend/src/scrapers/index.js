const cron = require('node-cron');
const { scrapeODPM } = require('./odpm');
const { scrapeWASA } = require('./wasa');
const { scrapeTTEC } = require('./ttec');
const { scrapeMetOffice } = require('./metOffice');
const { deactivateExpiredAlerts } = require('../services/alertService');

async function runAll() {
  console.log('[Scrapers] Running all data scrapers...');
  await Promise.allSettled([
    scrapeODPM(),
    scrapeWASA(),
    scrapeTTEC(),
    scrapeMetOffice(),
  ]);
  await deactivateExpiredAlerts();
  console.log('[Scrapers] Done.');
}

function startScrapers() {
  const interval = process.env.SCRAPER_INTERVAL || '*/15 * * * *'; // every 15 min
  cron.schedule(interval, runAll);
  console.log(`[Scrapers] Scheduled with interval: ${interval}`);

  // Run immediately on start
  runAll().catch(console.error);
}

module.exports = { startScrapers, runAll };
