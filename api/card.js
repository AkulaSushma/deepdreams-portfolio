/* ============================================================================
   GET /3D Wedding Invitation Sample 2/invitation.html?c=…
   (rewritten to /api/card?template=sample2&c=…)

   A preview link built by the editor carries the whole design in the "c"
   query parameter. The browser half is easy — the template's own scripts
   already decode it — but WhatsApp, Telegram and Google read a link card
   from the raw HTML and never run JavaScript. Left as a static file, every
   couple's shared link showed the demo couple's names in the preview.

   So requests that carry ?c= are served here instead: the design is decoded
   from the query string, validated through the same allow-list a published
   invitation goes through, and the template's <head> is rewritten with the
   couple's own names. Requests without ?c= never reach this function — the
   redirect that maps them here is conditioned on the parameter existing.

   No database, no storage: a preview link is self-contained by design, and
   this handler stays as cheap as the static file it replaces.
   ========================================================================= */
"use strict";

const { handler, log, publicOrigin } = require("./_lib/http");
const render = require("./_lib/render");
const publicView = require("./_lib/public-view");

/* A link card is read once by a scraper and occasionally by a guest; the
   design cannot change (it is inside the URL), so a short shared cache is
   safe and keeps a family forwarding the link to two hundred relatives off
   the function for a few minutes at a time. */
const CACHE_OK = "public, max-age=300, stale-while-revalidate=3600";
const CACHE_MISS = "public, max-age=300, stale-while-revalidate=3600";

/* The template's own markup, fetched from this same deployment — without
   the ?c= parameter, which is what keeps this from calling itself. Held
   per warm instance, same pattern as api/invite.js. */
const templateCache = new Map();

async function loadTemplate(template, origin) {
  if (templateCache.has(template)) return templateCache.get(template);

  const path = render.TEMPLATE_SOURCE[template];
  if (!path) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(`${origin}${encodeURI(path)}`, { signal: ac.signal });
    if (!res.ok) throw new Error(`template ${res.status}`);
    const html = await res.text();
    templateCache.set(template, html);
    return html;
  } catch (err) {
    log("card.template_failed", { template, reason: String(err && err.message) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* base64url → JSON. Mirrors the encoder in the editor: UTF-8 bytes carried
   through atob-safe ASCII. Anything that does not decode is someone's hand
   edit of a URL, and gets the same calm card as an unknown slug. */
function decodeDesign(param) {
  try {
    const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/* The <head> for a preview link. Deliberately no og:url and no canonical:
   both would repeat the multi-kilobyte ?c= parameter into a tag, which is
   ugly in every scraper that echoes it back. */
function previewHead(content, origin) {
  const view = { template: "sample2", content };
  const names = String(publicView.coupleLine(view)).slice(0, 80);
  const { date, venue } = publicView.occasion(view);

  const title = `${names} — Wedding Invitation`;
  const description = [
    date ? `Joining hands on ${date}` : "You are warmly invited",
    venue ? `at ${venue}` : "",
    "· With love, from our family to yours.",
  ].filter(Boolean).join(" ");

  const image = render.ogImage(view, origin) || render.fallbackImage("sample2", origin);

  const tags = [
    `<title>${render.escapeHtml(title)}</title>`,
    `<meta name="description" content="${render.escapeHtml(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="DeepDreams AI Studio">`,
    `<meta property="og:title" content="${render.escapeHtml(title)}">`,
    `<meta property="og:description" content="${render.escapeHtml(description)}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${render.escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${render.escapeHtml(description)}">`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${render.escapeHtml(image)}">`);
    tags.push(`<meta name="twitter:image" content="${render.escapeHtml(image)}">`);
  }
  return tags.join("\n");
}

function send(res, status, html, cacheControl) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", cacheControl);
  /* A preview link carries a family's names and venue in the URL itself.
     Meant for the people it was sent to, not for search engines. */
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(html);
}

module.exports = handler("card", async (req, res) => {
  const origin = publicOrigin(req);

  const url = new URL(req.url, "http://localhost");
  const template = url.searchParams.get("template") || "sample2";
  const design = decodeDesign(url.searchParams.get("c") || "");

  if (!render.TEMPLATE_SOURCE[template] || !design) {
    return send(res, 404, render.notFoundPage(origin), CACHE_MISS);
  }

  /* The same allow-list a published invitation passes through, so nothing
     in the query string reaches the page unvalidated. */
  const row = {
    slug: "preview",
    template,
    content: design,
    media: [],
    wedding_date: null,
    updated_at: null,
  };
  const view = publicView.toPublic(row, origin);

  const templateHtml = await loadTemplate(template, origin);
  if (!templateHtml) {
    return send(res, 503, render.maintenancePage(origin), "no-store");
  }

  const html = render.page(templateHtml, view, origin);

  log("card.ok", { template });
  return send(res, 200, html, CACHE_OK);
});
