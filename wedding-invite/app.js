/* ============================================================
   DEEPDREAMS WEDDING BUILDER
   One page, three lives:
     1. EDITOR  — couple opens /wedding/ (or ?edit), fills their
        details, uploads photos, sees the site live.
     2. SHARED  — guests open the couple's link; every detail
        travels compressed inside the link itself (#d=...).
        No accounts, no database, no cost.
     3. RETIRED — the link reads its own wedding date and retires
        itself the day after the wedding, automatically.

   Festivities: each celebration is a sealed card guests open
   with a ritual gesture — rub off the turmeric, trace the henna
   heart, tap the dhol, light the diya.
   ============================================================ */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STUDIO_WA = "919010901232";
const STORE_KEY = "dd_wedding_draft";

const isDefaultImage = url => !url || url.startsWith("posters/");

/* ---------- default (sample) invitation ---------- */
const DEFAULTS = {
  bride: "Saanvi", groom: "Vihaan",
  brideParents: "Adira and Sai Nadha",
  groomParents: "Medha and Ram Reddy",
  brideCity: "Hyderabad", groomCity: "Hyderabad",
  date: "2024-12-11", time: "18:00",
  venueName: "The Grand Pavilion",
  venueAddr: "The Grand Pavilion, Hyderabad",
  mapUrl: "",
  phone: "",
  story: "What began as a chance meeting at a family gathering blossomed — with the blessings of both families — into a love written in the stars. Now, we begin our forever, and we want you beside us when we do.",
  events: [
    { name: "Nichitartam", when: "Engagement Day · August 16th · 10:30 AM", where: "Main Mandapam", note: "The formal engagement with the exchange of Thambulams", mode: "trace", dress: "Pastels & florals" },
    { name: "Haldi Ceremony", when: "At 6:00 PM · 8th December, 2026", where: "Vemuri Vari Palace, Rajahmundry", note: "Turmeric, laughter, and the morning's first blessings.", mode: "rub", dress: "Yellow & floral" },
    { name: "Shubha Muhurtam", when: "Wedding Day · August 16th · 9:42 AM", where: "Main Mandapam", note: "The tying of Mangalyam — the moment two becomes one", mode: "light", dress: "Traditional silks" },
    { name: "Grand Reception", when: "Reception Day · August 16th · 7:00 PM Onwards", where: "Main Mandapam", note: "Dinner, Music and Your Blessings for the New Couple", mode: "tap", dress: "Festive & fabulous" }
  ],
  photos: [null, null, null, null, null],
  cover: null,
  welcomeImg: "posters/welcome_clean.jpg"
};
/* sample wedding date = 60 days out, so the demo always looks alive */
(() => {
  const d = new Date(Date.now() + 60 * 864e5);
  DEFAULTS.date = d.toISOString().slice(0, 10);
})();

/* ---------- state & mode ---------- */
let DATA = JSON.parse(JSON.stringify(DEFAULTS));
const hashData = location.hash.startsWith("#d=") ? location.hash.slice(3) : null;
const urlParams = new URLSearchParams(location.search);
const wantsEdit = urlParams.has("edit");
const VIEWING = !!hashData && !wantsEdit;  /* guest opening a shared link */
const EDITING = wantsEdit;                 /* the couple building theirs */
const DEMO    = !hashData && !wantsEdit;   /* bare page or ?demo — the live demo */

function decode(comp) {
  try {
    const json = window.LZString
      ? LZString.decompressFromEncodedURIComponent(comp)
      : decodeURIComponent(escape(atob(comp)));
    const d = JSON.parse(json);
    return { ...JSON.parse(JSON.stringify(DEFAULTS)), ...d,
             events: d.events?.length ? d.events : DEFAULTS.events,
             photos: [...(d.photos || []), null, null, null, null, null].slice(0, 5) };
  } catch (e) { return null; }
}
function encode(obj) {
  const json = JSON.stringify(obj);
  return window.LZString
    ? LZString.compressToEncodedURIComponent(json)
    : btoa(unescape(encodeURIComponent(json)));
}

if (VIEWING) {
  const d = decode(hashData);
  if (d) DATA = d;
  document.body.classList.add("viewing");
} else if (DEMO) {
  /* the live demo behaves exactly like a guest view of the sample couple */
  document.body.classList.add("viewing");
} else if (EDITING) {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) DATA = { ...DATA, ...JSON.parse(saved) };
    else if (hashData) { const d = decode(hashData); if (d) DATA = d; }
  } catch (e) {}
}

/* ---------- date helpers ---------- */
const weddingMoment = () => new Date(`${DATA.date}T${DATA.time || "09:00"}`);
const fmtLong = ds => {
  const d = new Date(ds + "T12:00");
  return isNaN(d) ? "" : d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtTime = t => {
  const [h, m] = (t || "9:00").split(":").map(Number);
  const am = h < 12 ? "AM" : "PM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${am}`;
};

/* ---------- expiry: the link retires the day after the wedding ---------- */
function expired() {
  const w = weddingMoment();
  if (isNaN(w)) return false;
  const gone = new Date(w); gone.setDate(gone.getDate() + 1); gone.setHours(23, 59, 59);
  return Date.now() > gone.getTime();
}
if (VIEWING && expired()) {
  $("#invitation").style.display = "none";
  const ex = $("#expiredScreen");
  ex.hidden = false;
  $("#expNames").textContent = `${DATA.bride} & ${DATA.groom}`;
  $("#expStudioLink").href = "../index.html";
}

/* ============================================================
   FESTIVITY MODES — the four ritual gestures
   ============================================================ */
const MODES = {
  rub: {
    label: "RUB TO REVEAL", hint: "Rub off the turmeric",
    color: "#F4B400", accent: "#C98F00",
    art: `<svg viewBox="0 0 96 128" preserveAspectRatio="none" aria-hidden="true">
      <rect width="96" height="128" fill="#F4B400"/>
      <circle cx="20" cy="26" r="7" fill="#FFDC78" opacity=".55"/>
      <circle cx="66" cy="18" r="5" fill="#FFDC78" opacity=".4"/>
      <circle cx="78" cy="58" r="8" fill="#E8A800" opacity=".5"/>
      <circle cx="30" cy="74" r="6" fill="#FFDC78" opacity=".45"/>
      <circle cx="58" cy="98" r="7" fill="#E8A800" opacity=".4"/>
      <path d="M24 52 Q48 38 72 52" stroke="rgba(255,255,255,.85)" stroke-width="7" stroke-linecap="round" fill="none"/>
      <path d="M28 68 Q48 56 68 68" stroke="rgba(255,255,255,.55)" stroke-width="6" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  trace: {
    label: "TRACE THE HEART", hint: "Trace the heart with henna",
    color: "#C1876B", accent: "#8B4513",
    art: `<svg viewBox="0 0 96 128" preserveAspectRatio="none" aria-hidden="true">
      <rect width="96" height="128" fill="#FDF6E3"/>
      <path d="M48 96 C24 76 16 58 25 46 C32 36 45 38 48 50 C51 38 64 36 71 46 C80 58 72 76 48 96 Z"
        fill="none" stroke="#C1876B" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round"/>
      <circle cx="48" cy="50" r="2.5" fill="#8B4513"/>
      <circle cx="25" cy="46" r="2" fill="#C1876B"/>
      <circle cx="71" cy="46" r="2" fill="#C1876B"/>
      <circle cx="48" cy="96" r="2" fill="#C1876B"/>
    </svg>`
  },
  tap: {
    label: "TAP THE DHOL", hint: "Tap the dhol to the beat",
    color: "#C73030", accent: "#8B0000",
    art: `<svg viewBox="0 0 96 128" preserveAspectRatio="none" aria-hidden="true">
      <rect width="96" height="128" fill="#A71F1F"/>
      <ellipse cx="48" cy="72" rx="34" ry="24" fill="#6F3A15"/>
      <ellipse cx="48" cy="58" rx="34" ry="10" fill="#E9D18E"/>
      <ellipse cx="48" cy="58" rx="34" ry="10" fill="none" stroke="#5A2C0E" stroke-width="2"/>
      <path d="M20 62 v18 M31 66 v20 M42 68 v21 M53 68 v21 M64 66 v20 M75 62 v18" stroke="#E8D68A" stroke-width="1.4" opacity=".8"/>
      <path d="M60 30 L74 44 M36 30 L22 44" stroke="#F2CC6B" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  light: {
    label: "LIGHT THE DIYA", hint: "Light the diya to reveal",
    color: "#7D2727", accent: "#C8A253",
    art: `<svg viewBox="0 0 96 128" preserveAspectRatio="none" aria-hidden="true">
      <rect width="96" height="128" fill="#2A0A0A"/>
      <circle cx="48" cy="56" r="22" fill="#FFB100" opacity=".18"/>
      <path d="M48 40 C42 52 43 60 48 63 C53 60 54 52 48 40 Z" fill="#FFB100"/>
      <path d="M48 46 C45.5 52 46 57 48 59 C50 57 50.5 52 48 46 Z" fill="#FFF7A0"/>
      <path d="M18 72 Q48 92 78 72 L72 86 Q48 100 24 86 Z" fill="#C8873A"/>
      <ellipse cx="48" cy="72" rx="30" ry="6" fill="#8A4D1C"/>
    </svg>`
  }
};
const MODE_KEYS = ["rub", "trace", "tap", "light"];

function modeFor(ev, i) {
  if (ev.mode && MODES[ev.mode]) return ev.mode;
  const n = (ev.name || "").toLowerCase();
  if (/haldi|snanam|manjal|pasupu|pithi/.test(n)) return "rub";
  if (/mehndi|mehendi|henna|nichay|engag|roka|thilak/.test(n)) return "trace";
  if (/sangeet|reception|dance|music|dj|baraat/.test(n)) return "tap";
  if (/muhurtham|wedding|kalyanam|marriage|vivah|mangalyam|lagnam|muhurat/.test(n)) return "light";
  return MODE_KEYS[i % 4];
}

/* ---------- render ---------- */
function render() {
  $$("[data-bind]").forEach(el => {
    const k = el.dataset.bind;
    if (k === "dateLong") el.textContent = fmtLong(DATA.date);
    else if (k === "muhurthamTime") el.textContent = fmtTime(DATA.time);
    else if (k === "venueShort") el.textContent = `${DATA.venueName}, ${DATA.brideCity || ""}`.replace(/, $/, "");
    else if (k === "venueName") el.textContent = DATA.venueName;
    else if (k === "venueAddr") el.textContent = DATA.venueAddr;
    else if (DATA[k] != null) el.textContent = DATA[k];
  });

  /* festivities — sealed reveal cards on the garland timeline */
  $("#eventsList").innerHTML = DATA.events.map((ev, i) => {
    const m = MODES[modeFor(ev, i)];
    return `
    <div class="event reveal in">
      <span class="event-dot">✿</span>
      <div class="fest-row">
        <div class="fest-info">
          <p class="event-when">${esc(ev.when)}</p>
          <h3 class="event-name">${esc(ev.name)}</h3>
          <p class="event-where">${esc(ev.where)}</p>
          ${ev.note ? `<p class="event-note">${esc(ev.note)}</p>` : ""}
        </div>
        <button class="fest-card" data-fest="${i}" type="button"
          style="--fc:${m.color};--fa:${m.accent}"
          aria-label="${esc(ev.name)} — ${m.hint}">
          <span class="fest-art">${m.art}</span>
          <span class="fest-hint">${m.label}</span>
        </button>
      </div>
    </div>`;
  }).join("");
  $$("#eventsList [data-fest]").forEach(b =>
    b.addEventListener("click", () => openFest(+b.dataset.fest)));

  /* photos */
  $$(".gal-item").forEach(fig => {
    const i = +fig.dataset.photo;
    const src = DATA.photos[i];
    fig.classList.toggle("has-photo", !!src);
    if (src) fig.querySelector("img").src = src;
  });

  /* map + rsvp — accepts a full Google Maps link OR a typed place name */
  const mu = (DATA.mapUrl || "").trim();
  $("#mapBtn").href = /^https?:\/\//i.test(mu) ? mu :
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mu || (DATA.venueName + " " + DATA.venueAddr))}`;
  updateRsvp();

  /* welcome poster — full-frame standing couple artwork shown after doors part */
  const wp = $("#welcomePoster");
  if (wp) {
    const wImg = DATA.welcomeImg || "posters/welcome_clean.jpg";
    const isDefaultWelcome = isDefaultImage(wImg);
    wp.hidden = false;
    wp.innerHTML = `
      <div class="poster-card-container hero-poster-art">
        <div class="poster-img-wrap">
          <img class="poster-card-img" src="${wImg}" alt="Wedding Invitation" onerror="this.onerror=null;this.src='posters/welcome_clean.jpg'" />
          ${isDefaultWelcome ? `<div class="poster-overlay ov-welcome">
            <p class="ov-line ov-together">Together with</p>
            <p class="ov-line ov-lovefam">love &amp; families,</p>
            <p class="ov-line ov-request">Request the honor of your presence</p>
            <h2 class="ov-line ov-bride" style="--name-len:${(DATA.bride || "Saanvi").length}">${esc(DATA.bride || "Saanvi")}</h2>
            <p class="ov-line ov-bride-parents" style="--parent-len:${("Daughter of " + (DATA.brideParents || "")).length}">Daughter of ${esc(DATA.brideParents || "Adira and Sai Nadha")}</p>
            <p class="ov-line ov-amp">&amp;</p>
            <h2 class="ov-line ov-groom" style="--name-len:${(DATA.groom || "Vihaan").length}">${esc(DATA.groom || "Vihaan")}</h2>
            <p class="ov-line ov-groom-parents" style="--parent-len:${("Son of " + (DATA.groomParents || "")).length}">Son of ${esc(DATA.groomParents || "Medha and Ram Reddy")}</p>
            <p class="ov-line ov-celebration">at their wedding celebration</p>
            <p class="ov-line ov-time">Time: ${esc(fmtTime(DATA.time) || "6:00 PM onwards")}</p>
            <p class="ov-line ov-date">${esc(fmtLong(DATA.date) || "Saturday, 11 December 2024")}</p>
            <p class="ov-line ov-venue" style="--venue-len:${("Venue: " + (DATA.venueName || "")).length}">Venue: ${esc(DATA.venueName || "The Grand Pavilion")}</p>
            <p class="ov-line ov-city">${esc(DATA.brideCity || "Hyderabad")}</p>
            <div class="ov-banner">YOU ARE WARMLY INVITED</div>
          </div>` : ""}
        </div>
        <div class="poster-card-actions">
          <button class="pca-btn primary" type="button" onclick="openEditorDrawer('welcome')">✎ Edit Names &amp; Details</button>
          <button class="pca-btn" type="button" onclick="triggerPhotoUpload('welcome')">📷 Replace Couple Photo</button>
          <button class="pca-btn" type="button" onclick="openAIPromptModal('welcome')">✨ AI Prompt Generator</button>
        </div>
      </div>`;
  }

  /* cover seal — couple photo if they added one, else a gold monogram */
  const sealImg = $("#sealImg"), sealMono = $("#sealMono");
  if (sealImg) {
    const cp = DATA.cover || DATA.photos[0];
    if (cp) { sealImg.src = cp; sealImg.hidden = false; sealMono.hidden = true; }
    else {
      sealImg.hidden = true; sealMono.hidden = false;
      sealMono.textContent = `${(DATA.bride || "S")[0]} ♥ ${(DATA.groom || "V")[0]}`;
    }
  }

  document.title = `${DATA.bride} & ${DATA.groom} — Wedding Invitation`;
}
const esc = s => ("" + (s ?? "")).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/* ============================================================
   FESTIVITY MODAL + THE FOUR GESTURES
   ============================================================ */
let festBusy = false;

const DEMO_POSTERS = {
  trace: "posters/nichayathartham_clean.jpg",
  rub: "posters/haldi_clean.jpg",
  light: "posters/muhurtham_clean.jpg",
  tap: "posters/reception_clean.jpg"
};

function buildPosterOverlay(mk, ev) {
  const b = esc(DATA.bride || "Saanvi"), g = esc(DATA.groom || "Vihaan");
  const note = ev.note || "";
  const when = ev.when || "";
  const whenParts = when.split("·").map(s => s.trim());

  if (mk === "trace") {
    // Nichayathartham
    return `<div class="poster-overlay ov-nichayathartham">
      <p class="ov-line ov-title">${esc(ev.name)}</p>
      <p class="ov-line ov-desc1">The formal engagement</p>
      <p class="ov-line ov-desc2">with the exchange of Thambulams</p>
      <div class="ov-bar">
        <div class="ov-bar-col"><p class="ov-bar-label">ENGAGEMENT DAY</p><p class="ov-bar-val">${esc(whenParts[1] || "August 16th")}</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">TIME</p><p class="ov-bar-val">${esc(whenParts[2] || "10:30 AM")}</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">VENUE</p><p class="ov-bar-val">${esc(ev.where || "MAIN MANDAPAM")}</p></div>
      </div>
    </div>`;
  }
  if (mk === "rub") {
    // Haldi
    return `<div class="poster-overlay ov-haldi">
      <p class="ov-line ov-invite-text">You are so invited to our</p>
      <p class="ov-line ov-title">Haldi</p>
      <p class="ov-line ov-ceremony">CEREMONY</p>
      <div class="ov-line ov-divider"></div>
      <p class="ov-line ov-person" style="--person-len:${(`${b} & ${g}`).length}">${b} &amp; ${g}</p>
      <p class="ov-line ov-time">AT 6:00 PM</p>
      <p class="ov-line ov-day">8th December, 2026</p>
      <p class="ov-line ov-venue" style="--venue-len:${(ev.where || "").length}">${esc(ev.where || "Vemuri Vari Palace, Rajahmundry")}</p>
      <div class="ov-banner">INVITE YOUR FAMILY</div>
    </div>`;
  }
  if (mk === "light") {
    // Muhurtham
    return `<div class="poster-overlay ov-muhurtham">
      <p class="ov-line ov-title">${esc(ev.name)}</p>
      <p class="ov-line ov-desc-pre">The tying of Mangalyam</p>
      <p class="ov-line ov-desc-sub">— the moment two becomes one —</p>
      <div class="ov-bar">
        <div class="ov-bar-col"><p class="ov-bar-label">WEDDING DAY</p><p class="ov-bar-val">${esc(whenParts[1] || "August 16th")}</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">TIME</p><p class="ov-bar-val">${esc(whenParts[2] || "9:42 AM")}</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">VENUE</p><p class="ov-bar-val">${esc(ev.where || "MAIN MANDAPAM")}</p></div>
      </div>
    </div>`;
  }
  if (mk === "tap") {
    // Reception
    return `<div class="poster-overlay ov-reception">
      <p class="ov-line ov-title">${esc(ev.name)}</p>
      <p class="ov-line ov-desc1">Dinner, Music and</p>
      <p class="ov-line ov-desc2">Your Blessings for the New Couple</p>
      <div class="ov-bar">
        <div class="ov-bar-col"><p class="ov-bar-label">RECEPTION DAY</p><p class="ov-bar-val">${esc(whenParts[1] || "August 16th")}</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">TIME</p><p class="ov-bar-val">7:00 PM Onwards</p></div>
        <div class="ov-bar-col"><p class="ov-bar-label">VENUE</p><p class="ov-bar-val">${esc(ev.where || "MAIN MANDAPAM")}</p></div>
      </div>
      <div class="ov-banner">YOU ARE WARMLY INVITED</div>
    </div>`;
  }
  return "";
}

let activeFestIndex = null;

function openFest(i) {
  activeFestIndex = i;
  const ev = DATA.events[i];
  if (!ev) return;
  const mk = modeFor(ev, i);
  const m = MODES[mk];
  festBusy = false;
  const dlg = $("#festDialog");
  dlg.style.setProperty("--fc", m.color);
  dlg.style.setProperty("--fa", m.accent);
  $("#festFootHint").textContent = m.hint;
  $("#festFootHint").hidden = false;
  $("#festBless").hidden = true;
  const paper = $("#festPaper");
  
  const imgSrc = ev.img || DEMO_POSTERS[mk] || "posters/welcome_clean.jpg";
  const isDefaultPoster = isDefaultImage(imgSrc);
  paper.classList.add("has-art");
  paper.innerHTML = `
    <div class="poster-card-container">
      <div class="poster-img-wrap">
        <img class="fp-art poster-card-img" src="${imgSrc}" alt="${esc(ev.name)} ceremony poster" onerror="this.onerror=null;this.src='posters/welcome_clean.jpg'" />
        ${isDefaultPoster ? buildPosterOverlay(mk, ev) : ""}
        <div class="fest-overlay" id="festOverlay"></div>
      </div>
      <div class="poster-card-actions">
        <button class="pca-btn primary" type="button" onclick="openEditorDrawer('event', ${i})">✎ Edit Details</button>
        <button class="pca-btn" type="button" onclick="triggerPhotoUpload('event', ${i})">📷 Replace Photo</button>
        <button class="pca-btn" type="button" onclick="openAIPromptModal('${mk}')">✨ AI Prompt Generator</button>
      </div>
    </div>`;

  $("#festChip").hidden = true;
  $("#festModal").hidden = false;
  document.body.style.overflow = "hidden";

  const mountNow = () => MOUNT[mk]($("#festOverlay"), m, revealFest);
  const art = paper.querySelector(".fp-art");
  if (art && !art.complete) {
    art.onload = mountNow;
    art.onerror = mountNow;
  } else mountNow();
}

function revealFest() {
  if (festBusy) return;
  festBusy = true;
  const ov = $("#festOverlay");
  if (ov) { ov.classList.add("gone"); setTimeout(() => ov.remove(), 700); }
  $("#festChip").hidden = false;
  $("#festFootHint").hidden = true;
  $("#festBless").hidden = false;
  petalBurst($("#festPaper"));
}

function closeFest() {
  activeFestIndex = null;
  $("#festModal").hidden = true;
  document.body.style.overflow = "";
}
$("#festClose").addEventListener("click", closeFest);
$("#festCloseBtn").addEventListener("click", closeFest);
$("#festVeil").addEventListener("click", closeFest);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#festModal").hidden) closeFest();
});

/* ---------- gesture 1 · rub off the turmeric ---------- */
function mountRub(ov, m, done) {
  ov.classList.add("ov-rub");
  const c = document.createElement("canvas");
  ov.appendChild(c);
  const hint = document.createElement("span");
  hint.className = "ov-hint"; hint.textContent = m.hint;
  ov.appendChild(hint);

  const rect = ov.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.max(1, Math.round(rect.width * dpr));
  c.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#F4B400");
  grad.addColorStop(1, "#D99A00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,220,120,${Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "destination-out";

  let drawing = false, moves = 0, finished = false;
  const rubAt = (x, y) => {
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  };
  const pos = e => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const check = () => {
    if (finished) return;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    let clear = 0;
    const stride = 4 * 40;
    for (let i = 3; i < img.data.length; i += stride) if (img.data[i] < 50) clear++;
    const p = clear / (img.data.length / stride);
    if (p > 0.05) ov.classList.add("rubbed");
    if (p > 0.45) { finished = true; done(); }
  };
  c.addEventListener("pointerdown", e => {
    drawing = true;
    c.setPointerCapture(e.pointerId);
    const p = pos(e); rubAt(p.x, p.y);
  });
  c.addEventListener("pointermove", e => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e); rubAt(p.x, p.y);
    if (++moves % 4 === 0) check();
  });
  const end = () => { drawing = false; check(); };
  c.addEventListener("pointerup", end);
  c.addEventListener("pointercancel", end);
}

/* ---------- gesture 2 · trace the heart with henna ---------- */
function mountTrace(ov, m, done) {
  ov.classList.add("ov-trace");
  const SIZE = 240, SCALE = 6, CX = SIZE / 2, CY = SIZE / 2;
  const pts = [];
  const N = 80;
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2;
    pts.push({
      x: CX + 16 * Math.pow(Math.sin(t), 3) * SCALE,
      y: CY - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * SCALE
    });
  }
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  const covered = new Array(N).fill(false);
  const lines = [], dots = [];
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    const ln = document.createElementNS(NS, "line");
    ln.setAttribute("x1", a.x); ln.setAttribute("y1", a.y);
    ln.setAttribute("x2", b.x); ln.setAttribute("y2", b.y);
    ln.setAttribute("stroke", "#C1876B"); ln.setAttribute("stroke-width", "1.5");
    ln.setAttribute("stroke-dasharray", "3 3"); ln.setAttribute("stroke-linecap", "round");
    svg.appendChild(ln); lines.push(ln);
  }
  for (let i = 0; i < N; i++) {
    const d = document.createElementNS(NS, "circle");
    d.setAttribute("cx", pts[i].x); d.setAttribute("cy", pts[i].y);
    d.setAttribute("r", "1.5"); d.setAttribute("fill", "#C1876B");
    svg.appendChild(d); dots.push(d);
  }
  ov.appendChild(svg);
  const hint = document.createElement("span");
  hint.className = "ov-hint"; hint.textContent = m.hint;
  ov.appendChild(hint);

  let tracing = false, finished = false;
  const mark = e => {
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * SIZE;
    const my = (e.clientY - r.top) / r.height * SIZE;
    let doneCount = 0;
    for (let i = 0; i < N; i++) {
      if (!covered[i] && Math.hypot(pts[i].x - mx, pts[i].y - my) < 14) {
        covered[i] = true;
        lines[i].setAttribute("stroke", "#6B2B1A");
        lines[i].setAttribute("stroke-width", "4");
        lines[i].removeAttribute("stroke-dasharray");
        dots[i].setAttribute("fill", "#6B2B1A");
        dots[i].setAttribute("r", "2.5");
      }
      if (covered[i]) doneCount++;
    }
    if (!finished && doneCount / N > 0.75) { finished = true; done(); }
  };
  svg.addEventListener("pointerdown", e => {
    tracing = true;
    svg.setPointerCapture(e.pointerId);
    mark(e);
  });
  svg.addEventListener("pointermove", e => {
    if (!tracing) return;
    e.preventDefault();
    mark(e);
  });
  const end = () => { tracing = false; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
}

/* ---------- gesture 3 · tap the dhol to the beat ---------- */
function mountTap(ov, m, done) {
  ov.classList.add("ov-tap");
  const NEED = 6;
  ov.innerHTML = `
    <button class="dhol-btn" type="button" aria-label="Tap the dhol">
      <svg width="170" height="150" viewBox="0 0 200 180" aria-hidden="true">
        <defs>
          <linearGradient id="dholBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#A15B2A"/><stop offset="50%" stop-color="#6F3A15"/><stop offset="100%" stop-color="#4A2408"/>
          </linearGradient>
          <radialGradient id="dholHead" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stop-color="#FDF1C8"/><stop offset="100%" stop-color="#C8A24A"/>
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="100" rx="80" ry="55" fill="url(#dholBody)"/>
        <ellipse cx="100" cy="70" rx="80" ry="22" fill="url(#dholHead)"/>
        <ellipse cx="100" cy="70" rx="80" ry="22" fill="none" stroke="#5A2C0E" stroke-width="3"/>
        <path d="M30 82 v40 M45 88 v46 M60 91 v50 M75 92 v52 M100 93 v53 M125 92 v52 M140 91 v50 M155 88 v46 M170 82 v40"
          stroke="#E8D68A" stroke-width="1.4" opacity=".75"/>
        <path d="M128 34 L152 58 M72 34 L48 58" stroke="#F2CC6B" stroke-width="4" stroke-linecap="round"/>
        <circle cx="128" cy="32" r="5" fill="#F2CC6B"/><circle cx="72" cy="32" r="5" fill="#F2CC6B"/>
      </svg>
    </button>
    <div class="beat-dots" aria-hidden="true">${"<i></i>".repeat(NEED)}</div>
    <span class="ov-hint">${m.hint}</span>`;
  const btn = $(".dhol-btn", ov);
  const dotEls = $$(".beat-dots i", ov);
  let taps = 0, finished = false;
  btn.addEventListener("click", () => {
    if (finished) return;
    thump();
    btn.classList.add("hit");
    setTimeout(() => btn.classList.remove("hit"), 150);
    if (taps < NEED) dotEls[taps].classList.add("on");
    taps++;
    if (taps >= NEED) { finished = true; setTimeout(done, 280); }
  });
}

/* ---------- gesture 4 · light the diya ---------- */
function mountLight(ov, m, done) {
  ov.classList.add("ov-light");
  ov.innerHTML = `
    <button class="diya-btn" type="button" aria-label="Light the diya">
      <svg width="180" height="170" viewBox="0 0 200 190" aria-hidden="true">
        <defs>
          <radialGradient id="flameGrad" cx="0.5" cy="0.7" r="0.5">
            <stop offset="0%" stop-color="#FFF7A0"/><stop offset="40%" stop-color="#FFB100"/><stop offset="100%" stop-color="#C73030" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="diyaBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#C8873A"/><stop offset="100%" stop-color="#6B3410"/>
          </linearGradient>
        </defs>
        <circle class="diya-glow" cx="100" cy="96" r="74" fill="url(#flameGrad)"/>
        <g class="diya-flame">
          <path d="M100 46 C86 74 88 96 100 104 C112 96 114 74 100 46 Z" fill="#FFB100"/>
          <path d="M100 62 C93 78 94 92 100 97 C106 92 107 78 100 62 Z" fill="#FFF7A0"/>
        </g>
        <rect x="96" y="100" width="8" height="16" rx="4" fill="#3C1D08"/>
        <path d="M28 118 Q100 162 172 118 L160 146 Q100 178 40 146 Z" fill="url(#diyaBody)"/>
        <ellipse cx="100" cy="118" rx="72" ry="13" fill="#8A4D1C"/>
        <ellipse cx="100" cy="116" rx="60" ry="9" fill="#5C3210"/>
      </svg>
    </button>
    <span class="ov-hint">${m.hint}</span>`;
  let lit = false;
  $(".diya-btn", ov).addEventListener("click", () => {
    if (lit) return;
    lit = true;
    ov.classList.add("lit");
    setTimeout(done, 950);
  });
}

const MOUNT = { rub: mountRub, trace: mountTrace, tap: mountTap, light: mountLight };

/* ============================================================
   SOUND — synthesized, no audio files
   ============================================================ */
let AC = null;
function ac() {
  AC = AC || new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function thump() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.22);
  } catch (e) {}
}
function bellRing() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    [[784, 0.26], [1046.5, 0.16], [1568, 0.1], [2093, 0.06]].forEach(([f, v], i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f * (1 + i * 0.0015);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 2.5);
    });
  } catch (e) {}
}

/* ============================================================
   AI STUDIO — Backend-configured studio AI key
   Configured centrally by the studio backend so customers can use
   AI copy generation without needing technical API keys.
   ============================================================ */
const OR_KEY = "dd_or_key", OR_MODEL = "dd_or_model";
const OR_DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

/* Backend Studio API key configuration */
window.STUDIO_AI_KEY = window.STUDIO_AI_KEY || "";

async function aiChat(system, user) {
  const key = (window.STUDIO_AI_KEY || localStorage.getItem(OR_KEY) || "").trim();
  if (!key) { const e = new Error("no-key"); e.code = "no-key"; throw e; }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({
      model: (localStorage.getItem(OR_MODEL) || OR_DEFAULT_MODEL).trim(),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 500
    })
  });
  if (!res.ok) throw new Error("api-" + res.status);
  const j = await res.json();
  const out = j.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("empty");
  return out;
}

/* read the live form value if the panel is open, else saved data */
function formVal(key) {
  const el = $(`#f_${key}`);
  return ((el ? el.value : DATA[key]) || "").trim();
}

function photoPromptTemplate(mood) {
  const b = formVal("bride") || "the bride", g = formVal("groom") || "the groom";
  const venue = formVal("venueName") || "a grand kalyana mandapam";
  return `Traditional South Indian wedding painting of a couple, ${b} and ${g}, ` +
    `in the style of a classic hand-painted wedding invitation board. ` +
    `Bride in a deep maroon kanjivaram silk saree with gold zari border and temple jewellery; ` +
    `groom in an ivory silk veshti with angavastram. Setting: ${venue}, glowing brass diyas, ` +
    `marigold garlands, soft golden light. Mood: ${mood || "regal, warm, joyful"}. ` +
    `Style: realistic oil painting on textured ivory canvas, NOT a photograph, ` +
    `warm saturated colours, hand-painted quality, classic Indian wedding art, 4:5 portrait.`;
}

/* ============================================================
   POSTER PROMPTS — generate ceremony art in ANY AI tool, with
   the couple's exact names/dates written into the artwork and
   their own faces (by attaching a photo). Free, tool-agnostic.
   ============================================================ */
const POSTER_STYLE =
  "vertical 2:3 South Indian Hindu wedding invitation poster, " +
  "traditional hand-painted illustration style on aged ivory parchment texture (NOT hyper-realistic, NOT photographic), " +
  "ornate gold filigree border, marigold and mango-leaf toran garland with hanging brass bells " +
  "and a golden kalash with coconut at the top centre, banana leaves framing the sides, brass " +
  "oil lamps, flowers, coconut and bananas at the bottom, warm golden temple light, " +
  "classic Indian wedding painting board aesthetic, rich maroon and gold palette, elegant script typography";

const MODE_SCENE = {
  rub:   "the couple joyfully seated for the Haldi — brass bowls of turmeric, yellow flowers, haldi on their cheeks",
  trace: "both families exchanging thamboolams around a brass tray of fruits and flowers — the Nichayathartham engagement",
  tap:   "the couple dancing while musicians play dhol, veena and nadaswaram — a festive evening of music",
  light: "the groom tying the sacred Mangalyam around the bride's neck in a grand mandapam, elders blessing them"
};

function ceremonyPosterPrompt(ev, i) {
  const mk = modeFor(ev, i);
  return `Design a ${POSTER_STYLE}. Scene: ${MODE_SCENE[mk]}. ` +
    `Render this EXACT text on the poster, spelled precisely: ` +
    `title "${ev.name}"${ev.note ? `, subtitle "${ev.note}"` : ""}, ` +
    `details "${ev.when}" and "${ev.where}"${ev.dress ? ` and "Dress code: ${ev.dress}"` : ""}, ` +
    `and the couple's names "${DATA.bride} & ${DATA.groom}". ` +
    `(If your AI tool accepts photos, attach a clear photo of the couple and add: ` +
    `"use the attached photo for the couple's faces — keep our exact likeness".)`;
}

function welcomePosterPrompt() {
  return `Design a ${POSTER_STYLE}. Scene: the couple standing together under a floral arch — ` +
    `bride in a red kanjivaram silk saree with gold jewellery and jasmine in her hair, ` +
    `groom in an ivory silk veshti with a gold-bordered angavastram. ` +
    `Render this EXACT text, spelled precisely: "Together with love & families, request the honour of your presence", ` +
    `bride "${DATA.bride}", daughter of ${DATA.brideParents}; groom "${DATA.groom}", son of ${DATA.groomParents}; ` +
    `"${fmtLong(DATA.date)} · ${fmtTime(DATA.time)}" and "Venue: ${DATA.venueName}, ${DATA.brideCity}". ` +
    `Finish with "You are warmly invited" at the bottom. ` +
    `(If your AI tool accepts photos, attach a clear photo of the couple and add: ` +
    `"use the attached photo for our faces — keep our exact likeness".)`;
}

function deliverPrompt(text, msgEl) {
  const out = $("#imgPromptOut");
  if (out) out.value = text;
  let copied = false;
  try { navigator.clipboard?.writeText(text); copied = true; } catch (e) {}
  if (msgEl) msgEl.textContent = copied
    ? "Prompt copied! Paste it into ChatGPT, Gemini or Canva — then upload the image it makes."
    : "Prompt ready in the AI Studio box below — copy it into ChatGPT, Gemini or Canva.";
}

/* ============================================================
   MARIGOLD PETALS — ambient drift + celebration bursts
   ============================================================ */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function spawnAmbientPetals() {
  if (REDUCED) return;
  const layer = $("#petalLayer");
  if (!layer) return;
  const count = window.innerWidth < 560 ? 7 : 10;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "petal";
    p.style.setProperty("--l", `${Math.random() * 100}%`);
    p.style.setProperty("--s", `${9 + Math.random() * 6}px`);
    p.style.setProperty("--d", `${16 + Math.random() * 10}s`);
    p.style.setProperty("--del", `${-Math.random() * 24}s`);
    p.style.setProperty("--sway", `${(Math.random() * 220 - 110).toFixed(0)}px`);
    p.style.setProperty("--spin", `${(360 + Math.random() * 380).toFixed(0)}deg`);
    p.style.setProperty("--o", (0.3 + Math.random() * 0.25).toFixed(2));
    layer.appendChild(p);
  }
}

const PETAL_COLORS = ["#FFB100", "#FF8A2E", "#F4B400", "#E86C1F"];
function petalBurst(host) {
  if (!host) return;
  for (let k = 0; k < 18; k++) {
    const p = document.createElement("span");
    p.className = "petal-burst";
    const s = 8 + Math.random() * 7;
    p.style.width = `${s}px`;
    p.style.height = `${s * 1.3}px`;
    p.style.background = PETAL_COLORS[k % PETAL_COLORS.length];
    host.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 150;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + 70;
    p.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${(Math.random() * 720 - 360).toFixed(0)}deg)`, opacity: 0 }
      ],
      { duration: 900 + Math.random() * 600, easing: "cubic-bezier(.16,.84,.44,1)" }
    ).onfinish = () => p.remove();
  }
}

/* ============================================================
   PICK YOUR SIDE — Team Bride vs Team Groom, rides with the RSVP
   ============================================================ */
let SIDE = "";
function updateRsvp() {
  const cheer = SIDE === "bride" ? ` We're cheering for Team ${DATA.bride}! 🌸`
              : SIDE === "groom" ? ` We're cheering for Team ${DATA.groom}! 🥁` : "";
  const rsvpMsg = `Namaste! We would love to attend the wedding of ${DATA.bride} & ${DATA.groom}. Count us in!${cheer}`;
  $("#rsvpBtn").href = `https://wa.me/${DATA.phone || STUDIO_WA}?text=${encodeURIComponent(rsvpMsg)}`;
}
(() => {
  $$("#sidePick .side-btn").forEach(b => b.addEventListener("click", () => {
    SIDE = SIDE === b.dataset.side ? "" : b.dataset.side;
    $$("#sidePick .side-btn").forEach(x => x.classList.toggle("on", x.dataset.side === SIDE));
    updateRsvp();
  }));
})();

/* ============================================================
   TEMPLE BELL
   ============================================================ */
(() => {
  const bell = $("#templeBell");
  if (!bell) return;
  bell.addEventListener("click", () => {
    bellRing();
    bell.classList.remove("ringing");
    void bell.offsetWidth; /* restart the swing */
    bell.classList.add("ringing");
  });
  bell.addEventListener("animationend", () => bell.classList.remove("ringing"));
})();

/* ============================================================
   ADD TO CALENDAR (.ics — works offline, no service needed)
   ============================================================ */
(() => {
  const btn = $("#icsBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const w = weddingMoment();
    if (isNaN(w)) return;
    const end = new Date(w.getTime() + 3 * 36e5);
    const fmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const escI = s => ("" + s).replace(/([,;\\])/g, "\\$1");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DeepDreams//Wedding//EN",
      "BEGIN:VEVENT",
      `UID:${Date.now()}@deepdreams`,
      `SUMMARY:${escI(`Wedding of ${DATA.bride} & ${DATA.groom}`)}`,
      `DTSTART:${fmt(w)}`, `DTEND:${fmt(end)}`,
      `LOCATION:${escI(`${DATA.venueName}, ${DATA.venueAddr}`)}`,
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Wedding-${DATA.bride}-${DATA.groom}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  });
})();

/* ---------- countdown ---------- */
function tickCountdown() {
  const w = weddingMoment();
  const cd = $("#countdown");
  if (isNaN(w)) { cd.style.display = "none"; return; }
  let ms = w.getTime() - Date.now();
  if (ms <= 0) {
    cd.innerHTML = `<p style="font-family:var(--serif);font-style:italic;font-size:21px;color:var(--gold-bright)">The auspicious day is here — see you at the mandapam!</p>`;
    return;
  }
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const h = Math.floor(ms / 36e5);  ms -= h * 36e5;
  const m = Math.floor(ms / 6e4);   ms -= m * 6e4;
  $("#cdD").textContent = d; $("#cdH").textContent = h;
  $("#cdM").textContent = m; $("#cdS").textContent = Math.floor(ms / 1e3);
  setTimeout(tickCountdown, 1000);
}

/* ---------- reveals ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: .18 });
$$(".reveal").forEach(el => io.observe(el));

/* ============================================================
   EDITOR
   ============================================================ */
const FIELDS = [
  ["The Couple"],
  ["bride", "Bride's name", "input"],
  ["groom", "Groom's name", "input"],
  ["The Families"],
  ["brideParents", "Bride's parents", "input"],
  ["brideCity", "Bride's family city", "input"],
  ["groomParents", "Groom's parents", "input"],
  ["groomCity", "Groom's family city", "input"],
  ["The Muhurtham"],
  ["date", "Wedding date", "date"],
  ["time", "Muhurtham time", "time"],
  ["The Venue"],
  ["venueName", "Venue name", "input"],
  ["venueAddr", "Venue address", "input"],
  ["mapUrl", "Venue location — paste a Google Maps link, or just type the place name", "input"],
  ["Your Story & RSVP"],
  ["story", "Your story (a few lines)", "textarea"],
  ["phone", "WhatsApp number for RSVPs (with country code, e.g. 91XXXXXXXXXX)", "input"]
];

function buildForm() {
  const body = $("#panelBody");
  let html = "";
  FIELDS.forEach(f => {
    if (f.length === 1) { html += `<h3 class="fsection">${f[0]}</h3>`; return; }
    const [key, label, type] = f;
    const v = esc(DATA[key]);
    html += `<div class="fgroup"><label for="f_${key}">${label}</label>`;
    if (type === "textarea") {
      html += `<textarea id="f_${key}">${v}</textarea>`;
      if (key === "story")
        html += `<button class="ai-btn" id="aiStory" type="button">✨ Write it with AI</button>
                 <p class="fhint ai-msg" id="aiStoryMsg"></p>`;
    }
    else html += `<input id="f_${key}" type="${type === "input" ? "text" : type}" value="${v}" />`;
    html += `</div>`;
  });
  html += `<h3 class="fsection">Welcome poster</h3>
           <p class="fhint" style="margin:-8px 0 10px">The grand couple artwork guests see the moment the doors part — with your names, parents and date painted into it. Upload one, or get an AI prompt to create it with your own faces in any AI tool.</p>
           <div class="poster-row">
             <button class="ai-btn tiny" id="welcomeUp" type="button">${DATA.welcomeImg ? "Replace image" : "⬆ Upload image"}</button>
             <button class="ai-btn tiny ghost" id="welcomePromptBtn" type="button">🎨 Get AI prompt</button>
             ${DATA.welcomeImg ? `<button class="ai-btn tiny ghost" id="welcomeDel" type="button">✕ Remove</button>` : ""}
           </div>
           <p class="fhint" id="welcomeMsg" style="margin-top:6px"></p>
           <h3 class="fsection">Celebrations</h3>
           <p class="fhint" style="margin:-8px 0 14px">Guests open each celebration with a little ritual — rub the turmeric, trace the heart, tap the dhol, or light the diya. Each one can carry its own poster too.</p>
           <div id="evEditors"></div>
           <button class="add-event" id="addEvent" type="button">＋ Add a celebration</button>
           <p class="fhint" style="margin-top:18px">Tap any photo frame on the page — or the ✎ button on the golden cover — to add your own photo there.</p>
           <h3 class="fsection">Couple-photo prompt</h3>
           <p class="fhint" style="margin:-8px 0 14px">Generate a professional prompt for Canva or Midjourney to create your couple portrait, then tap any photo frame to place it.</p>
           <div class="fgroup"><label for="imgMood">Mood (optional)</label>
             <input id="imgMood" placeholder="royal kanjivaram, temple at dusk, golden hour…" /></div>
           <button class="ai-btn" id="aiImg" type="button">🎨 Craft the photo prompt</button>
           <p class="fhint ai-msg" id="aiImgMsg"></p>
           <textarea id="imgPromptOut" class="ai-out" readonly placeholder="Your professional prompt will appear here…"></textarea>
           <button class="ai-btn ghost" id="copyPrompt" type="button">Copy prompt</button>`;
  body.innerHTML = html;
  renderEventEditors();
  $("#addEvent").addEventListener("click", () => {
    DATA.events.push({ name: "New celebration", when: "", where: "", note: "", mode: "", dress: "" });
    renderEventEditors();
  });

  /* --- welcome poster wiring --- */
  $("#welcomeUp").addEventListener("click", () => { photoSlot = 999; $("#photoInput").click(); });
  $("#welcomePromptBtn").addEventListener("click", () => {
    harvestForm();
    deliverPrompt(welcomePosterPrompt(), $("#welcomeMsg"));
  });
  $("#welcomeDel")?.addEventListener("click", () => {
    DATA.welcomeImg = null;
    save(); render(); buildForm();
  });

  /* --- AI wiring --- */
  $("#aiStory").addEventListener("click", async () => {
    const btn = $("#aiStory"), msg = $("#aiStoryMsg");
    btn.disabled = true; btn.textContent = "Writing…"; msg.textContent = "";
    try {
      const story = await aiChat(
        "You write warm, elegant copy for South Indian Hindu wedding websites. Reply with ONLY the story text — 60 to 90 words, no quotes, no headings.",
        `Write "our story" for the wedding website of ${formVal("bride")} of ${formVal("brideCity")} and ${formVal("groom")} of ${formVal("groomCity")}. ` +
        `They marry at ${formVal("venueName")} on ${fmtLong(formVal("date"))}. Tone: heartfelt, slightly poetic, blessed by both families.` +
        (formVal("story") ? ` For inspiration, their current draft: "${formVal("story")}"` : "")
      );
      $("#f_story").value = story;
      msg.textContent = "Done — edit any line you like, then Save & preview.";
    } catch (err) {
      msg.textContent = err.code === "no-key"
        ? "Add your free OpenRouter key in the AI Studio section below first."
        : "The AI couldn't reply — check your key and model, then try again.";
    }
    btn.disabled = false; btn.textContent = "✨ Write it with AI";
  });

  $("#aiImg").addEventListener("click", async () => {
    const btn = $("#aiImg"), msg = $("#aiImgMsg"), out = $("#imgPromptOut");
    const mood = $("#imgMood").value.trim();
    out.value = photoPromptTemplate(mood);
    msg.textContent = "Crafted. Paste it into Canva (or any AI image tool).";
    if ((localStorage.getItem(OR_KEY) || "").trim()) {
      btn.disabled = true; btn.textContent = "Polishing…";
      try {
        out.value = await aiChat(
          "You are a world-class prompt engineer for AI image tools such as Canva Magic Media and Midjourney. Reply with ONLY the final image prompt, under 120 words.",
          `Refine this wedding-portrait prompt. Keep the South Indian attire and setting, sharpen the art direction:\n\n${out.value}\n\nExtra mood notes: ${mood || "none"}`
        );
        msg.textContent = "AI-polished. Paste it into Canva (or any AI image tool).";
      } catch (e) { /* the locally crafted prompt is already in place */ }
      btn.disabled = false; btn.textContent = "🎨 Craft the photo prompt";
    }
  });

  $("#copyPrompt").addEventListener("click", () => {
    const out = $("#imgPromptOut");
    if (!out.value) out.value = photoPromptTemplate($("#imgMood").value.trim());
    navigator.clipboard?.writeText(out.value);
    $("#copyPrompt").textContent = "Copied ✓";
    setTimeout(() => $("#copyPrompt").textContent = "Copy prompt", 1500);
  });
}

function renderEventEditors() {
  const wrap = $("#evEditors");
  const modeOpt = (ev, val, label) =>
    `<option value="${val}"${(ev.mode || "") === val ? " selected" : ""}>${label}</option>`;
  wrap.innerHTML = DATA.events.map((ev, i) => `
    <div class="event-editor" data-ev="${i}">
      <button class="ev-del" type="button" data-del="${i}">remove</button>
      <div class="fgroup" style="margin:0"><label>Celebration name</label>
        <input data-evf="name" value="${esc(ev.name)}" /></div>
      <div class="frow">
        <div class="fgroup" style="margin:0"><label>When</label><input data-evf="when" value="${esc(ev.when)}" /></div>
        <div class="fgroup" style="margin:0"><label>Where</label><input data-evf="where" value="${esc(ev.where)}" /></div>
      </div>
      <div class="fgroup" style="margin:10px 0 0"><label>A line about it (optional)</label>
        <input data-evf="note" value="${esc(ev.note || "")}" /></div>
      <div class="frow" style="margin-top:10px">
        <div class="fgroup" style="margin:0"><label>Guests open it by</label>
          <select data-evf="mode">
            ${modeOpt(ev, "", "Auto (by ritual name)")}
            ${modeOpt(ev, "rub", "Rubbing off the turmeric")}
            ${modeOpt(ev, "trace", "Tracing the henna heart")}
            ${modeOpt(ev, "tap", "Tapping the dhol")}
            ${modeOpt(ev, "light", "Lighting the diya")}
          </select></div>
        <div class="fgroup" style="margin:0"><label>Dress code (optional)</label>
          <input data-evf="dress" value="${esc(ev.dress || "")}" /></div>
      </div>
      <div class="fgroup" style="margin:12px 0 0"><label>Ceremony poster (optional)</label>
        <div class="poster-row">
          <button class="ai-btn tiny" type="button" data-postup="${i}">${ev.img ? "Replace image" : "⬆ Upload image"}</button>
          <button class="ai-btn tiny ghost" type="button" data-postprompt="${i}">🎨 Get AI prompt</button>
          ${ev.img ? `<button class="ai-btn tiny ghost" type="button" data-postdel="${i}">✕ Remove</button>` : ""}
        </div>
        <p class="fhint" data-postmsg="${i}" style="margin-top:6px">${ev.img
          ? "Poster added — guests uncover it with the ritual gesture."
          : "No poster? The classic written card (always up to date with your names) is shown instead."}</p>
      </div>
    </div>`).join("");
  $$(".ev-del", wrap).forEach(b => b.addEventListener("click", () => {
    DATA.events.splice(+b.dataset.del, 1);
    renderEventEditors();
  }));
  $$("[data-postup]", wrap).forEach(b => b.addEventListener("click", () => {
    photoSlot = 100 + (+b.dataset.postup);
    $("#photoInput").click();
  }));
  $$("[data-postdel]", wrap).forEach(b => b.addEventListener("click", () => {
    const ev = DATA.events[+b.dataset.postdel];
    if (ev) ev.img = null;
    save(); render(); renderEventEditors();
  }));
  $$("[data-postprompt]", wrap).forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.postprompt;
    harvestForm(); /* use the freshest typed names & dates in the prompt */
    deliverPrompt(ceremonyPosterPrompt(DATA.events[i], i), $(`[data-postmsg="${i}"]`));
  }));
}

function harvestForm() {
  FIELDS.forEach(f => {
    if (f.length === 1) return;
    const el = $(`#f_${f[0]}`);
    if (el) DATA[f[0]] = el.value.trim();
  });
  $$("#evEditors .event-editor").forEach((box, i) => {
    if (!DATA.events[i]) return;
    $$("[data-evf]", box).forEach(inp => { DATA.events[i][inp.dataset.evf] = inp.value.trim(); });
  });
  DATA.events = DATA.events.filter(ev => ev.name);
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DATA)); } catch (e) {
    /* photos can overflow localStorage — save everything but photos */
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...DATA, photos: [] })); } catch (e2) {}
  }
}

/* ---------- photos: pick → compress in-browser → slot ---------- */
let photoSlot = 0;
function compressImage(file, maxSide, quality) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(file);
  });
}

if (EDITING) {
  $$(".gal-item").forEach(fig => fig.addEventListener("click", () => {
    photoSlot = +fig.dataset.photo;
    $("#photoInput").click();
  }));
  /* photoSlot -1 = cover seal · 999 = welcome poster · 100+i = ceremony poster i */
  $("#photoInput").addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const maxSide = photoSlot === -1 ? 700 : photoSlot >= 100 ? 900 : 1100;
    const url = await compressImage(file, maxSide, .78);
    if (url) {
      if (photoSlot === -1) DATA.cover = url;
      else if (photoSlot === 999) DATA.welcomeImg = url;
      else if (photoSlot >= 100) {
        const ev = DATA.events[photoSlot - 100];
        if (ev) ev.img = url;
        if (!$("#editorPanel").hidden) renderEventEditors();
      }
      else DATA.photos[photoSlot] = url;
      save(); render();
    }
  });
}

/* ---------- share: everything travels inside the link ---------- */
async function buildShareLink() {
  const base = location.origin + location.pathname;
  /* photos re-compressed small for travel; drop from the end until the link fits */
  /* uploaded art (data:) is shrunk to travel inside the link;
     posters that live as site files (posters/…) pass through as tiny paths */
  const packImg = async (src, side, q) =>
    !src ? null : src.startsWith("data:") ? await shrinkDataUrl(src, side, q) : src;
  const travel = { ...DATA };
  travel.cover = await packImg(DATA.cover, 240, .5);
  travel.welcomeImg = await packImg(DATA.welcomeImg, 340, .45);
  travel.events = [];
  for (const ev of DATA.events)
    travel.events.push(ev.img ? { ...ev, img: await packImg(ev.img, 340, .45) } : { ...ev });
  const smalls = [];
  for (const p of DATA.photos) {
    if (!p) { smalls.push(null); continue; }
    smalls.push(await shrinkDataUrl(p, 320, .5));
  }
  let n = smalls.filter(Boolean).length;
  while (n >= 0) {
    travel.photos = smalls.map((p, i) =>
      p && smalls.slice(0, i + 1).filter(Boolean).length <= n ? p : null);
    let link = base + "#d=" + encode(travel);
    if (link.length < 28000 || n === 0) {
      /* still too heavy? shed ceremony posters from the end, then the welcome poster */
      if (link.length >= 28000) {
        for (let k = travel.events.length - 1; k >= 0 && link.length >= 28000; k--) {
          if (travel.events[k].img) {
            travel.events[k] = { ...travel.events[k], img: null };
            link = base + "#d=" + encode(travel);
          }
        }
        if (link.length >= 28000 && travel.welcomeImg) {
          travel.welcomeImg = null;
          link = base + "#d=" + encode(travel);
        }
      }
      return { link, photosIn: n, photosTotal: smalls.filter(Boolean).length };
    }
    n--;
  }
}
function shrinkDataUrl(dataUrl, maxSide, q) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const sc = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => res(null);
    img.src = dataUrl;
  });
}

/* ---------- editor chrome ---------- */
const panel = $("#editorPanel"), veil = $("#panelVeil");
const openPanel = () => { buildForm(); if (panel) panel.hidden = false; if (veil) veil.hidden = false; };
const closePanel = () => { if (panel) panel.hidden = true; if (veil) veil.hidden = true; };

if ($("#dockEdit")) $("#dockEdit").addEventListener("click", openPanel);
if ($("#panelClose")) $("#panelClose").addEventListener("click", closePanel);
if (veil) veil.addEventListener("click", closePanel);

if ($("#panelApply")) {
  $("#panelApply").addEventListener("click", () => {
    harvestForm();
    save();
    render();
    tickCountdown();
    closePanel();
    if (activeFestIndex !== null && $("#festModal") && !$("#festModal").hidden) {
      openFest(activeFestIndex);
    }
  });
}

const sheet = $("#shareSheet"), sVeil = $("#shareVeil");
if ($("#dockShare")) {
  $("#dockShare").addEventListener("click", async () => {
    harvestFormIfOpen();
    save();
    const { link, photosIn, photosTotal } = await buildShareLink();
    if ($("#shareLink")) $("#shareLink").value = link;
    const note = $("#shareNote");
    if (note) {
      if (photosTotal === 0)
        note.textContent = "Your link carries every detail. Add photos from the page to include them too. It retires by itself the day after your wedding.";
      else if (photosIn === photosTotal)
        note.textContent = `Your link carries every detail and all ${photosTotal} photos inside it — nothing stored anywhere. It retires by itself the day after your wedding.`;
      else
        note.textContent = `Your link carries every detail and ${photosIn} of your ${photosTotal} photos (links have a size limit). For all photos in full quality, order the full website below.`;
    }
    const waText = `🌺 With the blessings of our families —\nYou are lovingly invited to the wedding of ${DATA.bride} & ${DATA.groom}!\nOpen our invitation: ${link}`;
    if ($("#shareWa")) $("#shareWa").href = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    if (sheet) sheet.hidden = false;
    if (sVeil) sVeil.hidden = false;
  });
}

const closeShare = () => { if (sheet) sheet.hidden = true; if (sVeil) sVeil.hidden = true; };
if ($("#shareClose")) $("#shareClose").addEventListener("click", closeShare);
if (sVeil) sVeil.addEventListener("click", closeShare);

if ($("#copyLink")) {
  $("#copyLink").addEventListener("click", () => {
    navigator.clipboard?.writeText($("#shareLink") ? $("#shareLink").value : "");
    $("#copyLink").textContent = "Copied ✓";
    setTimeout(() => $("#copyLink").textContent = "Copy", 1500);
  });
}

const orderMsg = `Hi DeepDreams! I built my wedding invitation preview and I'd like the full website (own link, all photos, RSVP tracking). My preview: `;
if ($("#orderFull")) {
  $("#orderFull").addEventListener("click", async () => {
    const { link } = await buildShareLink();
    open(`https://wa.me/${STUDIO_WA}?text=${encodeURIComponent(orderMsg + link)}`, "_blank", "noopener");
  });
}

function harvestFormIfOpen() { if (panel && !panel.hidden) harvestForm(); }

if (EDITING) {
  if ($("#dock")) $("#dock").hidden = false;
} else if (DEMO) {
  /* only the live demo invites prospects to start their own */
  const chip = document.createElement("a");
  chip.className = "demo-chip";
  chip.href = "?edit";
  chip.innerHTML = `✨ <b>Build your wedding website</b> <span style="opacity:.8;font-weight:400;margin-left:4px">— free</span>`;
  document.body.appendChild(chip);
}
/* guests opening a shared link see the invitation only —
   no edit tools, no "create yours" upsell. They are viewers. */

/* ============================================================
   TAP-TO-OPEN COVER — golden temple doors
   ============================================================ */
function mountCover() {
  const cover = $("#cover");
  if (!cover) return;
  if (!((VIEWING && !expired()) || DEMO || EDITING)) return;
  cover.hidden = false;
  document.body.style.overflow = "hidden";
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    bellRing();
    document.body.classList.add("opened"); /* the hero glides in behind the parting doors */
    if (REDUCED) { cover.hidden = true; document.body.style.overflow = ""; return; }
    cover.classList.add("opening");
    setTimeout(() => { cover.hidden = true; document.body.style.overflow = ""; }, 3000);
  };
  cover.addEventListener("click", e => {
    if (e.target.closest("#sealEdit")) return; /* replacing the photo, not opening */
    open();
  });
  $(".cover-center", cover).addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  if (EDITING) {
    const chip = $("#sealEdit");
    chip.hidden = false;
    chip.addEventListener("click", e => {
      e.stopPropagation();
      photoSlot = -1;
      $("#photoInput").click();
    });
  }
}

/* ---------- demo posters: auto-loaded from wedding/posters/ ----------
   Drop poster images into that folder (welcome.jpg, nichayathartham.jpg,
   haldi.jpg, muhurtham.jpg, reception.jpg) and the live demo shows the
   full poster experience. Missing files fall back to the written cards. */
/* ---------- demo posters: auto-loaded from wedding/posters/ ---------- */
const DEFAULT_POSTERS = {
  trace: "posters/nichayathartham_clean.jpg",
  rub: "posters/haldi_clean.jpg",
  light: "posters/muhurtham_clean.jpg",
  tap: "posters/reception_clean.jpg"
};
DATA.welcomeImg = "posters/welcome_clean.jpg";
DATA.events.forEach((ev, i) => { if (!ev.img || ev.img.endsWith('.jpg.jpeg')) ev.img = DEFAULT_POSTERS[modeFor(ev, i)] || "posters/welcome_clean.jpg"; });

/* Global helpers for poster cards */
window.openEditorDrawer = function(type, idx) {
  const panel = $("#editorPanel"), veil = $("#panelVeil");
  if (panel && veil) {
    buildForm();
    panel.hidden = false;
    veil.hidden = false;
    if (type === 'event' && idx != null) {
      setTimeout(() => {
        const targetEl = $(`[data-ev="${idx}"]`);
        if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }
  }
};

window.triggerPhotoUpload = function(type, idx) {
  if (type === 'welcome') photoSlot = 999;
  else if (type === 'event' && idx != null) photoSlot = 100 + idx;
  else if (type === 'cover') photoSlot = -1;
  const pin = $("#photoInput");
  if (pin) pin.click();
};

/* Photo input listener for all modes */
$("#photoInput")?.addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  const maxSide = photoSlot === -1 ? 700 : photoSlot >= 100 ? 900 : 1100;
  const url = await compressImage(file, maxSide, .78);
  if (url) {
    if (photoSlot === -1) DATA.cover = url;
    else if (photoSlot === 999) DATA.welcomeImg = url;
    else if (photoSlot >= 100) {
      const ev = DATA.events[photoSlot - 100];
      if (ev) ev.img = url;
      if (!$("#editorPanel")?.hidden) renderEventEditors();
    }
    else DATA.photos[photoSlot] = url;
    save(); render();
  }
});

/* Smart AI Prompt Generator Modal Logic */
let activePromptCeremony = "welcome";

window.openAIPromptModal = function(ceremonyKey) {
  activePromptCeremony = ceremonyKey || "welcome";
  const modal = $("#promptModal"), veil = $("#promptVeil");
  if (!modal) return;
  const sel = $("#promptCeremonySelect");
  if (sel) sel.value = activePromptCeremony;
  updateMasterPrompt();
  modal.hidden = false;
  if (veil) veil.hidden = false;
};

function updateMasterPrompt() {
  const ceremony = $("#promptCeremonySelect")?.value || "welcome";
  const styleKey = $("#promptStyleSelect")?.value || "traditional";
  const extra = ($("#promptCustomDetails")?.value || "").trim();

  const styles = {
    traditional: "vertical 2:3 South Indian Hindu wedding poster, royal kanjivaram silk saree and ivory veshti with gold zari, brass oil lamps, fresh marigold and jasmine garlands, mango leaf toran, warm golden lighting",
    chibi: "vertical 2:3 cute animated storybook illustration style, charming South Indian couple with big expressive eyes, bright vibrant colors, marigold garlands, golden kalash, joyful celebration",
    heritage: "vertical 2:3 ancient temple heritage art style, intricate gold filigree border, lotus and kalash motifs, sacred Vedic ceremony aesthetic, rich maroon, crimson and gold palette",
    cinematic: "vertical 2:3 cinematic 85mm portrait photography, soft golden hour bokeh, shallow depth of field, royal South Indian attire, rich saturated natural colors, 8k resolution",
    pastel: "vertical 2:3 modern pastel floral wedding poster, soft blush pink and gold palette, elegant floral archway, delicate script typography, ethereal romantic ambiance"
  };

  const scenes = {
    welcome: `Main Welcome Invitation Poster. Scene: Couple standing together under a floral archway. Text on poster: "Together with love & families, Request the honor of your presence", Bride "${DATA.bride || 'Saanvi'}" (Daughter of ${DATA.brideParents || "Adira & Sai Nadha"}), Groom "${DATA.groom || 'Vihaan'}" (Son of ${DATA.groomParents || "Medha & Ram Reddy"}), Date "${fmtLong(DATA.date) || "Saturday, 11 December 2024"}", Time "${fmtTime(DATA.time) || "6:00 PM onwards"}", Venue "${DATA.venueName || "The Grand Pavilion"}, ${DATA.brideCity || "Hyderabad"}"`,
    trace: `Nichitartam (Engagement) Poster. Scene: Both families exchanging thamboolams around a brass tray of fruits, coconut and betel leaves. Text on poster: "Nichitartam - The formal engagement", Couple "${DATA.bride || 'Saanvi'} & ${DATA.groom || 'Vihaan'}", Date "${fmtLong(DATA.date)}", Time "10:30 AM", Venue "Main Mandapam"`,
    rub: `Haldi Ceremony Poster. Scene: Couple joyfully seated in yellow silk attire for Haldi ceremony with brass bowls of turmeric paste and yellow marigold flowers. Text on poster: "Haldi Ceremony", Family/Couple "${DATA.bride || 'Saanvi'} & ${DATA.groom || 'Vihaan'}", Date "${fmtLong(DATA.date)}", Time "6:00 PM", Venue "Vemuri Vari Palace"`,
    light: `Shubha Muhurtam Poster. Scene: Groom tying the sacred Mangalyam around the bride's neck in a grand mandapam with elders blessing them. Text on poster: "Shubha Muhurtam - The tying of Mangalyam", Couple "${DATA.bride || 'Saanvi'} & ${DATA.groom || 'Vihaan'}", Time "9:42 AM", Date "${fmtLong(DATA.date)}", Venue "Main Mandapam"`,
    tap: `Grand Reception Poster. Scene: Couple entering a grand reception hall with musical instruments (dhol, veena, nadaswaram) playing amidst festive lights. Text on poster: "Grand Reception", Couple "${DATA.bride || 'Saanvi'} & ${DATA.groom || 'Vihaan'}", Time "7:00 PM Onwards", Venue "Main Mandapam"`
  };

  const styleText = styles[styleKey] || styles.traditional;
  const sceneText = scenes[ceremony] || scenes.welcome;
  const extraText = extra ? ` Custom details: ${extra}.` : "";

  const fullPrompt = `Design a ${styleText}. Scene: ${sceneText}.${extraText} ` +
    `CRITICAL INSTRUCTION FOR FACIAL LIKENESS: Use the attached photo for the couple's faces. Keep our exact facial structure, skin tone, smile, and features with 100% likeness while applying the art style. High resolution, 4K quality, master work.`;

  const out = $("#promptOutputArea");
  if (out) out.value = fullPrompt;
}

(() => {
  const modal = $("#promptModal"), veil = $("#promptVeil"), closeBtn = $("#promptClose");
  const cerSel = $("#promptCeremonySelect"), styleSel = $("#promptStyleSelect"), customInp = $("#promptCustomDetails");
  const copyBtn = $("#copyMasterPromptBtn"), uploadBtn = $("#uploadGeneratedArtBtn");

  if (closeBtn) closeBtn.addEventListener("click", () => { if (modal) modal.hidden = true; if (veil) veil.hidden = true; });
  if (veil) veil.addEventListener("click", () => { if (modal) modal.hidden = true; if (veil) veil.hidden = true; });
  if (cerSel) cerSel.addEventListener("change", updateMasterPrompt);
  if (styleSel) styleSel.addEventListener("change", updateMasterPrompt);
  if (customInp) customInp.addEventListener("input", updateMasterPrompt);

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = $("#promptOutputArea")?.value || "";
      navigator.clipboard?.writeText(text);
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => copyBtn.textContent = "📋 Copy Prompt to Clipboard", 1800);
    });
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", () => {
      if (modal) modal.hidden = true;
      if (veil) veil.hidden = true;
      const ceremony = cerSel?.value || "welcome";
      if (ceremony === "welcome") photoSlot = 999;
      else {
        const modeMap = { trace: 0, rub: 1, light: 2, tap: 3 };
        const idx = modeMap[ceremony] != null ? modeMap[ceremony] : 0;
        photoSlot = 100 + idx;
      }
      $("#photoInput")?.click();
    });
  }
})();

/* go */
render();
tickCountdown();
mountCover();
spawnAmbientPetals();
