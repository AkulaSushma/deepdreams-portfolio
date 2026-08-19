/* 100 guests across 100 DIFFERENT invitations.

   The opposite of view-one.js, and the worst case for the free tier: every
   request is a different cache key, so the CDN can help far less and the
   database sees close to one query per visitor. This is what a Saturday in
   November looks like once there are a hundred customers.

   Slower than view-one is expected and fine. What is NOT fine is errors, or a
   p95 that drifts past a second and a half — that would mean Supabase's
   connection pool, not the cache, is the ceiling.

   k6 run -e BASE_URL=… -e SLUGS="a,b,c,…" loadtest/view-many.js */

import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";
import { BASE, slugs } from "./_shared.js";

const cdnHit = new Rate("cdn_hit");

export const options = {
  scenarios: {
    saturday: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 100 },
        { duration: "60s", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<1500"],
    /* No threshold on cdn_hit here — with 100 distinct URLs a low hit rate is
       the honest expectation, not a failure. It is recorded so the two runs
       can be compared, which is the whole point of having both scripts. */
  },
};

if (slugs.length < 2) {
  throw new Error("Set SLUGS to several published slugs — this test is about cache misses.");
}

export default function () {
  /* Spread deterministically rather than randomly, so every invitation gets
     roughly the same traffic and one unlucky slug cannot skew the p95. */
  const slug = slugs[(__VU + __ITER) % slugs.length];
  const res = http.get(`${BASE}/invite/${slug}`);

  const cache = String(res.headers["X-Vercel-Cache"] || "");
  cdnHit.add(cache === "HIT" || cache === "STALE");

  check(res, {
    "200": (r) => r.status === 200,
    "the right invitation came back": (r) => r.body.includes(slug),
    "nothing private leaked": (r) => !/private_notes|token_hash|"phone"/.test(r.body),
  });
}
