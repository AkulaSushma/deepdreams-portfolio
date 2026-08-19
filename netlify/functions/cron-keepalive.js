/* GET /api/cron/keepalive — the same housekeeping run, by hand.
 *
 *  Deliberately a separate function from keepalive.js. That one is scheduled
 *  and supplies its own authorisation because Netlify will not let anything
 *  reach it. This one is on a public path, so it supplies nothing and the
 *  CRON_SECRET check in the handler is the only way in. Without the secret it
 *  answers 404.
 *
 *  Kept because the scheduled run cannot be watched: it returns no body, and
 *  when something looks wrong you want to run it once yourself and read the
 *  reply. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/cron/keepalive.js"));
