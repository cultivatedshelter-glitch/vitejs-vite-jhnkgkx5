-- Curated Labor Cost Memory
-- Extends labor_rates so draft labor ranges can become human-verified labor memory.

create table if not exists public.labor_rates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trade text not null,
  job_type text,
  unit text not null default 'hour',
  low_rate numeric,
  typical_rate numeric,
  high_rate numeric,
  minimum_charge numeric not null default 0,
  trip_charge numeric not null default 0,
  disposal_fee numeric not null default 0,
  zip text,
  region text,
  source text,
  confidence text not null default 'labor_review',
  human_verified boolean not null default false,
  last_checked timestamptz,
  notes text
);

alter table public.labor_rates
  add column if not exists labor_hours_low numeric,
  add column if not exists labor_hours_high numeric,
  add column if not exists hourly_rate_low numeric,
  add column if not exists hourly_rate_high numeric,
  add column if not exists access_multiplier numeric not null default 1,
  add column if not exists setup_cleanup_hours numeric not null default 0,
  add column if not exists source_links jsonb not null default '[]'::jsonb,
  add column if not exists source_priority text,
  add column if not exists admin_override_note text,
  add column if not exists admin_edited boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

create index if not exists labor_rates_verified_priority_idx
  on public.labor_rates(human_verified, source_priority, updated_at desc);

create index if not exists labor_rates_trade_job_idx
  on public.labor_rates(trade, job_type);

alter table public.labor_rates enable row level security;

drop policy if exists "labor rates admin owner manage" on public.labor_rates;
create policy "labor rates admin owner manage"
on public.labor_rates
for all
to authenticated
using (public.current_user_role() in ('admin', 'owner'))
with check (public.current_user_role() in ('admin', 'owner'));

drop policy if exists "labor rates estimator read" on public.labor_rates;
create policy "labor rates estimator read"
on public.labor_rates
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));
