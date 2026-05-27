-- Curated Lesson Intake comprehension grading.
-- Lesson drafts remain non-memory until admin comprehension grade and review rules allow promotion.

alter table public.source_lessons
  add column if not exists source_links jsonb not null default '[]'::jsonb,
  add column if not exists operational_meaning text not null default '',
  add column if not exists materials_tools_equipment jsonb not null default '[]'::jsonb,
  add column if not exists cleanup_disposal text not null default '',
  add column if not exists comprehension_grade text,
  add column if not exists admin_feedback text not null default '',
  add column if not exists human_review_status text not null default 'needs_review',
  add column if not exists memory_destination text not null default 'none',
  add column if not exists original_draft jsonb,
  add column if not exists edited_lesson jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_comprehension_grade_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_comprehension_grade_check
      check (comprehension_grade is null or comprehension_grade in ('A', 'B', 'C', 'D', 'F'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_human_review_status_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_human_review_status_check
      check (human_review_status in ('ai_draft', 'needs_review', 'edited', 'approved', 'rejected', 'human_verified'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_memory_destination_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_memory_destination_check
      check (memory_destination in ('none', 'project_specific', 'global_operational', 'contractor_scope', 'job_execution_context'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_source_links_is_array_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_source_links_is_array_check
      check (jsonb_typeof(source_links) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_materials_tools_equipment_is_array_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_materials_tools_equipment_is_array_check
      check (jsonb_typeof(materials_tools_equipment) = 'array');
  end if;
end $$;

update public.source_lessons
set source_links = jsonb_build_array(
  jsonb_build_object(
    'url', source_url,
    'title', source_title,
    'source_type', source_type,
    'date_checked', created_at
  )
)
where source_url <> ''
  and source_links = '[]'::jsonb;

update public.source_lessons
set
  operational_meaning = observed_method
where operational_meaning = ''
  and observed_method <> '';

update public.source_lessons
set
  materials_tools_equipment = tools_materials
where materials_tools_equipment = '[]'::jsonb
  and jsonb_typeof(tools_materials) = 'array'
  and tools_materials <> '[]'::jsonb;

update public.source_lessons
set
  cleanup_disposal = cleanup_notes
where cleanup_disposal = ''
  and cleanup_notes <> '';

update public.source_lessons
set
  human_review_status = case
    when status = 'approved' then 'human_verified'
    when status = 'rejected' then 'rejected'
    when status in ('draft', 'needs_review') then 'needs_review'
    else human_review_status
  end
where human_review_status in ('', 'needs_review');

create index if not exists source_lessons_comprehension_grade_idx on public.source_lessons(comprehension_grade);
create index if not exists source_lessons_human_review_status_idx on public.source_lessons(human_review_status);
create index if not exists source_lessons_memory_destination_idx on public.source_lessons(memory_destination);

create or replace view public.curated_lessons as
select
  id,
  source_links,
  admin_intent,
  work_type as trade_category,
  lesson_summary,
  operational_meaning,
  estimate_impact,
  hidden_labor,
  materials_tools_equipment,
  cleanup_disposal,
  confidence,
  comprehension_grade,
  admin_feedback,
  human_review_status,
  memory_destination,
  original_draft,
  edited_lesson,
  reviewed_by,
  reviewed_at,
  created_at
from public.source_lessons;
