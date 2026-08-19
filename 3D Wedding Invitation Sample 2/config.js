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
      date: "Fri, 27 Nov 2026",
      time: "7:30 PM onwards",
      venue: "Durbar Hall",
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

  /* Sensible defaults for the three fields nobody types: a hashtag, the city and
     the short date. Each is derived from a field the couple *did* fill in.

     This runs on the FINAL configuration, after any merge — never on the sample
     before it. Derive first and the sample's own hashtag is already sitting in
     the object when the couple's design merges over it, so an invitation for
     Meera and Arjun goes out reading #HarshithaWedsSaiCharan and dated Udaipur.
     `||=` cannot help there: the field is not empty, it is simply someone
     else's. Anything the couple actually filled in still wins — it arrives in
     the override and is left alone here. */
  /* Names may contain spaces ("Sai Charan"); a hashtag may not. */
  const tag = (n) => String(n || "").replace(/\s+/g, "");
  const derive = (c) => {
    c.couple.hashtag ||= "#" + tag(c.couple.bride) + "Weds" + tag(c.couple.groom);
    c.venue.city ||= (String(c.venue.address || "").split(",")[1] || "").trim();
    c.wedding.dateShort ||= String(c.wedding.dateDisplay || "").replace(/^[A-Za-z]+,\s*/, "") +
      (c.venue.city ? " · " + c.venue.city : "");
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
    /* Deliberately does NOT write back to localStorage. This used to persist the
       override "so the 3D world picks up the same names", but that made a guest's
       device remember whichever couple's ?c= link they opened last — and the demo
       world then showed those names in its title card and plane banner. The world
       now receives the couple on the portal link itself (see app.js), so the
       device-wide draft can stay private to whoever actually used the editor. */
  } else {
    derive(base);
  }
})();
