# NEON Migration Plan — Supabase → Neon (plan only, no data moved)

> Status 2026-10-09: **plan only**. No database, code, or env was changed for this.
> Full move requested: tables + Auth + Storage off Supabase to Neon + replacements.

## 0. What Supabase does for this project today

| Area | Current | Files / objects |
|---|---|---|
| Postgres tables | Supabase Postgres (RLS on) | `supabase/migrations/0001_init.sql` … `0005_image_search.sql`, `supabase/seed.sql` |
| RPC / business logic in SQL | `place_order`, `adjust_order_stock`, `admin_adjust_stock`, `publish_page`, `variant_availability` view | 0001–0003, used in `src/app/(store)/checkout/actions.ts`, `src/app/admin/*/actions.ts`, `src/lib/storefront/*` |
| Auth | Supabase Auth (`auth.users`, `auth.uid()` in RLS, `admin_users` FK → `auth.users`) + shared `ADMIN_PASSCODE` fallback (D42) | `src/lib/supabase/*`, `src/lib/auth/*`, `src/app/(auth)/*`, `src/proxy.ts`, `src/app/admin/layout.tsx` |
| Storage | Public `product-media` bucket + derivatives (`-thumb`), taxonomy images | `src/lib/uploads/*`, `src/app/api/admin/images/crop/*`, `scripts/seed-demo.mjs` |
| Client access | `@supabase/ssr` + `@supabase/supabase-js` (PostgREST), ~55 call sites under `src/` | `src/lib/supabase/server.ts`, `admin.ts`, `browser.ts`, `src/lib/storefront/catalog.ts`, `src/lib/orders/*`, `src/lib/cms/*`, etc. |
| Realtime / edge | None used. `pg_cron` + outbox processor via `/api/cron/notifications`, WAHA webhook HMAC | `phases/PHASE-06*`, `src/app/api/cron/*`, `src/app/api/webhooks/waha/*` |
| Rate limits | Postgres table `rate_limits` (D8) | `src/lib/security/ratelimit.ts`, `0002_rate_limits.sql` |

Neon is **Postgres only**. It replaces the first row. Auth + Storage need separate replacements (see §2).

## 1. Target architecture

```
Next.js (GoDaddy, `server.js` unchanged)
 ├─ Neon Postgres (pooled PgBouncer endpoint for app, direct endpoint for migrations)
 │   ├─ app tables (from 0001–0005, de-supabased — §3)
 │   ├─ SQL functions (place_order, adjust_order_stock, admin_adjust_stock, publish_page)
 │   ├─ RLS kept where cheap (Neon is real Postgres), enforced with a single app role + SET LOCAL app.user
 │   └─ pg_cron replacement: Vercel/GoDaddy cron → /api/cron/notifications (already HMAC-guarded)
 ├─ Auth replacement (§2.1): Auth.js (NextAuth v5) credentials + scrypt password hashes in `admin_users`
 │   (passcode stays as emergency fallback until owner accounts exist, then removed per D42)
 └─ Storage replacement (§2.2): Cloudflare R2 (S3-compatible) `product-media` bucket + CDN
     (alt: Vercel Blob / S3; R2 chosen for zero egress + S3 API + sharp pipeline unchanged)
```

New deps (proposed, not installed): `@neondatabase/serverless`, `drizzle-orm` (or raw `pg` if owner prefers fewer deps), `next-auth@5`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Reason recorded here per project rule: Neon HTTP driver works from serverless/pooled hosts where direct TCP is blocked; Drizzle keeps SQL typed without an ORM runtime; R2 keeps the sharp upload/resize code path identical.

## 2. Replacements for non-Postgres Supabase features

### 2.1 Auth (Supabase Auth → Auth.js credentials)
- `admin_users.user_id uuid FK auth.users` → `admin_users.id uuid PK` + `email citext unique` + `password_hash text` + `role text` + existing columns.
- Login: `supabase.auth.signInWithPassword` → Auth.js credentials provider (scrypt, constant-time compare, same rate-limit table).
- Session: Supabase cookie → Auth.js JWT session (httpOnly, Secure on https). `proxy.ts` + `requireAdmin()` rewritten to read Auth.js session; passcode path unchanged until cutover.
- Password reset: Supabase `resetPasswordForEmail` → token table (`admin_password_resets`, 1h expiry, hashed token) + existing email-vendor seam (console in dev, HTTPS vendor in prod — GoDaddy blocks SMTP).
- Audit: `actor uuid FK auth.users, null for passcode` → `actor uuid FK admin_users, null only for passcode` (keeps D42 honesty, trail names owners after cutover).

### 2.2 Storage (Supabase Storage → R2)
- Bucket `product-media` (public thumbs) + taxonomy images → R2 bucket, public read via CDN hostname, private write via presigned URLs or server upload (keep server upload: reuses sharp re-encode + SSRF allowlist, `src/lib/uploads/*`).
- Path scheme unchanged (`products/demo-NN.jpg`, `-thumb` derivative, taxonomy paths) so `publicImageUrl()` only changes host.
- `seed-demo.mjs` storage calls (`/storage/v1/*`) → S3 PutObject; REST calls (`/rest/v1/*`) → direct pg inserts or Neon data API during seed only.
- Crop route (`/api/admin/images/crop`) keeps sharp pipeline, swaps download/upload calls to S3 Get/Put.

### 2.3 RLS → app-enforced + Postgres RLS
- Neon supports RLS (real Postgres). Keep policies that are pure SQL (`is_visible`, `status='published'`, `deleted_at is null`), rewritten to check `current_setting('app.role')` / `app.user` instead of `auth.uid()`.
- Money/stock writes stay in SQL functions only (existing rule 4 unchanged — the strongest guarantee survives the move).
- Anon reads go through a `storefront_readonly` role via pooled connection; admin writes via `app_admin` role (server-only secret, never `NEXT_PUBLIC_`).

## 3. SQL porting notes (0001–0005 → `neon/migrations/`)
1. Remove `auth.users` FKs, `auth.uid()` calls, `storage.buckets/objects` policies, Supabase-only extensions (`pg_net`, `supabase_vault` if any — verify by grepping migrations).
2. Keep: tables, indexes, checks, triggers (inventory auto-create, order-number sequence `WS` prefix D21), `variant_availability` view, all four RPCs, rate-limits table, transfers + image-search tables.
3. Add: `admin_users` password columns, `admin_password_resets`, `payment_events` already exists? (verify — Fixes §6 needs it; if missing it arrives with the card-payments migration, not here).
4. Collation/extensions: `pgcrypto`/`uuid-ossp`/`citext`/`pg_trgm` (needed for Fixes §2.3 FTS) — enable in Neon branch first, `CREATE EXTENSION IF NOT EXISTS`.
5. Publish function: `publish_page` (0003) ports as-is minus auth checks → `app.role` check.

## 4. Migration steps (forward-only, tested on a copy first)
1. **Provision**: Neon project + `main` branch + pooled + direct connection strings. Keep Supabase live (no writes frozen yet).
2. **Branch for test**: Neon branch `migration-test`. Apply converted migrations + `seed.sql` (D35: seed is setup, not optional). Enable extensions.
3. **Dry-run data copy**: `pg_dump --schema-only` review, then `pg_dump --data-only` from Supabase (via direct DB URL on a machine where ports are open — not GoDaddy) → restore to Neon branch. Verify counts per table (products, variants, inventory, images, orders, pages, sections, settings).
4. **Image copy**: list `product-media` objects → copy bytes to R2 with same keys + content-type + cache headers. Verify thumb URLs resolve + byte counts match.
5. **App cutover (code, behind env flag)**: new `src/lib/db/neon.ts` (pooled client), `src/lib/auth/*` Auth.js wiring, `src/lib/uploads/*` R2 wiring. Env: `DATABASE_URL` (pooled), `DIRECT_URL`, `AUTH_SECRET`, `R2_*`, `NEXT_PUBLIC_IMAGE_CDN`. Old Supabase env stays until green.
6. **Dual-read verify**: staging points at Neon branch; run gates: `typecheck`, `lint`, `build`, h0–h4, correction, shop-by-sport, browser-pass 45/45, replica-diff 73/73, PHASE-05 E2E 23/23, admin-route-sweep 26/26, page-create 17/17, section-XSS 38/38.
7. **Cutover**: point prod env to Neon + R2, deploy, smoke checkout (real order on prod, then void/cancel + restore stock), confirm outbox/cron, WAHA webhook still HMAC-green.
8. **Decommission**: after 7-day bake, remove Supabase deps/env, archive `supabase/` → `supabase.legacy/` (never delete history), record decision D48.

## 5. What changes in code (inventory, not yet done)
- Replace: `src/lib/supabase/{server,browser,admin}.ts` → `src/lib/db/neon.ts` + Auth.js session helpers. ~55 call sites switch from PostgREST chaining to SQL (Drizzle or parameterised `sql` template — no string-concatenated SQL, zod at every boundary as today).
- Rewrite: `proxy.ts` (session refresh), `src/lib/auth/requireAdmin.ts` (`adminDb()` → Neon admin client), all `*.rpc()` calls → `SELECT place_order(...)` etc. via pooled client inside transactions.
- Keep unchanged: stock-only-via-SQL rule, server-recomputes-price rule, zod schemas, CSP/headers, `server.js`, GoDaddy contract, outbox/retry semantics.
- Delete after green: `@supabase/ssr`, `@supabase/supabase-js` deps; `scripts/seed-demo.mjs` Supabase HTTP paths.

## 6. Risks / open questions for the owner
1. **Downtime window**: data copy needs a write-freeze (minutes) or a delta replay — pick before cutover.
2. **Auth passwords**: no passwords to migrate (Supabase Auth has zero users today — `/admin` is passcode-only, D42). Owner/staff accounts are created fresh on Neon. No reset-email vendor chosen yet (SMTP blocked — needs HTTPS vendor).
3. **RLS parity**: RLS policies must be re-proven on Neon (`supabase/tests/01_rls_matrix.sql` ported to a Neon test script).
4. **GoDaddy egress**: Neon over HTTPS/pooled (port 443) — verify GoDaddy allows it (it blocks direct Postgres 5432; Neon pooled + serverless driver use 443 — confirm on staging).
5. **Cost**: Neon branch + storage + R2 egress vs Supabase plan — confirm before decommission.
6. **Rollback**: keep Supabase project read-only for 7 days post-cutover with a nightly `pg_dump`; rollback = env flip + DNS-less redeploy.

## 7. Acceptance before calling it done
- [ ] All gates green on Neon (§4.6 list) + RLS matrix ported and green
- [ ] Real order placed/cancelled on staging with correct stock math + audit rows naming the actor
- [ ] Images load from CDN with same paths, thumbs correct, crop route green
- [ ] Cron + WAHA webhook green, outbox retry/backoff unchanged
- [ ] Rollback rehearsed (env flip restores Supabase reads)
