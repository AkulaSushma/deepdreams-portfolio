---
kind: logging_system
name: Single Redacting Logger in api/_lib/http.js
category: logging_system
scope:
    - '**'
source_files:
    - api/_lib/http.js
    - api/_lib/auth.js
---

# Logging System

## What system/approach is used

The repository uses a **minimal, single-purpose logger** implemented inline in `api/_lib/http.js`. There is no logging framework (no Winston, Pino, Bunyan, Morgan, debug, etc.). All server-side log output goes through one function — `log(event, detail)` — which serializes structured JSON to `console.log` and runs every logged payload through a `redact()` sanitizer before emission. The frontend codebase (static wedding sites, 3D world) uses only browser `console.*` calls from third-party libraries (Three.js) and contains no application-level logging.

## Key files and packages

- `api/_lib/http.js` — defines the sole logger (`log`), the redaction helper (`redact`), and the handler wrapper that emits lifecycle logs.
- `api/_lib/auth.js` — imports `log` from `./http` to emit an `admin.misconfigured` event when `ADMIN_PASSWORD` is missing or too short.
- `netlify/functions/*` — thin bridges that forward Netlify events into the same `req/res` shape consumed by `api/`; they do not introduce their own logging.
- Frontend assets under `3D Wedding Invitation Sample 2/world/assets/index-yBOXTbMw.js` contain only third-party library console calls (Three.js WebGL warnings/errors); these are not application logging.

## Architecture and conventions

### Centralized logger
`log(event, detail)` is the only entry point for emitting logs:
```js
function log(event, detail) {
  try {
    console.log(JSON.stringify({ event, ...redact(detail || {}) }));
  } catch {
    console.log(JSON.stringify({ event }));
  }
}
```
It always produces a single-line JSON object with two fields: `event` (a string tag) and a spread of `detail` whose sensitive keys have been replaced with `["[redacted]"]`.

### Structured log fields
Every emitted record carries at least:
- `event` — a domain-specific tag such as `api.error`, `api.done`, `admin.misconfigured`.
- `fn` — the name of the handler being wrapped (set by the `handler(name, fn)` wrapper).
- `ms` — request duration in milliseconds (set by the wrapper's `finally` block).
- `status` — the HTTP status code set on `res` (set by the wrapper).
- `code` — a named error code mapped from `ERRORS` (e.g. `TOKEN_INVALID`, `UPSTREAM`).
- `message` — a user-facing message string, never a stack trace.

### Secret redaction policy
A regex-based key filter blocks any field whose name matches:
```
token|password|secret|key|pepper|apikey|authorization|cookie|service_key|idempotencykey
```
These keys are matched case-insensitively and recursively up to depth 6 in nested objects/arrays. The comment explicitly states the rationale: *Vercel's function logs are readable in the dashboard; an activation token in there is as good as an unpaid invitation.*

### Handler wrapper pattern
Every API endpoint is invoked via `handler(name, fn)`, which:
1. Records a start timestamp.
2. Catches unexpected throws, maps them to a known `ERRORS` code, logs `api.error` with redacted details, and writes a safe JSON response.
3. In `finally`, logs `api.done` with `{ fn, ms, status }` so every request has an end-of-life log line even on success.

This means each request produces at least two log lines: one `api.done` per successful path and one `api.error` per thrown path.

### Error messages are user-facing, not developer-facing
The `ERRORS` map pairs codes with plain-language messages written for couples under wedding-week stress (e.g. `TOKEN_USED`: "That activation code has already been used for another wedding website…"). Stack traces and internal diagnostics are never sent to clients; they only appear in the redacted server logs.

### No log levels
There is no concept of DEBUG/INFO/WARN/ERROR levels. All emissions go through the same `console.log` path. Filtering must be done externally (e.g. Vercel/Netlify dashboard filters) by searching the `event` tag.

### No sinks beyond stdout
Logs are written to `console.log`, which on Vercel/Netlify serverless functions maps to platform stdout. There is no file sink, no external collector, no correlation ID injected into log records, and no batching.

## Conventions and constraints

Observed conventions (descriptive):
- Every API module imports `log` from `./http` rather than calling `console.log` directly.
- Sensitive data is never passed to `log`; callers pass raw payloads through `redact()` themselves when needed (the `readJson` body is never logged raw — the comment in `http.js` says "Never log a raw request body — log `redact(body)"`.)
- Errors thrown from handlers are caught by the `handler` wrapper; ad-hoc `try/catch` blocks elsewhere should still funnel errors through `log("api.error", …)` rather than printing stacks.
- Public invitation pages and static sites do not emit application logs; only the Node API layer does.

Enforced rules (from documented intent in source):
- A token must never reach a log line, an error message, or a URL — enforced by the `SECRET_KEYS` regex in `redact` and by the explicit comment in `http.js` header.
- A request must never hang; it times out and says so — enforced by the `handler` wrapper's `finally` block guaranteeing an `api.done` log and a response.
- A failing request returns a shape the UI can act on, never a stack trace — enforced by the `fail(res, code)` helper and the `ERRORS` map.
- Abuse costs the attacker more than it costs us — enforced by rate limiting in `rateLimit(req, name, spec)` combined with the redacted logging of attempts.

Applicable scope: This logging system applies only to the Node.js server API under `api/` and its Netlify bridge. It does not apply to the static frontends or the 3D world sample.