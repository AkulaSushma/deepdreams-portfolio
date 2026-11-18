/* A lightweight sharing page for the exact video a visitor requests.
   WhatsApp reads these Open Graph fields to show the right thumbnail in the
   studio chat. The page is deliberately noindex: it is a customer-reference
   link, not a public search-result page. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function cleanLabel(value, fallback) {
  const label = String(value || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
  return label.slice(0, 140) || fallback;
}

export async function onRequest(context) {
  const id = String(context.params.videoId || "");
  if (!VIDEO_ID.test(id)) {
    return new Response("Sample not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" }
    });
  }

  const url = new URL(context.request.url);
  const title = cleanLabel(url.searchParams.get("title"), "DeepDreams AI Studio sample video");
  const type = cleanLabel(url.searchParams.get("type"), "Personalised AI video");
  const pageUrl = url.origin + url.pathname + (url.search || "");
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const description = `${type} sample from DeepDreams AI Studio: ${title}.`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | DeepDreams AI Studio</title>
<meta name="robots" content="noindex,nofollow">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="DeepDreams AI Studio">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:image" content="${thumbnail}">
<meta property="og:image:width" content="480"><meta property="og:image:height" content="360">
<meta property="og:video" content="${watchUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${thumbnail}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070c18;color:#fff;font:16px/1.55 system-ui,sans-serif;padding:24px}.card{max-width:520px;text-align:center}.eyebrow{color:#e3c179;letter-spacing:.16em;text-transform:uppercase;font-size:.72rem}h1{font:600 clamp(2rem,7vw,3rem)/1.05 Georgia,serif;margin:.65rem 0}p{color:#c4c9d3}img{width:100%;border-radius:16px;border:1px solid #c79a3a;margin:1rem 0}a{display:inline-block;background:#c79a3a;color:#090a0d;padding:.8rem 1.2rem;border-radius:999px;text-decoration:none;font-weight:700}</style>
</head><body><main class="card"><p class="eyebrow">${escapeHtml(type)} · DeepDreams AI Studio</p><h1>${escapeHtml(title)}</h1><img src="${thumbnail}" alt="Preview of ${escapeHtml(title)}"><p>This is the exact sample selected for the enquiry.</p><a href="${watchUrl}">Open video preview</a></main></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
