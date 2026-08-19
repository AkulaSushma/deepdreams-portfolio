/* ============================================================================
   POST /api/publish/recover

   "I already paid — where is my link?"

   Publishing can succeed and the answer still never arrive: a train enters a
   tunnel, a phone switches from wifi to mobile data, a browser tab is closed
   half a second early. The website exists, the code is spent, and the
   customer has nothing. This endpoint is the way back.

   It reveals only what the holder of the code is already entitled to: the
   public link their own code created. It cannot create anything, cannot
   change anything, and returns nothing at all for a code that never
   published.

   Body:  { token }
   Reply: { ok, slug, url } | 404
   ========================================================================= */
"use strict";

const { handler, requireMethod, readJson, rateLimit, fail, json, log, publicOrigin } = require("../_lib/http");
const LIMITS = require("../_lib/limits");
const tokens = require("../_lib/tokens");
const db = require("../_lib/db");

module.exports = handler("recover", async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  if (!rateLimit(req, "recover", LIMITS.RATE.recover)) return fail(res, "RATE_LIMITED");

  const body = await readJson(req, 4 * 1024);

  if (!tokens.looksValid(body.token)) return fail(res, "TOKEN_INVALID");

  const found = await db.findSiteByToken(tokens.hash(body.token));

  if (!found) {
    /* Either the code is unknown, or it is real but has not published
       anything yet. Both get the same answer: there is no link to give, and
       distinguishing the two would tell a stranger whether a guessed code
       exists. */
    log("recover.miss", {});
    return fail(res, "NOT_FOUND");
  }

  log("recover.ok", { slug: found.slug });

  return json(res, 200, {
    ok: true,
    slug: found.slug,
    url: `${publicOrigin(req)}/invite/${found.slug}`,
  });
});
