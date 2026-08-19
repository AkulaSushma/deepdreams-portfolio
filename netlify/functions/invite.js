/* The public invitation page.  /invite/{slug}
 *
 *  The slug is read out of the path here rather than left to the rewrite to
 *  pass along as a query parameter. One less thing that has to be true for a
 *  guest's link to work, and the guest's link is the one URL in this system
 *  that must never break. */
"use strict";

const { bridge } = require("../lib/bridge");
const invite = require("../../api/invite");

function slugFromPath(path) {
  const m = /^\/invite\/([^/?#]+)/.exec(String(path || ""));
  if (!m) return undefined;
  /* A guest's link can be pasted anywhere and arrive percent-encoded. The
     handler validates the shape afterwards, so a bad decode is refused, not
     trusted. */
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

exports.handler = bridge(invite, {
  query: (event) => ({ slug: slugFromPath(event.path) }),
});
