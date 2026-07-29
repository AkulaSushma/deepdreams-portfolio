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

  // Load tribute videos carousel
  async function loadTributeCarousel() {
    const track = document.getElementById('tributeCarousel');
    if (!track) return;

    try {
      const tab = CFG.SHEET_TAB || 'Ai Tribute Videos ';
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
      const response = await fetch(sheetUrl);
      const text = await response.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
      if (!match) throw new Error("Invalid response format");
      const json = JSON.parse(match[1]);

      const rows = json.table.rows || [];
      if (rows.length === 0) return;

      track.innerHTML = '';
      rows.forEach(row => {
        const title = row.c[0]?.v || 'Untitled';
        const youtube = row.c[1]?.v || '';
        const category = row.c[2]?.v || 'Tribute';

        const id = ytId(youtube);
        if (!id) return;

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

    try {
      const tab = CFG.INVITATION_TAB || 'Ai Wedding Invitation videos ';
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
      const response = await fetch(sheetUrl);
      const text = await response.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
      if (match) {
        const json = JSON.parse(match[1]);
        const rows = json.table.rows || [];
        rows.forEach(row => {
          const title = row.c[0]?.v || 'Invitation Film';
          const youtube = row.c[1]?.v || '';
          const category = row.c[2]?.v || 'Invitation';
          if (youtube) items.push({ title, youtube, category });
        });
      }
    } catch (e) {
      console.warn("Sheet fetch for invitations failed, fallback to config:", e);
    }

    if (!items.length) {
      items = CFG.INVITATION_VIDEOS || [];
    }

    container.innerHTML = '';
    items.forEach(item => {
      const video = typeof item === 'string' ? { youtube: item, title: 'Invitation Film' } : item;
      const id = ytId(video.youtube);
      if (!id) return;

      const el = document.createElement('div');
      el.className = 'carousel-item-916';
      el.innerHTML = `
        <img src="${thumb(id)}" alt="${video.title}" loading="lazy" />
        <div class="play"><b></b></div>
        <div class="meta">
          <small>${video.category || 'Invitation'}</small>
          <h3>${video.title}</h3>
        </div>
      `;
      el.addEventListener('click', () => openVideo(id, video.title, true));
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

    try {
      const tab = CFG.NAME_REVEAL_TAB || 'Ai Name Revealing videos';
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
      const response = await fetch(sheetUrl);
      const text = await response.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
      if (match) {
        const json = JSON.parse(match[1]);
        const rows = json.table.rows || [];
        rows.forEach(row => {
          const title = row.c[0]?.v || 'Name Reveal';
          const youtube = row.c[1]?.v || '';
          const category = row.c[2]?.v || 'Name Reveal';
          if (youtube) items.push({ title, youtube, category });
        });
      }
    } catch (e) {
      console.warn("Sheet fetch for name reveal failed, fallback to config:", e);
    }

    if (!items.length) {
      items = CFG.NAME_REVEAL_VIDEOS || [];
    }

    track.innerHTML = '';
    items.forEach(item => {
      const video = typeof item === 'string' ? { youtube: item, title: 'Name Reveal' } : item;
      const id = ytId(video.youtube);
      if (!id) return;

      const el = document.createElement('div');
      el.className = 'carousel-item';
      el.innerHTML = `
        <img src="${thumb(id)}" alt="${video.title}" loading="lazy" />
        <div class="play"><b></b></div>
        <div class="meta">
          <small>${video.category || 'Name Reveal'}</small>
          <h3>${video.title}</h3>
        </div>
      `;
      el.addEventListener('click', () => openVideo(id, video.title, false));
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

    const cta = hasUrl
      ? `<a href="${url}" target="_blank" rel="noopener" class="site-visit">Open Site ↗</a>`
      : '<span class="site-visit site-visit--private">Private Preview</span>';

    card.innerHTML = `
      <div class="device-mock">
        <div class="mock-screen">
          ${media}
          ${hasUrl ? `<a href="${url}" target="_blank" rel="noopener" class="mock-open" aria-label="Open ${title}"><span>Open Site ↗</span></a>` : ''}
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
        label: 'Wedding Website',
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
        label: 'AI Build',
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
