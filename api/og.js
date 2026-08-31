/* ============================================================================
   GET /api/og?b=…&g=…&side=…      (also /invite/og.png via rewrite is NOT
                                     used — this route IS the image)

   The personalised share-card image. Names arrive in the query string of an
   <img>/og:image URL, never in a POST body, because WhatsApp, Telegram and
   Google fetch it with a plain GET and no execution of any kind.

   Only the first initial of each name is ever drawn, and only letters A–Z
   are rendered — anything else falls back to the single-heart card, so a
   query string can never make the renderer crash or draw an unintended
   glyph.

   Cached for a day: the card for a given couple never changes, and a link
   forwarded around a family must not become one render per share.
   ========================================================================= */
"use strict";

const { handler, requireMethod, fail, log } = require("./_lib/http");
const og = require("./_lib/og");

const CACHE = "public, max-age=86400, s-maxage=604800";

const LETTER = /^[A-Za-z]/;

module.exports = handler("og", async (req, res) => {
  /* GET-only: this is an <img>/og:image target, fetched by scrapers with a
     plain GET. Anything else is a probe, and gets a cheap refusal. */
  if (!requireMethod(req, res, "GET")) return;

  const url = new URL(req.url, "http://localhost");
  const b = url.searchParams.get("b") || "";
  const g = url.searchParams.get("g") || "";
  const side = url.searchParams.get("side") || "";
  const mode = url.searchParams.get("mode") === "names" ? "names" : "initials";
  const dParam = url.searchParams.get("d") || "";
  const vParam = url.searchParams.get("v") || "";

  if (!LETTER.test(b) && !LETTER.test(g)) {
    return fail(res, "BAD_REQUEST");
  }

  /* Bride's side: bride's initial first. Groom's side: groom's first. The
     family chose the order everywhere else on the invitation; the share card
     must agree with it. */
  const first = side === "groom" ? g : b;
  const second = side === "groom" ? b : g;

  try {
    /* mode=names renders the couple’s full names in text — Sample 1’s card,
       whose template has no monogram motif. The default remains Sample 2’s
       approved initials card. */
    const png = mode === "names"
      ? og.namesCard(first, second, { date: dParam, venue: vParam })
      : og.shareCard(first, second);
    log("og.rendered", { w: og.W, h: og.H, bytes: png.length, mode });
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", CACHE);
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.end(png);
  } catch (err) {
    log("og.failed", { reason: String(err && err.message) });
    return fail(res, "SERVER");
  }
});
