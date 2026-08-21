/* The link-card renderer.  /3D Wedding Invitation Sample 2/invitation.html?c=…
 *
 * The redirect in netlify.toml only sends requests here when the ?c= design
 * parameter is present; every other request for the invitation page keeps
 * being served straight from the static file. The template is read out of
 * the path here for the same reason invite.js reads the slug out of it: one
 * less thing that has to survive the rewrite.
 */
"use strict";

const { bridge } = require("../lib/bridge");
const card = require("../../api/card");

function templateFromPath(path, event) {
  if (event && event.queryStringParameters && event.queryStringParameters.template) {
    return event.queryStringParameters.template;
  }
  let p = String(path || "");
  try { p = decodeURIComponent(p); } catch { /* keep the raw path */ }
  if (/^\/wedding-invite sample 1\//i.test(p)) return "sample1";
  return "sample2";
}

exports.handler = bridge(card, {
  query: (event) => ({ template: templateFromPath(event.path, event) }),
});
