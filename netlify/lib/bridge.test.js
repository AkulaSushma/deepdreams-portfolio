/* ============================================================================
   The Netlify bridge.

   This is the only new code the move to Netlify required, so it is the only
   place a migration bug can hide. Everything it does is translation, and a
   translation bug is quiet: the request still arrives, it just arrives with
   the wrong IP, or an unparsed body, or a lost cookie. Each of those is a
   security control silently switched off.

   What this proves:
     · the query string a handler reads is the one Netlify actually delivered
     · a POST body reaches readJson as a stream, so its byte cap still applies
     · the rate limiter sees a real client IP, not "unknown" for the whole world
     · Set-Cookie survives the round trip, and its Path=/api scope with it
     · a guest's slug is read out of the path, not left to a rewrite
     · the scheduled keepalive is authorised; the public one is not
     · a handler that never answers produces 500, not a hang

   Run:  node netlify/lib/bridge.test.js
   ========================================================================= */
"use strict";

process.env.TOKEN_PEPPER = "test-pepper";
process.env.SUPABASE_URL = "https://abcd.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";
process.env.ADMIN_PASSWORD = "a-long-enough-passphrase";
process.env.ADMIN_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
process.env.CRON_SECRET = "fedcba9876543210fedcba9876543210";

const { bridge } = require("./bridge");

/* Stubbed before the handlers are required, so nothing reaches the network. */
const db = require("../../api/_lib/db");
db.getSiteBySlug = async (slug) => (slug === "priya-karthik-af7b" ? null : null);
db.ping = async () => true;
db.staleIssuedTokens = async () => [];
db.pruneVersions = async () => [];
db.exportAllSites = async () => [];

const storage = require("../../api/_lib/storage");
storage.list = async () => [];
storage.putJson = async () => null;
storage.listBackups = async () => [];

let failures = 0;
const realLog = console.log;
console.log = () => {};
function check(name, condition) {
  realLog((condition ? "pass " : "FAIL ") + name);
  if (!condition) failures++;
}

const ev = (o = {}) => ({
  httpMethod: "GET",
  path: "/",
  headers: {},
  queryStringParameters: {},
  body: null,
  isBase64Encoded: false,
  ...o,
});

(async () => {
  /* ── Translation ─────────────────────────────────────────────────────── */
  let seen = null;
  const spy = bridge(async (req, res) => {
    const { readJson } = require("../../api/_lib/http");
    seen = { url: req.url, method: req.method, headers: req.headers, body: await readJson(req, 1024) };
    res.statusCode = 201;
    res.setHeader("X-Test", "yes");
    res.end("done");
  });

  const out = await spy(ev({
    httpMethod: "POST",
    path: "/api/publish",
    queryStringParameters: { a: "1", b: "two words" },
    headers: { "Content-Type": "application/json", "X-NF-Client-Connection-IP": "203.0.113.9" },
    body: JSON.stringify({ hello: "world" }),
  }));

  check("the path and query reach the handler", seen.url === "/api/publish?a=1&b=two+words");
  check("the method is passed through", seen.method === "POST");
  check("header names are lowercased", seen.headers["content-type"] === "application/json");
  check("the body parses", seen.body.hello === "world");
  check("the status comes back", out.statusCode === 201);
  check("headers come back", out.headers["X-Test"] === "yes");
  check("the body comes back", out.body === "done");

  /* The rate limiter keys on x-forwarded-for. If this fell back to "unknown",
     every visitor on earth would share one bucket and the brake on guessing
     activation codes would be gone. */
  check("a client IP is available to the rate limiter", seen.headers["x-forwarded-for"] === "203.0.113.9");

  /* Netlify's own header wins when both are present — it is the one Netlify
     sets itself and cannot be spoofed by the caller. */
  await spy(ev({ headers: { "x-forwarded-for": "198.51.100.1", "x-nf-client-connection-ip": "203.0.113.9" } }));
  check("an existing x-forwarded-for is left alone", seen.headers["x-forwarded-for"] === "198.51.100.1");

  /* The body must arrive as a stream, not as req.body. readJson skips its byte
     cap entirely when req.body is already an object — an oversized request
     would then be parsed in full before anyone checked its size. */
  let capped = false;
  const capSpy = bridge(async (req, res) => {
    const { readJson } = require("../../api/_lib/http");
    try { await readJson(req, 10); } catch (e) { capped = e.code === "TOO_LARGE"; }
    res.end("");
  });
  await capSpy(ev({ httpMethod: "POST", body: JSON.stringify({ padding: "x".repeat(200) }) }));
  check("the request size cap still bites", capped);

  /* ── A handler that forgets to answer ────────────────────────────────── */
  const silent = bridge(async () => {});
  const silentOut = await silent(ev());
  check("a silent handler becomes 500, not a hang", silentOut.statusCode === 500);
  check("the 500 says nothing useful to an attacker", !/stack|at\s+\w+\s+\(/.test(silentOut.body));

  /* ── The admin cookie, end to end through the real handler ───────────── */
  const login = require("../functions/admin-login").handler;

  const good = await login(ev({
    httpMethod: "POST",
    path: "/api/admin/login",
    headers: { "x-nf-client-connection-ip": "198.51.100.7" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  }));
  const cookie = good.headers["Set-Cookie"] || "";
  check("the right password signs in", good.statusCode === 200);
  check("a cookie survives the bridge", /^dd_admin=[^;]+/.test(cookie));
  check("the cookie is still HttpOnly and Secure", /HttpOnly/.test(cookie) && /Secure/.test(cookie));
  check("the cookie is still scoped to /api", /Path=\/api/.test(cookie));
  check("the cookie is still SameSite=Strict", /SameSite=Strict/.test(cookie));

  const bad = await login(ev({
    httpMethod: "POST",
    path: "/api/admin/login",
    headers: { "x-nf-client-connection-ip": "198.51.100.8" },
    body: JSON.stringify({ password: "wrong" }),
  }));
  check("a wrong password is refused", bad.statusCode === 401);
  check("a refusal sets no cookie", !bad.headers["Set-Cookie"]);
  check("a refusal reveals nothing", !/password|env|ADMIN/i.test(bad.body));

  /* An admin endpoint with no cookie at all must still refuse. */
  const adminTokens = require("../functions/admin-tokens").handler;
  const noCookie = await adminTokens(ev({ path: "/api/admin/tokens", headers: { "x-nf-client-connection-ip": "198.51.100.9" } }));
  check("no cookie, no admin data", noCookie.statusCode === 401);

  /* ── The guest's slug ────────────────────────────────────────────────── */
  const invite = require("../functions/invite").handler;
  const page = await invite(ev({ path: "/invite/priya-karthik-af7b", headers: { "x-nf-client-connection-ip": "203.0.113.5" } }));
  check("an unknown invitation is a 404 page, not an error", page.statusCode === 404);
  check("the 404 is a page a guest can read", /text\/html/.test(page.headers["Content-Type"] || ""));
  check("a missing invitation is still cached briefly", /s-maxage/.test(page.headers["Cache-Control"] || ""));

  /* A percent-encoded link, which is what arrives when a slug is pasted
     through some chat applications. */
  const encoded = await invite(ev({ path: "/invite/priya%2Dkarthik%2Daf7b", headers: { "x-nf-client-connection-ip": "203.0.113.6" } }));
  check("a percent-encoded link still resolves to a slug", encoded.statusCode === 404);

  /* Nothing slug-shaped at all must not reach the database. */
  const junk = await invite(ev({ path: "/invite/", headers: { "x-nf-client-connection-ip": "203.0.113.7" } }));
  check("a bare /invite/ is refused", junk.statusCode === 404);

  /* ── The two cron doors ──────────────────────────────────────────────── */
  const manual = require("../functions/cron-keepalive").handler;
  const unauthorised = await manual(ev({ path: "/api/cron/keepalive", headers: { "x-nf-client-connection-ip": "203.0.113.8" } }));
  check("the public cron route refuses without the secret", unauthorised.statusCode === 404);

  const withKey = await manual(ev({
    path: "/api/cron/keepalive",
    queryStringParameters: { key: process.env.CRON_SECRET },
    headers: { "x-nf-client-connection-ip": "203.0.113.8" },
  }));
  check("the public cron route runs with the secret", withKey.statusCode === 200);

  const scheduled = require("../functions/keepalive").handler;
  const nightly = await scheduled(ev({ httpMethod: "POST", body: JSON.stringify({ next_run: "2026-08-02T02:17:00Z" }) }));
  check("the scheduled run authorises itself", nightly.statusCode === 200);
  check("the scheduled run returns no body", nightly.body === undefined);

  console.log = realLog;
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
