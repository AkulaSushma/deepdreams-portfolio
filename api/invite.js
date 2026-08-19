/* ============================================================================
   GET /invite/{slug}   (rewritten to /api/invite?slug=…)

   The public page. Everything about it is arranged around one number: a
   hundred guests opening the same invitation in the same minute must not
   become a hundred database reads.

   They become one. The response carries
       Cache-Control: public, s-maxage=60, stale-while-revalidate=86400
   so Vercel's CDN answers every guest after the first, and keeps answering
   from the last good copy for a day if the database is unreachable. An
   invitation that is already in guests' hands stays viewable even when the
   publishing side of this system is not.

   The cost of that is honest and worth stating: a studio edit appears within
   about a minute, not instantly.

   No guest write, no page-view row, no session, no Postgres connection —
   PostgREST speaks HTTP, so there is no pool to exhaust when a wedding party
   all open the link at once.
   ========================================================================= */
"use strict";

const { handler, log, publicOrigin } = require("./_lib/http");
const tokens = require("./_lib/tokens");
const db = require("./_lib/db");
const render = require("./_lib/render");
const publicView = require("./_lib/public-view");

/* Cache-Control for a real invitation. 60 seconds of shared caching is short
   enough that a correction reaches guests quickly, long enough that a wedding
   morning rush costs one query. */
const CACHE_LIVE = "public, s-maxage=60, stale-while-revalidate=86400";

/* A mistyped link is cached too, briefly — otherwise a crawler working
   through guessed slugs would reach the database on every request. */
const CACHE_MISS = "public, s-maxage=300, stale-while-revalidate=3600";

/* The template's own markup, fetched from this same deployment. Held per warm
   instance; a new deployment gets new instances, so this can never serve last
   week's design. */
const templateCache = new Map();

async function loadTemplate(template, origin) {
  if (templateCache.has(template)) return templateCache.get(template);

  const path = render.TEMPLATE_SOURCE[template];
  if (!path) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${origin}${encodeURI(path)}`, { signal: ac.signal });
    if (!res.ok) throw new Error(`template ${res.status}`);
    const html = await res.text();
    templateCache.set(template, html);
    return html;
  } catch (err) {
    log("invite.template_failed", { template, reason: String(err && err.message) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function send(res, status, html, cacheControl) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  /* A wedding invitation carries a family's names, date and venue. It is
     meant to be forwarded to relatives, not found by strangers searching a
     bride's name. */
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(html);
}

module.exports = handler("invite", async (req, res) => {
  const origin = publicOrigin(req);

  const url = new URL(req.url, "http://localhost");
  const slug = url.searchParams.get("slug") || "";

  /* Refuse anything that is not slug-shaped before touching the database.
     A scanner walking paths costs us nothing. */
  if (!tokens.isValidSlug(slug)) {
    return send(res, 404, render.notFoundPage(origin), CACHE_MISS);
  }

  let row;
  try {
    row = await db.getSiteBySlug(slug);
  } catch (err) {
    /* The database is unreachable or paused. If the CDN had a stale copy the
       guest would never have got here, so this is the genuine last resort:
       a calm card, no error code, and no caching of the failure. */
    log("invite.db_unavailable", { slug });
    return send(res, 503, render.maintenancePage(origin), "no-store");
  }

  if (!row) {
    return send(res, 404, render.notFoundPage(origin), CACHE_MISS);
  }

  const view = publicView.toPublic(row, origin);

  const templateHtml = await loadTemplate(view.template, origin);
  if (!templateHtml) {
    return send(res, 503, render.maintenancePage(origin), "no-store");
  }

  log("invite.ok", { slug, template: view.template });

  return send(res, 200, render.page(templateHtml, view, origin), CACHE_LIVE);
});
