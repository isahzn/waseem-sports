# Design

**Source of truth:** `design/waseem-sports-video.html` (canonical — owner decision 2026-10-06; the other designs are archived under `design/unwanted-designs/`). Preserve its look; convert to components. Don't redesign from zero. Extracted tokens live in `docs/DESIGN-TOKENS.md`; the full audit in `docs/AUDIT.md`.

## Brand direction (from client feedback)
- Premium sports retailer. Darker green + darker gold. Strong typography (heading/body pairing chosen in PHASE 00 from what the HTML uses; improve if weak).
- Product photography leads. No emojis in product visuals. Nothing cartoonish. No blue/purple "AI" gradients, glassmorphism, neon, fake stats, giant 3D.
- Dense, easy click-to-order product grids (Temu-like convenience) but restrained and credible.
- Purposeful motion only (hover/press feedback, drawer transitions, skeleton loading). Respect `prefers-reduced-motion`.

## Conversion plan (PHASE 00 output -> `docs/DESIGN-TOKENS.md`)

**Status 2026-10-07: done.** The storefront is built from this design as a verbatim port — `src/app/design.css` is the mockup's own stylesheet, scoped under `.ws` and imported after Tailwind — with the admin area left on Tailwind only. A headless-Chrome diff compares the mockup and the built site across 6 routes (262 computed properties, 0 divergent selectors). The steps below are kept as the plan that was executed.
1. Extract colors, fonts, spacing, radii, shadows from the HTML into Tailwind theme tokens (CSS variables).
2. List every repeated block in the HTML -> component (Header, Footer, ProductCard, Hero, CategoryTile, PromoBanner, BrandStrip, ...). Map each to a CMS section type where the owner should control it.
3. Replace hardcoded product/category text with DB-driven props. Product photos -> Storage via import script; crop baked-in price overlays first.
4. Admin: functional, table-first, mobile usable (drawer nav, stacked forms, 44px touch targets). **As built (2026-10-07):** the admin is Tailwind-only and works on a phone, but not exactly as listed — the sidebar becomes a **wrapping nav** above the content rather than a drawer, tables scroll horizontally instead of reflowing, and controls are `py-2` on 14px text (roughly 36px), **below this file's 44px guidance and not re-measured**. Treat 44px in the admin as an open item, not a shipped guarantee. The storefront's single deliberate exception is the 30px quantity stepper below.

## Accessibility & mobile
Semantic HTML, labels, visible focus, AA contrast — measured 2026-10-06 (`docs/AUDIT.md` §6): everything in the shipped dark theme passes, EXCEPT `--au` gold `#a98733` on greens (`3.62` on `#0b3d2a`) which is large-text/non-text only. Never set body-size `--au` text on green. Alt text authored by owner (fallback to product name only if empty), keyboard-operable variant picker and drawers, touch targets >= 44px (with one deliberate exception — see below), mobile-first filters (bottom sheet), sticky add-to-cart on mobile PDP.

### Replica vs. touch targets (2026-10-07) — a deliberate exception

The mockup's quantity-stepper buttons are 30px, and this note originally said to fix them to 44px in the build. **They are still 30px.** The owner's overriding requirement was a 1:1 replica of `design/waseem-sports-video.html`, so the shipped storefront keeps the design's `.q button` exactly, and the computed-style diff asserts those six properties are identical to the mockup. It is the one place where replica fidelity was chosen over this file's touch-target guidance: recorded rather than overlooked, and a candidate fix if the owner ever prefers usability to exactness. Nothing else in the accessibility list above was dropped.
