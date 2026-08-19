/* ============================================================
   DEEPDREAMS — CAROUSEL & VIDEO SECTIONS
   Native scroll-snap carousels (tribute & name reveal), vertical
   invitation videos, wedding site posters, and AI builds.

   Carousels use CSS scroll-snap + native touch scrolling — the same
   pattern Netflix / YouTube / Apple use for horizontal rails. This
   gives free inertia, rubber-banding, and pixel-perfect alignment on
   every device, with arrows & dots layered on top.
   ============================================================ */

(function() {
  'use strict';

  const CFG = window.DD_CONFIG;

  // YouTube helpers
  const ytId = u => {
    if (!u) return "";
    u = ("" + u).trim();
    const m = u.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([\w-]{11})/);
    return m ? m[1] : (u.length === 11 ? u : "");
  };
  const thumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  /* ============================================================
     TITLES & SECTION ROUTING

     Every film's title and section comes from the Google Sheet, and the
     Sheet is written in the wording that works for YouTube search —
     "Late father attending to his son's marriage", "coming from heaven",
     "miracle". That language does two things a portfolio cannot afford:
     it reads as a claim that the footage is real, and it is not the
     register a family or a business partner expects on a studio site.

     Rather than ask the Sheet to be rewritten (it earns its keep as it
     is), the page rewrites titles as it renders them. TITLE_MAP holds
     the exact editorial wording for the films currently in the Sheet;
     tidyTitle() catches anything added later.

     Section routing is here for the same reason. The same film was
     appearing under Tribute Films, Wedding Invitations AND Name Reveals
     because it had been entered in all three tabs. Every row from all
     three tabs is now classified by what it actually is, and each
     section renders only what belongs to it — so a tribute film shows
     once, in Tribute Films, and an invitation film shows under Wedding
     Invitation Videos no matter which tab it was typed into.
     ============================================================ */

  /* Match on a loose key so a stray capital or apostrophe still hits. */
  const titleKey = (s) => String(s || "").toLowerCase()
    .replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  /* The keys are the titles EXACTLY as they are typed in the Sheet today,
     including the typos ("thier", "totheir", "bkess bless", "saree fiction")
     and trailing spaces — titleKey() flattens case, punctuation and spacing,
     but it cannot guess a misspelling. If a title is corrected in the Sheet
     later, its key here has to be corrected too, otherwise tidyTitle() takes
     over and produces a rougher result. */
  const TITLE_MAP = new Map(Object.entries({
    "Late Brother attending to his brother marriage":
      "In Memory of a Brother at His Brother’s Wedding",
    "Ai invitation Video":
      "AI Wedding Invitation Video",
    "Late Father and mother attending to thier daughters marriage":
      "In Memory of Parents at Their Daughter’s Wedding",
    "Late Grandfathers attending totheir granddaughter saree fiction":
      "In Memory of Grandfathers at Their Granddaughter’s Half-Saree Ceremony",
    "Late father attending to his sons marriage":
      "In Memory of a Father at His Son’s Wedding",
    "Late Father attending to his daughters marriage":
      "In Memory of a Father at His Daughter’s Wedding",
    "3 Late family Members blessing thier family":
      "A Family Tribute to Three Loved Ones",
    "Bringing Lost Loved Ones to a Wedding: A 12-Year Tirupati Miracle | Hyper-Realistic AI Concept":
      "A Special Family Tribute at a Tirupati Wedding",
    "Late Father and Mother Attending to his sons Housewarming to bkess bless his family":
      "In Memory of Parents at Their Son’s Housewarming",
    "Late Mother coming from heaven to bless her daughter on her birthday":
      "In Memory of a Mother on Her Daughter’s Birthday",
    "Late father and mother, blessing from heaven.":
      "A Loving Tribute to Parents",
    "Late Sister blessing from heaven":
      "In Memory of a Sister",
    "Late Brother Attending to his Family Function":
      "In Memory of a Brother at a Family Celebration",
    "Custom AI Gruhapravesam Invitation Video":
      "AI Housewarming Invitation Video",
    "Custom AI Gruhapravesam & Panchakattu Invitation Video":
      "AI Housewarming and Panchakattu Invitation Video",
    "Ai Name Revealing video":
      "Baby Name Reveal Video",
  }).map(([k, v]) => [titleKey(k), v]));

  /* For rows added to the Sheet after this map was written. */
  const tidyTitle = (raw) => {
    let t = String(raw || "").trim().replace(/\s+/g, " ");
    if (!t) return "";
    t = t
      .replace(/\bcoming from heaven\b/gi, "")
      .replace(/\bfrom heaven\b/gi, "")
      .replace(/\bback to life\b/gi, "")
      .replace(/\bdeath person\b/gi, "")
      .replace(/\bmiracle\b/gi, "Tribute")
      .replace(/\battending to\b/gi, "at")
      .replace(/\battending\b/gi, "at")
      /* "Late Father at his son's wedding" → "In Memory of a Father …" */
      .replace(/^late\s+(\w+)/i, (_, who) =>
        "In Memory of " + (/^(father|mother|brother|sister|grandfather|grandmother|son|daughter|uncle|aunt)$/i.test(who) ? "a " : "") + who)
      .replace(/\blate\b/gi, "")
      .replace(/\bmarriage\b/gi, "Wedding")
      .replace(/\bsaree function\b/gi, "Half-Saree Ceremony")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.])/g, "$1")
      .trim();
    /* Title Case the small words back down, leave the rest as typed. */
    return t.replace(/\b(A|An|The|Of|At|To|For|And|On|His|Her|Their|In)\b/g,
      (w, _m, i) => (i === 0 ? w : w.toLowerCase()));
  };

  const cleanTitle = (raw, fallback) => {
    const mapped = TITLE_MAP.get(titleKey(raw));
    if (mapped) return mapped;
    const tidied = tidyTitle(raw);
    return tidied || fallback || "";
  };

  /* Which section a film belongs in, decided from the film itself.
     Order matters: a tribute set at a wedding is still a tribute, which is
     why "Bringing Lost Loved Ones to a Wedding … Tirupati Miracle" has to be
     caught here and not fall through to the "wedding" test below. */
  const classify = (title) => {
    const t = titleKey(title);
    if (/\b(late|memory|memorial|tribute|blessing|blessings|heaven|remembrance|passed|miracle|lost loved ones|back to life)\b/.test(t))
      return "tribute";
    if (/\b(name reveal|name revealing|naming|namakaran|baby name|barasala)\b/.test(t))
      return "namereveal";
    if (/\b(invitation|invite|save the date|wedding)\b/.test(t))
      return "invitation";
    return null;   /* undecidable — leave it in the tab it came from */
  };

  const SECTION_LABEL = {
    tribute: "Tribute Film",
    invitation: "Wedding Invitation",
    namereveal: "Name Reveal",
  };

  /* One fetch of all three tabs, one shared routing pass. Each section
     awaits this instead of fetching for itself. */
  const sheetRows = async (tab) => {
    if (!CFG.SHEET_ID || !tab) return [];
    const url = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}` +
      `/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
    const text = await (await fetch(url)).text();
    const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
    if (!m) throw new Error("Invalid response format");
    return JSON.parse(m[1]).table.rows || [];
  };

  let routedPromise = null;
  const routedFilms = () => (routedPromise ||= (async () => {
    const tabs = [
      ["tribute",    CFG.SHEET_TAB       || "Ai Tribute Videos "],
      ["invitation", CFG.INVITATION_TAB  || "Ai Wedding Invitation videos "],
      ["namereveal", CFG.NAME_REVEAL_TAB || "Ai Name Revealing videos"],
    ];
    const buckets = { tribute: [], invitation: [], namereveal: [] };
    const settled = await Promise.allSettled(tabs.map(([, t]) => sheetRows(t)));

    /* Collect every row first, then decide. The same YouTube link is entered in
       more than one tab under different titles — MvD8bCcVWEQ is "Ai invitation
       Video" in the tribute tab and "Ai Name Revealing video" in the name-reveal
       tab. Taking the first row seen meant the accidental entry won and the
       correct one was thrown away as a duplicate, which emptied the Name Reveal
       section completely. So each film is scored instead: a row typed into the
       tab that matches what the title says it is beats one that is not. */
    const byId = new Map();
    settled.forEach((res, i) => {
      const [homeTab] = tabs[i];
      if (res.status !== "fulfilled") {
        console.warn(`Sheet tab "${tabs[i][1]}" did not load:`, res.reason);
        return;
      }
      res.value.forEach((row) => {
        const id = ytId(row.c?.[1]?.v || "");
        if (!id) return;
        const rawTitle = row.c?.[0]?.v || "";
        const guess = classify(rawTitle) || classify(cleanTitle(rawTitle, ""));
        const section = guess || homeTab;
        /* 2 = the title and the tab agree · 1 = the title alone decided ·
           0 = neither, so the tab it was typed into stands. */
        const score = guess === homeTab ? 2 : guess ? 1 : 0;
        const prev = byId.get(id);
        if (!prev || score > prev.score) {
          byId.set(id, { id, score, section,
            title: cleanTitle(rawTitle, "Untitled Film"),
            category: SECTION_LABEL[section] });
        }
      });
    });
    byId.forEach(({ id, title, category, section }) =>
      buckets[section].push({ id, title, category }));
    return buckets;
  })());

  /* ------------------------------------------------------------
     Carousel — native snap-scroll rail.
     The track is a horizontally scrollable flex container. Each item
     is scroll-snap-align:center. goTo() scrolls to a real pixel offset
     computed from the item's actual width + gap (never a % of track).
     ------------------------------------------------------------ */
  class Carousel {
    constructor(trackSelector, dotsSelector) {
      this.track = document.querySelector(trackSelector);
      this.dots = document.querySelector(dotsSelector);
      this.items = [];
      this.currentIndex = 0;

      if (!this.track) return;

      const container = this.track.closest('.carousel-container');
      this.prevBtn = container?.querySelector('.carousel-prev');
      this.nextBtn = container?.querySelector('.carousel-next');

      if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prev());
      if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.next());

      // Keep dots/arrows in sync with native swipes & flicks.
      let raf = null;
      this.track.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          this.syncFromScroll();
        });
      }, { passive: true });

      // Guard: ignore the click that follows a drag so it doesn't
      // fire the lightbox after a swipe.
      let downX = 0, moved = false;
      this.track.addEventListener('pointerdown', e => { downX = e.clientX; moved = false; }, { passive: true });
      this.track.addEventListener('pointermove', e => {
        if (Math.abs(e.clientX - downX) > 8) moved = true;
      }, { passive: true });
      this.track.addEventListener('click', e => {
        if (moved) { e.stopPropagation(); e.preventDefault(); }
      }, true);

      window.addEventListener('resize', () => this.syncFromScroll());
    }

    setItems() {
      this.items = Array.from(this.track.children);
      this.buildDots();
      this.goTo(0, true);
      this.syncFromScroll();
    }

    // Real pixel stride of one card (width + gap).
    stride() {
      if (this.items.length < 2) return this.items[0]?.offsetWidth || 0;
      return this.items[1].offsetLeft - this.items[0].offsetLeft;
    }

    // Scroll so card `index` is centered in the viewport.
    goTo(index, instant) {
      if (!this.items.length) return;
      index = Math.max(0, Math.min(index, this.items.length - 1));
      const item = this.items[index];
      const left = item.offsetLeft - (this.track.clientWidth - item.offsetWidth) / 2;
      this.track.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
      this.currentIndex = index;
      this.updateButtons();
      this.updateDots();
    }

    next() { this.goTo(this.currentIndex + 1); }
    prev() { this.goTo(this.currentIndex - 1); }

    // Derive the active index from the actual scroll position.
    syncFromScroll() {
      if (!this.items.length) return;
      const center = this.track.scrollLeft + this.track.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      this.items.forEach((item, i) => {
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const dist = Math.abs(itemCenter - center);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      if (best !== this.currentIndex) {
        this.currentIndex = best;
        this.updateDots();
      }
      this.updateButtons();
    }

    updateButtons() {
      const maxScroll = this.track.scrollWidth - this.track.clientWidth - 2;
      if (this.prevBtn) this.prevBtn.disabled = this.track.scrollLeft <= 2;
      if (this.nextBtn) this.nextBtn.disabled = this.track.scrollLeft >= maxScroll;
    }

    buildDots() {
      if (!this.dots) return;
      this.dots.innerHTML = '';
      this.items.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === this.currentIndex ? ' active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => this.goTo(i));
        this.dots.appendChild(dot);
      });
    }

    updateDots() {
      if (!this.dots) return;
      Array.from(this.dots.children).forEach((dot, i) => {
        dot.classList.toggle('active', i === this.currentIndex);
      });
    }
  }

  // Video lightbox — use the shared one from app.js when available
  function openVideo(ytId, title, isVertical) {
    if (window.openLB) { window.openLB(ytId, title, isVertical); return; }
    const lb = document.getElementById('lb');
    const inner = document.getElementById('lbInner');
    const titleEl = document.getElementById('lbTitle');
    if (!lb || !inner) return;
    inner.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    titleEl.textContent = title || '';
    lb.classList.add('open');
  }

  /* An empty rail used to fall back to a hard-coded list in config.js, and
     every one of those hard-coded videos was a tribute film — which is exactly
     how tribute films ended up showing under "Wedding Invitations" and "Baby
     Name Reveals". A section with nothing of its own to show now hides itself,
     along with the divider that follows it. Showing the wrong work is worse
     than showing none. */
  function hideSection(el) {
    const sec = el.closest('section');
    if (!sec) return;
    sec.hidden = true;
    sec.style.display = 'none';
    const dvr = sec.nextElementSibling;
    if (dvr && dvr.classList.contains('dvr')) dvr.style.display = 'none';
  }

  // Load tribute videos carousel
  async function loadTributeCarousel() {
    const track = document.getElementById('tributeCarousel');
    if (!track) return;

    try {
      const items = (await routedFilms()).tribute;
      if (!items.length) { hideSection(track); return; }

      track.innerHTML = '';
      items.forEach(({ id, title, category }) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.innerHTML = `
          <img src="${thumb(id)}" alt="${title}" loading="lazy" />
          <div class="play"><b></b></div>
          <div class="meta">
            <small>${category}</small>
            <h3>${title}</h3>
          </div>
        `;
        item.addEventListener('click', () => openVideo(id, title, false));
        track.appendChild(item);
      });

      const carousel = new Carousel('#tributeCarousel', '#carouselDots');
      carousel.setItems();

    } catch (err) {
      console.error('Failed to load tribute videos:', err);
      track.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--muted);">Unable to load videos. Please check back soon.</div>';
    }
  }

  // Load vertical invitation videos
  async function loadInvitationVideos() {
    const container = document.getElementById('invitationVideos');
    if (!container) return;

    let items = [];

    try { items = (await routedFilms()).invitation; }
    catch (e) { console.warn("Sheet fetch for invitations failed, fallback to config:", e); }

    if (!items.length) {
      items = (CFG.INVITATION_VIDEOS || []).map(item => {
        const v = typeof item === 'string' ? { youtube: item } : item;
        return { id: ytId(v.youtube), title: cleanTitle(v.title, 'Wedding Invitation Video'),
                 category: v.category || 'Wedding Invitation' };
      }).filter(v => v.id);
    }

    if (!items.length) { hideSection(container); return; }

    container.innerHTML = '';
    items.forEach(({ id, title, category }) => {
      const el = document.createElement('div');
      el.className = 'carousel-item-916';
      el.innerHTML = `
        <img src="${thumb(id)}" alt="${title}" loading="lazy" />
        <div class="play"><b></b></div>
        <div class="meta">
          <small>${category || 'Wedding Invitation'}</small>
          <h3>${title}</h3>
        </div>
      `;
      el.addEventListener('click', () => openVideo(id, title, true));
      container.appendChild(el);
    });

    const carousel = new Carousel('#invitationVideos', '#invitationDots');
    carousel.setItems();
  }

  // Load name reveal carousel
  async function loadNameRevealCarousel() {
    const track = document.getElementById('nameRevealCarousel');
    if (!track) return;

    let items = [];

    try { items = (await routedFilms()).namereveal; }
    catch (e) { console.warn("Sheet fetch for name reveal failed, fallback to config:", e); }

    if (!items.length) {
      items = (CFG.NAME_REVEAL_VIDEOS || []).map(item => {
        const v = typeof item === 'string' ? { youtube: item } : item;
        return { id: ytId(v.youtube), title: cleanTitle(v.title, 'Baby Name Reveal Video'),
                 category: v.category || 'Name Reveal' };
      }).filter(v => v.id);
    }

    if (!items.length) { hideSection(track); return; }

    track.innerHTML = '';
    items.forEach(({ id, title, category }) => {
      const el = document.createElement('div');
      el.className = 'carousel-item';
      el.innerHTML = `
        <img src="${thumb(id)}" alt="${title}" loading="lazy" />
        <div class="play"><b></b></div>
        <div class="meta">
          <small>${category || 'Name Reveal'}</small>
          <h3>${title}</h3>
        </div>
      `;
      el.addEventListener('click', () => openVideo(id, title, false));
      track.appendChild(el);
    });

    const carousel = new Carousel('#nameRevealCarousel', '#nameRevealDots');
    carousel.setItems();
  }

  /* ------------------------------------------------------------
     Poster-card renderer for live site showcases (wedding & AI).
     Renders a real screenshot poster inside a device frame with an
     "Open Site" CTA — never a broken/blank iframe.
     ------------------------------------------------------------ */
  function sitePosterCard(opts) {
    const { label, title, note, url, poster, kind } = opts;
    const hasUrl = url && url.trim();
    const hasPoster = poster && poster.trim();

    const card = document.createElement('figure');
    card.className = `site-card reveal ${kind === 'ai' ? 'site-card--ai' : ''}`;

    const media = hasPoster
      ? `<img class="site-poster" src="assets/${poster}" alt="${title} preview" />`
      : `<div class="mock-fallback">
           <span class="mock-mono">${label}</span>
           <span class="mock-couple">${title}</span>
           ${note ? `<span class="mock-note">${note}</span>` : ''}
         </div>`;

    /* "Private Preview" implied a visitor could ask for access, which they
       cannot — these are concepts. Say so plainly instead. */
    const cta = hasUrl
      ? `<a href="${url}" target="_blank" rel="noopener" class="site-visit">View Live Demo ↗</a>`
      : `<span class="site-visit site-visit--private">${kind === 'ai' ? 'Concept Demo' : 'Private'}</span>`;

    card.innerHTML = `
      <div class="device-mock">
        <div class="mock-screen">
          ${media}
          ${hasUrl ? `<a href="${url}" target="_blank" rel="noopener" class="mock-open" aria-label="View a live demo of ${title}"><span>View Live Demo ↗</span></a>` : ''}
        </div>
      </div>
      <figcaption>
        <small>${label}</small>
        <h3>${title}</h3>
        <p>${note || ''}</p>
        ${cta}
      </figcaption>
    `;

    // Make the whole poster clickable when there's a live URL.
    if (hasUrl && hasPoster) {
      const screen = card.querySelector('.mock-screen');
      screen.style.cursor = 'pointer';
    }

    return card;
  }

  // Load wedding sites grid
  function loadWeddingSites() {
    const grid = document.getElementById('weddingSitesGrid');
    if (!grid) return;

    grid.innerHTML = '';
    CFG.WEDDING_SITES.forEach(site => {
      grid.appendChild(sitePosterCard({
        label: 'Wedding Invitation Website',
        title: site.couple,
        note: site.note,
        url: site.url,
        poster: site.poster,
        kind: 'wedding'
      }));
    });
  }

  // Load AI builds grid
  function loadAIBuilds() {
    const grid = document.getElementById('aiBuildsGrid');
    if (!grid) return;

    grid.innerHTML = '';
    CFG.AI_BUILDS.forEach(build => {
      grid.appendChild(sitePosterCard({
        label: 'AI Solution',
        title: build.title,
        note: build.note,
        url: build.url,
        poster: build.poster,
        kind: 'ai'
      }));
    });
  }

  // Initialize everything
  function init() {
    loadTributeCarousel();
    loadInvitationVideos();
    loadNameRevealCarousel();
    loadWeddingSites();
    loadAIBuilds();
  }

  // Wait for DOM and config
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
