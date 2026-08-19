/* ============================================================================
   IMAGE PREP (browser) — turns a photograph off a phone into the two small
   files the invitation actually needs.

   A wedding photograph straight out of a camera is 4–8 MB of 4000 px JPEG with
   the GPS coordinates of the house it was taken in still attached. Sending
   that to a guest on mobile data is unkind; storing twelve of them is 60 MB of
   a 1 GB free tier. So every photograph is re-encoded here, in the customer's
   own browser, before a single byte crosses the network:

     · scaled to 640 w and 1280 w, so a phone never downloads the desktop file
     · WebP where the browser can encode it, JPEG where it cannot (older iOS)
     · quality stepped down until it fits MAX_PHOTO_BYTES, never past legible
     · EXIF discarded for free — a canvas re-encode keeps no metadata at all
     · SHA-256 of the encoded bytes, which is both the storage filename and
       the way an interrupted upload knows what it already sent

   Nothing here is a security control. The server re-checks every size, type
   and count, because this file runs on a machine the customer owns.

   Loaded as <script src="/shared/image-prep.js"> → window.DD_IMAGE_PREP
   Requires a secure context (https, or localhost) for crypto.subtle.
   ========================================================================= */
/* `root` is passed INTO the factory, not merely captured by the wrapper:
   the factory is defined in the enclosing scope, so a bare `root` inside it
   would be an unbound reference and every call would throw. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DD_IMAGE_PREP = factory(root);
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  var L = (typeof self !== "undefined" && self.DD_LIMITS) || {
    MAX_PHOTOS: 12,
    MAX_PHOTO_BYTES: 250 * 1024,
    MAX_TOTAL_MEDIA_BYTES: 3 * 1024 * 1024,
    MAX_IMAGE_EDGE: 1600,
    IMAGE_WIDTHS: [640, 1280],
    IMAGE_QUALITY: 0.82,
    MAX_SOURCE_BYTES: 12 * 1024 * 1024,
  };

  /* ── Capability probes, run once and cached ─────────────────────────────
     Asked rather than assumed: iOS Safari below 14 cannot encode WebP, and a
     silent failure there would upload a PNG the size of a small film. */
  var webpSupport = null;

  function canEncodeWebp() {
    if (webpSupport !== null) return Promise.resolve(webpSupport);
    return new Promise(function (resolve) {
      try {
        var c = document.createElement("canvas");
        c.width = 2;
        c.height = 2;
        c.toBlob(function (blob) {
          webpSupport = !!(blob && blob.type === "image/webp");
          resolve(webpSupport);
        }, "image/webp", 0.8);
      } catch (e) {
        webpSupport = false;
        resolve(false);
      }
    });
  }

  /* ── Decode ────────────────────────────────────────────────────────────── */

  function decode(file) {
    /* createImageBitmap is faster and does not need the DOM, but Safari only
       grew it recently and still refuses some CMYK JPEGs, so <img> stays as
       the fallback rather than as the primary path. */
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file).catch(function () {
        return decodeViaImg(file);
      });
    }
    return decodeViaImg(file);
  }

  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("NOT_AN_IMAGE"));
      };
      img.src = url;
    });
  }

  function sizeOf(source) {
    return {
      w: source.naturalWidth || source.width || 0,
      h: source.naturalHeight || source.height || 0,
    };
  }

  /* ── Encode one variant ────────────────────────────────────────────────── */

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("ENCODE_FAILED"));
      }, type, quality);
    });
  }

  function draw(source, w, h) {
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    /* A wedding photograph scaled to a third of its size looks visibly worse
       with nearest-neighbour sampling, and this costs nothing. */
    ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    return canvas;
  }

  /* Target pixel size for a nominal variant width. The nominal width is what
     goes in the filename; the real width is what goes in the srcset, and the
     two differ whenever the source is smaller than the target or the crop is
     tall enough that MAX_IMAGE_EDGE bites on the height instead. */
  function targetSize(src, nominalWidth) {
    var w = Math.min(nominalWidth, src.w);
    var h = Math.round((src.h * w) / src.w);

    var longest = Math.max(w, h);
    if (longest > L.MAX_IMAGE_EDGE) {
      var k = L.MAX_IMAGE_EDGE / longest;
      w = Math.round(w * k);
      h = Math.round(h * k);
    }

    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  /* Encode, and if the result is over the per-photograph cap, try again with
     less quality. Four steps, then give up on quality and shrink the pixels —
     a photograph that is still too large at 0.5 is usually a scan or a
     screenshot of text, where fewer pixels hurt less than more artefacts. */
  var QUALITY_STEPS = [1, 0.85, 0.72, 0.6];

  function encodeVariant(source, src, nominalWidth, type) {
    var size = targetSize(src, nominalWidth);
    var step = 0;

    function attempt(scale) {
      var w = Math.max(1, Math.round(size.w * scale));
      var h = Math.max(1, Math.round(size.h * scale));
      var canvas = draw(source, w, h);

      return toBlob(canvas, type, L.IMAGE_QUALITY * QUALITY_STEPS[step]).then(function (blob) {
        if (blob.size <= L.MAX_PHOTO_BYTES) {
          return { blob: blob, w: w, h: h };
        }
        if (step < QUALITY_STEPS.length - 1) {
          step++;
          return attempt(scale);
        }
        if (scale > 0.5) return attempt(scale * 0.8);
        /* Handed back over the cap on purpose. The caller reports it to the
           customer by name; silently uploading it would fail server-side and
           silently dropping it would lose their photograph. */
        return { blob: blob, w: w, h: h, oversize: true };
      });
    }

    return attempt(1);
  }

  /* ── Hash ──────────────────────────────────────────────────────────────── */

  function sha256(blob) {
    if (!(root.crypto && root.crypto.subtle)) {
      return Promise.reject(new Error("INSECURE_CONTEXT"));
    }
    return blob.arrayBuffer().then(function (buf) {
      return root.crypto.subtle.digest("SHA-256", buf).then(function (digest) {
        var bytes = new Uint8Array(digest);
        var hex = "";
        for (var i = 0; i < bytes.length; i++) {
          hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
        }
        return hex;
      });
    });
  }

  /* ── Public: prepare one file ──────────────────────────────────────────── */

  /**
   * @param {File|Blob} file
   * @param {{role?: string, caption?: string}} [opts]
   * @returns {Promise<{role, caption, type, w, h, variants: Array<{variant, blob, bytes, w, h, sha256}>}>}
   */
  function prepare(file, opts) {
    opts = opts || {};

    if (!file || typeof file.arrayBuffer !== "function") {
      return Promise.reject(reason("NOT_A_FILE", "That is not an image file."));
    }
    if (!/^image\//.test(file.type || "")) {
      return Promise.reject(reason("NOT_AN_IMAGE", "Please choose an image file."));
    }
    if (file.size > L.MAX_SOURCE_BYTES) {
      return Promise.reject(
        reason("SOURCE_TOO_LARGE", "That photograph is larger than " + mb(L.MAX_SOURCE_BYTES) + ". Please choose a smaller one.")
      );
    }

    return canEncodeWebp().then(function (webp) {
      var type = webp ? "image/webp" : "image/jpeg";

      return decode(file).then(function (source) {
        var src = sizeOf(source);
        if (!src.w || !src.h) throw reason("NOT_AN_IMAGE", "That image could not be read.");

        var widths = L.IMAGE_WIDTHS.slice();
        var variants = [];

        /* Sequential, not Promise.all: three canvases of a 12 MP photograph in
           flight at once is how a mid-range Android tab runs out of memory. */
        var chain = Promise.resolve();
        widths.forEach(function (nominal) {
          chain = chain.then(function () {
            return encodeVariant(source, src, nominal, type).then(function (out) {
              if (out.oversize) {
                throw reason(
                  "PHOTO_TOO_LARGE",
                  "That photograph could not be compressed under " + kb(L.MAX_PHOTO_BYTES) + ". Please choose another."
                );
              }
              return sha256(out.blob).then(function (hash) {
                variants.push({
                  variant: nominal,
                  blob: out.blob,
                  bytes: out.blob.size,
                  type: type,
                  w: out.w,
                  h: out.h,
                  sha256: hash,
                });
              });
            });
          });
        });

        return chain.then(function () {
          if (source.close) source.close();   // release the ImageBitmap
          var largest = variants[variants.length - 1];
          return {
            role: opts.role === "cover" ? "cover" : "gallery",
            caption: opts.caption ? String(opts.caption).slice(0, 200) : undefined,
            type: type,
            w: largest.w,
            h: largest.h,
            variants: variants,
          };
        });
      });
    });
  }

  /** Prepare several, reporting progress, and refuse the batch early if it
   *  will not fit — better than compressing eleven photographs and then
   *  telling the customer the twelfth was one too many. */
  function prepareAll(files, opts) {
    opts = opts || {};
    var list = Array.prototype.slice.call(files || []);

    if (list.length > L.MAX_PHOTOS) {
      return Promise.reject(
        reason("TOO_MANY_PHOTOS", "Please choose " + L.MAX_PHOTOS + " photographs or fewer.")
      );
    }

    var out = [];
    var chain = Promise.resolve();

    /* `roles` lets the caller say which photograph is the cover when it is not
       the first one — Sample 1's cover is the seal on the closed doors, chosen
       separately from the gallery. Order is preserved either way, because the
       stored content refers to these by index. */
    var roles = opts.roles || [];

    list.forEach(function (file, i) {
      chain = chain.then(function () {
        if (opts.onProgress) opts.onProgress({ done: i, total: list.length, name: file.name || "" });
        var role = roles[i] || (i === 0 && opts.firstIsCover ? "cover" : "gallery");
        return prepare(file, { role: role }).then(function (item) {
          out.push(item);
        });
      });
    });

    return chain.then(function () {
      if (opts.onProgress) opts.onProgress({ done: list.length, total: list.length });
      var total = totalBytes(out);
      if (total > L.MAX_TOTAL_MEDIA_BYTES) {
        throw reason(
          "MEDIA_TOTAL_TOO_LARGE",
          "Those photographs come to " + mb(total) + " together, and the limit is " + mb(L.MAX_TOTAL_MEDIA_BYTES) + ". Please remove a few."
        );
      }
      return out;
    });
  }

  /* Every encoded variant counts, because every one is uploaded and stored. */
  function totalBytes(items) {
    var sum = 0;
    (items || []).forEach(function (item) {
      (item.variants || []).forEach(function (v) { sum += v.bytes; });
    });
    return sum;
  }

  /** The descriptors preflight wants: what will be uploaded, described before
   *  any of it moves. Deliberately carries no blobs — this is the shape that
   *  goes over the wire. */
  function descriptors(items) {
    var out = [];
    (items || []).forEach(function (item) {
      (item.variants || []).forEach(function (v) {
        out.push({ sha256: v.sha256, bytes: v.bytes, type: v.type, w: v.w, h: v.h, variant: v.variant });
      });
    });
    return out;
  }

  /* ── Small helpers ─────────────────────────────────────────────────────── */

  function reason(code, message) {
    var e = new Error(message || code);
    e.code = code;
    e.userMessage = message || code;
    return e;
  }

  function kb(n) { return Math.round(n / 1024) + " KB"; }
  function mb(n) { return (Math.round((n / (1024 * 1024)) * 10) / 10) + " MB"; }

  return {
    prepare: prepare,
    prepareAll: prepareAll,
    descriptors: descriptors,
    totalBytes: totalBytes,
    canEncodeWebp: canEncodeWebp,
    limits: L,
  };
});
