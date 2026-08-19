# Royal Wedding Invitation Project

This folder is the complete editable project. It contains two deliberately separate experiences so the heavy WebGL world loads only after a guest taps the portal.

## Where to edit

- Invitation/card: `index.html`, `styles.css`, `app.js`, and `config.js` at this folder's root.
- Invitation media: `assets/`.
- Editable Three.js world: `3d-world-source/`.
- Generated production world: `world/`.

Never hand-edit the hashed JavaScript inside `world/assets/`. Make 3D changes in `3d-world-source/src/`, then run `BUILD-AND-SYNC-WORLD.ps1` from this folder. The script installs dependencies if needed, builds the world, and copies the production result into `world/`.

## Local preview

From this folder in PowerShell:

```powershell
npx.cmd --yes http-server . -p 4173
```

Then open `http://127.0.0.1:4173/`. The 3D route is `/world/`.

For live development of only the 3D source:

```powershell
cd .\3d-world-source
npm.cmd install
npm.cmd run dev
```

## Important architecture and performance rules

- Keep the invitation and `world/` as separate routes. Do not preload or iframe the world.
- Preserve same-tab portal navigation and the invitation-to-world audio handoff.
- Keep phone controls gesture-first: one-finger orbit, pinch zoom and two-finger pan; no joystick.
- Preserve adaptive frame streaming, lazy videos and bounded image caches in `app.js`.
- Prefer existing characters, instanced particles, CSS and transform animation over new media or models.
- Keep mobile WebGL pixel ratio, shadows, foliage and effects conservative.
- When root CSS or JavaScript changes, bump their `?v=` cache values in `index.html`.
- After any 3D edit, rebuild and sync before testing the full invitation.

## The couple name board (read this before touching the hero)

The names sit on a glass board over the moving artwork, so any change to the
names, the font or the board's padding can make it cover the palace. Two rules
keep that from happening, and both are enforced in code — not by hand-tuning.

1. **The board reserves its own space.** `nameBoard` in `app.js` measures the
   finished board and publishes its height into `heroBoardReserve` (also exposed
   as the `--board-h` CSS variable). `drawBlend` in the scrub engine fits the
   artwork into the height *above* that band. A taller board makes the palace
   smaller; it can never be drawn underneath the board.

2. **Type size is measured, never guessed.** `nameBoard` shrinks the names until
   they fit both the board's inner width and its height budget
   (`BOARD.heightPct` of the hero). One line — `Bride ♥ Groom` — is used for as
   long as it stays legible; as soon as one line would need type smaller than
   `BOARD.oneLineMinPx`, the board stacks: **groom on top, ♥ in the middle,
   bride below**, each name fitted on its own line. The size is published as
   BOTH a `--names-fs` root custom property and an `!important` inline font-size
   on the `.names` element.

When a longer name arrives, nothing needs editing — it fits itself. If you want
a different feel, change the `BOARD` object in `app.js`:

| Field | Meaning |
| --- | --- |
| `maxPx` / `minPx` | largest / smallest display size allowed |
| `oneLineMinPx` | the size below which one line becomes a stack |
| `heightPct` | share of the hero the board may occupy |
| `comfortPx` | height trimming stops at this size; the reserve band takes over below it. Only applied when height was the binding constraint — never overrides a width-driven size (that would overflow the board) |
| `safety` | breathing room kept against the board's inner width (0–1) |
| `namesShare` | share of the height budget the names themselves may use |
| `gapPx` | clear air the artwork keeps above the board |

The size is computed with **canvas `measureText`** — never from a synchronous
layout read. A `--names-fs` write followed by an immediate `scrollWidth` read
returns stale geometry in hidden/throttled documents and broke this fitter
once; keep all width decisions in the analytic `sizeFor`/`capToHeight` path
and use layout only for the self-correcting reserve height (`publish()`).

**Reduced-motion transition hazard.** `@media (prefers-reduced-motion: reduce)`
forces `transition-duration: .01s !important` on `*`. When a CSS custom
property drives a font-size change, Chrome can freeze the computed value at
the pre-variable fallback (`clamp(…)`). The `.names, .names * { transition-property: none !important }`
rule inside that media block prevents the font-size transition from starting.
`setPx()` in `app.js` also writes an `!important` inline font-size as a belt-
and-suspenders. Never rely on `el.style.fontSize = v` alone — use
`setProperty("font-size", v, "important")`.

Do **not** re-add per-name-length font sizes, negative margins or downward
`transform` nudges to `.names` / `.hero-copy-glass` — they fight the fitter and
were the cause of the board overlapping the artwork. `.names` must keep
`white-space: nowrap`, which is how the fitter detects overflow.

The editor's live preview follows the same rule through `fitPvNames()` in
`editor.js` (constants in `PV_NAMES`). Keep the two in step.

## Current experience

The invitation includes the seal opening, scroll-scrubbed wedding artwork, countdown, event cards, films, scratch blessing, venue/RSVP and a glowing portal with a tap-hand cue. The world includes the moving baraat, groom and horse, elephant, bride and mandap, animated walkers, cinematic Follow Baraat camera, mobile tips, piano-led wedding soundscape, arrival petals/fireworks and a guest throwing money from his animated hand.

Current public site: https://global0809.github.io/royal-wedding-invite/

