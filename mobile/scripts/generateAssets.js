/**
 * Generates professional app assets for T&T Alert + Services
 * Trinidad & Tobago civic alert app
 *
 * National colors: Red (#C8102E), White (#FFFFFF), Black (#000000)
 *
 * Run: node scripts/generateAssets.js
 * No external dependencies - uses only built-in Node.js modules.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// ---------------------------------------------------------------------------
// PNG encoder (no dependencies)
// ---------------------------------------------------------------------------

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
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

/**
 * Create a PNG with RGBA pixels (color type 6).
 * fillFn(x, y, w, h) => [r, g, b, a]
 */
function createPNG(width, height, fillFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  // compression=0, filter=0, interlace=0

  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y, width, height);
      const off = y * rowSize + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
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

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const RED     = [0xC8, 0x10, 0x2E];
const WHITE   = [0xFF, 0xFF, 0xFF];
const BLACK   = [0x00, 0x00, 0x00];
const DARK_BG = [0x1A, 0x1A, 0x2E];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// Clamp helper
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------------------------------------------------------------------------
// Shape helpers (all work in normalized coordinates)
// ---------------------------------------------------------------------------

/**
 * Returns true if (px, py) is inside the shield shape centered at (cx, cy)
 * with given halfWidth and halfHeight.
 * Shield = a rectangle with a pointed bottom (like a heraldic shield).
 */
function insideShield(px, py, cx, cy, halfW, halfH) {
  const rx = (px - cx) / halfW;
  const ry = (py - cy) / halfH;

  // Shield body: top portion is a rounded rectangle, bottom tapers to a point
  // Top section: -1 <= ry <= 0.3, |rx| <= 1 with rounded top corners
  // Bottom section: 0.3 <= ry <= 1, linearly tapers from |rx|<=1 to |rx|<=0

  if (ry < -1.0 || ry > 1.0) return false;

  // Top corners: round radius
  const cornerR = 0.2;
  if (ry < -1.0 + cornerR) {
    // In top-corner zone
    const maxX = 1.0 - cornerR;
    if (Math.abs(rx) > maxX) {
      const dx = Math.abs(rx) - maxX;
      const dy = (-1.0 + cornerR) - ry;
      if (dx * dx + dy * dy > cornerR * cornerR) return false;
    }
  }

  if (ry <= 0.3) {
    return Math.abs(rx) <= 1.0;
  }
  // Bottom taper
  const taper = 1.0 - (ry - 0.3) / 0.7;
  return Math.abs(rx) <= taper;
}

/**
 * Returns true if (px, py) is inside a bell shape centered at (cx, cy).
 * Bell = dome on top + flared body + clapper at bottom.
 */
function insideBell(px, py, cx, cy, size) {
  const rx = (px - cx) / size;
  const ry = (py - cy) / size;

  // Small circle on top (handle)
  const handleCy = -0.72;
  const handleR = 0.08;
  if ((rx * rx + (ry - handleCy) * (ry - handleCy)) <= handleR * handleR) return true;

  // Dome: upper half of bell (-0.65 to -0.2)
  if (ry >= -0.65 && ry <= -0.2) {
    const t = (ry - (-0.65)) / 0.45; // 0..1
    const domeWidth = 0.15 + 0.25 * Math.sqrt(t);
    if (Math.abs(rx) <= domeWidth) return true;
  }

  // Body: flared section (-0.2 to 0.35)
  if (ry >= -0.2 && ry <= 0.35) {
    const t = (ry - (-0.2)) / 0.55;
    const bodyWidth = 0.40 + 0.20 * t * t;
    if (Math.abs(rx) <= bodyWidth) return true;
  }

  // Rim: wide bottom edge (0.35 to 0.45)
  if (ry >= 0.35 && ry <= 0.45) {
    const rimWidth = 0.65;
    if (Math.abs(rx) <= rimWidth) return true;
  }

  // Clapper: small circle below
  const clapCy = 0.55;
  const clapR = 0.07;
  if ((rx * rx + (ry - clapCy) * (ry - clapCy)) <= clapR * clapR) return true;

  return false;
}

/**
 * Compute a simple antialiased edge factor.
 * Returns 0.0 (fully outside) to 1.0 (fully inside) based on signed distance.
 */
function edgeSoften(inside, px, py, testFn, radius) {
  if (radius <= 0) return inside ? 1.0 : 0.0;
  // Sample neighbors for crude AA
  let count = 0;
  const steps = 3;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (testFn(px + dx * radius / steps, py + dy * radius / steps)) count++;
    }
  }
  return count / 9;
}

// ---------------------------------------------------------------------------
// Icon fill (1024x1024)
// ---------------------------------------------------------------------------

function iconFill(x, y, w, h) {
  const cx = w / 2, cy = h / 2;

  // --- Rounded square background with gradient ---
  const margin = w * 0.0; // full bleed
  const cornerRadius = w * 0.18;
  const inRect = (x >= margin && x < w - margin && y >= margin && y < h - margin);

  // Check rounded corners
  let insideBg = false;
  if (inRect) {
    const lx = x - margin, ly = y - margin;
    const bw = w - 2 * margin, bh = h - 2 * margin;
    const cr = cornerRadius;

    insideBg = true;
    // Top-left corner
    if (lx < cr && ly < cr) {
      insideBg = ((lx - cr) * (lx - cr) + (ly - cr) * (ly - cr)) <= cr * cr;
    }
    // Top-right corner
    if (lx > bw - cr && ly < cr) {
      insideBg = ((lx - (bw - cr)) * (lx - (bw - cr)) + (ly - cr) * (ly - cr)) <= cr * cr;
    }
    // Bottom-left corner
    if (lx < cr && ly > bh - cr) {
      insideBg = ((lx - cr) * (lx - cr) + (ly - (bh - cr)) * (ly - (bh - cr))) <= cr * cr;
    }
    // Bottom-right corner
    if (lx > bw - cr && ly > bh - cr) {
      insideBg = ((lx - (bw - cr)) * (lx - (bw - cr)) + (ly - (bh - cr)) * (ly - (bh - cr))) <= cr * cr;
    }
  }

  if (!insideBg) {
    return [0, 0, 0, 0]; // transparent outside rounded rect
  }

  // Gradient: darker at bottom
  const gradientT = y / h;
  const bgColor = lerpColor(RED, [0x8A, 0x0B, 0x20], gradientT * 0.4);

  // --- Subtle radial vignette for depth ---
  const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const vignette = 1.0 - 0.15 * (dist / maxDist);
  const vignetteColor = [
    clamp(Math.round(bgColor[0] * vignette), 0, 255),
    clamp(Math.round(bgColor[1] * vignette), 0, 255),
    clamp(Math.round(bgColor[2] * vignette), 0, 255),
  ];

  // --- Shield ---
  const shieldHW = w * 0.28;
  const shieldHH = h * 0.32;
  const shieldCy = cy - h * 0.02; // slightly above center

  const inShield = insideShield(x, y, cx, shieldCy, shieldHW, shieldHH);

  if (inShield) {
    // Shield is white with slight transparency for elegance
    // Check if inside the bell (drawn in red on top of white shield)
    const bellSize = w * 0.18;
    const bellCy = shieldCy + h * 0.01;
    const inBell = insideBell(x, y, cx, bellCy, bellSize);

    if (inBell) {
      // Bell is in the red background color (cut-out effect)
      return [...vignetteColor, 255];
    }

    // White shield with soft edge AA
    const aa = edgeSoften(true, x, y,
      (px, py) => insideShield(px, py, cx, shieldCy, shieldHW, shieldHH), 1.5);
    const alpha = clamp(Math.round(aa * 255), 0, 255);
    // Blend white over vignetteColor
    const blendR = lerp(vignetteColor[0], 255, aa);
    const blendG = lerp(vignetteColor[1], 255, aa);
    const blendB = lerp(vignetteColor[2], 255, aa);
    return [blendR, blendG, blendB, 255];
  }

  return [...vignetteColor, 255];
}

// ---------------------------------------------------------------------------
// Splash fill (1242x2436)
// ---------------------------------------------------------------------------

function splashFill(x, y, w, h) {
  const cx = w / 2, cy = h * 0.42; // icon slightly above center

  // Dark background with very subtle radial gradient
  const dist = Math.sqrt((x - w / 2) * (x - w / 2) + (y - h / 2) * (y - h / 2));
  const maxDist = Math.sqrt((w / 2) * (w / 2) + (h / 2) * (h / 2));
  const gradT = dist / maxDist;
  const bg = lerpColor(DARK_BG, [0x10, 0x10, 0x20], gradT * 0.5);

  // --- Shield + bell (larger version) ---
  const shieldHW = w * 0.18;
  const shieldHH = w * 0.22; // use width for proportions
  const shieldCy = cy;

  const inShield = insideShield(x, y, cx, shieldCy, shieldHW, shieldHH);

  if (inShield) {
    const bellSize = w * 0.12;
    const bellCy = shieldCy + w * 0.005;
    const inBell = insideBell(x, y, cx, bellCy, bellSize);

    if (inBell) {
      // Bell cut-out: show background through the bell
      return [...bg, 255];
    }

    // White shield
    const aa = edgeSoften(true, x, y,
      (px, py) => insideShield(px, py, cx, shieldCy, shieldHW, shieldHH), 1.5);
    const blendR = lerp(bg[0], 255, aa);
    const blendG = lerp(bg[1], 255, aa);
    const blendB = lerp(bg[2], 255, aa);
    return [blendR, blendG, blendB, 255];
  }

  // --- "T&T ALERT" text approximation using block letters ---
  // Render simple block-pixel text below the shield
  const textY = shieldCy + shieldHH + w * 0.12;
  const letterH = Math.round(w * 0.045);
  const letterW = Math.round(letterH * 0.7);
  const gap = Math.round(letterH * 0.3);

  // "T&T ALERT" in a 5-row bitmap font
  // Each letter is 5 rows x variable cols, stored as strings of '#' and ' '
  const font = {
    'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
    '&': [' ## ', '# # ', ' ## ', '# ##', ' ###'],
    'A': [' ### ', '#   #', '#####', '#   #', '#   #'],
    'L': ['#    ', '#    ', '#    ', '#    ', '#####'],
    'E': ['#####', '#    ', '#### ', '#    ', '#####'],
    'R': ['#### ', '#   #', '#### ', '#  # ', '#   #'],
    ' ': ['   ', '   ', '   ', '   ', '   '],
  };

  const text = 'T&T ALERT';
  // Calculate total width
  let totalW = 0;
  for (const ch of text) {
    const glyph = font[ch] || font[' '];
    totalW += glyph[0].length * (letterW / 5) + gap;
  }
  totalW -= gap;

  const textStartX = cx - totalW / 2;
  const cellW = letterW / 5;
  const cellH = letterH / 5;

  if (y >= textY && y < textY + letterH) {
    const row = Math.floor((y - textY) / cellH);
    if (row >= 0 && row < 5) {
      let curX = textStartX;
      for (const ch of text) {
        const glyph = font[ch] || font[' '];
        const glyphW = glyph[0].length * cellW;
        if (x >= curX && x < curX + glyphW) {
          const col = Math.floor((x - curX) / cellW);
          if (col >= 0 && col < glyph[row].length && glyph[row][col] === '#') {
            return [255, 255, 255, 255];
          }
        }
        curX += glyphW + gap;
      }
    }
  }

  // --- Thin red accent line below text ---
  const lineY = textY + letterH + w * 0.03;
  const lineHalfW = w * 0.15;
  const lineThickness = Math.max(2, Math.round(w * 0.004));
  if (y >= lineY && y < lineY + lineThickness && Math.abs(x - cx) < lineHalfW) {
    // Fade edges
    const edgeT = Math.abs(x - cx) / lineHalfW;
    const fade = 1.0 - clamp((edgeT - 0.7) / 0.3, 0, 1);
    return [lerp(bg[0], RED[0], fade), lerp(bg[1], RED[1], fade), lerp(bg[2], RED[2], fade), 255];
  }

  return [...bg, 255];
}

// ---------------------------------------------------------------------------
// Adaptive icon fill (1024x1024) - solid red with gradient
// ---------------------------------------------------------------------------

function adaptiveFill(x, y, w, h) {
  const gradientT = y / h;
  const c = lerpColor(RED, [0x9A, 0x0D, 0x24], gradientT * 0.35);
  return [...c, 255];
}

// ---------------------------------------------------------------------------
// Notification icon (96x96) - white bell on transparent
// ---------------------------------------------------------------------------

function notifFill(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const bellSize = w * 0.38;

  if (insideBell(x, y, cx, cy, bellSize)) {
    return [255, 255, 255, 255];
  }
  return [0, 0, 0, 0]; // transparent
}

// ---------------------------------------------------------------------------
// Generate assets
// ---------------------------------------------------------------------------

const assets = [
  { name: 'icon.png',              width: 1024, height: 1024, fill: iconFill },
  { name: 'splash.png',            width: 1242, height: 2436, fill: splashFill },
  { name: 'adaptive-icon.png',     width: 1024, height: 1024, fill: adaptiveFill },
  { name: 'notification-icon.png', width: 96,   height: 96,   fill: notifFill },
];

console.log('Generating T&T Alert + Services assets...\n');

for (const { name, width, height, fill } of assets) {
  const outPath = path.join(assetsDir, name);
  console.log(`  Generating ${name} (${width}x${height})...`);
  const buf = createPNG(width, height, fill);
  fs.writeFileSync(outPath, buf);
  console.log(`  -> ${name} written (${(buf.length / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// Alert sound (WAV beep - 880 Hz, 0.3s, mono, 16-bit, 44100 Hz)
// ---------------------------------------------------------------------------

function createBeepWav() {
  const sampleRate = 44100;
  const duration = 0.3;
  const freq = 880;
  const numSamples = Math.floor(sampleRate * duration);
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, Math.min(t / 0.01, (duration - t) / 0.05));
    const sample = Math.round(envelope * 20000 * Math.sin(2 * Math.PI * freq * t));
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}

const wavBuf = createBeepWav();
const wavPath = path.join(assetsDir, 'alert.wav');
fs.writeFileSync(wavPath, wavBuf);
console.log(`  -> alert.wav written (${(wavBuf.length / 1024).toFixed(1)} KB)`);

console.log('\nAll assets generated in mobile/assets/');
