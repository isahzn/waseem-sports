-- =====================================================================
-- 0001_init.sql  — Waseem Sports commerce core
-- Starting point. Agent: review in PHASE 02, then apply via Supabase CLI.
-- VERIFY against current Supabase docs: storage.buckets columns, auth.uid().
--
-- HARDENED in Phase 00 (2026-10-06, specs/phase-00-fix-spec.md §5.10).
-- This file has NEVER been applied to any environment (no Supabase project
-- exists yet), so in-place editing is used once to keep a single clean
-- history. From the moment a real environment applies it, the
-- never-edit-applied-migrations rule binds and all further changes become
-- new 0002_*.sql files.
--
-- Hardening summary (see docs/DATABASE.md for the full account):
--  * role-aware admin helpers: is_admin() (any active admin) + admin_role()
--    so the SECURITY.md role matrix is expressible in SQL.
--  * stock/order/payment tables are service-role-only for writes; admins keep
--    RLS read access. All mutations go through server actions that call
--    requireAdmin(role) and then the service-role client (ARCHITECTURE.md).
--  * variant_availability is a security-definer public projection exposing
--    ONLY (product_id, variant_id, status) for visible, non-deleted catalog.
--    No quantities, no unpublished/deleted ids.
--  * place_order reads the shipping fee and the reserve policy from the DB
--    (never trusts the caller), closes the idempotency race with
--    INSERT ... ON CONFLICT + re-select, and raises named errors for
--    malformed input. Per-variant max quantity is a setting.
--  * commit honours track_inventory exactly like reserve (untracked variants
--    are skipped everywhere, consistently).
--  * inventory_movements.order_id has an FK; store_settings.updated_at is
--    trigger-maintained; admin_adjust_stock(...) exists with a ledger row.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------- enums ----------
create type content_status as enum ('draft','published','archived');
create type order_status   as enum ('new','confirmed','processing','shipped','delivered','cancelled','payment_failed','refunded');
create type payment_status as enum ('unpaid','pending','paid','failed','refunded','partially_refunded');

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- admin access ----------
create table public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner','admin','staff','developer')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Any active admin (any role). Used by RLS read policies below.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and is_active);
$$;

-- The caller's admin role, or null when not an active admin. Lets RLS and
-- server code express the SECURITY.md role matrix (e.g. only 'owner' edits
-- settings/payments/admin users). Direct calls revoked from anon/authenticated
-- (policies invoking it run as definer and are unaffected).
create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = auth.uid() and is_active;
$$;
revoke all on function public.admin_role() from public, anon, authenticated;

-- ---------- settings (key/value; anything the owner may configure) ----------
create table public.store_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ---------- catalog taxonomy ----------
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_path text, image_alt text,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  seo_title text, seo_description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid references public.sports(id) on delete set null,      -- optional: categories may be global
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name text not null,
  description text,
  image_path text, image_alt text,
  is_visible boolean not null default true,
  sort_order int not null default 0,
  seo_title text, seo_description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index categories_sport_idx  on public.categories(sport_id) where deleted_at is null;
create index categories_parent_idx on public.categories(parent_id) where deleted_at is null;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  logo_path text, logo_alt text,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- products ----------
-- Every product has >=1 variant. "Simple" product = exactly one hidden default variant.
-- This keeps stock, cart and order logic identical for both cases.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,                                  -- plain text/markdown, sanitized on render (no raw HTML)
  sport_id uuid references public.sports(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  base_price numeric(12,2) not null check (base_price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  status content_status not null default 'draft',
  is_featured boolean not null default false,
  promo jsonb,                                        -- optional promo label/dates, validated by zod
  seo_title text, seo_description text,
  search_tsv tsvector generated always as (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))) stored,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index products_status_idx   on public.products(status) where deleted_at is null;
create index products_sport_idx    on public.products(sport_id) where deleted_at is null;
create index products_category_idx on public.products(category_id) where deleted_at is null;
create index products_brand_idx    on public.products(brand_id) where deleted_at is null;
create index products_created_idx  on public.products(created_at desc);
create index products_tsv_idx      on public.products using gin(search_tsv);
create index products_name_trgm    on public.products using gin(name gin_trgm_ops);

-- Owner-defined attributes (Brand-like specs, Weight, Material, Surface...). Nothing hardcoded.
create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  input_type text not null default 'text' check (input_type in ('text','number','select','boolean')),
  options jsonb,                                      -- allowed values for 'select'
  is_filterable boolean not null default false,
  is_variant_option boolean not null default false,   -- usable as a variant dimension (size, colour...)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_attribute_values (        -- descriptive specs shown on the product page
  product_id   uuid not null references public.products(id) on delete cascade,
  attribute_id uuid not null references public.attribute_definitions(id) on delete cascade,
  value_text   text not null,
  primary key (product_id, attribute_id)
);
create index pav_attr_value_idx on public.product_attribute_values(attribute_id, value_text);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default 'Default',
  sku text,
  price numeric(12,2) check (price is null or price >= 0),   -- null => use product.base_price
  options jsonb not null default '{}'::jsonb,                 -- {"size":"SH","colour":"Natural"} keyed by attribute slug
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index variants_sku_uq       on public.product_variants(sku) where sku is not null and deleted_at is null;
create unique index variants_one_default  on public.product_variants(product_id) where is_default and deleted_at is null;
create index variants_product_idx         on public.product_variants(product_id) where deleted_at is null;
create index variants_options_gin         on public.product_variants using gin(options);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  storage_path text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  source_url text, source_note text, license_note text,        -- provenance for imported images
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id, sort_order);
create unique index product_images_one_primary on public.product_images(product_id) where is_primary;

-- ---------- inventory ----------
create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  on_hand int not null default 0,
  reserved int not null default 0,
  low_stock_threshold int not null default 5,
  track_inventory boolean not null default true,      -- false => always sellable; stock functions skip the variant
  updated_at timestamptz not null default now(),
  constraint inv_on_hand_nonneg check (on_hand >= 0),
  constraint inv_reserved_nonneg check (reserved >= 0),
  constraint inv_reserved_le_on_hand check (reserved <= on_hand)
);

create table public.inventory_movements (              -- append-only ledger
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  on_hand_delta int not null default 0,
  reserved_delta int not null default 0,
  reason text not null,                                 -- 'manual_adjust','reserve','release','commit','initial'
  order_id uuid,                                        -- FK added below (orders is created later in this file)
  actor uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);
create index inv_mov_variant_idx on public.inventory_movements(variant_id, created_at desc);

create or replace function public.create_inventory_row() returns trigger
language plpgsql as $$ begin insert into public.inventory(variant_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger variants_create_inventory after insert on public.product_variants
  for each row execute function public.create_inventory_row();

-- Public-safe availability: a deliberate security-definer projection (anon has
-- no inventory policy, so an invoker view would return nothing). Safe by
-- construction: only (product_id, variant_id, status) — no quantities — and
-- only for active variants of published, non-deleted products. Untracked
-- variants report 'in_stock' (their counts are meaningless by design).
create or replace view public.variant_availability with (security_invoker = false) as
  select pv.product_id, i.variant_id,
         case when not i.track_inventory then 'in_stock'
              when (i.on_hand - i.reserved) <= 0 then 'out_of_stock'
              when (i.on_hand - i.reserved) <= i.low_stock_threshold then 'low_stock'
              else 'in_stock' end as status
  from public.inventory i
  join public.product_variants pv on pv.id = i.variant_id
  join public.products p on p.id = pv.product_id
  where pv.is_active and pv.deleted_at is null
    and p.status = 'published' and p.deleted_at is null;
grant select on public.variant_availability to anon, authenticated;

-- ---------- shipping ----------
create table public.shipping_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_codes text[] not null default '{}',           -- ISO codes; empty = not matched
  regions text[] not null default '{}',
  method text not null default 'standard',
  fee numeric(12,2) not null default 0 check (fee >= 0),
  free_over numeric(12,2) check (free_over is null or free_over >= 0),
  est_days_min int, est_days_max int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- orders ----------
create sequence public.order_number_seq start 10000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  tracking_token_hash text not null unique,             -- sha256 of the secret token in the customer's link
  idempotency_key text not null unique,
  status order_status not null default 'new',
  payment_status payment_status not null default 'unpaid',
  payment_method text not null,                         -- 'cod', provider code... (open-ended on purpose)
  currency text not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  customer_name text not null, customer_phone text not null, customer_email text,
  shipping_address jsonb not null,
  shipping_method text,
  notes text,
  stock_reserved boolean not null default false,
  stock_committed boolean not null default false,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx  on public.orders(status, placed_at desc);
create index orders_created_idx on public.orders(placed_at desc);
create index orders_phone_idx   on public.orders(customer_phone);

create table public.order_items (                        -- SNAPSHOT: survives product edits/deletes
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null, variant_name text, sku text,
  attributes jsonb not null default '{}'::jsonb,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status order_status, to_status order_status not null,
  actor uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);
create index osh_order_idx on public.order_status_history(order_id, created_at);

-- Deferred FK: inventory_movements was created before orders (see above).
alter table public.inventory_movements
  add constraint inv_mov_order_fk foreign key (order_id)
  references public.orders(id) on delete set null;

-- ---------- payments / webhooks ----------
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_txn_id text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  status text not null check (status in ('created','pending','succeeded','failed','refunded')),
  idempotency_key text unique,
  raw jsonb,                                            -- sanitized provider payload, never card data
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index ptx_provider_txn_uq on public.payment_transactions(provider, provider_txn_id) where provider_txn_id is not null;
create index ptx_order_idx on public.payment_transactions(order_id);

create table public.webhook_events (                     -- replay protection + audit
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

-- ---------- notifications (outbox) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  event text not null,                                  -- 'order_placed','order_shipped',...
  recipient text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  provider text, attempts int not null default 0, last_error text,
  dedupe_key text not null unique,                      -- order_id:event:channel => no duplicates
  created_at timestamptz not null default now(), sent_at timestamptz
);
create index notifications_queue_idx on public.notifications(status, created_at) where status in ('queued','failed');

-- ---------- CMS pages ----------
-- The homepage is just the page with slug 'home'. One system for all pages.
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  layout text not null default 'default',
  status content_status not null default 'draft',
  seo_title text, seo_description text, og_image_path text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null,                                   -- 'hero','featured_products',... validated by zod in app
  content jsonb not null default '{}'::jsonb,           -- LIVE content
  draft_content jsonb,                                  -- unpublished edits (null = no pending draft)
  is_visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index page_sections_page_idx on public.page_sections(page_id, sort_order);

-- ---------- audit ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,                                 -- 'product.update','order.status', ...
  entity text, entity_id text,
  meta jsonb,                                           -- no secrets, no passwords, minimal PII
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs(created_at desc);
create index audit_entity_idx  on public.audit_logs(entity, entity_id);

-- ---------- updated_at triggers ----------
do $$ declare t text; begin
  foreach t in array array['sports','categories','brands','products','product_variants','shipping_rules','orders','payment_transactions','pages','page_sections','inventory','store_settings']
  loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop;
end $$;

-- =====================================================================
-- STOCK + ORDER FUNCTIONS  (service_role only)
-- available = on_hand - reserved.
-- reserve: reserved += q   | release: reserved -= q | commit (shipped): on_hand -= q, reserved -= q
-- The conditional UPDATE is the race-proof gate: two buyers of the last unit => one gets 0 rows updated.
-- Untracked variants (track_inventory = false) are skipped by every action:
-- their counts are meaningless by design, so reserve/release/commit leave
-- them untouched (this keeps commit consistent with reserve — F5.8).
-- =====================================================================
create or replace function public.adjust_order_stock(p_order_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; r record; v_track boolean;
begin
  if p_action not in ('reserve','release','commit') then raise exception 'BAD_ACTION'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if p_action = 'reserve' and (v_order.stock_reserved or v_order.stock_committed) then return; end if;
  if p_action in ('release','commit') and not v_order.stock_reserved then return; end if;

  for r in
    select oi.variant_id, sum(oi.quantity)::int as q
    from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id order by oi.variant_id            -- fixed order => no deadlocks
  loop
    select i.track_inventory into v_track from public.inventory i where i.variant_id = r.variant_id;
    if not found or not v_track then continue; end if;      -- untracked or missing row: nothing to move
    if p_action = 'reserve' then
      update public.inventory set reserved = reserved + r.q
        where variant_id = r.variant_id and on_hand - reserved >= r.q;
      if not found then raise exception 'INSUFFICIENT_STOCK:%', r.variant_id; end if;
      insert into public.inventory_movements(variant_id, reserved_delta, reason, order_id) values (r.variant_id, r.q, 'reserve', p_order_id);
    elsif p_action = 'release' then
      update public.inventory set reserved = reserved - r.q where variant_id = r.variant_id;
      if not found then raise exception 'VARIANT_MISSING:%', r.variant_id; end if;
      insert into public.inventory_movements(variant_id, reserved_delta, reason, order_id) values (r.variant_id, -r.q, 'release', p_order_id);
    else
      update public.inventory set on_hand = on_hand - r.q, reserved = reserved - r.q where variant_id = r.variant_id;
      if not found then raise exception 'VARIANT_MISSING:%', r.variant_id; end if;
      insert into public.inventory_movements(variant_id, on_hand_delta, reserved_delta, reason, order_id) values (r.variant_id, -r.q, -r.q, 'commit', p_order_id);
    end if;
  end loop;

  update public.orders set
    stock_reserved  = (p_action = 'reserve'),
    stock_committed = stock_committed or (p_action = 'commit')
  where id = p_order_id;
end $$;

-- Creates order + items (price/name snapshot from DB) and optionally reserves stock, all in ONE transaction.
-- Idempotent on p_idempotency_key: INSERT ... ON CONFLICT + re-select closes the
-- concurrent-retry race; a replay returns the already-filled order, and a retry
-- after a crashed attempt takes over the still-empty order row.
-- The shipping fee comes from shipping_rules (method match, free_over applied
-- against the subtotal); no matching active rule => 0 (D5 seeds real rules).
-- Whether stock reserves now comes from the cod.reserve_stock_on setting
-- ('placed' => reserve here; 'confirmed' => reserve on the confirm transition).
-- Per-variant max quantity comes from order.max_qty_per_variant (default 100).
create or replace function public.place_order(
  p_idempotency_key text, p_tracking_token_hash text,
  p_items jsonb,                    -- [{"variant_id":"uuid","quantity":2}]
  p_customer jsonb,                 -- {"name","phone","email"}
  p_shipping_address jsonb, p_shipping_method text,
  p_payment_method text, p_notes text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders; r record; v_subtotal numeric(12,2) := 0;
  v_prefix text; v_currency text; v_fee numeric(12,2) := 0; v_free_over numeric(12,2);
  v_reserve_on text; v_max_qty int; v_item record; v_count int;
begin
  if p_idempotency_key is null or p_idempotency_key = '' then raise exception 'BAD_IDEMPOTENCY_KEY'; end if;
  if p_tracking_token_hash is null or p_tracking_token_hash = '' then raise exception 'BAD_TOKEN'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;
  if p_customer is null or coalesce(p_customer->>'name','') = '' or coalesce(p_customer->>'phone','') = '' then raise exception 'BAD_CUSTOMER'; end if;

  select coalesce(value #>> '{}', 'ORD') into v_prefix   from public.store_settings where key = 'order.number_prefix';
  select coalesce(value #>> '{}', 'LKR') into v_currency from public.store_settings where key = 'public.store_currency';
  select coalesce((value #>> '{}')::int, 100) into v_max_qty from public.store_settings where key = 'order.max_qty_per_variant';
  select coalesce(value #>> '{}', 'placed') into v_reserve_on from public.store_settings where key = 'cod.reserve_stock_on';

  -- Validate every line before touching the DB: uuid-shaped variant_id, integer quantity in range.
  for v_item in select e as e from jsonb_array_elements(p_items) e
  loop
    begin
      if (v_item.e->>'variant_id')::uuid is null then raise exception 'BAD_ITEM'; end if;
    exception when invalid_text_representation then raise exception 'BAD_ITEM'; end;
    begin
      if (v_item.e->>'quantity')::int is null then raise exception 'BAD_ITEM'; end if;
    exception when invalid_text_representation then raise exception 'BAD_ITEM'; end;
    if (v_item.e->>'quantity')::int < 1 or (v_item.e->>'quantity')::int > coalesce(v_max_qty, 100) then raise exception 'INVALID_QUANTITY'; end if;
  end loop;

  insert into public.orders(order_number, tracking_token_hash, idempotency_key, payment_method, payment_status, currency,
                            subtotal, shipping_fee, total, customer_name, customer_phone, customer_email,
                            shipping_address, shipping_method, notes)
  values (coalesce(v_prefix,'ORD') || nextval('public.order_number_seq'), p_tracking_token_hash, p_idempotency_key, p_payment_method,
          case when p_payment_method = 'cod' then 'unpaid'::payment_status else 'pending'::payment_status end,
          coalesce(v_currency,'LKR'), 0, 0, 0,
          p_customer->>'name', p_customer->>'phone', nullif(p_customer->>'email',''),
          p_shipping_address, p_shipping_method, p_notes)
  on conflict (idempotency_key) do nothing
  returning * into v_order;

  if not found then
    -- Lost the race (or replaying): lock the winner's row and see if it is already filled.
    select * into v_order from public.orders where idempotency_key = p_idempotency_key for update;
    if not found then raise exception 'ORDER_CONFLICT'; end if;
    perform 1 from public.order_items where order_id = v_order.id limit 1;
    if found then return v_order; end if;                 -- idempotent replay
    -- else: orphaned empty row from a crashed attempt; this call takes it over.
  end if;

  for r in
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    declare v record; begin
      select pv.id vid, pv.name vname, pv.sku, pv.options, coalesce(pv.price, p.base_price) price, p.id pid, p.name pname
        into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.id = r.variant_id and pv.is_active and pv.deleted_at is null
        and p.status = 'published' and p.deleted_at is null;
      if not found then raise exception 'UNAVAILABLE:%', r.variant_id; end if;
      insert into public.order_items(order_id, product_id, variant_id, product_name, variant_name, sku, attributes, unit_price, quantity, line_total)
      values (v_order.id, v.pid, v.vid, v.pname, v.vname, v.sku, v.options, v.price, r.qty, v.price * r.qty);
      v_subtotal := v_subtotal + v.price * r.qty;
    end;
  end loop;

  -- Shipping fee from the DB: first active rule for the requested method.
  select fee, free_over into v_fee, v_free_over from public.shipping_rules
    where method = p_shipping_method and is_active order by sort_order limit 1;
  if not found then v_fee := 0; v_free_over := null; end if;
  if v_free_over is not null and v_subtotal >= v_free_over then v_fee := 0; end if;

  update public.orders set subtotal = v_subtotal, shipping_fee = coalesce(v_fee,0), total = v_subtotal + coalesce(v_fee,0) where id = v_order.id;
  insert into public.order_status_history(order_id, to_status, note) values (v_order.id, 'new', 'Order placed');

  if coalesce(v_reserve_on,'placed') = 'placed' then perform public.adjust_order_stock(v_order.id, 'reserve'); end if;

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end $$;

-- Owner-initiated stock correction with a ledger row. Service-role only;
-- server code calls it after requireAdmin(role) + audit(). This is the
-- manual-adjust path DATABASE.md advertises (reason 'manual_adjust').
create or replace function public.admin_adjust_stock(
  p_variant_id uuid, p_on_hand_delta int, p_reason text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_reason not in ('manual_adjust','initial','recount') then raise exception 'BAD_REASON'; end if;
  update public.inventory set on_hand = on_hand + p_on_hand_delta
    where variant_id = p_variant_id
      and on_hand + p_on_hand_delta >= 0
      and reserved <= on_hand + p_on_hand_delta;
  if not found then raise exception 'BAD_ADJUSTMENT'; end if;
  insert into public.inventory_movements(variant_id, on_hand_delta, reason, note)
  values (p_variant_id, p_on_hand_delta, p_reason, p_note);
end $$;

revoke all on function public.adjust_order_stock(uuid, text) from public, anon, authenticated;
revoke all on function public.place_order(text,text,jsonb,jsonb,jsonb,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_adjust_stock(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.adjust_order_stock(uuid, text) to service_role;
grant execute on function public.place_order(text,text,jsonb,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.admin_adjust_stock(uuid, int, text, text) to service_role;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Storefront (anon) reads only published/visible catalog. Orders, payments,
-- stock, webhooks and audit are service-role-only for writes; admins get RLS
-- READ access and mutate through server actions (requireAdmin + service role).
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['admin_users','store_settings','sports','categories','brands','products','attribute_definitions',
    'product_attribute_values','product_variants','product_images','inventory','inventory_movements','shipping_rules','orders',
    'order_items','order_status_history','payment_transactions','webhook_events','notifications','pages','page_sections','audit_logs']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- public catalog reads
create policy "public read sports"     on public.sports     for select to anon, authenticated using (is_visible and deleted_at is null);
create policy "public read categories" on public.categories for select to anon, authenticated using (is_visible and deleted_at is null);
create policy "public read brands"     on public.brands     for select to anon, authenticated using (is_visible and deleted_at is null);
create policy "public read products"   on public.products   for select to anon, authenticated using (status = 'published' and deleted_at is null);
create policy "public read variants"   on public.product_variants for select to anon, authenticated
  using (is_active and deleted_at is null and exists (select 1 from public.products p where p.id = product_id and p.status = 'published' and p.deleted_at is null));
create policy "public read images"     on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published' and p.deleted_at is null));
create policy "public read attr defs"  on public.attribute_definitions for select to anon, authenticated using (true);
create policy "public read attr values" on public.product_attribute_values for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published' and p.deleted_at is null));
create policy "public read pages"      on public.pages for select to anon, authenticated using (status = 'published' and deleted_at is null);
create policy "public read sections"   on public.page_sections for select to anon, authenticated
  using (is_visible and exists (select 1 from public.pages pg where pg.id = page_id and pg.status = 'published' and pg.deleted_at is null));
create policy "public read shipping"   on public.shipping_rules for select to anon, authenticated using (is_active);
create policy "public read public settings" on public.store_settings for select to anon, authenticated using (key like 'public.%');
create policy "admin reads self"       on public.admin_users for select to authenticated using (user_id = auth.uid());

-- admins: full access to catalog/CMS/settings/notifications. Stock, orders,
-- payments, webhooks and audit are READ-only here — writes go through the
-- service-role functions above (called by server actions after
-- requireAdmin(role)). Fine-grained roles are enforced in server code, with
-- admin_role() available for SQL-level checks.
do $$ declare t text; begin
  foreach t in array array['store_settings','sports','categories','brands','products','attribute_definitions','product_attribute_values',
    'product_variants','product_images','shipping_rules','notifications','pages','page_sections']
  loop execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t); end loop;
end $$;
create policy "admin read inventory"   on public.inventory   for select to authenticated using (public.is_admin());
create policy "admin read movements"   on public.inventory_movements for select to authenticated using (public.is_admin());
create policy "admin read orders"      on public.orders      for select to authenticated using (public.is_admin());
create policy "admin read order items" on public.order_items for select to authenticated using (public.is_admin());
create policy "admin read osh"         on public.order_status_history for select to authenticated using (public.is_admin());
create policy "admin read ptx"         on public.payment_transactions for select to authenticated using (public.is_admin());
create policy "admin read audit"       on public.audit_logs  for select to authenticated using (public.is_admin());
create policy "admin read webhooks"    on public.webhook_events for select to authenticated using (public.is_admin());
-- audit_logs / webhook_events / admin_users writes: service_role only (server code).
-- admin_users reads: own row only (see "admin reads self"); invites/role edits are service-role-only.

-- =====================================================================
-- STORAGE  (VERIFY current Supabase Storage schema before applying)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create policy "public read product-media" on storage.objects for select using (bucket_id = 'product-media');
create policy "admin write product-media" on storage.objects for all to authenticated
  using (bucket_id = 'product-media' and public.is_admin()) with check (bucket_id = 'product-media' and public.is_admin());
