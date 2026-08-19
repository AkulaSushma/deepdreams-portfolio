# Royal Wedding Invitation + 3D World — Project Handoff

This package contains two deliberately separate experiences: the invitation at the
root and the 3D wedding world under `world/`. Keeping separate routes is important:
the WebGL bundle and its soundtrack download only after a guest chooses to enter.

## Experience map

1. **The Seal** — opening loader and the required user gesture that unlocks audio.
2. **Hero film** — 181 origami WebP frames scrubbed beneath one constant wedding message.
3. **Countdown** — a dedicated invitation card for the wedding date and live timer.
4. **Celebrations and films** — event cards and lazy cinematic clips.
5. **Blessing and Hidden Moment** — scratch reveal plus a scroll-driven film.
6. **Venue and RSVP** — maps and a responsive RSVP sheet.
7. **Finale** — names, wedding date and a Rajputana gateway into the celebration.
8. **Portal handoff** — a short gold bloom, clean audio handoff and same-tab navigation.
9. **3D wedding world** — the existing baraat experience, loaded only at this point.

## File structure

```text
index.html                 studio landing page (first thing visitors see)
create.html                no-code editor (design your own invitation)
invitation.html            invitation sections and portal markup
studio.css                 landing page + editor design system
studio.js                  landing page interactions + phone-mockup scrub
editor.js                  editor state, live preview, export
config.js                  client names, dates, events, venue, theme + studio bridge
styles.css                 invitation, gateway and transition design
app.js                     animation, media, sound and portal controller
assets/
  frames/lo|hi/            hero frames (f_001…f_181.webp)
  frames2/                 hidden-moment frames (s_001…s_121.webp)
  film/                    lazy MP4 clips and posters
  stills/                  section and venue artwork
  decor/                   arch, elephant, toran, diya and other cutouts
  audio/bgm.m4a            invitation background score
world/
  index.html               production entry for the 3D experience
  assets/                  compiled world bundle and its soundtrack
README.md                  operation and customization notes
HANDOFF.md                 this file
```

## Development and deployment

There is no build step for the invitation. Run from the package root with:

```powershell
npx.cmd --yes http-server . -p 4173
```

The 3D world is already a production Vite build with relative asset URLs. Deploy
the whole folder tree unchanged to any static host; do not publish only the root
HTML files or omit `world/assets/`.

The original invitation repository/deployment may predate this local portal package.
Do not assume a push there contains the 3D world until this complete folder has been
merged and deployed.

## Performance rules to preserve

- Do not preload, prefetch or iframe the 3D route from the invitation.
- Keep portal navigation in the same tab so the invitation's media/GPU work can be
  released before WebGL initializes.
- The seal gates an adaptive 10–54 low hero frames so roughly the first full swipe has a decoded
  runway. Nearby low frames warm during the door reveal, decode before paint, use
  playhead-aware priority, and are evicted
  outside an asymmetric playhead window.
- High hero frames are desktop-only under suitable network/memory conditions, decode
  one at a time only while the playhead is calm, and use a tiny evicting window; never
  restore the old all-181 high-frame sweep.
- Sanctum unlocks after an adaptive 6–16-frame runway, then streams and evicts around
  its playhead. Both scroll films cache stable geometry, and videos remain lazy.
- Audio permission does not reliably cross a document navigation. The portal fades and
  stops the invitation score, passes only play/mute intent, and lets the world start its
  own soundscape from the beginning. The world opens directly and silently
  retries on the first natural world interaction when a mobile browser blocks autoplay.
  The persistent speaker control always performs a fresh trusted audio unlock.
- Verify licensing for both supplied music tracks before public/commercial use.

## Portal implementation notes

- The destination is the semantic anchor `#world-portal-link` in `#finale`.
- Standard clicks are enhanced for about 820 ms; modified clicks retain normal browser
  behavior, and reduced-motion visitors navigate immediately.
- The transition ends on the same dark-maroon radial gradient as the world loader,
  avoiding a white flash.
- `pageshow` resets the overlay and restores invitation audio after browser Back/bfcache.
- The gateway visual is a CSS-only Rajputana torana with carved pillars, lattice doors
  and a gold light path. Keep it image-free and animate only opacity/transform.

## Current couple values

- Mishi Agarwal and Mrigank Singh Rathore
- 26 November 2026, Udaipur
- `#MishiWedsMrigank`
