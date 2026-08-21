/* ============================================================================
   PUBLIC-VIEW — the one place a database row becomes something the world sees.

   It is built as an allow-list, and that direction matters. A deny-list asks
   every future developer to remember to exclude the new private column; an
   allow-list asks them to remember to include the new public one. The first
   kind of forgetting leaks a customer's phone number to two hundred wedding
   guests. The second kind shows a missing venue name, which somebody notices
   within a minute.

   So: private_notes, ids, token data and internal timestamps are not excluded
   here. They are simply never named, and therefore cannot appear.

   There is one allow-list per template, and each mirrors that template's own
   configuration object — `DATA` in Sample 1, `WEDDING_CONFIG` in Sample 2.
   A published invitation is therefore a *validated partial override* of the
   design the customer already previewed, which is the same shape the free
   `?c=` / `?d=` links used to carry. Nothing has to be translated on the way
   in or on the way out, so no field can quietly get lost in a mapping.

   Every leaf is validated by type, not merely copied:

     · text   clamped, so one enormous field cannot bloat every public read
     · colour must look like a hex colour — these become CSS custom properties,
              and an unchecked value there is a stylesheet injection
     · url    https only — Sample 2 puts the RSVP link in an iframe src
     · media  only "@m<n>" markers or the template's own bundled asset paths.
              Never a data: URL, never an arbitrary absolute URL, so a customer
              cannot make their guests' browsers fetch from a third-party host.
   ========================================================================= */
"use strict";

const storage = require("./storage");
const LIMITS = require("../../shared/limits.js");

const MAX_STRING = 2000;
const MAX_ARRAY = 12;

/* ── Leaf validators ────────────────────────────────────────────────────── */

/** Any text a customer typed. Clamped, never escaped here — escaping belongs
 *  at the point of insertion, and this value is also delivered as JSON. */
function text(v) {
  if (v == null || v === "") return undefined;
  if (typeof v === "object") return undefined;
  const s = String(v);
  return s.length > MAX_STRING ? s.slice(0, MAX_STRING) : s;
}

function bool(v) {
  if (v === undefined || v === null) return undefined;
  return !!v;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** A colour, because these land in CSS custom properties. "#c9a24b", or
 *  nothing at all — an unvalidated string here could close the declaration and
 *  open a new one. */
function colour(v) {
  const s = text(v);
  if (!s) return undefined;
  return /^#[0-9a-f]{3,8}$/i.test(s.trim()) ? s.trim() : undefined;
}

/** An https URL. Sample 2 loads the RSVP form in an iframe, so http would be
 *  a mixed-content failure and javascript:/data: would be an injection. */
function url(v) {
  const s = text(v);
  if (!s) return undefined;
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** A reference to an image. Two forms only:
 *
 *    "@m3"           one of this site's own uploaded photographs, by index
 *    "posters/x.jpg" a file that ships with the template
 *
 *  The marker is left as a marker on purpose. The browser resolves it against
 *  `media`, picking the 640 w file on a phone and the 1280 w file on a laptop —
 *  which is the difference between 720 KB and 1.8 MB per guest, and therefore
 *  the difference between seventy invitations a month on the free tier and
 *  twenty-eight. */
const ASSET_PATH = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/i;

function mediaRef(v, ctx) {
  const s = text(v);
  if (!s) return undefined;

  const marker = /^@m(\d{1,2})$/.exec(s);
  if (marker) {
    const i = Number(marker[1]);
    return i < ctx.mediaCount ? `@m${i}` : undefined;
  }

  /* A bundled asset. Relative, no scheme, no climbing out of the folder. */
  if (ASSET_PATH.test(s) && !s.includes("..")) return s;

  return undefined;
}

/* ── The shapes ─────────────────────────────────────────────────────────── */

/* Sample 1 — "wedding-invite sample 1". Mirrors DEFAULTS in its app.js.
   `phone` is the couple's own RSVP number, which they put on the invitation
   deliberately. The studio's record of *their* contact details and payment
   reference lives in wedding_sites.private_notes, which is not named anywhere
   in this file and therefore cannot be served. */
const SAMPLE1 = {
  bride: text, groom: text,
  brideParents: text, groomParents: text,
  brideCity: text, groomCity: text,
  date: text, time: text,
  venueName: text, venueAddr: text,
  mapUrl: text,              // a full Maps link OR a typed place name
  phone: text,               // the couple's RSVP number — see note above
  story: text,
  side: text,                // "bride" | "groom"
  cover: mediaRef,
  welcomeImg: mediaRef,
  photos: [mediaRef],
  events: [{
    name: text, when: text, where: text,
    note: text, mode: text, dress: text,
    img: mediaRef,
  }],
};

/* Sample 2 — "3D Wedding Invitation Sample 2". Mirrors WEDDING_CONFIG.
   Deliberately absent: frames, sanctum and films. Those describe where the
   template's own 60 MB of assets live; letting a published row override them
   would let a customer point the page at any host they liked. */
const SAMPLE2 = {
  couple: {
    groom: text, bride: text,
    groomFull: text, brideFull: text,
    monogram: text, tagline: text, hashtag: text,
    side: text,              // "bride" | "groom"
  },
  wedding: {
    dateISO: text, dateDisplay: text, dateShort: text, muhurat: text,
  },
  events: [{
    id: text, name: text, icon: text,
    date: text, time: text, venue: text, line: text,
    accent: colour,
  }],
  /* The editor lets a couple paste their own film links, so publishing has to
     carry them or they vanish without a word. `url` only admits absolute https,
     which is the point: the template's own films are relative paths, so leaving
     the defaults alone drops the field here and the invitation renders its own
     films — while a real https link the couple pasted survives. */
  films: [{ id: text, eyebrow: text, line: text, src: url, poster: url }],
  venue: { name: text, address: text, mapsQuery: text, city: text },
  rsvp: { formUrl: url, deadline: text },
  scratch: { heading: text, message: text },
  theme: {
    maroon: colour, maroonDeep: colour, gold: colour,
    goldSoft: colour, ivory: colour, inkOnIvory: colour,
  },
};

const SHAPES = { sample1: SAMPLE1, sample2: SAMPLE2 };

/* ── The walker ─────────────────────────────────────────────────────────── */

function walk(value, spec, ctx) {
  if (typeof spec === "function") return spec(value, ctx);

  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) return undefined;
    const item = spec[0];
    /* Holes are preserved as null, not dropped: Sample 1's gallery slots are
       addressed by index, so removing an empty one would shuffle every
       photograph after it into the wrong frame. */
    return value.slice(0, MAX_ARRAY).map((v) => {
      const out = walk(v, item, ctx);
      return out === undefined ? null : out;
    });
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const out = {};
  for (const key of Object.keys(spec)) {
    const got = walk(value[key], spec[key], ctx);
    if (got !== undefined) out[key] = got;
  }
  return Object.keys(out).length ? out : undefined;
}

/* ── Media ──────────────────────────────────────────────────────────────── */

/** Stored media references become something a browser can render, with the
 *  responsive sources already resolved. The stored row holds paths, never bytes
 *  and never URLs — so changing storage provider changes nothing here except
 *  what publicUrl() returns. */
function publicMedia(media) {
  if (!Array.isArray(media)) return [];

  return media.slice(0, LIMITS.MAX_PHOTOS).map((m) => {
    const sizes = {};
    if (m && m.sizes && typeof m.sizes === "object") {
      for (const w of LIMITS.IMAGE_WIDTHS) {
        if (m.sizes[w]) sizes[w] = storage.publicUrl(m.sizes[w]);
      }
    }
    const widest = LIMITS.IMAGE_WIDTHS[LIMITS.IMAGE_WIDTHS.length - 1];
    const src = sizes[widest] || (m && m.path ? storage.publicUrl(m.path) : null);

    return {
      role: (m && text(m.role)) || "gallery",
      caption: m && m.caption ? text(m.caption) : undefined,
      src,
      sizes: Object.keys(sizes).length ? sizes : undefined,
      /* Width and height travel with every photograph so the browser can
         reserve the space before the file arrives. Without them the whole
         invitation jumps about as images load — the single most common way a
         beautiful page feels cheap on a slow connection. */
      w: num(m && m.w),
      h: num(m && m.h),
      srcset: Object.keys(sizes).length
        ? Object.entries(sizes).map(([w, u]) => `${u} ${w}w`).join(", ")
        : undefined,
    };
  }).filter((m) => m.src);
}

/* ── The public shape ───────────────────────────────────────────────────── */

/** The complete public shape of a published invitation. This is what gets
 *  inlined into the page and what any public endpoint may return — nothing
 *  else, ever. */
function toPublic(row, origin) {
  if (!row) return null;

  const media = publicMedia(row.media);
  const spec = SHAPES[row.template];

  /* An unknown template gets no content at all rather than unvalidated
     content. The template would not render it anyway, and a shape nobody has
     reviewed is exactly the thing this file exists to prevent. */
  const content = spec ? walk(row.content || {}, spec, { mediaCount: media.length }) || {} : {};

  return {
    slug: row.slug,
    template: row.template,
    url: `${origin}/invite/${row.slug}`,
    content,
    media,
    weddingDate: row.wedding_date || undefined,
    /* Used only as a cache-busting suffix on the client. Deliberately a date,
       not a row version or an internal counter. */
    updated: row.updated_at ? String(row.updated_at).slice(0, 10) : undefined,
  };
}

/* ── Derived, for the page head ─────────────────────────────────────────── */

/** Names for the page title and the WhatsApp preview card. Each template keeps
 *  them somewhere different, so this is the one place that knows both. */
function coupleLine(view) {
  const c = (view && view.content) || {};

  if (view && view.template === "sample2") {
    const cp = c.couple || {};
    const isGroom = (cp.side === "groom");
    if (cp.bride && cp.groom) {
      return isGroom ? `${cp.groom} & ${cp.bride}` : `${cp.bride} & ${cp.groom}`;
    }
    return cp.bride || cp.groom || "Our Wedding";
  }

  const isGroom = (c.side === "groom");
  if (c.bride && c.groom) {
    return isGroom ? `${c.groom} & ${c.bride}` : `${c.bride} & ${c.groom}`;
  }
  return c.bride || c.groom || "Our Wedding";
}

/** The venue and date the preview card mentions, again per template. */
function occasion(view) {
  const c = (view && view.content) || {};
  if (view && view.template === "sample2") {
    return {
      date: (c.wedding && (c.wedding.dateDisplay || c.wedding.dateISO)) || view.weddingDate || "",
      venue: (c.venue && c.venue.name) || "",
    };
  }
  return { date: c.date || view.weddingDate || "", venue: c.venueName || "" };
}

/** The photograph WhatsApp shows. Prefers one the couple marked as the cover,
 *  falls back to the first, and returns null rather than a broken URL if the
 *  invitation has no uploaded photographs at all — which is the normal case
 *  for Sample 2, whose artwork all ships with the template. */
function coverImage(view) {
  const media = (view && view.media) || [];
  const cover = media.find((m) => m.role === "cover") || media[0];
  return cover ? cover.src : null;
}

/* ── Read from raw content, before it is a view ──────────────────────────── */

/* /api/publish needs the couple's names to build a slug and the wedding date
   for the row, and it has only the submitted content to read them from. Both
   templates keep them somewhere different, and this file is already the one
   place that knows both — so the knowledge lives here rather than being
   guessed at with a chain of `||` in the endpoint. */

function namesOf(template, content) {
  const c = content || {};
  if (template === "sample2") {
    const cp = c.couple || {};
    const isGroom = (cp.side === "groom");
    return isGroom
      ? [text(cp.groom) || "", text(cp.bride) || ""]
      : [text(cp.bride) || "", text(cp.groom) || ""];
  }
  const isGroom = (c.side === "groom");
  return isGroom
    ? [text(c.groom) || "", text(c.bride) || ""]
    : [text(c.bride) || "", text(c.groom) || ""];
}

/* Sample 1 keeps a plain "2026-11-14"; Sample 2 keeps a full ISO instant with
   the muhurat time in it. Both are handed on as they are — checkDate() takes
   the calendar day off the front and refuses anything that is not a date, so a
   customer who typed "next December" simply leaves the column null. */
function dateOf(template, content) {
  const c = content || {};
  if (template === "sample2") return text(c.wedding && c.wedding.dateISO) || null;
  return text(c.date) || null;
}

module.exports = {
  toPublic, coupleLine, coverImage, occasion,
  namesOf, dateOf,
  SHAPES, publicMedia,
};
