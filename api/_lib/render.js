/* ============================================================================
   RENDER — turns a published row into the HTML a guest and WhatsApp receive.

   The design decision worth stating plainly: this module does NOT contain a
   copy of either invitation's markup. It fetches the template's own static
   HTML from the same deployment and injects three things into it —

     1. the couple's real og: tags, so the WhatsApp preview card shows their
        names and their photograph instead of the demo couple's;
     2. the published content as inline JSON, so the page needs no fetch and
        renders on the first paint even on a weak connection;
     3. absolute asset paths, because the page is served from /invite/{slug}
        while its images and scripts live in the template's own folder.

   Keeping the markup in one place means a change to the invitation design
   never has to be mirrored here, and can never drift out of step with what
   customers actually previewed before they paid.
   ========================================================================= */
"use strict";

const { coupleLine, coverImage, occasion } = require("./public-view");

/* Where each template's static files live. These are the real on-disk folder
   names, spaces and all; encodeURI turns them into valid URL paths. */
const TEMPLATE_SOURCE = {
  sample1: "/wedding-invite sample 1/invite.html",
  sample2: "/3D Wedding Invitation Sample 2/invitation.html",
};

function baseDirFor(template) {
  const src = TEMPLATE_SOURCE[template];
  return src ? encodeURI(src.slice(0, src.lastIndexOf("/") + 1)) : "/";
}

/* The photograph WhatsApp shows when the couple uploaded none of their own.
   Sample 2 is the normal case here: all of its artwork ships with the
   template, so there is nothing in `media` to fall back to and the invitation
   would otherwise arrive as a bare grey rectangle in the chat.

   Both are JPEG on purpose. WhatsApp's preview renderer is unreliable with
   WebP, which is the reason the template already keeps a JPEG still for this. */
const SHARE_FALLBACK = {
  sample1: "posters/welcome_clean.jpg",
  sample2: "assets/stills/phone-invite.jpg",
};

function fallbackImage(template, origin) {
  const rel = SHARE_FALLBACK[template];
  if (!rel || !origin) return null;
  return origin + baseDirFor(template) + encodeURI(rel);
}

/* ── The personalised share-card image ─────────────────────────────────────
   The static fallback is a screenshot of the demo couple — fine for the
   demo, wrong for everyone else: a couple who shares their link without a
   photograph would have the demo couple's initials in their WhatsApp card.
   The og renderer draws the couple's own two initials on the invitation's
   maroon-and-gold card instead, in the order the family chose. A couple
   who did upload a cover photograph keeps their photograph. */
function ogImage(view, origin) {
  const cp = (view && view.content && view.content.couple) || {};
  const b = cp.bride || "";
  const g = cp.groom || "";
  if (!origin || !b.trim() || !g.trim()) return null;
  const side = cp.side === "groom" ? "groom" : "bride";
  const u = new URL(`${origin}/api/og`);
  u.searchParams.set("b", b);
  u.searchParams.set("g", g);
  u.searchParams.set("side", side);
  return u.toString();
}

/* The image a link card shows: the couple's own photograph if they uploaded
   one, otherwise their initials on the studio card — never the demo couple. */
function shareImage(view, origin) {
  /* Sample 1’s card is the names card: its couples’ photographs carry no
     text, so a bare photo said nothing about whose wedding the link was.
     The card says the names, date and venue in the studio’s gold; the
     photograph itself stays front and centre inside the invitation.
     Sample 2 keeps the seal screen (its own artwork IS the brand). */
  if (view && view.template === "sample1") {
    return ogImage(view, origin) || coverImage(view) || fallbackImage(view.template, origin);
  }
  return coverImage(view) || ogImage(view, origin) || fallbackImage(view.template, origin);
}

/* ── Escaping ───────────────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON inside a <script> block. `<` must be escaped or a caption containing
 *  "</script>" would end the block and everything after it would be parsed as
 *  markup — the oldest injection there is. */
function safeJson(value) {
  /* U+2028 and U+2029 are legal inside a JSON string but end a line of
     JavaScript, so they must be escaped too. Built from char codes rather
     than typed literally — they are invisible in an editor, and an invisible
     character is not something to rely on surviving a copy-paste. */
  const LS = new RegExp(String.fromCharCode(0x2028), "g");
  const PS = new RegExp(String.fromCharCode(0x2029), "g");
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(LS, "\\u2028")
    .replace(PS, "\\u2029");
}

/* ── Asset paths ────────────────────────────────────────────────────────── */

/** Rewrite relative asset references so they still resolve when the document
 *  is served from /invite/{slug}.
 *
 *  A <base href> would have been one line, but it also re-points every "#id"
 *  anchor at the base URL, which breaks in-page navigation — and both
 *  invitations are built almost entirely out of in-page navigation. So the
 *  attributes are rewritten instead, and anything already absolute, or a
 *  fragment, data:, mailto: or tel: link, is left exactly as it was.
 *
 *  External stylesheets need no special handling: once their own href is
 *  absolute, the url() references inside them resolve against it correctly. */
function absolutise(html, baseDir) {
  const skip = /^(https?:|\/\/|\/|#|data:|mailto:|tel:|javascript:|blob:)/i;

  const fixOne = (url) => {
    const trimmed = (url || "").trim();
    if (skip.test(trimmed)) return trimmed;
    const clean = trimmed.replace(/^\.?\//, "");
    return baseDir + encodeURI(clean);
  };

  let out = html.replace(
    /\b(src|href|poster|data-src|data-poster)\s*=\s*"([^"]*)"/gi,
    (m, attr, url) => `${attr}="${fixOne(url)}"`
  );

  /* srcset is a comma-separated list of "url descriptor" pairs. */
  out = out.replace(/\b(srcset|data-srcset)\s*=\s*"([^"]*)"/gi, (m, attr, val) => {
    const fixed = val
      .split(",")
      .map((part) => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) return part;
        bits[0] = fixOne(bits[0]);
        return bits.join(" ");
      })
      .join(", ");
    return `${attr}="${fixed}"`;
  });

  /* url() inside inline <style> blocks and style attributes. */
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, url) =>
    skip.test(url.trim()) ? m : `url(${q}${fixOne(url)}${q})`
  );

  return out;
}

/* ── Head injection ─────────────────────────────────────────────────────── */

/* The templates ship with the demo couple's og: tags hard-coded. Those must be
   removed, not merely followed by ours: WhatsApp reads the first tag it finds,
   so leaving the originals in place would show "Harshitha & Sai Charan" on
   every customer's invitation. */
const STRIP = [
  /<title>[\s\S]*?<\/title>/i,
  /<meta[^>]+property\s*=\s*["']og:[^"']*["'][^>]*>/gi,
  /<meta[^>]+name\s*=\s*["']twitter:[^"']*["'][^>]*>/gi,
  /<meta[^>]+name\s*=\s*["']description["'][^>]*>/gi,
  /<link[^>]+rel\s*=\s*["']canonical["'][^>]*>/gi,
];

function stripHead(html) {
  return STRIP.reduce((acc, re) => acc.replace(re, ""), html);
}

function metaBlock(view, origin) {
  const names = coupleLine(view);
  const { date, venue } = occasion(view);

  const title = `${names} — Wedding Invitation`;
  const description = [
    date ? `Joining hands on ${date}` : "You are warmly invited",
    venue ? `at ${venue}` : "",
    "· With love, from our family to yours.",
  ].filter(Boolean).join(" ");

  const url = `${origin}/invite/${view.slug}`;
  const image = shareImage(view, origin);

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="DeepDreams AI Studio">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];

  /* WhatsApp's crawler does not run JavaScript and will not follow a relative
     path, so the image URL must be absolute and already present in the HTML.
     It is a Supabase Storage URL, which is absolute by construction. */
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`);
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(names)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`);
  }

  return tags.join("\n");
}

/** Build the page a guest receives. */
function page(templateHtml, view, origin) {
  const baseDir = baseDirFor(view.template);

  const head = [
    metaBlock(view, origin),
    /* The published invitation, inlined. Read by the template's own script,
       which prefers it over anything in the URL — so a guest's page never
       depends on a link parameter, and never on a second request. */
    `<script>window.DD_SITE=${safeJson(view)};window.DD_PUBLISHED=true;window.DD_SAMPLE2_BASE=${safeJson(baseDir)};window.DD_SAMPLE1_BASE=${safeJson(baseDir)};</script>`,
    /* Photographs come from Supabase's CDN; warming the connection early
       saves a DNS lookup and a TLS handshake on the critical path. */
    supabaseOrigin() ? `<link rel="preconnect" href="${escapeHtml(supabaseOrigin())}" crossorigin>` : "",
    coverImage(view)
      ? `<link rel="preload" as="image" href="${escapeHtml(coverImage(view))}" fetchpriority="high">`
      : "",
  ].filter(Boolean).join("\n");

  let html = absolutise(stripHead(templateHtml), baseDir);

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${head}\n`);
  } else {
    html = head + html;
  }
  return html;
}

function supabaseOrigin() {
  try { return new URL(process.env.SUPABASE_URL).origin; } catch { return ""; }
}

/* ── Standalone states ──────────────────────────────────────────────────── */

/* Both of these are deliberately self-contained: no stylesheet, no script, no
   dependency on anything that might be the reason the guest is seeing them.
   The visual language matches the studio — deep ink, warm gold, serif — so a
   dead end still looks like it belongs to the same wedding. */
function shellPage({ title, heading, body, cta }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 32px;
    background: radial-gradient(120% 120% at 50% 0%, #14161f 0%, #0b0c12 60%);
    color: #efe9df;
    font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    text-align: center;
  }
  .card { max-width: 30rem; }
  .mark { letter-spacing: .38em; font-size: .68rem; text-transform: uppercase;
          color: #c9a227; font-family: system-ui, -apple-system, sans-serif; }
  h1 { font-size: clamp(1.8rem, 6vw, 2.6rem); font-weight: 500; margin: 1.4rem 0 .8rem; }
  p  { font-size: 1.06rem; line-height: 1.75; color: #b9b2a6; margin: 0 0 1.8rem; }
  a  { display: inline-block; padding: .8rem 1.6rem; border: 1px solid #c9a227;
       border-radius: 999px; color: #c9a227; text-decoration: none; font-size: .92rem;
       letter-spacing: .06em; font-family: system-ui, -apple-system, sans-serif; }
  a:hover { background: #c9a227; color: #0b0c12; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">DeepDreams AI Studio</div>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(body)}</p>
    ${cta ? `<a href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>` : ""}
  </div>
</body>
</html>`;
}

/** A link that was mistyped, or an invitation that has been taken down. It
 *  says neither of those things: a guest cannot act on the difference, and
 *  "this invitation was disabled" is not a sentence anyone wants forwarded
 *  around their family. */
function notFoundPage(origin) {
  return shellPage({
    title: "Invitation not found",
    heading: "This invitation link is not valid",
    body: "The link may have been typed incorrectly, or it may have been shared in a shortened form. Please check with the family who sent it to you.",
    cta: { href: origin || "/", label: "Visit DeepDreams AI Studio" },
  });
}

/** Shown only if the database is unreachable AND the CDN has no stale copy to
 *  fall back on. Says nothing about servers, databases or errors. */
function maintenancePage(origin) {
  return shellPage({
    title: "Just a moment",
    heading: "This invitation is taking a moment to open",
    body: "Please refresh in a few seconds. Nothing has been lost — the invitation is safe and will be here.",
    cta: { href: origin || "/", label: "Visit DeepDreams AI Studio" },
  });
}

module.exports = {
  TEMPLATE_SOURCE, baseDirFor, page,
  notFoundPage, maintenancePage,
  escapeHtml, safeJson, absolutise, stripHead, fallbackImage, ogImage, shareImage,
};
