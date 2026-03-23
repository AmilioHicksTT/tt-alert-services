const express = require('express');
const { z } = require('zod');
const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendAreaNotification } = require('../services/notificationService');

const router = express.Router();

const createAlertSchema = z.object({
  type: z.enum(['flood', 'road_closure', 'weather', 'power_outage', 'water_outage', 'landslide', 'emergency', 'other']),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  title: z.string().min(5).max(200),
  body: z.string().min(10),
  source: z.string().max(100).optional(),
  district_code: z.string().max(10).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius_km: z.number().positive().optional(),
  expires_at: z.string().datetime().optional(),
});

// GET /api/alerts — list active alerts, optionally filtered by area
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { district, lat, lng, radius = 25, type, limit = 50 } = req.query;
    const db = getDB();
    const redis = getRedis();

    // Cache key
    const cacheKey = `alerts:${district || ''}:${lat || ''}:${lng || ''}:${type || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    let query = `
      SELECT id, type, severity, title, body, source, district_code,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng,
             radius_km, active, expires_at, created_at
      FROM alerts
      WHERE active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    if (district) {
      params.push(district);
      query += ` AND district_code = $${params.length}`;
    } else if (lat && lng) {
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
      query += `
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length - 2}), 4326)::geography,
          $${params.length} * 1000
        )
      `;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY severity DESC, created_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(query, params);
    await redis.setex(cacheKey, 30, JSON.stringify(rows)); // cache 30s

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT id, type, severity, title, body, source, district_code,
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng,
              radius_km, active, expires_at, created_at
       FROM alerts WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alert not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts — admin/system creates alert
router.post('/', requireAuth, validate(createAlertSchema), async (req, res, next) => {
  try {
    const { type, severity, title, body, source, district_code, lat, lng, radius_km, expires_at } = req.body;
    const db = getDB();

    const locationExpr = lat && lng
      ? `ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)`
      : 'NULL';

    const { rows } = await db.query(
      `INSERT INTO alerts (type, severity, title, body, source, district_code, location, radius_km, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, ${locationExpr}, $7, $8)
       RETURNING *`,
      [type, severity, title, body, source, district_code, radius_km, expires_at]
    );

    const alert = rows[0];

    // Broadcast via WebSocket
    const io = req.app.get('io');
    if (district_code) io.to(`area:${district_code}`).emit('alert:new', alert);
    io.to('alerts:all').emit('alert:new', alert);

    // Push notification to district subscribers
    await sendAreaNotification(district_code, {
      title: `${severity.toUpperCase()}: ${title}`,
      body,
      data: { alertId: alert.id, type },
    });

    // Bust cache
    const redis = getRedis();
    const keys = await redis.keys('alerts:*');
    if (keys.length) await redis.del(...keys);

    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/deactivate
router.patch('/:id/deactivate', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    await db.query(`UPDATE alerts SET active = FALSE, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    const io = req.app.get('io');
    io.to('alerts:all').emit('alert:deactivated', { id: req.params.id });
    res.json({ message: 'Alert deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
