-- 0004_transfers.sql — Phase 08 bank-transfer automation prototype (MOCK ONLY).
-- Sandbox/test transfers with explicit approval, idempotency and a full
-- state machine. No real bank is connected; the provider layer is swappable
-- (see src/lib/transfers/types.ts — the real-provider connection point).
-- Never edit applied migrations (0001-0003); this is a new file.

create table public.money_transfers (
  id uuid primary key default gen_random_uuid(),
  -- Idempotency: one confirmed request can never create two transfers.
  idempotency_key text not null unique,
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','processing','completed','failed','cancelled','expired')),
  -- Sender (sandbox method only — never real credentials, PINs, OTPs, CVVs).
  sender_method text not null default 'sandbox_balance',
  provider text not null default 'mock',
  sender_account_ref text not null default 'sandbox-main',
  -- Recipient.
  recipient_name text not null,
  recipient_bank text not null,
  recipient_account text not null,
  recipient_branch text,
  recipient_contact text,
  -- Money (server recomputes fee/total; never trusts the client).
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'LKR',
  fee numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  reference text,
  description text,
  -- Provider linkage + verification.
  provider_tx_id text,
  last_error text,
  confirmed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index money_transfers_status_idx on public.money_transfers(status, created_at desc);
create index money_transfers_provider_tx_idx on public.money_transfers(provider_tx_id);

-- Timeline: every state change is recorded (powers the detail view).
create table public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.money_transfers(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index transfer_events_transfer_idx on public.transfer_events(transfer_id, created_at);

-- updated_at trigger (same pattern as 0001).
create or replace function public.touch_money_transfers_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists money_transfers_touch on public.money_transfers;
create trigger money_transfers_touch
  before update on public.money_transfers
  for each row execute function public.touch_money_transfers_updated_at();

-- RLS: transfers are admin/server-side only. No anon/authenticated access;
-- every read/write goes through the service-role client after requireAdmin().
alter table public.money_transfers enable row level security;
alter table public.transfer_events enable row level security;
revoke all on public.money_transfers from public, anon, authenticated;
revoke all on public.transfer_events from public, anon, authenticated;
grant all on public.money_transfers to service_role;
grant all on public.transfer_events to service_role;
