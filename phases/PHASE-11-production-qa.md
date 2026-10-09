# PHASE 11 — Production QA & launch
1. Full journey on staging then production: browse -> search -> product -> variant -> cart -> checkout -> COD (and card if enabled) -> order -> stock -> admin -> status updates -> notifications -> tracking -> delivered. Then the failure paths (provider down, out of stock mid-checkout, network drop).
2. Mobile + tablet + desktop pass; accessibility pass (keyboard, contrast, screen-reader spot check); Lighthouse numbers recorded.
3. Ops: error monitoring/logging in place; backups on AND a restore rehearsed; `docs/RUNBOOK.md` (deploy, rollback, restore, rotate keys, add admin, common fixes); owner quick-guide (1-2 pages, screenshots) for products, stock, orders, homepage.
4. Launch checklist from `docs/DEPLOYMENT.md`; confirm all DECISIONS resolved or consciously deferred.
5. Hand over: owner account, developer account (separate), credentials stored in a password manager, not in chat/Git.

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **Production is three systems, not one:** the Next.js app on GoDaddy Node.js Hosting, Supabase (database/auth/storage), and WAHA on its own VPS. `docs/RUNBOOK.md` must cover all three: deploy, rollback, restore, key rotation, WAHA session backup/restore and the QR re-pair drill, adding an admin, and common fixes.
- **Data separated by blast radius:** losing the GoDaddy app is code-only (redeploy); losing Supabase needs the configured backup + a rehearsed restore; losing the WAHA session volume means re-scanning the QR — back it up, and rehearse the re-pair.
- **Credentials handed over in a password manager** (task 5) now explicitly include: `WAHA_API_KEY`, `WAHA_HOOK_HMAC_KEY`, `SCHEDULED_JOBS_SECRET`, the service-role key, and the VPS access.
- **Go-live gates added:** every test in `specs/whatsapp-waha-spec.md` §8 passes against the production VPS; the ban-risk acceptance is recorded (owner accepted it 2026-10-06; the number to lose is the shop's own); all DECISIONS resolved or consciously deferred; owner quick-guide covers the admin WhatsApp page (status, re-pair, failures).
- **Cannot be tested until launch:** the full journey must run on staging first, then production, including the failure paths (provider down, out-of-stock mid-checkout, network drop). Staging-only verification is not launch verification.

---

## Execution record — 2026-10-08 ("finish everything, verify everything" pass)

Owner instruction: finish the project, verify it is done, complete everything. That was
read as: run every gate and harness on the current tree, close the open acceptance items
that can be closed without the owner or a host, fix whatever the verification finds, and
write the two PHASE 11 deliverables that do not need a deployed system (the runbook and
the owner guide). Nothing was rebuilt or redesigned.

### What was found and fixed

1. **`/admin/products/<id>` returned HTTP 500 — the product editor was dead.** The page
   passed a plain function (`publicUrl`) as a prop to the client component
   `ImagesManager`, which React cannot serialize across the RSC boundary
   (`Functions cannot be passed directly to Client Components…`). Every product screen
   really used by the owner (price, variants, specs, photos) was unreachable; the
   "all admin screens open" check had only ever opened *list* pages. Fixed by deleting the
   prop and calling the existing client-safe helper `publicImageUrl()`
   (`src/lib/storefront/images.ts`) inside the component. Verified 500 → **200**, and a
   sweep of **all 26 admin routes** now reports `26/26 render` (`.tmp/phase10/admin-route-sweep.mjs`,
   which is the check that would have caught it).
2. **React #418 (hydration text mismatch) on every storefront page with a non-empty
   cart — fixed.** Root cause, found by capturing the DOM mutations during hydration and
   bisecting the payload: the cart badge's text is driven by the `refreshCart` **server
   action**, which can resolve *while React is still hydrating*, so the text node changed
   from the server's `0` to the real count mid-hydration. (Garbage, unknown-variant and
   empty carts never triggered it — the count stayed `0`.) Fixed with a shared
   hydration-safe hook, `src/lib/storefront/use-hydrated.ts` (`useSyncExternalStore` →
   server snapshot during hydration), applied **inside the components that render the
   value** — `Header` (badge + aria-label), the cart page's priced lines, and
   `AccountView` (which had a local copy of the same hook, now shared). A provider-level
   effect is *not* enough: the header sits inside a `<Suspense>` boundary that can hydrate
   later. Verified: **0 console errors across 5 pages × 3 runs** with a real cart
   (`.tmp/w-hydrate.mjs`), and `browser-pass.mjs` **45/45** (was 44/45).
3. **Test-only rows removed from the live database** (the open item in
   `docs/SECURITY-REPORT.md` §4.6): `TEST-DEMO-BALL` and `TEST-DEMO-SHOE` (archived,
   soft-deleted, no order references) were hard-deleted with their variants, inventory and
   ledger rows; the 11 seeded products are untouched.
4. **Coverage gap closed:** `/admin/orders/<id>` had never been rendered with a live row
   on this build. The Phase 05 E2E now checks the admin order detail + list while its
   order still exists, before cleanup — **23/23**.

### Verification run this session (production build, live database)

| Gate / harness | Result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run lint` | **0 errors**, 5 pre-existing warnings |
| `npm run build` | **exit 0** |
| `.tmp/phase10/h0-pure.mjs` | **40/40** |
| `.tmp/phase10/h1-live.mjs` (headers/CSP, RLS matrix, cron/webhook auth) | **39/39** |
| `.tmp/phase10/h2-authed.mjs` (passcode oracle, upload malice matrix, crop) | **29/29** |
| `.tmp/phase10/h3-staff.mjs` (owner-only enforcement; restarts the app itself) | **15/15** |
| `.tmp/phase10/h4-sport-image.mjs` (sport-photo upload pipeline) | **18/18** |
| `.tmp/phase10/correction-check.mjs` | **47/47** |
| `.tmp/phase10/shop-by-sport-check.mjs` | **38/38** |
| `.tmp/phase10/browser-pass.mjs` (real Chrome, customer + admin walks) | **45/45** (was 44/45) |
| `.tmp/design/walk.mjs` (20 routes, `<h1>` per route, gate) | **35/35** |
| `.tmp/design/replica-diff.mjs` (mockup vs built, computed styles) | **73/73**, 252 properties, 0 divergent |
| `.tmp/phase05/e2e-checkout.mjs` (real order → stock → tracking → admin) | **23/23** |
| `.tmp/phase10/admin-route-sweep.mjs` (every admin route) | **26/26 render** |
| `.tmp/phase10/browser-page-create.mjs` (PHASE 07 close-out) | **17/17** |
| `.tmp/phase10/browser-xss-sections.mjs` (PHASE 07 close-out) | **38/38** |

### Deliverables written (PHASE 11 task 3, the parts that need no host)

- **`docs/RUNBOOK.md`** — deploy/rollback, backup + **rehearsed** restore, forward-only
  migrations, key rotation and what each rotation breaks, adding/removing an admin (both
  the shared password and a real account), the WAHA session backup + re-pair drill, the
  cron auth contract, where the logs and the audit trail are, a symptom → cause → fix
  table, and a launch drill checklist. `docs/DEPLOYMENT.md`'s trailing "write these as
  `docs/RUNBOOK.md`" is now satisfied.
- **`docs/OWNER-GUIDE.md`** — the 1–2 page handover for a non-technical owner (sign in,
  orders loop, products/stock, the homepage builder, the shipping rules they must enter,
  what is switched off on purpose, common fixes) with **7 screenshots** captured from this
  build (`docs/screenshots/`, 285 KB total, compressed with sharp).

### What remains, and only the owner or a host can do it

1. **`ADMIN_PASSCODE`** — set a long random value on the host (or remove it and use the
   owner account). It is 5 characters locally and it is the whole admin area (D42).
2. **Delivery rules** in `/admin/shipping` — the FAQ still quotes the seed's fees
   (D5). Product decision, not a code gap.
3. **Cricket and Tennis** currently have no products (deliberate, honest empty pages) —
   add stock or archive the sports in `/admin/sports`.
4. **PHASE 11 is still a *launch* gate:** the full journeys on staging then production,
   mobile/tablet/desktop + accessibility + Lighthouse, live WhatsApp delivery, a real
   backup **restore**, headers/CSP as served by the host, and the owner-account handover.
   None of it is provable from this machine (no staging, no WAHA VPS, no GoDaddy account)
   and none of the local runs above claim to prove it.
