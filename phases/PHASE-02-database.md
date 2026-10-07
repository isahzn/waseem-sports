# PHASE 02 — Database
**Goal:** apply and prove the schema. Starting SQL: `supabase/migrations/0001_init.sql`.
## Tasks
1. Set up Supabase CLI + local DB. Apply migration. Fix anything that fails (VERIFY storage schema). Do not edit once applied elsewhere — add `0002_*.sql`.
2. Generate `src/types/database.ts`.
3. Add admin manual stock adjust function (writes ledger), publish-page function (draft_content -> content), and any missing indexes found via EXPLAIN.
4. SQL tests: concurrent purchase of last unit (two sessions), `place_order` idempotency, reserve/release/commit math, constraints reject negative stock, RLS matrix (anon / logged-in non-admin / admin) for EVERY table incl. storage.
5. `seed.dev.sql`: small demo catalog incl. one simple product, one product with 3 explicit variants and different prices/stock (dev only).
6. Write `docs/RLS-MATRIX.md` from the test results.
## Acceptance
- Two concurrent orders for stock=1: exactly one succeeds, stock never negative.
- anon cannot read/write orders, payments, notifications, audit, inventory; cannot write anything.
- Calling `place_order` as anon/authenticated fails (execute revoked).
## Stop and ask
Any schema change that alters the model in HANDOFF "Decisions I made".

## Amendments — 2026-10-06 (context for a session with no prior knowledge)
- **The starting SQL may already be hardened.** If PHASE 00 execution ran, `0001_init.sql` contains the §5.10 hardening (role-aware authorization, service-role-only writes, `variant_availability` made safe-by-construction, `place_order` idempotency + DB-sourced shipping fee + named errors, `admin_adjust_stock()`, settings-backed constants). Read `specs/phase-00-fix-spec.md` §5.10 before assuming the original file. Task 3's "admin manual stock adjust" and "publish-page" functions must not be built twice.
- **Seeded settings (owner-confirmed):** `store.currency` = LKR; contact facts (130/6 Golden Plaza, Main Street, Colombo 11 · 077 009 0147 · 075 613 0147 · WhatsApp); order-number prefix and per-variant max qty are **editable settings**, not constants (see `docs/DECISIONS.md`). Shop **email and opening hours are VERIFY — do not invent them**; leave blank.
- **Rationale for `variant_availability`:** it stays `security definer` deliberately as a published/filtered projection for anon — do not "fix" it to `security invoker` without reading the §5.10 reasoning.
- **RLS tests (task 4) must cover the hardened policies**, including: anon sees only the safe projection (no unpublished/soft-deleted variants); admin sessions on the anon key cannot write inventory/orders/payment state directly (regression test for the bypass the hardening removed); `place_order`/`adjust_order_stock` unreachable from anon/authenticated.
- **Stop-and-ask additions:** `orders.customer_phone` index (privacy vs lookup), order-number prefix value, `cod.reserve_stock_on` (D2) if the owner still hasn't answered.
- **Readiness — 2026-10-06:** Supabase URL + anon + service-role keys are in the gitignored `.env` (live Auth reachable; `/api/health` reports `supabaseConfigured:true`). Apply `0001_init.sql` + `0002_rate_limits.sql` (both applied the same day — see the execution record below) via Supabase CLI from the dev machine — never from the GoDaddy host. First owner creation per `docs/DEPLOYMENT.md` setup step 2. Env names changed since Phase 00 docs were written: `SCHEDULED_JOBS_SECRET` (was `CRON_SECRET`), `ORDER_TRACKING_SECRET` (was `TRACKING_TOKEN_PEPPER`) — code and `.env.example` already use the new names.
- **Execution record — 2026-10-06 (all tasks done, proven live on the dev project).**
  - `0001` failed first push (`inventory_movements` FK'd `orders` before it existed — parse-clean but order-invalid). Fixed in place per D25 (inline ref → deferred `ALTER TABLE ... ADD CONSTRAINT inv_mov_order_fk`); push then clean. `0002_rate_limits` + new `0003_publish_page` (task 3 — did not exist; `admin_adjust_stock`/`place_order`/`adjust_order_stock` verified present, not duplicated) applied. Remote migration list matches local.
  - `src/types/database.ts` generated (1324 lines, all tables + `publish_page`); `tsc` clean.
  - Race proof: two parallel `place_order` calls on 1 unit — B won (`ORD10000`), A got `P0001 INSUFFICIENT_STOCK`, no orphan row, stock `1/1`. Idempotent replay returned the same order, items stayed 1. Commit `1/1 → 0/0`. Negative stock rejected (`23514 inv_on_hand_nonneg`). RLS suite `01_rls_matrix.sql` exit 0 + spot reads (anon 0 rows everywhere sensitive, `place_order` unexecutable). Full table: `docs/RLS-MATRIX.md`.
  - `seed.dev.sql` applied: simple product (50 in stock) + 3-variant shoe (10/3/0). Test-race rows deleted afterwards.
- **Cannot be tested except live:** the last-unit race and the idempotency race must be proven with **actual parallel sessions against a real database** — DONE above (two parallel Management-API sessions; A blocked on B's row lock, then got INSUFFICIENT_STOCK). — single-threaded scripts are not proof. Constraint behaviour must be observed in Postgres errors, not asserted from reading the SQL.
