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

/* ══ SAMPLE 2's CARD: the real loader screen, per couple ═══════════════
   The base is a genuine capture of the invitation's opening moment — dark
   doors, the maroon wax seal, the dashed rim, the mandala rings, the
   breathing halo, "TAP THE SEAL TO OPEN" — with the demo monogram lifted
   out. shareCard paints the couple's own two initials into the seal, at
   the exact position and in the exact style the site renders them, in the
   family's chosen order. The WhatsApp card is therefore the website's
   actual first screen for THAT couple, not a drawing of one. */
const { baseImage } = require("./og-base");

/* The seal's own palette, from styles.css (used by the monogram glow). */
const SEAL = {
  gold:     [229, 200, 120], /* #E5C878 — gold-soft lettering   */
  glowGold: [255, 236, 190], /* the monogram's warm text-shadow   */
  goldDeep: [201, 162, 75],  /* the breathing halo                */
};

/* Where the site's own seal sits on the 1200x630 capture. */
const SEAL_GEOM = { cx: 600, cy: 313, R: 204 };

function blendPx(px, x, y, alpha, color) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = Math.round(px[o] * (1 - alpha) + color[0] * alpha);
  px[o + 1] = Math.round(px[o + 1] * (1 - alpha) + color[1] * alpha);
  px[o + 2] = Math.round(px[o + 2] * (1 - alpha) + color[2] * alpha);
}

/* Soft warm halo under a letter — the seal monogram's text-shadow. */
function glowAt(px, x, y, radius, alpha) {
  for (let dy = -radius; dy <= radius; dy += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) continue;
      blendPx(px, x + dx, y + dy, alpha * (1 - d / radius), SEAL.glowGold);
    }
  }
}

/** Compose Sample 2's share card on the real loader capture. */
function shareCard(first, second) {
  const base = baseImage();                     /* {rgb, w, h} — real screen */
  const px = Buffer.from(base.rgb);             /* writable copy */

  const a = initialOf(first);
  const b = initialOf(second);
  const mono = b ? `${a} · ${b}` : a;

  /* The monogram: elegant serif capitals with the site's warm glow, centred
     where the seal's own text sits. Sized to the real button's proportions. */
  if (mono) {
    let capH = 96;                               /* ~32px at 408px seal ≈ same ratio */
    const budget = SEAL_GEOM.R * 1.35;
    while (textWidth(mono, capH) > budget && capH > 36) capH -= 3;
    const top = Math.round(SEAL_GEOM.cy - capH * 0.56);
    const cx = SEAL_GEOM.cx;

    const total = textWidth(mono, capH);
    let x = Math.round(cx - total / 2);
    for (const ch of mono) {
      const g = FONT[ch];
      if (!g) { x += Math.round(capH * 0.3); continue; }
      drawGlyphOn(px, g, x, top, capH, SEAL.gold, SEAL.gold, 14);
      x += Math.round((g.w / g.h) * capH) + Math.round(capH * 0.12);
    }
  }

  return encodePng(px, W, H);
}

/* Glyph pass over an arbitrary RGB buffer, with the glow underlay. */
function drawGlyphOn(px, glyph, left, top, targetH, hi, lo, glow) {
  if (!glyph || !glyph.rows || !glyph.rows.length) return;
  const scale = targetH / glyph.h;
  const gw = Math.max(1, Math.round(glyph.w * scale));
  const gh = Math.max(1, Math.round(glyph.h * scale));
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
      if (glow) blendPx(px, pxX, pxY, a * 0.30, SEAL.glowGold);
      const gt = (y / gh) * 0.5;
      const r = hi[0] + (lo[0] - hi[0]) * gt;
      const g = hi[1] + (lo[1] - hi[1]) * gt;
      const bb = hi[2] + (lo[2] - hi[2]) * gt;
      blendPx(px, pxX, pxY, a, [r, g, bb]);
    }
  }
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

/* ══ SAMPLE 1's CARD: the actual first page, per couple ═══════════════════
   Sample 1's first page is its welcome poster: the couple standing on the
   left, and the parchment on the right carrying the names, both families
   and the date. og-base-welcome is a capture of that poster with its text
   lifted out; welcomeCard paints the couple's own wording back into the
   same parchment, in the same layout the site itself renders (ov-welcome
   in style.css). The WhatsApp card IS the website's first page for THAT
   couple — the brief's exact words — with the names visible on it.

   The parchment's own inks: a deep maroon for the names and a warm brown
   for the family lines, straight from the overlay's palette. */
const { baseImage: welcomeBase } = require("./og-base-welcome");

const PARCH = {
  name:  [125, 29, 29],   /* #7D1D1D — ov-bride/ov-groom maroon        */
  small: [74, 40, 16],    /* #4A2810 — ov-*-parents brown             */
  ink:   [58, 16, 16],    /* #3A1010 — ov-time/date/venue             */
  soft:  [92, 58, 26],   /* #5C3A1A — script-tone lines              */
};

/* Where the parchment sits on the base capture, in base pixels. Measured
   from the artwork, not the CSS: the quiet zone runs x 400–760, y 108–362
   (with a wider floor band to y 410 between x 480–680 where the bottom
   ornament recedes). All drawing happens inside this window. */
const PARCH_GEOM = { x0: 400, x1: 760, cx: 580, y0: 108, y1: 362 };

/* Draw one line of text centred in the parchment, shrinking to fit the
   window. `h` is the cap height in base pixels. Returns the height used. */
function parchLine(px, text, top, h, color, opts) {
  const o = opts || {};
  let size = h;
  const maxW = o.maxW || (PARCH_GEOM.x1 - PARCH_GEOM.x0 - 8);
  while (size > 7 && textWidth(String(text), size) > maxW) size -= 1;
  if (size <= 7) return 0;
  drawTextOn(px, String(text), o.cx || PARCH_GEOM.cx, top, size, color, color);
  return size;
}

/* drawText/drawGlyph draw against the fixed W×H card. The welcome base is
   a different buffer, so this variant takes the target dimensions from the
   image it is painting (the pattern shareCard already uses for the seal). */
function drawTextOn(px, text, cx, top, capH, hi, lo, imgW, imgH) {
  const W2 = imgW || require("./og-base-welcome").baseImage().w;
  const H2 = imgH || require("./og-base-welcome").baseImage().h;
  const total = textWidth(text, capH);
  let x = Math.round(cx - total / 2);
  for (const ch of String(text)) {
    const g = FONT[ch];
    if (!g) { x += Math.round(capH * 0.26); continue; }
    drawGlyphBuf(px, g, x, top, capH, hi, lo, W2, H2);
    x += Math.round((g.w / g.h) * capH) + Math.round(capH * 0.12);
  }
  return total;
}

/* drawGlyph with explicit buffer bounds — same letterforms, same gold
   gradient math, any target size. */
function drawGlyphBuf(px, glyph, left, top, targetH, hi, lo, imgW, imgH) {
  if (!glyph || !glyph.rows || !glyph.rows.length) return;
  const scale = targetH / glyph.h;
  const gw = Math.max(1, Math.round(glyph.w * scale));
  const gh = Math.max(1, Math.round(glyph.h * scale));
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
      if (pxX < 0 || pxX >= imgW || pxY < 0 || pxY >= imgH) continue;
      const gt = (y / gh) * 0.5;
      const r = hi[0] + (lo[0] - hi[0]) * gt;
      const g = hi[1] + (lo[1] - hi[1]) * gt;
      const bb = hi[2] + (lo[2] - hi[2]) * gt;
      blendOn(px, pxX, pxY, a, [r, g, bb], imgW);
    }
  }
}

function blendOn(px, x, y, alpha, color, imgW) {
  const o = (y * imgW + x) * 3;
  px[o] = Math.round(px[o] * (1 - alpha) + color[0] * alpha);
  px[o + 1] = Math.round(px[o + 1] * (1 - alpha) + color[1] * alpha);
  px[o + 2] = Math.round(px[o + 2] * (1 - alpha) + color[2] * alpha);
}

/** Compose Sample 1's share card on the real welcome-poster capture. */
function welcomeCard(first, second, opts) {
  const o = opts || {};
  const base = welcomeBase();                /* {rgb, w, h} — real poster */
  const px = Buffer.from(base.rgb);          /* writable copy */
  const { w, h } = base;

  const a = cleanText(first).toUpperCase();
  const b = cleanText(second).toUpperCase();
  if (!a && !b) return encodePng(px, w, h);

  /* The parchment's vertical rhythm, mapped from the site's own ov-welcome
     zones into the measured quiet window (parchment y 108–362; the ornament
     frame starts ~y 375). Lines are measured first, then flowed downward, and
     the whole stack is lifted uniformly if it ran past the quiet floor — so
     no couple's wording ever lands on the artwork's ornate border. Family
     lines sit directly beneath each name, exactly as the overlay stacks
     them. */
  const fa = cleanText(o.firstParents).toUpperCase();
  const fb = cleanText(o.secondParents).toUpperCase();
  const firstLabel = fa ? (o.firstLabel || "DAUGHTER OF") : "";
  const secondLabel = fb ? (o.secondLabel || "SON OF") : "";

  const date = cleanText(o.date).toUpperCase();
  const time = cleanText(o.time).toUpperCase();
  const venue = cleanText(o.venue).toUpperCase();

  /* Pass 1 — measure every line at its natural size, auto-shrunk to fit
     the window's width (a size of 0 means it did not fit and is dropped). */
  const fit = (h, text, maxW) => {
    let size = h;
    const w0 = maxW || (PARCH_GEOM.x1 - PARCH_GEOM.x0 - 8);
    while (size > 7 && textWidth(text, size) > w0) size -= 1;
    return size > 7 ? size : 0;
  };
  const firstLabelLine = fa ? `${firstLabel} ${fa}` : "";
  const secondLabelLine = fb ? `${secondLabel} ${fb}` : "";
  const timeLine = time ? `TIME: ${time}` : "";
  const venueLine = venue ? `VENUE: ${venue}` : "";

  const stack = [
    { size: fit(13, "TOGETHER WITH"), color: PARCH.soft, text: "TOGETHER WITH" },
    { size: fit(22, "LOVE & FAMILIES,"), color: PARCH.name, text: "LOVE & FAMILIES," },
    { size: fit(11, "REQUEST THE HONOR OF YOUR PRESENCE", 340), color: PARCH.soft, text: "REQUEST THE HONOR OF YOUR PRESENCE", maxW: 340 },
    { size: fit(44, a), color: PARCH.name, text: a },
    { size: fa ? fit(11, firstLabelLine) : 0, color: PARCH.small, text: firstLabelLine },
    { size: fit(20, "&"), color: PARCH.name, text: "&" },
    { size: fit(44, b), color: PARCH.name, text: b },
    { size: fb ? fit(11, secondLabelLine) : 0, color: PARCH.small, text: secondLabelLine },
    { size: date ? fit(13, date) : 0, color: PARCH.ink, text: date },
    { size: time ? fit(13, timeLine, 300) : 0, color: PARCH.ink, text: timeLine, maxW: 300 },
    { size: venue ? fit(13, venueLine, 350) : 0, color: PARCH.ink, text: venueLine, maxW: 350 },
  ].filter((L) => L.size > 0 && L.text);

  /* Pass 2 — flow the stack down from the eyebrow's fixed top, using the
     leading the site's own overlay keeps between zones. */
  const LEAD = 8;
  let y = 118;
  const placed = [];
  for (const L of stack) {
    y += placed.length ? LEAD : 0;
    placed.push({ ...L, top: y });
    y += L.size;
  }

  /* Pass 3 — lift the stack if it ran past the quiet floor. The eyebrow
     keeps a little headroom above it; nothing goes below the floor. */
  const FLOOR = 356;
  if (y > FLOOR && placed.length) {
    const lift = y - FLOOR;
    for (const L of placed) L.top = Math.max(108, L.top - lift);
  }

  for (const L of placed) parchLine(px, L.text, L.top, L.size, L.color, { maxW: L.maxW });

  return encodePng(px, w, h);
}

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

module.exports = { shareCard, namesCard, welcomeCard, W, H };
