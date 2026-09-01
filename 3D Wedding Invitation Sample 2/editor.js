/* ═══════════ INVITATION STUDIO — the editor ═══════════ */
(() => {
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DRAFT_KEY = "wedding-studio-draft";
const STUDIO_EMAIL = "hello@deepdreams.ai";

/* Any src that cannot survive the trip to a guest's phone. */
const isLocalOnlySrc = (s) => /^(blob:|data:|file:)/i.test(String(s || "").trim());

/* ── utf-8 safe base64url ──
   Only the reading half survives. A design encoded into a link is a free
   permanent invitation, which is the thing the studio sells, so this editor
   can still open a link someone was given before publishing existed — and can
   no longer create one. */
const dec64 = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
};

const clone = (o) => JSON.parse(JSON.stringify(o));
/* B1: Use WEDDING_DEFAULTS (the clean, pre-merge copy) for reset baseline */
const DEFAULTS = clone(window.WEDDING_DEFAULTS || window.WEDDING_CONFIG);

/* ── state ── */
let S = clone(DEFAULTS);
/* Merge one level deep: a draft saved before a new field existed must not wipe
   that field's default off its whole section (couple, venue, …). */
const soak = (into) => {
  Object.keys(into || {}).forEach(k => {
    const v = into[k];
    if (v && typeof v === "object" && !Array.isArray(v) &&
        S[k] && typeof S[k] === "object" && !Array.isArray(S[k])) Object.assign(S[k], v);
    else S[k] = v;
  });
};
let pendingDraft = null;
try {
  const params = new URLSearchParams(location.search);
  if (params.get("c")) {
    soak(JSON.parse(dec64(params.get("c"))));
  } else {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      /* This machine is shared by the studio: several couples design here,
         one after another. A saved draft must NOT silently become the next
         person’s starting point — a new designer would see the previous
         couple’s names everywhere and could publish them by accident.
         The draft is parked; a banner offers it back to its owner only. */
      let parsed = null;
      try { parsed = JSON.parse(saved); } catch { parsed = null; }
      const cp = (parsed && parsed.couple) || {};
      const isDemo = (cp.bride === "Harshitha" && cp.groom === "Sai Charan");
      /* Real only when the names were personalised: a saved copy of the
         demo couple is just the starting point, not anyone’s work. */
      if (!isDemo && (cp.bride || cp.groom)) pendingDraft = parsed;
    }
  }
} catch {}
S.couple.hashtag ??= "#" + S.couple.bride.replace(/\s+/g, "") + "Weds" + S.couple.groom.replace(/\s+/g, "");
S.venue.city ??= (S.venue.address.split(",")[1] || "Udaipur").trim();

/* ── date helpers ── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ord = (d) => d + (["th","st","nd","rd"][(d % 100 - 20) % 10] || ["th","st","nd","rd"][d % 100] || "th");
const splitISO = (iso) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)?$/.exec(iso || "");
  return m ? { date: m[1], time: m[2], tz: m[3] === "Z" ? "+00:00" : (m[3] || "+05:30") }
           : { date: "2026-11-26", time: "19:08", tz: "+05:30" };
};
const partsOf = (ymd) => {
  const [y, mo, d] = (ymd || "2026-11-26").split("-").map(Number);
  return { y, mo, d, dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
};
const longDate = (ymd) => { const p = partsOf(ymd); return `${DAYS[p.dow]}, ${p.d} ${MONTHS[p.mo - 1]} ${p.y}`; };
const shortDate = (ymd) => { const p = partsOf(ymd); return `${DAYS[p.dow].slice(0,3)}, ${p.d} ${MONTHS[p.mo-1].slice(0,3)} ${p.y}`; };
const finaleDate = (ymd) => { const p = partsOf(ymd); return `${ord(p.d)} ${MONTHS[p.mo - 1]} ${p.y}`; };
const toYMD = (txt) => {
  const m = /(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/.exec(txt || "");
  if (!m) return "";
  const mi = MONTHS.findIndex(x => x.toLowerCase().startsWith(m[2].toLowerCase()));
  return mi < 0 ? "" : `${m[3]}-${String(mi + 1).padStart(2,"0")}-${String(+m[1]).padStart(2,"0")}`;
};

// 12-hour AM/PM formatter
const fmtTime12 = (tStr) => {
  if (!tStr) return "7:08 PM";
  const [h, m] = tStr.split(":").map(Number);
  if (isNaN(h)) return tStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(isNaN(m) ? 0 : m).padStart(2, "0")} ${ampm}`;
};

// Date arithmetic helper (+/- days from YYYY-MM-DD)
const addDaysYMD = (ymd, days) => {
  try {
    const [y, mo, d] = (ymd || "2026-11-26").split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d + days));
    return dt.toISOString().slice(0, 10);
  } catch {
    return ymd || "2026-11-26";
  }
};

/* ── persistence ── */
let saveTimer = 0;
/* True only after a genuine edit. Until then nothing is written: a demo
   state must never masquerade as someone’s unfinished design on a device
   that has only viewed the page. The first input handler flips this via
   markTouched(); save() refuses to persist before that. */
let userTouchedTheDesign = false;
const markTouched = () => { userTouchedTheDesign = true; };
const save = () => {
  if (!userTouchedTheDesign) return;      /* viewing is not designing */
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(S)); } catch {}
    const el = $("#ed-saved");
    el.textContent = "Saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, 260);
};

const tag = (n) => String(n || "").replace(/\s+/g, "");
const initial = (n) => {
  const s = String(n || "").trim();
  return s ? s[0].toUpperCase() : "";
};

/* ── User Edit Tracking ──
   Fields auto-fill intelligently, but if the user explicitly types
   their own custom value, we respect their edit and preserve it. */
const userEdited = {
  monogram: false,
  hashtag: false,
  brideFull: false,
  groomFull: false,
  muhurat: false,
  deadline: false,
  city: false,
  mapsQuery: false,
  scratchHeading: false,
  scratchMessage: false,
  venueName: false,
  sanctumHeading: false,
  film1Eyebrow: false,
  film2Eyebrow: false,
  film3Eyebrow: false,
  events: {},
};

/* ── 1. Couple Name Auto-Fill Engine ── */
const syncCoupleAutoFill = () => {
  const isGroomSide = (S.couple.side === "groom");
  const b = (S.couple.bride || "").trim();
  const g = (S.couple.groom || "").trim();
  const bi = initial(b), gi = initial(g);
  const isDemo = (b === "Harshitha" && g === "Sai Charan");
  const first = isGroomSide ? g : b;
  const second = isGroomSide ? b : g;
  const coupleOrder = (b && g) ? `${first} & ${second}` : (first || second || "");
  const coupleWeds = (b && g) ? `${first} weds ${second}` : (first || second || "");

  // Update UI Labels / notes
  const brideNote = $("#lbl-bride-note");
  const groomNote = $("#lbl-groom-note");
  if (brideNote) brideNote.hidden = isGroomSide;
  if (groomNote) groomNote.hidden = !isGroomSide;

  // Monogram
  if (!userEdited.monogram || !S.couple.monogram || (!isDemo && (S.couple.monogram === "S · H" || S.couple.monogram === "H · S" || S.couple.monogram === "M · M"))) {
    const m = isGroomSide
      ? ((gi && bi) ? `${gi} · ${bi}` : (gi || bi || "♥"))
      : ((bi && gi) ? `${bi} · ${gi}` : (bi || gi || "♥"));
    S.couple.monogram = m;
    const el = $("#f-monogram");
    if (el) el.value = m;
  }

  // Hashtag
  if (!userEdited.hashtag || !S.couple.hashtag || (!isDemo && (S.couple.hashtag === "#HarshithaWedsSaiCharan" || S.couple.hashtag === "#SaiCharanWedsHarshitha" || S.couple.hashtag === "#MishiWedsMrigank"))) {
    const ht = (b && g)
      ? (isGroomSide ? "#" + tag(g) + "Weds" + tag(b) : "#" + tag(b) + "Weds" + tag(g))
      : "";
    S.couple.hashtag = ht;
    const el = $("#f-hashtag");
    if (el) el.value = ht;
  }

  // Full names
  if (!userEdited.brideFull || !S.couple.brideFull || (!isDemo && (S.couple.brideFull === "Harshitha Chowdary" || S.couple.brideFull === "Mishi Agarwal"))) {
    S.couple.brideFull = b;
    const el = $("#f-brideFull");
    if (el && !userEdited.brideFull) {
      el.value = (S.couple.brideFull && S.couple.brideFull !== "Harshitha Chowdary") ? S.couple.brideFull : "";
      el.placeholder = b ? `${b} (e.g. ${b} Reddy)` : "Bride's full name";
    }
  }

  if (!userEdited.groomFull || !S.couple.groomFull || (!isDemo && (S.couple.groomFull === "Sai Charan Reddy" || S.couple.groomFull === "Mrigank Singh Rathore"))) {
    S.couple.groomFull = g;
    const el = $("#f-groomFull");
    if (el && !userEdited.groomFull) {
      el.value = (S.couple.groomFull && S.couple.groomFull !== "Sai Charan Reddy") ? S.couple.groomFull : "";
      el.placeholder = g ? `${g} (e.g. ${g} Rao)` : "Groom's full name";
    }
  }

  // Scratch card secret message & sanctum heading
  if (!userEdited.scratchHeading && b && g) {
    S.scratch.heading = `A little secret from ${coupleOrder}, just for you`;
    const el = $("#f-scratchHeading");
    if (el) el.value = S.scratch.heading;
  }
  if (!userEdited.scratchMessage && b && g) {
    S.scratch.message = `You hold a special place in our story — join us to celebrate our wedding! With love, ${coupleOrder}. Shhh! 🤫`;
    const el = $("#f-scratchMessage");
    if (el) el.value = S.scratch.message;
  }
  if (!userEdited.sanctumHeading && b && g) {
    S.sanctum.heading = `The Sacred Moment · ${coupleOrder}`;
    const el = $("#f-sanctumHeading");
    if (el) el.value = S.sanctum.heading;
  }

  // Film titles / eyebrows
  if (Array.isArray(S.films)) {
    if (!userEdited.film1Eyebrow && S.films[0] && b && g) {
      S.films[0].eyebrow = `${coupleOrder} · The Wedding Film`;
      const el = $("#f-film1-eyebrow");
      if (el) el.value = S.films[0].eyebrow;
    }
    if (!userEdited.film2Eyebrow && S.films[1] && b && g) {
      S.films[1].eyebrow = `A Royal Affair · ${coupleOrder}`;
      const el = $("#f-film2-eyebrow");
      if (el) el.value = S.films[1].eyebrow;
    }
  }

  // Update celebration event descriptions if matching couple
  if (Array.isArray(S.events) && b && g) {
    S.events.forEach(ev => {
      const isWedding = ev.icon === "wedding" || /wedding|pheras|muhurat/i.test(ev.name);
      if (isWedding && (!userEdited.events[ev.id]?.line || ev.line.includes("Seven vows"))) {
        ev.line = `Seven vows around the sacred fire — ${coupleWeds}`;
      }
    });
    renderEvents();
  }
};

/* ── 2. Date & Muhurtham Cascading Auto-Fill Engine ── */
const iso = splitISO(S.wedding.dateISO);

const syncDateAutoFill = () => {
  const d = $("#f-date").value || iso.date;
  const t = $("#f-time").value || iso.time;
  const z = $("#f-tz").value || iso.tz;

  S.wedding.dateISO = `${d}T${t}:00${z}`;
  S.wedding.dateDisplay = longDate(d);
  S.wedding.dateShort = `${finaleDate(d)} · ${S.venue.city}`;

  const isoEl = $("#ed-iso");
  if (isoEl) isoEl.textContent = S.wedding.dateDisplay;

  // Auto-format Muhurat Line in 12-hour format
  if (!userEdited.muhurat || S.wedding.muhurat === "Shubh Muhurat · 7:08 PM") {
    S.wedding.muhurat = `Shubh Muhurat · ${fmtTime12(t)}`;
    const el = $("#f-muhurat");
    if (el) el.value = S.wedding.muhurat;
  }

  // Auto-calculate RSVP Deadline to 15 days before the wedding
  if (!userEdited.deadline || S.rsvp.deadline === "Please respond by 1 November 2026") {
    const rsvpYMD = addDaysYMD(d, -15);
    const [ry, rmo, rd] = rsvpYMD.split("-").map(Number);
    S.rsvp.deadline = `Please respond by ${rd} ${MONTHS[rmo - 1]} ${ry}`;
    const el = $("#f-deadline");
    if (el) el.value = S.rsvp.deadline;
  }

  // Cascade dates to all functions in S.events
  if (Array.isArray(S.events)) {
    S.events.forEach(ev => {
      const evEdited = userEdited.events[ev.id] || {};
      const name = (ev.name || "").toLowerCase();
      const icon = ev.icon || "";

      if (icon === "haldi" || name.includes("haldi")) {
        if (!evEdited.date) ev.date = shortDate(addDaysYMD(d, -2));
      } else if (icon === "sangeet" || name.includes("sangeet") || name.includes("mehendi")) {
        if (!evEdited.date) ev.date = shortDate(addDaysYMD(d, -1));
      } else if (icon === "wedding" || name.includes("wedding") || name.includes("muhurat") || name.includes("pheras")) {
        if (!evEdited.date) ev.date = shortDate(d);
        if (!evEdited.time) ev.time = `Baraat 5:30 PM · Pheras ${fmtTime12(t)}`;
      } else if (icon === "reception" || name.includes("reception")) {
        if (!evEdited.date) ev.date = shortDate(d); // Same day as wedding
        if (!evEdited.time) ev.time = "7:30 PM onwards";
      }
    });
    renderEvents();
  }
};

/* ── 3. Venue & Maps — one-time prefill, then every venue stands alone ──
   The couple's intent, stated plainly: fill each function's venue FOR THEM
   ONCE, from the main venue, as a suggestion. After that every card is its
   own fact — Haldi happens at the bride's house, the wedding at the hall.
   Editing the Wedding venue must never rewrite Haldi; editing Reception must
   never rewrite Wedding. A card is auto-filled only while the designer has
   never typed in it AND it is still empty or still holds the original
   suggestion. The first keystroke in a card makes that card independent
   forever. */
const syncVenueAutoFill = (opts) => {
  const quiet = !!(opts && opts.quiet);   /* true while a keystroke is mid-flight */
  const vName = (S.venue.name || "").trim();
  const vAddr = (S.venue.address || "").trim();

  // Extract City
  if (!userEdited.city || !S.venue.city || S.venue.city === "Udaipur") {
    const parts = vAddr.split(",");
    const extractedCity = (parts[1] || parts[0] || "Udaipur").trim();
    if (extractedCity) {
      S.venue.city = extractedCity;
      const el = $("#f-city");
      if (el && document.activeElement !== el) el.value = S.venue.city;
      S.wedding.dateShort = `${finaleDate($("#f-date").value || iso.date)} · ${S.venue.city}`;
    }
  }

  // Google Maps Search Query
  if (!userEdited.mapsQuery || !S.venue.mapsQuery || S.venue.mapsQuery === "The Oberoi Udaivilas, Udaipur") {
    S.venue.mapsQuery = `${vName}, ${S.venue.city}`.replace(/^,\s*|,\s*$/g, "");
    const el = $("#f-mapsQuery");
    if (el && document.activeElement !== el) el.value = S.venue.mapsQuery;
  }

  /* The one-time suggestion for each celebration card. Only cards the
     designer has never touched. The Wedding card mirrors the main venue —
     the invitation hero shows S.venue.name — but only until it is edited. */
  if (Array.isArray(S.events) && vName) {
    S.events.forEach(ev => {
      if (!ev || !ev.id) return;
      const edited = userEdited.events[ev.id] || {};
      if (edited.venue) return;                      /* standalone forever now */
      const evV = (ev.venue || "").trim();
      /* Still holding the ORIGINAL suggestion (or empty) = safe to refresh. */
      const original = ev._suggest || "";
      if (evV && evV !== original) return;           /* they typed something else, keep it */

      const name = (ev.name || "").toLowerCase();
      const icon = ev.icon || "";
      let suggest = "";
      if (icon === "wedding" || /wedding|pheras|muhurat|muhurtham/i.test(ev.name || "")) suggest = vName;
      else if (icon === "reception" || /reception/i.test(ev.name || "")) suggest = vName;
      else if (icon === "haldi" || /haldi/i.test(ev.name || "")) suggest = `${vName} Courtyard`;
      else if (icon === "sangeet" || /sangeet|mehendi/i.test(ev.name || "")) suggest = `${vName} Lawns`;
      else suggest = vName;

      if (suggest && evV !== suggest) {
        ev.venue = suggest;
        ev._suggest = suggest;
      } else if (suggest) {
        ev._suggest = suggest;
      }
    });
  }

  /* Rebuild the list only outside keystrokes: rebuilding mid-typing is what
     made venue entry feel broken. While quiet, the already-rendered inputs
     keep the field being typed in; other cards refresh on the next sync. */
  if (!quiet) renderEvents();
};

/* ── Side Selector (Bride's Side vs Groom's Side) ── */
S.couple.side ??= "bride";
const updateSideToggleUI = () => {
  $$("#side-toggle .side-btn").forEach(b => {
    const active = (b.dataset.side === S.couple.side);
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-checked", active ? "true" : "false");
  });
};
updateSideToggleUI();

$$("#side-toggle .side-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    S.couple.side = btn.dataset.side;
    updateSideToggleUI();
    syncCoupleAutoFill();
    markTouched();
    sync(); save();
  });
});

/* ── Form Bindings ── */
const BINDINGS = new Map();
const bind = (id, get, set, evt = "input") => {
  const el = $(id);
  if (!el) return;
  BINDINGS.set(id, { get, set });
  el.value = get() ?? "";
  el.addEventListener(evt, () => { markTouched(); set(el.value); sync(); save(); });
};

bind("#f-bride", () => S.couple.bride, v => { S.couple.bride = v; syncCoupleAutoFill(); });
bind("#f-groom", () => S.couple.groom, v => { S.couple.groom = v; syncCoupleAutoFill(); });
bind("#f-brideFull", () => S.couple.brideFull, v => { S.couple.brideFull = v; userEdited.brideFull = !!v; });
bind("#f-groomFull", () => S.couple.groomFull, v => { S.couple.groomFull = v; userEdited.groomFull = !!v; });
bind("#f-monogram", () => S.couple.monogram, v => { S.couple.monogram = v; userEdited.monogram = !!v; });
bind("#f-hashtag", () => S.couple.hashtag, v => { S.couple.hashtag = v; userEdited.hashtag = !!v; });
bind("#f-tagline", () => S.couple.tagline, v => S.couple.tagline = v);
bind("#f-muhurat", () => S.wedding.muhurat, v => { S.wedding.muhurat = v; userEdited.muhurat = !!v; });

$("#f-date").value = iso.date;
$("#f-time").value = iso.time;
const tzSel = $("#f-tz");
if (![...tzSel.options].some(o => o.value === iso.tz))
  tzSel.add(new Option("Custom " + iso.tz, iso.tz), 0);
tzSel.value = iso.tz;

["#f-date", "#f-time", "#f-tz"].forEach(sel =>
  $(sel).addEventListener("change", () => { markTouched(); syncDateAutoFill(); sync(); save(); }));

bind("#f-venueName", () => S.venue.name, v => { S.venue.name = v; userEdited.venueName = !!v.trim(); syncVenueAutoFill({ quiet: true }); });
bind("#f-venueAddress", () => S.venue.address, v => { S.venue.address = v; syncVenueAutoFill({ quiet: true }); });
bind("#f-city", () => S.venue.city, v => { S.venue.city = v; userEdited.city = !!v; syncDateAutoFill(); });
bind("#f-mapsQuery", () => S.venue.mapsQuery, v => { S.venue.mapsQuery = v; userEdited.mapsQuery = !!v; });
bind("#f-formUrl", () => (/PLACEHOLDER/i.test(S.rsvp.formUrl) ? "" : S.rsvp.formUrl),
     v => S.rsvp.formUrl = v.trim());
bind("#f-deadline", () => S.rsvp.deadline, v => { S.rsvp.deadline = v; userEdited.deadline = !!v; });
bind("#f-scratchHeading", () => S.scratch.heading, v => { S.scratch.heading = v; userEdited.scratchHeading = !!v; });
bind("#f-scratchMessage", () => S.scratch.message, v => { S.scratch.message = v; userEdited.scratchMessage = !!v; });
bind("#f-sanctumHeading", () => S.sanctum.heading, v => { S.sanctum.heading = v; userEdited.sanctumHeading = !!v; });
bind("#f-sanctumHint", () => S.sanctum.hint, v => S.sanctum.hint = v);

/* ── film video clips ── */
S.films ??= [
  { id: "film1", eyebrow: "The Wedding Film", line: "Every love story deserves cinema", src: "assets/film/film1.mp4", poster: "assets/film/film1_poster.webp" },
  { id: "film2", eyebrow: "A Royal Affair", line: "Dressed in gold, bound by fire", src: "assets/film/film2.mp4", poster: "assets/film/film2_poster.webp" },
  { id: "film3", eyebrow: "The Grand Walk", line: "Every step, toward forever", src: "assets/film/film3.mp4", poster: "assets/film/film3_poster.webp" }
];

[0, 1, 2].forEach(idx => {
  const num = idx + 1;
  S.films[idx] ??= { id: "film" + num, eyebrow: "", line: "", src: "", poster: "" };
  bind(`#f-film${num}-eyebrow`, () => S.films[idx].eyebrow, v => {
    S.films[idx].eyebrow = v;
    userEdited[`film${num}Eyebrow`] = !!v;
  });
  bind(`#f-film${num}-line`, () => S.films[idx].line, v => S.films[idx].line = v);
  bind(`#f-film${num}-src`, () => S.films[idx].src, v => {
    S.films[idx].src = v;
    checkVideoDuration(v, `#f-film${num}-status`);
  });

  const fileInp = $(`#f-film${num}-file`);
  if (fileInp) {
    fileInp.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        /* A blob: URL only exists inside this browser tab. It used to be written
           straight into S.films[idx].src, so the share link carried an address
           that was already dead by the time a guest opened it — which is why an
           updated video never appeared in the shared invitation. The picked file
           now drives the LIVE PREVIEW ONLY; the src that travels stays whatever
           hosted address is typed in the field beside it. */
        const url = URL.createObjectURL(file);
        S.films[idx].preview = url;
        const st = $(`#f-film${num}-status`);
        if (st) {
          st.textContent = "Previewing “" + file.name + "”. This file stays on your " +
            "device — paste the video's web address below so your guests can see it.";
          st.classList.add("warn");
        }
        checkVideoDuration(url, null);
        markTouched(); sync(); save();
      }
    });
  }
});

function checkVideoDuration(url, statusSel) {
  const el = statusSel ? $(statusSel) : null;
  if (!el || !url) return;
  const v = document.createElement("video");
  v.preload = "metadata";
  v.src = url;
  v.onloadedmetadata = () => {
    const sec = Math.round(v.duration);
    if (!isFinite(sec)) return;
    if (sec > 60) {
      el.innerHTML = `⚠️ <b style="color:#ff8a8a">${sec} seconds</b>. Recommended: 10s to 50s (max 60s / 1 min).`;
    } else if (sec < 5) {
      el.innerHTML = `⚠️ <b style="color:#ffd073">${sec} seconds</b>. Very short clip. 10s to 50s recommended.`;
    } else {
      el.innerHTML = `✅ <b style="color:#8affaa">${sec} seconds video</b> — perfect length!`;
    }
  };
  v.onerror = () => {
    el.textContent = "Recommended: 10s to 50s (max 60s / 1 min).";
  };
}

/* ── theme ── */
const THEME_KEYS = ["maroon","maroonDeep","gold","goldSoft","ivory","inkOnIvory"];
THEME_KEYS.forEach(k => bind("#f-" + k, () => S.theme[k], v => S.theme[k] = v, "input"));

const PRESETS = [
  { n: "Royal Maroon", t: { maroon:"#6D1A33", maroonDeep:"#4A0F22", gold:"#C9A24B", goldSoft:"#E5C878", ivory:"#F4EBDB", inkOnIvory:"#3A2230" } },
  { n: "Emerald Durbar", t: { maroon:"#14503F", maroonDeep:"#0B3126", gold:"#C9A24B", goldSoft:"#E7D08A", ivory:"#F3EEE0", inkOnIvory:"#1F3129" } },
  { n: "Midnight Rose", t: { maroon:"#3A2A64", maroonDeep:"#1E1440", gold:"#D3A8C4", goldSoft:"#F0D7E6", ivory:"#F6EFF3", inkOnIvory:"#2B2140" } },
  { n: "Marigold Dawn", t: { maroon:"#B8542A", maroonDeep:"#7A2F14", gold:"#E0A32E", goldSoft:"#F6D27C", ivory:"#FBF2E3", inkOnIvory:"#452818" } },
  { n: "Ivory & Ink", t: { maroon:"#2B2B2B", maroonDeep:"#141414", gold:"#B99A5B", goldSoft:"#DCC594", ivory:"#F7F3EC", inkOnIvory:"#262626" } },
];
$("#preset-row").innerHTML = PRESETS.map((p, i) =>
  `<button class="preset" type="button" data-p="${i}"><i style="background:${p.t.maroon}"></i><i style="background:${p.t.gold}"></i>${p.n}</button>`).join("");
$$(".preset").forEach(b => b.addEventListener("click", () => {
  S.theme = { ...PRESETS[+b.dataset.p].t };
  THEME_KEYS.forEach(k => $("#f-" + k).value = S.theme[k]);
  markTouched(); sync(); save();
}));

/* ── events editor ── */
const ICONS = ["haldi", "sangeet", "wedding", "reception"];
const evList = $("#ev-list");

const renderEvents = () => {
  const openIndices = new Set();
  evList.querySelectorAll(".ev.open").forEach(el => {
    const idx = Array.prototype.indexOf.call(evList.children, el);
    if (idx >= 0) openIndices.add(idx);
  });
  if (openIndices.size === 0 && S.events.length > 0) {
    openIndices.add(0); // keep first event open by default so prefilled fields are immediately visible
  }

  /* Typing in a field must never lose focus. The cascade re-renders this
     list after every keystroke (so the other cards update live); without
     restoring focus and caret, the field died after one character and the
     couple could not type a venue on a celebration card at all. */
  const active = document.activeElement;
  let restore = null;
  if (active && active.dataset && active.dataset.k && active.closest && active.closest(".ev")) {
    const row = active.closest(".ev");
    const rowIdx = Array.prototype.indexOf.call(evList.children, row);
    restore = { rowIdx, key: active.dataset.k, caret: active.selectionStart };
  }

  evList.innerHTML = "";
  S.events.forEach((ev, i) => {
    const row = document.createElement("div");
    row.className = "ev" + (openIndices.has(i) ? " open" : "");
    row.innerHTML = `
      <div class="ev-head">
        <span class="ev-dot" style="background:${ev.accent}"></span>
        <span class="ev-name">${ev.name || "Untitled function"}</span>
        <button class="ev-btn" data-a="up"     title="Move up" type="button">↑</button>
        <button class="ev-btn" data-a="down"   title="Move down" type="button">↓</button>
        <button class="ev-btn" data-a="del"    title="Remove" type="button">✕</button>
        <button class="ev-btn" data-a="toggle" title="Edit" type="button">✎</button>
      </div>
      <div class="ev-body">
        <div class="ed-row">
          <label class="fld"><span>Function name</span><input data-k="name" type="text" value="${esc(ev.name)}"></label>
          <label class="fld"><span>Icon</span><select data-k="icon">${ICONS.map(ic =>
            `<option value="${ic}"${ic === ev.icon ? " selected" : ""}>${ic}</option>`).join("")}</select></label>
        </div>
        <div class="ed-row">
          <label class="fld"><span>Date</span><input data-k="_date" type="date" value="${toYMD(ev.date)}"></label>
          <label class="fld"><span>Time</span><input data-k="time" type="text" value="${esc(ev.time)}" placeholder="7:00 PM onwards"></label>
        </div>
        <label class="fld"><span>Venue</span><input data-k="venue" type="text" value="${esc(ev.venue)}"></label>
        <label class="fld"><span>One-line description</span><input data-k="line" type="text" value="${esc(ev.line)}"></label>
        <label class="fld"><span>Accent colour</span>
          <span class="ev-color"><input data-k="accent" type="color" value="${ev.accent}"><small>Used for the card's edge and icon</small></span>
        </label>
      </div>`;

    row.querySelectorAll("[data-k]").forEach(inp => {
      inp.addEventListener("input", () => {
        const k = inp.dataset.k;
        const evId = S.events[i].id || ("ev" + i);
        userEdited.events[evId] ??= {};
        if (k === "_date") {
          S.events[i].date = shortDate(inp.value);
          userEdited.events[evId].date = true;
        } else {
          S.events[i][k] = inp.value;
          userEdited.events[evId][k] = true;
        }
        if (k === "name") row.querySelector(".ev-name").textContent = inp.value || "Untitled function";
        if (k === "accent") row.querySelector(".ev-dot").style.background = inp.value;
        /* A venue typed on an event card is the same fact as the main venue:
           let the cascade adopt it (Wedding card) or flow down, so the
           invitation stays consistent everywhere. */
        /* Quiet: refreshing the other cards happens on the next sync; a
           rebuild here would kill the field mid-word. */
        if (k === "venue") syncVenueAutoFill({ quiet: true });
        markTouched();
        sync(); save();
      });
    });
    row.querySelectorAll(".ev-btn").forEach(b => b.addEventListener("click", () => {
      const a = b.dataset.a;
      if (a === "toggle") { row.classList.toggle("open"); return; }
      if (a === "del") { if (S.events.length > 1) S.events.splice(i, 1); }
      if (a === "up" && i > 0) S.events.splice(i - 1, 0, S.events.splice(i, 1)[0]);
      if (a === "down" && i < S.events.length - 1) S.events.splice(i + 1, 0, S.events.splice(i, 1)[0]);
      markTouched(); renderEvents(); sync(); save();
    }));
    evList.appendChild(row);
  });

  /* Put the caret back where the designer left it, in the rebuilt copy of
     the same field, so typing continues seamlessly across the rebuild. */
  if (restore && restore.rowIdx >= 0 && restore.rowIdx < S.events.length) {
    const newRow = evList.children[restore.rowIdx];
    if (newRow) {
      const el = newRow.querySelector(`[data-k="${restore.key}"]`);
      if (el) {
        el.focus();
        try { el.setSelectionRange(restore.caret, restore.caret); } catch (e) {}
      }
    }
  }
};
function esc(s) { return String(s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

$("#ev-add").addEventListener("click", () => {
  S.events.push({
    id: "fn" + Date.now(), name: "New Function", icon: "wedding",
    date: shortDate(splitISO(S.wedding.dateISO).date), time: "7:00 PM onwards",
    venue: S.venue.name, line: "A beautiful celebration", accent: S.theme.maroon,
  });
  renderEvents(); sync(); save();
  evList.lastElementChild?.classList.add("open");
  evList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});
renderEvents();

/* ── contextual preview scenes ──────────────────────────────
   The preview mirrors the open step instead of always showing the
   same card. "launch" is special: it unhides every scene so the
   whole invitation can be read through before sharing. */
const PV_LABEL = {
  couple: "· The couple", events: "· The functions", venue: "· Venue & RSVP",
  videos: "· Wedding films", blessing: "· The blessing", theme: "· Your palette",
  launch: "· The whole invitation",
};
let filmsHydrated = false;

/* Film sources are attached only once the Videos step is opened —
   the editor should never pull three videos the creator can't see. */
const hydrateFilms = () => {
  (S.films || []).forEach((f, i) => {
    const v = $(`#pv-film${i + 1}`);
    if (!v) return;
    const fig = v.closest(".pv-film");
    const src = (f.src || "").trim();
    if (src) {
      if (v.getAttribute("src") !== src) { v.src = src; v.load(); }
      if (f.poster) v.poster = f.poster;
      fig?.classList.remove("is-missing");
      v.play?.().catch(() => {});           // autoplay is muted; a block is harmless
    } else {
      v.removeAttribute("src"); v.load?.();
      fig?.classList.add("is-missing");
    }
  });
  filmsHydrated = true;
};

const setScene = (name) => {
  const card = $("#pv-card"); if (!card) return;
  card.dataset.scene = name;
  const showAll = name === "launch";
  $$(".pv-scene").forEach(s => s.classList.toggle("is-on", showAll || s.dataset.pv === name));
  const what = $("#pv-label-what");
  if (what) what.textContent = PV_LABEL[name] || "";
  if (name === "videos" || showAll) hydrateFilms();
};

/* ── step navigation ── */
const showPanel = (name) => {
  if (!name) return;
  const order = ["couple","events","venue","videos","blessing","theme","launch"];
  if (!order.includes(name)) return;

  $$(".ed-panel").forEach(p => {
    const isOn = p.dataset.panel === name;
    p.classList.toggle("is-on", isOn);
  });
  $$(".ed-step").forEach(b => {
    const isOn = b.dataset.panel === name;
    b.classList.toggle("is-on", isOn);
    if (isOn) {
      try { b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); } catch {}
    }
  });

  const fill = $("#ed-progress-fill");
  if (fill) {
    fill.style.width = ((order.indexOf(name) + 1) / order.length * 100) + "%";
  }

  setScene(name);

  // Smoothly scroll window and form container to top
  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  try {
    const formEl = $(".ed-form");
    if (formEl) formEl.scrollTo({ top: 0, behavior: "smooth" });
  } catch {}
};

$$(".ed-step").forEach(b => b.addEventListener("click", () => showPanel(b.dataset.panel)));
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-next]");
  if (t && t.dataset.next) {
    e.preventDefault();
    showPanel(t.dataset.next);
  }
});

/* ── live preview ── */
let cdTimer = 0;
/* ── preview name board ─────────────────────────────────────────
   Mirrors the invitation's rule (app.js → nameBoard): analytic canvas measurement,
   no iterative layout reads. Stack groom / ♥ / bride only when one line would be
   too small to read. Keep in step with BOARD in app.js. */
const PV_NAMES = { maxPx: 30, minPx: 11, oneLineMinPx: 17, safety: 0.97, comfortPx: 12 };
const fitPvNames = () => {
  const el = $("#pv-names");
  if (!el) return;
  const wrap = el.closest(".pv-glass");
  const card = $("#pv-card");
  const isGroomSide = (S.couple.side === "groom");
  const [b, g] = [String(S.couple.bride || "").trim(), String(S.couple.groom || "").trim()];
  const first = isGroomSide ? g : b;
  const second = isGroomSide ? b : g;

  const draw = (stacked) => {
    el.classList.toggle("pv-names--stacked", stacked);
    el.innerHTML = stacked
      ? `<b>${esc(first)}</b><i>♥</i><b>${esc(second)}</b>`
      : `<b>${esc(first)}</b> <i>♥</i> <b>${esc(second)}</b>`;
  };
  const gauge = (() => { try { const c = document.createElement("canvas").getContext("2d"); return c; } catch { return null; } })();
  const REF = 100, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const availWidth = () => {
    if (!wrap || !card) return 360;
    const pw = wrap.getBoundingClientRect().width;
    const cs = getComputedStyle(card);
    return Math.min(parseFloat(cs.maxWidth) || 540, pw - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
  };
  const textWidthAt = (text, px) => {
    if (!gauge || !text) return px * text.length * 0.58;
    const cs = getComputedStyle(el);
    gauge.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    return gauge.measureText(text).width;
  };
  const sizeFor = (text) => {
    if (!gauge || !text) return PV_NAMES.maxPx;
    const per = textWidthAt(text, REF) / REF;
    return per ? clamp(availWidth() * PV_NAMES.safety / per, PV_NAMES.minPx, PV_NAMES.maxPx) : PV_NAMES.maxPx;
  };
  const setPx = (v) => document.documentElement.style
    .setProperty("--pv-names-fs", Math.round(v * 100) / 100 + "px");
  /* Measure first, draw after — same pattern as app.js. */
  const oneLinePx = sizeFor(`${first} ♥ ${second}`);
  const stacked = oneLinePx < PV_NAMES.oneLineMinPx;
  draw(stacked);
  const px = stacked
    ? Math.max(PV_NAMES.comfortPx, Math.min(sizeFor(first), sizeFor(second)))
    : oneLinePx;
  setPx(px);
};

const sync = () => {
  const c = $("#pv-card");
  c.style.setProperty("--pm", S.theme.maroon);
  c.style.setProperty("--pd", S.theme.maroonDeep);
  c.style.setProperty("--pg", S.theme.gold);
  c.style.setProperty("--pgs", S.theme.goldSoft);
  c.style.setProperty("--pi", S.theme.ivory);
  c.style.setProperty("--pk", S.theme.inkOnIvory);

  $("#pv-monogram").textContent = S.couple.monogram || "♥";
  fitPvNames();
  $("#pv-vow").textContent = S.couple.tagline;
  $("#pv-date").textContent = S.wedding.dateDisplay;
  $("#pv-muhurat").textContent = `${S.wedding.muhurat} · ${S.venue.city}`;
  $("#pv-venue").textContent = S.venue.name;
  $("#pv-tag").textContent = S.couple.hashtag;
  $("#ed-iso").textContent = S.wedding.dateISO;

  $("#pv-events").innerHTML = S.events.map(ev =>
    `<div class="pv-ev"><i style="background:${ev.accent}"></i><b>${esc(ev.name)}</b><small>${esc(ev.date)}</small></div>`).join("");

  /* ── scene 2 · functions ── */
  const dayCount = new Set(S.events.map(e => e.date)).size;
  const evEyebrow = $("#pv-ev-eyebrow");
  if (evEyebrow) evEyebrow.textContent =
    `${dayCount} day${dayCount === 1 ? "" : "s"} of festivity`;
  const evEmpty = $("#pv-ev-empty");
  if (evEmpty) evEmpty.hidden = S.events.length > 0;

  /* ── scene 3 · venue & rsvp ── */
  const setTxt = (sel, txt) => { const n = $(sel); if (n) n.textContent = txt || ""; };
  setTxt("#pv-address", S.venue.address);
  setTxt("#pv-maps", `📍 ${S.venue.mapsQuery || S.venue.name}`);
  setTxt("#pv-deadline", S.rsvp.deadline);
  const usesForm = !!S.rsvp.formUrl && !/PLACEHOLDER/i.test(S.rsvp.formUrl);
  setTxt("#pv-rsvp-kind", usesForm ? "Your Google Form" : "Built-in RSVP form");

  /* ── scene 4 · films ── */
  (S.films || []).forEach((f, i) => {
    setTxt(`#pv-film${i + 1}-eyebrow`, f.eyebrow);
    setTxt(`#pv-film${i + 1}-line`, f.line);
  });
  if (filmsHydrated) hydrateFilms();

  /* ── scene 5 · blessing ── */
  setTxt("#pv-scratch-heading", S.scratch.heading);
  setTxt("#pv-scratch-message", S.scratch.message);
  setTxt("#pv-sanctum-heading", S.sanctum.heading);
  setTxt("#pv-sanctum-hint", S.sanctum.hint);

  /* ── scene 6 · palette ── */
  setTxt("#pv-theme-names", `${S.couple.bride} & ${S.couple.groom}`);
  const pal = $("#pv-pal");
  if (pal) pal.innerHTML = [
    [S.theme.maroon, "Primary"], [S.theme.maroonDeep, "Deep"], [S.theme.gold, "Gold"],
    [S.theme.goldSoft, "Soft"], [S.theme.ivory, "Ivory"], [S.theme.inkOnIvory, "Ink"],
  ].map(([hex, lbl]) =>
    `<div><i style="background:${esc(hex)}"></i><span>${lbl}</span></div>`).join("");

  clearTimeout(cdTimer);
  const tickCd = () => {
    let ms = new Date(S.wedding.dateISO).getTime() - Date.now();
    if (!isFinite(ms)) { $("#pv-cd").innerHTML = ""; return; }
    ms = Math.max(0, ms);
    const p = (n) => String(n).padStart(2, "0");
    $("#pv-cd").innerHTML = [
      [p(ms / 864e5 | 0), "Days"], [p((ms / 36e5 | 0) % 24), "Hours"],
      [p((ms / 6e4 | 0) % 60), "Mins"], [p((ms / 1e3 | 0) % 60), "Secs"],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("");
    cdTimer = setTimeout(tickCd, 1000);
  };
  tickCd();

  const link = "invitation.html?draft=1";
  $("#btn-preview").href = link;
  $("#btn-open").href = link;
  renderChecklist();
};

/* ── checklist ── */
const renderChecklist = () => {
  const ul = $("#checklist"); if (!ul) return;
  const rows = [
    ["Couple names set", !!(S.couple.bride && S.couple.groom)],
    ["Muhurat date & time chosen", !!S.wedding.dateISO && new Date(S.wedding.dateISO) > new Date()],
    [`${S.events.length} function${S.events.length === 1 ? "" : "s"} added`, S.events.length > 0],
    ["Venue & maps search filled", !!(S.venue.name && S.venue.mapsQuery)],
    ["RSVP form linked", !!S.rsvp.formUrl && !/PLACEHOLDER/i.test(S.rsvp.formUrl)],
    ["Secret blessing written", !!S.scratch.message],
    ["Films use web addresses your guests can open",
      !(S.films || []).some(f => f && isLocalOnlySrc(f.src))],
  ];
  ul.innerHTML = rows.map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${t}</li>`).join("");
};

/* ── launch actions ── */
const toast = (msg) => {
  const el = $("#ed-toast");
  el.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.textContent = "", 3200);
};
const download = (name, text, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const configFile = () =>
  "/* ============================================================\n" +
  "   ROYAL WEDDING INVITE — CLIENT CONFIG\n" +
  "   Generated by the Invitation Studio editor.\n" +
  "   ============================================================ */\n" +
  "window.WEDDING_CONFIG = " + JSON.stringify(S, null, 2) + ";\n";

$("#btn-config").addEventListener("click", () => {
  download("config.js", configFile(), "text/javascript");
  toast("config.js downloaded — drop it into the project root.");
});
$("#btn-json").addEventListener("click", () => {
  download(`${S.couple.bride}-${S.couple.groom}-brief.json`, JSON.stringify(S, null, 2), "application/json");
  toast("Brief downloaded.");
});
/* ═══════════ PUBLISH ═══════════
   The editor used to hand out a "?c=…" link that carried the whole design in
   the address bar. That link was free, unlimited and permanent, which is a
   generous thing to give away when the link is the product. It is gone.

   What replaces it is one POST carrying the activation code the studio sends
   after payment. The code is checked on the server — this file has no list of
   codes, cannot tell a real one from a guess, and never puts what was typed
   into the URL, the draft, an analytics event or a log line. */

/* Anything that lives only on this device cannot travel: a blob: or data: film
   would arrive at a guest's phone as a dead address. The server's allow-list
   refuses them anyway (it takes absolute https only), but stripping them here
   lets us say so plainly instead of letting the film band quietly fall back. */
const publishPayload = () => {
  const out = JSON.parse(JSON.stringify(S));
  /* Internal cascade markers (— which values the venue engine wrote vs the
     user) are bookkeeping, never part of the invitation. */
  if (Array.isArray(out.events)) {
    out.events.forEach((ev) => {
      if (!ev) return;
      delete ev._cascade;
      delete ev._cascadeValues;
      delete ev._suggest;
    });
  }
  if (Array.isArray(out.films)) {
    out.films.forEach((f) => {
      if (!f) return;
      delete f.preview;
      if (isLocalOnlySrc(f.src)) f.src = "";
      if (isLocalOnlySrc(f.poster)) f.poster = "";
    });
  }
  return out;
};

const pubStatus = (msg, kind) => {
  const el = $("#publish-status");
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
  el.className = "publish-status" + (kind ? " is-" + kind : "");
};
const pubBusy = (on) => {
  const go = $("#btn-publish-go");
  if (go) { go.disabled = on; go.textContent = on ? "Publishing…" : "Publish my website"; }
  const rec = $("#btn-publish-recover");
  if (rec) rec.disabled = on;
};

/* Shown once the server has confirmed. The draft is cleared only here — never
   before, and never on a failure, because a customer who has already paid must
   still have their design if the request did not land. */
const pubDone = (url) => {
  $("#publish-form").hidden = true;
  $("#publish-done").hidden = false;
  $("#publish-link").value = url;
  const isGroom = (S.couple && S.couple.side === "groom");
  const who = isGroom
    ? [S.couple.groom, S.couple.bride].filter(Boolean).join(" & ")
    : [S.couple.bride, S.couple.groom].filter(Boolean).join(" & ");
  const text = `You are royally invited to the wedding of ${who}!\nOpen our invitation: ${url}`;
  $("#btn-publish-wa").href = "https://wa.me/?text=" + encodeURIComponent(text);
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
};

$("#btn-publish").addEventListener("click", () => {
  const box = $("#publish-box");
  const opening = box.hidden;
  box.hidden = !opening;
  if (opening) {
    pubStatus("");
    setTimeout(() => $("#publish-token").focus(), 60);
  }
});

$("#btn-publish-go").addEventListener("click", async () => {
  const token = ($("#publish-token").value || "").trim();
  if (!token) { pubStatus("Please enter the activation code we sent you.", "warn"); return; }
  if (!window.DD_PUBLISH) { pubStatus("Publishing is unavailable on this page just now. Please reload and try again.", "error"); return; }

  const stripped = (S.films || []).filter(f => f && isLocalOnlySrc(f.src)).length;
  if (stripped) {
    pubStatus(`${stripped} uploaded video${stripped === 1 ? "" : "s"} cannot be published from this device — ` +
      "paste each film's web address in the Films step, or we will use our own films.", "warn");
  }

  pubBusy(true);
  save();
  try {
    const res = await window.DD_PUBLISH.publish({
      token,
      template: "sample2",
      content: publishPayload(),
      photos: [],                       /* this design takes no customer photographs */
      weddingDate: S.wedding.dateISO,
      onState: (st) => { if (st.message && st.phase !== "error") pubStatus(st.message, "busy"); },
    });
    pubDone(res.url);
  } catch (err) {
    pubStatus((err && err.userMessage) || "Something went wrong. Please try again.", "error");
    /* Once a publish request has left this device, "try again" must never mean
       "publish twice" — it means ask the server what happened. */
    $("#btn-publish-recover").hidden = false;
  } finally {
    pubBusy(false);
  }
});

$("#btn-publish-recover").addEventListener("click", async () => {
  const token = ($("#publish-token").value || "").trim();
  if (!token) { pubStatus("Please enter the activation code we sent you.", "warn"); return; }
  pubBusy(true);
  try {
    const res = await window.DD_PUBLISH.recover(token);
    pubDone(res.url);
  } catch (err) {
    pubStatus((err && err.userMessage) || "We could not find a published website for that code.", "error");
  } finally {
    pubBusy(false);
  }
});

$("#btn-publish-copy").addEventListener("click", async () => {
  const url = $("#publish-link").value;
  try { await navigator.clipboard.writeText(url); toast("Link copied."); }
  catch { $("#publish-link").select(); }
});

/* ═══════════ SHARE A PREVIEW LINK ═══════════
   A ?c= link carries the whole design inside the URL itself, so it opens
   this exact invitation on any device — the reading half already lives in
   config.js, app.js and the 3D world. The payload is trimmed to what the
   invitation actually renders: the frames/sanctum asset settings never
   change per couple and would only bloat the URL. */
const b64url = (s) => {
  const bin = Array.from(new TextEncoder().encode(s), b => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const sharePayload = () => {
  const out = publishPayload();
  delete out.frames;
  if (out.sanctum) out.sanctum = { heading: out.sanctum.heading, hint: out.sanctum.hint };
  return out;
};
const shareUrl = () => {
  /* The link-card renderer is a server function. On Netlify it is reached
     through a share.html rewrite; on Cloudflare the equivalent /api/card
     route is the one that reliably matches — the space-containing
     share.html route does not match on Cloudflare's function router.
     Both render the same invitation page with the couple's own <head>,
     which is what WhatsApp and Google read for the preview card. The
     browser half is unchanged: config.js still decodes ?c= from the URL. */
  const u = new URL("/api/card", location.origin);
  u.searchParams.set("template", "sample2");
  u.searchParams.set("c", b64url(JSON.stringify(sharePayload())));
  return u.toString();
};
const shareDone = (url) => {
  const isGroomSide = (S.couple.side === "groom");
  const who = isGroomSide
    ? [S.couple.groom, S.couple.bride].filter(Boolean).join(" & ")
    : [S.couple.bride, S.couple.groom].filter(Boolean).join(" & ");
  $("#share-box").hidden = false;
  $("#share-link").value = url;
  const text = who
    ? `You are royally invited to the wedding of ${who}!\nOpen our invitation: ${url}`
    : `Open our wedding invitation: ${url}`;
  $("#btn-share-wa").href = "https://wa.me/?text=" + encodeURIComponent(text);
};
$("#btn-share").addEventListener("click", () => {
  const box = $("#share-box");
  const opening = box.hidden;
  box.hidden = !opening;
  if (opening) {
    shareDone(shareUrl());
    setTimeout(() => $("#share-link").select(), 60);
  }
});
$("#btn-share-copy").addEventListener("click", async () => {
  const url = $("#share-link").value;
  try { await navigator.clipboard.writeText(url); toast("Preview link copied."); }
  catch { $("#share-link").select(); }
});
$("#btn-send").addEventListener("click", (e) => {
  e.preventDefault();
  const body = encodeURIComponent(
    `Hello,\n\nHere is our invitation brief.\n\n` +
    `Couple: ${S.couple.brideFull} & ${S.couple.groomFull}\n` +
    `Date: ${S.wedding.dateDisplay} · ${S.wedding.muhurat}\n` +
    `Venue: ${S.venue.name}, ${S.venue.address}\n` +
    `Functions: ${S.events.map(x => `${x.name} (${x.date})`).join(", ")}\n\n` +
    `--- full config ---\n${JSON.stringify(S, null, 2)}\n`);
  location.href = `mailto:${STUDIO_EMAIL}?subject=${encodeURIComponent("Invitation brief — " + S.couple.bride + " & " + S.couple.groom)}&body=${body}`;
});
$("#btn-reset").addEventListener("click", () => {
  if (!confirm("Reset everything back to the demo invitation?")) return;
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
  location.href = "create.html";
});

syncCoupleAutoFill();
syncDateAutoFill();
syncVenueAutoFill();
sync();
setScene("couple");   /* preview starts on the step the editor opens on */
/* No save() here. Saving on load wrote a demo copy of the state into every
   visitor’s browser — which then looked like “a saved design” on the next
   visit, even on a device that had never edited anything. The draft is
   written only when the designer actually changes something (every input
   handler calls save(), and save() refuses until markTouched has run). */
userTouchedTheDesign = false;

})();
