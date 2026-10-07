# PHASE 04 — Storefront
**Goal:** convert the HTML design to real, DB-driven pages. Depends on PHASE 03 data.
## Tasks
1. Layout: header (nav from visible sports/categories), footer, search box (real search now), mobile menu, cart drawer.
2. Pages: home (temporary hardcoded section composition using the section components — CMS wiring is PHASE 07), sport, category, brand, listing with filters (brand, attributes, price) + sort + pagination, product detail (gallery, variant picker updating price/availability/images, related products), search results, static-ish pages.
3. Cart: cookie/localStorage `[{variantId, qty}]`; server `priceCart()` returns authoritative lines, availability, subtotal; handles stale/removed/out-of-stock items with clear messages.
4. SEO: metadata, canonical, sitemap, robots, JSON-LD, filter param handling.
5. Performance: server components by default, `next/image` with proper `sizes`, DB indexes verified with EXPLAIN, pagination caps.
## Acceptance
- Variant selection updates displayed price; "add to cart" cannot carry a price. Tampering with cookie contents cannot change price.
- Product page hides attributes the product doesn't have. Out-of-stock variants are disabled with clear label (per D11).
- Lighthouse mobile pass on home/listing/PDP (report numbers, don't claim without measuring). Keyboard-only usable.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Canonical design:** `design/waseem-sports-video.html`. The three sibling designs in `design/unwanted-designs/` are superseded references — do not port anything from them.
- **Pre-step before any page:** extract the base64 photos out of the canonical HTML into real files, confirm each photo's product **by eye** (the arrays are positional), and upload them as `originals/`. Then run them through `specs/product-image-pipeline-spec.md`.
- **Products without photos render the neutral "no photo yet" block** — never a broken image, never a fake placeholder photo.
- **Image stack decision still open (IM-V6):** the grid must meet the spec's size budgets (`sm` ≤ 45 KB etc.). Decide at build time whether to use Next's image optimisation or serve the pre-made derivatives directly, based on whether GoDaddy's Cloudflare CDN caches optimiser output — test, don't assume.
- **Admin photo crop + baked-text detection (D20, owner requirement 2026-10-06):** the admin product page lets the owner crop product photos when adding a product, with a text-recognition step. Behaviour: auto-detect → auto-crop, owner can still adjust the crop; product photos only. OCR approach (browser-side vs server-side) is VERIFY V7 — prove dependency size, accuracy on the real extracted photos, and cost before building it. Failure mode: detection finds nothing → photo imports unchanged, crop stays fully manual.
- **Cannot be tested here — prove later:** grid uniformity and the baked-in-text removal only on the extracted real photos; Lighthouse numbers only on the deployed preview (PHASE 01 host), not localhost; Next-image/CDN behaviour only live.

## Execution record — 2026-10-07 (built + verified, UNCOMMITTED)
- **Pre-step:** 11 base64 JPEGs extracted to `.tmp/extracted/`, eye-confirmed via contact sheet (all positional matches), uploaded to `originals/design-extract-<slug>.jpg`. Mapping + VERIFY answers in `docs/EXTRACTED-PHOTOS.md`. IM-V1: NO baked-in text in any photo (prices are HTML-rendered) → OCR auto-detect deferred, crop ships manual-first. IM-V2/V7 answered. Limitation: `originals/` is not truly private (public bucket) — needs a private bucket, deferred.
- **Slices:** `lib/storefront/` (catalog queries, priceCart, cart-cookie split, money, images) → `(store)` route group: layout (header/search/nav/cart/mobile menu/footer/drawer) → home (hero, chips, best sellers, grid, trust) → shop/sport/category/brand/search listings (GET filters, sort, pagination) → PDP (gallery, variant picker, specs, related, JSON-LD) → static pages → full cart page → SEO (metadataBase, canonical, sitemap, robots) → D20 manual crop (CropEditor + `/api/admin/images/crop`, recipe→new immutable files).
- **Decisions:** IM-V6 interim = serve pre-made derivatives directly via plain `<img>` (no Next optimiser; CDN behaviour unverified). V7 verdict = tesseract.js 1.4MB + ~11MB runtime data, imgly 1.1MB + ~40–100MB model — both DEFERRED (no text to remove, cut-out opt-in later). EXPLAIN could not run (no SQL channel from this machine) — index coverage reviewed from migration; no new indexes (unjustified at this scale). PER_PAGE 24, page cap 50, cart lines 50, qty cap 100.
- **Proven:** `tsc` clean · eslint 0 errors · `next build` exit 0 (34 routes) · fixed 3 real issues found by checks (sort-helper typing, set-state-in-effect, server-only boundary split) · live server: / /shop /search /product×2 /cart /robots /sitemap → 200, bad sport → 404 · content: both demo products listed, shoe PDP shows UK 7/8/9 + OOS on UK 9 + related row, ball Rs 2,500 · screenshots eye-checked vs canonical design.
- **Not proven:** Lighthouse (deferred to preview deploy per amendment) · authenticated cart→checkout flow (Phase 05) · real-photo crop round-trip (needs owner upload) · keyboard-only walkthrough by a human (built to standard: labels, focus, aria, skip-needs-check).
- **Incidents:** stale `next dev` squatters on :3000 from an earlier session caused false 500s; killed PIDs 12220/5560/15188, removed `.next/dev` lock, fresh `server.js` then all-green. Lesson: check the port owner before trusting smoke results.
- **Git:** all Phase 04 files new/modified in working tree, NOT committed. Commit with Waseem-only paths on owner approval; never `git add -A`.
