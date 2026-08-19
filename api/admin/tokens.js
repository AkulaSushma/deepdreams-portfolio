/* ============================================================================
   /api/admin/tokens        (admin session required)

   GET                          → the activation codes, newest first
   POST { label, template,      → mint one code and show it ONCE
          notes, count }
   POST { action:"revoke", id } → withdraw a code that has not been used

   The one place in the system where an activation code exists in plain text is
   the reply to a POST that just created it. It is not stored, not logged and
   not recoverable: the database holds sha256(code + pepper) and nothing else.
   If the studio loses the code before sending it, the honest fix is to revoke
   it and mint another — which is why revoke exists.

   GET never returns a hash. A hash in a browser is a hash on a screenshot, in
   a screen recording, in a support chat; there is no legitimate use for it
   outside the server.
   ========================================================================= */
"use strict";

const { handler, readJson, fail, json, log } = require("../_lib/http");
const auth = require("../_lib/auth");
const tokens = require("../_lib/tokens");
const db = require("../_lib/db");

const TEMPLATES = ["sample1", "sample2"];
const MAX_BATCH = 10;

/** Trim, cap and reject anything that is not a plain short string. Labels are
 *  shown back on the admin page, so they are also the one field a stranger
 *  could use to plant markup — the page renders them with textContent, and
 *  this is the second lock on the same door. */
function shortText(value, max) {
  if (typeof value !== "string") return null;
  /* Escapes, not literal control characters: a literal control character in
     the source is invisible in every editor and survives one careless paste. */
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

module.exports = handler("admin.tokens", async (req, res) => {
  if (!auth.requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const rows = await db.listTokens(200);
    return json(res, 200, { ok: true, tokens: rows || [] });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, "BAD_REQUEST");
  }

  const body = await readJson(req, 8 * 1024);

  /* ── Revoke ───────────────────────────────────────────────────────────
     Only a code that has not published anything can be withdrawn. The filter
     `status=eq.issued` lives in the query itself, so a code that is already
     spent cannot be revoked out from under a customer's live website. */
  if (body && body.action === "revoke") {
    const id = shortText(body.id, 64);
    if (!id) return fail(res, "BAD_REQUEST");

    const rows = await db.revokeToken(id);
    if (!rows || !rows.length) {
      /* Either no such code, or it has already been used. Both mean "there is
         nothing here to withdraw". */
      return fail(res, "NOT_FOUND");
    }
    log("admin.token.revoked", { id });
    return json(res, 200, { ok: true, revoked: rows.length });
  }

  /* ── Mint ─────────────────────────────────────────────────────────────── */
  const label = shortText(body && body.label, 80);
  const notes = shortText(body && body.notes, 300) || null;
  const template = body && body.template;

  if (!label) return fail(res, "BAD_REQUEST");
  if (!TEMPLATES.includes(template)) return fail(res, "BAD_REQUEST");

  const count = Math.min(Math.max(parseInt(body && body.count, 10) || 1, 1), MAX_BATCH);

  const minted = [];
  for (let i = 0; i < count; i++) {
    const code = tokens.generate();
    const row = await db.insertToken({
      tokenHash: tokens.hash(code),
      label: count > 1 ? `${label} (${i + 1}/${count})` : label,
      template,
      notes,
    });
    /* `code` travels in this response and is then forgotten. It is not passed
       to log(), which is why the log line below counts rather than lists. */
    minted.push({ id: row && row.id, label: row && row.label, code });
  }

  log("admin.token.minted", { template, count: minted.length });

  return json(res, 200, { ok: true, minted });
});
