# DeepDreams AI Studio — Portfolio

A premium, mobile-first portfolio for cinematic tribute AI videos.
Videos are pulled **live** from a Google Sheet, so you update the
site from your phone — no code, no redeploy.

## Folder structure
```
deepdreams-portfolio/
├── index.html
├── manifest.json
├── README.md
├── assets/
│   └── logo.png              ← your ammonite logo (name it exactly logo.png)
├── css/
│   └── style.css
└── js/
    ├── config.js             ← THE ONLY FILE YOU EDIT
    └── app.js
```

## Setup (5 minutes, once)

### 1. Add your logo
Put your logo in `assets/logo.png`. From a terminal:
```bash
curl -L "https://www.genspark.ai/api/files/s/a9L9k9Uu" -o assets/logo.png
```
(Or just drag your saved image in and rename it logo.png.)

### 2. Edit js/config.js
Fill in: WhatsApp number, email, Instagram, YouTube, UPI ID, your hero video ID, and your Google Sheet ID. That's all.

### 3. Create your Google Sheet (your video control panel)
New Google Sheet. Row 1 headers, EXACTLY: `Title | YouTube | Category | Featured`
Add one video per row (any YouTube link format works).
Put `yes` in the Featured column to push a film to the front.
Share → "Anyone with the link" → Viewer.
File → Share → Publish to web → Publish.
Copy the long ID from the sheet URL (between `/d/` and `/edit`) and paste it into `SHEET_ID` in `config.js`.
To add a new sample later: just open the Google Sheets app on your phone and add a row. The website updates by itself.

### Preview locally
The Google Sheet fetch needs http (not file://). Run:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` — or use the Live Server extension.

### Deploy (free, shareable link)
Drag the whole folder onto https://app.netlify.com/drop. You get a link like `deepdreams.netlify.app` — send that on WhatsApp. Updating videos never needs a redeploy; the sheet drives everything.

### Tech
HTML + CSS + vanilla JS · Lenis (smooth scroll) · GSAP + ScrollTrigger (animations) · Google Sheets GViz (live data, no API key) · YouTube nocookie embeds · installable PWA (manifest.json).

### Editing cheat-sheet
| Want to change… | Edit… |
| :--- | :--- |
| Phone / email / socials | `js/config.js` |
| UPI details | `js/config.js` |
| Hero featured video | `js/config.js` → `HERO_VIDEO` |
| Gallery videos | your Google Sheet |
| Logo | replace `assets/logo.png` |
| Stat numbers | `index.html` → `data-count="..."` |
| Colors | `css/style.css` → `:root` variables |
