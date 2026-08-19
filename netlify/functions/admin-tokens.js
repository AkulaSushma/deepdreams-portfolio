/* /api/admin/tokens — list, mint, revoke activation codes. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/admin/tokens.js"));
