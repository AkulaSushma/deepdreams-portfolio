/* ============================================================================
   End-to-end test of the publishing flow with the database and storage
   replaced by in-memory fakes.

   It exists to prove the rules that matter commercially, without a network:

     · a code is not spent by checking it
     · one code publishes exactly one wedding website, ever
     · two simultaneous publishes with one code produce one website
     · a retried publish produces the same link, not a second website
     · a customer cannot publish another customer's photographs
     · nothing private appears in the page a guest receives

   Run:  node api/_lib/flow.test.js
   ========================================================================= */
"use strict";

process.env.TOKEN_PEPPER = "test-pepper";
process.env.SUPABASE_URL = "https://abcd.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";
process.env.PUBLIC_ORIGIN = "https://example.com";

const tokens = require("./tokens");
const db = require("./db");
const storage = require("./storage");

/* ── Fakes ──────────────────────────────────────────────────────────────── */

const store = { tokens: new Map(), sites: new Map(), attempts: new Map(), files: new Set() };

function dbError(code) {
  const e = new Error(code);
  e.dbCode = code;
  return e;
}

db.findToken = async (hash) => store.tokens.get(hash) || null;

db.getSiteBySlug = async (slug) =>
  [...store.sites.values()].find((s) => s.slug === slug && s.status === "live") || null;

/* Mirrors supabase/schema.sql: idempotency replay, then the single UPDATE
   whose WHERE clause is the lock, then the insert. */
db.publishSite = async (a) => {
  const replay = store.attempts.get(a.p_idem);
  if (replay) {
    const s = store.sites.get(replay);
    return { slug: s.slug, siteId: s.id };
  }

  const tok = store.tokens.get(a.p_token_hash);
  if (!tok || tok.status !== "issued" || tok.template !== a.p_template) {
    throw dbError("TOKEN_NOT_AVAILABLE");
  }
  if ([...store.sites.values()].some((s) => s.slug === a.p_slug)) throw dbError("SLUG_TAKEN");

  tok.status = "consumed";
  const id = `site-${store.sites.size + 1}`;
  store.sites.set(id, {
    id, slug: a.p_slug, template: a.p_template, content: a.p_content,
    media: a.p_media, status: "live", wedding_date: a.p_wedding_date,
    updated_at: "2026-08-02T00:00:00Z", private_notes: { phone: "9876543210" },
  });
  tok.site_id = id;
  store.attempts.set(a.p_idem, id);
  return { slug: a.p_slug, siteId: id };
};

db.findSiteByToken = async (hash) => {
  const tok = store.tokens.get(hash);
  if (!tok || tok.status !== "consumed" || !tok.site_id) return null;
  return { slug: store.sites.get(tok.site_id).slug, siteId: tok.site_id };
};

storage.list = async (prefix) =>
  [...store.files].filter((p) => p.startsWith(prefix)).map((p) => ({ name: p.slice(prefix.length) }));
storage.signUpload = async (path) => `https://abcd.supabase.co/upload/${path}?token=signed`;

const TEMPLATE_HTML =
  '<!DOCTYPE html><html><head><title>Demo Couple</title>' +
  '<meta property="og:image" content="https://x/demo.jpg">' +
  '<link rel="stylesheet" href="styles.css"></head><body><a href="#story">s</a></body></html>';

global.fetch = async () => ({ ok: true, status: 200, text: async () => TEMPLATE_HTML });

/* ── Harness ────────────────────────────────────────────────────────────── */

const preflight = require("../publish/preflight");
const publish = require("../publish");
const recover = require("../publish/recover");
const invite = require("../invite");

let ipSeq = 0;
function call(fn, { method = "POST", body, url = "/", ip } = {}) {
  const from = ip || `10.0.0.${++ipSeq % 250}`;
  return new Promise((resolve) => {
    const req = { method, url, headers: { host: "example.com", "x-forwarded-for": from }, body, socket: { remoteAddress: from } };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      get headersSent() { return this.body !== null; },
      end(b) { this.body = b; resolve({ status: this.statusCode, headers: this.headers, text: b, json: parse(b) }); },
    };
    fn(req, res);
  });
}
const parse = (b) => { try { return JSON.parse(b); } catch { return null; } };

let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) { fails++; console.log("FAIL", name, extra === undefined ? "" : extra); }
  else console.log("pass", name);
};

/* ── Fixtures ───────────────────────────────────────────────────────────── */

const codeA = tokens.generate();
const codeB = tokens.generate();
const revoked = tokens.generate();
const wrongTpl = tokens.generate();

store.tokens.set(tokens.hash(codeA), { status: "issued", template: "sample2", site_id: null });
store.tokens.set(tokens.hash(codeB), { status: "issued", template: "sample2", site_id: null });
store.tokens.set(tokens.hash(revoked), { status: "revoked", template: "sample2", site_id: null });
store.tokens.set(tokens.hash(wrongTpl), { status: "issued", template: "sample1", site_id: null });

const sha = (n) => String(n).padStart(64, "e");

/* Sample 2's own shape — a partial override of WEDDING_CONFIG, which is what a
   customer's editor actually submits. `internalOnly` is here to prove the
   allow-list drops anything nobody named. */
const content = {
  couple: { bride: "Priya", groom: "Karthik" },
  wedding: { dateISO: "2026-11-14T11:00:00+05:30", dateDisplay: "Saturday, 14 November 2026" },
  venue: { name: "Taj Krishna", address: "Banjara Hills, Hyderabad" },
  internalOnly: "must not be published",
};

(async () => {
  /* ── preflight ───────────────────────────────────────────────────────── */
  const pf = await call(preflight, {
    body: { token: codeA, template: "sample2", files: [
      { sha256: sha(1), bytes: 90000, type: "image/webp", w: 640, h: 400, variant: 640 },
      { sha256: sha(1), bytes: 90000, type: "image/webp", w: 1280, h: 800, variant: 1280 },
    ] },
  });
  ok("preflight accepts a valid code", pf.status === 200, pf.text);
  ok("preflight signs one url per variant", pf.json.uploads.length === 2);
  ok("upload paths are scoped to this code", pf.json.uploads.every((u) => u.path.startsWith(`sites/${tokens.draftId(tokens.hash(codeA))}/`)));
  ok("preflight does NOT spend the code", store.tokens.get(tokens.hash(codeA)).status === "issued");
  ok("preflight response carries no token", !pf.text.includes(codeA) && !pf.text.includes(tokens.hash(codeA)));
  ok("preflight is POST-only", (await call(preflight, { method: "GET" })).status === 400);

  const paths = pf.json.uploads.map((u) => u.path);
  paths.forEach((p) => store.files.add(p));

  const pf2 = await call(preflight, {
    body: { token: codeA, template: "sample2", files: [
      { sha256: sha(1), bytes: 90000, type: "image/webp", w: 640, h: 400, variant: 640 },
    ] },
  });
  ok("already-uploaded photographs are skipped", pf2.json.skip.length === 1 && pf2.json.uploads.length === 0);

  const pfRevoked = await call(preflight, { body: { token: revoked, template: "sample2", files: [] } });
  ok("revoked code refused", pfRevoked.status === 403 && pfRevoked.json.code === "TOKEN_REVOKED");

  const pfWrong = await call(preflight, { body: { token: wrongTpl, template: "sample2", files: [] } });
  ok("code for the other design refused", pfWrong.json.code === "TOKEN_WRONG_TEMPLATE");

  const pfUnknown = await call(preflight, { body: { token: tokens.generate(), template: "sample2", files: [] } });
  ok("unknown code refused", pfUnknown.json.code === "TOKEN_INVALID");

  const pfBig = await call(preflight, {
    body: { token: codeA, template: "sample2", files: [{ sha256: sha(2), bytes: 900000, type: "image/webp", w: 1, h: 1 }] },
  });
  ok("oversized photograph refused before upload", pfBig.json.code === "TOO_LARGE");

  /* ── publish ─────────────────────────────────────────────────────────── */
  const media = [{ role: "cover", path: paths[0], w: 640, h: 400, sizes: { 640: paths[0], 1280: paths[1] } }];
  const idem = "a".repeat(24);

  const pub = await call(publish, { body: { token: codeA, idempotencyKey: idem, template: "sample2", content, media } });
  ok("publish succeeds", pub.status === 200, pub.text);
  ok("returns a clean public link", /^https:\/\/example\.com\/invite\/priya-karthik-[a-z0-9]{4}$/.test(pub.json.url), pub.json.url);
  ok("link contains no code, id or secret", !pub.json.url.includes(codeA) && !pub.json.url.includes("site-"));
  ok("code is now spent", store.tokens.get(tokens.hash(codeA)).status === "consumed");
  ok("the wedding date is read out of the template's own shape",
     [...store.sites.values()][0].wedding_date === "2026-11-14",
     [...store.sites.values()][0].wedding_date);

  const replay = await call(publish, { body: { token: codeA, idempotencyKey: idem, template: "sample2", content, media } });
  ok("retry returns the same link", replay.json.url === pub.json.url);
  ok("retry creates no second website", store.sites.size === 1);

  /* The rule the entire system exists to enforce. */
  const second = await call(publish, {
    body: { token: codeA, idempotencyKey: "b".repeat(24), template: "sample2",
            content: { couple: { bride: "Anita", groom: "Ravi" } }, media: [] },
  });
  ok("one code cannot publish a SECOND wedding", second.status === 409 && second.json.code === "TOKEN_USED", second.text);
  ok("the first website is untouched",
     store.sites.size === 1 && [...store.sites.values()][0].content.couple.bride === "Priya");
  ok("refusal offers recovery", second.json.recoverable === true);

  /* Concurrency: twenty simultaneous attempts on one unused code. */
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      call(publish, { body: { token: codeB, idempotencyKey: `c${i}`.padEnd(24, "0"), template: "sample2", content, media: [] } })
    )
  );
  ok("20 simultaneous attempts on one code → exactly 1 website",
     results.filter((r) => r.status === 200).length === 1, results.map((r) => r.status).join(","));
  ok("the other 19 are refused cleanly", results.filter((r) => r.json && r.json.code === "TOKEN_USED").length === 19);

  /* Cross-customer path claim. */
  const codeC = tokens.generate();
  store.tokens.set(tokens.hash(codeC), { status: "issued", template: "sample2", site_id: null });
  const theft = await call(publish, {
    body: { token: codeC, idempotencyKey: "d".repeat(24), template: "sample2", content,
            media: [{ path: paths[0] }] },
  });
  ok("cannot publish another customer's photographs", theft.status === 400, theft.text);
  ok("the attempt spent nothing", store.tokens.get(tokens.hash(codeC)).status === "issued");

  const noIdem = await call(publish, { body: { token: codeC, template: "sample2", content, media: [] } });
  ok("missing idempotency key refused", noIdem.status === 400);

  /* ── recover ─────────────────────────────────────────────────────────── */
  const rec = await call(recover, { body: { token: codeA } });
  ok("recover returns the original link", rec.json.url === pub.json.url);

  const recNone = await call(recover, { body: { token: codeC } });
  ok("recover says nothing about an unused code", recNone.status === 404);

  /* ── public page ─────────────────────────────────────────────────────── */
  const slug = pub.json.slug;
  const page = await call(invite, { method: "GET", url: `/api/invite?slug=${slug}` });
  ok("invitation renders", page.status === 200);
  ok("cached at the CDN, not per guest", page.headers["cache-control"] === "public, s-maxage=60, stale-while-revalidate=86400");
  ok("not indexable", page.headers["x-robots-tag"].includes("noindex"));
  ok("shows the real couple, not the demo", page.text.includes("Priya &amp; Karthik") && !page.text.includes("Demo Couple"));
  ok("og:image is the couple's own photograph", page.text.includes('property="og:image" content="https://abcd.supabase.co/storage/v1/object/public/wedding-media/'));
  ok("content is inlined, no second request needed", page.text.includes("window.DD_SITE="));
  ok("no phone number reaches a guest", !page.text.includes("9876543210"));
  ok("no internal field reaches a guest", !page.text.includes("must not be published"));
  ok("no code, hash or database id reaches a guest",
     !page.text.includes(codeA) && !page.text.includes(tokens.hash(codeA)) && !page.text.includes("site-1"));
  ok("template assets resolved absolutely", page.text.includes('href="/3D%20Wedding%20Invitation%20Sample%202/styles.css"'));

  const missing = await call(invite, { method: "GET", url: "/api/invite?slug=nobody-here-1234" });
  ok("unknown link gets a calm 404", missing.status === 404 && missing.text.includes("not valid"));
  ok("404s are cached briefly", missing.headers["cache-control"].includes("s-maxage=300"));

  const bad = await call(invite, { method: "GET", url: "/api/invite?slug=../../etc/passwd" });
  ok("path traversal never reaches the database", bad.status === 404);

  const wasCalled = { v: false };
  const realGet = db.getSiteBySlug;
  db.getSiteBySlug = async () => { wasCalled.v = true; throw Object.assign(new Error("UPSTREAM"), { code: "UPSTREAM" }); };
  const down = await call(invite, { method: "GET", url: `/api/invite?slug=${slug}` });
  db.getSiteBySlug = realGet;
  ok("database down → maintenance card, not a stack trace",
     down.status === 503 && down.text.includes("taking a moment") && !down.text.includes("UPSTREAM"));
  ok("a failure is never cached", down.headers["cache-control"] === "no-store");

  console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed");
  process.exit(fails ? 1 : 0);
})();
