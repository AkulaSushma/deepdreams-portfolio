/* ============================================================
   ROYAL WEDDING INVITE — CLIENT CONFIG
   Everything a new client needs changed lives in this file.
   Edit, save, done. No other file needs touching.
   ============================================================ */
window.WEDDING_CONFIG = {

  couple: {
    groom: "Sai Charan",
    bride: "Harshitha",
    groomFull: "Sai Charan Reddy",
    brideFull: "Harshitha Chowdary",
    monogram: "S · H",           // shown in the wax seal + header
    tagline: "Two souls, one sacred fire",
  },

  // Main wedding moment — drives the live countdown
  wedding: {
    dateISO: "2026-11-26T19:08:00+05:30",   // muhurat time
    dateDisplay: "Thursday, 26 November 2026",
    muhurat: "Shubh Muhurat · 7:08 PM",
  },

  // The celebrations — rendered in order
  events: [
    {
      id: "haldi",
      name: "Haldi",
      icon: "haldi",                    // haldi | sangeet | wedding | reception
      date: "Tue, 24 Nov 2026",
      time: "10:00 AM onwards",
      venue: "Rani Bagh Courtyard",
      line: "Turmeric, laughter and golden blessings",
      accent: "#D99A2B",
    },
    {
      id: "sangeet",
      name: "Sangeet",
      icon: "sangeet",
      date: "Tue, 24 Nov 2026",
      time: "7:00 PM onwards",
      venue: "Sheesh Mahal Lawns",
      line: "A night of music, dance and dazzle",
      accent: "#5B3A8E",
    },
    {
      id: "wedding",
      name: "The Wedding",
      icon: "wedding",
      date: "Thu, 26 Nov 2026",
      time: "Baraat 5:30 PM · Pheras 7:08 PM",
      venue: "The Royal Palace Gardens",
      line: "Seven vows around the sacred fire",
      accent: "#7A1F3D",
    },
    {
      id: "reception",
      name: "Reception",
      icon: "reception",
      date: "Thu, 26 Nov 2026",
      time: "7:30 PM onwards",
      venue: "The Royal Palace Gardens",
      line: "An evening of royal festivity",
      accent: "#B08A3E",
    },
  ],

  venue: {
    name: "The Royal Palace Gardens",
    address: "Lake Pichola Road, Udaipur, Rajasthan 313001",
    // What gets searched when a guest taps "Open in Maps"
    mapsQuery: "The Oberoi Udaivilas, Udaipur",
  },

  rsvp: {
    // Replace with the couple's real Google Form (use the /viewform link)
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSe_PLACEHOLDER/viewform?embedded=true",
    deadline: "Please respond by 1 November 2026",
  },

  // Scratch-card hidden message
  scratch: {
    heading: "A little secret, just for you",
    message: "You hold a special place in our story — join us for a private family dinner on the 25th. Shhh! 🤫",
  },

  // Theme — the royal palette (matches the origami film)
  theme: {
    maroon:  "#6D1A33",
    maroonDeep: "#4A0F22",
    gold:    "#C9A24B",
    goldSoft:"#E5C878",
    ivory:   "#F4EBDB",
    inkOnIvory: "#3A2230",
  },

  frames: {
    count: 181,                 // scrub frames per tier
    loPath: "assets/frames/lo/",
    hiPath: "assets/frames/hi/",
    prefix: "f_",               // f_001.webp … f_181.webp
    ext: ".webp",
  },

  // The Hidden Moment — scroll-driven film
  sanctum: {
    count: 121,
    path: "assets/frames2/",
    prefix: "s_",               // s_001.webp … s_121.webp
    ext: ".webp",
    heading: "The Hidden Moment",
    eyebrow: "A sacred moment awaits",
    hint: "Scroll gently to unfold this hidden moment",
    veilText: "A sacred moment awaits",
  },

  // Cinematic Wedding Films / Video clips
  films: [
    { id: "film1", eyebrow: "The Wedding Film", line: "Every love story deserves cinema", src: "assets/film/film1.mp4", poster: "assets/film/film1_poster.webp" },
    { id: "film2", eyebrow: "A Royal Affair", line: "Dressed in gold, bound by fire", src: "assets/film/film2.mp4", poster: "assets/film/film2_poster.webp" },
    { id: "film3", eyebrow: "The Grand Walk", line: "Every step, toward forever", src: "assets/film/film3.mp4", poster: "assets/film/film3_poster.webp" },
  ],
};

/* Helper to resolve template assets whether on root, subfolder, preview link, or /invite/{slug} */
window.getSample2BaseUrl = function () {
  if (window.DD_SAMPLE2_BASE) return window.DD_SAMPLE2_BASE;
  const scripts = document.querySelectorAll('script[src*="config.js"], script[src*="app.js"]');
  for (const s of scripts) {
    const src = s.getAttribute("src") || s.src || "";
    const idx = src.lastIndexOf("/");
    if (idx >= 0) {
      const base = src.slice(0, idx + 1);
      if (base && base !== "./" && base !== "/") return base;
    }
  }
  if (window.DD_PUBLISHED || (typeof location !== "undefined" && /^\/invite\//i.test(location.pathname))) {
    return "/3D%20Wedding%20Invitation%20Sample%202/";
  }
  return "";
};

/* ============================================================
   STUDIO BRIDGE — lets the editor, or the server, drive this invitation.

   window.DD_SITE → a published invitation, served by /api/site/[slug]
   ?draft=1       → the draft saved by create.html on this device
   ?c=<data>      → a design encoded in a link shared before publishing existed
   None present   → the defaults above are used, untouched.

   The published site wins over everything. It is the paid one, it comes from
   the server rather than from the address bar, and a guest who happens to have
   an old draft on their device must never see it in place of the couple's real
   invitation.
   ============================================================ */
(() => {
  "use strict";
  const base = window.WEDDING_CONFIG;

  // B1: Save a clean copy before any merge — editor.js uses this for Reset
  window.WEDDING_DEFAULTS = JSON.parse(JSON.stringify(base));

  const tag = (n) => String(n || "").replace(/\s+/g, "");
  const initial = (n) => {
    const s = String(n || "").trim();
    return s ? s[0].toUpperCase() : "";
  };

  const derive = (c) => {
    if (!c.couple) c.couple = {};
    if (!c.wedding) c.wedding = {};
    if (!c.venue) c.venue = {};
    if (!c.frames) c.frames = JSON.parse(JSON.stringify(base.frames));
    if (!c.sanctum) c.sanctum = JSON.parse(JSON.stringify(base.sanctum));

    const b = c.couple.bride || "";
    const g = c.couple.groom || "";
    const isGroomSide = (c.couple.side === "groom");
    const isDemoCouple = (b === "Harshitha" && g === "Sai Charan");

    // Monogram: auto-derive if empty or still holding demo monogram for a non-demo couple
    if (!c.couple.monogram || (!isDemoCouple && (c.couple.monogram === "S · H" || c.couple.monogram === "H · S" || c.couple.monogram === "M · M"))) {
      const bi = initial(b), gi = initial(g);
      c.couple.monogram = isGroomSide
        ? ((gi && bi) ? `${gi} · ${bi}` : (gi || bi || "♥"))
        : ((bi && gi) ? `${bi} · ${gi}` : (bi || gi || "♥"));
    }

    // Hashtag: auto-derive if empty or holding demo hashtag for a non-demo couple
    if (!c.couple.hashtag || (!isDemoCouple && (c.couple.hashtag === "#HarshithaWedsSaiCharan" || c.couple.hashtag === "#SaiCharanWedsHarshitha" || c.couple.hashtag === "#MishiWedsMrigank"))) {
      c.couple.hashtag = (b && g)
        ? (isGroomSide ? "#" + tag(g) + "Weds" + tag(b) : "#" + tag(b) + "Weds" + tag(g))
        : "";
    }

    // Full names: auto-derive if empty or holding demo full names for a non-demo couple
    if (!c.couple.brideFull || (!isDemoCouple && (c.couple.brideFull === "Harshitha Chowdary" || c.couple.brideFull === "Mishi Agarwal"))) {
      c.couple.brideFull = b;
    }
    if (!c.couple.groomFull || (!isDemoCouple && (c.couple.groomFull === "Sai Charan Reddy" || c.couple.groomFull === "Mrigank Singh Rathore"))) {
      c.couple.groomFull = g;
    }

    c.venue.city ||= (String(c.venue.address || "").split(",")[1] || "").trim();
    c.wedding.dateShort ||= String(c.wedding.dateDisplay || "").replace(/^[A-Za-z]+,\s*/, "") +
      (c.venue.city ? " · " + c.venue.city : "");

    // Resolve asset base paths so 3D frames, middle animation, audio & films never 404
    const baseDir = (typeof window.getSample2BaseUrl === "function" ? window.getSample2BaseUrl() : "") || "";
    if (baseDir) {
      if (c.frames) {
        if (!c.frames.loPath.startsWith(baseDir) && !/^https?:\/\//i.test(c.frames.loPath)) {
          c.frames.loPath = baseDir + c.frames.loPath.replace(/^\.?\//, "");
        }
        if (!c.frames.hiPath.startsWith(baseDir) && !/^https?:\/\//i.test(c.frames.hiPath)) {
          c.frames.hiPath = baseDir + c.frames.hiPath.replace(/^\.?\//, "");
        }
      }
      if (c.sanctum && !c.sanctum.path.startsWith(baseDir) && !/^https?:\/\//i.test(c.sanctum.path)) {
        c.sanctum.path = baseDir + c.sanctum.path.replace(/^\.?\//, "");
      }
      if (Array.isArray(c.films)) {
        c.films.forEach(f => {
          if (f && f.src && !f.src.startsWith(baseDir) && !/^https?:\/\//i.test(f.src)) {
            f.src = baseDir + f.src.replace(/^\.?\//, "");
          }
          if (f && f.poster && !f.poster.startsWith(baseDir) && !/^https?:\/\//i.test(f.poster)) {
            f.poster = baseDir + f.poster.replace(/^\.?\//, "");
          }
        });
      }
    }
    return c;
  };

  // B1: The editor owns its own state — skip the merge on create.html
  if (/(\/|^)create\.html$/.test(location.pathname)) { derive(base); return; }

  const merge = (a, b) => {
    if (Array.isArray(b) || b === null || typeof b !== "object") return b;
    const out = Array.isArray(a) ? [] : { ...a };
    Object.keys(b).forEach(k => out[k] = merge(a ? a[k] : undefined, b[k]));
    return out;
  };

  const dec64 = (s) => {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  };

  /* A published invitation, if this page was served as one. Read through
     shared/hydrate.js so the photograph markers are resolved at the width this
     particular device actually wants. */
  const H = window.DD_HYDRATE;
  const published = !!(H && H.isPublished());

  let override = null;
  try {
    if (published) override = H.content();
    else {
      const p = new URLSearchParams(location.search);
      if (p.get("c")) override = JSON.parse(dec64(p.get("c")));
      else if (p.has("draft")) override = JSON.parse(localStorage.getItem("wedding-studio-draft") || "null");
    }
  } catch { /* a bad link must never break the invitation */ }

  if (override && typeof override === "object") {
    window.WEDDING_CONFIG = derive(merge(base, override));
    /* `studioDraft` means "the person looking at this is the one editing it",
       which is exactly what a published invitation is not. Setting it here
       would put the editor's own controls on a guest's screen. */
    if (!published) document.documentElement.dataset.studioDraft = "1";
  } else {
    derive(base);
  }
})();
