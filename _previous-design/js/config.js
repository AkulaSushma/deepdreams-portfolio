/* ============================================================
   DEEPDREAMS — CONFIG
   This is the ONLY file you need to edit.
   Fill in your details below, save, done.
   ============================================================ */
window.DD_CONFIG = {

  /* ---- 1. GOOGLE SHEET (your video control panel) ----
     Create a Google Sheet with these headers in row 1:
        Title | YouTube | Category | Featured
     Then: Share → "Anyone with the link" (Viewer),
           File → Share → Publish to web → Publish.
     Copy the long ID from the sheet URL (between /d/ and /edit)
     and paste it below. Leave as-is to see demo content.        */
  SHEET_ID: "1cMGf0VJRPTwHoUmlmw-XPfRvO6jmudz6QtBMS-saNtk",
  SHEET_TAB: "Sheet1",

  /* ---- 2. HERO FEATURED VIDEO ----
     Paste the YouTube ID (11 chars) or full link of your best film.
     It autoplays muted & loops as a cinematic showreel.           */
  HERO_VIDEO: "9dZuuFF6UvE",

  /* ---- 3. CONTACT ---- */
  WHATSAPP: "919010901232",          // country code + number, no + or spaces
  WHATSAPP_MSG: "Hi DeepDreams, I'd like to know about tribute AI videos.",
  EMAIL: "k78491809@gmail.com",

  /* ---- 4. SOCIAL ---- */
  INSTAGRAM: "https://www.instagram.com/deepdreams_lateperson_death_ai?igsh=YTJ3bnNmMzVnYnh0",
  YOUTUBE:   "https://youtube.com/@deepdreamsaistudio?si=q9JqnwZsCsjD4GE1",

  /* ---- 5. UPI (Indian payments) ----
     Your UPI ID and the name to show in the payee field.          */
  UPI_ID: "9010901232@ybl",
  UPI_NAME: "DeepDreams AI Studio",

  /* ---- 6. STUDIO STATS (shown in About) ---- */
  // edit the numbers directly in index.html (data-count="...") if you wish
};
