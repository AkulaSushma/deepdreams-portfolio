/* 10 photographs uploaded at once — one customer, one code, a full gallery
   going up over a phone connection while the rest of the family waits.

   Two claims under test:

     1. Ten concurrent uploads all succeed.
     2. Not one byte of image data passes through a Vercel Function. The
        signed URLs must point at storage, not at this site — that is what
        makes the 4.5 MB function payload limit irrelevant to how many
        photographs a couple chose, and it is the single easiest thing to
        break by "simplifying" the upload path later.

   This spends nothing: preflight does not consume the code, and the same code
   can be used for this test repeatedly. It does leave files in storage — the
   nightly sweep clears them after DRAFT_TTL_DAYS, or delete the folder by hand.

   k6 run -e BASE_URL=… -e CODE="DD-…" loadtest/upload.js */

import http from "k6/http";
import { check, fail } from "k6";
import { Counter } from "k6/metrics";
import { BASE, jsonHeaders } from "./_shared.js";

const uploaded = new Counter("uploaded_ok");
const throughFunction = new Counter("through_vercel_function");

const PHOTOS = 10;

export const options = {
  scenarios: {
    gallery: {
      executor: "per-vu-iterations",
      vus: PHOTOS,
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: {
    uploaded_ok: [`count==${PHOTOS}`],
    /* The architectural promise, expressed as a number that must stay zero. */
    through_vercel_function: ["count==0"],
    http_req_failed: ["rate==0"],
  },
};

const CODE = __ENV.CODE || "";
if (!CODE) throw new Error("Set CODE to an unused activation code (this test does not spend it).");

const TEMPLATE = __ENV.TEMPLATE || "sample2";

/* 200 KB, just under MAX_PHOTO_BYTES — the size a compressed wedding
   photograph actually lands at after the editor has resized it. */
const BYTES = 200 * 1024;
const PAYLOAD = "x".repeat(BYTES);

/* A plausible content hash. The server only ever uses this as a filename and
   checks it against /^[a-f0-9]{64}$/, so it does not need to be a real digest
   of the bytes — it needs to be unique per file and unique per run, so a
   re-run does not simply reuse the previous run's uploads via the skip list. */
function fakeHash(seed, n) {
  let hex = "";
  while (hex.length < 64) hex += (seed * 2654435761 + n * 40503 + hex.length).toString(16);
  return hex.slice(0, 64).replace(/[^a-f0-9]/g, "0");
}

export function setup() {
  const seed = Number(__ENV.RUN) || Math.floor(Math.random() * 1e9);

  const files = [];
  for (let n = 0; n < PHOTOS; n++) {
    files.push({ sha256: fakeHash(seed, n), bytes: BYTES, type: "image/webp", w: 1280, h: 853, variant: null });
  }

  const res = http.post(
    `${BASE}/api/publish/preflight`,
    JSON.stringify({ token: CODE, template: TEMPLATE, files }),
    { headers: jsonHeaders }
  );

  if (res.status !== 200) fail(`preflight refused: ${res.status} ${res.body}`);

  const body = res.json();
  const uploads = body.uploads || [];
  if (uploads.length !== PHOTOS) {
    fail(`expected ${PHOTOS} upload permissions, got ${uploads.length} (${(body.skip || []).length} already there)`);
  }

  /* Checked once, here, rather than per VU: a permission that grants writing
     anywhere other than this customer's own folder is a whole-test failure,
     not a slow request. */
  for (const u of uploads) {
    if (!/^sites\/[a-f0-9]{24}\//.test(u.path)) fail(`upload path outside a draft folder: ${u.path}`);
    if (u.uploadUrl.startsWith(BASE)) fail("the signed URL points back at the site — uploads would go through a Function");
  }

  return { uploads };
}

export default function (data) {
  const u = data.uploads[__VU - 1];
  if (!u) return;

  if (u.uploadUrl.startsWith(BASE)) throughFunction.add(1);

  const res = http.put(u.uploadUrl, PAYLOAD, {
    headers: { "Content-Type": "image/webp" },
    /* A 200 KB body over a slow link is not a stalled request. */
    timeout: "60s",
  });

  const ok = check(res, {
    "stored": () => res.status === 200,
    "went straight to storage": () => !res.url.startsWith(BASE),
    "the reply carries no key": () => !/service_role|eyJ[A-Za-z0-9_-]{20,}\./.test(String(res.body)),
  });

  if (ok) uploaded.add(1);
}

export function handleSummary(data) {
  const n = (m) => (data.metrics[m] && data.metrics[m].values.count) || 0;
  const good = n("uploaded_ok") === PHOTOS && n("through_vercel_function") === 0;
  return {
    stdout:
      `\nuploaded: ${n("uploaded_ok")}/${PHOTOS}\n` +
      `through a Vercel Function: ${n("through_vercel_function")} (must be 0)\n\n` +
      (good ? "PASS\n\n" : "FAIL\n\n"),
  };
}
