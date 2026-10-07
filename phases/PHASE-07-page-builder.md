# PHASE 07 — Homepage & page builder (CMS sections)
## Tasks
1. Section registry: for each type -> zod schema, renderer component (shared by live + preview), editor form. Start with: hero, featured_sports, featured_products, promo_banner, brand_showcase, product_grid, image_text, testimonials, custom_content (markdown, sanitized).
2. Admin: pages list; page editor with add/duplicate/hide/delete/reorder (up/down buttons first; drag-and-drop optional, must have keyboard/touch alternative); product/sport pickers; image picker from Storage; save draft; preview (renders `draft_content` behind admin auth, noindex); publish (`draft_content -> content` via SQL function); status draft/published/archived.
3. Route `/[...slug]` renders published CMS pages; `/` renders page `home` (fallback if none). Predefined layouts (Sport landing, Category landing, Promo landing, Brand showcase) as page templates that pre-create sections.
4. Migrate PHASE 04 hardcoded home composition to the `home` page data (seed it).
## Acceptance
- Owner creates "Special Offers" page and reorders homepage with no deploy. Unpublished edits invisible publicly. Script/HTML injection in any text field renders as text. No TS file generated per page.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **The registry's starting section types come from the canonical design** (`design/waseem-sports-video.html`) via the component map in `docs/DESIGN-TOKENS.md` (hero, promo, category rail, product grid, …). Do not invent types the design never had.
- **The hero section must cover the canonical hero**, which uses an autoplaying background video with a dark veil. Rebuilding that as a CMS component has performance implications (page weight, `prefers-reduced-motion`, mobile data) — keep it behind the section's own toggle and measure the result; do not autoplay blindly on every page.
- **Cannot be tested here — prove later:** preview fidelity only counts in a browser (rendered Draft vs rendered Live must match pixel-for-pixel); XSS acceptance only against real injection strings in every text field.

## Execution record — 2026-10-07 (design replica + full multi-page front end + separate /admin + CMS landing builder)

**How this session relates to the plan above.** The owner redirected the order mid-build: instead of finishing PHASE 06 and then starting this phase, they asked for the whole **front end** first — *"make the full front end design, make the admin page all separate, make it multi page, let me customise what should be shown on the landing page, only the front end"*. So this record covers the **front-end/CMS half of PHASE 07** (tasks 2–4 and the rendering half of task 1) plus the storefront work item 3 needs. **PHASE 06 (notifications) is still unstarted and still the next MVP obligation** — nothing here touches it. The section-type list built differs from the received task list (see below); the design, not the task list, was the source of types, per this file's own amendment.

### 1. The design replica (the owner's "exact same thing")

- `src/app/design.css` is a **verbatim port of the canonical mockup's `<style>`** (`design/waseem-sports-video.html`), every rule scoped under `.ws`, imported by `globals.css` *after* Tailwind so its unlayered rules win inside the storefront. Only three deliberate additions: brand tokens/type/focus-ring globals, the restored UA heading sizes + `p` margins Tailwind's preflight zeroes, and (see §5) `.sec h1` alongside `.sec h2`.
- `(store)/layout.tsx` renders the `.ws` root and the fixed `#bg-video` layer (`/assets/bg.mp4` + `.scrim`), hidden under `prefers-reduced-motion`. Fonts (Cormorant Garamond + Manrope) load from `layout.tsx`; `data-theme="dark"` is set there.
- Rebuilt to the design: header (announcement bar, logo, search, nav, cart count), hero carousel (scroll-snap, 4.5 s auto-advance), product cards, listing pages, PDP (variant chips, quantity stepper, Buy now), cart + drawer, checkout, order tracking, footer.
- Assets live in `public/assets/` (`bg.mp4`, `logo.png`, copied from `design/`); `public/assets/` was empty before this session.

### 2. The full multi-page front end

New storefront routes beside the Phase 04/05 set: `/account` (order history + device-local guest-order memory, `lib/storefront/order-memory.ts`), `/about`, `/contact`, `/faq`, `/store-locator`, `/blog` + `/blog/[slug]` (journal posts = CMS pages under the `blog/` slug), `/wishlist` (`lib/storefront/saved-items.ts` + `SaveButton` on cards), `/compare`, `(store)/not-found.tsx`. Every page is server-rendered per route (not a client-side SPA); only genuinely interactive parts are client components (variants, quantity, cart drawer, countdown, hero, wishlist/compare views).

### 3. Admin as its own area behind a password

`/admin/*` answers **307 → `/admin/login`** when signed out (proven for `/admin`, `/admin/pages`). `src/app/admin/layout.tsx` is now a distinct admin shell — grouped sidebar (Overview / Catalog / Content / Setup, incl. "Pages & landing" and the new-orders badge), its own header, 403 panel, logout — not the storefront chrome. Tailwind still governs `/admin`; the storefront's design CSS is scoped to `.ws` so it does not restyle admin screens. **Found by probing `/admin/login` and fixed:** the display-font rule (`h1`–`h3`/`.logo` → Cormorant Garamond) was still global, and because `design.css` is unlayered it beat *every* Tailwind utility in the admin area — the sign-in heading computed to Cormorant, and no admin class could have overridden that. It is now scoped to `.ws`: admin headings are Manrope again and the admin area can style its own type, while the storefront is measurably unaffected (the diff still reports 0 divergent selectors). Still global deliberately, and safe because Tailwind's preflight already provides equivalents: the brand tokens, `a`/`button` resets, the dark `body` surface and the gold focus ring.

### 4. The CMS landing builder (task 2 + rendering half of task 1)

- `src/lib/cms/sections.ts` — zod schema, `parseSectionContent`, `defaultContent`, `sectionSummary`, `contentFromForm`, `toLocalInput` for each section type. **Types built (from the canonical design):** `hero`, `category_tiles`, `product_grid`, `promo_strip`, `promo_countdown`, `rich_text` — *not* the received list (`featured_sports` / `testimonials` / …), because the amendment above requires the design's own composition and forbids inventing types the design never had.
- `src/lib/cms/pages.ts` — `getLandingSections`, `getPageWithSections`, `listPages`, `defaultLandingSections`, `LANDING_SLUG = "home"`.
- Rendering: `(store)/page.tsx` renders the published `home` page's sections through `(store)/_components/SectionList.tsx` (per-type server renderers + `Countdown`), falling back to the design's default composition when the page has no sections — so an un-configured or broken CMS can never blank the landing page.
- Admin builder: `src/app/admin/(catalog)/pages/{page.tsx,[id]/page.tsx,[id]/SectionFields.tsx,actions.ts}` — page list with landing setup + create, then add / edit / reorder (up-down) / hide / delete sections, per-type field sets, page details and status. Every action goes through `requireAdmin()` + zod + `writeAudit`, and redirects with `?ok=` / `?error=`. **Publishing = the page's `status`** (`published` is what `getPublishedSections` reads), so unpublished edits are invisible publicly. Content lives in live `content` jsonb (not `draft_content` → publish function), which is the deviation from task 2 to note: the phase's draft/publish function pair was not built; RLS ("public read pages"/"public read sections", admin writes via the generated `admin all` policy) plus `status` carry the visibility rule.

### 5. Verification (all re-run on the final tree)

| Check | Result |
|---|---|
| `npm run typecheck` | **0 errors** (one stale generated `.next/dev/types/routes.d.ts` from the killed dev server had to be cleared — build artifact, not source) |
| `npm run lint` | **0 errors**, 5 pre-existing warnings |
| `next build` | **exit 0**, 56 app-route entries in `.next/server/app-paths-manifest.json`, 7 prerendered |
| Design replica diff (`.tmp/design/replica-diff.mjs`) | **73/73 checks · 262 computed properties across 6 routes · 0 selectors diverged** — mockup and built storefront measured in the same headless Chrome at the same viewport |
| Route + gate walk (`.tmp/design/walk.mjs`) | **35/35** — 20 routes render their expected markers with the backdrop video playing, every route carries an `<h1>`, `/admin` and `/admin/pages` both redirect to the password screen, which shows a password field |
| Admin-surface probe (`.tmp/design/admin-probe.mjs`) | **OK** — `/admin/login` is outside `.ws`, its body *and* heading compute to Manrope (no display-font leak, so the admin can style its own headings), the password field is present |
| Direct HTTP check | `/shop` serves `<h1>All products</h1>` |

**Defect found and fixed while verifying:** the listing routes (`/shop`, `/category/*`, `/sport/*`, `/brand/*`, `/search`) rendered **no `h1` at all** — they reused the mockup's page title as `.sec h2`, because the mockup's demo `shop()` never had a heading. The title is now an `<h1>` with `.sec h1` added to the design rule (identical declarations), so the semantics are right and the computed styles are unchanged — the diff harness now compares the app's `.sec h1` against the mockup's `.sec h2` and reports identical font-size/weight/family. The walk asserts `≥1` `<h1>` on every route so this cannot regress.

**Known benign noise:** React error #418 on some routes — Next's own `<next-route-announcer>` is appended to `<body>` after hydration; proven framework-side (server `<main>` byte-identical, the announcer is the only structural difference in `<body>`) and filtered in the walk.

### 6. Not proven here (do not report as done)

- **No admin click-through.** No admin account exists (DEPLOYMENT.md setup step 2 is still pending), so §3's shell, the builder (§4) and the interior admin screens are **typechecked and built only — never rendered with a session**. No page has been created, edited, reordered or published through the UI. Preview/publish fidelity is exactly the acceptance item this file already deferred to a browser.
- The owner's acceptance sentence ("owner creates 'Special Offers' page and reorders homepage with no deploy") is therefore **unproven in a browser** — the code path exists, the click is missing.
- XSS: content goes through zod by type and text renders as text, but no real injection strings were tried in every field.
- Hero-video page weight / mobile-data impact (this file's amendment) was not measured.

### 7. Demo content

`scripts/seed-demo.mjs` (idempotent, run once this session) uploaded the 11 design photos to the `product-media` bucket with sharp-made derivatives and seeded 7 sports, 7 categories, 6 brands, 11 published products (5 featured), 42 active variants, inventory rows, primary images, 2 shipping rules and the CMS pages/sections. Verified after seeding: **5 pages** (`home`, `about`, `faq`, `blog/first-kit`, `blog/training-at-home`, all published) and **11 sections** (1 `hero`, 1 `category_tiles`, 2 `product_grid`, 1 `promo_strip`, 6 `rich_text`). The two pre-existing test products were archived, not deleted.

### 8. Resulting file set

New: `src/app/design.css`, `src/lib/cms/{sections,pages}.ts`, `src/lib/storefront/{journal,order-memory,saved-items}.ts`, `(store)/_components/{SectionList,Countdown,Hero,AddToCartButton,SaveButton}.tsx`, the 9 new storefront route folders, `(store)/not-found.tsx`, `src/app/admin/(catalog)/pages/**`, `scripts/seed-demo.mjs`, `public/assets/*`. Modified: `globals.css`, `layout.tsx`, `(store)/layout.tsx` and the whole Phase 04/05 storefront component set (header, footer, cards, listing, PDP, cart, checkout, order, tracking, CMS page route), `lib/storefront/{catalog,images,money}.ts`, `admin/layout.tsx`.

### 9a. Follow-up, same day — the admin opens with a password, and two real bugs it exposed

The owner then asked for `/admin` to open with **one password instead of an account** ("dont make an account, just make it use a password"). That is decision **D42**, implemented in `src/lib/auth/passcode.ts` (constant-time check, signed httpOnly session cookie, login rate-limited) with the env var `ADMIN_PASSCODE`; unsetting it restores the account login. Warnings live in `docs/SECURITY.md` and the pre-launch checklist, because the password is the entire admin surface and the local value is deliberately weak.

Driving the gate with a real session immediately exposed two bugs that no amount of typechecking would have caught:

1. **Every catalog admin write silently did nothing.** The actions wrote through the request-scoped Supabase client, whose writes are filtered by RLS policies keyed on `auth.uid()` — and a passcode session has no Supabase user. An UPDATE the policy filters out returns **zero rows and no error**, so the builder answered "Section moved." for a move that never happened. Fixed by `adminDb()` (service role, only after `requireAdmin()`), applied across all admin actions, pages and the two shared libs (`listPages`/`getPageWithSections`, the admin order queries) — while leaving the storefront reads on the anon client.
2. **The admin layout gate did not protect its pages.** Next renders a layout and its page in parallel, so a page reads before the layout's `redirect()` applies, and the page's payload is streamed into the 307 response. Measured: an anonymous `GET /admin/pages/<id>` returned the **entire rendered builder** (sections, product ids, SEO fields) inside the redirect body — a leak that only existed because bug 1's fix made those reads service-role. Fixed with `requireAdminOrRedirect()` as the first statement of all 24 admin pages.

**Verification added for this follow-up** (all re-run on the final tree):

| Check | Result |
|---|---|
| Admin click-through (`.tmp/design/admin-session.mjs`) | **21/21** — wrong password rejected with no cookie issued; correct password opens `/admin`; the session cookie is httpOnly and invisible to JS; the builder renders the landing page's 5 sections; **moving a section reorders it and moving it back restores the order in the database**; hiding a section removes it from the live `/` and showing it brings it back; editing the trust strip's promises appears on `/` immediately; the revert restores both the database and the page; signing out closes the door again. Every mutation is reverted and asserted against the database, not just the DOM |
| Anonymous admin leak check (`.tmp/design/admin-leak.mjs`) | **15/15** — every admin route (all 12 index screens plus a builder page, a product page and an order detail) answers 307 → `/admin/login` and carries **none** of 16 real product/page/order values in its body |
| Storefront unchanged (`walk.mjs`, `replica-diff.mjs`) | **35/35** and **73/73** (262 properties, 0 divergent) |
| Admin surface (`admin-probe.mjs`) | OK — body and headings compute to Manrope, outside `.ws` |
| `tsc` / eslint / `next build` | 0 errors / 0 errors / exit 0 |

**Still not proven here:** creating a new page through the UI (the builder was driven on the existing landing page — reorder, hide/show, content edit, publish state were all exercised, page creation was not), the preview-fidelity and XSS proofs this file defers, and the hero video's page-weight measurement.

### 9. Verification scripts (gitignored, re-runnable)

`.tmp/design/replica-diff.mjs` (computed-style diff vs the mockup + backdrop/font/carousel/sticky-header checks + screenshots), `.tmp/design/walk.mjs` (route walk, `<h1>` assertion, console errors, gate checks, screenshots), `.tmp/design/admin-probe.mjs` (what the admin area computes for body/heading/button type — the check that caught the display-font leak), `.tmp/design/{ssrdom,hydrate}.mjs` (SSR-vs-DOM structure and hydration probes). Run them against a server built from the current tree (`PORT=3100 NODE_ENV=production node server.js`).
