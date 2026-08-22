/* ============================================================================
   Cloudflare Pages Functions Bridge
   Translates Cloudflare Fetch Request -> Node (req, res) -> Cloudflare Response
   ========================================================================= */
"use strict";

function cfBridge(handlerFn, options = {}) {
  return async function onRequest(context) {
    const { request, env, params } = context;

    // Inject Cloudflare Pages environment variables into process.env
    if (env && typeof env === "object") {
      for (const [k, v] of Object.entries(env)) {
        if (v && typeof v === "string") process.env[k] = v;
      }
    }

    const url = new URL(request.url);
    const headers = {};
    for (const [k, v] of request.headers.entries()) {
      headers[k.toLowerCase()] = v;
    }

    const rawBuffer = request.body ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);

    const req = {
      method: request.method,
      url: url.pathname + url.search,
      headers,
      socket: { remoteAddress: headers["cf-connecting-ip"] || headers["x-forwarded-for"] || null },
      async *[Symbol.asyncIterator]() {
        if (rawBuffer && rawBuffer.length) yield rawBuffer;
      }
    };

    if (options.extraQuery && params) {
      const q = options.extraQuery(context);
      if (q && typeof q === "object") {
        for (const [k, v] of Object.entries(q)) {
          if (v) url.searchParams.set(k, String(v));
        }
        req.url = url.pathname + url.search;
      }
    }

    const resHeaders = new Headers();
    let resStatus = 200;
    let resBody = "";

    const res = {
      get statusCode() { return resStatus; },
      set statusCode(v) { resStatus = v; },
      setHeader(name, value) {
        if (value !== undefined && value !== null) {
          resHeaders.set(name, String(value));
        }
      },
      getHeader(name) { return resHeaders.get(name); },
      get headersSent() { return false; },
      end(body) {
        resBody = body == null ? "" : String(body);
      }
    };

    try {
      await handlerFn(req, res);
    } catch (err) {
      resStatus = 500;
      resBody = JSON.stringify({ ok: false, code: "SERVER", message: "Internal server error" });
      resHeaders.set("Content-Type", "application/json");
    }

    return new Response(resBody, {
      status: resStatus,
      headers: resHeaders
    });
  };
}

module.exports = { cfBridge };
