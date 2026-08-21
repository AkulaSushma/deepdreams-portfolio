---
kind: configuration_system
name: Configuration System — Client Config Files, Platform Bridge, and Serverless Environment Variables
category: configuration_system
scope:
    - '**'
source_files:
    - 3D Wedding Invitation Sample 2/config.js
    - js/config.js
    - shared/hydrate.js
    - api/_lib/db.js
    - api/_lib/http.js
    - netlify/lib/bridge.js
    - vercel.json
    - netlify.toml
---

## What system/approach is used

The repository uses a **multi-layered configuration approach** with no central config framework:

1. **Client-side JSON config files** (`window.*_CONFIG` globals) — the primary mechanism for per-invitation customization.
2. **Serverless environment variables** (`process.env.*`) — for secrets and service endpoints (Supabase, public origin).
3. **Platform deployment configs** (`vercel.json`, `netlify.toml`) — routing, caching headers, scheduled functions, and build settings.
4. **A single bridge abstraction** (`netlify/lib/bridge.js`) that lets the same API handlers run on both Vercel and Netlify without config changes to the handlers themselves.

There are no `.env` files committed to the repo; all runtime secrets are expected to be supplied by the hosting platform's environment variable store.

## Key files and packages

- `3D Wedding Invitation Sample 2/config.js` — The canonical client configuration file for the 3D invitation product. Declares `window.WEDDING_CONFIG` with couple details, events, venue, RSVP, theme, frame assets, films, and scratch-card content. A self-executing block at the bottom merges in overrides from published sites (`window.DD_HYDRATE`), draft links (`?c=...` base64-encoded), or local drafts (`localStorage`).
- `js/config.js` — Configuration for the DeepDreams showcase site, declaring `window.DD_CONFIG` with Google Sheet IDs, hero video, contact info, social links, UPI payment details, and curated portfolio entries.
- `shared/hydrate.js` — Browser runtime that turns server-published content (with image markers like `@m0`) into resolved URLs based on device capabilities, and provides `merge()` / `collectImages()` utilities used by both the editor and the published site.
- `api/_lib/db.js` — Server-side database layer that reads `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from `process.env`. Enforces that these are set via `assertConfigured()`, throwing an error with code `UPSTREAM` if missing.
- `api/_lib/http.js` — Shared HTTP plumbing defining `publicOrigin()` which falls back from `process.env.PUBLIC_ORIGIN` to request headers, plus redaction of secret-looking keys in logs.
- `netlify/lib/bridge.js` — Translates Netlify function events into the `(req, res)` shape the `api/` handlers expect. This is the only place that knows the code runs under Netlify.
- `vercel.json` — Vercel-specific rewrites (`/invite/:slug` → `/api/invite`), cron schedule, and cache-control headers.
- `netlify.toml` — Netlify-specific build command, function directory, route redirects, scheduled function triggers, and security headers.

## Architecture and conventions

### Client configuration pattern
Every wedding invitation product exposes a single global object (`window.WEDDING_CONFIG`, `window.DD_CONFIG`) as its configuration surface. Consumers read from this object directly rather than calling a config loader. The 3D invitation adds a **layering protocol**: a base config in `config.js` is merged with an override from one of three sources, in priority order: (1) published site content via `window.DD_HYDRATE.content()`, (2) URL-encoded design data via `?c=...`, (3) local draft from `localStorage`. Derived fields (hashtag, city, short date) are computed after merge so defaults fill in only when the override omits them.

### Published vs draft vs sample distinction
The 3D invitation's config bootstrap explicitly distinguishes modes: `create.html` skips merging entirely (editor owns state), published pages get server-provided content, draft previews use `?draft` + localStorage, and bare visits render the sample config untouched. A `data-studio-draft` attribute on `<html>` signals creator mode to the UI.

### Server configuration via environment variables
All server secrets live exclusively in `process.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLIC_ORIGIN`. There is no dotenv loading, no config file parsing, and no default values for secrets — `db.js` throws immediately if Supabase credentials are absent. The `publicOrigin()` helper in `http.js` treats `PUBLIC_ORIGIN` as the canonical domain for generated links, falling back to request headers only for local development.

### Platform abstraction
The `api/` handlers are written against Node's native `req`/`res` and know nothing about their host. On Vercel they run directly; on Netlify they are wrapped by `netlify/lib/bridge.js`, which maps Netlify's `event` object into the same shape. Route definitions live in `vercel.json` and `netlify.toml` respectively — the handler code is identical across platforms.

### Deployment-time configuration
Caching behavior is declared per-platform: `vercel.json` sets immutable asset caching (`max-age=31536000, immutable`) and must-revalidate HTML; `netlify.toml` relies on Netlify's defaults but adds security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) and marks `/admin` as `no-store` and `noindex`. Both platforms define the daily keepalive cron at `17 2 * * *` UTC.

## Conventions and constraints

- **No secrets in source.** All sensitive values (Supabase keys, activation tokens, passwords) come from environment variables or are never logged due to the `SECRET_KEYS` regex redaction in `api/_lib/http.js`.
- **Single source of truth per product.** Each product has exactly one `config.js` (or equivalent) that declares its entire configuration surface. Editing that file is the documented way to customize a site.
- **Published content wins over everything.** The 3D invitation's merge logic ensures a guest link never shows a stale draft or sample data — published server content takes highest priority.
- **Image markers, not URLs, travel through the server.** `shared/hydrate.js` stores uploaded photos as `@mN` markers in the database and resolves them to width-appropriate URLs on the client using `devicePixelRatio` and viewport size, avoiding megabytes of redundant bandwidth.
- **Rate limiting is per-instance, in-memory.** `api/_lib/http.js` uses an in-process `Map` keyed by IP for rate limiting, acknowledging it is "a brake on casual brute-forcing" rather than a distributed limiter.
- **Public links are canonicalized.** `publicOrigin()` enforces a single domain for generated invite links, preventing preview URLs from leaking to customers.
- **Admin surfaces are hardened.** Both `vercel.json` and `netlify.toml` add `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` to `/admin` routes.
- **Config schema is enforced by usage, not validation.** There is no schema validator on `WEDDING_CONFIG`; correctness relies on the single-edit-file convention and the editor generating valid JSON.