-- Phase 1 dual-output estimate memory:
-- 1. Keep original uploaded proposal/invoice files for human review.
-- 2. Store an editable, normalized estimate object beside the file.

create table if not exists public.estimate_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_project_id uuid references public.historical_projects(id) on delete cascade,
  source_file_id uuid references public.historical_project_files(id) on delete cascade,
  source_storage_bucket text not null default 'historical-project-files',
  source_storage_path text,
  status text not null default 'needs_manual_text_review'
    check (status in ('needs_manual_text_review', 'needs_review', 'complete', 'failed')),
  input_mode text not null default 'manual_text'
    check (input_mode in ('manual_text', 'file_record', 'ocr_pending')),
  error_message text,
  extracted_text text,
  normalized_json jsonb not null default '{}'::jsonb,
  confidence_score numeric,
  completed_at timestamptz
);

create table if not exists public.estimate_memory (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  source_project_id uuid references public.historical_projects(id) on delete cascade,
  source_file_id uuid references public.historical_project_files(id) on delete set null,
  extraction_run_id uuid references public.estimate_extraction_runs(id) on delete set null,
  source_storage_bucket text not null default 'historical-project-files',
  source_file_path text,
  source_file_url text,

  extracted_text text,
  normalized_scope jsonb not null default '{}'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,

  project_type text,
  square_feet numeric,
  city text,
  state text not null default 'OR',
  zip text,
  project_class text,

  labor_cost numeric,
  material_cost numeric,
  demo_cost numeric,
  total_cost numeric,

  confidence_score numeric,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'approved', 'rejected')),
  approved_at timestamptz,
  approved_by text,
  notes text
);

create index if not exists estimate_memory_source_project_idx on public.estimate_memory(source_project_id);
create index if not exists estimate_memory_source_file_idx on public.estimate_memory(source_file_id);
create index if not exists estimate_memory_review_status_idx on public.estimate_memory(review_status);
create index if not exists estimate_memory_zip_idx on public.estimate_memory(zip);
create index if not exists estimate_memory_project_type_idx on public.estimate_memory(project_type);

create index if not exists estimate_extraction_runs_source_project_idx on public.estimate_extraction_runs(source_project_id);
create index if not exists estimate_extraction_runs_source_file_idx on public.estimate_extraction_runs(source_file_id);
create index if not exists estimate_extraction_runs_status_idx on public.estimate_extraction_runs(status);

alter table public.estimate_extraction_runs enable row level security;
alter table public.estimate_memory enable row level security;

create or replace function public.is_shelter_prep_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and user_type in ('admin', 'owner')
  );
$$;

drop policy if exists "estimate extraction admin manage" on public.estimate_extraction_runs;
create policy "estimate extraction admin manage"
on public.estimate_extraction_runs
for all
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());

drop policy if exists "estimate extraction pilot insert anonymized" on public.estimate_extraction_runs;
create policy "estimate extraction pilot insert anonymized"
on public.estimate_extraction_runs
for insert
to anon
with check (
  status in ('needs_manual_text_review', 'needs_review', 'complete', 'failed')
  and exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_extraction_runs.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);

drop policy if exists "estimate extraction pilot read anonymized" on public.estimate_extraction_runs;
create policy "estimate extraction pilot read anonymized"
on public.estimate_extraction_runs
for select
to anon
using (
  exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_extraction_runs.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);

drop policy if exists "estimate memory admin manage" on public.estimate_memory;
create policy "estimate memory admin manage"
on public.estimate_memory
for all
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());

drop policy if exists "estimate memory pilot read anonymized" on public.estimate_memory;
create policy "estimate memory pilot read anonymized"
on public.estimate_memory
for select
to anon
using (
  exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_memory.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);

drop policy if exists "estimate memory pilot insert anonymized review" on public.estimate_memory;
create policy "estimate memory pilot insert anonymized review"
on public.estimate_memory
for insert
to anon
with check (
  review_status = 'needs_review'
  and exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_memory.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);

drop policy if exists "estimate memory pilot update anonymized review" on public.estimate_memory;
create policy "estimate memory pilot update anonymized review"
on public.estimate_memory
for update
to anon
using (
  exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_memory.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
)
with check (
  review_status in ('needs_review', 'approved')
  and exists (
    select 1
    from public.historical_projects hp
    where hp.id = estimate_memory.source_project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);
