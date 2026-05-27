-- Estimate review schema safety net plus Job Packet / AI Research Draft support.
-- This migration is intentionally re-runnable: every app-used column is added
-- with IF NOT EXISTS so older Supabase projects can catch up safely.

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  lead_id text,
  created_at timestamptz not null default now(),
  item_name text not null default '',
  source text,
  source_url text,
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  confidence text,
  human_approved boolean not null default false
);

alter table public.estimate_items
  add column if not exists research_id text,
  add column if not exists lead_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id text,
  add column if not exists job_id text,
  add column if not exists request_id text,
  add column if not exists repair_item_id text,
  add column if not exists item_name text not null default '',
  add column if not exists category text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists quantity numeric,
  add column if not exists unit_price numeric,
  add column if not exists original_unit_price numeric,
  add column if not exists total_price numeric,
  add column if not exists required_quantity numeric,
  add column if not exists required_unit text,
  add column if not exists package_size numeric,
  add column if not exists package_unit text,
  add column if not exists package_coverage numeric,
  add column if not exists package_coverage_unit text,
  add column if not exists packages_needed numeric,
  add column if not exists package_price numeric,
  add column if not exists extended_total numeric,
  add column if not exists quantity_reason text,
  add column if not exists scope_source text,
  add column if not exists relevance_reason text,
  add column if not exists source_status text not null default 'needs_source_review',
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists status text not null default 'needs_review',
  add column if not exists rejection_reason text,
  add column if not exists admin_notes text,
  add column if not exists confidence text,
  add column if not exists human_approved boolean not null default false;

create index if not exists estimate_items_lead_id_idx on public.estimate_items(lead_id);
create index if not exists estimate_items_property_id_idx on public.estimate_items(property_id);
create index if not exists estimate_items_job_id_idx on public.estimate_items(job_id);
create index if not exists estimate_items_request_id_idx on public.estimate_items(request_id);
create index if not exists estimate_items_repair_item_id_idx on public.estimate_items(repair_item_id);
create index if not exists estimate_items_review_status_idx on public.estimate_items(review_status);
create index if not exists estimate_items_status_idx on public.estimate_items(status);
create index if not exists estimate_items_source_status_idx on public.estimate_items(source_status);

create table if not exists public.job_execution_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text,
  job_request_id text,
  repair_item_id text,
  step_number integer not null default 1,
  title text not null default '',
  labor_scope text not null default '',
  trade text not null default '',
  estimated_hours_low numeric not null default 0,
  estimated_hours_high numeric not null default 0,
  materials_tools text not null default '',
  equipment text not null default '',
  safety_notes text not null default '',
  access_notes text not null default '',
  cleanup_notes text not null default '',
  disposal_needed boolean not null default false,
  confidence text not null default 'ai_draft',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text not null default ''
);

alter table public.job_execution_steps
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id text,
  add column if not exists job_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists step_number integer not null default 1,
  add column if not exists title text not null default '',
  add column if not exists labor_scope text not null default '',
  add column if not exists trade text not null default '',
  add column if not exists estimated_hours_low numeric not null default 0,
  add column if not exists estimated_hours_high numeric not null default 0,
  add column if not exists materials_tools text not null default '',
  add column if not exists equipment text not null default '',
  add column if not exists safety_notes text not null default '',
  add column if not exists access_notes text not null default '',
  add column if not exists cleanup_notes text not null default '',
  add column if not exists disposal_needed boolean not null default false,
  add column if not exists confidence text not null default 'ai_draft',
  add column if not exists status text not null default 'ai_draft',
  add column if not exists admin_notes text not null default '';

create index if not exists job_execution_steps_job_request_idx on public.job_execution_steps(job_request_id);
create index if not exists job_execution_steps_property_idx on public.job_execution_steps(property_id);
create index if not exists job_execution_steps_repair_item_idx on public.job_execution_steps(repair_item_id);
create index if not exists job_execution_steps_status_idx on public.job_execution_steps(status);

create table if not exists public.job_execution_step_learning (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  work_type text,
  repair_description_context text,
  step_title text,
  labor_scope text,
  approved_hours numeric,
  rejected_reason text,
  admin_notes text,
  confidence_before text,
  confidence_after text,
  reviewed_at timestamptz not null default now()
);

alter table public.job_execution_step_learning
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists work_type text,
  add column if not exists repair_description_context text,
  add column if not exists step_title text,
  add column if not exists labor_scope text,
  add column if not exists approved_hours numeric,
  add column if not exists rejected_reason text,
  add column if not exists admin_notes text,
  add column if not exists confidence_before text,
  add column if not exists confidence_after text,
  add column if not exists reviewed_at timestamptz not null default now();

create index if not exists job_execution_step_learning_work_type_idx on public.job_execution_step_learning(work_type);
create index if not exists job_execution_step_learning_reviewed_at_idx on public.job_execution_step_learning(reviewed_at);

create table if not exists public.ai_research_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id text,
  property_id text,
  job_request_id text,
  repair_item_id text,
  research_topic text not null default '',
  source_name text not null default '',
  source_url text not null default '',
  item_material_name text not null default '',
  observed_price numeric,
  availability_note text not null default '',
  confidence text not null default 'ai_draft',
  screenshot_file_reference text not null default '',
  ai_notes text not null default '',
  human_review_status text not null default 'ai_draft'
    check (human_review_status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text not null default '',
  reviewed_at timestamptz
);

alter table public.ai_research_drafts
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists lead_id text,
  add column if not exists property_id text,
  add column if not exists job_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists research_topic text not null default '',
  add column if not exists source_name text not null default '',
  add column if not exists source_url text not null default '',
  add column if not exists item_material_name text not null default '',
  add column if not exists observed_price numeric,
  add column if not exists availability_note text not null default '',
  add column if not exists confidence text not null default 'ai_draft',
  add column if not exists screenshot_file_reference text not null default '',
  add column if not exists ai_notes text not null default '',
  add column if not exists human_review_status text not null default 'ai_draft',
  add column if not exists admin_notes text not null default '',
  add column if not exists reviewed_at timestamptz;

create index if not exists ai_research_drafts_lead_idx on public.ai_research_drafts(lead_id);
create index if not exists ai_research_drafts_job_request_idx on public.ai_research_drafts(job_request_id);
create index if not exists ai_research_drafts_review_status_idx on public.ai_research_drafts(human_review_status);

create table if not exists public.job_packets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id text,
  property_id text,
  job_request_id text,
  property_address text,
  file_name text,
  generated_at timestamptz not null default now(),
  generated_by text,
  packet_status text not null default 'generated',
  approved_labor_hours numeric not null default 0,
  estimate_total numeric not null default 0,
  review_status text not null default 'needs_review',
  metadata jsonb not null default '{}'::jsonb
);

alter table public.job_packets
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists lead_id text,
  add column if not exists property_id text,
  add column if not exists job_request_id text,
  add column if not exists property_address text,
  add column if not exists file_name text,
  add column if not exists generated_at timestamptz not null default now(),
  add column if not exists generated_by text,
  add column if not exists packet_status text not null default 'generated',
  add column if not exists approved_labor_hours numeric not null default 0,
  add column if not exists estimate_total numeric not null default 0,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists job_packets_lead_idx on public.job_packets(lead_id);
create index if not exists job_packets_job_request_idx on public.job_packets(job_request_id);
create index if not exists job_packets_generated_at_idx on public.job_packets(generated_at);

alter table public.estimate_items enable row level security;
alter table public.job_execution_steps enable row level security;
alter table public.job_execution_step_learning enable row level security;
alter table public.ai_research_drafts enable row level security;
alter table public.job_packets enable row level security;

drop policy if exists "pilot can manage estimate items" on public.estimate_items;
create policy "pilot can manage estimate items"
on public.estimate_items
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage job execution steps" on public.job_execution_steps;
create policy "pilot can manage job execution steps"
on public.job_execution_steps
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage job execution learning" on public.job_execution_step_learning;
create policy "pilot can manage job execution learning"
on public.job_execution_step_learning
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage ai research drafts" on public.ai_research_drafts;
create policy "pilot can manage ai research drafts"
on public.ai_research_drafts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage job packets" on public.job_packets;
create policy "pilot can manage job packets"
on public.job_packets
for all
to anon, authenticated
using (true)
with check (true);
