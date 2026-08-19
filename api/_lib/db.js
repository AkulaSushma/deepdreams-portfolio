/* ============================================================================
   DB — the only module in this repository that talks to the database.

   Nothing else may import it except other files in api/_lib and the handlers
   in api/. No file a browser can download imports this, and no browser ever
   receives a Supabase key of any kind.

   Why plain fetch against PostgREST instead of @supabase/supabase-js:
   the site has no package.json and no build step, and adding one to send five
   kinds of HTTP request would change how the whole project deploys. Node's
   built-in fetch does the job in about eighty lines, cold starts stay short,
   and the seam stays honest — every query lives here, so moving to a different
   Postgres host later means rewriting this file and nothing else.
   ========================================================================= */
"use strict";

const { log } = require("./http");

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

/* A serverless function that hangs is worse than one that fails: the customer
   watches a spinner until they give up. Every call gets a deadline. */
const DEFAULT_TIMEOUT_MS = 6000;

function assertConfigured() {
  if (!URL_BASE || !SERVICE_KEY) {
    const err = new Error("Supabase environment variables are not set");
    err.code = "UPSTREAM";
    throw err;
  }
}

async function request(path, { method = "GET", body, headers, timeoutMs } = {}) {
  assertConfigured();

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${URL_BASE}/rest/v1${path}`, {
      method,
      signal: ac.signal,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    /* Timed out, DNS failure, or the project is paused after a week idle. */
    log("db.unreachable", { path, reason: err.name });
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const payload = text ? safeParse(text) : null;

  if (!res.ok) {
    /* Our own RPCs raise bare sentinels (TOKEN_NOT_AVAILABLE, SLUG_TAKEN…).
       Surface those verbatim to the caller, which knows what they mean.
       Anything else is an infrastructure problem the customer cannot act on,
       so it becomes a generic upstream failure and is logged for us. */
    const message = (payload && (payload.message || payload.hint)) || "";
    if (/^[A-Z_]+$/.test(message)) {
      const e = new Error(message);
      e.dbCode = message;
      throw e;
    }
    log("db.error", { path, status: res.status, message });
    const e = new Error("UPSTREAM");
    e.code = "UPSTREAM";
    throw e;
  }

  return payload;
}

function safeParse(t) {
  try { return JSON.parse(t); } catch { return null; }
}

/** Call a Postgres function. All multi-step writes go through one of these,
 *  so they are transactional by construction rather than by discipline. */
function rpc(name, args, opts) {
  return request(`/rpc/${name}`, { method: "POST", body: args || {}, ...opts });
}

/* ── Reads ────────────────────────────────────────────────────────────────
   Only the columns each caller needs. `select=*` on wedding_sites would drag
   private_notes into memory next to a response body, which is exactly the
   accident public-view.js exists to make impossible. */

/** The one query a guest's page view can trigger — and only on a CDN miss. */
async function getSiteBySlug(slug) {
  const rows = await request(
    `/wedding_sites?slug=eq.${encodeURIComponent(slug)}` +
    `&status=eq.live&select=id,slug,template,content,media,wedding_date,updated_at&limit=1`
  );
  return (rows && rows[0]) || null;
}

async function getSiteById(id) {
  const rows = await request(
    `/wedding_sites?id=eq.${encodeURIComponent(id)}` +
    `&select=id,slug,template,content,media,status,wedding_date,published_at,updated_at,private_notes&limit=1`
  );
  return (rows && rows[0]) || null;
}

async function slugExists(slug) {
  const rows = await request(
    `/wedding_sites?slug=eq.${encodeURIComponent(slug)}&select=slug&limit=1`
  );
  return !!(rows && rows.length);
}

/** Token lookup for preflight. Deliberately does NOT consume anything: a
 *  customer must be able to check their code, and discover their photographs
 *  are too large, without spending it. */
async function findToken(tokenHash) {
  const rows = await request(
    `/activation_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}` +
    `&select=id,status,template,site_id&limit=1`
  );
  return (rows && rows[0]) || null;
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/** Consume a token and create the website, or do neither. See schema.sql. */
async function publishSite(args) {
  const rows = await rpc("publish_site", args, { timeoutMs: 8000 });
  const row = rows && rows[0];
  if (!row) {
    const e = new Error("SERVER");
    e.code = "SERVER";
    throw e;
  }
  return { slug: row.out_slug, siteId: row.out_site_id };
}

/** "I already paid — where is my link?" Returns null rather than raising. */
async function findSiteByToken(tokenHash) {
  const rows = await rpc("find_site_by_token", { p_token_hash: tokenHash });
  const row = rows && rows[0];
  return row ? { slug: row.out_slug, siteId: row.out_site_id } : null;
}

async function updateSite(siteId, content, media, weddingDate) {
  const rows = await rpc("update_site", {
    p_site_id: siteId, p_content: content, p_media: media,
    p_wedding_date: weddingDate || null,
  }, { timeoutMs: 8000 });
  const row = rows && rows[0];
  return { slug: row && row.out_slug, versionId: row && row.out_version_id };
}

async function rollbackSite(siteId, versionId) {
  const rows = await rpc("rollback_site", { p_site_id: siteId, p_version_id: versionId });
  return { slug: rows && rows[0] && rows[0].out_slug };
}

/* ── Admin ──────────────────────────────────────────────────────────────── */

async function insertToken({ tokenHash, label, template, notes }) {
  const rows = await request("/activation_tokens", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: { token_hash: tokenHash, label, template, notes },
  });
  return rows && rows[0];
}

/** Never returns token_hash. There is no legitimate reason for a hash to
 *  travel to a browser, even an authenticated one. */
async function listTokens(limit = 100) {
  return request(
    `/activation_tokens?select=id,label,template,status,issued_at,consumed_at,site_id` +
    `&order=issued_at.desc&limit=${Number(limit) || 100}`
  );
}

async function revokeToken(id) {
  return request(`/activation_tokens?id=eq.${encodeURIComponent(id)}&status=eq.issued`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { status: "revoked" },
  });
}

async function listSites(limit = 100) {
  return request(
    `/wedding_sites?select=id,slug,template,status,wedding_date,published_at,updated_at` +
    `&order=published_at.desc&limit=${Number(limit) || 100}`
  );
}

async function listVersions(siteId, limit = 10) {
  return request(
    `/site_versions?site_id=eq.${encodeURIComponent(siteId)}` +
    `&select=id,reason,created_at&order=created_at.desc&limit=${Number(limit) || 10}`
  );
}

async function setSiteStatus(siteId, status) {
  return request(`/wedding_sites?id=eq.${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { status, updated_at: new Date().toISOString() },
  });
}

/* ── Housekeeping (daily cron) ──────────────────────────────────────────── */

/** One trivial query. Its only job is to stop Supabase Free from pausing the
 *  project after a week of quiet — which would take every published
 *  invitation's fresh data offline. */
async function ping() {
  await request("/wedding_sites?select=id&limit=1", { timeoutMs: 4000 });
  return true;
}

/** Codes that were issued a while ago and still have not published anything.
 *
 *  This is the ONLY function that returns a token hash, and it exists for one
 *  caller: the nightly sweep, which needs the hash to work out which storage
 *  folder an abandoned draft's photographs are sitting in. (The folder name is
 *  derived from the hash — see tokens.draftId — precisely so that it is never
 *  stored anywhere.) Nothing that answers a browser may call this. */
async function staleIssuedTokens(days) {
  const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
  return request(
    `/activation_tokens?status=eq.issued&issued_at=lt.${encodeURIComponent(cutoff)}` +
    `&select=id,token_hash&limit=500`
  );
}

async function pruneVersions(keep = 10) {
  return rpc("prune_site_versions", { p_keep: keep }, { timeoutMs: 10000 });
}

/** Everything worth keeping, for the daily backup. Supabase Free has no
 *  point-in-time recovery, so this export is the only safety net there is. */
async function exportAllSites() {
  return request(
    "/wedding_sites?select=id,slug,template,content,media,status,wedding_date," +
    "published_at,updated_at&order=published_at.asc"
  );
}

module.exports = {
  getSiteBySlug, getSiteById, slugExists, findToken,
  publishSite, findSiteByToken, updateSite, rollbackSite,
  insertToken, listTokens, revokeToken, listSites, listVersions, setSiteStatus,
  ping, pruneVersions, exportAllSites, staleIssuedTokens,
};
