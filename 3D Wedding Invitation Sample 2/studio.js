/* ═══════════ INVITATION STUDIO — landing behaviour ═══════════ */
(() => {
"use strict";

/* ─── EDIT YOUR STUDIO DETAILS HERE ─────────────────────────── */
/* The brand name is written exactly as it appears on the main site —
   "DeepDreams AI Studio". The WhatsApp number and email below were
   placeholders (919999999999, hello@deepdreams.ai), so every guest who
   tapped "Chat on WhatsApp" from this sample reached nobody. They are now
   the studio's real contact details. */
const STUDIO = {
  name: "DeepDreams AI Studio",
  tagline: "Interactive Wedding Invitations",
  email: "k78491809@gmail.com",
  whatsapp: "919010901232",
  instagram: "https://www.instagram.com/deepdreams_lateperson_death_ai",
};
/* ───────────────────────────────────────────────────────────── */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Brand hydration */
$$('[data-studio="name"]').forEach(el => el.textContent = STUDIO.name);
$$('[data-studio="tagline"]').forEach(el => el.textContent = STUDIO.tagline);
$$('[data-studio="mailto"]').forEach(el => el.href = `mailto:${STUDIO.email}`);
$$('[data-studio="whatsapp"]').forEach(el => el.href = `https://wa.me/${STUDIO.whatsapp}`);
$$('[data-studio="instagram"]').forEach(el => el.href = STUDIO.instagram);
const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();
document.title = `${STUDIO.name} — Cinematic Wedding Websites & 3D Invitations`;

/* Nav: solid on scroll + mobile menu */
const nav = $("#nav"), burger = $("#nav-burger");
addEventListener("scroll", () => nav.classList.toggle("solid", scrollY > 24), { passive: true });
burger?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});
$$(".nav-links a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

/* Staggered reveals */
const items = $$(".reveal");
if (REDUCED || !("IntersectionObserver" in window)) {
  items.forEach(el => el.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--d", (i * 90) + "ms");
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10%", threshold: .12 });
  items.forEach(el => io.observe(el));
}

/* ── Phone mockup: shows a real screenshot of the opened invitation.
   The old scroll-scrub canvas was replaced, so this runs only if a
   #phone-scrub element is ever restored. ── */
(() => {
  const phone = $("#phone"), canvas = $("#phone-scrub");
  if (!phone || !canvas || REDUCED) return; // canvas removed → scrub inert
  const conn = navigator.connection || {};
  if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;

  const TOTAL = 181, STEP = 4;
  const idx = [];
  for (let i = 1; i <= TOTAL; i += STEP) idx.push(i);
  const imgs = new Array(idx.length).fill(null);
  const ctx = canvas.getContext("2d", { alpha: false });
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let loaded = 0, started = false, drawnKey = -1, raf = 0;
  let firstFailed = false;

  const sizeCanvas = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    drawnKey = -1;
  };

  const paint = (k) => {
    const im = imgs[k] || imgs.find(Boolean);
    if (!im) return;
    if (canvas.width < 2) sizeCanvas();
    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = "#F4EBDB";
    ctx.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight) * .98;
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) * .4, w, h);
  };

  const loadAll = () => {
    if (started) return;
    started = true;
    let next = 0, inFlight = 0;
    const pump = () => {
      while (inFlight < 4 && next < idx.length) {
        const k = next++;
        inFlight++;
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          imgs[k] = im; inFlight++; loaded++;
          if (loaded === 1) { $("#phone-fallback")?.remove(); paint(0); }
          inFlight--;
          pump();
        };
        im.onerror = () => {
          inFlight--;
          // C6: if the very first frame fails, abort — keep fallback visible
          if (k === 0) { firstFailed = true; return; }
          if (!firstFailed) pump();
        };
        im.src = `assets/frames/lo/f_${String(idx[k]).padStart(3, "0")}.webp`;
      }
    };
    pump();
  };

  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    sizeCanvas();
    loadAll();
  }, { rootMargin: "500px 0px" }).observe(phone);

  const onScroll = () => {
    if (raf || loaded < 2 || firstFailed) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = phone.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (innerHeight * .85 + r.height * .6)));
      const k = Math.min(idx.length - 1, Math.round(p * (idx.length - 1)));
      if (k !== drawnKey && imgs[k]) { drawnKey = k; paint(k); }
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { sizeCanvas(); onScroll(); });
})();

})();
