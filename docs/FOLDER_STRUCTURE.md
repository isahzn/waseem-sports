# Proposed repo layout (Next.js App Router)

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
Rules: business logic in `lib/services`, not in components. Anything importing the service-role client must `import "server-only"`.
Deploy constraints (GoDaddy Node.js Hosting, not Vercel): listen on `process.env.PORT` bound to `0.0.0.0`; root `package.json` needs non-empty `name`/`version`/`main` plus `build` and `start` scripts; runtime deps in `dependencies`; one app per upload; Supabase reached only over HTTPS (no direct Postgres, no SMTP).
