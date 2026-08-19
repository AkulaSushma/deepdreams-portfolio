/* The nightly housekeeping run.
 *
 *  Netlify scheduled functions are unreachable by URL — there is no public
 *  path to this file at all — so the CRON_SECRET check inside keepalive.js is
 *  not what protects it here. The secret is supplied below purely so that one
 *  handler works unchanged on both platforms and stays testable.
 *
 *  Two Netlify facts shape this:
 *    · 30 seconds, hard. keepalive.js budgets the sweep at 15 s for that
 *      reason and leaves the rest for tomorrow if it runs out.
 *    · Scheduled functions do not return a response body. The status code
 *      still decides whether the run shows as failed, so it is passed through
 *      and the detail goes to the log, where it can actually be read. */
"use strict";

const { bridge } = require("../lib/bridge");
const keepalive = require("../../api/cron/keepalive.js");

const run = bridge(keepalive, {
  headers: () => ({ authorization: `Bearer ${process.env.CRON_SECRET || ""}` }),
});

exports.handler = async (event) => {
  const out = await run(event || { httpMethod: "GET", path: "/", headers: {} });

  /* The body is discarded by Netlify, so it is logged instead — otherwise a
     night when the sweep quietly stopped early would leave no trace. */
  console.log(JSON.stringify({ event: "cron.result", status: out.statusCode, body: out.body }));

  return { statusCode: out.statusCode };
};

/* The schedule itself lives in netlify.toml, not here. Declaring it in code
   would mean installing @netlify/functions, and a repository with no
   package.json and no node_modules is worth more than the convenience.

   It is set to 17 2 * * * — 02:17 UTC, which is 07:47 in India: after any
   wedding-night traffic, before any working morning, and deliberately not on
   the hour, where every free-tier cron job on the platform piles up.
   Netlify reads cron expressions in UTC. */
