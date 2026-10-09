# UX/UI Audit — Waseem Sports (customer + owner walk, top to bottom)

> Date: 2026-10-09. Method: live walk of the running app (dev server, real
> database) as both users — every storefront route + all 26 admin routes opened
> with a real owner session — plus code reads where a browser is required.
> This is a **UX/UI audit, not a code audit**: no logic was changed for it.
> Labels: **LIVE** = seen in the running app this session. **EYES** = needs a
> human with a browser/phone (could not be proven over HTTP).
> No secrets in this file. Nothing here edits data; the live database was only read.

## How it was checked

- Storefront: 20 routes curled live (`/` `/shop` `/search` `/track` `/account`
  `/wishlist` `/compare` `/cart` `/checkout` `/about` `/contact` `/faq` `/blog`
  `/blog/first-kit` `/store-locator` `/product/<slug>` `/sport/*`
  `/category/*` `/sitemap.xml` `/robots.xml`→`/robots.txt` `/api/search/index`,
  plus a missing URL). All 200 except the missing URL (correct 404).
  Every page carries an `<h1>`; anon `/admin/*` correctly 307-redirects.
- Admin: **26/26 routes render 200** with a real session (re-ran the project's
  own `admin-route-sweep` harness against the live server), and 14 screens read
  in full (dashboard, orders, products, inventory, sports, categories, brands,
  attributes, pages, shipping, transfers, notifications, both settings pages,
  new-product form).
- Deliberately NOT done (would write to the real database): placing an order,
  changing stock, archiving anything, sending messages. So checkout-with-items,
  the order lifecycle, stock math and toasts are **EYES**.

## A. Must fix / decide (owner attention)

1. **Test product `ManCaveHangers` is live in the shop. (LIVE)**
   Published, price LKR 1,354, zero stock, no photo (shows the "WS" fallback
   monogram), and it sits in the autocomplete index. Fixes §2.1 says remove it.
   It is database data, so it needs one click: `/admin/products` → its
   `Archive` button (two-step confirm), or delete it if it was never real.

2. **The published homepage still shows the old copy. (LIVE)**
   The page in the database wins over code defaults, so the live landing still
   says "Picked for you", still has the "Cash on delivery" trust strip, and all
   three hero "Shop now" buttons still go to `/shop`. The code now defaults to
   "New arrivals", per-sport hero links and no COD strip — but that only shows
   for fresh environments. Fix in the builder (`/admin/pages` → Home): rename
   the grid, repoint the three hero buttons (football / skating / fitness),
   and replace the trust strip with promises that are true today.

3. **FAQ quotes the seed delivery fees as fact. (LIVE)**
   "Colombo and suburbs — LKR 450", "Islandwide — LKR 700". Those are seed
   values the owner has not confirmed (D5). Either confirm them in
   `/admin/shipping` or soften the FAQ wording until the real rules are entered.

4. **Shipping page contradicts itself. (LIVE)**
   It says "Nothing is seeded, so enter your real delivery rules" — directly
   above two active seeded rules (Colombo 450 / Islandwide 700). Reword to:
   "Two starter rules are active — check them and replace with your real ones."

5. **Product breadcrumb links to `/category/*`. (LIVE)**
   The crumb under the product title points at the old category URL, which now
   307-redirects to the sport. One redirect hop on every product page and a
   confusing URL in between. Point the crumb at `/sport/<slug>` directly.

6. **Categories are hidden from the sidebar but still exist. (LIVE)**
   The new sidebar (Today/Catalog/Content/Setup) drops Categories per the
   merge plan — but `/admin/categories` still works, the product form still has
   a Category dropdown, and the storefront still redirects (not removes) the
   URLs. Until migration `0006` merges the tables, this halfway state will
   confuse: either keep a Categories link with a "merging soon" note, or do the
   migration now. Do not leave it half-hidden.

7. **Tracking by phone (Fixes §2.5) is deliberately not built.**
   Lookup stays order-number + tracking code. Phone-number lookup would let
   anyone enumerate orders by guessing numbers, so this needs an explicit owner
   call: keep the code (recommended) or accept the leak and build phone lookup.

## B. Storefront findings (customer)

- **Home (LIVE):** tiles hide Cricket/Tennis correctly (7 tiles); each stocked
  sport now has a Top-10 + "See all products" block (14 links found); tab bar
  has active-pill + scroll-snap; header Account → `/account`, cart badge with
  "Open cart, empty" label. Meta description still says "Cash on delivery" —
  honest, keep.
- **Empty sports (LIVE):** `/sport/cricket` and `/sport/tennis` 307 to
  `/shop?empty=<sport>` with the "has no products yet — showing everything
  instead" note. Footer still links the empty sports; the redirect + note make
  that acceptable, not broken.
- **Category URLs (LIVE):** `/category/football` 307 → `/sport/football`.
  Sitemap no longer lists `/category/*` (0 found). Search-page taxonomy chips
  still link `/category/*` — harmless (they redirect) but should link sports
  directly (same one-hop issue as B5).
- **Search (LIVE + EYES):** index API returns 12 items incl. brand/sport/SKU
  facets; "yonex" finds the racket; typo "footbal" matches server-side (it is a
  prefix of "football" — lucky, not fuzzy). True transpositions ("fotball")
  depend on the new Fuse.js dropdown, which needs **EYES**: type-ahead,
  thumbnails, arrow/Enter/Esc and the no-results suggestions were code-reviewed
  only. The ManCaveHangers row appears in suggestions (goes away with A1).
- **Product page (LIVE + EYES):** stock line ("In stock" / "Only N left" /
  "Out of stock"), delivery note and WhatsApp "Ask about this product" button
  all render; related grid renders; gallery thumbs now carry sizes. Recently
  viewed is client-only (renders after hydration) — **EYES**.
- **Cart/checkout (LIVE, empty-cart only):** empty states read well
  ("Your cart is empty", "Checkout" with guidance). Checkout *with items*,
  payment-method choice, order placement, confirmation and `/track` lookup were
  **not exercised** (real database) — **EYES**, highest priority before launch.
- **Account/wishlist/compare (LIVE):** empty states are plain-language and
  device-local honesty is stated ("kept here on this device — no account
  needed"). Compare toggle now sits on every card next to Save. With saved
  items present was not checked — **EYES** (needs a browser with localStorage).
- **Content pages (LIVE):** about/contact/faq/blog/store-locator all render;
  `tel:`/`wa.me` links dial correctly (`tel:0770090147`, `wa.me/94770090147`);
  store-locator has a directions link. Blog post renders. No obvious gaps.
- **404 (LIVE):** correct 404 status with shop + home + tracking links.

## C. Admin findings (owner)

- **Sidebar (LIVE):** grouping + plain Setup names + one-line help all render;
  header says "Owner" (no more "Signed in with the admin password"); mobile
  shows a Menu button. Active-highlight and the open Menu state need **EYES**.
- **Dashboard (LIVE):** urgent-first block works — live data shows "1 product
  out of stock" with a plain-words reason; quick actions present; tiles
  explained; duplicate catalog cards gone. Pending-transfer count wired (0
  shown; unverified with a real pending row — **EYES**).
- **Products (LIVE):** list shows photo/name/sport/brand/price/stock/status
  with status filter — but still **no** "Missing photo" filter, **no** instant
  debounced search (filter form needs Apply + page reload), and Archive sits
  inline per row (no "..." menu). The new-product form is one long page: name,
  slug (still between the steps, unnumbered), sport, category, brand,
  description, price, was-price, status, featured, SEO in the open (not an
  "Advanced" section). Matches Fixes §3.3 only in part — the rest is open.
- **Inventory (LIVE):** "Live stock per variant. Available = on hand −
  reserved" is stated; low-stock filter exists; states render. Still **no**
  inline +/−, **no** Low/Out badge treatment beyond text, **no** stock-history
  link per variant (§3.5 open).
- **Orders (LIVE, zero orders):** filters + plain-language intro read well, but
  with no live orders nothing else could be checked: "Needs action" chip, CSV
  export, packing-slip print, one-tap WhatsApp, and total+method in the row are
  all **unverified/open** (§3.6). Place a real test order + cancel it before
  launch (**EYES**).
- **Transfers (LIVE):** safety copy is good ("no funds leave the shop" until a
  provider is verified); approve/reject flow lives on the detail screen, which
  had no rows to open — **EYES** (§3.7 partly open).
- **Pages (LIVE):** page list + "Build sections" is clear; blog-as-pages
  explained. Builder itself (reorder/hide/edit, toasts) was verified by earlier
  sessions; re-verify the two copy edits from A2 after making them.
- **Notifications/WhatsApp/Image-search (LIVE):** disabled states are honest
  ("Not configured is normal, not an error"). No gaps found for a
  pre-provider state.
- **Feedback & safety (mostly EYES):** success toast after save,
  unsaved-changes warning, and error-copy quality need a browser walkthrough of
  add-product / update-stock / confirm-order. No evidence they exist — assume
  open (§3.10).
- **Plain language (§3.9, LIVE):** slug has a hint ("Storefront URL…"); variant
  creation is explained ("A hidden default variant…"); but Variant, Attribute,
  Reserved and the inventory states have no tooltips/hints. Small copy pass
  still owed. Buttons already say Save/Publish/Archive/Restore (no "Submit"
  found).
- **Login (LIVE, one careful look):** single password field, autofocus,
  back-to-store link, generic "Incorrect password" copy, rate-limited
  (10/15 min, code). Correctly NOT brute-tested. The 5-digit local password is
  fine for dev; launch needs the long random value per the pre-launch list.

## D. Mobile & accessibility (EYES — nothing below was seen on a device)

CSS guards added this session (no-horizontal-scroll, 44px targets, sticky
buy-bar, bottom-sheet filters, safe-area). Still must be eyeballed: 360/390/412
widths, one-hand reach, sticky bar overlapping content, bottom sheet with the
keyboard open, bank-transfer/checkout forms with the keyboard open, focus
visibility + full keyboard traversal, and a Lighthouse mobile pass before/after
(the brief's §4 checklist). Admin tables (inventory page is ~90KB with wide
rows) need a horizontal-scroll check on a phone.

## E. Suggested order of work

1. Owner clicks (no code): A1 archive test product → A2 homepage copy/links →
   A3/A4 delivery fees + shipping copy.
2. Small code: A5 breadcrumb + category-chip links to `/sport/*` (kill the
   redirect hops).
3. Decide: A6 categories migration now or restore the nav link; A7 phone
   tracking.
4. Finish open Fixes items in brief order: §3.3 product form → §3.4 migration →
   §3.5 inventory → §3.6 orders → §3.7 transfers → §3.8–3.11 feedback/safety →
   §3.12 additions → §6 card payments.
5. Pre-launch **EYES** pass: full test order (place → confirm → ship → deliver
   → cancel path on a second order), toasts/errors, phones at 360/390/412,
   keyboard-only run, Lighthouse, backup-restore rehearsal.

## F. What was NOT audited

Live order placement/cancellation (writes to the real DB), anything needing
two sessions (pairing, webhooks, cron), WhatsApp delivery (no provider/VPS),
backups, GoDaddy-served headers/CSP, and performance beyond static image sizes.
