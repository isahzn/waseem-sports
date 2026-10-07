# PHASE 01 — Foundation
**Goal:** a deployable, secure skeleton. Depends on PHASE 00 approval.
## Tasks
1. Scaffold Next.js (App Router, TS strict, Tailwind, ESLint) per `docs/FOLDER_STRUCTURE.md`. VERIFY current create-next-app options.
2. Add deps only as needed: supabase-js, @supabase/ssr, zod, server-only. Justify each in the commit.
3. Supabase clients (browser/server/admin), env validation module (fail fast if vars missing), `.gitignore`, `.env.example` kept in sync.
4. Auth: admin login/logout, forgot/reset password pages, middleware session refresh, `requireAdmin(roles)` helper, `/admin` protected layout (empty shell).
5. Security baseline: headers, generic error pages, logger util, rate-limit helper (decision D8) applied to login/reset.
6. Deploy to Vercel (preview) connected to a dev Supabase project; document steps in `docs/DEPLOYMENT.md` corrections.
## Acceptance
- Unauthenticated `/admin` redirects to login; non-admin user gets 403 even with a valid session.
- Wrong password gives a generic error; repeated attempts are limited (VERIFY behavior).
- `grep -r SERVICE_ROLE .next/static` finds nothing. Typecheck/lint/build pass.
## Stop and ask
Rate-limit store (D8), Auth email/SMTP setup, first owner creation.

## Amendments — 2026-10-06 (owner decisions; context for a session with no prior knowledge)
- **Hosting target is GoDaddy Node.js Hosting, not Vercel.** Task 6's "Deploy to Vercel (preview)" is superseded: prove the build on GoDaddy's free preview tier, then buy Deluxe when a staging app is needed (`specs/phase-00-fix-spec.md` §5.8). Follow the deploy contract (`process.env.PORT`, real `build` + `start` scripts, runtime deps in `dependencies`, lockfile, no `node_modules`, one app per upload); **VERIFY** the contract revision before the first deploy.
- **Next.js 16.x latest stable** (15 reaches EOL 21 Oct 2026), **Tailwind v4** CSS-first `@theme`, zod, `@supabase/supabase-js` + `@supabase/ssr`.
- **Supabase is reached only over HTTPS (443).** No `pg`/Prisma/Drizzle — direct database ports are blocked from the GoDaddy container. Migrations are applied from the dev machine, never from the host.
- **Rate limiting = Postgres table** (no extra vendor — `specs/phase-00-fix-spec.md` §5.5). Apply to login/reset now; every other route gets it when it's built.
- **Acceptance note:** the `SERVICE_ROLE` grep must cover the standalone output directory, not just `.next/static` — the path depends on the build output mode; document what was checked.
- **Stop-and-ask additions:** GoDaddy plan tier + region (NA/EU) choice; exact contract requirements.
- **Cannot be tested in this phase — prove later:** real traffic behaviour; whether GoDaddy's CDN caches `next/image` responses (V6); multi-instance `revalidateTag` coherence (V6); Auth email delivery limits (verify with a live reset email, not docs alone).

## Execution record — 2026-10-06 (Phase 01 built, owner-approved Phase 00)
- Scaffolded Next.js **16.3.8** + React 19 + Tailwind **v4** (CSS-first `@theme` with brand tokens from `docs/DESIGN-TOKENS.md`) + TS strict + ESLint, merged into the package root (supplemented `create-next-app`; scaffold scratch removed afterwards).
- Deps added with reasons: `@supabase/supabase-js` + `@supabase/ssr` (browser/server/proxy session + service-role admin), `zod` (env + login validation), `server-only` (compile-time server boundary for the admin client), `sharp` (reserved for the Phase 04 image pipeline).
- Delivered: `server.js` (GoDaddy entry, binds `process.env.PORT` on `0.0.0.0`; `main` + `build`/`start` scripts set), env validation (`src/lib/env.ts`), Supabase clients (`browser`/`server`/`admin`), `requireAdmin()` + role types, admin login/logout/forgot/reset + protected `/admin` shell, security headers in `next.config.ts`, generic 404/error pages, structured logger, Postgres `rate_limits` table (`supabase/migrations/0002_rate_limits.sql`, not applied) with memory fallback for local dev, `/api/health`, `.npmrc` (public registry).
- Next 16 convention followed: `src/middleware.ts` renamed to `src/proxy.ts` (`middleware` → `proxy` export) per the official middleware-to-proxy migration — build is warning-free.
- Verified 2026-10-06: `tsc --noEmit` clean, `eslint src` clean, `next build` clean, `grep SERVICE_ROLE .next/static` empty (service-role reads confined to `server-only` modules), production server via `server.js` on PORT 3101: `/api/health` 200, `/` 200, `/admin/login` 200, unauthenticated `/admin` → 307 to `/admin/login`, all five security headers present.
- NOT tested (no Supabase dev project yet — owner supplies keys later): non-admin 403 path, wrong-password generic error against real Auth, Postgres rate-limit path (memory fallback active locally), reset-email delivery, GoDaddy preview deploy (local `server.js` proof only). Prove in Phase 02 with the dev project.
- **Env rename + re-verify — 2026-10-06 (owner request: old names unclear/outdated).** `TRACKING_TOKEN_PEPPER` → `ORDER_TRACKING_SECRET`, `CRON_SECRET` → `SCHEDULED_JOBS_SECRET`, `WHATSAPP_PROVIDER`/`WHATSAPP_API_KEY` → `WAHA_URL`/`WAHA_API_KEY` (+`WAHA_HOOK_HMAC_KEY` per the Phase 11 credential list), `RATE_LIMIT_PROVIDER=postgres` (D8). Supabase key names kept (their dashboard/docs use exactly these). Renamed in `src/lib/env.ts`, `.env` + `.env.example` (plain-language comments), and all 8 `CRON_SECRET` references in living docs/specs/phases. Owner's `.env` (gitignored, untracked) now holds real Supabase keys; `/rest/v1/` URL suffix fixed; both secrets generated (64-hex). Re-verified after rename: typecheck/lint/build clean, SERVICE_ROLE grep empty, live `server.js` proof — `/api/health` reports `supabaseConfigured:true`, `/` 200, `/admin` → 307, login/forgot 200, 404 page 200-class, all 5 security headers. Still untested: real-admin login + 403 path (needs the Phase 02 owner-creation step), reset-email delivery, GoDaddy preview deploy.
