# Design

**Source of truth:** `design/waseem-sports-video.html` (canonical — owner decision 2026-10-06; the other designs are archived under `design/unwanted-designs/`). Preserve its look; convert to components. Don't redesign from zero. Extracted tokens live in `docs/DESIGN-TOKENS.md`; the full audit in `docs/AUDIT.md`.

## Brand direction (from client feedback)
- Premium sports retailer. Darker green + darker gold. Strong typography (heading/body pairing chosen in PHASE 00 from what the HTML uses; improve if weak).
- Product photography leads. No emojis in product visuals. Nothing cartoonish. No blue/purple "AI" gradients, glassmorphism, neon, fake stats, giant 3D.
- Dense, easy click-to-order product grids (Temu-like convenience) but restrained and credible.
- Purposeful motion only (hover/press feedback, drawer transitions, skeleton loading). Respect `prefers-reduced-motion`.

## Conversion plan (PHASE 00 output -> `docs/DESIGN-TOKENS.md`)
1. Extract colors, fonts, spacing, radii, shadows from the HTML into Tailwind theme tokens (CSS variables).
2. List every repeated block in the HTML -> component (Header, Footer, ProductCard, Hero, CategoryTile, PromoBanner, BrandStrip, ...). Map each to a CMS section type where the owner should control it.
3. Replace hardcoded product/category text with DB-driven props. Product photos -> Storage via import script; crop baked-in price overlays first.
4. Admin: functional, table-first, mobile usable (drawer nav, stacked forms, 44px touch targets).

## Accessibility & mobile
Semantic HTML, labels, visible focus, AA contrast — measured 2026-10-06 (`docs/AUDIT.md` §6): everything in the shipped dark theme passes, EXCEPT `--au` gold `#a98733` on greens (`3.62` on `#0b3d2a`) which is large-text/non-text only. Never set body-size `--au` text on green. Alt text authored by owner (fallback to product name only if empty), keyboard-operable variant picker and drawers, touch targets >= 44px (mockup qty buttons are 30px — fix in build), mobile-first filters (bottom sheet), sticky add-to-cart on mobile PDP.
