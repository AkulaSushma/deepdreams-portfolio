/* ============================================================================
   POST /api/publish/preflight

   The step before anything is spent. It answers two questions in one round
   trip: is this activation code real, and where may these photographs go?

   It deliberately does NOT consume the code. A customer must be able to check
   the code you sent them, and find out that one photograph is too large, and
   fix it — without the code being gone. Nothing is consumed until
   /api/publish succeeds, and that happens in a single database transaction.

   Body:  { token, template, files: [{ sha256, bytes, type, w, h, variant }] }
   Reply: { ok, uploads: [{ sha256, variant, path, uploadUrl }],
            skip: [{ sha256, variant, path }] }

   The token is in the body, never the URL: a query string would land in
   browser history, in a Referer header and in every access log between here
   and the customer's phone.
   ========================================================================= */
"use strict";

const { handler, requireMethod, readJson, rateLimit, fail, json, log } = require("../_lib/http");
const LIMITS = require("../_lib/limits");
const tokens = require("../_lib/tokens");
const storage = require("../_lib/storage");
const db = require("../_lib/db");

/* One extension per accepted type. The path is built by the server from a
   fixed table — never from anything the browser sends — so a filename can
   never introduce a new extension, a second dot or a directory. */
const EXT = { "image/webp": "webp", "image/jpeg": "jpg" };

module.exports = handler("preflight", async (req, res) => {
  if (!requireMethod(req, res, "POST")) return;

  if (!rateLimit(req, "preflight", LIMITS.RATE.preflight)) return fail(res, "RATE_LIMITED");

  const body = await readJson(req, 64 * 1024);

  const template = LIMITS.checkTemplate(body.template);
  const files = LIMITS.checkFileDescriptors(body.files || []);

  /* Shape first, so an obvious typo costs one cheap answer and no database
     query at all. This is a courtesy, not a security check — whether the code
     is real is decided by the row, below. */
  if (!tokens.looksValid(body.token)) return fail(res, "TOKEN_INVALID");

  const tokenHash = tokens.hash(body.token);
  const row = await db.findToken(tokenHash);

  /* Every refusal below is logged by outcome only. The code itself never
     reaches a log line — Vercel's function logs are readable in a dashboard,
     and an activation code in there is as good as an unpaid invitation. */
  if (!row) {
    log("preflight.refused", { reason: "unknown" });
    return fail(res, "TOKEN_INVALID");
  }
  if (row.status === "revoked") {
    log("preflight.refused", { reason: "revoked" });
    return fail(res, "TOKEN_REVOKED");
  }
  if (row.status === "consumed") {
    /* Already used. If it published a website, say so in a way the UI can act
       on — the honest answer is usually "you already have a link", not "your
       code is wrong". */
    log("preflight.refused", { reason: "consumed" });
    return fail(res, "TOKEN_USED", { recoverable: !!row.site_id });
  }
  if (row.template !== template) {
    log("preflight.refused", { reason: "wrong_template" });
    return fail(res, "TOKEN_WRONG_TEMPLATE");
  }

  /* Where this customer's photographs live — derived from their code, not
     chosen by their browser. That is the whole defence against one customer
     writing over another's photographs, and it costs no extra table.

     The folder is permanent, not a staging area. Uploading straight to the
     final path means there is no post-publish move that can fail and leave a
     published invitation pointing at photographs that are not there yet. It
     is also stable across retries: an interrupted publish re-uses what was
     already uploaded rather than sending it all again over a wedding-week
     mobile connection. */
  const draftId = tokens.draftId(tokenHash);
  const prefix = `sites/${draftId}/`;

  /* What is already there. Saves the customer re-uploading photographs they
     sent on a previous attempt — and saves the storage egress with it. */
  let existing = new Set();
  try {
    const listed = await storage.list(prefix, { limit: 100 });
    existing = new Set(listed.map((o) => o.name));
  } catch (err) {
    /* A listing failure is not fatal: worst case the customer re-uploads. */
    log("preflight.list_failed", {});
  }

  const uploads = [];
  const skip = [];

  for (const f of files) {
    const ext = EXT[f.type];
    const name = f.variant ? `${f.sha256}-${f.variant}.${ext}` : `${f.sha256}.${ext}`;
    const path = prefix + name;

    if (existing.has(name)) {
      skip.push({ sha256: f.sha256, variant: f.variant, path });
      continue;
    }
    uploads.push({
      sha256: f.sha256,
      variant: f.variant,
      path,
      /* A permission to write to exactly this one path, valid for ten
         minutes. Not a key, not a session, and useless for anything else. */
      uploadUrl: await storage.signUpload(path),
    });
  }

  log("preflight.ok", { template, files: files.length, uploads: uploads.length, reused: skip.length });

  return json(res, 200, {
    ok: true,
    uploads,
    skip,
    /* Echoed so the editor can show the same numbers it validated against,
       even if a cached copy of shared/limits.js is out of date. */
    limits: {
      maxPhotos: LIMITS.MAX_PHOTOS,
      maxPhotoBytes: LIMITS.MAX_PHOTO_BYTES,
      maxTotalBytes: LIMITS.MAX_TOTAL_MEDIA_BYTES,
      uploadTtlSeconds: LIMITS.UPLOAD_URL_TTL_SECONDS,
    },
  });
});
