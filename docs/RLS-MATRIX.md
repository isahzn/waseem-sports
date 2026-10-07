# RLS Matrix — proven live 2026-10-06 (Phase 02, dev project)

Test file: `supabase/tests/01_rls_matrix.sql` (exit 0). Spot checks below were
read back as tables, not just exit codes.

## Update 2026-10-07 — what changed under these results

- **Storage:** the `product-media` bucket now exists and is **public-read** (Phase 04;
  holds `products/demo-NN.jpg` + `-thumb` derivatives from `scripts/seed-demo.mjs` and
  `originals/design-extract-*.jpg`). Public read is intentional — product photos are
  public assets and uploads go through the server. The bucket's write policies have not
  been re-tested as anon since it was created.
- **Admin reads/writes no longer ride on RLS (D43).** Admin screens and catalogue
  actions now use the service-role client (`adminDb()`) and every admin page calls
  `requireAdminOrRedirect()` before it reads; a layout redirect alone did not stop the
  page from running, which leaked admin data into a 307 body. So RLS is what protects the
  **anon/storefront** surface (everything above), while the **admin** surface is guarded
  by `requireAdmin()` / `requireAdminOrRedirect()`. Both layers are still in place — this
  only changes which one carries the admin screens.

Everything below is the 2026-10-06 record and still stands as written.

## Reads as anon — all return 0 rows

| Table | anon rows |
|---|---|
| orders, order_items, order_status_history | 0 |
| payment_transactions, webhook_events | 0 |
| notifications, audit_logs | 0 |
| inventory, inventory_movements | 0 |
| admin_users, rate_limits | 0 |

`variant_availability` (the safe projection) is selectable by anon and has no
quantity columns (`on_hand` probe → `undefined_column`).

## Writes as anon — all die with 42501

INSERT attempts on catalog + order/notification/audit tables: denied at the
privilege/RLS layer. The test rejects any other error code, so a NOT NULL
accident cannot masquerade as a pass.

## Functions — unexecutable by anon AND authenticated

`place_order`, `adjust_order_stock`, `admin_adjust_stock`, `publish_page`:
`has_function_privilege(...,'EXECUTE') = false` for both roles (service_role
only). Verified live: `anon_can_place_order = false`.

## Stock race (last unit, two parallel buyers) — 2026-10-06

Fixture: `Test Race Shoe` / `TEST-RACE-1`, `on_hand=1, reserved=0`.
Two simultaneous `place_order` calls (different idempotency keys):
- Buyer B won: order `ORD10000`, total 100.00, `stock_reserved=true`.
- Buyer A lost with `P0001: INSUFFICIENT_STOCK:<variant>` from
  `adjust_order_stock`; its order row rolled back (no orphan).
- Stock after: `on_hand=1, reserved=1` — never oversold, never negative.

## Idempotency

Replay of buyer B's call with the same key returned the same order id;
item count stayed 1 — no duplicate order, no duplicate items.

## reserve/release/commit math

- `commit` on the winning order: `1/1 → 0/0`, `stock_committed=true`.
- Direct `UPDATE inventory SET on_hand=-1`: rejected with `23514`
  (`inv_on_hand_nonneg`).

## Not proven here (see owning phase)

- Logged-in non-admin reads (needs a real user — **still no admin user exists**;
  create one per DEPLOYMENT.md step 2, then re-run §1 as that role). Since D43 the
  admin screens no longer depend on the admin-read policies, so this gap is about the
  policy record rather than admin access — but a non-admin *account* is still the thing
  that proves the policies separate staff from owner.
- Authenticated (non-admin) write attempts beyond function privileges.
- Storage-bucket RLS: the bucket now exists (public-read — see the update above), but
  its write policies have not been re-tested as anon.
- `pg_cron`/`pg_net` availability (V4 — Phase 06, not started).
