/**
 * Generates placeholder app assets for T&T Alert + Services
 * Run: node scripts/generateAssets.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const combined = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function createPNG(width, height, fillFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  // compression=0, filter=0, interlace=0

  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fillFn(x, y, width, height);
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 2 + x * 3] = g;
      raw[y * rowSize + 3 + x * 3] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// T&T national colors
const RED = [200, 16, 46];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const GOLD = [255, 205, 0];

// icon.png — 1024x1024 red background with white circle
function iconFill(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const r = w * 0.35;
  const innerR = w * 0.25;
  // Outer ring
  if (dist < r && dist > r - w * 0.05) return WHITE;
  // Inner circle fill
  if (dist < innerR) return WHITE;
  // Bell shape in center
  const bx = (x - cx) / (w * 0.12);
  const by = (y - cy - h * 0.02) / (h * 0.12);
  if (bx * bx + by * by < 1.2) return RED;
  return RED;
}

// splash.png — 1242x2436 red with centered white stripe
function splashFill(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  // White diagonal stripe (T&T flag style)
  const diagDist = Math.abs((x - cx) - (y - cy) * 0.3);
  if (diagDist < w * 0.06) return BLACK;
  if (diagDist < w * 0.08) return GOLD;
  return RED;
}

// adaptive-icon.png — 1024x1024 solid red
function adaptiveFill() {
  return RED;
}

// notification-icon.png — 96x96 white bell on transparent (use white)
function notifFill(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  // Simple bell silhouette
  const relX = (x - cx) / (w * 0.3);
  const relY = (y - cy) / (h * 0.3);
  if (dist < w * 0.45) {
    if (relX * relX + relY * relY < 1.5 && y > h * 0.25 && y < h * 0.78) return WHITE;
    if (y > h * 0.72 && y < h * 0.82 && Math.abs(x - cx) < w * 0.18) return WHITE;
  }
  return BLACK;
}

const assets = [
  { name: 'icon.png',          width: 1024, height: 1024, fill: iconFill },
  { name: 'splash.png',        width: 1242, height: 2436, fill: splashFill },
  { name: 'adaptive-icon.png', width: 1024, height: 1024, fill: adaptiveFill },
  { name: 'notification-icon.png', width: 96, height: 96, fill: notifFill },
];

for (const { name, width, height, fill } of assets) {
  const outPath = path.join(assetsDir, name);
  const buf = createPNG(width, height, fill);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${name} (${width}x${height}, ${buf.length} bytes)`);
}

// Minimal WAV beep (440 Hz, 0.3s, mono, 16-bit, 44100 Hz)
function createBeepWav() {
  const sampleRate = 44100;
  const duration = 0.3;
  const freq = 880;
  const numSamples = Math.floor(sampleRate * duration);
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;

  const buf = Buffer.alloc(44 + dataSize);
  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);      // chunk size
  buf.writeUInt16LE(1, 20);       // PCM
  buf.writeUInt16LE(1, 22);       // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32);       // block align
  buf.writeUInt16LE(16, 34);      // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // Generate tone with fade in/out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(t / 0.01, (duration - t) / 0.05));
    const sample = Math.round(envelope * 20000 * Math.sin(2 * Math.PI * freq * t));
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}

const wavPath = path.join(assetsDir, 'alert.wav');
fs.writeFileSync(wavPath, createBeepWav());
console.log(`✓ alert.wav (${createBeepWav().length} bytes)`);
console.log('\nAll assets generated in mobile/assets/');
