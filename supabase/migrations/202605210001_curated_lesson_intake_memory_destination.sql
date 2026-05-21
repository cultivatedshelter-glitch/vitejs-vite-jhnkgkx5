-- Curated Lesson Intake can stage material/pricing memory drafts.
alter table public.source_lessons
  drop constraint if exists source_lessons_memory_destination_check;

alter table public.source_lessons
  add constraint source_lessons_memory_destination_check
  check (memory_destination in ('none', 'project_specific', 'global_operational', 'material_pricing', 'contractor_scope', 'job_execution_context'));
