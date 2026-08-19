/* /api/admin/site — list websites, take one offline, roll one back. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/admin/site.js"));
