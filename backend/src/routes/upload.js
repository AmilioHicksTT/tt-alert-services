const express = require('express');
const { getSupabase } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/upload/photo
// Accepts base64 image, stores in Supabase Storage, returns public URL
router.post('/photo', requireAuth, async (req, res, next) => {
  try {
    const { base64, mimeType = 'image/jpeg' } = req.body;
    if (!base64) return res.status(400).json({ error: 'No image data provided' });

    const buffer = Buffer.from(base64, 'base64');
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const filename = `reports/${uuidv4()}.${ext}`;

    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from('tt-alert-photos')
      .upload(filename, buffer, { contentType: mimeType, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from('tt-alert-photos').getPublicUrl(filename);
    res.json({ url: data.publicUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
