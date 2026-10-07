# DESIGN-TOKENS — extracted from `design/waseem-sports-video.html`

**Date:** 2026-10-06 · Source lines refer to the canonical file · Values below
are the **shipped dark theme** (`data-theme="dark"`, L2/L12), confirmed by
browser measurement. Light values are token-level (unreachable in the mockup —
re-measure when the real theme ships).

## 1. Ready-to-paste Tailwind v4 `@theme` block

```css
@import "tailwindcss";

@theme {
  /* Brand greens (canonical L10) */
  --color-pine-950: #062418; /* --g2: header-deep, toast bg, countdown pill */
  --color-pine-900: #0b3d2a; /* --g: header, primary buttons, chips-on */
  --color-pine-800: #0f4530; /* --t1: image fallback gradient start */
  --color-pine-700: #08251a; /* --t2: image fallback gradient end */

  /* Golds */
  --color-gold-600: #a98733; /* --au: announcement bar, buttons, borders */
  --color-gold-400: #c7a14a; /* --gl: logo accent, prices (dark), countdown text */

  /* Surfaces + text (dark, as shipped) */
  --color-surface: #0a100d;  /* --bg */
  --color-card: #121a16;     /* --card */
  --color-ink: #ecefe9;      /* --tx */
  --color-muted: #9aa89f;    /* --mut */
  --color-line: #22302a;     /* --ln */

  /* Ink-on-gold (buttons, badges, announcement) */
  --color-bronze-ink: #2a2000;

  /* Type */
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-sans: Manrope, system-ui, Arial, sans-serif;

  /* Radii (L30–74: 2px controls, 4px cards) */
  --radius-sm: 2px;
  --radius-md: 4px;

  /* Layout */
  --container-store: 1200px; /* main L37 */
}
```

## 2. Raw token table (with source lines + measured contrast)

### Colour

| Token | Value | Source | Used for | Contrast (as shipped) |
|---|---|---|---|---|
| `--g` | `#0b3d2a` | L10, header L30 | header bg, `.add`/`.btn.alt` bg, chip-on | white on it 12.24 ✓ |
| `--g2` | `#062418` | L10 | video fallback (L21), toast (L73), `.cd` pill | `#c7a14a` on it 6.77 ✓ |
| `--au` | `#a98733` | L10 | `.top` bar, `.btn`, `.cnt`, `.off`, focus ring (L28), header border | with `#2a2000` 4.75 ✓ (thin); **on `--g` 3.62 ✗ normal text — large/non-text only** |
| `--gl` | `#c7a14a` | L10 | logo `b`, prices (dark via `--prc`), `.cd` text | on `--g` 5.03 ✓ · on card 7.28 ✓ |
| `--prc` | `#0b3d2a` light / `#c7a14a` dark | L10–12 | price + `.btn.out` + `.up` | light: on `#f3f4f1` 11.09 ✓ |
| `--bg` | `#f3f4f1` light / `#0a100d` dark | L10–12 | page bg (transparent in dark — video shows through, L19) | ink on it 16.1–16.6 ✓ |
| `--card` | `#fff` / `#121a16` | L10–12 | cards, boxes, chips | name on dark card 15.26 ✓ |
| `--tx` | `#101a15` / `#ecefe9` | L10–12 | body text | on own bg 16.1–16.6 ✓ |
| `--mut` | `#5d6a62` / `#9aa89f` | L10–12 | `.sold`, kpi labels | dark 7.2–8.5 ✓ · light on white 5.67 ✓ |
| `--ln` | `#dcdfd8` / `#22302a` | L10–12 | borders, dividers, qty buttons | non-text |
| `--t1/--t2` | `#0f4530` / `#08251a` | L10 | `.img` fallback gradient behind photos (L55) | — |
| `#2a2000` / `#1a1305` | bronze inks | L29, L36/L58 | text on gold (`.top`, `.btn`, `.cnt`, `.off`) | 4.75 ✓ / 5.44 ✓ |
| `#fff` | white | L30 etc. | header/nav text, hero, slide copy, `.btn.alt` text | on `--g` 12.24 ✓ |

### Type scale (computed, 1440×900)

| Role | Spec | Source |
|---|---|---|
| Announcement | Manrope 600 14px / 21.7px, centred | L29 |
| Logo | Cormorant 700 28px / 30.8px, ls .1em; `b` in gold | L31 |
| Hero h1 | Cormorant 600 `clamp(38px,6vw,68px)` → 68px / 74.8px | L40 |
| Section h2 | Cormorant 600 32px / 35.2px | L51 |
| Product name | Manrope 600 15px / 23.25px | L60 |
| Price | Manrope 700 19px / 29.45px, `--prc` | L60 |
| Body | Manrope 400 16px / 1.55 | L18 |
| Muted | 13–14px `--mut` (`.sold` L60, kpi span L70) | L60/L70 |
| KPI value | Cormorant 600 36px | L69 |
| Table | 15px, th bold, row dividers | L71 |
| Inline overrides (became tokens, not scale) | PDP h1 44px / PDP price 34px / route titles 40px | L125–129 |

Headings + logo share `Cormorant Garamond, Georgia, serif` (L26); everything
else `Manrope, system-ui, Arial, sans-serif` (L18).

### Spacing / radii / shadows

- Radii: **2px** controls (search L32, chips L49, buttons L47, qty L66, pills
  L68) · **4px** cards/boxes/toast (L54, L64, L73). No pill radii anywhere.
- Container: `main` max-width **1200px**, 16px gutters (L37). Header `.bar`
  same 1200px (L31).
- Grid: `repeat(auto-fill, minmax(170px,1fr))`, 12px gap (L53) → 6 × ~185px
  tiles at 1440px. Trust row: `auto-fit, minmax(200px,1fr)` (L62).
- Hero slide: 36×32px padding, min-height 220px, 12px gap (L39); photo layer
  `opacity:.5` + green veil gradient (L43–46).
- Shadows: **none** — depth comes from 1px borders (`--ln`, `--au`) only.
- Focus: 3px `--au` outline, 2px offset (L28) — keep in the build.

## 3. Responsive / motion / accessibility rules (from L25/L76–77 + render)

- Breakpoint: single `@media (max-width:700px)` — two-col → one-col, tighter
  hero padding (L76). Mobile PDP sticky add-to-cart, bottom-sheet filters and
  44px targets are **build additions** (mockup qty buttons are 30px, L66 —
  below the 44px rule; fix in build).
- `prefers-reduced-motion`: video hidden (L25), transitions off (L77), hero
  auto-scroll skipped (L137). Keep all three.
- AA rule from measurement: `--au` text only large (≥24px or ≥18.66px bold)
  on greens, or bronze-ink on `--au`; announcement/`.btn` pass but with 0.25
  margin — do not lighten either side.

## 4. Component inventory → CMS section types

| Mockup block | Classes | CMS section type (proposed) | Owner-editable |
|---|---|---|---|
| Hero carousel | `.hero .slide` (+`S` data L117) | `hero` (slides: image, title, text, link) | yes |
| Category chips | `.cats .chip` | `category_tiles` | yes (which categories, order) |
| Product grids | `.sec h2` + `.grid .card` (+`.off` badge L58) | `product_grid` (title, link, product set / rule) | yes |
| Trust strip | `.trust` 4 cells | `promo_strip` | yes |
| Countdown promo | `.deal .cd` (dead in mockup) | `promo_countdown` | yes, if used |
| Header / footer / announcement | `.top`, `header`, `footer` | **not sections** — `store_settings` (`public.*`) | yes |
| PDP / cart / checkout / account / admin | routes, not content | code (DB-driven) | n/a |
