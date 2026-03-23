const express = require('express');
const { z } = require('zod');
const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/transport/routes
router.get('/routes', async (req, res, next) => {
  try {
    const { type, status } = req.query;
    const redis = getRedis();

    const cacheKey = `transport:routes:${type || ''}:${status || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const db = getDB();
    let query = `SELECT id, code, name, type, origin, destination, status, delay_mins, status_note, last_updated
                 FROM transport_routes WHERE 1=1`;
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY type, name';
    const { rows } = await db.query(query, params);

    await redis.setex(cacheKey, 60, JSON.stringify(rows));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/transport/routes/:id
router.get('/routes/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT * FROM transport_routes WHERE id = $1 OR code = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Route not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/transport/routes — seed or create route
router.post('/routes', requireAuth, async (req, res, next) => {
  try {
    const { code, name, type, origin, destination, waypoints } = req.body;
    const db = getDB();
    const { rows } = await db.query(
      `INSERT INTO transport_routes (code, name, type, origin, destination, waypoints)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET name=$2, type=$3, origin=$4, destination=$5, waypoints=$6
       RETURNING *`,
      [code, name, type, origin, destination, JSON.stringify(waypoints || [])]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transport/routes/:id/status — update delay/cancellation
router.patch('/routes/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status, delay_mins, status_note } = req.body;
    const db = getDB();
    const { rows } = await db.query(
      `UPDATE transport_routes
       SET status = $1, delay_mins = $2, status_note = $3, last_updated = NOW()
       WHERE id = $4 OR code = $4
       RETURNING id, code, name, status, delay_mins, status_note, last_updated`,
      [status, delay_mins || 0, status_note, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Route not found' });

    // Invalidate cache
    const redis = getRedis();
    const keys = await redis.keys('transport:*');
    if (keys.length) await redis.del(...keys);

    // Broadcast via WebSocket
    const io = req.app.get('io');
    io.to('alerts:all').emit('transport:updated', rows[0]);

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/transport/routes/:id/crowd-report — citizen delay report
router.post('/routes/:id/crowd-report', requireAuth, async (req, res, next) => {
  try {
    const { delay_mins, note } = req.body;
    const db = getDB();

    // Simple crowd signal: average recent reports to bump delay estimate
    const { rows } = await db.query(
      `UPDATE transport_routes
       SET delay_mins = GREATEST(delay_mins, $1),
           status = CASE WHEN $1 > 0 THEN 'delayed' ELSE status END,
           status_note = COALESCE($2, status_note),
           last_updated = NOW()
       WHERE id = $3 OR code = $3
       RETURNING id, code, status, delay_mins`,
      [delay_mins || 0, note, req.params.id]
    );

    const io = req.app.get('io');
    io.to('alerts:all').emit('transport:updated', rows[0]);

    res.json({ message: 'Report received', route: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
