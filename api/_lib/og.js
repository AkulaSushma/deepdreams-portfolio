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
const SOFT = [226, 196, 140];

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

/* Draw one glyph with a gold gradient, blended over the background. The
 * optional `glow` radius lays a soft warm halo under the letter first —
 * the seal monogram's own text-shadow. */
function drawGlyph(px, glyph, left, top, targetH, hi, lo, glow) {
  if (!glyph || !glyph.rows || !glyph.rows.length) return;
  const scale = targetH / glyph.h;
  const gw = Math.max(1, Math.round(glyph.w * scale));
  const gh = Math.max(1, Math.round(glyph.h * scale));
  const h = hi || GOLD_HI, l = lo || GOLD_LO;

  for (let y = 0; y < gh; y++) {
    const sy = Math.min(glyph.rows.length - 1, Math.round(y / scale));
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
      const gt = (y / gh) * 0.5;
      const r = h[0] + (l[0] - h[0]) * gt;
      const g = h[1] + (l[1] - h[1]) * gt;
      const b = h[2] + (l[2] - h[2]) * gt;
      if (glow) {
        /* A soft halo under the letter, without a per-pixel disc: the
           glyph is laid at five jittered offsets in the warm glow colour
           at low alpha — the same effect, a fraction of the cost. */
        blendPx(px, pxX, pxY, a * 0.16, SEAL.glowGold);
        blendPx(px, pxX + glow, pxY, a * 0.10, SEAL.glowGold);
        blendPx(px, pxX - glow, pxY, a * 0.10, SEAL.glowGold);
        blendPx(px, pxX, pxY + glow, a * 0.10, SEAL.glowGold);
        blendPx(px, pxX, pxY - glow, a * 0.10, SEAL.glowGold);
      }
      blendPx(px, pxX, pxY, a, [r, g, b]);
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

/* ══ SAMPLE 2's CARD: the seal screen, as the invitation opens ══════════
   The reference is the moment a guest first sees the website: a dark
   ground, a maroon wax-seal circle with the site's exact radial gradient
   and a dashed gold rim, mandala whisper rings, a soft breathing halo,
   the couple's monogram in the seal's elegant serif with a warm glow, and
   the invitation's own words beneath. The monogram letters derive from
   the couple's names in the order the family chose. */

/* The seal's own palette, from styles.css. */
const SEAL = {
  maroonHi: [140, 43, 71],   /* #8C2B47 — the seal's upper sheen  */
  maroon:   [109, 26, 51],   /* #6D1A33 — the seal ground          */
  maroonLo: [74, 15, 34],    /* #4A0F22 — the seal's depth         */
  glowGold: [255, 236, 190], /* the monogram's warm text-shadow    */
  goldDeep: [201, 162, 75],  /* the breathing halo                 */
};

/* Dark cinematic ground with a warm centre — the loader's doors. */
function sealBackground() {
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W * 0.55), dy = (y - H / 2) / (H * 0.62);
      const warm = Math.max(0, 1 - (dx * dx + dy * dy)) * 20;
      const base = 10 + t * 10;
      const o = (y * W + x) * 3;
      px[o] = Math.min(255, Math.round(base + warm * 1.15));
      px[o + 1] = Math.min(255, Math.round(base * 0.55 + warm * 0.45));
      px[o + 2] = Math.min(255, Math.round(base * 0.62 + warm * 0.38));
    }
  }
  return px;
}

function blendPx(px, x, y, alpha, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = Math.round(px[o] * (1 - alpha) + color[0] * alpha);
  px[o + 1] = Math.round(px[o + 1] * (1 - alpha) + color[1] * alpha);
  px[o + 2] = Math.round(px[o + 2] * (1 - alpha) + color[2] * alpha);
}

/* Blend over a small disc — strokes and soft glow. */
function stampDisc(px, x, y, r, alpha, color) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      const a = alpha * (r <= 1 ? 1 : 1 - d / (r + 0.5));
      blendPx(px, x + dx, y + dy, a, color);
    }
  }
}

/* The wax seal: radial gradient, top sheen, lower depth, drop shadow. */
function sealDisc(px, cx, cy, R) {
  /* The gradient is smooth, so a coarse quarter-grid is precomputed once
     and bilinear-sampled per pixel — an order of magnitude faster than a
     per-pixel sqrt-and-branch loop, indistinguishable to the eye. */
  const G = 48;
  const q = new Float32Array((G + 1) * (G + 1));
  for (let gy = 0; gy <= G; gy++) {
    for (let gx = 0; gx <= G; gx++) {
      const yUp = (gy / G) * R;         /* +y = up */
      const xR = (gx / G) * R;
      const lx = (xR + R * 0.32) / R, ly = (yUp + R * 0.40) / R;
      q[gy * (G + 1) + gx] = Math.min(1, Math.sqrt(lx * lx + ly * ly) / 1.35);
    }
  }
  const grad = (ld) => {
    if (ld < 0.45) {
      const m = ld / 0.45;
      return [
        SEAL.maroonHi[0] + (SEAL.maroon[0] - SEAL.maroonHi[0]) * m,
        SEAL.maroonHi[1] + (SEAL.maroon[1] - SEAL.maroonHi[1]) * m,
        SEAL.maroonHi[2] + (SEAL.maroon[2] - SEAL.maroonHi[2]) * m,
      ];
    }
    const m = (ld - 0.45) / 0.55;
    return [
      SEAL.maroon[0] + (SEAL.maroonLo[0] - SEAL.maroon[0]) * m,
      SEAL.maroon[1] + (SEAL.maroonLo[1] - SEAL.maroon[1]) * m,
      SEAL.maroon[2] + (SEAL.maroonLo[2] - SEAL.maroon[2]) * m,
    ];
  };
  for (let y = -R - 26; y <= R + 26; y++) {
    const pxY = cy + y;
    if (pxY < 0 || pxY >= H) continue;
    const xMax = Math.floor(Math.sqrt(Math.max(0, (R + 26) * (R + 26) - y * y)));
    const sheenRow = Math.max(0, (R * 0.35 - y) / R);       /* screen y grows down */
    const depthRow = Math.max(0, (y - R * 0.55) / R);
    for (let x = -xMax; x <= xMax; x++) {
      const pxX = cx + x;
      if (pxX < 0 || pxX >= W) continue;
      const d = Math.sqrt(x * x + y * y);
      const o = (pxY * W + pxX) * 3;
      if (d <= R) {
        /* bilinear sample of the quarter grid (mirrored to +x, y-up) */
        const gx = Math.min(G, Math.max(0, (Math.abs(x) / R) * G));
        const gy = Math.min(G, Math.max(0, ((-y) / R) * G));
        const x0 = gx | 0, y0 = gy | 0;
        const fx = gx - x0, fy = gy - y0;
        const x1 = Math.min(G, x0 + 1), y1 = Math.min(G, y0 + 1);
        const ld =
          q[y0 * (G + 1) + x0] * (1 - fx) * (1 - fy) +
          q[y0 * (G + 1) + x1] * fx * (1 - fy) +
          q[y1 * (G + 1) + x0] * (1 - fx) * fy +
          q[y1 * (G + 1) + x1] * fx * fy;
        const c = grad(ld);
        let r = c[0], g = c[1], b = c[2];
        const sheen = sheenRow * (1 - d / R) * 16;
        r += sheen; g += sheen * 0.75; b += sheen * 0.52;
        const depth = depthRow * (1 - d / R) * 22;
        r -= depth * 0.7; g -= depth * 0.8; b -= depth * 0.8;
        px[o] = Math.max(0, Math.round(r));
        px[o + 1] = Math.max(0, Math.round(g));
        px[o + 2] = Math.max(0, Math.round(b));
      } else {
        const a = Math.max(0, 1 - (d - R) / 26) * 0.5;
        px[o] = Math.round(px[o] * (1 - a));
        px[o + 1] = Math.round(px[o + 1] * (1 - a) + 6 * a);
        px[o + 2] = Math.round(px[o + 2] * (1 - a) + 14 * a);
      }
    }
  }
}

/* A ring — solid, or dashed with an [on, off] pattern. */
function ring(px, cx, cy, r, width, alpha, color, dash) {
  const twoPi = Math.PI * 2;
  const step = 1 / (r * 2);
  if (!dash) {
    for (let a = 0; a < twoPi; a += step) {
      stampDisc(px, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), width, alpha, color);
    }
    return;
  }
  const period = dash[0] + dash[1];
  const SEG = 48;
  const segArc = twoPi / SEG;
  for (let seg = 0; seg < SEG; seg++) {
    const start = seg * segArc;
    const len = (dash[0] / period) * segArc;
    for (let a = start; a < start + len; a += step) {
      stampDisc(px, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), width, alpha, color);
    }
  }
}

/* The breathing halo of the seal-pulse keyframe, at its brightest. */
function halo(px, cx, cy, r, color, alpha) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r) continue;
      blendPx(px, cx + x, cy + y, alpha * (1 - d / r), color);
    }
  }
}

/** Compose Sample 2's share card: the "tap the seal to open" screen.
 *  `first`/`second` are the couple's names in the family's chosen order;
 *  their initials form the monogram inside the seal. */
function shareCard(first, second) {
  const px = sealBackground();

  const cx = W / 2;
  const cy = H / 2 - 22;
  const R = 200;

  /* Mandala whisper: the two faint rings of the spinning mandala. */
  ring(px, cx, cy, R + 66, 1.5, 0.18, GOLD_HI);
  ring(px, cx, cy, R + 52, 1, 0.13, GOLD_HI, [2, 3]);

  /* Breathing halo. */
  halo(px, cx, cy, R + 38, SEAL.goldDeep, 0.15);

  /* The wax seal, dashed gold rim, monogram, words. */
  sealDisc(px, cx, cy, R);
  ring(px, cx, cy, Math.round(R * 0.86), 2, 0.55, RULE_GOLD, [2, 3]);

  const a = initialOf(first);
  const b = initialOf(second);
  const mono = b ? `${a} · ${b}` : a;
  if (mono) {
    let capH = 116;
    const budget = R * 1.58;
    while (textWidth(mono, capH) > budget && capH > 40) capH -= 4;
    drawText(px, mono, cx, Math.round(cy - capH * 0.52), capH, GOLD_HI, GOLD_LO, 22);
  }

  drawText(px, "TAP THE SEAL TO OPEN", cx, cy + R + 52, 28, GOLD_HI, GOLD_LO, 10);

  return encodePng(px, W, H);
}

/* ── Full-text helpers (Sample 1's names card) ────────────────────────────
   Sample 2's approved card shows the two initials; Sample 1's template has
   no monogram motif, and its couples upload photographs rather than artwork
   — so its card says the names in full: "ANANYA & ROHIT", the date, the
   venue, on the same maroon-and-gold language. */

function textWidth(text, capH) {
  let w = 0;
  for (const ch of String(text)) {
    const g = FONT[ch];
    if (!g) { w += capH * 0.26; continue; }
    w += (g.w / g.h) * capH + capH * 0.12;
  }
  return Math.max(0, w - capH * 0.12);
}

function drawText(px, text, cx, top, capH, hi, lo, glow) {
  const total = textWidth(text, capH);
  let x = Math.round(cx - total / 2);
  for (const ch of String(text)) {
    const g = FONT[ch];
    if (!g) { x += Math.round(capH * 0.26); continue; }
    drawGlyph(px, g, x, top, capH, hi, lo, glow);
    x += Math.round((g.w / g.h) * capH) + Math.round(capH * 0.12);
  }
  return total;
}

const cleanText = (s) => String(s || "").replace(/[^\p{L}\p{N}&·—,.'\- ]/gu, "").trim().slice(0, 60);

/** Sample 1's share card: the couple's full names, date and venue in text. */
function namesCard(first, second, opts) {
  const o = opts || {};
  const px = background();

  drawText(px, "WEDDING INVITATION", W / 2, 92, 30, SOFT, SOFT);

  const a = cleanText(first).toUpperCase();
  const b = cleanText(second).toUpperCase();
  const line = (a && b) ? a + " & " + b : (a || b || "");
  if (!line) return encodePng(px, W, H);

  let capH = 112;
  const budget = W - 220;
  while (textWidth(line, capH) > budget && capH > 40) capH -= 4;
  drawText(px, line, W / 2, Math.round(H / 2 - 190), capH);

  const ruleY = Math.round(H / 2 - 190 + capH * 1.85);
  drawRule(px, W / 2, ruleY, 430);

  const date = cleanText(o.date).toUpperCase();
  if (date) drawText(px, date, W / 2, ruleY + 54, 40, SOFT, SOFT);
  const venue = cleanText(o.venue).toUpperCase();
  if (venue) drawText(px, venue, W / 2, ruleY + 124, 34, SOFT, SOFT);

  drawDiamond(px, W / 2, H - 118, 8);
  drawText(px, "DEEPDREAMS AI STUDIO", W / 2, H - 96, 24, SOFT, SOFT);

  return encodePng(px, W, H);
}

module.exports = { shareCard, namesCard, W, H };
