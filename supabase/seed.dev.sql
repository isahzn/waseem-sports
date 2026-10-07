-- seed.dev.sql — DEV ONLY, never for prod (Phase 02 task 5).
-- Demo catalog: one simple product (single default variant) + one product
-- with 3 explicit variants at different prices/stock. All slugs prefixed
-- TEST- so demo rows are unmistakable. Idempotent via slug upserts.
-- Apply: npx supabase db query --linked -f supabase/seed.dev.sql

-- Simple product: one hidden default variant, in stock.
insert into public.products(slug, name, base_price, status)
values ('TEST-DEMO-BALL', 'Demo Training Ball', 2500, 'published')
on conflict (slug) do update set name = excluded.name;
insert into public.product_variants(product_id, name, sku, is_default, options)
select id, 'Default', 'TEST-DEMO-BALL-1', true, '{}'::jsonb
from public.products where slug = 'TEST-DEMO-BALL'
on conflict do nothing;
update public.inventory i set on_hand = 50, reserved = 0 from public.product_variants v
where i.variant_id = v.id and v.sku = 'TEST-DEMO-BALL-1';

-- Multi-variant product: 3 sizes, different prices and stock (one empty).
insert into public.products(slug, name, base_price, status)
values ('TEST-DEMO-SHOE', 'Demo Court Shoe', 12000, 'published')
on conflict (slug) do update set name = excluded.name;
insert into public.product_variants(product_id, name, sku, price, is_default, options)
select id, x.name, x.sku, x.price, x.is_default, x.options from public.products p,
( values
  ('UK 7',  'TEST-DEMO-SHOE-7',  12000, true,  '{"size":"UK 7"}'::jsonb),
  ('UK 8',  'TEST-DEMO-SHOE-8',  12500, false, '{"size":"UK 8"}'::jsonb),
  ('UK 9',  'TEST-DEMO-SHOE-9',  13000, false, '{"size":"UK 9"}'::jsonb)
) as x(name, sku, price, is_default, options)
where p.slug = 'TEST-DEMO-SHOE'
on conflict do nothing;
update public.inventory i set on_hand = v.stock, reserved = 0
from ( values ('TEST-DEMO-SHOE-7', 10), ('TEST-DEMO-SHOE-8', 3), ('TEST-DEMO-SHOE-9', 0)
     ) as v(sku, stock)
join public.product_variants pv on pv.sku = v.sku
where i.variant_id = pv.id;
