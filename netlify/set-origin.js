/* ============================================================================
   Point the site at a new address.

   A handful of tags cannot be relative — WhatsApp, Facebook and Google all
   refuse a relative og:image, a relative canonical and a relative sitemap
   entry. Those are the only absolute URLs left in this repository, and this
   script rewrites all of them in one go.

   Run it once when the site moves: from Vercel to Netlify now, and from
   netlify.app to your own domain later.

       node netlify/set-origin.js                              # show what would change
       node netlify/set-origin.js https://deepdreams.netlify.app --write

   Then set PUBLIC_ORIGIN to the same value in Netlify's environment variables.
   The two must agree: this script fixes what is baked into the HTML, and
   PUBLIC_ORIGIN fixes what the server generates for each customer link.

   What this does NOT touch, deliberately: any invitation already published.
   Those live in the database and are rendered against PUBLIC_ORIGIN at request
   time, so they follow the environment variable, not this file.
   ========================================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* Every hostname this site has ever answered on. A move adds to this list; it
   never replaces it, because a file missed during one move must still be
   findable during the next. */
const OLD = /https:\/\/(?:deepdreams-portfolio(?:-lac)?\.vercel\.app|[a-z0-9-]+\.netlify\.app)/g;

/* Named rather than globbed. A glob would eventually sweep up node_modules, a
   backup copy, or the 3D build source, and rewriting a URL inside 218 MB of
   generated output is not a thing anyone wants to explain later. */
const FILES = [
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "3D Wedding Invitation Sample 2/index.html",
  "3D Wedding Invitation Sample 2/invitation.html",
  "wedding-invite sample 1/index.html",
  "wedding-invite sample 1/invite.html",
];

const origin = (process.argv[2] || "").replace(/\/+$/, "");
const write = process.argv.includes("--write");

if (origin && !/^https:\/\/[a-z0-9.-]+$/i.test(origin)) {
  console.error(`Not a plain https origin: ${origin}`);
  console.error("Expected something like https://deepdreams.netlify.app — no path, no trailing slash.");
  process.exit(1);
}

let total = 0;
let touched = 0;

for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;

  const before = fs.readFileSync(file, "utf8");
  const hits = before.match(OLD);
  if (!hits) continue;

  total += hits.length;
  touched += 1;

  const unique = [...new Set(hits)];
  console.log(`${String(hits.length).padStart(3)}  ${rel}   ${unique.join(", ")}`);

  if (origin && write) fs.writeFileSync(file, before.replace(OLD, origin));
}

if (!total) {
  console.log("Nothing to change — no absolute origins left in the tracked files.");
  process.exit(0);
}

console.log(`\n${total} occurrence(s) in ${touched} file(s).`);

if (!origin) {
  console.log("Pass the new origin to rewrite them, e.g.:");
  console.log("  node netlify/set-origin.js https://deepdreams.netlify.app --write");
} else if (!write) {
  console.log(`Dry run. Add --write to replace them all with ${origin}`);
} else {
  console.log(`Rewritten to ${origin}`);
  console.log("Now set PUBLIC_ORIGIN to the same value in Netlify, or customer links will still point at the old host.");
}
