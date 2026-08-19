/* ============================================================================
   POST /api/publish

   The moment a customer's activation code becomes a wedding website. One
   database transaction consumes the code and creates the site, or does
   neither — a paid code can never be spent without a link to show for it.

   No image bytes pass through this function. The browser has already sent its
   photographs straight to storage using the short-lived, path-scoped
   permissions issued by /api/publish/preflight, so Vercel's request payload
   limit and function duration are irrelevant to how many photographs a couple
   chose. What arrives here is text and file paths.

   Body:  { token, idempotencyKey, template, content, media, weddingDate }
   Reply: { ok, slug, url }
   ========================================================================= */
"use strict";

const { handler, requireMethod, readJson, rateLimit, fail, json, log, publicOrigin } = require("../_lib/http");
const LIMITS = require("../_lib/limits");
const tokens = require("../_lib/tokens");
const db = require("../_lib/db");
const { namesOf, dateOf } = require("../_lib/public-view");

/* A slug is bride-groom plus four random characters. A collision means two
   couples with the same names drew the same suffix — about one in a million
   per pair — so three attempts is generous, and the failure is clean. */
const SLUG_ATTEMPTS = 3;

module.exports = handler("publish", async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  if (!rateLimit(req, "publish", LIMITS.RATE.publish)) return fail(res, "RATE_LIMITED");

  /* 512 KB is comfortably above a 100 KB content cap plus media references,
     and far below anything that could occupy this function for its whole
     duration. */
  const body = await readJson(req, 512 * 1024);

  const template = LIMITS.checkTemplate(body.template);
  const idem = LIMITS.checkIdempotencyKey(body.idempotencyKey);
  const content = body.content;
  LIMITS.checkContent(content);
  /* The date is read out of the content the customer actually filled in, using
     the same per-template knowledge that validates it later. It is only ever a
     convenience column for the admin list — the invitation itself renders the
     date the couple typed, not this. */
  const weddingDate = LIMITS.checkDate(body.weddingDate || dateOf(template, content));

  if (!tokens.looksValid(body.token)) return fail(res, "TOKEN_INVALID");
  const tokenHash = tokens.hash(body.token);

  /* Media paths are re-derived from the code, never trusted from the body.
     A customer could otherwise submit another couple's storage path and
     publish their photographs as their own. */
  const prefix = `sites/${tokens.draftId(tokenHash)}/`;
  const media = LIMITS.checkMediaRefs(body.media || [], prefix);

  /* Each template keeps the couple's names in its own place — Sample 1 at the
     top level, Sample 2 under `couple`. public-view.js is the one module that
     knows both shapes, so the slug asks it rather than guessing. */
  const [nameA, nameB] = namesOf(template, content);

  let lastError = null;

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = tokens.makeSlug(nameA, nameB);

    try {
      const result = await db.publishSite({
        p_token_hash: tokenHash,
        p_idem: idem,
        p_template: template,
        p_slug: slug,
        p_content: content,
        p_media: media,
        p_wedding_date: weddingDate,
      });

      log("publish.ok", { template, slug: result.slug, photos: media.length, attempt });

      return json(res, 200, {
        ok: true,
        slug: result.slug,
        url: `${publicOrigin(req)}/invite/${result.slug}`,
      });
    } catch (err) {
      lastError = err;

      /* Someone else holds this slug. The whole transaction rolled back with
         it, including the token claim, so simply drawing a new suffix and
         trying again is safe — nothing has been spent. */
      if (err.dbCode === "SLUG_TAKEN") continue;
      break;
    }
  }

  /* ── Failure paths ─────────────────────────────────────────────────────
     Everything below this line has consumed nothing. */

  if (lastError && lastError.dbCode === "TOKEN_NOT_AVAILABLE") {
    /* Work out which of the four reasons it was, so the customer reads
       something they can act on rather than "invalid code". This costs one
       indexed lookup on a path that has already failed. */
    const row = await db.findToken(tokenHash).catch(() => null);

    if (!row) {
      log("publish.refused", { reason: "unknown" });
      return fail(res, "TOKEN_INVALID");
    }
    if (row.status === "revoked") {
      log("publish.refused", { reason: "revoked" });
      return fail(res, "TOKEN_REVOKED");
    }
    if (row.template !== template) {
      log("publish.refused", { reason: "wrong_template" });
      return fail(res, "TOKEN_WRONG_TEMPLATE");
    }

    /* Already used. This is the case the whole system exists to enforce:
       one code activates one wedding website, and never a second one. If it
       was this customer's own earlier attempt, `recoverable` lets the editor
       offer "get my link back" instead of an apology. */
    log("publish.refused", { reason: "consumed" });
    return fail(res, "TOKEN_USED", { recoverable: !!row.site_id });
  }

  if (lastError && lastError.dbCode === "SLUG_TAKEN") {
    log("publish.slug_exhausted", { template });
    return fail(res, "SERVER");
  }

  throw lastError || new Error("SERVER");
});
