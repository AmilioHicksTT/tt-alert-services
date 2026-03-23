const express = require('express');
const { z } = require('zod');
const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const createReportSchema = z.object({
  type: z.enum(['water_outage', 'burst_main', 'power_outage', 'blocked_drain', 'fallen_tree', 'flooding', 'road_damage', 'other']),
  description: z.string().max(1000).optional(),
  photo_url: z.string().url().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  district_code: z.string().max(10).optional(),
});

// GET /api/reports — list open reports near a location or district
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { district, lat, lng, radius = 10, type, status = 'open', limit = 100 } = req.query;
    const db = getDB();

    let query = `
      SELECT r.id, r.type, r.description, r.photo_url, r.status, r.upvotes, r.district_code,
             ST_Y(r.location::geometry) AS lat,
             ST_X(r.location::geometry) AS lng,
             r.created_at
      FROM reports r
      WHERE r.status = $1
    `;
    const params = [status];

    if (type) {
      params.push(type);
      query += ` AND r.type = $${params.length}`;
    }

    if (district) {
      params.push(district);
      query += ` AND r.district_code = $${params.length}`;
    } else if (lat && lng) {
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
      query += `
        AND ST_DWithin(
          r.location,
          ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length - 2}), 4326)::geography,
          $${params.length} * 1000
        )
      `;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY r.upvotes DESC, r.created_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT r.*, ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng
       FROM reports r WHERE r.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports
router.post('/', optionalAuth, validate(createReportSchema), async (req, res, next) => {
  try {
    const { type, description, photo_url, lat, lng, district_code } = req.body;
    const db = getDB();

    // Auto-resolve district if not provided
    let resolvedDistrict = district_code;
    if (!resolvedDistrict) {
      const { rows } = await db.query(
        `SELECT code FROM districts
         ORDER BY ST_Distance(centroid, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
         LIMIT 1`,
        [lng, lat]
      );
      resolvedDistrict = rows[0]?.code;
    }

    const { rows } = await db.query(
      `INSERT INTO reports (type, description, photo_url, location, district_code, reporter_id)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326), $6, $7)
       RETURNING id, type, description, status, upvotes, district_code, created_at`,
      [type, description, photo_url, lat, lng, resolvedDistrict, req.user?.id || null]
    );

    const report = rows[0];

    // Broadcast to area subscribers
    const io = req.app.get('io');
    if (resolvedDistrict) io.to(`area:${resolvedDistrict}`).emit('report:new', report);
    io.to('alerts:all').emit('report:new', report);

    // Invalidate nearby cache
    const redis = getRedis();
    const keys = await redis.keys('alerts:*');
    if (keys.length) await redis.del(...keys);

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/upvote
router.post('/:id/upvote', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    await db.query(
      `INSERT INTO report_upvotes (report_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    await db.query(
      `UPDATE reports SET upvotes = (SELECT COUNT(*) FROM report_upvotes WHERE report_id = $1)
       WHERE id = $1`,
      [req.params.id]
    );
    const { rows } = await db.query(`SELECT upvotes FROM reports WHERE id = $1`, [req.params.id]);
    res.json({ upvotes: rows[0]?.upvotes });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/:id/status — for agency updates
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'acknowledged', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const db = getDB();
    const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE reports SET status = $1, resolved_at = ${resolvedAt}, updated_at = NOW() WHERE id = $2`,
      [status, req.params.id]
    );

    const io = req.app.get('io');
    io.to('alerts:all').emit('report:updated', { id: req.params.id, status });

    res.json({ message: 'Status updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
