---
kind: dependency_management
name: Minimal Node.js Dependency Management with No-Install Serverless Functions
category: dependency_management
scope:
    - '**'
source_files:
    - 3D Wedding Invitation Sample 2/3d-world-source/package.json
    - 3D Wedding Invitation Sample 2/3d-world-source/package-lock.json
    - 3D Wedding Invitation Sample 2/3d-world-source/vite.config.js
    - api/_lib/db.js
    - netlify/functions/keepalive.js
    - netlify.toml
    - vercel.json
---

## What system/approach is used

This repository uses a deliberately minimal, zero-install approach to dependency management. The server API under `api/` and the Netlify bridge under `netlify/functions/` are pure Node.js scripts that rely exclusively on Node's built-in modules (`fetch`, `fs`, `path`, `crypto`, etc.) and **do not declare any dependencies**. There is no `package.json` at the repository root or under `api/`, and no `node_modules` committed — the empty `node_modules/` directory in the tree exists only as a placeholder. This design keeps cold starts short and avoids installing third-party packages on free-tier serverless runtimes.

The only place where third-party dependencies are declared is the standalone 3D world project inside `3D Wedding Invitation Sample 2/3d-world-source/`, which is an independent Vite + Three.js application with its own `package.json`, `package-lock.json`, and `node_modules/`. That subproject is built separately (via `vite build`) into static assets under `3D Wedding Invitation Sample 2/world/` and has no runtime coupling to the rest of the repo.

## Key files and packages

- `3D Wedding Invitation Sample 2/3d-world-source/package.json` — declares runtime dependency `three ^0.169.0` and dev dependencies `vite ^5.4.0`, `vite-plugin-singlefile ^2.3.3`, `cross-env ^10.1.0`.
- `3D Wedding Invitation Sample 2/3d-world-source/package-lock.json` — locks exact versions for reproducible builds of the 3D world.
- `3D Wedding Invitation Sample 2/3d-world-source/vite.config.js` — build configuration for the 3D world bundle.
- `api/_lib/db.js` — explicitly documents the choice to avoid `@supabase/supabase-js` in favor of plain `fetch` against PostgREST, because adding a package would change deployment characteristics.
- `netlify/functions/keepalive.js` — comments state that the schedule lives in `netlify.toml` rather than code so the repository stays free of `package.json` and `node_modules`.
- `netlify.toml` — configures Netlify functions via `esbuild` bundler without requiring a package manifest; schedules the nightly keepalive cron.
- `vercel.json` — configures Vercel rewrites, crons, and cache headers; no dependency declarations needed since Vercel runs the same uninstalled Node scripts.
- `loadtest/_shared.js` — k6 load test scripts use only built-in JavaScript features; no external test framework dependencies.

## Architecture and conventions

1. **Serverless-first, no-install policy**: All API handlers (`api/invite.js`, `api/admin/*`, `api/publish/*`, `api/cron/*`) import only from sibling files under `api/_lib/` using relative paths. They never `require('...')` a third-party module. Secrets come from environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CRON_SECRET`).

2. **Platform abstraction layer**: `netlify/lib/bridge.js` translates Netlify function events into the same `{ httpMethod, path, headers }` shape expected by the shared `api/` handlers, allowing one codebase to run on both Vercel and Netlify without dependency changes.

3. **Isolated frontend build**: The 3D world is a separate npm project with its own lockfile and build pipeline. Its output is baked into static HTML/JS under `3D Wedding Invitation Sample 2/world/` and deployed alongside the rest of the site. It has no runtime link back to the monorepo.

4. **No vendoring**: Dependencies are resolved by the platform's default bundler (esbuild for Netlify, Vercel's Node runtime) at deploy time. Nothing is vendored into the repo except the prebuilt 3D world assets.

5. **External service dependencies are configured via env vars**: Supabase credentials, cron secrets, and base URLs are injected at runtime through platform environment variables — never hardcoded or pulled from a config file checked into version control.

## Conventions and constraints

- **No `package.json` in `api/` or at the repo root** — this is enforced by explicit comments in `api/_lib/db.js` and `netlify/functions/keepalive.js` stating that avoiding a package manifest is intentional to keep deployments lightweight on free tiers.
- **Third-party libraries are avoided unless they provide browser-only functionality** (Three.js in the isolated 3D world). Server-side code uses only Node built-ins.
- **Dependencies are versioned with caret ranges** (`^0.169.0`, `^5.4.0`) in the 3D world's `package.json`, allowing minor/patch updates while pinning major versions.
- **Lockfiles are committed per-subproject**: `3D Wedding Invitation Sample 2/3d-world-source/package-lock.json` ensures reproducible builds of the 3D world; the rest of the repo intentionally has none.
- **Cron schedules live in platform config** (`netlify.toml`, `vercel.json`) rather than in code, precisely to avoid pulling in platform-specific SDKs that would require a `package.json`.
- **Load tests use k6 directly** (invoked as a CLI tool outside the repo) with no Node dependencies, keeping the test harness trivial to run.