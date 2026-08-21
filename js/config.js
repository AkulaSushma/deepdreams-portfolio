/* ============================================================
   DEEPDREAMS — CONFIG
   This is the ONLY file you need to edit.
   Fill in your details below, save, done.

   ── HOW THE WORK SHOWCASE LOADS ──────────────────────────────
   Each collection below can be fed TWO ways (same as your main
   Tribute gallery):

     1) LIVE from your Google Sheet — add a new tab with the row
        headers shown for each collection. The website updates the
        moment you add a row on your phone. No redeploy.
     2) INLINE right here — paste links/URLs in the arrays below
        and they take priority over the Sheet if both exist.

   Type conventions:
     • youtube : any YouTube link, or just the 11-char ID.
     • url     : full https:// link to the live website.
   ============================================================ */
window.DD_CONFIG = {

  /* ---- 1. GOOGLE SHEET (your control panel) ----
     Create a Google Sheet with these headers in row 1 of the
     FIRST tab:
        Title | YouTube | Category | Featured
     Then: Share → "Anyone with the link" (Viewer),
           File → Share → Publish to web → Publish.
     Copy the long ID from the sheet URL (between /d/ and /edit)
     and paste it below. Leave as-is to see demo content.

     ADD MORE TABS (one per collection) — headers in row 1:
        · Invitations tab  →  Title | YouTube
        · NameReveals tab  →  Title | YouTube
        · Websites tab     →  Couple | Website | Note
     Any tab missing → that collection falls back to the inline
     arrays in this file.                                          */
  SHEET_ID: "1cMGf0VJRPTwHoUmlmw-XPfRvO6jmudz6QtBMS-saNtk",
  SHEET_TAB: "Ai Tribute Videos ",
  INVITATION_TAB: "Ai Wedding Invitation videos ",
  NAME_REVEAL_TAB: "Ai Name Revealing videos",

  /* ---- 2. HERO FEATURED VIDEO ----
     Paste the YouTube ID (11 chars) or full link of your best
     tribute film. It autoplays muted & loops as a cinematic
     showreel in the hero.                                       */
  HERO_VIDEO: "9dZuuFF6UvE",

  /* ---- 3. FEATURED STRIP ----
     Removed. This block described a "Featured" strip that no longer
     exists on the page — nothing in app.js or carousel.js ever read it.
     It also carried an invented couple ("Ananya & Rahul") that would
     have gone live the moment anything started reading it again.
     The hero film is set by HERO_VIDEO above; everything else comes
     from the Google Sheet.                                          */

  /* ---- 4. TRIBUTE FILMS (tab on the site) ----
     Fed from your Google Sheet's first tab (SHEET_ID above).
     Put `yes` in the Featured column to push one to the front.
     The arrays here are only a fallback if the Sheet is empty.   */
  /* (no inline override needed — Sheet-driven. See DEMO in app.js.) */

  /* ---- 5. INVITATION VIDEO SAMPLES ----
     Google Sheet tab name:  Invitations   (headers: Title | YouTube)
     Or paste links directly below (links or 11-char IDs,
     or { title: "...", youtube: "..." } for a custom caption).

     These are only used if the Sheet tab is empty or fails to load.
     Titles here are what a visitor reads, so keep them plain and
     professional — no "Sample —" or "Placeholder" wording.

     Emptied on purpose. The three videos that used to sit here
     (9-aldmF3BWo, cJ3x90THdOo, NcsfmkNb-M0) are all tribute films, so
     whenever the Sheet was slow or empty this section quietly filled
     itself with tribute work under a "Wedding Invitation" heading.
     Only add a video here if it is genuinely an invitation film; if
     this list is empty and the Sheet has nothing, the whole section
     hides itself instead of showing the wrong work.               */
  INVITATION_VIDEOS: [],

  /* ---- 6. NAME REVEAL VIDEO SAMPLES ----
     Google Sheet tab name:  NameReveals   (headers: Title | YouTube)
     Fallback only — used if the Sheet tab is empty. Visitor-facing
     titles, so keep them plain.

     Emptied for the same reason as above: jY5ooyW_Oug and FQXVaP6ZBM4
     are tribute films ("Late father attending to his son's marriage"
     and "…his daughter's marriage"), not name reveals.            */
  NAME_REVEAL_VIDEOS: [],

  /* ---- 7. WEDDING WEBSITE SHOWCASE ----
     Google Sheet tab name:  Websites   (headers: Couple | Website | Note)
       Website = the live link, or leave empty for "private".

     Or list inline below. Each entry:
       couple : the couple's names, e.g. "Ananya & Rahul"
       note   : one line, e.g. "Garden wedding · Hyderabad"
       url    : live https:// link ("" = shown as private)
       poster : optional filename in /assets, e.g. "site-ananya.jpg"
                Shown if the live site blocks iframe embedding
                (some hosts send X-Frame-Options). If absent, a
                tasteful gradient placeholder is used.            */
  WEDDING_SITES: [
    { couple: "Lakshmi & Sri",          note: "Interactive wedding invitation with event details and RSVP", url: "wedding-invite%20sample%201/index.html", poster: "site-invite1.jpg" },
    { couple: "Harshitha & Sai Charan", note: "Interactive 3D wedding invitation experience", url: "3D%20Wedding%20Invitation%20Sample%202/index.html", poster: "site-invite2.jpg" }
  ],

  /* ---- 8. CONTACT ---- */
  WHATSAPP: "919010901232",          // country code + number, no + or spaces
  WHATSAPP_MSG: "Hi DeepDreams, I'd like to know about tribute AI videos.",
  EMAIL: "k78491809@gmail.com",

  /* ---- 9. SOCIAL ---- */
  INSTAGRAM: "https://www.instagram.com/deepdreams_lateperson_death_ai?igsh=YTJ3bnNmMzVnYnh0",
  YOUTUBE:   "https://youtube.com/@deepdreamsaistudio?si=q9JqnwZsCsjD4GE1",

  /* ---- 10. UPI (Indian payments) ---- */
  UPI_ID: "9010901232@ybl",
  UPI_NAME: "DeepDreams AI Studio",
};
