-- Technical defaults + researched shop facts. NO sports/categories/brands/products here — the owner creates those in the CMS.
-- (Demo catalog for development can live in supabase/seed.dev.sql, never applied to production.)
-- Contact values: address + two phones researched 2026-10-06 (shop Facebook post; see docs/DECISIONS.md).
-- Email and opening hours are NOT seeded (unverifiable) — the owner fills them in admin. The storefront must
-- hide blank contact rows, never render them empty.
insert into public.store_settings(key, value) values
  ('public.store_currency',    '"LKR"'),
  -- PLACEHOLDER pending D-NEW-1. 'WS' prefixes order numbers until the owner confirms or changes it in admin.
  ('order.number_prefix',      '"WS"'),
  ('public.store_name',        '"Waseem Sports"'),
  ('public.store_address',     '"130/6 Golden Plaza, Main Street, Colombo 11"'),
  ('public.store_phone_1',     '"077 009 0147"'),
  ('public.store_phone_2',     '"075 613 0147"'),
  -- Primary contact/WhatsApp number (first-listed hotline). Owner confirms in admin; see docs/DECISIONS.md.
  ('public.store_whatsapp',    '"077 009 0147"'),
  -- Recorded default; the 100 cap is no longer a magic constant in place_order (reads this key).
  ('order.max_qty_per_variant','100'),
  -- PLACEHOLDER pending DECISION D2 (COD stock reservation). 'placed' is the oversell-safe default.
  ('cod.reserve_stock_on',     '"placed"')
on conflict (key) do nothing;
