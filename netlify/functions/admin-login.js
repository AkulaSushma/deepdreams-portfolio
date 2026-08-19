/* POST /api/admin/login — the studio door. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/admin/login.js"));
