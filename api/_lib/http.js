/* ============================================================================
   HTTP — request/response plumbing shared by every function under /api.

   Everything here exists to satisfy one of four promises made in the plan:
     · a token never reaches a log line, an error message, or a URL
     · a request never hangs; it times out and says so
     · a failing request returns a shape the UI can act on, never a stack trace
     · abuse costs the attacker more than it costs us
   ========================================================================= */
"use strict";

const crypto = require("crypto");

/* Field names whose values must never be written anywhere, at any level of
   nesting. Vercel's function logs are readable in the dashboard; an activation
   token in there is as good as an unpaid invitation. */
const SECRET_KEYS = /^(token|password|secret|key|pepper|apikey|authorization|cookie|service_key|idempotencykey)$/i;

/** Deep-copy a value with every secret-looking field replaced. Used for all
 *  logging. Never log a raw request body — log `redact(body)`. */
function redact(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== "object") return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

/** The only logger the API uses. Anything logged goes through redact(). */
function log(event, detail) {
  try {
    console.log(JSON.stringify({ event, ...redact(detail || {}) }));
  } catch {
    console.log(JSON.stringify({ event }));
  }
}

function json(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  /* Publishing responses are per-customer and must never be cached by a CDN
     or a shared proxy. Public invitation pages set their own header instead. */
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers || {})) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/* Error codes the UI understands. The message is what a customer reads, so it
   is written for a family under wedding-week stress: it says what happened and
   what to do next, and never mentions a database, a token hash or a function.
   `retryable` tells the client whether offering a Retry button is honest. */
const ERRORS = {
  BAD_REQUEST:        { status: 400, message: "Something in that request was not right. Please try again." },
  TOKEN_INVALID:      { status: 400, message: "That activation code was not recognised. Please check it and try again, or send us a message on WhatsApp." },
  TOKEN_USED:         { status: 409, message: "That activation code has already been used for another wedding website. Each code activates one website only." },
  TOKEN_REVOKED:      { status: 403, message: "That activation code is no longer valid. Please contact us on WhatsApp." },
  TOKEN_WRONG_TEMPLATE:{status: 409, message: "That activation code belongs to a different invitation design. Please contact us on WhatsApp." },
  TOO_LARGE:          { status: 413, message: "Your invitation is larger than we can publish. Please remove a few photographs and try again." },
  RATE_LIMITED:       { status: 429, message: "Too many attempts. Please wait a few minutes and try again." },
  UNAUTHORISED:       { status: 401, message: "Not signed in." },
  NOT_FOUND:          { status: 404, message: "Not found." },
  UPSTREAM:           { status: 503, message: "We could not reach our servers just now. Your work is saved on this device — please try again in a moment.", retryable: true },
  SERVER:             { status: 500, message: "Something went wrong at our end. Your work is saved on this device — please try again.", retryable: true },
};

function fail(res, code, extra) {
  const e = ERRORS[code] || ERRORS.SERVER;
  return json(res, e.status, {
    ok: false,
    code,
    message: e.message,
    retryable: !!e.retryable,
    ...(extra || {}),
  });
}

/** Reject anything that is not the expected method. Token traffic is POST-only
 *  so that a token can never land in a query string, a browser history entry,
 *  a Referer header or an access log. */
function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", method);
  fail(res, "BAD_REQUEST");
  return false;
}

/** Read and parse a JSON body with a hard byte cap, so an oversized upload
 *  cannot occupy a function for its whole duration. Vercel usually pre-parses
 *  req.body; this handles both cases. */
async function readJson(req, maxBytes) {
  if (req.body && typeof req.body === "object") return req.body;

  const cap = maxBytes || 1024 * 1024;
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > cap) {
      const err = new Error("TOO_LARGE");
      err.code = "TOO_LARGE";
      throw err;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("BAD_REQUEST");
    err.code = "BAD_REQUEST";
    throw err;
  }
}

/* ── Rate limiting ────────────────────────────────────────────────────────
   In-memory, per warm instance. This is honest about what it is: a brake on
   casual brute-forcing of activation codes, not a distributed rate limiter.
   Serverless instances come and go, so a determined attacker gets more than
   the stated budget. The real defence is token entropy — 75 bits means
   guessing is hopeless regardless — plus the fact that a wrong guess reveals
   nothing. Upgrading this to Postgres-backed counting would add a database
   write per request, which is precisely what the plan forbids on hot paths. */
const buckets = new Map();

function rateLimit(req, name, spec) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const key = `${name}:${ip}`;
  const now = Date.now();

  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + spec.windowMs });
    if (buckets.size > 5000) sweep(now);
    return true;
  }
  b.count += 1;
  return b.count <= spec.limit;
}

function sweep(now) {
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}

/** Constant-time string comparison, for passwords and signatures. A plain
 *  `===` leaks the length of the matching prefix through timing. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Wrap a handler so no unexpected throw ever reaches the customer as a stack
 *  trace, and so every failure is logged in redacted form. */
function handler(name, fn) {
  return async (req, res) => {
    const started = Date.now();
    try {
      await fn(req, res);
    } catch (err) {
      const code = err && err.code && ERRORS[err.code] ? err.code : "SERVER";
      log("api.error", { fn: name, code, message: String(err && err.message) });
      if (!res.headersSent) fail(res, code);
    } finally {
      log("api.done", { fn: name, ms: Date.now() - started, status: res.statusCode });
    }
  };
}

/** The origin every public link is built from. PUBLIC_ORIGIN wins so that
 *  links stay on one canonical domain: the deployment answers on several
 *  hostnames, and a customer must never be handed a preview URL that stops
 *  resolving after the next deployment. The request headers are only a
 *  fallback for local work. */
function publicOrigin(req) {
  const configured = process.env.PUBLIC_ORIGIN;
  if (configured) return configured.replace(/\/+$/, "");

  const host =
    (req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "";
  /* Netlify's edge always sends x-forwarded-proto, so its absence means the
     request arrived directly — local development. There the server speaks
     plain http, and a function's self-fetch of a template over https would
     fail. Only loopback hosts get this treatment: a real deployment host
     keeps https even if a proxy forgot the header. */
  const isLoopback =
    /^(localhost|127\.[\d.]+|\[::1\]|::1|0\.0\.0\.0)(:\d+)?$/.test(host);
  const proto =
    (req && req.headers && req.headers["x-forwarded-proto"]) ||
    (isLoopback ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

module.exports = {
  redact, log, json, fail, ERRORS,
  requireMethod, readJson, rateLimit, safeEqual, handler, publicOrigin,
};
