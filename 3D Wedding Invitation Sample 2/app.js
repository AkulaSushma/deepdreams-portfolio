/* ═══════════════════════════════════════════════════════════
   ROYAL WEDDING INVITE — ENGINE
   Frame-scrub cinema · petals · scratch card
   synth bells · countdown · RSVP · 3D-world portal
   ═══════════════════════════════════════════════════════════ */
(() => {
"use strict";

const CFG = window.WEDDING_CONFIG;
const REDUCED = false; // Force animations ON — original: matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;
const SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);
const DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2);
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/* Vertical band at the bottom of the hero owned by the couple's name board.
   The scrub renderer fits the artwork ABOVE this band, so the board can never
   cover the palace no matter how long the names are. Published by nameBoard. */
let heroBoardReserve = 0;
/* QA shim: "?tick" drives the loop with setTimeout where rAF is unavailable
   (hidden-tab automated testing). Real visitors always get rAF. */
const RAF = /[?&]tick/.test(location.search)
  ? (fn) => setTimeout(() => fn(performance.now()), 16)
  : (fn) => requestAnimationFrame(fn);

/* ── Theme from config ──────────────────────────────────── */
{
  const t = CFG.theme, r = document.documentElement.style;
  r.setProperty("--maroon", t.maroon);
  r.setProperty("--maroon-deep", t.maroonDeep);
  r.setProperty("--gold", t.gold);
  r.setProperty("--gold-soft", t.goldSoft);
  r.setProperty("--ivory", t.ivory);
  r.setProperty("--ink", t.inkOnIvory);
}

/* ── Expiry: show the retired screen ONLY for real guest share links ────────
   A share link carries ?c=… with the couple's encoded data. The demo (bare
   URL), the editor (?draft), and the studio preview must NEVER show the
   expired screen — only a genuine guest link whose wedding date has passed. */
{
  const params = new URLSearchParams(location.search);
  const isGuestLink = !!params.get("c");

  if (isGuestLink) {
    const weddingDate = new Date(CFG.wedding.dateISO);
    const expiryDate = new Date(weddingDate);
    expiryDate.setDate(expiryDate.getDate() + 1);
    expiryDate.setHours(23, 59, 59, 999);

    if (!isNaN(expiryDate) && Date.now() > expiryDate.getTime()) {
      const expiredDiv = $("#expired");
      if (expiredDiv) {
        expiredDiv.hidden = false;
        const titleEl = $("#expiredCouple");
        if (titleEl) titleEl.textContent = `${CFG.couple.bride} ♥ ${CFG.couple.groom}`;
      }
      const loaderDiv = $("#loader");
      if (loaderDiv) loaderDiv.style.display = "none";
      document.body.classList.add("is-expired");
    }
  }
}

/* ── Hydrate every hard-coded name/date from config ────────
   Lets the studio editor regenerate this page for any couple. */
{
  const c = CFG.couple, w = CFG.wedding, v = CFG.venue;
  const set = (sel, txt) => { const n = $(sel); if (n && txt) n.textContent = txt; };
  const meta = (p, txt) => { const n = document.querySelector(`meta[property="${p}"]`); if (n && txt) n.content = txt; };

  document.title = `${c.bride} \u2665 ${c.groom} \u2014 A Royal Wedding Invitation`;
  meta("og:title", `${c.bride} \u2665 ${c.groom} \u2014 The Royal Wedding`);
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content =
    `Join us for the wedding of ${c.bride} & ${c.groom} \u2014 ${w.dateDisplay}, ${v.name}, ${v.city || ""}.`;

  set(".seal-monogram", c.monogram);
  set(".crown-mono", c.monogram);
  set(".countdown-sigil", c.monogram);
  set(".hero-vow", c.tagline);
  set(".countdown-date", w.dateDisplay.replace(",", " \u00b7"));
  set(".countdown-detail", `${w.muhurat}${v.city ? " \u00b7 " + v.city : ""}`);
  set(".finale-script", `${c.bride} & ${c.groom}`);
  set(".finale-date", w.dateShort || w.dateDisplay);
  set(".finale-tag", c.hashtag);

  /* The couple's name board is measured, not guessed — see
     "COUPLE NAME BOARD" further down. Nothing here touches its layout. */

  const seal = $("#seal-btn");
  if (seal) seal.setAttribute("aria-label", `Open the invitation of ${c.bride} and ${c.groom}`);

  /* C1: Hydrate side notes and events eyebrow */
  const ROMAN = ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
  const [yy, mm, dd] = w.dateISO.slice(0, 10).split("-");
  const sl = document.querySelector(".hero-side-left small");
  if (sl) sl.textContent = `${+dd} \u00b7 ${ROMAN[+mm]} \u00b7 ${yy}`;
  const sr = document.querySelector(".hero-side-right small");
  if (sr && v.city) sr.textContent = v.city;
  const evEyebrow = document.querySelector("#events .eyebrow");
  const dayCount = new Set(CFG.events.map(e => e.date)).size;
  if (evEyebrow) evEyebrow.textContent =
    `${dayCount} day${dayCount === 1 ? "" : "s"} of festivity`;

  /* Hydrate video films from config */
  if (Array.isArray(CFG.films)) {
    const videoBands = $$(".film-band video");
    /* A file picked in the editor lives at a blob: address that only works in
       the editor's own browser. It is kept out of the shared link and carried
       in `preview` instead, so the couple can still see their clip while they
       are building the invitation. */
    const isDraft = new URLSearchParams(location.search).has("draft");
    CFG.films.forEach((f, i) => {
      if (videoBands[i] && f) {
        const src = (isDraft && f.preview) || f.src;
        /* Only data-src: assigning .src here defeated the lazy loader below and
           started downloading every film the moment the invitation opened. */
        if (src) videoBands[i].setAttribute("data-src", src);
        if (f.poster) videoBands[i].setAttribute("data-poster", f.poster);
        const caption = videoBands[i].nextElementSibling;
        if (caption) {
          const eb = caption.querySelector(".film-eyebrow");
          if (eb && f.eyebrow) eb.textContent = f.eyebrow;
          const fl = caption.querySelector(".film-line");
          if (fl && f.line) fl.textContent = f.line;
        }
      }
    });
  }

  /* Creator mode vs Viewer mode setup.

     There used to be a share pill here that built a ?c=… link out of whatever
     draft happened to be in localStorage. It is gone. The link a couple sends to
     two hundred relatives is the thing the studio is paid for, so it now comes
     from the server, once, after the activation code is accepted — see
     create.html. Nothing in this page can manufacture one. */
  const p = new URLSearchParams(location.search);
  const published = !!(window.DD_HYDRATE && window.DD_HYDRATE.isPublished());
  const isCreator = !published &&
    (p.has("draft") || document.documentElement.dataset.studioDraft === "1");

  /* The badge is the way back into the editor, so it belongs to the person who
     is still editing — never to a guest, and never on the published site. */
  const draftBadge = $("#draft-badge");
  if (draftBadge && !isCreator) draftBadge.remove();
}

/* ── Stable viewport unit (no URL-bar jumps) ────────────── */
let vhPx = Math.max(window.innerHeight, 1) / 100;
const setVh = () => {
  if (window.innerHeight < 120) return;   // ignore transient 0-height resize events
  vhPx = window.innerHeight / 100;
  document.documentElement.style.setProperty("--vh", vhPx + "px");
};
setVh();
let lastW = window.innerWidth, rzTimer = 0;
const remeasure = () => {
  setVh();
  nameBoard.fit();          // names re-fit first: the canvas needs their height
  scrub.resize();
  petals.resize();
  sanctum.resize();
};
window.addEventListener("resize", () => {
  // On touch devices ignore height-only resizes (URL bar collapse)
  if (IS_TOUCH && window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  remeasure();
  clearTimeout(rzTimer);
  rzTimer = setTimeout(remeasure, 280);   // settle pass after the browser finishes resizing
});
window.addEventListener("orientationchange", () => {
  clearTimeout(rzTimer);
  rzTimer = setTimeout(remeasure, 350);
});

/* ═══════════════ AUDIO — synthesized temple sounds ═══════ */
const audio = (() => {
  let ctx = null, master = null, bgm = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("wed-muted") === "1"; } catch {}
  let bgmFadeToken = 0;

  const init = () => {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();                                  // iOS ships it suspended
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  };

  /* Background score — the real instrument, started inside the tap gesture */
  const startBgm = () => {
    if (bgm) return;
    const baseDir = (window.getSample2BaseUrl ? window.getSample2BaseUrl() : "") || "";
    bgm = new Audio(baseDir + "assets/audio/bgm.m4a");
    bgm.preload = "metadata";
    bgm.loop = true;
    bgm.playsInline = true;
    bgm.volume = 0;
    bgm.muted = muted;
    bgm.play().then(() => fadeBgmTo(0.32, 1900)).catch(() => {});
  };

  const fadeBgmTo = (target, duration = 600, pauseAtEnd = false) => {
    if (!bgm) return;
    const token = ++bgmFadeToken;
    const from = bgm.volume;
    const started = performance.now();
    const step = (now) => {
      if (token !== bgmFadeToken || !bgm) return;
      const p = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - p, 2);
      bgm.volume = clamp(from + (target - from) * eased, 0, 1);
      if (p < 1) requestAnimationFrame(step);
      else if (pauseAtEnd) bgm.pause();
    };
    requestAnimationFrame(step);
  };

  /* Soft airy whoosh for scroll gusts */
  let lastWhoosh = -1;
  const whoosh = (strength = 0.5) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    if (t - lastWhoosh < 0.65) return;
    lastWhoosh = t;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = "bandpass"; f.Q.value = 0.6;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.28);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.75);
  };

  /* Scratchy foil texture while the finger rubs */
  let lastScratch = 0;
  const scratchNoise = () => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    if (t - lastScratch < 0.07) return;
    lastScratch = t;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    f.type = "highpass"; f.frequency.value = 2400 + Math.random() * 1200;
    g.gain.setValueAtTime(0.028, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + 0.09);
  };

  /* Temple bell — inharmonic partials + strike noise */
  const bell = (base = 432, vol = 0.5, dur = 3.2) => {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const partials = [[1, 1], [2.74, 0.45], [5.4, 0.22], [8.93, 0.09]];
    partials.forEach(([ratio, g]) => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = "sine";
      o.frequency.value = base * ratio;
      o.detune.value = (Math.random() - 0.5) * 6;
      gn.gain.setValueAtTime(vol * g * 0.32, now);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + dur * (1 - ratio * 0.06));
      o.connect(gn).connect(master);
      o.start(now); o.stop(now + dur);
    });
    // strike transient
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    src.buffer = nb; f.type = "bandpass"; f.frequency.value = base * 2.7; f.Q.value = 2;
    g2.gain.value = vol * 0.25;
    src.connect(f).connect(g2).connect(master);
    src.start(now);
  };

  const chime = () => bell(864, 0.22, 1.6);

  const toggleMute = () => {
    muted = !muted;
    try { localStorage.setItem("wed-muted", muted ? "1" : "0"); } catch {}
    if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.3);
    if (bgm) bgm.muted = muted;
    return muted;
  };

  const fadeForWorld = (duration = 720) => {
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + duration / 1000);
    }
    fadeBgmTo(0, duration, true);
  };

  const pauseForWorld = () => {
    ++bgmFadeToken;
    if (bgm) {
      bgm.pause();
      bgm.volume = 0;
    }
    if (ctx && ctx.state !== "closed") ctx.suspend().catch(() => {});
  };

  const restoreAfterWorld = () => {
    ++bgmFadeToken;
    if (ctx && ctx.state !== "closed") ctx.resume().catch(() => {});
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, now + 0.45);
    }
    if (bgm && !muted) {
      bgm.volume = 0;
      bgm.play().then(() => fadeBgmTo(0.32, 650)).catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { ctx && ctx.suspend(); bgm && bgm.pause(); }
    else { ctx && ctx.resume(); bgm && !muted && bgm.play().catch(() => {}); }
  });

  return {
    init, bell, chime, startBgm, whoosh, scratchNoise, toggleMute,
    fadeForWorld, pauseForWorld, restoreAfterWorld, isMuted: () => muted,
    hasBgm: () => !!bgm,
  };
})();

/* ═══════════════ FRAME RINGS — pre-decoded bitmap streaming ═
   The old engine decoded images on demand during scroll (decode
   hitches = lag). This one decodes OFF the main thread into
   ImageBitmaps held in a direction-aware ring around the playhead,
   so drawing is always a cheap GPU blit. Evicted bitmaps are
   closed, keeping memory bounded. */
const imgW = (im) => (im && (im.naturalWidth || im.width)) || 0;
const imgH = (im) => (im && (im.naturalHeight || im.height)) || 0;
const HAS_CIB = typeof createImageBitmap === "function";

const createBitmapRing = ({ count, url, keyPrefix, ahead, behind, limit }) => {
  const slot = new Array(count);
  const st = new Uint8Array(count);      // 0 none · 1 loading · 2 ready · 3 failed
  let center = 0, dir = 1, active = 0, streaming = false, retained = true, fullMode = false;

  const evict = () => {
    if (fullMode) return;               // everything stays resident — zero churn while scrubbing
    const ka = retained ? ahead + 6 : 2;
    const kb = retained ? behind + 6 : 2;
    const lo = dir >= 0 ? center - kb : center - ka;
    const hi = dir >= 0 ? center + ka : center + kb;
    for (let i = 0; i < count; i++) {
      if (st[i] === 2 && (i < lo || i > hi)) {
        const b = slot[i];
        if (b && typeof b.close === "function") { try { b.close(); } catch {} }
        slot[i] = null;
        st[i] = 0;
      }
    }
  };

  const load = (i, done) => {
    if (i < 0 || i >= count || st[i] !== 0) return false;
    st[i] = 1;
    active++;
    const finish = (im) => {
      if (im) { im._scrubKey = keyPrefix + i; slot[i] = im; st[i] = 2; }
      else { slot[i] = null; st[i] = 3; }
      active--;
      if (done) done(!!im);
    };
    if (HAS_CIB) {
      fetch(url(i))
        .then((r) => { if (!r.ok) throw 0; return r.blob(); })
        .then((blob) => createImageBitmap(blob))
        .then(finish, () => finish(null));
    } else {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        if (typeof im.decode === "function") im.decode().then(() => finish(im), () => finish(im));
        else finish(im);
      };
      im.onerror = () => finish(null);
      im.src = url(i);
    }
    return true;
  };

  const pump = () => {
    if (!streaming || !retained) return;
    while (active < limit) {
      let idx = -1;
      const fwd = dir >= 0;
      const aSpan = fwd ? ahead : behind, bSpan = fwd ? behind : ahead;
      for (let d = 0; d <= aSpan; d++) {
        const i = center + d;
        if (i < count && st[i] === 0) { idx = i; break; }
      }
      if (idx < 0) for (let d = 1; d <= bSpan; d++) {
        const i = center - d;
        if (i >= 0 && st[i] === 0) { idx = i; break; }
      }
      if (idx < 0 || !load(idx, pump)) return;
    }
  };

  return {
    load,
    reset: (i) => { if (st[i] === 3) st[i] = 0; },
    start: () => { if (!streaming) { streaming = true; pump(); } },
    setRetained: (next) => { retained = next; if (next) pump(); else evict(); },
    setCenter: (i) => {
      const c = clamp(i, 0, count - 1);
      if (c === center) return;
      dir = c > center ? 1 : -1;
      center = c;
      pump();
      evict();
    },
    ready: (i) => (st[i] === 2 ? slot[i] : null),
    nearest: (i, maxD = count) => {
      if (st[i] === 2) return slot[i];
      for (let d = 1; d <= maxD; d++) {
        const a = i + d, b = i - d;
        if (a < count && st[a] === 2) return slot[a];
        if (b >= 0 && st[b] === 2) return slot[b];
      }
      return null;
    },
    /* Decode the ENTIRE film up front — scrolling then never waits on
       network or decode. onProgress gets 0..1; done fires at completion. */
    prebufferAll: (onProgress, done) => {
      fullMode = true;
      streaming = true;
      let readyCount = 0, next = 0, inFlight = 0;
      const bump = () => {
        readyCount++;
        if (onProgress) onProgress(readyCount / count);
        if (readyCount >= count && done) done();
      };
      const pump = () => {
        while (inFlight < 6 && next < count) {
          const i = next++;
          if (st[i] === 2 || st[i] === 3) { bump(); continue; }
          if (st[i] === 1) { setTimeout(() => { bump(); pump(); }, 300); continue; }
          inFlight++;
          load(i, () => { inFlight--; bump(); pump(); });
        }
      };
      pump();
    },
    prime: (i, im) => {
      if (i >= 0 && i < count && im && (im.naturalWidth || im.width)) {
        im._scrubKey = keyPrefix + i;
        slot[i] = im;
        st[i] = 2;
      }
    },
  };
};

/* Capability tier — iPhones report no deviceMemory, so assume capable there. */
const RING_TIER = (() => {
  const mem = Number(navigator.deviceMemory || 8);
  const slow = /(^|-)2g$/.test((navigator.connection || {}).effectiveType || "");
  if (SAVE_DATA || slow || mem <= 2) return "lite";
  return mem < 4 ? "mid" : "full";
})();

/* Interpolation + full prebuffer: iPhones report no deviceMemory (assume 8). */
const FULLBUFFER = RING_TIER === "full" && Number(navigator.deviceMemory || 8) >= 8;
const INTERP = RING_TIER !== "lite";

const frames = (() => {
  const N = CFG.frames.count;
  const name = (i) => CFG.frames.prefix + String(i + 1).padStart(3, "0") + CFG.frames.ext;
  const T = RING_TIER;
  const hiEnabled = T !== "lite";
  const loRing = createBitmapRing({
    count: N,
    url: (i) => CFG.frames.loPath + name(i),
    keyPrefix: "lo-",
    ahead: T === "full" ? 64 : T === "mid" ? 44 : 28,
    behind: T === "full" ? 18 : 12,
    limit: T === "lite" ? 2 : 4,
  });
  const hiRing = hiEnabled ? createBitmapRing({
    count: N,
    url: (i) => CFG.frames.hiPath + name(i),
    keyPrefix: "hi-",
    ahead: T === "full" ? 24 : 12,
    behind: T === "full" ? 10 : 5,
    limit: T === "full" ? 4 : 3,
  }) : null;
  const GATE = Math.min(T === "lite" ? 24 : IS_TOUCH ? 40 : 50, N);
  const GATE_LIMIT = T === "lite" ? 2 : 5;

  /* Entry gate: robust retrying preload of the opening stretch. */
  const preloadLo = (onProgress) => new Promise((resolve, reject) => {
    if (FULLBUFFER) {                    // decode all frames behind the seal screen
      loRing.prebufferAll(onProgress, resolve);
      return;
    }
    if (!GATE) { resolve(); return; }
    let next = 0, readyCount = 0, inFlight = 0, finished = false;
    const attempts = new Uint8Array(GATE);
    const retryQueue = [];
    const MAX_ATTEMPTS = 5;
    const pumpGate = () => {
      if (finished) return;
      while (!finished && inFlight < GATE_LIMIT && (retryQueue.length || next < GATE)) {
        const idx = retryQueue.length ? retryQueue.shift() : next++;
        // Already-decoded frames (e.g. the primed opening frame) never call
        // load()'s callback, so credit them here or the gate never settles.
        if (loRing.ready(idx)) {
          readyCount++;
          onProgress(readyCount / GATE);
          if (readyCount === GATE) { finished = true; resolve(); return; }
          continue;
        }
        loRing.reset(idx);
        attempts[idx]++;
        inFlight++;
        const started = loRing.load(idx, (ok) => {
          inFlight--;
          if (finished) return;
          if (ok) {
            readyCount++;
            onProgress(readyCount / GATE);
            if (readyCount === GATE) { finished = true; resolve(); return; }
          } else if (attempts[idx] >= MAX_ATTEMPTS) {
            finished = true;
            reject(new Error("Opening frame " + (idx + 1) + " could not be prepared"));
            return;
          } else {
            setTimeout(() => {
              if (finished) return;
              retryQueue.push(idx);
              pumpGate();
            }, Math.min(3200, 350 * Math.pow(1.8, attempts[idx])));
          }
          pumpGate();
        });
        if (!started) inFlight--;
      }
    };
    pumpGate();
  });

  return {
    N,
    preloadLo,
    startLo: () => {
      loRing.start();
      if (hiRing) setTimeout(() => hiRing.start(), 1200);
    },
    startHi: () => { if (hiRing) hiRing.start(); },
    setHiCalm: () => {},                  // uniform quality: hi streams continuously
    setDemandActive: (next) => {
      loRing.setRetained(next);
      if (hiRing) hiRing.setRetained(next);
    },
    setPlayhead: (i) => {
      const c = clamp(Math.round(i), 0, N - 1);
      loRing.setCenter(c);
      if (hiRing) hiRing.setCenter(c);
    },
    /* sharpest ready frame — exact hi, near hi, exact lo, then nearest anything */
    get: (i) => {
      if (hiRing) {
        const h = hiRing.ready(i) || hiRing.nearest(i, 2);
        if (h) return h;
      }
      const l = loRing.ready(i);
      if (l) return l;
      const ln = loRing.nearest(i);
      if (ln) return ln;
      return hiRing ? hiRing.nearest(i) : null;
    },
    /* adjacent lo pair for cross-fade interpolation */
    getPair: (i) => {
      const a = loRing.ready(i) || loRing.nearest(i);
      const b = i + 1 < N ? loRing.ready(i + 1) : null;
      return { a, b };
    },
    getHi: (i) => (hiRing ? hiRing.ready(i) : null),
    prime: (i, im) => loRing.prime(i, im),
  };
})();

/* ═══════════════ SCRUB ENGINE — the unfolding ════════════ */
const scrub = (() => {
  const canvas = $("#scrub"), ctx2d = canvas.getContext("2d", { alpha: false });
  const hero = $("#hero");
  // Give each of the 181 frames enough physical scroll distance to advance
  // one-or-two frames per touch sample instead of jumping several at once.
  const SCRUB_VH = IS_TOUCH ? 450 : 340;
  let cur = 0, target = 0, drawn = "", settledFrames = 0, active = true;
  let scrollStart = 0, scrollDistance = 1, backdropKey = "";

  const measureScrollRange = () => {
    const rect = hero.getBoundingClientRect();
    scrollStart = window.scrollY + rect.top;
    scrollDistance = Math.max(rect.height - vhPx * 100, 1);
  };

  new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    frames.setDemandActive(active);
    if (active) {
      measureScrollRange();
      drawn = "";
    }
  }, { rootMargin: "160px 0px" }).observe(hero);

  const resize = () => {
    const nextWidth = Math.round(canvas.clientWidth * DPR);
    const nextHeight = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      ctx2d.imageSmoothingEnabled = true;
      ctx2d.imageSmoothingQuality = "high";
      backdropKey = "";
    }
    ivory = IVORY();
    drawn = "";
    hero.style.height = (SCRUB_VH + 100) * vhPx + "px";
    measureScrollRange();
  };

  const IVORY = () => getComputedStyle(document.documentElement).getPropertyValue("--ivory").trim() || "#F4EBDB";
  let ivory = "#F4EBDB";
  /* Cross-fade between adjacent frames: 12fps source becomes continuous
     motion, because the eye sees a weighted blend, never a step. */
  const drawBlend = (iA, frac, hi, fade) => {
    const pair = frames.getPair(iA);
    if (!imgW(pair.a)) return false;
    if (canvas.width < 2 || canvas.height < 2) { resize(); if (canvas.width < 2) return false; }
    const cw = canvas.width, ch = canvas.height;
    const base = pair.a;
    /* Fit the artwork into what the name board leaves free. A long-name board
       makes the palace smaller; it never gets drawn underneath it. */
    const reserve = Math.min(heroBoardReserve * DPR, ch * 0.46);
    const availH = ch - reserve;
    const s = Math.min(cw / imgW(base), availH / imgH(base)) * 0.97;
    const w = Math.round(imgW(base) * s), h = Math.round(imgH(base) * s);
    const x = Math.round((cw - w) / 2);
    const y = Math.round((availH - h) * 0.42);         // sit slightly above centre
    const nextBackdropKey = `${x}:${y}:${w}:${h}`;
    if (nextBackdropKey !== backdropKey) {
      ctx2d.fillStyle = ivory;
      ctx2d.fillRect(0, 0, cw, ch);
      backdropKey = nextBackdropKey;
    }
    ctx2d.globalAlpha = 1;
    ctx2d.drawImage(base, x, y, w, h);
    if (INTERP && pair.b && frac > 0.02) {
      ctx2d.globalAlpha = frac;
      ctx2d.drawImage(pair.b, x, y, w, h);
    }
    if (hi && fade > 0.02) {
      ctx2d.globalAlpha = fade;
      ctx2d.drawImage(hi, x, y, w, h);
    }
    ctx2d.globalAlpha = 1;
    return true;
  };

  let progress = 0, hiFade = 0;
  const tick = (dt) => {
    if (!active) return 0;
    progress = clamp((window.scrollY - scrollStart) / scrollDistance, 0, 1);
    target = progress * (frames.N - 1);
    cur = lerp(cur, target, 1 - Math.exp(-dt * (IS_TOUCH ? 34 : 26)));
    if (Math.abs(target - cur) < 0.003) cur = target;   // land exactly, stop chasing
    const vel = Math.abs(target - cur);
    const iA = Math.min(Math.floor(cur), frames.N - 1);
    const frac = cur - iA;
    frames.setPlayhead(Math.round(cur));
    // crisp hi-res frame fades in the moment motion calms, melts away on movement
    hiFade = clamp(hiFade + (vel < 0.35 ? dt * 3.2 : -dt * 7), 0, 1);
    const hi = hiFade > 0.02 ? frames.getHi(Math.round(cur)) : null;
    const key = iA + ":" + ((frac * 24) | 0) + ":" + (hi ? ((hiFade * 12) | 0) : -1);
    if (key !== drawn && drawBlend(iA, frac, hi, hiFade)) drawn = key;
    return vel;
  };

  return {
    resize, tick,
    getProgress: () => progress,
    firstPaint: () => drawBlend(0, 0, null, 0),
    /* Forget the cached frame key so the next tick repaints with new geometry */
    invalidate: () => { drawn = ""; backdropKey = ""; },
  };
})();

/* ═══════════════ COUPLE NAME BOARD — measured auto-fit ═══
   The board carries the couple's names over the moving artwork, so it has to
   behave for ANY pair of names — six characters or forty, Latin or Telugu —
   without ever sitting on top of the palace.

   Three guarantees, in this order:

   1. RESERVE. After fitting, the board publishes its own height into
      `heroBoardReserve`. The scrub renderer fits the artwork into the space
      ABOVE that band (see drawBlend). A taller board therefore shrinks the
      palace instead of covering it — overlap is structurally impossible.

   2. MEASURE, DON'T GUESS. The type size is found by shrinking until the names
      fit both the board's inner width AND its height budget
      (BOARD.heightPct of the hero). There are no per-name-length font sizes
      hard-coded anywhere.

   3. LAYOUT. One line — "Bride ♥ Groom" — for as long as that stays legible.
      The moment a single line would need type smaller than BOARD.oneLineMinPx,
      it stacks: groom on top, ♥ in the middle, bride below, each name centred
      and fitted on its own line.

   TO TUNE, EDIT `BOARD` BELOW — nothing else. Never add a name-length special
   case in the CSS or in the hydration block; it will fight this fitter.
*/
const BOARD = {
  maxPx: 60,           // ceiling for the display type on a wide screen
  minPx: 15,           // floor — smaller than this stops being readable
  oneLineMinPx: 23,    // a single line thinner than this stacks instead
  heightPct: 34,       // share of the hero the whole board may occupy (%)
  comfortPx: 21,       // height trimming stops here — the reserve takes over
  safety: 0.97,        // breathing room kept against the board's inner width
  namesShare: 0.62,    // share of the height budget the names themselves may use
  gapPx: 16,           // clear air the artwork keeps above the board
};

const nameBoard = (() => {
  const el = $(".names");
  const card = el && el.closest(".hero-copy-glass");
  const sticky = $(".hero-sticky");
  if (!el || !card) return { fit: () => {} };

  const c = CFG.couple;
  const bride = String(c.bride || "").trim();
  const groom = String(c.groom || "").trim();
  const esc = (t) => t.replace(/[&<>"]/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  /* Letter-by-letter spans drive the cascade entrance. Rebuilt on every
     relayout, because a relayout replaces the markup.
     IMPORTANT: this runs as part of render(), BEFORE anything is measured.
     Each letter becomes an inline-block, and inline-blocks round their advance
     up individually — a long name measured as plain text and split afterwards
     grows by tens of pixels and clips. Always measure the final markup. */
  const cascade = () => {
    let li = 0;
    el.querySelectorAll(".name-word").forEach((word) => {
      const text = word.textContent;
      word.textContent = "";
      for (const ch of text) {
        if (ch.trim() === "") { word.appendChild(document.createTextNode(ch)); continue; }
        const sp = document.createElement("span");
        sp.className = "ltr";
        sp.style.setProperty("--li", li++);
        sp.textContent = ch;
        sp.setAttribute("aria-hidden", "true");
        word.appendChild(sp);
      }
    });
    const isGroomSide = (c.side === "groom");
    const first = isGroomSide ? groom : bride;
    const second = isGroomSide ? bride : groom;

    const amp = el.querySelector(".amp");
    if (amp) { amp.classList.add("ltr"); amp.style.setProperty("--li", li++); amp.setAttribute("aria-hidden", "true"); }
    el.setAttribute("aria-label", `${first} and ${second}`);
  };

  const render = (stacked) => {
    const isGroomSide = (c.side === "groom");
    const first = isGroomSide ? groom : bride;
    const second = isGroomSide ? bride : groom;

    el.innerHTML = stacked
      ? `<span class="name-word">${esc(first)}</span>` +
        `<span class="amp">\u2665</span>` +
        `<span class="name-word">${esc(second)}</span>`
      : `<span class="name-word">${esc(first)}</span> <span class="amp">\u2665</span> ` +
        `<span class="name-word">${esc(second)}</span>`;
    el.classList.toggle("names--stacked", stacked);
    card.classList.toggle("hero-copy-glass--stacked", stacked);
    cascade();
  };

  /* The board is width:fit-content, so its CURRENT width is whatever the names
     already are — useless as a yardstick, and circular if used as one. Measure
     against the widest the board is ALLOWED to become instead. */
  const availWidth = () => {
    const cs = getComputedStyle(card);
    const holder = card.parentElement;
    let room = window.innerWidth;
    if (holder) {
      const hs = getComputedStyle(holder);
      room = holder.clientWidth - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight);
    }
    const cap = parseFloat(cs.maxWidth) || room;
    return Math.max(Math.min(cap, room) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), 60);
  };
  /* Size is published as a root custom property (--names-fs) rather than an
     inline style on the heading: one place to look, and it survives any
     re-render of the names markup. */
  const setPx = (px) => {
    const v = Math.round(px * 100) / 100 + "px";
    document.documentElement.style.setProperty("--names-fs", v);
    /* An !important inline font-size placed directly on the element.
       styles.css scopes `.names, .names * { transition-property: none }`
       inside @media (prefers-reduced-motion) so the font-size transition
       does not freeze the computed value at the fallback clamp. */
    el.style.setProperty("font-size", v, "important");
  };

  /* WHY CANVAS AND NOT scrollWidth:
     the obvious fitter writes a size, reads el.scrollWidth, shrinks, repeats.
     That read is only trustworthy once the browser has re-laid-out, and a
     document that is hidden or frame-throttled hands back the PREVIOUS
     geometry — so every pass looks too wide and the loop grinds down to the
     floor. Canvas text metrics are pure measurement: same font, same tracking,
     no layout involved, correct on the first try. */
  const gauge = (() => {
    try { return document.createElement("canvas").getContext("2d"); }
    catch { return null; }
  })();
  const REF = 100;                       // measure once at 100px, then scale
  const textWidthAt = (text, px) => {
    const cs = getComputedStyle(el);
    gauge.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    const cur = parseFloat(cs.fontSize) || px;
    const track = (parseFloat(cs.letterSpacing) || 0) / cur * px;   // px → em → px
    return gauge.measureText(text).width + track * text.length;
  };
  /* The largest size at which `text` still fits the board's inner width. */
  const sizeFor = (text) => {
    if (!gauge || !text) return BOARD.maxPx;
    const per = textWidthAt(text, REF) / REF;                       // width per px of type
    if (!per) return BOARD.maxPx;
    return clamp(availWidth() * BOARD.safety / per, BOARD.minPx, BOARD.maxPx);
  };

  /* Height is a SOFT constraint. On a short viewport the eyebrow, vow and
     scroll hint alone can exceed the budget, and shrinking the names to nothing
     would not fix that — so the names give up height only down to
     BOARD.comfortPx and the reserve band absorbs whatever is left. The artwork
     shrinks; it is never covered. Computed from the line count, not from a
     layout read, for the same reason as the width fit. */
  const capToHeight = (px, lines, budget) => {
    const hCap = budget * BOARD.namesShare / (lines * 1.12);
    /* Height is a soft constraint: it shrinks the names only on a short viewport.
       Width is hard — the names must fit the board. If the width fit is below
       oneLineMinPx (i.e., we stacked for width), the width constraint is binding
       and comfortPx should not override it — the width already won. Only apply
       comfortPx when height was the real constraint. */
    if (px < BOARD.oneLineMinPx) return Math.max(BOARD.minPx, Math.min(px, hCap));
    return Math.max(BOARD.comfortPx, Math.min(px, hCap));
  };

  /* Publish the band the artwork must stay clear of. Height IS read from
     layout — but it only decides how much room the palace gets, it is applied
     on the next frame anyway, and it re-publishes on every resize, so a late or
     stale value costs nothing and corrects itself. */
  const publish = () => {
    const next = Math.ceil(card.getBoundingClientRect().height + BOARD.gapPx);
    if (next === heroBoardReserve || next < BOARD.gapPx * 2) return;
    heroBoardReserve = next;
    document.documentElement.style.setProperty("--board-h", next + "px");
    scrub.invalidate();
    try { scrub.firstPaint(); } catch { /* a paint must never block entry */ }
  };

  const fit = () => {
    const heroH = (sticky && sticky.clientHeight) || window.innerHeight;
    const budget = Math.max(130, heroH * BOARD.heightPct / 100);

    /* Measure first, render after. The one-line measurement determines whether
       we stack, and render() then produces the right markup in one shot. */
    const oneLinePx = sizeFor(`${bride} ♥ ${groom}`);
    const stacked = oneLinePx < BOARD.oneLineMinPx;
    render(stacked);
    const px = stacked
      ? Math.min(sizeFor(bride), sizeFor(groom))
      : oneLinePx;
    const lines = stacked ? 2.9 : 1;

    setPx(capToHeight(px, lines, budget));
    publish();                           // a reserve now…
    RAF(publish);                        // …and the real one once this size lays out
  };

  fit();
  /* Webfonts change every measurement, so fit again once they land. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { fit(); }).catch(() => {});
  }
  return { fit };
})();

/* ═══════════════ PETALS — ambient particle system ════════ */
const petals = (() => {
  const canvas = $("#petals"), c = canvas.getContext("2d");
  let petalDpr = IS_TOUCH ? 1 : Math.min(DPR, 1.25);
  const COLORS = [
    ["#8C2B47", "#5C1428"],   // rose maroon
    ["#E5B54B", "#C9922B"],   // marigold
    ["#F4EBDB", "#E0CDA8"],   // ivory
  ];
  /* Pre-render each petal once. Drawing sprites is considerably cheaper than
     rebuilding a gradient and Bezier path for every particle on every frame. */
  const SPRITES = COLORS.map(([c1, c2]) => {
    const sprite = document.createElement("canvas");
    sprite.width = 48; sprite.height = 64;
    const sc = sprite.getContext("2d");
    const gradient = sc.createLinearGradient(24, 2, 24, 62);
    gradient.addColorStop(0, c1); gradient.addColorStop(1, c2);
    sc.fillStyle = gradient;
    sc.beginPath();
    sc.moveTo(24, 2);
    sc.quadraticCurveTo(46, 21, 24, 62);
    sc.quadraticCurveTo(2, 21, 24, 2);
    sc.fill();
    return sprite;
  });
  let list = [], gust = 0, running = false, lowPerf = false, paintAcc = 0;

  const resize = () => {
    canvas.width = Math.round(innerWidth * petalDpr);
    canvas.height = Math.round(innerHeight * petalDpr);
  };

  const spawn = (x, y, burst = false) => {
    const sprite = (Math.random() * SPRITES.length) | 0;
    list.push({
      x: x ?? Math.random() * innerWidth,
      y: y ?? -30,
      s: 7 + Math.random() * 11,
      vy: (burst ? 1.5 : 0.35) + Math.random() * 0.55,
      vx: burst ? (Math.random() - 0.5) * 3 : 0,
      ph: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.04,
      sprite,
      burst,
      life: 1,
      fade: burst ? 0.004 : 0,
    });
  };

  const baseCount = () => (lowPerf ? 2 : IS_TOUCH ? 4 : 8);

  const step = (dt) => {
    if (!running) return;
    paintAcc += dt;
    const interval = 1 / (lowPerf ? 18 : IS_TOUCH ? 24 : 30);
    if (paintAcc < interval) return;
    dt = Math.min(paintAcc, 0.06);
    paintAcc = 0;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const n = baseCount();
    if (list.length < n && Math.random() < 0.1) spawn();
    gust *= Math.pow(0.92, dt * 60);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.ph += dt * 1.6;
      p.x += (Math.sin(p.ph) * 0.5 + p.vx) * dt * 60;
      p.y += (p.vy + gust) * dt * 60;
      p.rot += (p.vr + Math.sin(p.ph) * 0.008) * dt * 60;
      p.vx *= Math.pow(0.97, dt * 60);
      if (p.fade) p.life -= p.fade * dt * 600;
      if (p.y > innerHeight + 40 || p.life <= 0) { list.splice(i, 1); continue; }
      // draw petal
      c.save();
      c.translate(p.x * petalDpr, p.y * petalDpr);
      c.rotate(p.rot);
      c.scale(petalDpr, petalDpr);
      c.globalAlpha = 0.78 * Math.max(p.life, 0);
      c.drawImage(SPRITES[p.sprite], -p.s * 0.78, -p.s, p.s * 1.56, p.s * 2);
      c.restore();
    }
  };

  return {
    resize, step,
    start: () => { running = true; paintAcc = 1; gust = 0; },
    addGust: (g) => { if (running) gust = clamp(gust + g, -2, 4); },
    burst: (x, y, n = 12) => {
      if (!running) return;
      const cap = lowPerf ? 6 : IS_TOUCH ? 8 : 12;
      for (let i = 0; i < Math.min(n, cap); i++) spawn(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 40, true);
    },
    setLowPerf: () => {
      lowPerf = true;
      if (petalDpr > 1) { petalDpr = 1; resize(); }
      let ambient = 0, transient = 0;
      list = list.filter((p) => p.burst ? transient++ < 6 : ambient++ < 2);
    },
  };
})();

/* ═══════════════ COUNTDOWN ═══════════════════════════════ */
(() => {
  const tgt = new Date(CFG.wedding.dateISO).getTime();
  const el = { d: $("#cd-d"), h: $("#cd-h"), m: $("#cd-m"), s: $("#cd-s") };
  const pad = (n) => String(n).padStart(2, "0");
  const set = (node, txt) => { if (node.textContent !== txt) node.textContent = txt; };
  const upd = () => {
    let ms = tgt - Date.now();
    if (ms <= 0) {
      $("#countdown").innerHTML = `<p class="countdown-complete">కల్యాణ శుభ ముహూర్తం · Today, forever begins.</p>`;
      clearInterval(iv);
      return;
    }
    set(el.d, pad(ms / 864e5 | 0));
    set(el.h, pad((ms / 36e5 | 0) % 24));
    set(el.m, pad((ms / 6e4 | 0) % 60));
    set(el.s, pad((ms / 1e3 | 0) % 60));
  };
  const iv = setInterval(upd, 1000);
  upd();
})();

/* ═══════════════ EVENT CARDS ═════════════════════════════ */
(() => {
  const ICONS = {
    haldi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 13h16c0 3.5-2.5 7-8 7s-8-3.5-8-7z"/><path d="M12 10c0-2.4 1.8-3.2 1.8-5M9 10c0-1.7 1.2-2.3 1.2-3.8M15 10c0-1.7 1.2-2.3 1.2-3.8"/></svg>`,
    sangeet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/></svg>`,
    wedding: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3c2.8 3.2 5 5.9 5 9a5 5 0 0 1-10 0c0-3.1 2.2-5.8 5-9z"/><path d="M12 21v-4"/><path d="M7 21h10"/></svg>`,
    reception: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3h4l-1.2 7a2.8 2.8 0 1 1-1.6 0z" transform="rotate(-14 9 12)"/><path d="M13 3h4l-1.2 7a2.8 2.8 0 1 1-1.6 0z" transform="rotate(14 15 12)"/><path d="M12 2l.5 1.5M10 1.5l0 1"/></svg>`,
  };
  const wrap = $("#event-cards");
  CFG.events.forEach((ev) => {
    const card = document.createElement("article");
    card.className = "event-card";
    card.style.setProperty("--accent", ev.accent);
    card.innerHTML = `
      <span class="event-ico">${ICONS[ev.icon] || ICONS.wedding}</span>
      <h3 class="event-name">${ev.name}</h3>
      <p class="event-line">${ev.line}</p>
      <p class="event-meta"><b>${ev.date}</b> · ${ev.time}<br>${ev.venue}</p>`;
    wrap.appendChild(card);
  });

  let chimed = 0;
  const show = (el, stagger) => setTimeout(() => {
    el.classList.add("shown");
    if (chimed++ < 4) audio.chime();
  }, 120 * stagger);
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        show(e.target, [...wrap.children].indexOf(e.target));
        io.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    [...wrap.children].forEach((el) => io.observe(el));
  } else {
    [...wrap.children].forEach((el, i) => show(el, i));
  }
})();

/* ═══════════════ SCRATCH CARD ════════════════════════════ */
(() => {
  $("#scratch-heading").textContent = CFG.scratch.heading;
  $("#scratch-message").textContent = CFG.scratch.message;

  const canvas = $("#scratch-foil"), c = canvas.getContext("2d");
  const wrap = $("#scratch-wrap");
  let painted = false, cleared = false, strokes = 0, foilW = 0, foilH = 0;

  /* Run the decorative border only while the card is near the viewport. */
  if (!REDUCED && "IntersectionObserver" in window) {
    const borderObserver = new IntersectionObserver(([entry]) => {
      wrap.classList.toggle("scratch-border-active", entry.isIntersecting);
    }, { rootMargin: "14% 0px", threshold: 0.04 });
    borderObserver.observe(wrap);
  } else if (!REDUCED) wrap.classList.add("scratch-border-active");

  const paintFoil = () => {
    foilW = wrap.clientWidth; foilH = wrap.clientHeight;
    const w = canvas.width = foilW * DPR;
    const h = canvas.height = foilH * DPR;
    const g = c.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, "#D9B45C"); g.addColorStop(0.35, "#B8923B");
    g.addColorStop(0.55, "#EBD292"); g.addColorStop(0.8, "#C09A40");
    g.addColorStop(1, "#A37F2E");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // speckle texture
    c.globalAlpha = 0.12;
    for (let i = 0, count = IS_TOUCH ? 320 : 600; i < count; i++) {
      c.fillStyle = Math.random() > 0.5 ? "#fff" : "#6b5215";
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    c.globalAlpha = 1;
    // ornament ring + text
    c.strokeStyle = "rgba(90,60,10,.55)";
    c.lineWidth = 2 * DPR;
    c.setLineDash([6 * DPR, 5 * DPR]);
    c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(74,15,34,.78)";
    c.font = `600 ${15 * DPR}px Cinzel, serif`;
    c.textAlign = "center";
    c.fillText("SCRATCH HERE", w / 2, h / 2 - 6 * DPR);
    c.font = `${24 * DPR}px serif`;
    c.fillText("🪙", w / 2, h / 2 + 26 * DPR);
    painted = true;
  };
  const prepareFoil = () => { if (!painted && !cleared) paintFoil(); };
  if ("IntersectionObserver" in window) {
    const foilObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      prepareFoil();
      foilObserver.disconnect();
    }, { rootMargin: "700px 0px" });
    foilObserver.observe(wrap);
  } else setTimeout(prepareFoil, 0);
  /* Repaint only on REAL size changes (rotation) — a repaint wipes scratch
     progress, and mobile URL-bar collapse fires tiny resizes constantly. */
  new ResizeObserver(() => {
    if (!painted || cleared || strokes > 0) return;   // never wipe scratch progress
    const dw = Math.abs(wrap.clientWidth - foilW), dh = Math.abs(wrap.clientHeight - foilH);
    if (dw < 24 && dh < 24) return;
    foilW = wrap.clientWidth; foilH = wrap.clientHeight;
    paintFoil();
  }).observe(wrap);

  /* Track the scratched area on a tiny logical grid. This avoids expensive
     full-canvas pixel readbacks while a finger is moving. */
  const GRID_W = 36, GRID_H = 48;
  const scratched = new Uint8Array(GRID_W * GRID_H);
  let scratchedCells = 0;
  const markScratched = (from, to) => {
    const ax = from ? from.x / canvas.width * GRID_W : to.x / canvas.width * GRID_W;
    const ay = from ? from.y / canvas.height * GRID_H : to.y / canvas.height * GRID_H;
    const bx = to.x / canvas.width * GRID_W;
    const by = to.y / canvas.height * GRID_H;
    const rx = Math.max(1, c.lineWidth * 0.5 / canvas.width * GRID_W);
    const ry = Math.max(1, c.lineWidth * 0.5 / canvas.height * GRID_H);
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, Math.min(rx, ry) * .55)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const gx = lerp(ax, bx, t), gy = lerp(ay, by, t);
      const x0 = Math.max(0, Math.floor(gx - rx)), x1 = Math.min(GRID_W - 1, Math.ceil(gx + rx));
      const y0 = Math.max(0, Math.floor(gy - ry)), y1 = Math.min(GRID_H - 1, Math.ceil(gy + ry));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = (x + .5 - gx) / rx, dy = (y + .5 - gy) / ry;
          const cell = y * GRID_W + x;
          if (dx * dx + dy * dy <= 1 && !scratched[cell]) {
            scratched[cell] = 1;
            scratchedCells++;
          }
        }
      }
    }
    return scratchedCells / scratched.length > .55;
  };

  let last = null, scratchRect = null, activePointer = null;
  const DBG = /[?&]tick/.test(location.search) ? (window.__scratchDbg = { calls: 0, drawn: 0, blocked: "" }) : null;
  const scratch = (e) => {
    if (DBG) DBG.calls++;
    if (cleared || !painted) { if (DBG) DBG.blocked = `cleared=${cleared} painted=${painted}`; return; }
    if (DBG) DBG.drawn++;
    const r = scratchRect || canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    c.globalCompositeOperation = "destination-out";
    c.lineWidth = 46 * DPR;
    c.lineCap = "round";
    c.beginPath();
    if (last) c.moveTo(last.x, last.y); else c.moveTo(x - 0.1, y);
    c.lineTo(x, y);
    c.stroke();
    c.globalCompositeOperation = "source-over";
    const enough = markScratched(last, { x, y });
    last = { x, y };
    audio.scratchNoise();
    if (++strokes % 4 === 0 && enough) reveal();
  };

  const reveal = () => {
    cleared = true;
    canvas.classList.add("cleared");
    wrap.classList.add("celebrate");
    // a small ceremony: three rising bells + petal fountain + shimmer flash
    audio.bell(520, 0.5, 2.6);
    setTimeout(() => audio.bell(660, 0.42, 2.4), 260);
    setTimeout(() => audio.bell(880, 0.36, 3.0), 540);
    if (navigator.vibrate) navigator.vibrate([30, 80, 30, 80, 60]);
    const r = wrap.getBoundingClientRect();
    petals.burst(r.left + r.width / 2, r.top + r.height / 3, IS_TOUCH ? 8 : 12);
    setTimeout(() => petals.burst(r.left + r.width / 2, r.top + r.height / 2, IS_TOUCH ? 5 : 8), 450);
    setTimeout(() => petals.burst(r.left + r.width / 2, r.top + r.height / 4, IS_TOUCH ? 4 : 6), 900);
  };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    prepareFoil();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    activePointer = e.pointerId;
    scratchRect = canvas.getBoundingClientRect();
    last = null;
    scratch(e);
  }, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointer) return;
    e.preventDefault();
    const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
    const samples = coalesced?.length ? coalesced : [e];
    samples.forEach(scratch);
  }, { passive: false });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => canvas.addEventListener(eventName, () => {
    activePointer = null;
    last = null;
    scratchRect = null;
  }));
})();

/* ═══════════════ SANCTUM — scroll-unlocked hidden film ═══ */
const sanctum = (() => {
  const sec = $("#sanctum");
  if (!sec) return { tick: () => {}, resize: () => {} };
  const S = CFG.sanctum;
  $("#sanctum-eyebrow").textContent = S.eyebrow;
  $("#sanctum-heading").textContent = S.heading;
  $("#sanctum-hint").textContent = S.hint;
  $("#sanctum-veil-text").textContent = S.veilText;
  const canvas = $("#sanctum-canvas"), c = canvas.getContext("2d", { alpha: false });
  const progressEl = $("#sanctum-progress"), veilText = $("#sanctum-veil-text");
  const ring = createBitmapRing({
    count: S.count,
    url: (i) => S.path + S.prefix + String(i + 1).padStart(3, "0") + S.ext,
    keyPrefix: "sanctum-",
    ahead: RING_TIER === "full" ? 24 : RING_TIER === "mid" ? 16 : 10,
    behind: RING_TIER === "full" ? 9 : 6,
    limit: RING_TIER === "lite" ? 2 : 4,
  });
  const gateCount = Math.min(SAVE_DATA ? 6 : IS_TOUCH ? 10 : 16, S.count);
  let state = "locked";            // locked → loading → unlocked
  let inView = false, cur = 0, target = 0, drawn = "";
  let scrollStart = 0, scrollDistance = 1, loadCenter = -1, progressFrame = -1;

  const measureScrollRange = (rect = null) => {
    const r = rect || sec.getBoundingClientRect();
    scrollStart = window.scrollY + r.top;
    scrollDistance = Math.max(r.height - vhPx * 100, 1);
  };

  new IntersectionObserver((es) => {
    es.forEach((e) => {
      inView = e.isIntersecting;
      if (e.isIntersecting) {
        measureScrollRange(e.boundingClientRect);
        if (state === "locked") load();   // everyone gets the moment
        else if (state === "unlocked") ring.setRetained(true);
      } else if (state === "unlocked") ring.setRetained(false);
    });
  }, { rootMargin: SAVE_DATA ? "240px 0px" : IS_TOUCH ? "520px 0px" : "700px 0px" }).observe(sec);

  const load = () => {
    state = "loading";
    sec.classList.add("loading");
    veilText.textContent = "Unfolding…";
    progressEl.classList.remove("hidden");
    if (FULLBUFFER) {                    // hold the whole hidden film in hand
      ring.prebufferAll(
        (f) => { progressEl.textContent = Math.round(f * 100) + "%"; },
        unlock
      );
      return;
    }
    let done = 0, next = 0, inFlight = 0;
    const pump = () => {
      while (inFlight < 4 && next < gateCount) {
        const i = next++;
        inFlight++;
        ring.load(i, () => {
          inFlight--;
          done++;
          progressEl.textContent = Math.round(done / gateCount * 100) + "%";
          if (done === gateCount) unlock();
          else pump();
        });
      }
    };
    pump();
  };

  const resize = () => {
    measureScrollRange();
    const r = canvas.getBoundingClientRect();
    if (r.width < 2) return;
    const nextWidth = Math.round(r.width * DPR);
    const nextHeight = Math.round(r.height * DPR);
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    drawn = "";
  };


  const drawPair = (iA, frac) => {
    const a = ring.ready(iA) || ring.nearest(iA);
    if (!imgW(a)) return false;
    if (canvas.width < 2) resize();
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / imgW(a), ch / imgH(a));
    const w = imgW(a) * s, h = imgH(a) * s;
    const x = (cw - w) / 2, y = (ch - h) / 2;
    c.globalAlpha = 1;
    c.drawImage(a, x, y, w, h);
    const b = INTERP && frac > 0.02 && iA + 1 < S.count ? ring.ready(iA + 1) : null;
    if (b) {
      c.globalAlpha = frac;
      c.drawImage(b, x, y, w, h);
    }
    c.globalAlpha = 1;
    return true;
  };

  const unlock = () => {
    state = "unlocked";
    resize();
    ring.start();
    ring.setRetained(inView);
    if (drawPair(0, 0)) drawn = "s:0:0";
    sec.classList.remove("loading");
    sec.classList.add("unlocked");
    audio.bell(560, 0.5, 3.4);
    if (navigator.vibrate) navigator.vibrate([20, 60, 30]);
    setTimeout(() => {
      const r = sec.querySelector("#sanctum-portal").getBoundingClientRect();
      petals.burst(r.left + r.width / 2, r.top + r.height / 3, IS_TOUCH ? 8 : 12);
    }, 920);
  };

  const tick = (dt) => {
    if (state !== "unlocked" || !inView) return;
    const p = clamp((window.scrollY - scrollStart) / scrollDistance, 0, 1);
    target = p * (S.count - 1);
    const gap = Math.abs(target - cur);
    const response = IS_TOUCH ? (gap > 8 ? 16 : 11) : (gap > 8 ? 12 : 8);
    cur = lerp(cur, target, 1 - Math.exp(-dt * response));
    if (Math.abs(target - cur) < 0.003) cur = target;
    const i = Math.round(cur);
    const nextLoadCenter = Math.round(target);
    if (nextLoadCenter !== loadCenter) {
      loadCenter = nextLoadCenter;
      ring.setCenter(nextLoadCenter);
    }
    const iA = Math.min(Math.floor(cur), S.count - 1);
    const frac = cur - iA;
    const key = "s:" + iA + ":" + ((frac * 24) | 0);
    if (key !== drawn && drawPair(iA, frac)) drawn = key;
    if (i !== progressFrame) {
      progressFrame = i;
      fillEl.style.transform = `scaleX(${(i / (S.count - 1)).toFixed(3)})`;
    }
  };
  const fillEl = $("#sanctum-fill");

  return {
    tick,
    resize: () => { if (state === "unlocked") resize(); else if (inView) measureScrollRange(); },
  };
})();

/* ═══════════════ DECOR PARALLAX — cached offsets, compositor-only ═
   Depth cutouts drift with scroll. Offsets are measured once (and on
   resize), so the per-frame cost is pure arithmetic + a transform —
   no layout reads, nothing the compositor can't handle. */
const decor = (() => {
  const els = [...document.querySelectorAll(".decor[data-depth]")].map((el) => ({
    el, depth: parseFloat(el.dataset.depth) || 0, top: 0, h: 0, on: false, y: 0,
  }));
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      e.target.classList.toggle("shown", e.isIntersecting);
      const rec = els.find((r) => r.el === e.target);
      if (rec) rec.on = e.isIntersecting;
    });
  }, { threshold: 0.04 });
  document.querySelectorAll(".decor, .foot-diya").forEach((el) => io.observe(el));

  const measure = () => {
    els.forEach((r) => {
      const rect = r.el.getBoundingClientRect();
      r.top = rect.top + scrollY - r.y;      // subtract our own applied offset
      r.h = rect.height;
    });
  };
  addEventListener("load", () => setTimeout(measure, 60), { once: true });

  const tick = () => {
    if (!els.length) return;
    const mid = scrollY + innerHeight / 2;
    els.forEach((r) => {
      if (!r.on || !r.h) return;
      const y = (r.top + r.h / 2 - mid) * -r.depth;
      if (Math.abs(y - r.y) < 0.4) return;
      r.y = y;
      r.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  };
  return { tick, measure };
})();

/* ═══════════════ VENUE + RSVP ════════════════════════════ */
(() => {
  $("#venue-name").textContent = CFG.venue.name;
  $("#venue-address").textContent = CFG.venue.address;
  const mapsHref = "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(CFG.venue.mapsQuery);
  $("#maps-btn").href = mapsHref;
  const mapLink = $("#map-link");
  if (mapLink) mapLink.href = mapsHref;
  $("#rsvp-deadline").textContent = CFG.rsvp.deadline;

  const modal = $("#rsvp-modal"), slot = $("#rsvp-frame-slot");

  /* A Google Form link only renders inside an iframe when it is the long
     /viewform address AND carries embedded=true. The link Google offers under
     "Send" is a forms.gle short link, and that redirect page refuses to be
     framed — which is why the modal opened onto a blank white box. Normalise
     what can be normalised, and refuse to frame what cannot. */
  const normaliseForm = (raw) => {
    const url = String(raw || "").trim();
    if (!url || /PLACEHOLDER/i.test(url)) return { mode: "native" };
    let u;
    try { u = new URL(url, location.href); } catch { return { mode: "native" }; }
    if (!/^https?:$/.test(u.protocol)) return { mode: "native" };
    /* Short links and the /edit address can never be embedded. */
    if (/(^|\.)forms\.gle$/i.test(u.hostname) || /(^|\.)goo\.gl$/i.test(u.hostname))
      return { mode: "link", href: u.href };
    if (/docs\.google\.com$/i.test(u.hostname)) {
      if (/\/edit\b/.test(u.pathname)) return { mode: "link", href: u.href };
      u.searchParams.set("embedded", "true");
      return { mode: "frame", href: u.href };
    }
    return { mode: "frame", href: u.href };
  };
  const form = normaliseForm(CFG.rsvp.formUrl);
  let built = false, returnFocus = null;

  /* Shown when a form was configured but the browser will not display it in
     place. The guest still gets a working way to respond instead of a blank
     sheet. */
  const externalPanel = (href) => `
    <div class="rsvp-external">
      <p class="rf-done-text">Your RSVP is collected on a secure form.</p>
      <a class="btn-maroon rf-submit" href="${href.replace(/"/g, "&quot;")}"
         target="_blank" rel="noopener noreferrer">Open the RSVP form</a>
    </div>`;

  const buildRsvp = () => {
    if (built) return;
    built = true;
    if (form.mode === "link") { slot.innerHTML = externalPanel(form.href); return; }
    if (form.mode === "frame") {
      const f = document.createElement("iframe");
      f.title = "Wedding RSVP form";
      /* If the frame is refused, no error event fires — the load event either
         never arrives or arrives on an empty document. A watchdog is the only
         reliable signal, so give it a beat and then fall back. */
      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true;
        slot.innerHTML = externalPanel(form.href);
      };
      const guard = setTimeout(fallback, 9000);
      f.addEventListener("load", () => {
        clearTimeout(guard);
        /* A blocked frame still fires load, on about:blank with no layout. */
        if (f.getBoundingClientRect().height < 40) fallback();
        else settled = true;
      });
      f.addEventListener("error", () => { clearTimeout(guard); fallback(); });
      f.src = form.href;
      f.loading = "eager";
      slot.appendChild(f);
      return;
    }
    // Native royal RSVP (no Google Form configured yet)
    slot.innerHTML = `
      <form id="rsvp-form" novalidate>
        <label class="rf-label">Your name
          <input class="rf-input" name="name" type="text" autocomplete="name" placeholder="Guest of honour" required>
        </label>
        <div class="rf-label">Will you grace the occasion?
          <div class="rf-choices">
            <label class="rf-chip"><input type="radio" name="attending" value="yes" checked><span>Joyfully accepts</span></label>
            <label class="rf-chip"><input type="radio" name="attending" value="no"><span>Regretfully declines</span></label>
          </div>
        </div>
        <label class="rf-label">Guests attending
          <select class="rf-input" name="count">
            <option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option>
          </select>
        </label>
        <label class="rf-label">A note for the couple <span class="rf-opt">(optional)</span>
          <textarea class="rf-input" name="note" rows="2" placeholder="Blessings, wishes, song requests…"></textarea>
        </label>
        <button class="btn-maroon rf-submit" type="submit">Send with love</button>
      </form>
      <div id="rsvp-done" class="hidden">
        <p class="rf-done-mark">🪷</p>
        <h4 class="gold-foil">धन्यवाद · Thank you</h4>
        <p class="rf-done-text">Your response has been received.<br>We can't wait to celebrate with you.</p>
      </div>`;
    slot.querySelector("#rsvp-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (!data.name || !data.name.trim()) { e.target.querySelector("[name=name]").focus(); return; }
      try { localStorage.setItem("wed-rsvp", JSON.stringify({ ...data, at: new Date().toISOString() })); } catch {}
      e.target.classList.add("hidden");
      slot.querySelector("#rsvp-done").classList.remove("hidden");
      audio.bell(660, 0.45, 2.6);
      setTimeout(() => audio.bell(880, 0.32, 2.4), 300);
      if (navigator.vibrate) navigator.vibrate([25, 60, 40]);
      const r = modal.querySelector(".modal-sheet").getBoundingClientRect();
      petals.burst(r.left + r.width / 2, r.top + 80, IS_TOUCH ? 7 : 10);
    });
  };
  $("#rsvp-btn").addEventListener("click", () => {
    returnFocus = document.activeElement;
    buildRsvp();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    audio.chime();
    requestAnimationFrame(() => (slot.querySelector("input, select, textarea, button") || $("#rsvp-close")).focus());
  });
  const close = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  };
  $("#rsvp-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  addEventListener("keydown", (e) => {
    if (modal.classList.contains("hidden")) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll('button, input, select, textarea, iframe, [href], [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

/* ═══════════════ FILM BANDS — lazy cinematic loops ═══════ */
const finale = (() => {
  const el = document.getElementById("finale");
  let done = false;
  const reveal = () => {
    if (done || !el) return;
    done = true;
    el.classList.add("shown");
    audio.chime();
  };
  let tick = () => {};
  if (el && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { reveal(); io.disconnect(); }
    }, { rootMargin: "0px 0px -22% 0px", threshold: 0.01 });
    io.observe(el);
  } else if (el) {
    let skip = 0;
    tick = () => { if (++skip % 20 === 0 && el.getBoundingClientRect().top < innerHeight * 0.78) reveal(); };
  }
  return { tick };
})();

/* The invitation and 3D world stay as separate routes. This transition starts
   the heavier world only after a deliberate tap, then releases this page. */
(() => {
  const link = $("#world-portal-link"), overlay = $("#portal-transition");
  if (!link || !overlay) return;

  /* Carry this invitation's identity into the world on the link itself, rather
     than leaving the world to guess from localStorage. A personalised card
     (?c=… or ?draft) hands its couple over explicitly; a published invitation
     has neither parameter, so its couple is passed as plain b/g values —
     without them the world's title card, arrival card and plane banner fall
     back to the demo couple on the one link that was paid for. The plain demo
     card hands over nothing, so the world keeps its own demo couple. */
  (() => {
    try {
      const baseDir = (typeof window.getSample2BaseUrl === "function" ? window.getSample2BaseUrl() : "") || "/3D%20Wedding%20Invitation%20Sample%202/";
      const rawHref = link.getAttribute("href") || "world/index.html";
      let targetHref;
      if (/^https?:\/\//i.test(rawHref)) {
        targetHref = rawHref;
      } else if (rawHref.startsWith("/")) {
        targetHref = rawHref;
      } else {
        targetHref = baseDir + rawHref.replace(/^\.?\//, "");
      }
      const here = new URLSearchParams(location.search);
      const u = new URL(targetHref, location.origin || location.href);
      if (here.get("c")) {
        u.searchParams.set("c", here.get("c"));
      } else if (here.has("draft")) {
        u.searchParams.set("draft", "1");
      } else {
        u.searchParams.set("b", (CFG && CFG.couple && CFG.couple.bride) || "");
        u.searchParams.set("g", (CFG && CFG.couple && CFG.couple.groom) || "");
      }
      if (CFG && CFG.couple && CFG.couple.side) {
        u.searchParams.set("side", CFG.couple.side);
      }
      link.href = u.href;
    } catch { /* a malformed link must never block the portal */ }
  })();

  const isPrimaryActivation = (e) => !e.defaultPrevented && e.button === 0
    && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  const rememberAudioIntent = () => {
    try {
      const intent = audio.isMuted() ? "muted" : "play";
      sessionStorage.setItem("wedding-world-audio-intent", intent);
      // The world starts its own score from the beginning; never carry this
      // page's media time into the 3D scene.
      sessionStorage.removeItem("wedding-world-audio-state");
    } catch { /* private modes may restrict storage; the world still opens directly */ }
  };
  let leaving = false, navTimer = 0;
  const reset = () => {
    const shouldRestore = leaving || document.body.classList.contains("portal-opening");
    leaving = false;
    clearTimeout(navTimer);
    document.body.classList.remove("portal-opening");
    document.body.removeAttribute("aria-busy");
    link.removeAttribute("aria-disabled");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.removeProperty("--portal-x");
    overlay.style.removeProperty("--portal-y");
    if (shouldRestore) audio.restoreAfterWorld();
  };
  addEventListener("pagehide", () => { if (leaving) audio.pauseForWorld(); });
  addEventListener("pageshow", reset);

  if (REDUCED) {
    link.addEventListener("click", (e) => {
      if (!isPrimaryActivation(e)) return;
      leaving = true;
      rememberAudioIntent();
      audio.pauseForWorld();
    });
    return;
  }

  link.addEventListener("click", (e) => {
    if (!isPrimaryActivation(e)) return;
    e.preventDefault();
    if (leaving) return;
    leaving = true;
    rememberAudioIntent();

    const visual = link.querySelector(".world-portal-visual");
    const r = (visual || link).getBoundingClientRect();
    overlay.style.setProperty("--portal-x", `${r.left + r.width / 2}px`);
    overlay.style.setProperty("--portal-y", `${r.top + r.height / 2}px`);
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("portal-opening");
    document.body.setAttribute("aria-busy", "true");
    link.setAttribute("aria-disabled", "true");

    audio.bell(540, 0.22, 1.3);
    audio.whoosh(0.9);
    audio.fadeForWorld(360);
    document.querySelectorAll("video").forEach((video) => video.pause());

    navTimer = setTimeout(() => {
      // Safari may keep a page alive briefly during same-tab navigation.
      // Stop the invitation score synchronously before the world takes over.
      audio.pauseForWorld();
      try { location.assign(link.href); }
      catch { location.href = link.href; }
    }, 820);
  });
})();

const films = (() => {
  const vids = [...document.querySelectorAll(".film-band video")];
  const visible = new Set();
  const timers = new WeakMap();
  const pauseAll = () => vids.forEach((v) => { if (!v.paused) v.pause(); });
  const wake = (v) => {
    if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
    if (v.paused) v.play().catch(() => {});
  };
  let tick = () => {};
  if ("IntersectionObserver" in window) {
    const posterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const v = entry.target;
        if (!v.poster && v.dataset.poster) v.poster = v.dataset.poster;
        posterObserver.unobserve(v);
      });
    }, { rootMargin: "600px 0px" });
    const playObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = entry.target;
        clearTimeout(timers.get(v));
        if (entry.isIntersecting) {
          visible.add(v);
          const timer = setTimeout(() => {
            if (visible.has(v) && !document.hidden) wake(v);
          }, IS_TOUCH ? 160 : 0);
          timers.set(v, timer);
        } else {
          visible.delete(v);
          if (!v.paused) v.pause();
        }
      });
    }, { rootMargin: IS_TOUCH ? "40px 0px" : "140px 0px", threshold: 0.01 });
    vids.forEach((v) => { posterObserver.observe(v); playObserver.observe(v); });
  } else {
    let acc = 0;
    tick = (dt) => {
      acc += dt;
      if (acc < 0.5 || !vids.length) return;
      acc = 0;
      vids.forEach((v) => {
        const r = v.getBoundingClientRect();
        const near = r.bottom > -100 && r.top < innerHeight + 100;
        if (near) wake(v);
        else if (!v.paused) v.pause();
      });
    };
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAll();
    else visible.forEach(wake);
  });
  addEventListener("pagehide", pauseAll);
  return { tick };
})();

/* ═══════════════ SOUND TOGGLE ════════════════════════════ */
(() => {
  const b = $("#sound-toggle");
  if (audio.isMuted()) b.classList.add("muted");
  b.addEventListener("click", () => {
    if (!audio.hasBgm()) {
      audio.init();
      if (audio.isMuted()) b.classList.toggle("muted", audio.toggleMute());
      audio.startBgm();
      if (!audio.isMuted()) audio.chime();
      return;
    }
    audio.init();
    b.classList.toggle("muted", audio.toggleMute());
    if (!audio.isMuted()) audio.chime();
  });
})();

/* ═══════════════ FINISHING TOUCHES ═══════════════════════ */
(() => {
  /* The names board (letter cascade included) is owned by nameBoard above. */

  /* Self-drawing flourish under every section title */
  const FLOURISH = `<svg class="flourish" viewBox="0 0 150 26" aria-hidden="true">
    <path d="M5 13 C 30 13, 40 4, 62 12"/><path d="M145 13 C 120 13, 110 22, 88 14"/>
    <circle cx="75" cy="13" r="7.5"/>
    <rect class="gem" x="71" y="9" width="8" height="8"/>
  </svg>`;
  document.querySelectorAll(".sec-head").forEach((h) => {
    h.insertAdjacentHTML("beforeend", FLOURISH);
  });
  const headIO = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("shown"); headIO.unobserve(e.target); } });
  }, { threshold: 0.5 });
  document.querySelectorAll(".sec-head").forEach((h) => headIO.observe(h));

  /* One quiet entrance per major glass surface. Nothing follows the scroll
     frame-by-frame: once visible, each observer releases its element. */
  const revealItems = document.querySelectorAll(
    ".countdown-card, .film-band, #scratch-wrap, .venue-card, .rsvp-block"
  );
  revealItems.forEach((el) => el.classList.add("soft-reveal"));
  if (REDUCED || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("revealed"));
  } else {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("revealed");
        revealIO.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.12 });
    revealItems.forEach((el) => revealIO.observe(el));
  }

  /* Tap sparkle — a pinch of petals wherever a finger lands */
  let lastSpark = 0;
  document.addEventListener("pointerdown", (e) => {
    const t = performance.now();
    if (t - lastSpark < 450 || REDUCED) return;
    lastSpark = t;
    petals.burst(e.clientX, e.clientY, IS_TOUCH ? 1 : 2);
  }, { passive: true });
})();

/* ═══════════════ MANDALA (loader SVG petals) ═════════════ */
(() => {
  const ring = $("#petal-ring");
  const NS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 24; i++) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M0,-88 C6,-76 6,-66 0,-58 C-6,-66 -6,-76 0,-88 Z");
    p.setAttribute("fill", i % 2 ? "rgba(201,162,75,.5)" : "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", ".7");
    p.setAttribute("transform", `rotate(${i * 15})`);
    ring.appendChild(p);
  }
})();

/* ═══════════════ MAIN LOOP + FPS GUARD ═══════════════════ */
const threadEl = $("#thread");
const doc = document.documentElement;
let pageScrollRange = Math.max(doc.scrollHeight - vhPx * 100, 1);
const refreshScrollRange = () => { pageScrollRange = Math.max(doc.scrollHeight - vhPx * 100, 1); };
const refreshPageMetrics = () => {
  refreshScrollRange();
  sanctum.resize();
  decor.measure();
};
if ("ResizeObserver" in window) new ResizeObserver(refreshPageMetrics).observe(document.body);
addEventListener("load", refreshPageMetrics, { once: true });
let lastT = performance.now(), fpsAcc = 0, fpsN = 0, degraded = false, lastSp = -1;
const mainLoop = (t) => {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  const vel = scrub.tick(dt) || 0;
  petals.addGust(Math.min(vel * 0.004, 0.4));
  if (vel > 7) audio.whoosh(Math.min(vel / 26, 1));   // airy gust on brisk scrolls
  petals.step(dt);
  sanctum.tick(dt);
  films.tick(dt);
  decor.tick();
  finale.tick();
  // golden scroll thread
  const sp = clamp(scrollY / pageScrollRange, 0, 1);
  if (Math.abs(sp - lastSp) > 0.0004) {
    threadEl.style.setProperty("--sp", sp.toFixed(4));
    lastSp = sp;
  }
  // fps monitor
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2 && !degraded) {
    if (fpsN / fpsAcc < 44) { degraded = true; petals.setLowPerf(); }
    fpsAcc = 0; fpsN = 0;
  }
  RAF(mainLoop);
};

/* ═══════════════ BOOT — the seal opens ═══════════════════ */
(() => {
  const loader = $("#loader"), sealBtn = $("#seal-btn");
  const pctEl = $("#loader-pct"), copyEl = $("#loader-copy");
  const statusEl = $("#loader-status"), tapEl = $("#loader-tap");
  const retryEl = $("#loader-retry");
  const ring = $("#progress-ring");
  const CIRC = 414.7;

  scrub.resize();
  petals.resize();

  if (REDUCED) {
    // Reduced motion: static invitation, no film scrub, no petals
    loader.classList.add("gone");
    document.body.classList.remove("is-loading");
    $("#hero").style.height = "calc(var(--vh) * 100)";
    const img = new Image();
    img.onload = () => { frames.prime(0, img); scrub.firstPaint(); };
    img.src = CFG.frames.loPath + CFG.frames.prefix + "001" + CFG.frames.ext;
    $("#sound-toggle").classList.remove("hidden");
    return;
  }

  const ringPetals = [...document.querySelectorAll("#petal-ring path")];
  ringPetals.forEach((p) => { p.style.opacity = .18; p.style.transition = "opacity .6s ease"; });

  /* Unlock seal button & prime frame 1 immediately for instant entry */
  if (sealBtn) sealBtn.disabled = false;
  const firstImg = new Image();
  firstImg.onload = () => {
    try { frames.prime(0, firstImg); scrub.firstPaint(); } catch {}
  };
  firstImg.src = CFG.frames.loPath + CFG.frames.prefix + "001" + CFG.frames.ext;

  const slowNotice = setTimeout(() => {
    if (copyEl) copyEl.textContent = "Smoothing every frame…";
  }, 12000);
  let entryReady = false;
  const markReady = () => {
    entryReady = true;
    if (statusEl) statusEl.classList.add("hidden");
    if (tapEl) tapEl.classList.remove("hidden");
    if (sealBtn) sealBtn.disabled = false;
  };
  const loadTimeout = setTimeout(() => {
    /* Fail-safe: guarantee seal is unlocked and ready within 3.5s */
    if (pctEl) pctEl.textContent = "100%";
    if (ring) ring.style.strokeDashoffset = "0";
    markReady();
  }, 3500);

  retryEl.addEventListener("click", () => location.reload(), { once: true });
  frames.preloadLo((f) => {
    // Progress copy shows only until entry unlocks — a late callback must
    // never re-hide the tap cue or the guest is stuck at "Preparing… 0%".
    if (!entryReady) {
      if (statusEl) statusEl.classList.remove("hidden");
      if (tapEl) tapEl.classList.add("hidden");
      if (pctEl) pctEl.textContent = Math.round(f * 100) + "%";
    }
    if (ring) ring.style.strokeDashoffset = CIRC * (1 - f);
    // the mandala blooms petal by petal as the world loads
    const lit = Math.round(f * ringPetals.length);
    for (let k = 0; k < lit; k++) ringPetals[k].style.opacity = 1;
  }).then(() => {
    clearTimeout(loadTimeout);
    clearTimeout(slowNotice);
    try { scrub.firstPaint(); } catch { /* paint must never block entry */ }
    markReady();
    // Use the natural pause before the seal tap to decode the opening runway.
    // The queue remains bounded, so this adds readiness rather than a bulk preload.
    if (!SAVE_DATA) frames.startLo();
  }).catch(() => {
    clearTimeout(loadTimeout);
    clearTimeout(slowNotice);
    // Enable entry on error so visitor is never blocked
    markReady();
  });

  sealBtn.addEventListener("click", () => {
    audio.init();
    audio.bell(432, 0.55, 4);                // the seal breaks with a temple bell
    setTimeout(() => audio.bell(648, 0.3, 3), 350);
    audio.whoosh(1);                         // doors part with a breath of air
    audio.startBgm();                        // the score begins inside the tap gesture
    loader.classList.add("open");
    $("#hero").classList.add("entered");     // names cascade in as the doors part
    frames.startLo();
    setTimeout(() => {
      loader.classList.add("gone");
      document.body.classList.remove("is-loading");
      $("#sound-toggle").classList.remove("hidden");
      $("#thread").classList.add("on");
      lastT = performance.now();
      RAF(mainLoop);
      frames.startHi();
      // Let the opening frame runway and soundtrack settle before ambient petals begin.
      setTimeout(() => petals.start(), IS_TOUCH ? 3500 : 2500);
    }, 1500);
  }, { once: true });
})();

})();
