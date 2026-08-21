/* The public invitation page.  /invite/{slug}
 *
 *  The slug is read out of the path here rather than left to the rewrite to
 *  pass along as a query parameter. One less thing that has to be true for a
 *  guest's link to work, and the guest's link is the one URL in this system
 *  that must never break. */
"use strict";

const { bridge } = require("../lib/bridge");
const invite = require("../../api/invite");

function extractSlug(event) {
  if (event && event.queryStringParameters && event.queryStringParameters.slug) {
    return event.queryStringParameters.slug;
  }
  if (event && event.queryStringParameters && event.queryStringParameters.splat) {
    return event.queryStringParameters.splat.replace(/^\/+/, "");
  }
  const sources = [
    event && event.path,
    event && event.rawUrl,
    event && event.headers && (event.headers["x-nf-original-path"] || event.headers["x-original-url"] || event.headers["x-forwarded-uri"] || event.headers["x-rewrite-url"])
  ];
  for (const src of sources) {
    if (!src) continue;
    const m = /\/invite\/([^/?#]+)/i.exec(String(src));
    if (m) {
      try { return decodeURIComponent(m[1]); } catch { return m[1]; }
    }
  }
  return undefined;
}

exports.handler = bridge(invite, {
  query: (event) => ({ slug: extractSlug(event) }),
});
