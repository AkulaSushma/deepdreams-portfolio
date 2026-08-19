/* ============================================================================
   POST /api/admin/login

   The studio's own door. One password, held in an environment variable, is
   compared here and nowhere else; what goes back to the browser is a signed,
   HttpOnly cookie that JavaScript cannot read and cannot forge.

   Body:  { password }            → sign in
          { action: "logout" }    → sign out
   Reply: { ok: true } | 401

   Deliberately unchanged from the plan on two points:
     · the password never appears in a response, a log line or the page source
     · a wrong password is answered slowly enough — via the rate limiter — that
       guessing is not worth attempting, and the reply says only "not signed in"
   ========================================================================= */
"use strict";

const { handler, requireMethod, readJson, rateLimit, fail, json, log } = require("../_lib/http");
const LIMITS = require("../_lib/limits");
const auth = require("../_lib/auth");

module.exports = handler("admin.login", async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req, 2 * 1024);

  /* Signing out needs no password and must always work, even from a session
     that has already expired — otherwise a shared machine keeps the cookie. */
  if (body && body.action === "logout") {
    auth.clear(res);
    return json(res, 200, { ok: true });
  }

  /* Rate limited before the comparison, not after: the limiter is the only
     thing standing between a single password and an automated guesser. */
  if (!rateLimit(req, "adminLogin", LIMITS.RATE.adminLogin)) return fail(res, "RATE_LIMITED");

  if (!auth.checkPassword(body && body.password)) {
    /* No detail. Not "wrong password", not "no password set" — an attacker
       learns nothing about which of the two happened. */
    log("admin.login.refused", {});
    return fail(res, "UNAUTHORISED");
  }

  auth.issue(res);
  log("admin.login.ok", {});
  return json(res, 200, { ok: true });
});
