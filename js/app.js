/* ============================================================
   DEEPDREAMS — APP LOGIC
   You don't need to edit this. All your details live in config.js
   ============================================================ */
const CFG = window.DD_CONFIG;

/* ---------- helpers ---------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ytId = u => { if (!u) return ""; u = ("" + u).trim();
  const m = u.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : (u.length === 11 ? u : ""); };
const thumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const waLink = () => `https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent(CFG.WHATSAPP_MSG)}`;
const ESC_MAP = { 38:"amp;", 60:"lt;", 62:"gt;", 34:"quot;", 39:"apos;" };
const esc = s => ("" + (s ?? "")).replace(/[&<>'"]/g, c => "&" + ESC_MAP[c.charCodeAt(0)]);

/* ---------- wire up config-driven links ---------- */
$('#yr').textContent = new Date().getFullYear();
['#heroWa', '#waBtn', '#fab'].forEach(s => { const el = $(s); if (el) el.href = waLink(); });
$('#mailBtn').href = `mailto:${CFG.EMAIL}`;
$('#igLink').href  = CFG.INSTAGRAM;
$('#ytLink').href  = CFG.YOUTUBE;
['#heroWa', '#waBtn', '#fab', '#igLink', '#ytLink'].forEach(s => { const el = $(s); if (el) { el.target = "_blank"; el.rel = "noopener"; } });

/* hero featured video */
(() => { const id = ytId(CFG.HERO_VIDEO);
  $('#heroFrame').src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0`;
})();

/* ---------- preloader ---------- */
window.addEventListener('load', () => {
  setTimeout(() => {
    const pre = $('#preloader');
    pre.classList.add('done');
    document.body.classList.remove('loading');
    /* fully remove the preloader layer so it never blocks content */
    setTimeout(() => { pre.style.display = 'none'; }, 850);
    initHero();
  }, 800);
});
document.body.classList.add('loading');

/* ---------- Lenis smooth scroll ---------- */
let lenis;
if (window.Lenis && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothTouch: false });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  if (window.ScrollTrigger) { lenis.on('scroll', () => ScrollTrigger.update()); }
}
/* anchor links via Lenis */
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault();
  lenis ? lenis.scrollTo(t, { offset: -10 }) : t.scrollIntoView({ behavior: 'smooth' });
}));

/* ---------- GSAP entrance animations ---------- */
function initHero() {
  if (!window.gsap) return;
  gsap.registerPlugin(ScrollTrigger);
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to('.hero-title .line>span', { y: 0, duration: 1, stagger: 0.12 })
    .from('.eyebrow', { y: 24, opacity: 0, duration: 0.7 }, '-=0.9')
    .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.6')
    .from('.hero-actions', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
    .to('.hero-video', { opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out' }, '-=0.5');

  /* scroll reveals */
  $$('.reveal').forEach(el => {
    gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%' } });
  });
  $$('.reveal-scale').forEach(el => {
    gsap.to(el, { scale: 1, opacity: 1, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  /* word-by-word statement */
  const st = $('.reveal-words');
  if (st) { st.innerHTML = st.innerHTML.replace(/(<em>.*?<\/em>|[^<>\s]+)/g, m => `<span>${m}</span> `);
    gsap.to('.reveal-words span', { opacity: 1, stagger: 0.06, ease: 'none',
      scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 60%', scrub: true } });
  }

  /* count-up stats */
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count;
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => {
      gsap.to(el, { innerText: end, duration: 1.6, snap: { innerText: 1 }, ease: 'power2.out' });
    } });
  });
}

/* ---------- header scroll state + feed the ocean descent ----------
   The hook app.js already ran is the perfect place to feed
   `oceanScroll(y)` so the dive is piped through Lenis (smoothed),
   rather than letting ocean.js listen to the raw window scroll.    */
let lastY = 0;
function onScroll(y) {
  if (window.oceanScroll) window.oceanScroll(y);
  const h = $('#header');
  h.classList.toggle('scrolled', y > 40);
  h.classList.toggle('hide', y > lastY && y > 140);
  lastY = y;
}
if (lenis) { lenis.on('scroll', ({ scroll }) => onScroll(scroll)); }
else { window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true }); }
/* seed the ocean with the initial position */
if (window.oceanScroll) window.oceanScroll(window.scrollY || 0);

/* ---------- starfield canvas (kept for any caller expecting #stars) ---------- */
(() => {
  const c = $('#stars'); if (!c) return;
  const x = c.getContext('2d'); let w, hh, stars;
  function size() { w = c.width = innerWidth; hh = c.height = innerHeight;
    stars = [...Array(70)].map(() => ({ x: Math.random() * w, y: Math.random() * hh, r: Math.random() * 1.3, a: Math.random(), s: Math.random() * 0.02 + 0.005 })); }
  function draw() { x.clearRect(0, 0, w, hh);
    stars.forEach(st => { st.a += st.s; const o = (Math.sin(st.a) + 1) / 2;
      x.beginPath(); x.arc(st.x, st.y, st.r, 0, 7);
      x.fillStyle = `rgba(${o > 0.6 ? '95,208,255' : '227,193,121'},${o * 0.6})`; x.fill(); });
    requestAnimationFrame(draw); }
  size(); draw(); addEventListener('resize', size);
})();

/* ---------- cursor glow (desktop) ---------- */
(() => {
  const g = $('#cursorGlow'); if (!g) return;
  if (matchMedia('(hover:hover)').matches) {
    addEventListener('mousemove', e => { g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; });
  }
})();

/* ---------- magnetic buttons (desktop) ---------- */
if (matchMedia('(hover:hover)').matches) {
  $$('[data-magnetic]').forEach(el => {
    el.addEventListener('mousemove', e => { const r = el.getBoundingClientRect();
      gsap?.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4 }); });
    el.addEventListener('mouseleave', () => gsap?.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,.4)' }));
  });
}

/* ============================================================
   LIGHTBOX — shared by every video section
   ============================================================ */
function openLB(id, title, isVertical) {
  if (!id) return;
  const videoTitle = title || 'Sample Video';
  const msg = `Hi DeepDreams, I watched your video "${videoTitle}" on your website and I want to request this video style!`;
  const waUrl = `https://wa.me/${CFG.WHATSAPP}?text=${encodeURIComponent(msg)}`;

  const lbInner = $('#lbInner');
  const lbWrapper = $('.lb-wrapper') || lbInner.parentElement;

  if (isVertical) {
    lbInner.classList.add('is-vertical');
    lbInner.classList.remove('is-horizontal');
    lbWrapper?.classList.add('is-vertical-wrapper');
    lbWrapper?.classList.remove('is-horizontal-wrapper');
  } else {
    lbInner.classList.add('is-horizontal');
    lbInner.classList.remove('is-vertical');
    lbWrapper?.classList.add('is-horizontal-wrapper');
    lbWrapper?.classList.remove('is-vertical-wrapper');
  }

  lbInner.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  $('#lbTitle').innerHTML = `
    <div class="lb-action-card">
      <div class="lb-info">
        <span class="lb-tag">SELECTED SAMPLE</span>
        <h3 class="lb-video-heading">${esc(videoTitle)}</h3>
      </div>
      <a href="${waUrl}" target="_blank" rel="noopener" class="lb-wa-btn">
        <svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.737-.979z"/></svg>
        <span>Request This Style</span>
      </a>
    </div>
  `;
  $('#lb').classList.add('open'); lenis?.stop();
}
window.openLB = openLB;   /* expose for carousel.js */
function closeLB() {
  $('#lb').classList.remove('open'); lenis?.start();
  setTimeout(() => { $('#lbInner').innerHTML = ''; $('#lbTitle').textContent = ''; }, 400);
}
$('#lbClose').addEventListener('click', closeLB);
$('#lb').addEventListener('click', e => { if (e.target.id === 'lb') closeLB(); });

/* ---------- UPI ---------- */
$('#upiId').textContent = CFG.UPI_ID;
$('#upiPay').href = `upi://pay?pa=${encodeURIComponent(CFG.UPI_ID)}&pn=${encodeURIComponent(CFG.UPI_NAME)}&cu=INR`;
$('#upiBtn').addEventListener('click', () => { $('#upiModal').classList.add('open'); lenis?.stop(); });
$('#upiClose').addEventListener('click', () => { $('#upiModal').classList.remove('open'); lenis?.start(); });
$('#upiModal').addEventListener('click', e => { if (e.target.id === 'upiModal') { $('#upiModal').classList.remove('open'); lenis?.start(); } });
$('#upiId').addEventListener('click', () => { navigator.clipboard?.writeText(CFG.UPI_ID); $('#upiId').textContent = 'Copied ✓'; setTimeout(() => $('#upiId').textContent = CFG.UPI_ID, 1400); });

/* ---------- marquee ---------- */
(() => {
  const words = ['Tribute Films', 'Memorial Videos', 'Wedding Blessings', 'Name Reveals', 'Invitation Websites', 'AI Cinematics', 'AI Agents', 'Websites'];
  const set = `<span>${words.join('</span><span>')}</span>`;
  $('#marquee').innerHTML = set + set;
})();

/* ---------- esc to close modals ---------- */
addEventListener('keydown', e => { if (e.key === 'Escape') { closeLB(); $('#upiModal').classList.remove('open'); lenis?.start(); } });
