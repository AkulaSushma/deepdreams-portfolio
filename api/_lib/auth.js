/* ============================================================================
   AUTH — the admin session.

   One person signs in here: you. The password is compared server-side against
   an environment variable and never appears in anything a browser downloads.
   What the browser gets back is a signed cookie it cannot read, cannot forge
   and cannot extend.

   No dependency, no session table, no login rows to grow. An HMAC over
   {subject, expiry} is the whole mechanism: if the signature verifies and the
   expiry is in the future, the request is you.
   ========================================================================= */
"use strict";

const crypto = require("crypto");
const { safeEqual, log } = require("./http");

const COOKIE_NAME = "dd_admin";
const TTL_SECONDS = 8 * 60 * 60;   // one working day, then sign in again

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    const e = new Error("ADMIN_SESSION_SECRET is not set");
    e.code = "UPSTREAM";
    throw e;
  }
  return s;
}

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify(value) {
  if (typeof value !== "string" || value.length > 500) return null;
  const dot = value.indexOf(".");
  if (dot < 1) return null;

  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = b64u(crypto.createHmac("sha256", secret()).update(body).digest());

  /* Constant-time: a plain === would leak how much of a forged signature was
     correct, one byte at a time. */
  if (!safeEqual(sig, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || payload.sub !== "admin") return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/** Check the password. Deliberately the only place in the codebase that reads
 *  ADMIN_PASSWORD, and it never returns or logs the value. */
function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8) {
    log("admin.misconfigured", {});
    return false;
  }
  if (typeof candidate !== "string" || candidate.length > 200) return false;
  return safeEqual(candidate, expected);
}

/* HttpOnly    — JavaScript cannot read it, so a script injection cannot steal it
   Secure      — never sent over plain HTTP
   SameSite    — Strict: another site cannot make your browser act as admin
   Path=/api   — the cookie is not attached to ordinary page or asset requests */
function cookieHeader(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/api",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function issue(res) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  res.setHeader("Set-Cookie", cookieHeader(sign({ sub: "admin", exp }), TTL_SECONDS));
}

function clear(res) {
  res.setHeader("Set-Cookie", cookieHeader("", 0));
}

function readCookie(req) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

/** Guard for every admin endpoint. Returns true only for a valid, unexpired
 *  session; otherwise it has already answered 401 and the caller must stop. */
function requireAdmin(req, res) {
  const session = verify(readCookie(req));
  if (session) return true;
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: false, code: "UNAUTHORISED", message: "Not signed in." }));
  return false;
}

module.exports = { COOKIE_NAME, checkPassword, issue, clear, requireAdmin, verify, readCookie };
