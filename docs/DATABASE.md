# Database

Source of truth: `supabase/migrations/0001_init.sql` (**hardened in Phase 00**, 2026-10-06 — parsed with libpg_query, NOT yet run against a real Supabase project. PHASE 02 must apply and test it; from first apply, never edit it in place again).

## Tables (group -> purpose)
- **Access/config:** `admin_users` (role: owner/admin/staff/developer), `store_settings` (jsonb key/values; keys starting `public.` readable by storefront).
- **Taxonomy:** `sports`, `categories` (optional sport, self-parenting), `brands`. All have visible/sort/soft-delete; `sports`/`brands` carry `is_featured`.
- **Products:** `products` (incl. `compare_at_price`, `promo` jsonb, `published_at`, generated `search_tsv`), `product_variants` (options jsonb keyed by attribute slug, nullable price override, SKU), `product_images` (optional variant link, alt text, provenance incl. `license_note`), `attribute_definitions` + `product_attribute_values` (owner-defined specs).
- **Inventory:** `inventory` (on_hand, reserved, threshold, `track_inventory` — false means always sellable; the stock functions skip such variants entirely), `inventory_movements` (ledger, `order_id` FK → `orders`), view `variant_availability` (security-definer public projection of **only** `(product_id, variant_id, status)` for active variants of published, non-deleted products; untracked variants report `in_stock`).
- **Orders:** `orders` (incl. `stock_reserved`/`stock_committed` flags, `shipping_method`), `order_items` (snapshot), `order_status_history`, `payment_transactions`, `webhook_events`, `notifications` (outbox), `shipping_rules`.
- **CMS:** `pages` (homepage = slug `home`; incl. `layout`, `og_image_path`), `page_sections` (type + live `content` + `draft_content`).
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
Which of the first two applies is DECISION D2 (`cod.reserve_stock_on`). Card orders: reserve at creation, release if payment fails/expires (expiry job needed in PHASE 8).

## Things the agent must still do in PHASE 02
1. Apply migration to a fresh Supabase project (local via CLI preferred).
2. Generate TS types (`supabase gen types`) into `src/types/database.ts`.
3. Write SQL tests: concurrent last-unit purchase, concurrent same-`idempotency_key` `place_order` (must return one filled order, no raw `23505`), malformed-input named errors (`BAD_ITEM`, `BAD_CUSTOMER`, `UNAVAILABLE`, …), `variant_availability` hiding unpublished/deleted products, RLS as anon/authenticated non-admin/admin for every table (incl. proving anon-key admins **cannot** write `orders`/`inventory`/`payment_transactions` directly).
4. Add `pgTAP` or scripted tests (the manual-adjust function `admin_adjust_stock` already exists — test its guards: bad reason, negative stock, reserved invariant).
5. Add an attribute-filter search RPC if plain queries prove slow. Check `EXPLAIN` on catalog list + search.
6. Review: should `orders.customer_phone` index stay? (privacy vs lookup) — decide with the user.
