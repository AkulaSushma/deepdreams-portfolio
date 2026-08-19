/* ============================================================================
   The studio console, with the database replaced by an in-memory fake.

   What this proves — all of it security, none of it cosmetic:

     · every admin endpoint refuses a request with no session, and says nothing
     · the password is compared server-side and never comes back in a reply
     · the session cookie is HttpOnly, Secure, SameSite=Strict and scoped
     · a minted activation code is returned exactly once and stored only as a
       hash — it never reaches a log line
     · the code list never carries a token hash to a browser
     · a code that has already published cannot be revoked
     · a website's status can only be moved between the two the schema allows

   Run:  node api/_lib/admin.test.js
   ========================================================================= */
"use strict";

process.env.TOKEN_PEPPER = "test-pepper";
process.env.SUPABASE_URL = "https://abcd.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";
process.env.PUBLIC_ORIGIN = "https://example.com";
process.env.ADMIN_PASSWORD = "a-long-enough-studio-password";
process.env.ADMIN_SESSION_SECRET = "0123456789abcdef0123456789abcdef";

const db = require("./db");
const auth = require("./auth");

/* ── Fakes ──────────────────────────────────────────────────────────────── */

const store = { tokens: [], sites: [] };

db.insertToken = async ({ tokenHash, label, template, notes }) => {
  const row = {
    id: `tok-${store.tokens.length + 1}`,
    token_hash: tokenHash, label, template, notes,
    status: "issued", issued_at: "2026-07-31T00:00:00Z", consumed_at: null, site_id: null,
  };
  store.tokens.push(row);
  return row;
};

/* Mirrors db.listTokens' own select list: no token_hash, no notes. */
db.listTokens = async () =>
  store.tokens.map((t) => ({
    id: t.id, label: t.label, template: t.template, status: t.status,
    issued_at: t.issued_at, consumed_at: t.consumed_at, site_id: t.site_id,
  }));

/* Mirrors the `status=eq.issued` filter that lives in the query itself. */
db.revokeToken = async (id) => {
  const t = store.tokens.find((x) => x.id === id && x.status === "issued");
  if (!t) return [];
  t.status = "revoked";
  return [t];
};

db.listSites = async () => store.sites.map((s) => ({ ...s }));
db.getSiteById = async (id) => store.sites.find((s) => s.id === id) || null;
db.listVersions = async () => [{ id: "ver-1", reason: "publish", created_at: "2026-07-31T00:00:00Z" }];

db.setSiteStatus = async (id, status) => {
  const s = store.sites.find((x) => x.id === id);
  if (!s) return [];
  s.status = status;
  return [s];
};

store.sites.push({
  id: "site-1", slug: "priya-karthik-af7b", template: "sample2", status: "live",
  content: { big: "x".repeat(1000) }, media: [],
  wedding_date: "2026-12-01", published_at: "2026-07-30T00:00:00Z",
  updated_at: "2026-07-30T00:00:00Z", private_notes: { phone: "9876543210" },
});

/* ── Harness ────────────────────────────────────────────────────────────── */

const login = require("../admin/login");
const tokensApi = require("../admin/tokens");
const siteApi = require("../admin/site");

let ipSeq = 0;
const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };

function call(fn, { method = "POST", body, url = "/", cookie, ip } = {}) {
  const from = ip || `10.1.0.${++ipSeq % 250}`;
  return new Promise((resolve) => {
    const headers = { host: "example.com", "x-forwarded-for": from };
    if (cookie) headers.cookie = cookie;
    const req = { method, url, headers, body, socket: { remoteAddress: from } };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      get headersSent() { return this.body !== null; },
      end(b) { this.body = b; resolve({ status: this.statusCode, headers: this.headers, text: b, json: parse(b) }); },
    };
    fn(req, res);
  });
}

/* Everything the API logged during one call, so a test can assert that an
   activation code did not appear in it. */
let logLines = [];
const realLog = console.log;
console.log = (line) => { logLines.push(String(line)); };
const flushLogs = () => { const out = logLines.join("\n"); logLines = []; return out; };

let failures = 0;
function check(name, condition) {
  realLog((condition ? "pass " : "FAIL ") + name);
  if (!condition) failures++;
}

const cookieFrom = (res) => {
  const set = res.headers["set-cookie"];
  return set ? set.split(";")[0] : null;
};

(async () => {
  /* ── Locked by default ───────────────────────────────────────────────── */
  const noSession = await call(tokensApi, { method: "GET" });
  check("codes are refused without a session", noSession.status === 401);
  check("the refusal says nothing useful",
    noSession.json.message === "Not signed in." && !("tokens" in noSession.json));

  const noSessionSite = await call(siteApi, { method: "GET" });
  check("websites are refused without a session", noSessionSite.status === 401);

  const forged = await call(tokensApi, { method: "GET", cookie: "dd_admin=not.a.signature" });
  check("a forged cookie is refused", forged.status === 401);

  /* ── Signing in ──────────────────────────────────────────────────────── */
  const wrong = await call(login, { body: { password: "not-the-password" } });
  check("a wrong password is refused", wrong.status === 401);
  check("the reply carries no password", !/not-the-password/.test(wrong.text));
  check("a wrong password sets no cookie", !wrong.headers["set-cookie"]);
  check("the password never reaches a log line", !/not-the-password/.test(flushLogs()));

  const ok = await call(login, { body: { password: process.env.ADMIN_PASSWORD } });
  check("the right password is accepted", ok.status === 200 && ok.json.ok === true);
  check("the reply carries no password", !new RegExp(process.env.ADMIN_PASSWORD).test(ok.text));
  check("the password never reaches a log line",
    !new RegExp(process.env.ADMIN_PASSWORD).test(flushLogs()));

  const setCookie = ok.headers["set-cookie"];
  check("the session cookie cannot be read by JavaScript", /HttpOnly/.test(setCookie));
  check("the session cookie never travels over plain http", /Secure/.test(setCookie));
  check("another site cannot make the browser act as admin", /SameSite=Strict/.test(setCookie));
  check("the cookie is not attached to page or asset requests", /Path=\/api/.test(setCookie));

  const session = cookieFrom(ok);

  /* ── Minting ─────────────────────────────────────────────────────────── */
  const minted = await call(tokensApi, {
    body: { label: "Priya & Karthik", template: "sample2", notes: "UPI ref 4471" },
    cookie: session,
  });
  check("a code is minted", minted.status === 200 && minted.json.minted.length === 1);

  const code = minted.json.minted[0].code;
  check("the code is returned once, in full", /^DD-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(code));
  check("the code never reaches a log line", !new RegExp(code).test(flushLogs()));

  const stored = store.tokens[0];
  check("only a hash is stored", stored.token_hash.length === 64 && !new RegExp(code).test(stored.token_hash));
  check("the plain code is nowhere in the row", !JSON.stringify(stored).includes(code));

  const badTemplate = await call(tokensApi, {
    body: { label: "Someone", template: "sample9" }, cookie: session,
  });
  check("a code for an unknown design is refused", badTemplate.status === 400);
  check("nothing was created", store.tokens.length === 1);

  const noLabel = await call(tokensApi, { body: { template: "sample1" }, cookie: session });
  check("a code with nobody's name on it is refused", noLabel.status === 400);

  /* ── Listing ─────────────────────────────────────────────────────────── */
  const list = await call(tokensApi, { method: "GET", cookie: session });
  check("the list is returned", list.status === 200 && list.json.tokens.length === 1);
  check("no hash travels to the browser", !/token_hash/.test(list.text));
  check("no plain code travels to the browser", !new RegExp(code).test(list.text));

  /* ── Revoking ────────────────────────────────────────────────────────── */
  const revoked = await call(tokensApi, {
    body: { action: "revoke", id: "tok-1" }, cookie: session,
  });
  check("an unused code can be withdrawn", revoked.status === 200 && store.tokens[0].status === "revoked");

  const again = await call(tokensApi, { body: { action: "revoke", id: "tok-1" }, cookie: session });
  check("withdrawing it twice changes nothing", again.status === 404);

  store.tokens.push({ id: "tok-2", status: "consumed", label: "Spent", template: "sample1" });
  const spent = await call(tokensApi, { body: { action: "revoke", id: "tok-2" }, cookie: session });
  check("a code that already paid for a website cannot be withdrawn", spent.status === 404);
  check("that website's code is untouched", store.tokens[1].status === "consumed");

  /* ── Websites ────────────────────────────────────────────────────────── */
  const sites = await call(siteApi, { method: "GET", cookie: session });
  check("published websites are listed", sites.status === 200 && sites.json.sites.length === 1);
  check("each carries its public link", sites.json.sites[0].url === "https://example.com/invite/priya-karthik-af7b");

  const one = await call(siteApi, { method: "GET", url: "/?id=site-1", cookie: session });
  check("one website can be opened", one.status === 200 && one.json.site.slug === "priya-karthik-af7b");
  check("its private note is visible to the studio", one.json.site.privateNotes.phone === "9876543210");
  check("its invitation content is not shipped to the console", !/xxxxx/.test(one.text));
  check("its saved versions are listed", one.json.versions.length === 1);

  const offline = await call(siteApi, {
    body: { action: "status", id: "site-1", status: "disabled" }, cookie: session,
  });
  check("a website can be taken offline", offline.status === 200 && store.sites[0].status === "disabled");

  const stillFound = await call(siteApi, { method: "GET", url: "/?id=site-1", cookie: session });
  check("an offline website can still be opened here", stillFound.status === 200);

  const nonsense = await call(siteApi, {
    body: { action: "status", id: "site-1", status: "deleted" }, cookie: session,
  });
  check("a status the schema does not allow is refused", nonsense.status === 400);
  check("the website is unchanged", store.sites[0].status === "disabled");

  const traversal = await call(siteApi, { method: "GET", url: "/?id=../../etc/passwd", cookie: session });
  check("a path in place of an id is refused", traversal.status === 400);

  /* ── Signing out ─────────────────────────────────────────────────────── */
  const out = await call(login, { body: { action: "logout" } });
  check("signing out clears the cookie", /Max-Age=0/.test(out.headers["set-cookie"]));

  console.log = realLog;
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
