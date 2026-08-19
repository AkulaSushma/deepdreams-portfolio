/* POST /api/publish/preflight — check the code, hand out upload permissions.
   Consumes nothing. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/publish/preflight.js"));
