# AUDIT — Phase 00 (design + package + data-layer findings)

**Date:** 2026-10-06 · **Canonical design:** `design/waseem-sports-video.html`
(141 lines, CRLF, 4,669,155 bytes) · **Rendered in:** headless Chrome
1440×900, desktop only · **Method:** CDP measurement harness
(`.tmp/audit/measure.mjs`, gitignored scratch) + static forensics (checksums,
base64 decode). Every claim below carries a file + line. Screenshots were not
saved (owner decision 4.11).

> **Status 2026-10-07 — read this as a Phase 00 measurement record.** Later
> phases acted on its "must be built" findings: the 11 photos were extracted and
> seeded into the catalogue (`docs/EXTRACTED-PHOTOS.md`, `scripts/seed-demo.mjs`),
> `Logo.png` and `Background.mp4` are wired in from `public/assets/`, and the
> storefront is now built to the mockup — a verbatim port of its stylesheet,
> measured against it route by route. The mockup's fake or broken interactions
> in §5 (readonly search, in-memory cart, fabricated order numbers, the dead
> countdown, the invented admin figures) were replaced by real ones, and §7's
> conflicts are resolved as recorded in `docs/DECISIONS.md` — including that
> payments stay COD-only until a provider is chosen (D3). The measurements
> below are unchanged.

## 1. The four designs and why C is canonical

| # | File(s) | Palette / type | Scope | Verdict |
|---|---|---|---|---|
| A | `unwanted-designs/legacy-claude-demo/Waseem Sports — claude Demo.html` (158 L) + `.bak` (152 L) | cream `#f3ecdc`, green `#0f3b26`, gold `#b8923a`; Barlow Condensed + Inter | full commerce SPA demo | superseded |
| B | `unwanted-designs/legacy-waseem-sports/waseem-sports.html` (124 L) | grey `#f3f4f1`, green `#0b3d2a`, gold `#a98733`/`#c7a14a`; Cormorant Garamond + Manrope | same commerce breadth | superseded — same design as C minus hero |
| **C** | **`design/waseem-sports-video.html`** (141 L) | same tokens/type as B | B + inlined background video + photo hero layer, permanently dark (`<html … data-theme="dark">`, L2) | **canonical — owner decision 2026-10-06** |
| D | `unwanted-designs/another-design/` (Vite + React 19.2.6 + Tailwind 4.1.17; `src/` + 672-line standalone `waseem-sports.html`) | ink `#0b1d12`, ember `#e9b32c`; Anton + Archivo + Space Mono | brand brochure, no cart/PDP/checkout | superseded, not a component source |

Two different files were both named `waseem-sports.html` (B and D's
standalone) — hence the archive uses subfolders. Nothing was deleted.

## 2. Canonical file — section / component inventory

Shell (static markup): `#bg-video` backdrop L91–94 · announcement `.top` L95 ·
`header > .bar` L96–100 (logo L97, readonly search L98, `nav#nav` L99) ·
`main#app` L101 (all routes render here) · `footer` L102 · `#toast` L103.

Routes (JS templates, `pages = {…}`, L118–131; router `render()` L134,
`hashchange` L135):

| Route | Builder (line) | Blocks |
|---|---|---|
| `#/` home | `home()` L119–121 | `.hero` carousel (3 slides from `S`, L117) · `.cats` chips (from `CATS`, L107) · `Best sellers` grid (hardcoded indices `[2,7,4,5,8]`, L122) · `Picked for you` grid (all 11, L122) · `.trust` 4-cell row (L121) |
| `#/shop` | `shop()` L122 | category chip filter (`cat` global, L108) · `.grid` of `card(i)` L110 |
| `#/product/:i` | `product(i)` L125 | back link · large image · h1 (inline 44px) · category · price (inline 34px) · variant chips (from `P[i][5]`, L106) · Add / Buy now · `You may also like` (hardcoded `[2,4,5,7]`) |
| `#/cart` | `cart()` L126 | line rows (56px thumb, qty steppers) · Summary box (subtotal / delivery / total) |
| `#/checkout` | `checkout()` L127 | 5 bare-label fields (name, phone, email, address, payment incl. Card + Bank transfer) · order total · `Place order` → `place()` L133 |
| `#/account` | `account()` L128 | seeded `orders` L108 (`#WS1045`–`#WS1048`) with `.steps` tracker (`ST`, L107) |
| `#/admin` | `admin()` L129–131 | 4 KPI cards (fictional) · SVG 7-day sales chart (data `D`, L129) · Top products (`[124,98,76,61] sold`) · orders table with status `<select>` |

Repeated components → CMS section types (full token map in
`docs/DESIGN-TOKENS.md` §4): `hero` (.hero/.slide) · `category_tiles` (.cats)
· `product_grid` (.grid/.card, used by Best sellers / Picked / Shop / PDP) ·
`promo_strip` (.trust) · `promo_countdown` (.deal/.cd — CSS only, never
rendered, see §5) · header/footer (settings-driven, not CMS sections).

## 3. Hardcoded business data (all invented — none is a seed source)

- Announcement bar L95: `Free delivery over LKR 10,000 · Cash on delivery islandwide`.
- Delivery rule L126: `total()>=10000 ? 'Free' : f(450)` (subtotal + total recomputed inline).
- Trust row L121: `Free delivery over LKR 10,000 / Cash on delivery / 7-day easy returns / SMS and email order updates`.
- Money L108: `f = n => 'LKR ' + n.toLocaleString('en-US')` — currency + format inline, not from `store.currency`.
- Orders L108: `#WS1045…#WS1048` with amounts/statuses/`Today|Yesterday`.
- Admin L129–131: `LKR 96,400`, `orders.length+38` (= 42), `3.4%`, `6`, chart `D=[42,58,51,73,66,89,96]`, top-sold `[124,98,76,61]`.
- Statuses `ST=['Processing','Packed','Shipped','Delivered']` L107 — contradict
  the `order_status` enum (`new,confirmed,processing,shipped,delivered,…`).
- Taxonomy L106–107: categories derived from products (`Accessories, Swimming,
  Football, Badminton, Basketball, Fitness, Skating`); variant dimensions
  (`Pack, Colour, Size, Weight` + option lists) hardcoded per product.
- Product table `P` L106 (11 rows): name, LKR price, category, unit suffix
  (` /kg`), option-dimension, options. No SKU, no stock, no slug.

## 4. Images and their form

- `IM` array L104: **11 JPEG data-URIs**, 279,382 bytes decoded (6.8–41.5 KB
  each); sample rendered dims 404×413 / 520×286 / 449×520. Photo→product
  mapping is positional (`IM[i]` ↔ `P[i]`) — eye-confirm in PHASE 04.
- Hero slides reuse `IM[5]`, `IM[1]`, `IM[6]` as photo layers (L119) under a
  green veil (CSS L44–46).
- Hero video L92: one base64 MP4 line (4,278,348 chars), **3,208,672 bytes
  decoded = 68.7% of the file**; renders 1024×768, `readyState` 4 (plays).
- Provenance: decoded bytes contain C2PA `c2pa` boxes **and the string
  `pixverse`** — AI-generated clip (PixVerse). Kept per owner decision;
  revisit only with facts.
- `design/Background.mp4` (3,208,672 bytes) is **md5-identical** to the inlined
  video (`b7a3c126f3d2b8d64d187e214fb25a8f`) — same clip, not a second asset.
  **Confirmed the wanted hero** (owner, 2026-10-06); PHASE 04 serves it as a file.
- `design/Logo.png` (1448×1086 PNG, 1,253,967 bytes) is referenced by **no**
  file — **confirmed the real brand logo** (owner, 2026-10-06); PHASE 04 wires it into the header.

## 5. Interactions — what works in the mockup, what is broken/fake

Works: hash routing (all 7 routes render, zero JS errors in Chrome); nav
active state `nav()` L116; cart add/qty (in-memory `cart`, L108–115);
category filter; PDP variant chip toggle (visual only); hero auto-advance
4.5 s L137 (skipped under reduced-motion — good); admin status `<select>`
mutates the in-memory row.

Broken or fake (do not carry into the build):
- Search is `readonly` and self-labelled `(search goes live in the demo)` (L98;
  measured `readOnly: true`).
- `Sort and filters connect to the database later` — no sort control exists (L122).
- No stock check on `add()`; cart/orders live in JS memory (lost on refresh).
- `place()` L133 fabricates `#WS<1049+n>`, always status index 0, clears the
  cart, toasts **`Order placed. SMS and email sent.`** — nothing is sent.
- Dead code: `.deal`/`.cd` CSS L52 + countdown timer L136, but **no `#cd`
  element is rendered anywhere** (measured `countdownElPresent: false`).
- PDP/admin inline `style="font-size:…"` (44px h1, 34px price, 40px route
  titles) bypass the type scale — became tokens in DESIGN-TOKENS.md.

## 6. Accessibility gaps (measured + static)

- Cart thumbnails `alt=""` (L126); PDP/hero images use the product name (good).
- Checkout L127: bare `<label>` with no `for`/`id`, inputs have **no `name`**
  attributes — rebuild as a real form.
- Toast L103/L73: `role="status"` **without `aria-live`** — add it in the build.
- Good: `:focus-visible` 3px gold outline (L28); qty buttons have
  `aria-label`s (L126); chart `<svg role="img" aria-label="Bar chart…">`
  (L130); `#bg-video` hidden under `prefers-reduced-motion` (L25) and
  transitions killed (L77).
- Contrast (desktop Chrome 1440×900, dark theme as shipped; AA normal ≥ 4.5,
  large ≥ 3.0):

| Pair | Ratio | Verdict |
|---|---|---|
| announcement `#2a2000` on `#a98733` (14px/600) | **4.75** | PASS, thin margin — keep semibold+ or darken text |
| header nav white on `#0b3d2a` | 12.24 | PASS |
| logo gold `#c7a14a` on `#0b3d2a` (28px/700, large) | 5.03 | PASS |
| `.btn` `#2a2000` on `#a98733` (16px/600) | 4.75 | PASS, thin margin |
| price `#c7a14a` on card `#121a16` (19px/700) | 7.28 | PASS |
| name `#ecefe9` on `#121a16` | 15.26 | PASS |
| muted `#9aa89f` on page (13px, PDP) | 8.48 | PASS |
| checkout input `#ecefe9` on `#0a100d` | 16.55 | PASS |
| KPI value (36px) / table th+td | 15.26–18.09 | PASS |
| **`#a98733` on `#0b3d2a`** (the DESIGN.md risk pair) | **3.62** | FAILS normal text; passes large (≥3.0) and non-text (focus ring, borders). **Build rule: never set `--au` body-size text on `--g`.** |
| `#a98733` on `#0f4530` | 3.24 | same rule |

- Light theme is unreachable in this file (`data-theme="dark"` hardcoded, L2):
  light pairs above are computed from token values, not measured — re-measure
  when the real theme ships.

## 7. Conflicts with ARCHITECTURE.md / DATABASE.md

- Statuses, tracking, idempotency: mockup has none of the order machinery
  (token hash, idempotency key, `order_status_history`) — all must be built,
  none inferred from the mockup.
- Pricing: mockup prices client-side from `P`; architecture recomputes
  server-side from `product_variants` (`coalesce(variant.price,
  product.base_price)`). The ` /kg` suffix (Hex Dumbbell) becomes a
  unit/attribute row, not a price string.
- Payments: mockup offers Card + Bank transfer; build is **COD-only until a
  provider is chosen AND docs verified** (DECISION D3).
- Shipping: inline `10000/450` literals vs `shipping_rules` table — the
  literals are invented (DECISION D5); seed none.
- Auth/admin: mockup admin is an open route; build gates every admin action
  with `requireAdmin()` + RLS.

## 8. Browser-render results (spec §7.1 — all captured)

- Type roles (computed): announcement Manrope 600 14px/21.7px · logo Cormorant
  700 28px/30.8px, ls 2.8px · hero h1 Cormorant 600 clamp→**68px**/74.8px ·
  section h2 Cormorant 600 32px/35.2px · product name Manrope 600 15px/23.25px ·
  price Manrope 700 19px/29.45px · body Manrope 400 16px/24.8px. Webfonts
  loaded (`document.fonts.check` true for both families).
- Colours: dark-theme variable set confirmed as painted (`--bg #0a100d`,
  `--card #121a16`, `--tx #ecefe9`, `--prc #c7a14a`, header `#0b3d2a`).
- Routes: all 7 render; `home` 647k chars (base64 imgs inline), `shop` 377k,
  `product/0` 185k, `cart` 35k (seeded 1 item), `checkout` 603 chars,
  `account` seeded orders, `admin` KPIs; **zero JS errors**.
- Video: mounts, `readyState` 4, 1024×768; `prefers-reduced-motion` did not
  match in the test env (media-not-matched) so the CSS hide path is
  code-reviewed only.
- Layout: `main` max-width **1200px**; grid `minmax(170px,1fr)` → 6× ~185px
  tiles at 1440px; card radius **4px**; paddings/radii tokenised in
  DESIGN-TOKENS.md.
- Raw captures (not committed): `.tmp/audit/render.json`, `render2.json`
  (gitignored scratch; regenerate with `node .tmp/audit/measure.mjs`).

## 9. Handoff-package defects fixed in this phase

F4.1 `design/README.md` missing → written. F4.2 no project `.gitignore` →
written (re-includes `.env.example`, ignores `.tmp/`,
`design/unwanted-designs/`). F4.3 `AGENTS.md` H1 → fixed. F4.4 unreferenced
`Background.mp4`/`Logo.png` → proven same-clip / unreferenced, both VERIFY
V8. F4.5 `seed.dev.sql`/`supabase/tests/` referenced but missing → references
corrected (see DATABASE.md/FOLDER_STRUCTURE.md). F4.7 `node_modules` in
archive → gitignored, kept local. F4.8 space/em-dash filenames → quoted moves,
verified by checksum. F4.9 empty `.tmp/audit/` → now the ignored scratch dir
for this audit's harness. F4.10 no project `skills/` → decided: use
workspace-root skills (DECISIONS.md).
