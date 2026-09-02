/* ============================================================================
   Assemble the publishable website into dist/.

   Netlify serves the whole publish directory, so "publish the repository root"
   would mean publishing the workshop along with the website: the server code
   under api/, the SQL schema, the load tests, 218 MB of 3D build source, and
   node_modules. None of that holds a secret — every key lives in an
   environment variable — but source that answers requests has no business
   sitting next to the pages it serves, and a 458 MB upload is its own problem.

   This is the Netlify equivalent of .vercelignore, and the two lists are kept
   deliberately alike so a file excluded from one deploy is excluded from both.

   Plain Node with no dependencies, because that is what the rest of this
   project is. Runs the same on Netlify's Linux builders and on a Windows
   machine doing `netlify deploy` by hand.

   node netlify/build.js
   ========================================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

/* Whole folders, matched at any depth by folder name. "api" is dropped here
   even though functions/api/ needs it on Cloudflare: dist/ never contains the
   functions tree at all (see DROP_IN_DIST below) — Cloudflare reads edge
   functions from functions/ at the repository root, not from the build output.
   Anywhere else an "api" directory appears, it is server code that must not
   be uploaded as a downloadable asset. */
const DROP_DIRS = new Set([
  "dist", "node_modules", ".git", ".claude", ".zcode", ".vercel", ".netlify",
  /* Server-side code: it runs as a function, it is never downloaded. */
  "api", "netlify", "supabase", "loadtest",
  /* The editable 3D source and its duplicate build output. What ships is
     "3D Wedding Invitation Sample 2/world/", synced by BUILD-AND-SYNC-WORLD. */
  "3d-world-source",
  /* Retired design and the pre-compression image originals, both kept only so
     the work is reversible. */
  "_previous-design", "_img-originals",
]);

/* Individual files, matched on the name alone. */
const DROP_FILES = new Set([
  "vercel.json", "netlify.toml", "serve.json",
  "_audit.js", "_routecheck.js", "_weight.js", "_optimize-images.js",
  "BUILD-AND-SYNC-WORLD.ps1",
]);

const DROP_PATTERNS = [
  /* Developer notes, handover documents, READMEs — anything in Markdown. None of
     it is part of a wedding website, and it is exactly the kind of file that
     quietly carries an old hostname or a real customer's name into public view.
     Two of these were being served from the live site before this rule existed. */
  /\.md$/i,
  /* A GitHub Pages artefact from a previous host. Meaningless here. */
  /^\.nojekyll$/,
  /^capture-.*\.js$/,
  /^scratch-.*\.js$/,
  /\.log$/,
  /^_shot-.*\.png$/,
  /^_nav-fixed\.png$/,
  /^_phone-fixed\.png$/,
  /^verify-.*\.png$/,
  /* Working scratch files from the og-card pipeline: the base captures and
     intermediate measurements never belong on the CDN. */
  /^_welcome_.*\.(png|ppm|txt|jpg)$/,
  /^_loader_.*\.png$/,
  /^_wb\.png$/,
  /^_welcome_card.*\.png$/,
  /^_welcome_preview\./,
];

function keep(entry, isDir) {
  if (isDir) return !DROP_DIRS.has(entry);
  if (DROP_FILES.has(entry)) return false;
  return !DROP_PATTERNS.some((re) => re.test(entry));
}

/* dist/ is served as static assets only. Cloudflare Pages reads its edge
   functions from functions/ at the REPOSITORY ROOT, never from the build
   output — a functions/ directory inside dist/ would be uploaded as static
   files, and its code would answer no request. So functions/ is excluded
   from dist/ entirely; the same exclusion protects dist/ from recursion. */
const DROP_IN_DIST = new Set(["functions", ...[...DROP_DIRS]]);

function keepInDist(entry, isDir) {
  if (isDir) return !DROP_IN_DIST.has(entry);
  if (DROP_FILES.has(entry)) return false;
  return !DROP_PATTERNS.some((re) => re.test(entry));
}

let files = 0;
let bytes = 0;

function copyDir(from, to, keepFn) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    /* A symlink to a directory reports as a link, not a directory. Following
       one out of the tree is how a build starts copying the whole disk. */
    if (entry.isSymbolicLink()) continue;

    const isDir = entry.isDirectory();
    if (!keepFn(entry.name, isDir)) continue;

    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);

    if (isDir) {
      copyDir(src, dst, keepFn);
    } else {
      fs.copyFileSync(src, dst);
      files += 1;
      bytes += fs.statSync(src).size;
    }
  }
}

fs.rmSync(DIST, { recursive: true, force: true });
copyDir(ROOT, DIST, keepInDist);

/* Mirror the 3D world to dist/world so direct routes (/world/...) always resolve natively */
const worldSrc = path.join(DIST, "3D Wedding Invitation Sample 2", "world");
const worldDst = path.join(DIST, "world");
if (fs.existsSync(worldSrc) && !fs.existsSync(worldDst)) {
  copyDir(worldSrc, worldDst, keep);
}

/* Write route mapping. Two hosts, one file — both read _redirects from the
   build output. Cloudflare Pages runs functions/ (repo root) BEFORE these
   rules, so /api/* and /invite/:slug never appear here: their rules would
   either be shadowed by the function or rewrites to a host-specific internal
   path that does not exist on the other platform. What remains is the set of
   static-to-static aliases both hosts honour identically. */
const redirectsContent = `# Static aliases shared by Cloudflare Pages and Netlify.
# /api/* and /invite/:slug are served by functions/ (Cloudflare) and
# netlify/functions (Netlify config) — never rewritten here.
/world/*        /3D%20Wedding%20Invitation%20Sample%202/world/:splat  200
/world          /3D%20Wedding%20Invitation%20Sample%202/world/index.html  200
/3d%20wedding%20invitation%20sample%202/*  /3D%20Wedding%20Invitation%20Sample%202/:splat 200
/3d-wedding-invitation-sample-2/*  /3D%20Wedding%20Invitation%20Sample%202/:splat 200
/wedding-invite-sample-1/*  /wedding-invite%20sample%201/:splat 200
`;
fs.writeFileSync(path.join(DIST, "_redirects"), redirectsContent, "utf8");

/* Write Cloudflare Pages & Netlify immutable asset headers */
const headersContent = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/world/assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/3D%20Wedding%20Invitation%20Sample%202/assets/*
  Cache-Control: public, max-age=31536000, immutable

/wedding-invite%20sample%201/assets/*
  Cache-Control: public, max-age=31536000, immutable

/posters/*
  Cache-Control: public, max-age=31536000, immutable
`;
fs.writeFileSync(path.join(DIST, "_headers"), headersContent, "utf8");

/* The functions need one thing from outside their own folder: shared/, which
   the browser also loads. It is copied above as part of the site, so the
   editor and the server are guaranteed to be reading the same limits. */
if (!fs.existsSync(path.join(DIST, "shared", "limits.js"))) {
  console.error("shared/limits.js is missing from the build — the editor would run without limits.");
  process.exit(1);
}
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("index.html is missing from the build.");
  process.exit(1);
}

/* A server-code folder inside dist/ is a deployable secret waiting to happen:
   Cloudflare serves everything here as static assets, and Netlify serves
   everything except its own netlify/functions. Fail the build loudly rather
   than publish an api/ or functions/ tree a guest could download. */
for (const leaked of ["api", "functions", "netlify", "supabase"]) {
  if (fs.existsSync(path.join(DIST, leaked))) {
    console.error(`dist/${leaked}/ exists — server code must never ship as static assets.`);
    process.exit(1);
  }
}

console.log(`dist/ built: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
