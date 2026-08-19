/* ============================================================================
   The one file that knows this code is running on Netlify.

   Every function under /api is written against Node's ordinary (req, res)
   pair — the same shape it had on Vercel, and the same shape it would have on
   a plain Node server. Netlify hands a function an `event` object instead and
   wants a plain object back. This translates between the two, and does
   nothing else.

   That is deliberate, and it is the whole reason the move to Netlify was
   cheap. Not one line of the token hashing, the activation lock, the admin
   session signing or the storage adapter changed. If the hosting has to move
   again, this file is the thing that gets rewritten — about a hundred lines,
   none of them security-critical.
   ========================================================================= */
"use strict";

/** Netlify's event → a Node-ish request the handlers already understand. */
function makeRequest(event, extraQuery) {
  const path = event.path || "/";

  /* Query parameters come from Netlify's parsed object rather than from the
     raw URL, because a rewrite can add parameters that the original URL the
     guest typed never had. `extraQuery` lets a wrapper supply one it worked
     out for itself — see invite.js, which reads the slug out of the path. */
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(event.queryStringParameters || {})) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  for (const [k, v] of Object.entries(extraQuery || {})) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const qs = params.toString();

  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;

  /* The rate limiter keys on x-forwarded-for. Netlify always sets it, but it
     also sets its own header, and a limiter that silently falls back to
     "unknown" would put every visitor in the world in one bucket. */
  if (!headers["x-forwarded-for"] && headers["x-nf-client-connection-ip"]) {
    headers["x-forwarded-for"] = headers["x-nf-client-connection-ip"];
  }

  const raw = event.body == null
    ? null
    : Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");

  const req = {
    method: event.httpMethod || "GET",
    url: qs ? `${path}?${qs}` : path,
    headers,
    socket: { remoteAddress: headers["x-nf-client-connection-ip"] || null },

    /* readJson() streams the body so it can enforce a byte cap before parsing.
       Handing it one chunk keeps that cap meaningful and keeps readJson
       unchanged. Deliberately NOT set as req.body: an object there would make
       readJson skip the cap entirely. */
    async *[Symbol.asyncIterator]() {
      if (raw && raw.length) yield raw;
    },
  };

  return req;
}

/** A response object with the four members the handlers actually use. */
function makeResponse() {
  const headers = {};
  const state = { statusCode: 200, body: "", ended: false };

  const res = {
    get statusCode() { return state.statusCode; },
    set statusCode(v) { state.statusCode = v; },
    setHeader(name, value) { headers[String(name)] = String(value); },
    getHeader(name) { return headers[String(name)]; },
    get headersSent() { return state.ended; },
    end(body) {
      if (state.ended) return;
      state.ended = true;
      state.body = body == null ? "" : String(body);
    },
  };

  return { res, headers, state };
}

/** Wrap one of the /api handlers as a Netlify function.
 *
 *  `options.query` is called with the event and may return extra query
 *  parameters to graft on. `options.headers` does the same for headers — the
 *  scheduled keepalive uses it to supply its own authorisation. */
function bridge(fn, options) {
  const opts = options || {};

  return async function netlifyHandler(event) {
    const extraQuery = opts.query ? opts.query(event) : null;
    const req = makeRequest(event, extraQuery);

    if (opts.headers) Object.assign(req.headers, opts.headers(event) || {});

    const { res, headers, state } = makeResponse();

    /* handler() in api/_lib/http.js already catches everything and answers in
       the customer's language, so a throw reaching here means the wrapper
       itself is broken. Say so plainly and reveal nothing. */
    try {
      await fn(req, res);
    } catch (err) {
      console.log(JSON.stringify({ event: "bridge.error", message: String(err && err.message) }));
    }

    if (!state.ended) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        body: JSON.stringify({ ok: false, code: "SERVER", message: "Something went wrong at our end. Please try again." }),
      };
    }

    return { statusCode: state.statusCode, headers, body: state.body };
  };
}

module.exports = { bridge };
