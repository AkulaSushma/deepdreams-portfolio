/* ============================================================================
   OG — the share-card image a couple's link shows in WhatsApp.

   The templates ship one static preview screenshot, painted with the demo
   couple's initials. Any couple who shares their link without uploading a
   photograph therefore had the demo couple's initials in their WhatsApp
   card — the exact opposite of what a paying customer expects to see.

   This module composes that card per couple, on the server: a deep-maroon
   gradient, a gold divider, and the couple's two initials drawn in a gold
   serif, in the order the family chose (bride-first or groom-first). The
   letterforms are pre-rendered run-length masks embedded in og-font.js —
   no font files, no canvas, no native imaging dependency on the edge.

   The output is a PNG, written byte-by-byte with zlib: filters 0 for every
   scanline, a single IDAT, no interlacing. 1200x630 is the size WhatsApp,
   Telegram and Google render large.
   ========================================================================= */
"use strict";

const zlib = require("zlib");
const FONT = require("./og-font");

const W = 1200;
const H = 630;

/* The palette of the invitation: deep maroon into near-black, with a gold
   rule and gold lettering. These are the template's own colours, so the card
   reads as part of the same design, not as a foreign screenshot. */
const BG_TOP = [26, 10, 18];
const BG_BOT = [12, 6, 10];
const GOLD_HI = [244, 214, 146];
const GOLD_LO = [196, 150, 66];
const RULE_GOLD = [212, 175, 106];

/* ── PNG encoder ──────────────────────────────────────────────────────────
   The smallest correct PNG: 8-byte signature, IHDR, one IDAT with every
   scanline prefixed by filter byte 0, IEND. CRC32 is implemented here
   because the Workers runtime has zlib but not a CRC helper. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(rgba, width, height) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) {
      raw[y * (stride + 1) + 1 + x] = rgba[(y * width + (x / 3 | 0)) * 3 + (x % 3)];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Background: vertical maroon gradient with a soft radial glow ───────── */
function background() {
  const px = Buffer.alloc(W * H * 3);
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const base = [
      BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t,
      BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t,
      BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t,
    ];
    for (let x = 0; x < W; x++) {
      /* A faint warm halo behind the monogram, as on the invitation card. */
      const dx = (x - cx) / (W * 0.6), dy = (y - cy) / (H * 0.9);
      const r2 = dx * dx + dy * dy;
      const glow = Math.max(0, 1 - r2) * 14;
      const o = (y * W + x) * 3;
      px[o] = Math.min(255, base[0] + glow);
      px[o + 1] = Math.min(255, base[1] + glow * 0.72);
      px[o + 2] = Math.min(255, base[2] + glow * 0.5);
    }
  }
  return px;
}

/* Draw one glyph mask (from og-font.js, RLE rows of 4-bit alpha) with a
 * vertical gold gradient, blended over the background. */
function drawGlyph(px, glyph, left, top, targetH) {
  if (!glyph || !glyph.rows || !glyph.rows.length) return;
  const scale = targetH / glyph.h;
  const gw = Math.max(1, Math.round(glyph.w * scale));
  const gh = Math.max(1, Math.round(glyph.h * scale));

  for (let y = 0; y < gh; y++) {
    const sy = Math.min(glyph.rows.length - 1, Math.round(y / scale));
    /* Expand the row's RLE into alpha values across the target width. */
    const alphas = new Float32Array(gw);
    let gx = 0;
    for (const [level, run] of glyph.rows[sy]) {
      const a = (level / 15) * 255;
      const spanW = Math.max(1, Math.round(run * scale));
      for (let i = 0; i < spanW && gx + i < gw; i++) alphas[gx + i] = a;
      gx += spanW;
      if (gx >= gw) break;
    }
    for (let x = 0; x < gw; x++) {
      const a = alphas[x] / 255;
      if (a <= 0.01) continue;
      const pxX = left + x, pxY = top + y;
      if (pxX < 0 || pxX >= W || pxY < 0 || pxY >= H) continue;
      /* Gradient gold: brighter at the glyph's top, deeper at its bottom. */
      const gt = (y / gh) * 0.55 + (x / gw) * 0.15;
      const r = GOLD_HI[0] + (GOLD_LO[0] - GOLD_HI[0]) * gt;
      const g = GOLD_HI[1] + (GOLD_LO[1] - GOLD_HI[1]) * gt;
      const b = GOLD_HI[2] + (GOLD_LO[2] - GOLD_HI[2]) * gt;
      const o = (pxY * W + pxX) * 3;
      px[o] = Math.round(px[o] * (1 - a) + r * a);
      px[o + 1] = Math.round(px[o + 1] * (1 - a) + g * a);
      px[o + 2] = Math.round(px[o + 2] * (1 - a) + b * a);
    }
  }
}

/* A short horizontal gold rule, drawn as a rounded gradient bar. */
function drawRule(px, cx, y, width) {
  const half = width / 2;
  for (let x = cx - half; x < cx + half; x++) {
    const t = (x - (cx - half)) / width;
    /* Fade in from the ends so it reads as a delicate rule, not a block. */
    const fade = Math.min(1, Math.min(t, 1 - t) * 8);
    for (let dy = -2; dy <= 2; dy++) {
      const py = y + dy;
      if (py < 0 || py >= H) continue;
      const a = (dy === 0 ? 0.95 : 0.45) * fade;
      const o = (py * W + Math.round(x)) * 3;
      px[o] = Math.round(px[o] * (1 - a) + RULE_GOLD[0] * a);
      px[o + 1] = Math.round(px[o + 1] * (1 - a) + RULE_GOLD[1] * a);
      px[o + 2] = Math.round(px[o + 2] * (1 - a) + RULE_GOLD[2] * a);
    }
  }
}

/* Small gold diamond accents flanking the monogram. */
function drawDiamond(px, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (Math.abs(x) + Math.abs(y) > r) continue;
      const a = 0.9 * (1 - (Math.abs(x) + Math.abs(y)) / (r + 1));
      const pxX = cx + x, pxY = cy + y;
      if (pxX < 0 || pxX >= W || pxY < 0 || pxY >= H) continue;
      const o = (pxY * W + pxX) * 3;
      px[o] = Math.round(px[o] * (1 - a) + RULE_GOLD[0] * a);
      px[o + 1] = Math.round(px[o + 1] * (1 - a) + RULE_GOLD[1] * a);
      px[o + 2] = Math.round(px[o + 2] * (1 - a) + RULE_GOLD[2] * a);
    }
  }
}

/* The separator between the two initials: a small gold diamond, matching the
 * wax-seal monogram on the invitation itself. */
const initialOf = (name) => {
  const s = String(name || "").trim();
  return s ? s[0].toUpperCase() : "";
};

/** Compose the full share card. `first`/`second` are the couple's short
 *  names in the order chosen by the family; only their initials are shown.
 *  Returns a PNG Buffer. */
function shareCard(first, second) {
  const a = initialOf(first);
  const b = initialOf(second);
  const px = background();

  const GLYPH_H = 300;
  const ga = FONT[a], gb = b && a !== b ? FONT[b] : null;

  const gap = 150; /* space reserved for the diamond between the letters */
  const wa = ga ? (ga.w / ga.h) * GLYPH_H : 0;
  const wb = gb ? (gb.w / gb.h) * GLYPH_H : 0;
  const total = wa + wb + (gb ? gap : 0);
  let left = Math.round((W - total) / 2);
  const top = Math.round(H / 2 - GLYPH_H * 0.62);

  if (ga) { drawGlyph(px, ga, left, top, GLYPH_H); left += Math.round(wa); }
  if (gb) {
    drawDiamond(px, left + gap / 2, H / 2 - 10, 16);
    left += gap;
    drawGlyph(px, gb, left, top, GLYPH_H);
  } else if (a) {
    /* A single name: one initial, centred, with flanking rules. */
    drawRule(px, W / 2, H - 130, 300);
  }

  if (gb) drawRule(px, W / 2, H - 130, 380);

  return encodePng(px, W, H);
}

module.exports = { shareCard, W, H };
