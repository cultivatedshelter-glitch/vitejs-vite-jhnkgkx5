-- Multi-agent property intelligence architecture.
-- Agents organize, estimate, audit, and recommend. Humans still approve final
-- scope, estimates, seller reports, contractor packages, and proposals.

create table if not exists public.property_intelligence_agent_outputs (
  id uuid primary key default gen_random_uuid(),
  property_id text,
  work_request_id text,
  repair_item_id text,
  agent_name text not null,
  input_summary text not null default '',
  output_json jsonb not null default '{}'::jsonb,
  assumptions text[] not null default '{}'::text[],
  confidence text not null default 'ai_draft',
  missing_info text[] not null default '{}'::text[],
  audit_notes text[] not null default '{}'::text[],
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'human_reviewed', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

alter table public.property_intelligence_agent_outputs
  add column if not exists property_id text,
  add column if not exists work_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists agent_name text not null default 'coordination_agent',
  add column if not exists input_summary text not null default '',
  add column if not exists output_json jsonb not null default '{}'::jsonb,
  add column if not exists assumptions text[] not null default '{}'::text[],
  add column if not exists confidence text not null default 'ai_draft',
  add column if not exists missing_info text[] not null default '{}'::text[],
  add column if not exists audit_notes text[] not null default '{}'::text[],
  add column if not exists status text not null default 'ai_draft',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text;

create index if not exists property_intelligence_agent_outputs_property_idx
  on public.property_intelligence_agent_outputs(property_id);

create index if not exists property_intelligence_agent_outputs_work_request_idx
  on public.property_intelligence_agent_outputs(work_request_id);

create index if not exists property_intelligence_agent_outputs_repair_item_idx
  on public.property_intelligence_agent_outputs(repair_item_id);

create index if not exists property_intelligence_agent_outputs_agent_idx
  on public.property_intelligence_agent_outputs(agent_name);

create index if not exists property_intelligence_agent_outputs_status_idx
  on public.property_intelligence_agent_outputs(status);

alter table public.property_intelligence_agent_outputs enable row level security;

drop policy if exists "pilot can manage property intelligence agent outputs"
on public.property_intelligence_agent_outputs;

create policy "pilot can manage property intelligence agent outputs"
on public.property_intelligence_agent_outputs
for all
to anon, authenticated
using (true)
with check (true);
