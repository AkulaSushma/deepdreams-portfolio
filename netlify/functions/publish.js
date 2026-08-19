/* POST /api/publish — the moment a code becomes a wedding website. */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/publish/index.js"));
