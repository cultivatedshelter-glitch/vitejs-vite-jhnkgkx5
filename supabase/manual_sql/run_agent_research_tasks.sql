-- Agent Research Tasks
-- Property/request/finding-scoped research questions and source records.
-- AI answers remain drafts until admin/owner human verification.
-- Does not drop tables/functions or disable RLS.

create table if not exists public.agent_research_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id bigint references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  finding_id uuid references public.property_media_findings(id) on delete cascade,
  note_id text,
  source_file_id uuid references public.files(id) on delete set null,
  evidence_id text,
  page_number integer,
  page_range text,
  question text not null,
  question_type text not null
    check (question_type in (
      'code / jurisdiction',
      'material / product',
      'cost range',
      'contractor verification',
      'missing info',
      'safety',
      'permit / inspection',
      'property-specific'
    )),
  research_scope text not null
    check (research_scope in (
      'Uploaded evidence only',
      'Property database',
      'Shelter Prep memory',
      'Official/code resources',
      'Supplier/material resources',
      'General web allowed',
      'Uploaded files only',
      'Uploaded files + property data',
      'Online resources allowed',
      'Building code / jurisdiction resources'
    )),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'researching', 'answered', 'needs_review', 'human_verified', 'rejected')),
  answer_draft text,
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  evidence_summary text,
  missing_information text,
  recommended_next_action text,
  needs_more_info_prompt text,
  research_categories text[] not null default '{}',
  online_search_requested boolean not null default false,
  online_search_performed boolean not null default false,
  internal_memory_used boolean not null default false,
  official_sources_used boolean not null default false,
  supplier_sources_used boolean not null default false,
  source_quality text not null default 'unknown'
    check (source_quality in ('official', 'manufacturer', 'supplier', 'internal_memory', 'general_web', 'unknown')),
  answer_status text not null default 'needs_review',
  research_scope_used text,
  source_priority text,
  verified_for_memory boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

alter table public.agent_research_tasks
  add column if not exists note_id text,
  add column if not exists source_file_id uuid references public.files(id) on delete set null,
  add column if not exists evidence_id text,
  add column if not exists page_number integer,
  add column if not exists page_range text,
  add column if not exists needs_more_info_prompt text,
  add column if not exists research_categories text[] not null default '{}',
  add column if not exists online_search_requested boolean not null default false,
  add column if not exists online_search_performed boolean not null default false,
  add column if not exists internal_memory_used boolean not null default false,
  add column if not exists official_sources_used boolean not null default false,
  add column if not exists supplier_sources_used boolean not null default false,
  add column if not exists source_quality text not null default 'unknown',
  add column if not exists answer_status text not null default 'needs_review',
  add column if not exists research_scope_used text,
  add column if not exists source_priority text,
  add column if not exists verified_for_memory boolean not null default false;

alter table public.agent_research_tasks
  drop constraint if exists agent_research_tasks_source_quality_check;

alter table public.agent_research_tasks
  add constraint agent_research_tasks_source_quality_check
  check (source_quality in ('official', 'manufacturer', 'supplier', 'internal_memory', 'general_web', 'unknown'));

alter table public.agent_research_tasks
  drop constraint if exists agent_research_tasks_research_scope_check;

alter table public.agent_research_tasks
  add constraint agent_research_tasks_research_scope_check
  check (research_scope in (
    'Uploaded evidence only',
    'Property database',
    'Shelter Prep memory',
    'Official/code resources',
    'Supplier/material resources',
    'General web allowed',
    'Uploaded files only',
    'Uploaded files + property data',
    'Online resources allowed',
    'Building code / jurisdiction resources'
  ));

create table if not exists public.agent_research_sources (
  id uuid primary key default gen_random_uuid(),
  research_task_id uuid not null references public.agent_research_tasks(id) on delete cascade,
  source_title text not null,
  source_url text,
  source_type text not null
    check (source_type in ('uploaded_file', 'property_record', 'building_code', 'supplier', 'web', 'manual')),
  source_category text,
  source_quality text not null default 'unknown'
    check (source_quality in ('official', 'manufacturer', 'supplier', 'internal_memory', 'general_web', 'unknown')),
  source_publisher text,
  source_excerpt text,
  source_date_accessed timestamptz,
  relevance_note text,
  excerpt text,
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table public.agent_research_sources
  add column if not exists source_category text,
  add column if not exists source_quality text not null default 'unknown',
  add column if not exists source_publisher text,
  add column if not exists source_excerpt text,
  add column if not exists source_date_accessed timestamptz,
  add column if not exists relevance_note text;

alter table public.agent_research_sources
  drop constraint if exists agent_research_sources_source_quality_check;

alter table public.agent_research_sources
  add constraint agent_research_sources_source_quality_check
  check (source_quality in ('official', 'manufacturer', 'supplier', 'internal_memory', 'general_web', 'unknown'));

create index if not exists agent_research_tasks_property_idx on public.agent_research_tasks(property_id);
create index if not exists agent_research_tasks_lead_idx on public.agent_research_tasks(lead_id);
create index if not exists agent_research_tasks_finding_idx on public.agent_research_tasks(finding_id);
create index if not exists agent_research_tasks_note_idx on public.agent_research_tasks(note_id);
create index if not exists agent_research_tasks_source_file_idx on public.agent_research_tasks(source_file_id);
create index if not exists agent_research_tasks_status_idx on public.agent_research_tasks(status);
create index if not exists agent_research_sources_task_idx on public.agent_research_sources(research_task_id);

create or replace function public.touch_agent_research_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_agent_research_tasks_updated_at on public.agent_research_tasks;
create trigger touch_agent_research_tasks_updated_at
before update on public.agent_research_tasks
for each row execute function public.touch_agent_research_tasks_updated_at();

alter table public.agent_research_tasks enable row level security;
alter table public.agent_research_sources enable row level security;

drop policy if exists "agent research tasks admin owner manage" on public.agent_research_tasks;
create policy "agent research tasks admin owner manage"
on public.agent_research_tasks
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "agent research tasks estimator read" on public.agent_research_tasks;
create policy "agent research tasks estimator read"
on public.agent_research_tasks
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "agent research sources admin owner manage" on public.agent_research_sources;
create policy "agent research sources admin owner manage"
on public.agent_research_sources
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "agent research sources estimator read" on public.agent_research_sources;
create policy "agent research sources estimator read"
on public.agent_research_sources
for select
to authenticated
using (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  and exists (
    select 1
    from public.agent_research_tasks task
    where task.id = agent_research_sources.research_task_id
  )
);
