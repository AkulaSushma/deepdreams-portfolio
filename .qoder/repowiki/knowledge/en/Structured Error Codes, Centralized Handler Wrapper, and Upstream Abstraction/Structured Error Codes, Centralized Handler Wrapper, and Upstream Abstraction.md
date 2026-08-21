---
kind: error_handling
name: Structured Error Codes, Centralized Handler Wrapper, and Upstream Abstraction
category: error_handling
scope:
    - '**'
source_files:
    - api/_lib/http.js
    - api/_lib/db.js
    - api/_lib/storage.js
    - api/_lib/auth.js
    - api/_lib/limits.js
    - api/_lib/render.js
    - api/publish/index.js
    - api/invite.js
---

## What system/approach is used

The server API (Node.js functions under `api/`) uses a **centralized error model** built around three pillars:

1. **Named error codes** — a single `ERRORS` map in `api/_lib/http.js` defines every user-facing failure (`BAD_REQUEST`, `TOKEN_INVALID`, `TOKEN_USED`, `TOKEN_REVOKED`, `TOKEN_WRONG_TEMPLATE`, `TOO_LARGE`, `RATE_LIMITED`, `UNAUTHORISED`, `NOT_FOUND`, `UPSTREAM`, `SERVER`). Each entry carries an HTTP status, a customer-readable message, and an optional `retryable` flag that the UI uses to decide whether to show a Retry button.
2. **A uniform handler wrapper** — every exported function is wrapped with `handler(name, fn)` from `http.js`. It catches any thrown error, maps it back to a code via `err.code`, logs it through a redacting logger, and writes a JSON response via `fail(res, code)`. If no code is attached, it falls back to `SERVER`.
3. **Upstream abstraction layers** — `db.js` and `storage.js` translate network failures, timeouts, and non-OK responses into `Error`s tagged with `code = "UPSTREAM"` (or `"BAD_REQUEST"` for invalid input). Database RPCs can also raise sentinel strings like `TOKEN_NOT_AVAILABLE` or `SLUG_TAKEN`; `db.request()` wraps those as `err.dbCode` so callers can branch on them while still surfacing a generic upstream error to the user.

There is **no custom error class hierarchy**, no `try/catch` chains per handler, and no use of `throw new Error("...")` without `.code = ...`. Errors are propagated as thrown objects carrying a string `code` field; presentation is always delegated to `fail()` / `json()`.

## Key files and packages

| File | Role |
|---|---|
| `api/_lib/http.js` | Central error registry (`ERRORS`), `fail()`, `handler()` wrapper, `readJson()` size cap, `requireMethod()`, rate limiter, secret-redacting logger, `publicOrigin()` |
| `api/_lib/db.js` | PostgREST client; converts fetch/network errors → `UPSTREAM`; forwards database sentinel codes (`TOKEN_NOT_AVAILABLE`, `SLUG_TAKEN`) as `err.dbCode` |
| `api/_lib/storage.js` | Supabase Storage client; validates paths via `assertSafePath()` → `BAD_REQUEST`; all I/O errors become `UPSTREAM` |
| `api/_lib/auth.js` | Admin session HMAC verification; misconfiguration throws `UPSTREAM`; missing cookie returns `UNAUTHORISED` inline |
| `api/_lib/limits.js` | Input validators that throw typed `Error`s with `code = "BAD_REQUEST"` or `"TOO_LARGE"` (e.g. `CONTENT_SHAPE`, `FILES_SHAPE`, `PHOTO_TOO_LARGE`, `MEDIA_PATH_OUTSIDE_DRAFT`) |
| `api/_lib/render.js` | Produces human-friendly HTML error pages: `notFoundPage()` and `maintenancePage()` — deliberately never mention databases or errors |
| `api/publish/index.js` | Orchestrates publish flow; branches on `err.dbCode === "SLUG_TAKEN"` to retry slug generation, and on `TOKEN_NOT_AVAILABLE` to distinguish revoked/wrong-template/consumed tokens |
| `api/invite.js` | Public page handler; catches DB/template fetch failures and returns a maintenance card instead of leaking stack traces |

## Architecture and conventions

### Error propagation pattern
- Handlers **throw** `Error` objects whose `message` is one of the keys in `ERRORS` (or a domain sentinel like `TOKEN_NOT_AVAILABLE`) and whose `code` property is set explicitly.
- The `handler()` wrapper is the only place that converts those into HTTP responses. Callers never call `res.end()` directly after an error path — they return early via `fail(res, code)` or re-throw.
- Upstream modules (`db.js`, `storage.js`) never leak raw HTTP status codes to callers; they either throw `UPSTREAM` or pass through a sentinel `dbCode` that the caller interprets.

### User-facing vs internal errors
- `ERRORS` messages are written for a family under wedding-week stress and never mention a database, token hash, function name, or infrastructure detail.
- Internal diagnostics go through `log(event, detail)` which runs every value through `redact()`, stripping fields matching `token|password|secret|key|pepper|apikey|authorization|cookie|service_key|idempotencykey`.
- HTML error surfaces (`render.notFoundPage`, `render.maintenancePage`) avoid words like "error", "database", or "server" — guests see calm cards, not stack traces.

### Validation-driven errors
- `api/_lib/limits.js` is the single source of truth for input validation. Every validator throws an `Error` with a descriptive `code` (`CONTENT_SHAPE`, `FILES_SHAPE`, `FILE_HASH`, `FILE_SIZE`, `PHOTO_TOO_LARGE`, `MEDIA_PATH_OUTSIDE_DRAFT`, etc.). This keeps business rules out of handlers and makes each failure type testable.
- Path safety is enforced by regex (`SAFE_PATH` in storage, slug shape checks in tokens) rather than trusting caller input.

### Timeouts and resilience
- Every outbound call (`fetch` in `db.js`, `storage.js`, template loading in `invite.js`) uses an `AbortController` with a fixed timeout (`DEFAULT_TIMEOUT_MS = 6000` for DB, `8000` for storage, `5000` for template fetch). A timeout becomes `UPSTREAM`.
- Public invitation pages are cached at the CDN (`Cache-Control: public, s-maxage=60, stale-while-revalidate=86400`) so a downstream outage shows a stale copy rather than failing.

### Security-related error handling
- `safeEqual` (constant-time comparison) is used for password and signature checks; mismatches silently return `false` rather than throwing, avoiding timing side channels.
- `ADMIN_PASSWORD` and `TOKEN_PEPPER` are read only inside `auth.checkPassword` and `tokens.hash` respectively; misconfiguration throws `UPSTREAM` so the admin cannot log the secret accidentally.
- `readJson` enforces a hard byte cap (default 1 MB, 512 KB for publish) and throws `TOO_LARGE` before parsing, preventing oversized payloads from occupying a function duration.

## Conventions and constraints

- **Every handler must be wrapped with `handler(name, fn)`** — this is how the codebase guarantees no unexpected throw reaches the customer as a stack trace and that every failure is logged in redacted form. Observed in `publish/index.js`, `invite.js`, and all other route files.
- **Errors carry a `code` string** that matches a key in `ERRORS`; if it does not, the wrapper downgrades to `SERVER`. Validators in `limits.js` consistently set both `message` and `code`.
- **User-visible messages come exclusively from `ERRORS` or `render.*Page` helpers** — ad-hoc `res.end(JSON.stringify(...))` with free-form text is avoided except in `auth.requireAdmin`, which returns the canonical `{ ok: false, code: "UNAUTHORISED", message: "Not signed in." }`.
- **Database sentinel codes are preserved as `err.dbCode`** and handled explicitly in `api/publish/index.js` (slug collision retry, token-not-available branching); they are never surfaced verbatim to the user.
- **No `try/catch` blocks inside handlers** — the wrapper handles exceptions; handlers focus on happy-path logic and explicit `fail()` returns for known bad inputs.
- **Rate limiting is applied before body parsing** where possible (publish endpoint) so abuse costs more than it costs the server.
- **Public invitation endpoints never emit error codes in HTML** — 404 and 503 responses render friendly shell pages that say nothing about backend state.