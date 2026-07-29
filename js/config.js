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
        · AIBuilds tab     →  Title | Website | Note
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

  /* ---- 3. FEATURED STRIP (top of the Work section) ----
     A single hero piece chosen to lead the showcase, shown
     above the tabbed collection. Pick your strongest work here.

     tribute     : one YouTube link/ID + caption + category tag
     invitations : up to two { title, youtube }
     website     : one live wedding-website URL + couple / note
                   (poster optional — see WEDDING_SITES note)    */
  FEATURED: {
    tribute: {
      title:    "Featured Tribute — A Father's Blessing",
      youtube:  "9dZuuFF6UvE",
      category: "Memorial"
    },
    invitations: [
      { title: "Sample invitation — garden ceremony", youtube: "9-aldmF3BWo" },
      { title: "Sample invitation — temple wedding",  youtube: "cJ3x90THdOo" }
    ],
    website: {
      couple: "Ananya & Rahul",
      note:   "Live wedding invitation website",
      url:    ""                     /* paste a live https:// link */
    }
  },

  /* ---- 4. TRIBUTE FILMS (tab on the site) ----
     Fed from your Google Sheet's first tab (SHEET_ID above).
     Put `yes` in the Featured column to push one to the front.
     The arrays here are only a fallback if the Sheet is empty.   */
  /* (no inline override needed — Sheet-driven. See DEMO in app.js.) */

  /* ---- 5. INVITATION VIDEO SAMPLES ----
     Google Sheet tab name:  Invitations   (headers: Title | YouTube)
     Or paste links directly below (links or 11-char IDs,
     or { title: "...", youtube: "..." } for a custom caption).

     ⚠ TEMPORARY: the links below are stand-ins so the section
     looks complete. Replace them with real invitation videos
     (here or in the Sheet tab).                                 */
  INVITATION_VIDEOS: [
    { title: "Sample — cinematic style",  youtube: "9-aldmF3BWo" },
    { title: "Sample — celebration film", youtube: "cJ3x90THdOo" },
    { title: "Sample — family moments",   youtube: "NcsfmkNb-M0" }
  ],

  /* ---- 6. NAME REVEAL VIDEO SAMPLES ----
     Google Sheet tab name:  NameReveals   (headers: Title | YouTube)
     ⚠ TEMPORARY stand-ins below — replace with real ones.        */
  NAME_REVEAL_VIDEOS: [
    { title: "Sample — reveal style",  youtube: "jY5ooyW_Oug" },
    { title: "Sample — blessing film", youtube: "FQXVaP6ZBM4" }
  ],

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
    { couple: "Lakshmi & Sri",          note: "Cinematic wedding invitation website", url: "wedding-invite%20sample%201/index.html", poster: "site-invite1.jpg" },
    { couple: "Harshitha & Sai Charan", note: "3D cinematic wedding website · interactive", url: "3D%20Wedding%20Invitation%20Sample%202/index.html", poster: "site-invite2.jpg" }
  ],

  /* ---- 8. AI BUILDS / AI AGENT & WORKFLOW WEBSITES ----
     Google Sheet tab name:  AIBuilds   (headers: Title | Website | Note)
     Same shape as WEDDING_SITES.                                    */
  AI_BUILDS: [
    { title: "Sample AI agent — lead intake",     note: "Custom workflow · WhatsApp-first", url: "", poster: "ai-lead-intake.jpg" },
    { title: "Sample AI workflow — content engine", note: "Batched generation · dashboard",   url: "", poster: "ai-content-engine.jpg" }
  ],

  /* ---- 9. CONTACT ---- */
  WHATSAPP: "919010901232",          // country code + number, no + or spaces
  WHATSAPP_MSG: "Hi DeepDreams, I'd like to know about tribute AI videos.",
  EMAIL: "k78491809@gmail.com",

  /* ---- 10. SOCIAL ---- */
  INSTAGRAM: "https://www.instagram.com/deepdreams_lateperson_death_ai?igsh=YTJ3bnNmMzVnYnh0",
  YOUTUBE:   "https://youtube.com/@deepdreamsaistudio?si=q9JqnwZsCsjD4GE1",

  /* ---- 11. UPI (Indian payments) ---- */
  UPI_ID: "9010901232@ybl",
  UPI_NAME: "DeepDreams AI Studio",
};
