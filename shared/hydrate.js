/* ============================================================================
   HYDRATE (browser) — turns window.DD_SITE into the config the template
   already knows how to render.

   A published invitation arrives as a validated partial override of the
   template's own configuration, with every uploaded photograph left as a
   marker rather than a URL:

       { photos: ["@m0", "@m1", null, …], cover: "@m2" }

   The marker is resolved here, on the device, because only the device knows
   whether it wants the 640 w file or the 1280 w one. That single decision is
   worth about a megabyte per guest on a phone — roughly the difference between
   seventy fully-viewed invitations a month on the free tier and twenty-eight.

   Nothing in this file trusts DD_SITE for anything structural. It only reads
   text and image markers the server already validated.

   Loaded as <script src="/shared/hydrate.js"> → window.DD_HYDRATE
   ========================================================================= */
/* `root` is passed INTO the factory, not merely captured by the wrapper:
   the factory is defined in the enclosing scope, so a bare `root` inside it
   would be an unbound reference and every call would throw. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DD_HYDRATE = factory(root);
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  var MARKER = /^@m(\d{1,2})$/;

  /** Is this page a published invitation, as opposed to the editor, the demo
   *  or a draft preview? The server sets both flags; a draft never has them. */
  function isPublished() {
    return !!(root.DD_PUBLISHED && root.DD_SITE && root.DD_SITE.slug);
  }

  function site() {
    return isPublished() ? root.DD_SITE : null;
  }

  /* Which responsive width this device should actually download. Decided once,
     from the widest the layout can ask for — these photographs are all shown
     full-width or near it, so there is no per-image decision to make.

     Deliberately not `srcset`: the template writes plain `img.src` in a dozen
     places, and one honest choice here beats twelve edits that must each be
     remembered again the next time the design changes. */
  function bestWidth(media) {
    var sizes = (media && media.sizes) || null;
    if (!sizes) return null;

    var widths = Object.keys(sizes).map(Number).sort(function (a, b) { return a - b; });
    if (!widths.length) return null;

    var dpr = Math.min(root.devicePixelRatio || 1, 2);
    var need = (root.innerWidth || 800) * dpr;

    for (var i = 0; i < widths.length; i++) {
      if (widths[i] >= need) return sizes[widths[i]];
    }
    return sizes[widths[widths.length - 1]];
  }

  /** One marker → one URL. Anything that is not a marker is returned
   *  unchanged: the template's own bundled asset paths pass straight through. */
  function resolveOne(value, media) {
    if (typeof value !== "string") return value;

    var m = MARKER.exec(value);
    if (!m) return value;

    var item = media[Number(m[1])];
    if (!item) return null;

    return bestWidth(item) || item.src || null;
  }

  /** Walk the published content and replace every marker in place. Returns a
   *  new object; DD_SITE itself is left alone so a second call is harmless. */
  function resolve(content, media) {
    media = media || [];

    function step(value) {
      if (Array.isArray(value)) return value.map(step);
      if (value && typeof value === "object") {
        var out = {};
        for (var k in value) {
          if (Object.prototype.hasOwnProperty.call(value, k)) out[k] = step(value[k]);
        }
        return out;
      }
      return resolveOne(value, media);
    }

    return step(content || {});
  }

  /** The published content, markers resolved, ready to merge over the
   *  template's defaults. Null when this is not a published page. */
  function content() {
    var s = site();
    return s ? resolve(s.content, s.media) : null;
  }

  /** Deep merge, with the override winning and arrays replaced wholesale.
   *  Arrays are replaced rather than merged on purpose: a couple who removed
   *  their fourth ceremony must not have the sample's fourth ceremony reappear
   *  underneath it. */
  function merge(base, override) {
    if (Array.isArray(override) || override === null || typeof override !== "object") {
      return override;
    }
    var out = Array.isArray(base) ? [] : {};
    var k;
    if (base && typeof base === "object") {
      for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in override) {
      if (Object.prototype.hasOwnProperty.call(override, k)) {
        out[k] = merge(base ? base[k] : undefined, override[k]);
      }
    }
    return out;
  }

  /* ── The other direction: content for publishing ────────────────────────
     The editor holds photographs as data: URLs. Those cannot go into the
     database — a base64 photograph in a jsonb column is megabytes on every
     public read, and the API refuses them outright. So each one is swapped for
     a marker, and the blob it points at is collected for upload.

     Keyed by the data URL itself, so the same photograph used in two places
     becomes one upload and two references to it. */
  function collectImages(content, opts) {
    opts = opts || {};
    var isUpload = opts.isUpload || function (v) {
      return typeof v === "string" && v.indexOf("data:image/") === 0;
    };

    var order = [];        // index → data URL
    var seen = {};         // data URL → index
    var coverValue = null;

    function step(value, key) {
      if (Array.isArray(value)) {
        return value.map(function (v) { return step(v, key); });
      }
      if (value && typeof value === "object") {
        var out = {};
        for (var k in value) {
          if (Object.prototype.hasOwnProperty.call(value, k)) out[k] = step(value[k], k);
        }
        return out;
      }
      if (!isUpload(value)) return value;

      if (!(value in seen)) {
        seen[value] = order.length;
        order.push(value);
      }
      if (opts.coverKey && key === opts.coverKey) coverValue = value;
      return "@m" + seen[value];
    }

    var stripped = step(content, null);

    return {
      content: stripped,
      images: order,
      /* Which index the cover photograph ended up at, so the caller can mark
         it — it is the one WhatsApp shows, so it is worth being sure about. */
      coverIndex: coverValue === null ? -1 : seen[coverValue],
    };
  }

  /** data: URL → Blob, so a photograph the editor already compressed can go
   *  through the same preparation as a freshly picked file. */
  function dataUrlToBlob(dataUrl) {
    var comma = String(dataUrl).indexOf(",");
    if (comma < 0) return null;

    var head = dataUrl.slice(0, comma);
    var type = (/data:([^;,]+)/.exec(head) || [])[1] || "image/jpeg";
    var body = dataUrl.slice(comma + 1);

    if (head.indexOf(";base64") < 0) {
      return new Blob([decodeURIComponent(body)], { type: type });
    }

    var bin = atob(body);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }

  return {
    isPublished: isPublished,
    site: site,
    content: content,
    resolve: resolve,
    merge: merge,
    collectImages: collectImages,
    dataUrlToBlob: dataUrlToBlob,
  };
});
