const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');
const { sendAreaNotification } = require('./notificationService');

async function createAlert({ type, severity, title, body, source, district_code, lat, lng, radius_km, expires_at }) {
  const db = getDB();

  const locationExpr = lat && lng
    ? `ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)`
    : 'NULL';

  const { rows } = await db.query(
    `INSERT INTO alerts (type, severity, title, body, source, district_code, location, radius_km, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, ${locationExpr}, $7, $8)
     RETURNING *`,
    [type, severity, title, body, source, district_code, radius_km || null, expires_at || null]
  );

  const alert = rows[0];

  // Bust cache
  const redis = getRedis();
  const keys = await redis.keys('alerts:*');
  if (keys.length) await redis.del(...keys);

  const areaKeys = await redis.keys('area:summary:*');
  if (areaKeys.length) await redis.del(...areaKeys);

  // Push notification
  await sendAreaNotification(district_code, {
    title: `${severity.toUpperCase()}: ${title}`,
    body,
    data: { alertId: alert.id, type },
  });

  return alert;
}

async function deactivateExpiredAlerts() {
  const db = getDB();
  const { rowCount } = await db.query(
    `UPDATE alerts SET active = FALSE, updated_at = NOW()
     WHERE active = TRUE AND expires_at IS NOT NULL AND expires_at < NOW()`
  );
  if (rowCount > 0) {
    console.log(`[AlertService] Deactivated ${rowCount} expired alerts`);
    const redis = getRedis();
    const keys = await redis.keys('alerts:*');
    if (keys.length) await redis.del(...keys);
  }
}

module.exports = { createAlert, deactivateExpiredAlerts };
