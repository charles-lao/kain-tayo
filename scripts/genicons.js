/**
 * Generates the Kain Tayo icon set with no dependencies.
 * The artwork is only a rounded rect plus circles, so it is rasterised
 * analytically with 4x supersampling and encoded as PNG via zlib.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = process.argv[2];
if (require.main === module && !REPO) {
  console.error('usage: node genicons.js <repo-root>');
  process.exit(1);
}

const BRAND = [0xC4, 0x45, 0x1F, 255];
const PAPER = [0xFB, 0xF7, 0xF1, 255];
const GOLD  = [0xE0, 0xB8, 0x4A, 255];

// Artwork in a 100x100 design space (matches icons/icon.svg exactly).
const PLATE_R = 33;
const PIP_R = 5.4;
const CENTER_PIP_R = 6.6;
const PIPS = [[37, 37], [63, 37], [37, 63], [63, 63]];
const TILE_R = 24;

function insideRoundedRect(x, y, r) {
  if (x < 0 || y < 0 || x > 100 || y > 100) return false;
  const cx = x < r ? r : (x > 100 - r ? 100 - r : x);
  const cy = y < r ? r : (y > 100 - r ? 100 - r : y);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

const dist2 = (x, y, cx, cy) => (x - cx) ** 2 + (y - cy) ** 2;

/**
 * @param {number} x design-space x
 * @param {number} y design-space y
 * @param {{maskable:boolean}} opts
 * @returns {number[]|null} RGBA or null for transparent
 */
function sample(x, y, opts) {
  // Background: full bleed for maskable (platform supplies the shape),
  // rounded tile otherwise.
  const onField = opts.maskable
    ? (x >= 0 && y >= 0 && x <= 100 && y <= 100)
    : insideRoundedRect(x, y, TILE_R);
  if (!onField) return null;

  // Maskable keeps the artwork at 80% about the centre so Android's circle
  // crop never clips the plate.
  let ax = x, ay = y;
  if (opts.maskable) {
    ax = (x - 50) / 0.8 + 50;
    ay = (y - 50) / 0.8 + 50;
  }

  if (dist2(ax, ay, 50, 50) <= CENTER_PIP_R ** 2) return GOLD;
  for (const [px, py] of PIPS) {
    if (dist2(ax, ay, px, py) <= PIP_R ** 2) return BRAND;
  }
  if (dist2(ax, ay, 50, 50) <= PLATE_R ** 2) return PAPER;
  return BRAND;
}

function render(size, opts) {
  const SS = 4;                     // supersampling factor per axis
  const buf = Buffer.alloc(size * size * 4);
  const step = 100 / size;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * step;
          const y = (py + (sy + 0.5) / SS) * step;
          const c = sample(x, y, opts);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = SS * SS;
      const alpha = a / n;
      const o = (py * size + px) * 4;
      // Store straight (non-premultiplied) colour; average only over covered
      // samples so edge pixels keep the true hue instead of darkening.
      const covered = a / 255 || 1;
      buf[o]     = Math.round(r / covered);
      buf[o + 1] = Math.round(g / covered);
      buf[o + 2] = Math.round(b / covered);
      buf[o + 3] = Math.round(alpha);
    }
  }
  return buf;
}

/* ---------- PNG encoding ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- ICO packaging (PNG-compressed entries) ---------- */

function buildICO(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);           // reserved
  header.writeUInt16LE(1, 2);           // type: icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const entries = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;      // width  (0 means 256)
    e[1] = size >= 256 ? 0 : size;      // height
    e[2] = 0;                           // palette count
    e[3] = 0;                           // reserved
    e.writeUInt16LE(1, 4);              // colour planes
    e.writeUInt16LE(32, 6);             // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
}

/* ---------- outputs ---------- */

const write = (rel, buf) => {
  const p = path.join(REPO, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  console.log(`${rel.padEnd(34)} ${String(buf.length).padStart(7)} bytes`);
};

const png = (size, opts) => encodePNG(render(size, opts), size);

if (require.main === module) {
  write('icons/icon-192.png',          png(192, { maskable: false }));
  write('icons/icon-512.png',          png(512, { maskable: false }));
  write('icons/icon-maskable-512.png', png(512, { maskable: true }));
  write('icons/apple-touch-icon.png',  png(180, { maskable: true }));

  write('favicon.ico', buildICO([16, 32, 48].map(size => ({
    size,
    data: png(size, { maskable: false })
  }))));
} else {
  module.exports = { render, encodePNG };
}
