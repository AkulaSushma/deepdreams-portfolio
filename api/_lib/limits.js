/* ============================================================================
   LIMITS (server) — the same caps as shared/limits.js, plus the code that
   actually enforces them.

   shared/limits.js is loaded by the browser so a customer is told "that
   photograph is too large" while they are still choosing it. That copy is a
   courtesy. This file is the control: every number is checked again here,
   because anything the browser enforces can be switched off from the
   developer console in about four seconds.

   The caps are not arbitrary. Supabase Free gives 1 GB of storage and 5 GB of
   egress a month. Twelve photographs at 250 KB caps one wedding site at 3 MB,
   so about 330 sites fit; the egress ceiling bites first, at roughly seventy
   fully-viewed invitations a month. Raising MAX_PHOTOS spends bandwidth there
   is a fixed amount of — it is not a free knob.
   ========================================================================= */
"use strict";

const LIMITS = require("../../shared/limits.js");

function bad(message) {
  const e = new Error(message || "BAD_REQUEST");
  e.code = "BAD_REQUEST";
  return e;
}

function tooLarge(what) {
  const e = new Error(what || "TOO_LARGE");
  e.code = "TOO_LARGE";
  return e;
}

/** Byte length of a value once serialised — what it will actually cost in the
 *  database, not what it looks like in an editor. */
function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value === undefined ? null : value), "utf8");
}

/** The customer's text: names, events, venue, colours. Never image bytes —
 *  a base64 photograph in this field would put megabytes into a 500 MB
 *  database and make every public read enormous, so anything that looks like
 *  a data URL is refused outright. */
function checkContent(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw bad("CONTENT_SHAPE");
  }

  const bytes = jsonBytes(content);
  if (bytes > LIMITS.MAX_CONTENT_BYTES) throw tooLarge("CONTENT_TOO_LARGE");

  const asText = JSON.stringify(content);
  if (/data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(asText)) throw bad("CONTENT_HAS_EMBEDDED_FILE");

  return bytes;
}

const TEMPLATES = ["sample1", "sample2"];

function checkTemplate(template) {
  if (!TEMPLATES.includes(template)) throw bad("UNKNOWN_TEMPLATE");
  return template;
}

/* A file the browser proposes to upload, described before any bytes move.
   Every field is checked, because every field ends up either in a storage
   path or in a public response. */
const SHA256 = /^[a-f0-9]{64}$/;

/* Each photograph arrives as one descriptor per responsive width, so twelve
   photographs are twenty-four descriptors. Counting descriptors against
   MAX_PHOTOS would refuse a perfectly ordinary twelve-photo wedding — the
   photograph count is enforced against distinct hashes below, and the real
   ceiling on this list is MAX_TOTAL_MEDIA_BYTES. */
function checkFileDescriptors(files) {
  if (!Array.isArray(files)) throw bad("FILES_SHAPE");
  if (files.length > LIMITS.MAX_PHOTOS * LIMITS.IMAGE_WIDTHS.length) {
    throw tooLarge("TOO_MANY_PHOTOS");
  }

  let total = 0;
  const seen = new Set();     // hash + variant, so nothing is uploaded twice
  const photos = new Set();   // distinct hashes, i.e. actual photographs
  const clean = [];

  for (const f of files) {
    if (!f || typeof f !== "object") throw bad("FILE_SHAPE");

    const sha = String(f.sha256 || "").toLowerCase();
    if (!SHA256.test(sha)) throw bad("FILE_HASH");

    const bytes = Number(f.bytes);
    if (!Number.isFinite(bytes) || bytes <= 0) throw bad("FILE_SIZE");
    if (bytes > LIMITS.MAX_PHOTO_BYTES) throw tooLarge("PHOTO_TOO_LARGE");

    const type = String(f.type || "");
    if (!LIMITS.IMAGE_TYPES.includes(type)) throw bad("FILE_TYPE");

    const width = Number(f.w) || 0;
    const height = Number(f.h) || 0;
    if (width > 4000 || height > 4000) throw bad("FILE_DIMENSIONS");

    /* Which responsive variant this is. Anything not on the list would end up
       as an unrecognised suffix in a storage path. */
    const variant = f.variant === undefined || f.variant === null ? null : Number(f.variant);
    if (variant !== null && !LIMITS.IMAGE_WIDTHS.includes(variant)) throw bad("FILE_VARIANT");

    /* Deduplicated on hash AND width, because one photograph legitimately
       appears twice in this list — once per responsive size — and the two
       encodings are different files headed for different paths. Deduplicating
       on the hash alone would silently drop the second one and leave the
       invitation without its desktop image. */
    const key = `${sha}:${variant === null ? "-" : variant}`;
    if (seen.has(key)) continue;
    seen.add(key);
    photos.add(sha);

    total += bytes;
    clean.push({ sha256: sha, bytes, type, w: width, h: height, variant });
  }

  /* MAX_PHOTOS counts photographs, not files. */
  if (photos.size > LIMITS.MAX_PHOTOS) throw tooLarge("TOO_MANY_PHOTOS");
  if (total > LIMITS.MAX_TOTAL_MEDIA_BYTES) throw tooLarge("MEDIA_TOTAL_TOO_LARGE");
  return clean;
}

/** The media references submitted at publish time. These are paths, never
 *  bytes — and every path must sit inside this customer's own folder, which
 *  the server derived from their token. That check is what stops one customer
 *  from claiming another customer's photographs as their own. */
function checkMediaRefs(media, allowedPrefix) {
  if (!Array.isArray(media)) throw bad("MEDIA_SHAPE");
  if (media.length > LIMITS.MAX_PHOTOS) throw tooLarge("TOO_MANY_PHOTOS");
  if (jsonBytes(media) > 50000) throw tooLarge("MEDIA_JSON_TOO_LARGE");

  const inside = (p) =>
    typeof p === "string" && p.startsWith(allowedPrefix) && !p.includes("..");

  return media.map((m) => {
    if (!m || typeof m !== "object") throw bad("MEDIA_ITEM_SHAPE");
    if (!inside(m.path)) throw bad("MEDIA_PATH_OUTSIDE_DRAFT");

    const sizes = {};
    if (m.sizes && typeof m.sizes === "object") {
      for (const w of LIMITS.IMAGE_WIDTHS) {
        const p = m.sizes[w];
        if (p === undefined) continue;
        if (!inside(p)) throw bad("MEDIA_PATH_OUTSIDE_DRAFT");
        sizes[w] = p;
      }
    }

    return {
      role: m.role === "cover" ? "cover" : "gallery",
      path: m.path,
      sizes,
      w: Number(m.w) || undefined,
      h: Number(m.h) || undefined,
      caption: m.caption ? String(m.caption).slice(0, 200) : undefined,
    };
  });
}

/** The browser's retry key. It must be unguessable enough that two customers
 *  cannot collide, and bounded so it cannot become a storage attack. */
function checkIdempotencyKey(key) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) throw bad("IDEMPOTENCY_KEY");
  return key;
}

/** A wedding date, if the customer gave one. Optional by design: plenty of
 *  invitations are sent before the date is fixed. */
function checkDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

module.exports = {
  ...LIMITS,
  TEMPLATES,
  jsonBytes,
  checkContent, checkTemplate, checkFileDescriptors, checkMediaRefs,
  checkIdempotencyKey, checkDate,
};
