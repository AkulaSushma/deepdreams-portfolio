/* ============================================================================
   PUBLISH CLIENT (browser) — the three calls that turn a paid activation code
   into a permanent public link.

       preflight  →  check the code, get one signed upload permission per file
       PUT        →  photographs go straight to storage, never through /api
       publish    →  spend the code and create the website, in one transaction

   Everything difficult about this is failure, not success. A publish happens
   once, on a phone, on Indian mobile data, in the week of a wedding, with the
   customer's money already spent. So:

     · the idempotency key is generated and written to localStorage BEFORE the
       first attempt leaves, so a retry after a dropped connection returns the
       same website instead of failing or making a second one
     · that key is filed against the code it belongs to, so a customer who buys
       a second code later does not replay their first wedding
     · every request has a timeout and one retry with backoff, so the UI never
       hangs blank and never silently gives up
     · uploads get a much longer timeout than API calls, because 250 KB over a
       weak signal is genuinely slow and a timeout there is not a fault
     · already-uploaded photographs are skipped, so a resumed publish does not
       re-send what it already sent
     · the caller clears the draft only after a 200. This module never touches
       the draft.

   The code appears in POST bodies only. Never a URL, never a query string,
   never localStorage, never a log line, never an analytics event.

   Loaded as <script src="/shared/publish-client.js"> → window.DD_PUBLISH
   ========================================================================= */
/* `root` is passed INTO the factory, not merely captured by the wrapper:
   the factory is defined in the enclosing scope, so a bare `root` inside it
   would be an unbound reference and every call would throw. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DD_PUBLISH = factory(root);
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  var L = (typeof self !== "undefined" && self.DD_LIMITS) || {
    CLIENT_TIMEOUT_MS: 8000,
    CLIENT_RETRIES: 1,
  };

  var API_TIMEOUT = L.CLIENT_TIMEOUT_MS || 8000;
  var UPLOAD_TIMEOUT = 60000;   // a photograph on a weak signal, not a fault
  var RETRIES = L.CLIENT_RETRIES == null ? 1 : L.CLIENT_RETRIES;

  var IDEM_PREFIX = "dd_publish_idem:";

  /* Messages a customer reads. Kept here, in one place, in plain Indian
     English — no error codes, no internal names, and never a hint about
     whether a code someone guessed happens to exist. */
  var MESSAGES = {
    TOKEN_INVALID: "That activation code is not correct. Please check the code we sent you.",
    TOKEN_REVOKED: "That activation code is no longer active. Please contact us on WhatsApp.",
    TOKEN_USED: "That activation code has already been used to publish a website.",
    TOKEN_WRONG_TEMPLATE: "That activation code belongs to our other invitation design.",
    RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
    TOO_LARGE: "Your photographs are too large. Please remove a few and try again.",
    BAD_REQUEST: "Something in the invitation could not be saved. Please check your details and try again.",
    NOT_FOUND: "We could not find a published website for that code.",
    UPSTREAM: "We could not reach our server just now. Please try again in a moment.",
    NETWORK: "Your internet connection dropped. Please try again — nothing has been lost.",
    TIMEOUT: "That took too long to respond. Please try again — nothing has been lost.",
    UPLOAD_FAILED: "One of your photographs did not upload. Please try again.",
    INSECURE_CONTEXT: "Publishing needs a secure connection. Please open this page over https.",
  };

  function friendly(code) {
    return MESSAGES[code] || "Something went wrong. Please try again, or contact us on WhatsApp.";
  }

  function reason(code, extra) {
    var e = new Error(code);
    e.code = code;
    e.userMessage = friendly(code);
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k];
    return e;
  }

  /* ── Transport ─────────────────────────────────────────────────────────── */

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function once(url, opts, timeoutMs) {
    var ac = typeof AbortController === "function" ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ac) ac.abort();
    }, timeoutMs);

    var init = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) init[k] = opts[k];
    if (ac) init.signal = ac.signal;

    return fetch(url, init).then(
      function (res) { clearTimeout(timer); return res; },
      function (err) {
        clearTimeout(timer);
        throw reason(timedOut ? "TIMEOUT" : "NETWORK", { cause: err && err.name });
      }
    );
  }

  /* One retry, with backoff, and only where a retry can help: a dropped
     connection or a server that was briefly unwell. A refusal — a wrong code,
     a spent code, a rate limit — is answered once and reported. */
  function retryable(err, status) {
    if (status) return status >= 500 || status === 408;
    return err && (err.code === "NETWORK" || err.code === "TIMEOUT");
  }

  function postJson(path, body, opts) {
    opts = opts || {};
    var attempt = 0;

    function go() {
      attempt++;
      return once(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
      }, opts.timeoutMs || API_TIMEOUT).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

          if (res.ok && data && data.ok !== false) return data;

          if (retryable(null, res.status) && attempt <= RETRIES) {
            return sleep(600 * attempt).then(go);
          }

          var code = (data && data.code) || (res.status === 429 ? "RATE_LIMITED" : "UPSTREAM");
          throw reason(code, {
            status: res.status,
            recoverable: !!(data && data.recoverable),
          });
        });
      }, function (err) {
        if (retryable(err) && attempt <= RETRIES) return sleep(600 * attempt).then(go);
        throw err;
      });
    }

    return go();
  }

  /* ── Idempotency key ───────────────────────────────────────────────────── */

  function sha256Hex(text) {
    if (!(root.crypto && root.crypto.subtle)) return Promise.reject(reason("INSECURE_CONTEXT"));
    var bytes = new TextEncoder().encode(text);
    return root.crypto.subtle.digest("SHA-256", bytes).then(function (digest) {
      var arr = new Uint8Array(digest), hex = "";
      for (var i = 0; i < arr.length; i++) hex += (arr[i] < 16 ? "0" : "") + arr[i].toString(16);
      return hex;
    });
  }

  function randomKey() {
    var bytes = new Uint8Array(18);
    root.crypto.getRandomValues(bytes);
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* Filed against a local digest of the code, not the code itself, and not one
     shared key per browser. One shared key would mean a customer who buys a
     second code months later replays their first wedding and never gets their
     second website — the retry protection turning into a data bug. */
  function idempotencyKey(token) {
    return sha256Hex(token).then(function (hex) {
      var storeKey = IDEM_PREFIX + hex.slice(0, 16);
      var existing = null;
      try { existing = localStorage.getItem(storeKey); } catch (e) { existing = null; }
      if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;

      var fresh = randomKey();
      /* Written before the first attempt leaves, not after it succeeds. If the
         browser is closed mid-publish, the key survives and the retry lands on
         the same website. */
      try { localStorage.setItem(storeKey, fresh); } catch (e) { /* private mode */ }
      return fresh;
    });
  }

  /* ── Uploads ───────────────────────────────────────────────────────────── */

  /* Supabase's signed-upload endpoint takes the same multipart shape as its own
     client library. Content-hashed paths never change contents, so they are
     cached for a year. */
  function putOne(uploadUrl, blob) {
    var form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", blob);

    return once(uploadUrl, {
      method: "PUT",
      body: form,
      cache: "no-store",
      credentials: "omit",
    }, UPLOAD_TIMEOUT).then(function (res) {
      if (!res.ok) throw reason("UPLOAD_FAILED", { status: res.status });
      return true;
    });
  }

  function blobFor(items, sha, variant) {
    for (var i = 0; i < items.length; i++) {
      var vs = items[i].variants || [];
      for (var j = 0; j < vs.length; j++) {
        if (vs[j].sha256 === sha && vs[j].variant === variant) return vs[j].blob;
      }
    }
    return null;
  }

  /* Two at a time. One is needlessly slow on a decent connection; six saturates
     a weak one and starts timing out photographs that would have arrived. */
  function uploadAll(uploads, items, onProgress) {
    var queue = uploads.slice();
    var total = queue.length;
    var done = 0;
    var LANES = 2;

    function lane() {
      var next = queue.shift();
      if (!next) return Promise.resolve();

      var blob = blobFor(items, next.sha256, next.variant);
      if (!blob) throw reason("UPLOAD_FAILED");

      var attempt = 0;
      function send() {
        attempt++;
        return putOne(next.uploadUrl, blob).catch(function (err) {
          if (attempt <= RETRIES) return sleep(800 * attempt).then(send);
          throw err;
        });
      }

      return send().then(function () {
        done++;
        if (onProgress) onProgress({ done: done, total: total });
        return lane();
      });
    }

    var lanes = [];
    for (var i = 0; i < Math.min(LANES, total); i++) lanes.push(lane());
    return Promise.all(lanes);
  }

  /* ── Media references ──────────────────────────────────────────────────── */

  /* What publish stores: paths and dimensions, never bytes. The paths come
     from the server's preflight reply, not from anything the browser made up,
     which is why one customer cannot name another customer's folder. */
  function mediaRefs(items, byHash) {
    var out = [];

    items.forEach(function (item) {
      var sizes = {};
      var largest = null;

      (item.variants || []).forEach(function (v) {
        var path = byHash[v.sha256 + ":" + v.variant];
        if (!path) return;
        sizes[v.variant] = path;
        if (!largest || v.w > largest.w) largest = { w: v.w, h: v.h, path: path };
      });

      /* Not skipped — refused. The stored content refers to photographs by
         position ("@m3"), so dropping one here would shift every photograph
         after it into the wrong frame on the couple's own invitation. A clean
         failure they can retry is far better than a wrong wedding album. */
      if (!largest) throw reason("UPLOAD_FAILED");

      out.push({
        role: item.role === "cover" ? "cover" : "gallery",
        path: largest.path,
        sizes: sizes,
        w: largest.w,
        h: largest.h,
        caption: item.caption,
      });
    });

    return out;
  }

  /* ── The public flow ───────────────────────────────────────────────────── */

  /**
   * @param {{
   *   token: string, template: "sample1"|"sample2",
   *   content: object, photos?: Array,          // from DD_IMAGE_PREP.prepareAll
   *   weddingDate?: string,
   *   onState?: (state: {phase: string, done?: number, total?: number, message?: string}) => void
   * }} opts
   * @returns {Promise<{ok: true, slug: string, url: string}>}
   */
  function publish(opts) {
    var token = String(opts.token || "").trim();
    var template = opts.template;
    var items = opts.photos || [];
    var say = opts.onState || function () {};

    var descriptors = [];
    items.forEach(function (item) {
      (item.variants || []).forEach(function (v) {
        descriptors.push({ sha256: v.sha256, bytes: v.bytes, type: v.type, w: v.w, h: v.h, variant: v.variant });
      });
    });

    /* The key first, and on disk, before anything is attempted. */
    return idempotencyKey(token).then(function (idem) {
      say({ phase: "checking", message: "Checking your activation code…" });

      return postJson("/api/publish/preflight", {
        token: token,
        template: template,
        files: descriptors,
      }).then(function (pf) {
        /* sha256:variant → the permanent path the server chose for it. */
        var byHash = {};
        (pf.skip || []).forEach(function (s) { byHash[s.sha256 + ":" + s.variant] = s.path; });
        (pf.uploads || []).forEach(function (u) { byHash[u.sha256 + ":" + u.variant] = u.path; });

        var uploads = pf.uploads || [];
        if (!uploads.length) return byHash;

        say({ phase: "uploading", done: 0, total: uploads.length, message: "Uploading your photographs…" });

        return uploadAll(uploads, items, function (p) {
          say({ phase: "uploading", done: p.done, total: p.total, message: "Uploading your photographs…" });
        }).then(function () { return byHash; });
      }).then(function (byHash) {
        say({ phase: "publishing", message: "Creating your website…" });

        return postJson("/api/publish", {
          token: token,
          idempotencyKey: idem,
          template: template,
          content: opts.content,
          media: mediaRefs(items, byHash),
          weddingDate: opts.weddingDate,
        }, { timeoutMs: 12000 });
      }).then(function (res) {
        say({ phase: "done", message: "Your website is live." });
        return res;
      });
    }).catch(function (err) {
      say({
        phase: "error",
        code: err && err.code,
        recoverable: !!(err && err.recoverable),
        message: (err && err.userMessage) || friendly(err && err.code),
      });
      throw err;
    });
  }

  /** "I already paid — where is my link?" The way back from a publish that
   *  succeeded on the server and never reached the customer. */
  function recover(token) {
    return postJson("/api/publish/recover", { token: String(token || "").trim() });
  }

  return {
    publish: publish,
    recover: recover,
    messageFor: friendly,
    MESSAGES: MESSAGES,
  };
});
