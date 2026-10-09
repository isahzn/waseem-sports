-- 0006_unify_sport_category.sql — Fixes §2.2 + §3.4: sports and categories
-- are one concept ("Sport") with one URL (/sport/[slug]).
--
-- What this migration does (forward-only, non-destructive):
--   1. Backfills products.sport_id from the linked category's sport_id
--      wherever the product has a category but no sport.
--   2. Adds a trigger that keeps sport_id in sync whenever category_id is
--      written (the admin still writes both fields until the code removal
--      lands; the trigger makes sport the effective source of truth).
--   3. Reports counts via RAISE NOTICE for the apply log.
--
-- What it deliberately does NOT do: drop the categories table or any column.
-- Categories are still referenced by products.category_id, the admin category
-- pages, searchTaxonomy, getNav, the seed script and RLS policies. Dropping
-- the table is step 2 of the merge and lands with the code removal (which
-- deletes those references first). Dropping it here would break the running
-- app. See docs/NEON-MIGRATION-PLAN.md §3 for the table-drop checklist.
--
-- TEST ON A COPY FIRST (brief requirement): apply to a staging branch
-- (Supabase branch or Neon migration-test branch), run the checks at the
-- bottom, then apply to production. Never hand-edit prod.
--
-- Never edit applied migrations (0001-0005); this is a new file.

-- 1. Backfill: product takes the sport of its category when it has none.
-- (The UPDATE lives inside the report block below so GET DIAGNOSTICS reads
-- the update's own row count — a standalone UPDATE would leave the DO block
-- reporting the count of an unrelated SELECT.)

-- 2. Sync trigger: category writes carry the sport forward.
create or replace function public.sync_product_sport_from_category()
returns trigger
language plpgsql as $$
begin
  if new.category_id is not null and
     (old.category_id is distinct from new.category_id or old.sport_id is distinct from new.sport_id or old.sport_id is null) then
    select c.sport_id into new.sport_id
    from public.categories c
    where c.id = new.category_id;
  end if;
  return new;
end $$;

drop trigger if exists products_sync_sport on public.products;
create trigger products_sync_sport
  before insert or update of category_id, sport_id on public.products
  for each row execute function public.sync_product_sport_from_category();

comment on function public.sync_product_sport_from_category() is
  'Fixes §3.4: sport is the canonical taxonomy. Category writes carry the linked sport forward until categories are removed.';

-- 3. Backfill + apply-log report: how many products still lack a sport, and
-- whether any category points nowhere (both should be investigated, not ignored).
do $$
declare
  v_backfilled int;
  v_sportless int;
  v_orphan_cats int;
begin
  update public.products p
  set sport_id = c.sport_id,
      updated_at = now()
  from public.categories c
  where p.category_id = c.id
    and p.sport_id is null
    and c.sport_id is not null
    and p.deleted_at is null;
  get diagnostics v_backfilled = row_count;
  select count(*) into v_sportless
  from public.products
  where sport_id is null and deleted_at is null and status <> 'archived';
  select count(*) into v_orphan_cats
  from public.categories
  where sport_id is null and deleted_at is null;
  raise notice '0006 unify: backfilled % product(s); % product(s) still without sport; % categor(ies) without sport',
    v_backfilled, v_sportless, v_orphan_cats;
end $$;

-- Checks to run on the copy after applying (expected results in brackets):
--   select count(*) from products where sport_id is null and deleted_at is null and status <> 'archived';  -- [0 ideally; every leftover is a product the owner must file under a sport]
--   select p.slug, c.name as category from products p join categories c on c.id = p.category_id
--    where p.sport_id is distinct from c.sport_id and p.deleted_at is null;  -- [0 rows: trigger keeps them in sync]
--   CMS + storefront smoke: open /shop, one /sport/<slug>, one /product/<slug>,
--   /admin/products (sport column filled), create a product with a category and
--   confirm its sport_id matches the category's sport.
