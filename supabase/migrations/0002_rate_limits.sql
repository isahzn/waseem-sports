-- 0002_rate_limits.sql — Phase 01 (D8: Postgres rate-limit store, no new vendor).
-- Never applied yet (applies with the dev project in Phase 01/02).

create table if not exists public.rate_limits (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_key_created_idx
  on public.rate_limits (key, created_at);

-- No public access: only service_role touches this table (via requireAdmin
-- server code / login actions). No RLS policies => no anon/authenticated
-- role can read or write even with RLS enabled.
alter table public.rate_limits enable row level security;
