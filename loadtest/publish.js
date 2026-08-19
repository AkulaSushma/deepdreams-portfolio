/* 10 customers press Publish at the same moment, each with their own code.

   Ten different codes, ten different websites, ten different links. The thing
   that would be quietly catastrophic here is not a slow response — it is two
   couples being handed the same slug, which would mean one family's guests
   opening another family's invitation.

   Every code passed in is SPENT by this run. Mint fresh ones on staging first.

   k6 run -e BASE_URL=… -e CODES="DD-…,DD-…" loadtest/publish.js */

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE, codes, content, jsonHeaders } from "./_shared.js";

const published = new Counter("published_ok");

export const options = {
  scenarios: {
    rush: {
      /* One iteration each, all VUs starting together — a genuine simultaneous
         press, not a steady stream. */
      executor: "per-vu-iterations",
      vus: Math.min(codes.length, 10),
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<5000"],
  },
};

const TEMPLATE = __ENV.TEMPLATE || "sample2";

/* Fixed at init, shared by every VU, so a re-run of this script uses fresh
   idempotency keys while one run's retries would reuse its own. */
const RUN = __ENV.RUN || String(Math.floor(Math.random() * 1e9));

if (!codes.length) throw new Error("Set CODES to one or more unused activation codes.");

export default function () {
  const n = __VU - 1;
  const code = codes[n];
  if (!code) return;

  const res = http.post(
    `${BASE}/api/publish`,
    JSON.stringify({
      token: code,
      idempotencyKey: `loadtest-${RUN}-${n}`,
      template: TEMPLATE,
      content: content(n),
      media: [],
    }),
    { headers: jsonHeaders }
  );

  const body = res.json() || {};

  const ok = check(res, {
    "published": () => res.status === 200 && body.ok === true,
    "a link came back": () => typeof body.url === "string" && body.url.includes("/invite/"),
    "the link carries no code": () => !String(body.url || "").includes(code),
    "no private field in the reply": () =>
      !/token|hash|private/i.test(Object.keys(body).join(",")),
  });

  if (ok) published.add(1);

  /* Recorded per VU so the summary shows every slug. Two identical lines in
     the output is the failure this test exists to catch. */
  console.log(`vu=${__VU} slug=${body.slug || "-"} status=${res.status}`);
}

export function handleSummary(data) {
  const wanted = Math.min(codes.length, 10);
  const got = (data.metrics.published_ok && data.metrics.published_ok.values.count) || 0;
  const verdict = got === wanted
    ? `PASS — ${got}/${wanted} published`
    : `FAIL — ${got}/${wanted} published`;
  return { stdout: `\n${verdict}\nCheck the slug= lines above: no two may match.\n\n` };
}
