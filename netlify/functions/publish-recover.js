/* POST /api/publish/recover — "I paid, I published, and I have lost my link." */
"use strict";

const { bridge } = require("../lib/bridge");

exports.handler = bridge(require("../../api/publish/recover.js"));
