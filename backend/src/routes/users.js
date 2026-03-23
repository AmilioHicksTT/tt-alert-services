const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getDB } = require('../config/database');
const { getRedis } = require('../config/redis');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+1868\d{7}$/, 'Must be a valid T&T phone number (+1868XXXXXXX)'),
});

const verifyOtpSchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
});

const updateProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
  district_code: z.string().max(10).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  fcm_token: z.string().optional(),
});

// POST /api/users/otp/send
router.post('/otp/send', validate(sendOtpSchema), async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Rate limit: max 3 OTPs per phone per 10 minutes
    const redis = getRedis();
    const key = `otp_rate:${phone}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 600);
    if (count > 3) {
      return res.status(429).json({ error: 'Too many OTP requests. Wait 10 minutes.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const db = getDB();
    await db.query(
      `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
      [phone, code, expiresAt]
    );

    // Send via Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.NODE_ENV !== 'development') {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.messages.create({
        body: `Your T&T Alert code is: ${code}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    } else {
      // Dev mode: log the code
      console.log(`[DEV] OTP for ${phone}: ${code}`);
    }

    res.json({ message: 'OTP sent' });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/otp/verify
router.post('/otp/verify', validate(verifyOtpSchema), async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    const db = getDB();

    const { rows } = await db.query(
      `SELECT id FROM otp_codes
       WHERE phone = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark used
    await db.query(`UPDATE otp_codes SET used = TRUE WHERE id = $1`, [rows[0].id]);

    // Upsert user
    const { rows: users } = await db.query(
      `INSERT INTO users (phone, verified) VALUES ($1, TRUE)
       ON CONFLICT (phone) DO UPDATE SET verified = TRUE, updated_at = NOW()
       RETURNING id, phone, display_name, district_code, verified`,
      [phone]
    );

    const user = users[0];
    const token = jwt.sign({ id: user.id, phone: user.phone }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT id, phone, display_name, district_code, verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me
router.patch('/me', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { display_name, district_code, lat, lng, fcm_token } = req.body;
    const db = getDB();

    const locationExpr = lat && lng ? `ST_SetSRID(ST_MakePoint($6, $5), 4326)` : null;

    const params = [display_name, district_code, fcm_token, req.user.id];
    let query = `UPDATE users SET updated_at = NOW()`;
    if (display_name !== undefined) query += `, display_name = $1`;
    if (district_code !== undefined) query += `, district_code = $2`;
    if (fcm_token !== undefined) query += `, fcm_token = $3`;
    if (lat && lng) {
      query += `, location = ST_SetSRID(ST_MakePoint($6, $5), 4326)`;
      params.push(lat, lng);
    }
    query += ` WHERE id = $4 RETURNING id, phone, display_name, district_code, verified`;

    const { rows } = await db.query(query, params);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
