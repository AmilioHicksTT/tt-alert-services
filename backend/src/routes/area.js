const express = require('express');
const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');

const router = express.Router();

// GET /api/area/summary?lat=&lng= OR ?district=
// The "What's affecting my area today?" dashboard feed
router.get('/summary', async (req, res, next) => {
  try {
    const { district, lat, lng, radius = 25 } = req.query;
    if (!district && !(lat && lng)) {
      return res.status(400).json({ error: 'Provide district or lat/lng' });
    }

    const redis = getRedis();
    const cacheKey = `area:summary:${district || `${lat},${lng}`}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const db = getDB();
    let districtCode = district;

    if (!districtCode && lat && lng) {
      const { rows } = await db.query(
        `SELECT code, name FROM districts
         ORDER BY ST_Distance(centroid, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
         LIMIT 1`,
        [parseFloat(lng), parseFloat(lat)]
      );
      districtCode = rows[0]?.code;
    }

    // Parallel queries
    const [alertsResult, reportsResult, transportResult, districtResult] = await Promise.all([
      // Active alerts for area
      db.query(
        `SELECT id, type, severity, title, body, source, created_at
         FROM alerts
         WHERE active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (district_code = $1 OR district_code IS NULL)
           ${lat && lng ? `AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4 * 1000)` : ''}
         ORDER BY severity DESC, created_at DESC
         LIMIT 20`,
        lat && lng
          ? [districtCode, parseFloat(lat), parseFloat(lng), parseFloat(radius)]
          : [districtCode]
      ),

      // Open citizen reports
      db.query(
        `SELECT id, type, description, upvotes, created_at
         FROM reports
         WHERE status IN ('open', 'acknowledged', 'in_progress')
           AND district_code = $1
         ORDER BY upvotes DESC, created_at DESC
         LIMIT 20`,
        [districtCode]
      ),

      // Disrupted transport routes
      db.query(
        `SELECT id, code, name, type, status, delay_mins, status_note, last_updated
         FROM transport_routes
         WHERE status IN ('delayed', 'cancelled')
         ORDER BY last_updated DESC
         LIMIT 10`
      ),

      // District info
      db.query(`SELECT code, name, region FROM districts WHERE code = $1`, [districtCode]),
    ]);

    const summary = {
      district: districtResult.rows[0] || { code: districtCode },
      alerts: alertsResult.rows,
      reports: reportsResult.rows,
      transport_disruptions: transportResult.rows,
      generated_at: new Date(),
    };

    await redis.setex(cacheKey, 30, JSON.stringify(summary));
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/area/districts
router.get('/districts', async (req, res, next) => {
  try {
    const db = getDB();
    const { rows } = await db.query(`SELECT code, name, region FROM districts ORDER BY name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
