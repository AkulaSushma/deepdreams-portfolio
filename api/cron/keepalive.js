/* ============================================================================
   GET /api/cron/keepalive          (Vercel Cron — once a day)

   Four small jobs that together keep a free-tier deployment from quietly
   losing a paying customer's website:

   1. TOUCH THE DATABASE. Supabase Free pauses a project after a week with no
      traffic. A paused project means every published invitation stops loading
      fresh data — during someone's wedding week, most likely. One trivial
      query a day is all it takes to keep the project awake.

   2. SWEEP ABANDONED DRAFTS. Photographs are uploaded before the activation
      code is spent, because a customer must be able to see their invitation
      finished before paying for it. Some of those uploads never become a
      website. After DRAFT_TTL_DAYS they are storage we are paying for on
      behalf of a wedding that is not happening here.

      The folder name is derived from the code's hash rather than stored
      (tokens.draftId), so this sweep starts from the codes, not from a listing
      of the bucket. That is the whole reason staleIssuedTokens exists.

   3. TRIM OLD VERSIONS. Every studio edit writes a version row. Ten per
      website is plenty of history and bounded growth.

   4. BACK UP. Supabase Free has no point-in-time recovery. This nightly JSON
      export into a private bucket is the only copy of a customer's invitation
      that exists outside the live table.

   Guarded by CRON_SECRET, sent as `Authorization: Bearer …`. It also accepts
   `?key=` for a manual run, because a browser cannot set a header and there is
   nothing secret in the RESPONSE — the secret is in the request, and a manual
   run is something you do once, from your own machine.

   On Netlify the daily run arrives through netlify/functions/keepalive.js,
   which supplies the header itself; scheduled functions cannot be reached by
   URL, so there is nowhere for a caller to reach that wrapper from. The
   manual route stays guarded exactly as it is here.

   Nothing here is on a customer's path. If it fails, it says so in the log and
   the next run tries again; it never leaves the database half-swept.
   ========================================================================= */
"use strict";

const { handler, fail, json, log, safeEqual } = require("../_lib/http");
const LIMITS = require("../_lib/limits");
const tokens = require("../_lib/tokens");
const storage = require("../_lib/storage");
const db = require("../_lib/db");

const KEEP_VERSIONS = 10;
const KEEP_BACKUPS = 14;          // two weeks of nightly exports

/* The sweep is the only job whose work grows with the number of abandoned
   drafts, and it is the only one that could run long enough to be killed
   half-way. Netlify caps a scheduled function at 30 seconds; this leaves the
   other three jobs room and stops the sweep well short of it.

   Stopping early is safe by construction: each folder is listed and deleted
   in full before the next one starts, so an interrupted run leaves no folder
   half-deleted, and tomorrow's run picks up exactly where this one stopped —
   the codes it did not reach are still `issued` and still old. */
const SWEEP_BUDGET_MS = 15000;

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  /* No secret configured means no cron. Refusing is the safe direction: an
     open endpoint that deletes storage is worse than one that never runs. */
  if (!secret || secret.length < 16) {
    log("cron.misconfigured", {});
    return false;
  }

  const header = String((req.headers && req.headers.authorization) || "");
  if (header.startsWith("Bearer ") && safeEqual(header.slice(7), secret)) return true;

  const key = new URL(req.url, "http://localhost").searchParams.get("key");
  return !!key && safeEqual(key, secret);
}

/** Run one job without letting it take the other three down with it. */
async function attempt(name, fn) {
  try {
    return { job: name, ok: true, result: await fn() };
  } catch (err) {
    log("cron.job_failed", { job: name, message: String(err && err.message) });
    return { job: name, ok: false };
  }
}

/* ── The jobs ───────────────────────────────────────────────────────────── */

async function sweepAbandonedDrafts() {
  const stale = await db.staleIssuedTokens(LIMITS.DRAFT_TTL_DAYS);

  const deadline = Date.now() + SWEEP_BUDGET_MS;

  let folders = 0;
  let files = 0;
  let unfinished = 0;

  for (const row of stale || []) {
    if (!row || !row.token_hash) continue;

    if (Date.now() > deadline) { unfinished += 1; continue; }

    const prefix = `sites/${tokens.draftId(row.token_hash)}/`;
    const items = await storage.list(prefix, { limit: 100 });
    if (!items.length) continue;

    /* storage.list returns names relative to the prefix. */
    await storage.remove(items.map((f) => prefix + f.name));
    folders += 1;
    files += items.length;
  }

  /* Ids, never hashes: a hash in a log line is a folder name in a log line.
     `unfinished` is the number left for tomorrow. Persistently non-zero means
     the sweep is falling behind, not that anything is broken. */
  return unfinished ? { folders, files, unfinished } : { folders, files };
}

async function backup() {
  const sites = await db.exportAllSites();
  if (!sites || !sites.length) return { sites: 0 };

  /* Named by date so a run twice in one day overwrites rather than doubles. */
  const name = `sites-${new Date().toISOString().slice(0, 10)}.json`;
  await storage.putJson(name, { takenAt: new Date().toISOString(), sites });

  /* Keep a fortnight. listBackups sorts by name descending, and the names sort
     chronologically, so anything past the first KEEP_BACKUPS is older. */
  const all = await storage.listBackups(200);
  const old = all.slice(KEEP_BACKUPS).map((f) => f.name);
  if (old.length) await storage.removeBackups(old);

  return { sites: sites.length, name, pruned: old.length };
}

module.exports = handler("cron.keepalive", async (req, res) => {
  if (!authorised(req)) {
    /* Deliberately 404, not 401: an endpoint that answers "wrong secret" tells
       a scanner it has found something worth guessing at. */
    return fail(res, "NOT_FOUND");
  }

  const jobs = [];
  jobs.push(await attempt("ping", () => db.ping()));
  jobs.push(await attempt("sweep", sweepAbandonedDrafts));
  jobs.push(await attempt("versions", () => db.pruneVersions(KEEP_VERSIONS)));
  jobs.push(await attempt("backup", backup));

  const failed = jobs.filter((j) => !j.ok).map((j) => j.job);
  log("cron.done", { failed: failed.length ? failed : undefined });

  /* Always 200 while the database itself answered. A red cron run in the
     dashboard should mean "the project is down", not "one backup retried". */
  return json(res, jobs[0].ok ? 200 : 503, { ok: !failed.length, jobs });
});
