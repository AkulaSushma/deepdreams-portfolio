---
kind: frontend_style
name: Per-Product CSS with Shared Design Tokens and No Build Step
category: frontend_style
scope:
    - '**'
source_files:
    - css/style.css
    - wedding/style.css
    - wedding-invite/style.css
    - wedding-invite sample 1/style.css
    - 3D Wedding Invitation Sample 2/studio.css
    - 3D Wedding Invitation Sample 2/styles.css
    - _previous-design/css/style.css
---

## What system/approach is used

The repository has no shared UI framework, CSS-in-JS library, or build-time stylesheet processor. Each product ships its own plain `.css` file linked directly from an HTML page — there are no `@import`, Tailwind, Sass/SCSS, Less, Styled Components, Emotion, or any other preprocessor/framework references in the source. Styling is authored as vanilla CSS files that run in the browser with no compilation step.

There are four distinct visual products, each with its own palette and typography:

1. **Portfolio / landing** (`css/style.css`) — dark theme with a deep navy background, gold (`#c79a3a`) and blue (`#3aa0ff`) accents, Inter + Cormorant Garamond fonts, glassmorphism cards, animated ocean washes, and a grain overlay. Used by the root `index.html`.
2. **South Indian Hindu wedding invitation** (`wedding/style.css`, duplicated verbatim in `wedding-invite/style.css` and `wedding-invite sample 1/style.css`) — kanjivaram maroon + temple gold + kumkum red + turmeric cream + leaf green palette; Great Vibes for names, Cormorant Garamond for display, Jost for body text; includes a CSS-only thoranam (mango-leaf garland) header, mandala rings built with `repeating-conic-gradient`, countdown tiles, and a photo mosaic gallery.
3. **3D Wedding Invitation Sample 2 — studio & invite** (`3D Wedding Invitation Sample 2/studio.css` and `3D Wedding Invitation Sample 2/styles.css`) — maroon/ivory/gold foil theme using Cinzel + Cormorant Garamond + Noto Serif Telugu; features a door-opening loader with a seal button, gold-foil animated text, paper-grain texture via inline SVG noise, scroll-cinema hero, scratch-blessing reveal, and a phone-frame showcase with floating orbit chips.
4. **Previous design** (`_previous-design/css/style.css`) — legacy styles kept for reference.

## Key files and packages

- `css/style.css` — portfolio landing styles (635 lines).
- `wedding/style.css` — South Indian invitation template (1193 lines); copied into `wedding-invite/style.css` and `wedding-invite sample 1/style.css` so each published invitation can be customized independently.
- `3D Wedding Invitation Sample 2/studio.css` — editor/landing page styles (462 lines).
- `3D Wedding Invitation Sample 2/styles.css` — full invitation experience styles (2005+ lines), including the loader, petals, hero scrub, gallery, RSVP, and world sections.
- `_previous-design/css/style.css` — archived prior styling approach.

No package.json dependencies exist for styling at the repo root; the only JS dependency for animation is the Lenis smooth-scroll class hook (`html.lenis`, `html.lenis body`, `.lenis.lenis-smooth`) referenced in `css/style.css`.

## Architecture and conventions

- **Design tokens live in `:root` custom properties.** Every stylesheet opens with a `:root` block declaring colors, fonts, easing curves, radii, and max widths (e.g. `--maroon`, `--gold`, `--serif-display`, `--ease:cubic-bezier(.22,1,.36,1)`). Colors are reused everywhere rather than hard-coded hex values, which makes per-product theming possible without a build step.
- **One stylesheet per product, no shared base.** There is no common CSS file imported across products. The South Indian invitation template is duplicated into three sibling directories so each published site is self-contained — this is the chosen distribution strategy instead of sharing a base stylesheet.
- **Mobile-first responsive breakpoints.** Breakpoints are declared inline with `@media (min-width: ...)` rules inside the same file (e.g. `768px`, `900px`, `940px`, `1000px`, `1180px`). Layouts start single-column and expand to multi-column grids at those thresholds.
- **CSS-only decorative effects.** Heavy visual cues are implemented in pure CSS: gold-foil text via `background-clip: text` with an animated gradient, paper grain via inline SVG `<feTurbulence>` data URIs, silk sheen via `repeating-linear-gradient`, mandala rings via `repeating-conic-gradient`, and backdrop blur for glass cards.
- **Consistent reset and baseline.** Every stylesheet begins with `* { margin:0; padding:0; box-sizing:border-box }`, sets `html { scroll-behavior: smooth }`, applies `-webkit-font-smoothing: antialiased`, and forces images to `max-width:100%`. Focus visibility is handled via `:where(a,button,input,select,textarea):focus-visible` with a gold outline.
- **Utility classes for layout and motion.** Common patterns include `.section`, `.sec-head`, `.eyebrow`, `.reveal` / `.reveal.in` for scroll-triggered fade-ins, `.w-container` / `.w-section` for the invitation pages, and `.btn` / `.btn-gold` / `.btn-ghost` variants in the studio.
- **Accessibility hooks.** A `[hidden]{display:none!important}` rule is explicitly documented in comments on the invitation templates to ensure dynamically toggled hidden elements stay hidden even when JavaScript adds display classes. Reduced-motion is respected via `@media(prefers-reduced-motion:reduce)` to disable animations on buttons and the marquee.

## Conventions and constraints

- **Each product owns its stylesheet.** There is no shared CSS module or import chain; duplication of the South Indian invitation stylesheet across `wedding/`, `wedding-invite/`, and `wedding-invite sample 1/` is intentional so every published link is self-contained.
- **No preprocessors or frameworks are used.** Searches for `@import`, `tailwind`, `sass`, `scss`, `less`, `styled-components`, and `emotion` return zero matches in HTML/CSS sources. All styling is plain CSS served directly to the browser.
- **Tokens must be edited in `:root`.** Because colors, fonts, and easing curves are defined exclusively as CSS variables at the top of each stylesheet, changing a brand color requires editing the corresponding `:root` declaration rather than hunting through individual selectors.
- **Breakpoints are ad-hoc per product.** There is no shared breakpoint map; each stylesheet picks its own thresholds (e.g. `560px`, `768px`, `900px`, `940px`, `1000px`, `1180px`). This means cross-product consistency is not enforced by a central config.
- **Decorative effects should remain CSS-only.** The codebase consistently uses gradients, masks, filters, and keyframe animations for visual flourishes (foil sheen, mandala spin, petal particles, ocean washes) rather than offloading them to JS libraries, keeping the runtime light.