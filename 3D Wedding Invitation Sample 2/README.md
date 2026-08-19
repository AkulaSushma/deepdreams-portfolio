# Royal Wedding Invitation + Studio + 3D Portal

A mobile-first, scroll-driven wedding invitation with a cinematic studio landing
page and a browser-based no-code editor. The invitation tells Mishi and Mrigank's
story through an origami frame film, events, blessings, venue and RSVP, then ends
at a magical gateway into a separately loaded 3D wedding world.

## File structure

```text
index.html          ← Studio landing page (the first thing visitors see)
create.html         ← No-code editor (design your own invitation)
invitation.html     ← The scroll-cinema wedding invitation
studio.css          ← Landing page + editor design system
studio.js           ← Landing page interactions + phone-mockup scrub
editor.js           ← Editor state, live preview, export
config.js           ← Invitation config + studio bridge
app.js              ← Invitation engine (scroll scrub, scratch card, etc.)
styles.css          ← Invitation styles
world/              ← 3D wedding world (independent Vite build)
assets/             ← Frames, stills, audio, icons
```

## Run locally

Serve the project root with any static server:

```powershell
npx.cmd --yes http-server . -p 4173 -c-1
```

- Studio landing: `http://127.0.0.1:4173/`
- Live demo invitation: `http://127.0.0.1:4173/invitation.html`
- Editor: `http://127.0.0.1:4173/create.html`
- 3D world: `http://127.0.0.1:4173/world/`

## Studio bridge

The editor saves drafts to `localStorage` under the key `wedding-studio-draft`.
Two URL parameters drive the invitation from the editor:

- `?draft=1` — reads the draft from localStorage on the current device
- `?c=<base64url>` — decodes a shared design from the link itself

When neither is present, the invitation uses the defaults in `config.js` untouched.
The bridge also exposes `window.WEDDING_DEFAULTS` (the clean, pre-merge copy) so
the editor's Reset button returns to the demo, not to a previous share link.

## Portal architecture

- The invitation remains lightweight HTML, CSS and JavaScript with no build step.
- `Enter the Wedding World` is a normal link to `world/index.html`, enhanced with a short
  gold transition for standard-motion visitors.
- The 3D engine, scene bundle and world soundtrack are not requested until the
  visitor activates the portal. Same-tab navigation also lets the browser release
  the invitation's canvases and video decoders before WebGL starts.
- The gateway is a bright CSS-only Rajputana torana, so it adds no image,
  video, canvas or library payload.
- Reduced-motion visitors get immediate native navigation. Back navigation safely
  restores the invitation and its audio state.
- The invitation fades and stops its own score before navigation, then passes only
  the guest's play/mute intent to the same-origin world. The world starts its own
  soundscape cleanly from the beginning; strict mobile browsers unlock it on the
  guest's first natural world gesture without an extra entry modal.

## Performance behavior

- An adaptive 10–54 low-resolution hero frames gate the opening seal, giving roughly
  the first full swipe a decoded runway.
- High-resolution hero frames upgrade one at a time only while the playhead is calm.
  They are disabled on touch devices, Save-Data, slow connections and low-memory devices.
- Sanctum unlocks after a shorter adaptive runway, then streams through a bounded,
  evicting playhead window instead of retaining all 121 frames.
- Film clips remain lazy and play only near the viewport.

## Customize for another client

### Using the editor (no code)

Open `create.html`, fill in names, muhurat, functions, venue and palette, then
click **Preview** to see the real invitation with your changes. Use **Download
config.js** or **Copy shareable link** to export.

### Manual config

Names, monogram, date, events, venue, map query, RSVP URL, blessing text and theme
live in `config.js`.

To replace the hero film, extract matching WebP tiers with ffmpeg and then update
`frames.count` in `config.js`:

```text
ffmpeg -i film.mp4 -vf "fps=12,scale=-2:480"  -c:v libwebp -quality 55 assets/frames/lo/f_%03d.webp
ffmpeg -i film.mp4 -vf "fps=12,scale=-2:1152" -c:v libwebp -quality 66 assets/frames/hi/f_%03d.webp
```

The world is an independent Vite build copied into `world/`. When it changes, run
its normal production build and replace the contents of this project's `world/`
folder while keeping relative asset paths.

## Main features

- Scroll-scrubbed origami cinema with adaptive image quality.
- Ambient petals and lightweight wedding artwork reveals.
- Scratch-to-reveal blessing with haptics, temple bells and a petal ceremony.
- Dedicated countdown card, hidden-moment film, event cards, films, venue and RSVP.
- Licensed background score blended with synthesized bells and transition sounds.
- Accessible, keyboard-operable portal with mobile-safe full-page handoff to WebGL.
- Mobile-first sound handoff with first-gesture retry and a truthful playback indicator.
- Studio landing page with phone-mockup scroll scrub, pricing and FAQ.
- No-code editor with live preview, theme presets, event management and export.

Append `?tick` only for automated animation-loop QA in hidden tabs; visitors do not
need it.
