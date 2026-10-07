# Database

Source of truth: `supabase/migrations/` — `0001_init.sql` (**hardened in Phase 00**, 2026-10-06, parsed with libpg_query), `0002_*` and `0003_publish_page.sql`. **All applied to the linked dev project** (Phase 02, 2026-10-06) and `supabase/seed.sql` applied 2026-10-07; TypeScript types generated at `src/types/database.ts`. `0001` was never applied anywhere before Phase 02, so Phase 00 could still edit it in place (D25) — that door is now shut: every further change is a new migration.

## Tables (group -> purpose)
- **Access/config:** `admin_users` (role: owner/admin/staff/developer), `store_settings` (jsonb key/values; keys starting `public.` readable by storefront).
- **Taxonomy:** `sports`, `categories` (optional sport, self-parenting), `brands`. All have visible/sort/soft-delete; `sports`/`brands` carry `is_featured`.
- **Products:** `products` (incl. `compare_at_price`, `promo` jsonb, `published_at`, generated `search_tsv`), `product_variants` (options jsonb keyed by attribute slug, nullable price override, SKU), `product_images` (optional variant link, alt text, provenance incl. `license_note`), `attribute_definitions` + `product_attribute_values` (owner-defined specs).
- **Inventory:** `inventory` (on_hand, reserved, threshold, `track_inventory` — false means always sellable; the stock functions skip such variants entirely), `inventory_movements` (ledger, `order_id` FK → `orders`), view `variant_availability` (security-definer public projection of **only** `(product_id, variant_id, status)` for active variants of published, non-deleted products; untracked variants report `in_stock`).
- **Orders:** `orders` (incl. `stock_reserved`/`stock_committed` flags, `shipping_method`), `order_items` (snapshot), `order_status_history`, `payment_transactions`, `webhook_events`, `notifications` (outbox), `shipping_rules`.
- **CMS:** `pages` (homepage = slug `home`; incl. `layout`, `og_image_path`), `page_sections` (type + live `content` + `draft_content`). **What the builder actually uses (D37, 2026-10-07):** sections are written to the live `content` column and published by the page's `status`, so `draft_content` and the `publish_page()` RPC exist in the schema but are not used by the UI — a draft/publish pair per section was deliberately not built.
- **Ops:** `audit_logs`.

## Why it's shaped this way
- **Attributes:** descriptive specs (Weight, Material) are rows in `attribute_definitions` + values. Variant dimensions (Size, Colour) are attributes flagged `is_variant_option`, stored on each variant as `options` jsonb. The owner lists exactly which variants exist — no auto-generated matrix (optional generator later).
- **Simple products:** one variant with `is_default = true`; admin UI hides variant UI until the owner clicks "This product has options".
- **Price:** `coalesce(variant.price, product.base_price)` computed server-side/in SQL. Currency from settings. `numeric(12,2)`, never float.
- **Inventory:** constraints (`on_hand >= 0`, `reserved <= on_hand`) are a last-line defense; the conditional UPDATE inside `adjust_order_stock` is the primary race guard. `commit` honours `track_inventory` exactly like `reserve` (untracked variants are skipped by reserve/release/commit alike).
- **Soft delete:** catalog tables use `deleted_at`. Deleting a product archives it; `order_items` keep snapshots and FKs are `on delete set null`.
- **Tracking tokens:** only sha256(token + pepper) stored; the raw token exists only in the customer's link/notifications.
- **Idempotency:** `orders.idempotency_key` (checkout — `place_order` uses INSERT … ON CONFLICT + re-select, so concurrent retries return the filled order instead of a raw `23505`), `payment_transactions.idempotency_key`, `(provider, provider_txn_id)`, `webhook_events(provider,event_id)`, `notifications.dedupe_key`.

## Stock lifecycle
| Event | Function | Effect |
|---|---|---|
| Order placed (reserve on placed) | `place_order(...)` (reserve policy read from `cod.reserve_stock_on`; fee read from `shipping_rules`) | reserved += q |
| Order confirmed (reserve on confirmed) | `adjust_order_stock(id,'reserve')` | reserved += q, fails `INSUFFICIENT_STOCK` if insufficient |
| Cancelled / payment failed | `adjust_order_stock(id,'release')` | reserved -= q |
| Shipped | `adjust_order_stock(id,'commit')` | on_hand -= q, reserved -= q |
| Owner manual change | `admin_adjust_stock(variant, delta, 'manual_adjust', note)` (service-role; server calls after `requireAdmin` + audit) | on_hand +/- with ledger row |
Which of the first two applies is DECISION D2 (`cod.reserve_stock_on`), and the RPC reads it from settings rather than taking it as an argument. Card orders: reserve at creation, release if payment fails/expires (expiry job needed in PHASE 8).

## PHASE 02 follow-up list — executed 2026-10-06, status per item
1. **Done.** Migrations applied to the linked dev project (`0001` + `0002` + `0003_publish_page`). 2026-10-07: `supabase/seed.sql` applied here too — an environment is only "set up" once the migrations **and** the seed are in (D35).
2. **Done.** `src/types/database.ts` is generated and the app typechecks against it.
3. **Done.** Concurrent last-unit purchase (one winner, `INSUFFICIENT_STOCK` for the loser, no orphan row), idempotency replay, `commit` math and the negative-stock rejection were all proven live — results in `docs/RLS-MATRIX.md`; the SQL test file is `supabase/tests/01_rls_matrix.sql`. RLS was checked as anon for reads (0 rows), writes (`42501`) and function execution (`EXECUTE = false`); the authenticated non-admin half still needs a real user.
4. **Partly done.** Scripted SQL tests cover the matrix and the stock race. `admin_adjust_stock`'s own guards (bad reason, negative stock, reserved invariant) are **not** separately recorded as tested — treat them as unproven and cover them when that panel is next touched.
5. **Open.** No attribute-filter search RPC was added and no `EXPLAIN` pass is recorded; the catalog has not shown a slow-query problem at the current catalogue size (11 products). Revisit with real data.
6. **Decided 2026-10-06:** the `orders.customer_phone` index stays (D31 — fast support lookup for a single shop).
