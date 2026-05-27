-- Evidence-Level Inspection Intelligence
-- Treats each uploaded file/page/image as an inspectable evidence object.
-- Does not drop tables/functions or disable RLS.

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  property_id bigint references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  file_id uuid references public.files(id) on delete set null,
  source_file_id uuid references public.files(id) on delete set null,
  storage_bucket text,
  storage_path text,
  file_name text not null,
  file_type text,
  mime_type text,
  evidence_type text not null default 'manual'
    check (evidence_type in (
      'full_inspection_report',
      'inspection_page',
      'photo',
      'screenshot',
      'invoice',
      'seller_disclosure',
      'contractor_photo',
      'manual'
    )),
  page_number integer,
  page_range text,
  inspection_status text not null default 'uploaded'
    check (inspection_status in (
      'uploaded',
      'queued_for_interpretation',
      'interpreting',
      'interpretation_drafted',
      'needs_admin_review',
      'needs_more_info',
      'researched',
      'human_verified',
      'rejected',
      'failed'
    )),
  evidence_interpretation_status text,
  interpretation_requested_at timestamptz,
  interpretation_completed_at timestamptz,
  needs_more_info_prompt text,
  online_search_performed boolean not null default false,
  internal_memory_used boolean not null default false,
  research_scope text,
  source_priority text,
  verified_for_memory boolean not null default false,
  extraction_status text,
  extracted_text text,
  extracted_text_char_count integer not null default 0,
  extraction_warning text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evidence_items
  add column if not exists evidence_interpretation_status text,
  add column if not exists interpretation_requested_at timestamptz,
  add column if not exists interpretation_completed_at timestamptz,
  add column if not exists needs_more_info_prompt text,
  add column if not exists online_search_performed boolean not null default false,
  add column if not exists internal_memory_used boolean not null default false,
  add column if not exists research_scope text,
  add column if not exists source_priority text,
  add column if not exists verified_for_memory boolean not null default false;

alter table public.evidence_items
  drop constraint if exists evidence_items_inspection_status_check;

alter table public.evidence_items
  add constraint evidence_items_inspection_status_check
  check (inspection_status in (
    'uploaded',
    'queued_for_interpretation',
    'interpreting',
    'interpretation_drafted',
    'needs_admin_review',
    'needs_more_info',
    'researched',
    'human_verified',
    'rejected',
    'failed'
  ));

do $$
begin
  if to_regclass('public.property_media_findings') is not null then
    alter table public.property_media_findings
      drop constraint if exists property_media_findings_review_status_check;

    alter table public.property_media_findings
      add constraint property_media_findings_review_status_check
      check (review_status in (
        'ai_draft',
        'needs_review',
        'needs_more_info',
        'research_requested',
        'research_drafted',
        'approved',
        'rejected',
        'human_verified',
        'deprecated'
      ));
  end if;
end $$;

create index if not exists evidence_items_property_idx on public.evidence_items(property_id);
create index if not exists evidence_items_lead_idx on public.evidence_items(lead_id);
create index if not exists evidence_items_file_idx on public.evidence_items(file_id);
create index if not exists evidence_items_source_file_idx on public.evidence_items(source_file_id);
create index if not exists evidence_items_status_idx on public.evidence_items(inspection_status);

create or replace function public.touch_evidence_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_evidence_items_updated_at on public.evidence_items;
create trigger touch_evidence_items_updated_at
before update on public.evidence_items
for each row execute function public.touch_evidence_items_updated_at();

alter table public.evidence_items enable row level security;

drop policy if exists "evidence items admin owner manage" on public.evidence_items;
create policy "evidence items admin owner manage"
on public.evidence_items
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "evidence items estimator read" on public.evidence_items;
create policy "evidence items estimator read"
on public.evidence_items
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));
