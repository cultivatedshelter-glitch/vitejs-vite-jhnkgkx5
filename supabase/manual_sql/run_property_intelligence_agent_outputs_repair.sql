-- Manual fallback: repair missing property_intelligence_agent_outputs table used by local property agents.
-- Paste into Supabase SQL Editor if migrations are not being run.
-- Keeps RLS enabled and does not add anon write access.

create table if not exists public.property_intelligence_agent_outputs (
  id uuid primary key default gen_random_uuid(),
  property_id text,
  lead_id text,
  request_id text,
  work_request_id text,
  repair_item_id text,
  agent_name text,
  output_type text,
  title text,
  summary text,
  input_summary text not null default '',
  output_json jsonb not null default '{}'::jsonb,
  assumptions text[] not null default '{}'::text[],
  confidence text,
  missing_info text[] not null default '{}'::text[],
  audit_notes text[] not null default '{}'::text[],
  payload jsonb default '{}'::jsonb,
  source_refs jsonb default '[]'::jsonb,
  status text default 'ai_draft',
  review_status text default 'needs_review',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  deleted_at timestamptz
);

alter table public.property_intelligence_agent_outputs
  add column if not exists property_id text,
  add column if not exists lead_id text,
  add column if not exists request_id text,
  add column if not exists work_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists agent_name text,
  add column if not exists output_type text,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists input_summary text not null default '',
  add column if not exists output_json jsonb not null default '{}'::jsonb,
  add column if not exists assumptions text[] not null default '{}'::text[],
  add column if not exists confidence text,
  add column if not exists missing_info text[] not null default '{}'::text[],
  add column if not exists audit_notes text[] not null default '{}'::text[],
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists source_refs jsonb default '[]'::jsonb,
  add column if not exists status text default 'ai_draft',
  add column if not exists review_status text default 'needs_review',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists deleted_at timestamptz;

create index if not exists property_intelligence_agent_outputs_property_idx
  on public.property_intelligence_agent_outputs(property_id);

create index if not exists property_intelligence_agent_outputs_lead_idx
  on public.property_intelligence_agent_outputs(lead_id);

create index if not exists property_intelligence_agent_outputs_request_idx
  on public.property_intelligence_agent_outputs(request_id);

create index if not exists property_intelligence_agent_outputs_work_request_idx
  on public.property_intelligence_agent_outputs(work_request_id);

create index if not exists property_intelligence_agent_outputs_agent_idx
  on public.property_intelligence_agent_outputs(agent_name);

create index if not exists property_intelligence_agent_outputs_status_idx
  on public.property_intelligence_agent_outputs(status);

create index if not exists property_intelligence_agent_outputs_deleted_at_idx
  on public.property_intelligence_agent_outputs(deleted_at);

create or replace function public.touch_property_intelligence_agent_outputs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_property_intelligence_agent_outputs_updated_at
on public.property_intelligence_agent_outputs;

create trigger touch_property_intelligence_agent_outputs_updated_at
before update on public.property_intelligence_agent_outputs
for each row execute function public.touch_property_intelligence_agent_outputs_updated_at();

alter table public.property_intelligence_agent_outputs enable row level security;

drop policy if exists "pilot can manage property intelligence agent outputs"
on public.property_intelligence_agent_outputs;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin_or_owner'
  ) then
    execute 'drop policy if exists "property intelligence agent outputs admin owner manage" on public.property_intelligence_agent_outputs';
    execute 'create policy "property intelligence agent outputs admin owner manage" on public.property_intelligence_agent_outputs for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())';
  end if;
end $$;

notify pgrst, 'reload schema';
