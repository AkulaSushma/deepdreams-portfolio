/* 20 simultaneous publish attempts with ONE activation code.

   This is the commercially important test. Everything else here is about
   speed; this one is about whether a code you were paid once for can produce
   two wedding websites. flow.test.js already proves it against an in-memory
   fake. This proves it against real Postgres, where the `UPDATE … WHERE
   status = 'issued'` is the only lock there is.

   Pass: exactly one 200, and every other reply a clean refusal.

   A note on the refusals. Twenty requests arrive from one machine, so the
   in-memory rate limiter (10 publishes per IP per warm instance) will turn
   some of them away before they ever reach the database. That is not a
   failure — a refusal is a refusal — but it does mean the run proves less than
   it looks. If most of the nineteen come back RATE_LIMITED rather than
   TOKEN_USED, run it again from two or three machines, or raise the publish
   rate limit temporarily on staging only.

   The code passed in is SPENT by this run.

   k6 run -e BASE_URL=… -e CODE="DD-…" loadtest/one-token.js */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { BASE, content, jsonHeaders } from "./_shared.js";

const succeeded = new Counter("publish_success");
const alreadyUsed = new Counter("refused_used");
const rateLimited = new Counter("refused_rate_limited");
const unexpected = new Counter("refused_unexpected");

export const options = {
  scenarios: {
    stampede: {
      executor: "per-vu-iterations",
      vus: 20,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    /* The whole test, in one line. */
    publish_success: ["count==1"],
    /* A 500 means the race was lost inside the database rather than refused
       by it, which is a different and much worse thing than a busy server. */
    unexpected: ["count==0"],
  },
};

const CODE = __ENV.CODE || "";
if (!CODE) throw new Error("Set CODE to a single unused activation code.");

const TEMPLATE = __ENV.TEMPLATE || "sample2";
const RUN = __ENV.RUN || String(Math.floor(Math.random() * 1e9));

export function setup() {
  /* A wall-clock instant every VU can aim at, so the twenty requests land
     together rather than trickling out as k6 spins each VU up. */
  return { fireAt: Date.now() + 5000 };
}

export default function (data) {
  const wait = (data.fireAt - Date.now()) / 1000;
  if (wait > 0) sleep(wait);

  const res = http.post(
    `${BASE}/api/publish`,
    JSON.stringify({
      token: CODE,
      /* Deliberately DIFFERENT per attempt. Identical keys would let
         idempotent replay hand the same website back to several callers and
         the test would pass without the lock doing anything. */
      idempotencyKey: `stampede-${RUN}-${__VU}`,
      template: TEMPLATE,
      content: content(__VU),
      media: [],
    }),
    { headers: jsonHeaders }
  );

  const body = res.json() || {};

  if (res.status === 200 && body.ok === true) {
    succeeded.add(1);
    console.log(`WINNER vu=${__VU} slug=${body.slug}`);
  } else if (res.status === 409 && body.code === "TOKEN_USED") {
    alreadyUsed.add(1);
  } else if (res.status === 429 && body.code === "RATE_LIMITED") {
    rateLimited.add(1);
  } else {
    unexpected.add(1);
    console.log(`UNEXPECTED vu=${__VU} status=${res.status} code=${body.code || "-"}`);
  }

  check(res, {
    "the refusal is readable by a customer": () =>
      res.status === 200 || (typeof body.message === "string" && body.message.length > 10),
    "no refusal leaks the code": () => !String(res.body).includes(CODE),
    "no stack trace": () => !/at\s+\w+\s+\(/.test(String(res.body)),
  });
}

export function handleSummary(data) {
  const n = (m) => (data.metrics[m] && data.metrics[m].values.count) || 0;
  const wins = n("publish_success");

  const lines = [
    "",
    `published:      ${wins}   (must be exactly 1)`,
    `already used:   ${n("refused_used")}`,
    `rate limited:   ${n("refused_rate_limited")}   (refused before the database saw it)`,
    `unexpected:     ${n("refused_unexpected")}   (must be 0)`,
    "",
    wins === 1 && n("refused_unexpected") === 0
      ? "PASS — one code, one website."
      : "FAIL — read the lines above before shipping this.",
    "",
  ];

  if (n("refused_rate_limited") > 12) {
    lines.push(
      "Most attempts never reached the database. The lock was barely tested —",
      "re-run from more than one machine before trusting this result.",
      ""
    );
  }

  return { stdout: lines.join("\n") };
}
