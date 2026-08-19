/* ============================================================================
   /api/admin/site          (admin session required)

   GET                                → every published website, newest first
   GET ?slug=…                        → one website, plus its saved versions
   POST { action:"status", id, status } → take a website offline, or back online
   POST { action:"rollback", id, versionId } → restore a saved version

   This is the "studio only, on request" half of the plan: a couple who wants a
   date changed sends a message, and the change is made here. There is no
   customer-facing edit link and no editing secret, so there is nothing to leak.

   Nothing in this file can create a website or spend an activation code. The
   only route to a new website is a paid code going through /api/publish.
   ========================================================================= */
"use strict";

const { handler, readJson, fail, json, log, publicOrigin } = require("../_lib/http");
const auth = require("../_lib/auth");
const db = require("../_lib/db");

/* The two the schema allows, and no more. Deletion is deliberately absent: a
   wedding website that a family has already sent to two hundred relatives
   should go quiet, not vanish — /api/invite answers a disabled site with a
   calm card rather than a dead link. Removing one for good is a decision made
   with the customer, not a button sitting next to "publish". */
const STATUSES = ["live", "disabled"];

const id64 = (v) => (typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v) ? v : null);

module.exports = handler("admin.site", async (req, res) => {
  if (!auth.requireAdmin(req, res)) return;

  if (req.method === "GET") {
    /* Parsed from req.url rather than req.query, exactly as /api/invite does:
       one way of reading a query string across the whole API, and one that
       does not depend on the platform having pre-parsed it.

       By id, not by slug. db.getSiteBySlug filters on `status = live` because
       that is what a guest is allowed to see — and the one website the studio
       most needs to open is the one that has just been taken offline. */
    const wanted = new URL(req.url, "http://localhost").searchParams.get("id") || "";

    if (wanted) {
      if (!id64(wanted)) return fail(res, "BAD_REQUEST");

      const site = await db.getSiteById(wanted);
      if (!site) return fail(res, "NOT_FOUND");

      const versions = await db.listVersions(site.id, 10);

      /* Field by field on purpose. `site` also carries `content` and `media` —
         a megabyte of invitation the admin page has no use for — and spreading
         the row would ship both on every click. */
      return json(res, 200, {
        ok: true,
        site: {
          id: site.id,
          slug: site.slug,
          template: site.template,
          status: site.status,
          weddingDate: site.wedding_date,
          publishedAt: site.published_at,
          updatedAt: site.updated_at,
          privateNotes: site.private_notes || null,
          url: `${publicOrigin(req)}/invite/${site.slug}`,
        },
        versions: versions || [],
      });
    }

    const rows = await db.listSites(200);
    const origin = publicOrigin(req);
    return json(res, 200, {
      ok: true,
      sites: (rows || []).map((s) => ({ ...s, url: `${origin}/invite/${s.slug}` })),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, "BAD_REQUEST");
  }

  const body = await readJson(req, 8 * 1024);
  const siteId = id64(body && body.id);
  if (!siteId) return fail(res, "BAD_REQUEST");

  if (body.action === "status") {
    if (!STATUSES.includes(body.status)) return fail(res, "BAD_REQUEST");

    const rows = await db.setSiteStatus(siteId, body.status);
    if (!rows || !rows.length) return fail(res, "NOT_FOUND");

    log("admin.site.status", { id: siteId, status: body.status });
    return json(res, 200, { ok: true, status: body.status });
  }

  if (body.action === "rollback") {
    const versionId = id64(body.versionId);
    if (!versionId) return fail(res, "BAD_REQUEST");

    const out = await db.rollbackSite(siteId, versionId);
    if (!out || !out.slug) return fail(res, "NOT_FOUND");

    log("admin.site.rollback", { id: siteId, versionId });
    return json(res, 200, { ok: true, slug: out.slug });
  }

  return fail(res, "BAD_REQUEST");
});
