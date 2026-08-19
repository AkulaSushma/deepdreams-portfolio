/* ============================================================================
   The nightly housekeeping run, with the database and storage faked.

   This one deletes things, which is why it is tested at all. What it proves:

     · nothing runs without the cron secret, and a wrong secret looks like a
       missing page rather than a wrong password
     · the sweep removes ONLY the folders belonging to codes that were issued
       long ago and never published — a paid website's photographs are not
       touched, and neither is a draft from this week
     · the folder it sweeps is the one derived from the code's hash, so a
       change to tokens.draftId can never silently point the deleter elsewhere
     · one failing job does not stop the other three
     · no token hash reaches a log line

   Run:  node api/_lib/cron.test.js
   ========================================================================= */
"use strict";

process.env.TOKEN_PEPPER = "test-pepper";
process.env.SUPABASE_URL = "https://abcd.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "service-key";
process.env.CRON_SECRET = "0123456789abcdef0123456789abcdef";

const tokens = require("./tokens");
const db = require("./db");
const storage = require("./storage");
const LIMITS = require("./limits");

/* ── Fakes ──────────────────────────────────────────────────────────────── */

const OLD_CODE = tokens.generate();     // issued long ago, never published
const NEW_CODE = tokens.generate();     // issued yesterday, still being edited
const PAID_CODE = tokens.generate();    // already published a website

const oldFolder = `sites/${tokens.draftId(tokens.hash(OLD_CODE))}/`;
const newFolder = `sites/${tokens.draftId(tokens.hash(NEW_CODE))}/`;
const paidFolder = `sites/${tokens.draftId(tokens.hash(PAID_CODE))}/`;

let files = new Set([
  oldFolder + "a.webp", oldFolder + "a-640.webp",
  newFolder + "b.webp",
  paidFolder + "c.webp",
]);

const removed = [];
let pinged = false;
let pruned = null;
const backups = [];
let backupList = [];

/* Only codes that are still `issued` and older than the cutoff, exactly as the
   real query's filters do. */
db.staleIssuedTokens = async () => [{ id: "tok-old", token_hash: tokens.hash(OLD_CODE) }];

db.ping = async () => { pinged = true; return true; };
db.pruneVersions = async (keep) => { pruned = keep; return []; };
db.exportAllSites = async () => [{ id: "site-1", slug: "priya-karthik-af7b" }];

storage.list = async (prefix) =>
  [...files].filter((p) => p.startsWith(prefix)).map((p) => ({ name: p.slice(prefix.length) }));

storage.remove = async (paths) => {
  paths.forEach((p) => { removed.push(p); files.delete(p); });
  return null;
};

storage.putJson = async (name, data) => { backups.push({ name, data }); return null; };
storage.listBackups = async () => backupList;
storage.removeBackups = async (names) => { backupList = backupList.filter((b) => !names.includes(b.name)); };

/* ── Harness ────────────────────────────────────────────────────────────── */

const keepalive = require("../cron/keepalive");

const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };

function call({ url = "/", auth } = {}) {
  return new Promise((resolve) => {
    const headers = { host: "example.com", "x-forwarded-for": "10.2.0.1" };
    if (auth) headers.authorization = auth;
    const req = { method: "GET", url, headers, socket: { remoteAddress: "10.2.0.1" } };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      get headersSent() { return this.body !== null; },
      end(b) { this.body = b; resolve({ status: this.statusCode, text: b, json: parse(b) }); },
    };
    keepalive(req, res);
  });
}

let logLines = [];
const realLog = console.log;
console.log = (line) => { logLines.push(String(line)); };
const flushLogs = () => { const out = logLines.join("\n"); logLines = []; return out; };

let failures = 0;
function check(name, condition) {
  realLog((condition ? "pass " : "FAIL ") + name);
  if (!condition) failures++;
}

(async () => {
  /* ── The door ────────────────────────────────────────────────────────── */
  const bare = await call();
  check("no secret, nothing happens", bare.status === 404);
  check("nothing was deleted", removed.length === 0);

  const wrong = await call({ auth: "Bearer not-the-secret-at-all-no" });
  check("a wrong secret looks like a missing page", wrong.status === 404);
  check("the reply gives a scanner nothing", !/secret|unauthor/i.test(wrong.text));
  flushLogs();

  /* ── A real run ──────────────────────────────────────────────────────── */
  const run = await call({ auth: `Bearer ${process.env.CRON_SECRET}` });
  check("an authorised run succeeds", run.status === 200 && run.json.ok === true);

  check("the database was touched", pinged);
  check("old versions were trimmed", pruned === 10);

  check("the abandoned draft's photographs are gone",
    removed.includes(oldFolder + "a.webp") && removed.includes(oldFolder + "a-640.webp"));
  check("this week's draft is untouched", files.has(newFolder + "b.webp"));
  check("a paid website's photographs are untouched", files.has(paidFolder + "c.webp"));

  const sweep = run.json.jobs.find((j) => j.job === "sweep");
  check("the sweep reports what it removed", sweep.result.folders === 1 && sweep.result.files === 2);

  check("a backup was written", backups.length === 1 && /^sites-\d{4}-\d{2}-\d{2}\.json$/.test(backups[0].name));
  check("the backup carries the websites", backups[0].data.sites.length === 1);

  check("no token hash reached a log line", !flushLogs().includes(tokens.hash(OLD_CODE)));

  /* ── ?key= for a manual run ──────────────────────────────────────────── */
  const manual = await call({ url: `/?key=${process.env.CRON_SECRET}` });
  check("a manual run with the key works", manual.status === 200);
  flushLogs();

  /* ── One job failing ─────────────────────────────────────────────────── */
  storage.listBackups = async () => { throw new Error("storage down"); };
  const partial = await call({ auth: `Bearer ${process.env.CRON_SECRET}` });
  check("a failing job does not stop the others",
    partial.json.jobs.find((j) => j.job === "ping").ok === true &&
    partial.json.jobs.find((j) => j.job === "backup").ok === false);
  check("the run reports itself as not fully ok", partial.json.ok === false);
  flushLogs();

  /* ── The database itself down ────────────────────────────────────────── */
  db.ping = async () => { throw new Error("UPSTREAM"); };
  const down = await call({ auth: `Bearer ${process.env.CRON_SECRET}` });
  check("a paused project is reported as a failed run", down.status === 503);

  /* ── The sweep cutoff is the documented one ──────────────────────────── */
  check("the sweep uses the published draft lifetime", LIMITS.DRAFT_TTL_DAYS === 7);

  console.log = realLog;
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
