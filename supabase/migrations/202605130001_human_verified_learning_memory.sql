-- Human-verified learning memory.
-- AI drafts never become memory by themselves. These records are written only
-- from admin review actions: approved, edited, rejected, added, or field verified.

create table if not exists public.human_pricing_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text,
  work_request_id text,
  repair_item_id text,
  work_type text,
  item_name text,
  original_ai_price numeric,
  human_approved_price numeric,
  unit text,
  zip text,
  source text,
  markup_notes text,
  admin_notes text,
  confidence_before text,
  confidence_after text,
  reviewed_by text,
  reviewed_at timestamptz not null default now(),
  human_verified boolean not null default true
);

alter table public.human_pricing_memory
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id text,
  add column if not exists work_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists work_type text,
  add column if not exists item_name text,
  add column if not exists original_ai_price numeric,
  add column if not exists human_approved_price numeric,
  add column if not exists unit text,
  add column if not exists zip text,
  add column if not exists source text,
  add column if not exists markup_notes text,
  add column if not exists admin_notes text,
  add column if not exists confidence_before text,
  add column if not exists confidence_after text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz not null default now(),
  add column if not exists human_verified boolean not null default true;

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
  add column if not exists property_id text,
  add column if not exists work_request_id text,
  add column if not exists repair_item_id text,
  add column if not exists repair_context text,
  add column if not exists trade text,
  add column if not exists ai_hours_low numeric,
  add column if not exists ai_hours_high numeric,
  add column if not exists approved_hours_low numeric,
  add column if not exists approved_hours_high numeric,
  add column if not exists materials_tools text,
  add column if not exists equipment text,
  add column if not exists access_notes text,
  add column if not exists safety_notes text,
  add column if not exists cleanup_notes text,
  add column if not exists disposal_needed boolean,
  add column if not exists status text
    check (status in ('approved', 'edited', 'rejected', 'added_by_human'));

create table if not exists public.photo_field_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id text,
  work_request_id text,
  file_id text,
  photo_description text,
  trade_category text,
  work_phase text,
  equipment_seen text,
  field_consequence text,
  estimate_impact text,
  required_line_items text[] not null default '{}'::text[],
  risk_flags text[] not null default '{}'::text[],
  human_verified boolean not null default true,
  follow_up_lesson text,
  reviewed_at timestamptz not null default now()
);

alter table public.photo_field_memory
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id text,
  add column if not exists work_request_id text,
  add column if not exists file_id text,
  add column if not exists photo_description text,
  add column if not exists trade_category text,
  add column if not exists work_phase text,
  add column if not exists equipment_seen text,
  add column if not exists field_consequence text,
  add column if not exists estimate_impact text,
  add column if not exists required_line_items text[] not null default '{}'::text[],
  add column if not exists risk_flags text[] not null default '{}'::text[],
  add column if not exists human_verified boolean not null default true,
  add column if not exists follow_up_lesson text,
  add column if not exists reviewed_at timestamptz not null default now();

create index if not exists human_pricing_memory_work_type_idx on public.human_pricing_memory(work_type);
create index if not exists human_pricing_memory_item_idx on public.human_pricing_memory(item_name);
create index if not exists human_pricing_memory_zip_idx on public.human_pricing_memory(zip);
create index if not exists human_pricing_memory_verified_idx on public.human_pricing_memory(human_verified);
create index if not exists job_execution_step_learning_property_idx on public.job_execution_step_learning(property_id);
create index if not exists job_execution_step_learning_request_idx on public.job_execution_step_learning(work_request_id);
create index if not exists job_execution_step_learning_status_idx on public.job_execution_step_learning(status);
create index if not exists photo_field_memory_property_idx on public.photo_field_memory(property_id);
create index if not exists photo_field_memory_request_idx on public.photo_field_memory(work_request_id);
create index if not exists photo_field_memory_verified_idx on public.photo_field_memory(human_verified);

alter table public.human_pricing_memory enable row level security;
alter table public.job_execution_step_learning enable row level security;
alter table public.photo_field_memory enable row level security;

drop policy if exists "pilot can manage human pricing memory" on public.human_pricing_memory;
create policy "pilot can manage human pricing memory"
on public.human_pricing_memory
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

drop policy if exists "pilot can manage photo field memory" on public.photo_field_memory;
create policy "pilot can manage photo field memory"
on public.photo_field_memory
for all
to anon, authenticated
using (true)
with check (true);
