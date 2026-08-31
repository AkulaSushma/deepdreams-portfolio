/* ============================================================================
   STORAGE — the only module in this repository that knows Supabase Storage
   exists.

   Everything above it speaks in five verbs: signUpload, publicUrl, move,
   remove, list (plus putJson for the nightly backup). Moving to Cloudflare R2
   or S3 later means rewriting this file and changing nothing else — which is
   the whole reason the seam is here.

   The one rule that must survive any such rewrite: a browser receives a
   permission to write to exactly one path, valid for ten minutes. It never
   receives a key.
   ========================================================================= */
"use strict";

const { log } = require("./http");

/* Read per call, not at module load: the Cloudflare Pages bridge injects the
   environment on each request, after this module is first required. */
function credentials() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY,
  };
}

const MEDIA_BUCKET = "wedding-media";
const BACKUP_BUCKET = "wedding-backups";

const TIMEOUT_MS = 8000;

/* A path we are willing to sign. Lowercase hex, dashes and a single dot for
   the extension — nothing that could climb out of its folder with `..`,
   a backslash, a URL-encoded slash or a leading `/`. */
const SAFE_PATH = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/;

function assertSafePath(path) {
  if (typeof path !== "string" || path.length > 200 || !SAFE_PATH.test(path) || path.includes("..")) {
    const e = new Error("BAD_REQUEST");
    e.code = "BAD_REQUEST";
    throw e;
  }
  return path;
}

async function api(path, { method = "POST", body, headers, raw, timeoutMs } = {}) {
  const { url: URL_BASE, key: SERVICE_KEY } = credentials();
  if (!URL_BASE || !SERVICE_KEY) {
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    throw e;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${URL_BASE}/storage/v1${path}`, {
      method,
      signal: ac.signal,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        ...(raw ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch (err) {
    log("storage.unreachable", { path, reason: err.name });
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    log("storage.error", { path, status: res.status, body: text.slice(0, 200) });
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    e.status = res.status;
    throw e;
  }
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

/* ── The five verbs ─────────────────────────────────────────────────────── */

/** A one-shot permission to write to exactly one path, expiring in ten
 *  minutes. This is what lets image bytes go straight from the customer's
 *  phone to storage: no photograph ever passes through a Vercel Function, so
 *  the 4.5 MB request limit and the function duration limit simply do not
 *  apply to uploads.
 *
 *  The path is chosen by the server, never by the browser. That is the whole
 *  defence against one customer writing over another's photographs. */
async function signUpload(path) {
  assertSafePath(path);
  const out = await api(`/object/upload/sign/${MEDIA_BUCKET}/${path}`, {
    method: "POST",
    body: {},
  });
  /* Supabase returns a relative "/object/upload/sign/<bucket>/<path>?token=…".
     The signed token in that URL grants a write to this path alone. */
  const rel = out && out.url;
  if (!rel) {
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    throw e;
  }
  const { url } = credentials();
  return `${url}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`;
}

/** The permanent address of a photograph. `wedding-media` is a public bucket,
 *  so guests load images directly from Supabase's CDN with no key and no
 *  function invocation. Paths are content-hashed, so they are unguessable —
 *  and they hold only photographs the couple is about to send to two hundred
 *  relatives anyway. */
function publicUrl(path) {
  return `${credentials().url}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Promote a draft upload to its permanent home once publishing has actually
 *  succeeded. Nothing under sites/ exists until a token has been spent. */
async function move(fromPath, toPath) {
  assertSafePath(fromPath);
  assertSafePath(toPath);
  return api("/object/move", {
    body: { bucketId: MEDIA_BUCKET, sourceKey: fromPath, destinationKey: toPath },
  });
}

async function remove(paths) {
  const list = (Array.isArray(paths) ? paths : [paths]).map(assertSafePath);
  if (!list.length) return null;
  return api(`/object/${MEDIA_BUCKET}`, { method: "DELETE", body: { prefixes: list } });
}

/** Contents of one folder. Used by preflight to skip re-uploading a photograph
 *  the customer already sent, and by the cron sweep to find abandoned drafts. */
async function list(prefix, { limit = 100, offset = 0 } = {}) {
  const rows = await api(`/object/list/${MEDIA_BUCKET}`, {
    body: {
      prefix,
      limit,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    },
  });
  return Array.isArray(rows) ? rows : [];
}

/* ── Backups ────────────────────────────────────────────────────────────── */

/** Write the nightly JSON export to the private bucket. Supabase Free has no
 *  point-in-time recovery; this is the only copy of a customer's invitation
 *  that exists outside the live table. */
async function putJson(name, data) {
  const body = Buffer.from(JSON.stringify(data), "utf8");
  return api(`/object/${BACKUP_BUCKET}/${name}`, {
    method: "POST",
    raw: true,
    body,
    headers: { "Content-Type": "application/json", "x-upsert": "true" },
    timeoutMs: 15000,
  });
}

async function listBackups(limit = 100) {
  const rows = await api(`/object/list/${BACKUP_BUCKET}`, {
    body: { prefix: "", limit, offset: 0, sortBy: { column: "name", order: "desc" } },
  });
  return Array.isArray(rows) ? rows : [];
}

async function removeBackups(names) {
  if (!names || !names.length) return null;
  return api(`/object/${BACKUP_BUCKET}`, { method: "DELETE", body: { prefixes: names } });
}

module.exports = {
  MEDIA_BUCKET, BACKUP_BUCKET,
  signUpload, publicUrl, move, remove, list,
  putJson, listBackups, removeBackups,
  assertSafePath,
};
