/* 100 guests open the SAME invitation at once.
   This is the real shape of the traffic: one link is forwarded to a family
   WhatsApp group and everybody taps it within a minute of each other.

   The claim under test is not "the server is fast". It is "100 guests cost the
   database one query", which is what makes the free tier viable at all. So the
   number to read afterwards is the cache-hit rate, not the latency.

   k6 run -e BASE_URL=… -e SLUGS=priya-karthik-af7b loadtest/view-one.js */

import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";
import { BASE, slugs } from "./_shared.js";

const cdnHit = new Rate("cdn_hit");

export const options = {
  scenarios: {
    forward: {
      /* Ramped rather than flat: a forwarded link produces a spike, and a
         spike is where a cold function and an empty cache meet. */
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 100 },
        { duration: "40s", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<800"],
    /* If most guests are not served by the CDN, the design has not worked,
       even if every request succeeded. */
    cdn_hit: ["rate>0.8"],
  },
};

const slug = slugs[0];
if (!slug) throw new Error("Set SLUGS to at least one published slug.");

export default function () {
  const res = http.get(`${BASE}/invite/${slug}`);

  const cache = String(res.headers["X-Vercel-Cache"] || "");
  cdnHit.add(cache === "HIT" || cache === "STALE");

  check(res, {
    "200": (r) => r.status === 200,
    "the couple's own names, not the demo's": (r) => !r.body.includes("Demo Couple"),
    "cached at the edge": (r) => /s-maxage/.test(String(r.headers["Cache-Control"] || "")),
    "nothing private leaked": (r) => !/private_notes|token_hash|"phone"/.test(r.body),
  });
}
