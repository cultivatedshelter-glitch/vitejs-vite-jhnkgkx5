-- Field Lesson Agent source lesson drafts.
-- Real life is the source of intelligence; AI drafts structure; humans verify meaning.
-- Source lessons do not become operational memory until an admin/owner approves them.

create table if not exists public.source_lessons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid,
  source_type text not null default 'field_note',
  source_url text not null default '',
  source_title text not null default '',
  work_type text not null default '',
  problem_description text not null default '',
  admin_intent text not null default '',
  lesson_summary text not null default '',
  observed_method text not null default '',
  hidden_labor text not null default '',
  job_steps jsonb not null default '[]'::jsonb,
  tools_materials jsonb not null default '[]'::jsonb,
  safety_notes text not null default '',
  access_notes text not null default '',
  cleanup_notes text not null default '',
  estimate_impact text not null default '',
  missing_info_questions jsonb not null default '[]'::jsonb,
  applies_when text not null default '',
  does_not_apply_when text not null default '',
  confidence text not null default 'low',
  status text not null default 'draft',
  approved_by uuid,
  approved_at timestamptz,
  admin_notes text not null default '',
  linked_property_id text,
  linked_work_request_id text,
  linked_repair_item_id text
);

alter table public.source_lessons
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists created_by uuid,
  add column if not exists source_type text not null default 'field_note',
  add column if not exists source_url text not null default '',
  add column if not exists source_title text not null default '',
  add column if not exists work_type text not null default '',
  add column if not exists problem_description text not null default '',
  add column if not exists admin_intent text not null default '',
  add column if not exists lesson_summary text not null default '',
  add column if not exists observed_method text not null default '',
  add column if not exists hidden_labor text not null default '',
  add column if not exists job_steps jsonb not null default '[]'::jsonb,
  add column if not exists tools_materials jsonb not null default '[]'::jsonb,
  add column if not exists safety_notes text not null default '',
  add column if not exists access_notes text not null default '',
  add column if not exists cleanup_notes text not null default '',
  add column if not exists estimate_impact text not null default '',
  add column if not exists missing_info_questions jsonb not null default '[]'::jsonb,
  add column if not exists applies_when text not null default '',
  add column if not exists does_not_apply_when text not null default '',
  add column if not exists confidence text not null default 'low',
  add column if not exists status text not null default 'draft',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists admin_notes text not null default '',
  add column if not exists linked_property_id text,
  add column if not exists linked_work_request_id text,
  add column if not exists linked_repair_item_id text;

DO $$
BEGIN
  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_source_type_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_source_type_check
      check (source_type in ('youtube', 'article', 'manual', 'field_note'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_confidence_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_confidence_check
      check (confidence in ('low', 'medium', 'high'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_lessons_status_check'
  ) then
    alter table public.source_lessons
      add constraint source_lessons_status_check
      check (status in ('draft', 'needs_review', 'approved', 'rejected', 'archived'));
  end if;
END $$;

create index if not exists source_lessons_created_at_idx on public.source_lessons(created_at desc);
create index if not exists source_lessons_status_idx on public.source_lessons(status);
create index if not exists source_lessons_source_type_idx on public.source_lessons(source_type);
create index if not exists source_lessons_work_type_idx on public.source_lessons(work_type);
create index if not exists source_lessons_linked_property_idx on public.source_lessons(linked_property_id);
create index if not exists source_lessons_linked_request_idx on public.source_lessons(linked_work_request_id);

alter table public.source_lessons enable row level security;

drop policy if exists "source lessons read" on public.source_lessons;
create policy "source lessons read"
on public.source_lessons
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "source lessons draft insert" on public.source_lessons;
create policy "source lessons draft insert"
on public.source_lessons
for insert
to authenticated
with check (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  and created_by = auth.uid()
  and status in ('draft', 'needs_review')
  and approved_by is null
  and approved_at is null
);

drop policy if exists "source lessons admin update" on public.source_lessons;
create policy "source lessons admin update"
on public.source_lessons
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "source lessons estimator edit draft" on public.source_lessons;
create policy "source lessons estimator edit draft"
on public.source_lessons
for update
to authenticated
using (
  public.current_user_role() = 'estimator'
  and status in ('draft', 'needs_review')
  and approved_by is null
  and approved_at is null
)
with check (
  public.current_user_role() = 'estimator'
  and status in ('draft', 'needs_review')
  and approved_by is null
  and approved_at is null
);
