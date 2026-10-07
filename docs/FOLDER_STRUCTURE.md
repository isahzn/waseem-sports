# Repo layout

> **Status 2026-10-07.** The tree below is the **Phase 00 proposal** (2026-10-06) and is kept as written. It was never going to survive contact with the build unchanged, so read it as intent, and read **"As built"** at the bottom for what is actually on disk. Where the two disagree, the code is the truth and this file is the correction backlog already applied there.

## Phase 00 proposal (2026-10-06)

```
/
├─ CLAUDE.md  AGENTS.md  HANDOFF.md  README.md
├─ docs/  phases/  prompts/  specs/  design/  # this package (design/ = canonical HTML + assets;
│                                           # superseded designs live in design/unwanted-designs/, gitignored)
├─ .tmp/                                    # local scratch only (audit harness, measurements) — gitignored
├─ supabase/
│  ├─ migrations/0001_init.sql ...             # only way to change the DB
│  ├─ seed.sql                                 # technical defaults
│  ├─ seed.dev.sql                             # PLANNED (does not exist yet): demo catalog, never for prod
│  └─ tests/                                   # PLANNED (does not exist yet): SQL tests (stock races, RLS)
├─ src/
│  ├─ app/
│  │  ├─ (storefront)/
│  │  │  ├─ page.tsx                           # renders CMS page 'home'
│  │  │  ├─ sports/[slug]/  categories/[slug]/  brands/[slug]/  products/[slug]/
│  │  │  ├─ search/  cart/  checkout/  order/[orderNumber]/  track/
│  │  │  └─ [...slug]/page.tsx                 # CMS pages
│  │  ├─ (auth)/admin/login  forgot-password  reset-password
│  │  ├─ admin/                                # protected layout -> requireAdmin
│  │  │  ├─ page.tsx (dashboard)  orders/  products/  sports/  categories/  brands/
│  │  │  ├─ attributes/  inventory/  pages/  homepage/  shipping/  settings/  audit/
│  │  ├─ api/webhooks/[provider]/route.ts
│  │  ├─ api/cron/notifications/route.ts   api/cron/release-stale-reservations/route.ts
│  │  ├─ sitemap.ts  robots.ts
│  ├─ components/
│  │  ├─ ui/            # buttons, inputs, dialogs, tables (small primitives)
│  │  ├─ storefront/    # header, footer, ProductCard, VariantPicker, CartDrawer...
│  │  ├─ sections/      # CMS section components + registry.ts (shared by live + preview)
│  │  └─ admin/         # AdminShell, DataTable, ImageUploader, forms
│  ├─ lib/
│  │  ├─ supabase/ (browser.ts server.ts admin.ts)
│  │  ├─ auth/ (requireAdmin.ts roles.ts)
│  │  ├─ validation/ (zod schemas per domain)
│  │  ├─ services/  catalog/ cart/ checkout/ orders/ inventory/ shipping/ settings/ audit/ pages/
│  │  ├─ payments/  (types.ts registry.ts cod.ts <provider>.ts)
│  │  ├─ notifications/ (types.ts outbox.ts templates.ts providers/)
│  │  ├─ images/ (upload.ts validate.ts search/ import.ts)
│  │  ├─ security/ (ratelimit.ts headers.ts ssrf.ts token.ts)
│  │  └─ utils/ (money.ts slug.ts errors.ts logger.ts)
│  ├─ types/database.ts   # generated
│  └─ middleware.ts
├─ tests/ (unit + e2e)
├─ public/assets/                            # files that must survive GoDaddy deploys live here
├─ .env.example  .gitignore  package.json  tsconfig.json (strict)
```
Rules: business logic in `lib/`, not in components. Anything importing the service-role client must `import "server-only"`.
Deploy constraints (GoDaddy Node.js Hosting, not Vercel): listen on `process.env.PORT` bound to `0.0.0.0`; root `package.json` needs non-empty `name`/`version`/`main` plus `build` and `start` scripts; runtime deps in `dependencies`; one app per upload; Supabase reached only over HTTPS (no direct Postgres, no SMTP).

---

## As built — 2026-10-07

```
src/
├─ app/
│  ├─ (store)/                     # the storefront: the replica of design/waseem-sports-video.html
│  │  ├─ _components/              # Header, Footer, SectionList, cards, drawers — colocated, not in components/
│  │  ├─ layout.tsx  page.tsx      # page.tsx renders CMS page 'home'
│  │  ├─ shop/  product/[slug]/  sport/[slug]/  category/[slug]/  brand/[slug]/  search/
│  │  ├─ cart/  checkout/  compare/  wishlist/  account/
│  │  ├─ about/  contact/  faq/  blog/ blog/[slug]/  pages/[slug]/  store-locator/
│  │  └─ order/[number]/  track/
│  ├─ (auth)/admin/                # login (account OR shared passcode) · forgot-password · reset-password
│  ├─ admin/                       # protected: requireAdminOrRedirect() on EVERY page
│  │  ├─ layout.tsx  page.tsx      # dashboard; grouped sidebar, own header, Tailwind-only
│  │  └─ (catalog)/                # products · sports · categories · brands · attributes · inventory ·
│  │                               # orders · pages (the landing CMS builder) · shipping   (+ _components/)
│  ├─ api/                         # health · admin/uploads · admin/images/crop
│  ├─ layout.tsx  globals.css  design.css   # design.css = the mockup's stylesheet, scoped under `.ws`
│  └─ sitemap.ts  robots.ts
├─ lib/
│  ├─ supabase/ (browser.ts server.ts admin.ts)
│  ├─ auth/ (passcode.ts requireAdmin.ts roles.ts)
│  ├─ catalog/ (audit.ts query.ts schemas.ts slug.ts)   # + zone schemas sit beside their domain
│  ├─ cms/ (sections.ts pages.ts)                       # zod section schemas + page queries
│  ├─ orders/ (errors.ts notify.ts queries.ts schemas.ts status.ts tracking.ts)
│  ├─ security/ (logger.ts ratelimit.ts)
│  ├─ storefront/ (availability.ts cart.ts cart-cookie.ts cart-server.ts catalog.ts images.ts
│  │               journal.ts money.ts order-memory.ts saved-items.ts)
│  ├─ uploads/ (magic.ts)   env.ts   settings.ts
├─ types/database.ts               # generated
└─ proxy.ts                        # NOTE: not middleware.ts — Next 16 renamed it (middleware → proxy)
scripts/seed-demo.mjs              # idempotent demo catalogue: 11 products, pages, landing sections
supabase/migrations/0001_init.sql  0002_rate_limits.sql  0003_publish_page.sql   # all applied
supabase/seed.sql  supabase/tests/01_rls_matrix.sql
public/assets/bg.mp4  public/assets/logo.png            # the two files that must survive deploys
.tmp/                              # gitignored: the headless-Chrome harnesses and their screenshots
```

Delta from the proposal — what changed and why:

| Proposed | Actual | Why |
|---|---|---|
| `src/components/{ui,storefront,sections,admin}` | components live in `src/app/(store)/_components` and `src/app/admin/(catalog)/_components` | colocation; no component is shared across the two areas, and the storefront's are design-specific |
| `lib/{services,validation,payments,notifications,images,utils}` | `lib/{catalog,cms,orders,security,storefront,uploads}` + `env.ts`/`settings.ts` | split by domain instead of by layer; zod schemas sit beside their domain. `payments/` and `notifications/` are PHASE 06/08 and **do not exist yet** |
| `middleware.ts` | `src/proxy.ts` | Next 16 renamed middleware to proxy |
| `(storefront)/…`, `products/[slug]`, `order/[orderNumber]` | `(store)/…`, `/product/[slug]`, `/order/[number]` | singular, matching the design's own routes |
| `[...slug]` CMS catch-all | `/pages/[slug]` | explicit beats a catch-all that can shadow real routes |
| `admin/{homepage,settings,audit}` | dashboard at `/admin`; no separate homepage/settings/audit screens | the landing page is edited in `/admin/pages`, and settings/audit were not needed to ship the front end |
| `api/webhooks/[provider]`, `api/cron/*` | not built | PHASE 08 / PHASE 06 |
| `supabase/seed.dev.sql` | `scripts/seed-demo.mjs` + `supabase/seed.sql` | the Phase 02 throwaway was deleted after its race test; demo data is now scripted and idempotent (D40) |
| `supabase/tests/` "PLANNED" | `01_rls_matrix.sql` exists and passes | Phase 02 |
| `tests/ (unit + e2e)` | does not exist | **no test runner is installed** — the gates are `npm run typecheck`, `npm run lint`, `npm run build` plus the `.tmp/` harnesses (`docs/ARCHITECTURE.md`) |
