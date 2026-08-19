/* ============================================================================
   LIMITS — one source of truth for every cap in the publishing system.

   Loaded two ways on purpose:
     • the browser, via <script src="/shared/limits.js">  → window.DD_LIMITS
     • the API,     via require("../../shared/limits.js") → module.exports

   The browser copy exists so a customer sees "that photo is too large" while
   they are still choosing it, instead of after a two-minute upload. It is a
   courtesy, never a control: api/_lib/ re-checks every one of these numbers
   server-side, because anything the browser enforces can be switched off with
   the developer console.

   Why these particular numbers — they are not guesses:
     A published wedding site should cost about 2 MB of Supabase Storage. The
     free tier gives 1 GB, so 12 photos × 250 KB caps a site at 3 MB in the
     worst case and about 330 sites fit. Egress matters more than storage:
     5 GB/month ÷ (100 guests × ~720 KB of photos) is roughly 70 fully-viewed
     invitations a month. Raising MAX_PHOTOS is therefore not free — it spends
     bandwidth you have a fixed amount of.
   ========================================================================= */
/* `root` is passed INTO the factory, not merely captured by the wrapper:
   the factory is defined in the enclosing scope, so a bare `root` inside it
   would be an unbound reference and every call would throw. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DD_LIMITS = factory(root);
})(typeof self !== "undefined" ? self : globalThis, function (root) {
  "use strict";

  return {
    /* ---- Photographs ---------------------------------------------------- */
    MAX_PHOTOS: 12,               // per wedding site
    MAX_PHOTO_BYTES: 250 * 1024,  // after client-side compression
    MAX_TOTAL_MEDIA_BYTES: 3 * 1024 * 1024,
    MAX_IMAGE_EDGE: 1600,         // longest side, px

    /* Responsive widths emitted for every photograph. A phone pulls 640w and
       never downloads the desktop file — the single biggest saving on Indian
       mobile data, and on the Supabase egress meter. */
    IMAGE_WIDTHS: [640, 1280],
    IMAGE_QUALITY: 0.82,

    /* WebP where the browser can encode it, JPEG where it cannot (older iOS
       Safari). Re-encoding through a canvas also discards EXIF for free —
       including the GPS coordinates on photographs from the couple's phone. */
    IMAGE_TYPES: ["image/webp", "image/jpeg"],

    /* What a customer may hand the file picker, before compression. Anything
       larger is refused early rather than locking up their phone. */
    MAX_SOURCE_BYTES: 12 * 1024 * 1024,

    /* ---- Content -------------------------------------------------------- */
    MAX_CONTENT_BYTES: 100 * 1024,   // the whole invitation, text only
    MAX_SLUG_LENGTH: 60,

    /* ---- Tokens --------------------------------------------------------- */
    TOKEN_GROUPS: 3,
    TOKEN_GROUP_SIZE: 5,             // DD-XXXXX-XXXXX-XXXXX → 75 bits of entropy

    /* ---- Timing --------------------------------------------------------- */
    UPLOAD_URL_TTL_SECONDS: 600,     // signed upload URLs expire in 10 minutes
    CLIENT_TIMEOUT_MS: 8000,         // then one retry, then a clear message
    CLIENT_RETRIES: 1,
    DRAFT_TTL_DAYS: 7,               // abandoned uploads are swept after this

    /* ---- Rate limits (per IP, per rolling window) ------------------------ */
    RATE: {
      publish:   { limit: 10, windowMs: 10 * 60 * 1000 },
      preflight: { limit: 30, windowMs: 10 * 60 * 1000 },
      recover:   { limit: 10, windowMs: 10 * 60 * 1000 },
      adminLogin:{ limit: 8,  windowMs: 15 * 60 * 1000 },
    },

    /* ---- Page weight budgets (bytes) ------------------------------------
       Not enforced by code — enforced by review. Recorded here so the number
       is somewhere a person will actually look before adding a 4 MB video. */
    PAGE_BUDGET: {
      sample1: { firstView: 700 * 1024, fullPage:  2.5 * 1024 * 1024 },
      sample2: { firstView: 1.2 * 1024 * 1024, fullJourneyMobile: 12 * 1024 * 1024 },
    },
  };
});
