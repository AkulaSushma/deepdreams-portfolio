# A Royal Baraat — 3D Web Experience

An interactive 3D scene: a grand royal Hindu wedding procession (baraat) set in a
golden-hour forest valley. Built with **Three.js** + **Vite**. Runs in any modern
browser, desktop or mobile.

## What's in the scene
- A white-marble **mandap** with carved pillars, a tiered gold dome, kalash finial and a sacred fire, nestled in the forest across a reflecting lake.
- The **groom on a decorated white horse**, the **bride** at the mandap, and one richly adorned **elephant**.
- **10 royal attendants** carrying chhatris (parasols), garlands, lamps, a flag, and musical instruments (dhol, shehnai, turhi, morchhal).
- A directed **baraat entrance**: the existing dancers, musicians, groom and elephant travel down the carpet, arrange for the welcome, and trigger petals, fireworks and a jaimala arrival beat.
- Distance-driven articulated walking gives the horse, elephant, attendants, dancers and procession guests synchronized leg, hoof and foot motion; the welcome mandap, bride, arch and decor are aligned to the carpet approach.
- A wide **burgundy-and-gold ceremonial carpet** path, toran gates, floral arches, lamp-pillars, brass diyas, hanging marigold/jasmine garlands, warm lanterns.
- Cinematic golden-hour light, volumetric god-rays, gentle fog, and floating flower petals — over the preserved natural landscape (trees, mountains, lake, birds, butterflies).
- The supplied **Ishq Sufiyana piano cover** plays as the continuous musical bed, web-optimized and circularly crossfaded for a clean loop. Lightweight dholak, manjira, hoof accents, temple bells, shankh and arrival firecrackers are mixed around it with automatic music ducking.

## Run it locally
```bash
npm install
npm run dev        # opens a live dev server (default http://localhost:5173)
```

## Share it with people — 3 options

### 1. One file you can email / send (simplest)
```bash
npm run build:single
```
Produces **`dist-single/index.html`** — a single self-contained file (~5.8 MB) with
everything (including Three.js and the piano track) inlined. Send that one file; the recipient just
double-clicks it to open in their browser. No internet or install required.

### 2. Host it as a website (best experience — a shareable link)
```bash
npm run build      # outputs the dist/ folder
```
Drag the **`dist/`** folder onto [app.netlify.com/drop](https://app.netlify.com/drop)
(or deploy to Vercel / GitHub Pages / any static host). You get a public URL you can
share with anyone.

### 3. Preview a production build locally
```bash
npm run preview          # serves dist/
npm run preview:single   # serves dist-single/
```

## Controls
- **Desktop:** drag to orbit, scroll to zoom, right-drag to pan, and use **W A S D / arrows** to fly.
- **Phone:** drag with one finger to orbit, pinch to zoom, and use a two-finger drag to pan. A small **Follow Baraat** button appears only after you take control—there is no joystick or button grid.
- The camera follows the baraat by default; any navigation input takes over immediately.
- Tap the speaker button (or interact with the world) to start / mute the piano-led wedding soundscape. Browsers require one interaction before audible playback can begin.

## Project layout
```
index.html            page shell + title / loading overlay
src/main.js           scene assembly: landscape, atmosphere, asset placement, camera
src/assets/audio/     optimized looping piano cover used by the soundscape
src/wedding/          the baraat assets (each a self-contained module)
  shared.js           the royal color palette
  mandap.js  arches.js  horseGroom.js  bride.js  elephant.js
  attendants.js  decor.js  ground.js  atmosphere.js  soundscape.js
vite.config.js        normal + single-file build config
```

## Performance / mobile
Low-poly stylized assets, instanced foliage & petals, a tight light budget, and
automatic mobile tuning (reduced pixel ratio, shadow resolution, grass and petal
counts) keep it light enough to render smoothly on phones. The procession reuses
the existing characters and particles with transform animation only—no extra
models, image files, dependencies, or draw calls were added. The 5:22 piano cover
is compressed to about 3.86 MB and streamed through one persistent media element,
avoiding the roughly 100 MB memory cost of decoding it into an AudioBuffer. Mobile
devices also use gesture-first controls, lower landscape shadow cost, cached
terrain sampling, stable time-based animation, and sparse procedural audio layers.

Before publishing publicly, make sure you have permission to distribute the supplied piano recording.
