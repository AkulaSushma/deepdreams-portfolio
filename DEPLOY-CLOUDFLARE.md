# Deploying to Cloudflare Pages — the complete, verified procedure

The Pages project `deepdreams-portfolio` (deepdreams-portfolio.pages.dev) is a
**Direct Upload** project: it is NOT connected to GitHub (the repository has no
Cloudflare webhook and no Cloudflare Pages GitHub App installation), so pushing
to `main` does **not** deploy. Each release is an upload, by hand, from this
machine. This file is that procedure, including everything that must also be
set once in the dashboard.

## 0. One-time dashboard settings (do these first)

These are settings of the Pages project, not files. They survive every future
upload, so they only need doing once — but the Functions will not work without
all of them.

### Settings → Functions → Compatibility flags

| Setting | Value | Why |
|---|---|---|
| Compatibility date | `2025-01-01` (anything ≥ 2024-09-23) | The functions use `require("crypto")`. Bare Node built-in specifiers only resolve from that date. Below it, the deploy fails with "Could not resolve 'crypto'". |
| Compatibility flag | `nodejs_compat` | Required for Node built-ins (`crypto`, `Buffer`) inside the Workers runtime. |

`wrangler.jsonc` in the repo root now pins both, and Cloudflare reads it during
wrangler-based deploys — but for Direct Upload **they must ALSO be set in the
dashboard**, because a drag-and-drop upload does not read the repo.

### Settings → Environment variables (Production)

| Name | Notes |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (`https://xxx.supabase.co`). |
| `SUPABASE_SERVICE_KEY` | The **service_role** key. Server-side only; never in any browser file. |
| `TOKEN_PEPPER` | Any long random string. ⚠️ Once set, do not change: every minted activation code is hashed with it, and a new pepper invalidates every unspent code. |
| `ADMIN_PASSWORD` | The studio admin password (≥ 8 chars). |
| `ADMIN_SESSION_SECRET` | **Required, and missing from the original setup list.** Any random string ≥ 16 chars. Without it, admin login returns an error: the session cookie is an HMAC signed with this value. |

All five must be set for the full publish flow to work. If any is missing, the
affected endpoint returns the calm "We could not reach our servers" style
message — never a stack trace.

## 1. Build the site

From the repository root:

```bash
node netlify/build.js
```

This assembles `dist/` — the static website only. It deliberately excludes:

- `api/`, `netlify/`, `supabase/`, `loadtest/` — server code and internal files
- `functions/` — Cloudflare reads Functions from the **repo root**, never from
  the build output; a functions tree inside dist/ would ship as dead static files
- every `*.md`, screenshot, capture script and dev scratch file

The build **fails loudly** if `api/`, `functions/`, `netlify/` or `supabase/`
somehow reappear in `dist/`, so server code can never ship as a downloadable
asset.

It also writes `dist/_headers` (immutable caching for `/world/assets/*` etc.)
and `dist/_redirects` (the static aliases — `/world/*`, the lowercase template
aliases). `/api/*`, `/invite/:slug` and `share.html` are NOT in `_redirects`:
Functions run before redirects on Cloudflare, and those routes ARE Functions.

## 2. Upload

Option A — dashboard (what was used before):

1. Cloudflare dashboard → Workers & Pages → `deepdreams-portfolio` →
   **Create deployment** (drag and drop).
2. Drop the **contents of `dist/`** — select the files and folders *inside*
   dist, not the dist folder itself (the folder name would become part of the
   URL paths).
3. Wait for the deployment to finish. Direct Upload deployments replace the
   whole site atomically.

Option B — wrangler CLI (recommended once authenticated):

```bash
npx wrangler login        # once; browser opens
npx wrangler pages deploy dist --project-name=deepdreams-portfolio
```

Wrangler reads `wrangler.jsonc` and applies the compatibility settings itself,
which makes it the safer option for the Functions. Note: `wrangler login`
authenticates the CLI but **does not** connect the project to git — this
project stays Direct Upload either way.

## 3. Verify after every deploy

Each command and what it proves:

```bash
BASE=https://deepdreams-portfolio.pages.dev

# 1. Functions are mounted and the bridge works (expect 401 Not signed in — NOT 405)
curl -i -X POST -H "Content-Type: application/json" -d '{}' "$BASE/api/admin/login"

# 2. Wrong password is refused (expect 401)
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"password":"wrong"}' "$BASE/api/admin/login"

# 3. Right password (expect 200 + Set-Cookie dd_admin=… HttpOnly Path=/api)
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"password":"<ADMIN_PASSWORD>"}' "$BASE/api/admin/login"

# 4. Fake activation code — proves Supabase + TOKEN_PEPPER are wired
#    (expect 400 TOKEN_INVALID, and a DB lookup happened)
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"token":"DD-XXXXX-YYYYY-ZZZZZ","idempotencyKey":"verify-1","template":"sample2","content":{"couple":{"bride":"A","groom":"B"}}}' \
  "$BASE/api/publish"

# 5. Unknown slug is served BY THE FUNCTION, not the static 404
#    (expect the function's 404: X-Robots-Tag + Cache-Control: public, s-maxage=300)
curl -sI "$BASE/invite/does-not-exist-abcd" | grep -i "x-robots-tag\|cache-control"

# 6. The 3D world mirror (expect 200 both)
curl -sI "$BASE/world/"  | head -1
curl -sI "$BASE/world/assets/index-yBOXTbMw.js" | head -1

# 7. Immutable caching applied (expect Cache-Control: … immutable)
curl -sI "$BASE/world/assets/index-yBOXTbMw.js" | grep -i cache-control

# 8. share.html SSR link card is a Function (expect 404 with X-Robots-Tag
#    when ?c= is absent — proving the route reached the card handler)
curl -sI "$BASE/3D%20Wedding%20Invitation%20Sample%202/share.html" | grep -i "x-robots-tag"
```

The single most telling check is #1: **405 means the deployment contains no
Functions at all** (static assets reject POST) — that is exactly what the
broken deploy showed.

## 4. What a 405 from /api/* means

Cloudflare Pages answers `405 Method Not Allowed` (empty body) when a POST hits
a path that has only a static asset — i.e. **no Function was mounted for that
route**. If it reappears after a deploy:

- Was `functions/` present at the **repo root** when you uploaded? (Direct
  upload of `dist/` alone does not carry Functions — see Option B note.)
- Dashboard → Functions: is the compatibility date ≥ 2024-09-23 with
  `nodejs_compat`, or does the deploy log show "Could not resolve 'crypto'"?

## 5. After the dashboard settings are applied

Re-deploy once (any upload re-triggers). Env vars and compatibility flags are
read per deploy, so a Functions upload made before setting them needs one more
upload to pick them up.
