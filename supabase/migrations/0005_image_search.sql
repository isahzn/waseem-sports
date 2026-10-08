-- 0005_image_search.sql — Phase 09 recommendation seam (provider OPTIONAL).
-- Result cache (by normalized-query hash) + per-day quota counter so a
-- future live provider can never cause runaway cost. No provider is
-- configured yet (D6 open): both tables simply stay empty and the admin UI
-- shows "not configured". Never edit applied migrations (0001-0004).

create table public.image_search_cache (
  query_hash text primary key,
  queries jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);
create index image_search_cache_created_idx on public.image_search_cache(created_at desc);

create table public.image_search_quota (
  day text primary key,              -- YYYY-MM-DD
  count int not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS: admin/server-side only. No anon/authenticated access; every
-- read/write goes through the service-role client after requireAdmin().
alter table public.image_search_cache enable row level security;
alter table public.image_search_quota enable row level security;
revoke all on public.image_search_cache from public, anon, authenticated;
revoke all on public.image_search_quota from public, anon, authenticated;
grant all on public.image_search_cache to service_role;
grant all on public.image_search_quota to service_role;
