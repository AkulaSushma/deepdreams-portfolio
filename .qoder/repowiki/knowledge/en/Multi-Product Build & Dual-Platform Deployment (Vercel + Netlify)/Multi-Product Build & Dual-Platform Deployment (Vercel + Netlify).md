---
kind: build_system
name: Multi-Product Build & Dual-Platform Deployment (Vercel + Netlify)
category: build_system
scope:
    - '**'
source_files:
    - vercel.json
    - netlify.toml
    - netlify/build.js
    - netlify/lib/bridge.js
    - _deploy-direct.js
    - serve.json
    - 3D Wedding Invitation Sample 2/3d-world-source/package.json
    - 3D Wedding Invitation Sample 2/3d-world-source/vite.config.js
    - 3D Wedding Invitation Sample 2/BUILD-AND-SYNC-WORLD.ps1
---

## What system/approach is used

The repository is a monorepo of several independent wedding-invitation products plus a shared Node.js API. There is no single top-level Makefile or CI pipeline; instead each product and the server layer has its own build configuration, and deployment is configured for two cloud platforms side by side: **Vercel** (`vercel.json`, `.vercelignore`) and **Netlify** (`netlify.toml`, `netlify/build.js`). The 3D world subproject uses **Vite** with Three.js and supports both a normal multi-file `dist/` build and a single self-contained HTML build via `vite-plugin-singlefile`. Static assets are served directly from the repo root.

## Key files and packages

- **Root platform configs**: `vercel.json` (rewrites, cron schedule, per-extension cache headers), `netlify.toml` (build command, function routing, scheduled keepalive, security headers).
- **Netlify build script**: `netlify/build.js` — plain Node copy that assembles `dist/` by excluding server code, source trees, docs, and developer artifacts; it enforces that `shared/limits.js` and `index.html` must be present before publishing.
- **Netlify function bridge**: `netlify/lib/bridge.js` — translates Netlify's `event` shape into the Node `(req, res)` interface the handlers under `api/` expect, so the same handler code runs on Vercel and Netlify without changes.
- **Vercel deploy helper**: `_deploy-direct.js` — writes a temporary `.vercel/.vercelrc.json` and runs `vercel deploy --prod -y --no-wait` against the linked project.
- **3D world build**: `3D Wedding Invitation Sample 2/3d-world-source/package.json` defines `dev`, `build`, `build:single`, `preview`, `preview:single`; `vite.config.js` toggles `viteSingleFile()` based on the `SINGLE=1` env var and outputs to `dist/` or `dist-single/`.
- **World sync script**: `3D Wedding Invitation Sample 2/BUILD-AND-SYNC-WORLD.ps1` — installs deps, runs `npm run build`, then copies `3d-world-source/dist/index.html` and `assets/*` into the invitation's `world/` folder.
- **Local dev server config**: `serve.json` (clean URLs disabled) for local preview.

## Architecture and conventions

### Dual-platform hosting with one codebase
- The `api/` directory contains platform-agnostic Node handlers written against the standard `http` `req`/`res` pair. On Vercel, `vercel.json` rewrites `/invite/:slug` to `/api/invite?slug=:slug` and schedules `/api/cron/keepalive` at `17 2 * * *` UTC.
- On Netlify, `netlify.toml` declares every route explicitly as a rewrite to `/.netlify/functions/<name>` with status 200 (never a redirect) so the admin session cookie scoped to `Path=/api` stays valid. A catch-all `[[redirects]]` from `/api/*` returns 404 to hide unknown endpoints.
- `netlify/lib/bridge.js` is the only place that knows about Netlify's event model; it forwards requests through unchanged `api/` handlers. This isolation was deliberately chosen so moving hosts again costs only rewriting this ~100-line file.

### Build assembly vs. source tree
- The repository root is **not** published verbatim. `netlify/build.js` walks the repo and copies only what belongs in `dist/`, dropping `api/`, `netlify/`, `supabase/`, `loadtest/`, `3d-world-source/`, `_previous-design/`, `_img-originals/`, all `.md` files, log files, screenshot captures, and scratch scripts. The comment explains the rationale: publishing the whole repo would upload server source, SQL schemas, load tests, and 218 MB of 3D build source.
- The build enforces invariants: if `dist/shared/limits.js` or `dist/index.html` is missing after copying, it exits with an error so the editor cannot ship without its limits enforcement.

### 3D world subproject
- Built independently with Vite. Two modes: `npm run build` produces a normal `dist/` bundle for hosting; `npm run build:single` (env `SINGLE=1`) uses `vite-plugin-singlefile` to inline everything into one `dist-single/index.html` (~5.8 MB) that can be emailed and opened locally.
- The built artifact is then synced into the parent invitation's `world/` folder by `BUILD-AND-SYNC-WORLD.ps1`, which also ensures `node_modules` exists before building.

### Caching and headers
- Vercel sets long-lived immutable caching for static assets (`webp|png|jpg|jpeg|gif|svg|ico|mp4|webm|m4a|mp3|woff|woff2` → `max-age=31536000, immutable`), short cache for CSS/JS (`stale-while-revalidate=86400`), and `no-store` for `/admin`.
- Netlify relies on its defaults for static assets and delegates cache-control decisions to the application code (`api/_lib/http.js`'s `json()` helper and `api/invite.js` set their own headers). Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) are declared in both platform configs.

### Local development and testing
- The 3D world uses `npm run dev` / `npm run preview`.
- Load tests live under `loadtest/` (k6 scripts) and are separate from the build/deploy flow.
- Root-level Node scripts (`_audit.js`, `_optimize-images.js`, `_weight.js`, `_routecheck.js`, `capture-*.js`) support image optimization, weight checks, route validation, and screenshot capture but are excluded from production builds.

## Conventions and constraints

- **Handlers are platform-neutral**: every `api/` handler accepts `(req, res)`; platform-specific adapters exist only in `netlify/lib/bridge.js` and the platform config files. No conditional imports inside handlers.
- **Build output is curated, not copied wholesale**: anything not explicitly needed in `dist/` is dropped by `netlify/build.js`. New directories/files intended for the public site must be added to the copy logic; new developer-only files should match existing drop patterns (e.g., `scratch-*`, `capture-*`, `*.log`, `verify-*.png`).
- **Security headers are centralized in platform configs**, not in application code, except for cache-control decisions that belong to the response owner.
- **Admin area is never cached or indexed**: both Vercel and Netlify configs apply `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` to `/admin*`.
- **Cron job is duplicated per platform**: `17 2 * * *` UTC in `vercel.json` and `[functions."keepalive"] schedule = "17 2 * * *"` in `netlify.toml`; the Netlify version is split into a scheduled function (`cron-keepalive`) and a manually callable one (`keepalive`) because Netlify does not expose a URL for scheduled functions.
- **3D world builds are decoupled**: the invitation's `world/` folder is a published artifact, not source. Changes to the 3D scene require running `BUILD-AND-SYNC-WORLD.ps1` from `3D Wedding Invitation Sample 2/` to regenerate and copy the build.
- **No global CI pipeline**: deployments are triggered by pushing to the repo (Vercel auto-deploy) or via `netlify deploy` / the Netlify UI; there is no GitHub Actions, Jenkins, or similar orchestrator in the repo.