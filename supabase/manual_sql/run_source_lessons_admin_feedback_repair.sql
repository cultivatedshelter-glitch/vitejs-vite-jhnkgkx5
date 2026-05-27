-- Manual fallback: repair source_lessons review columns used by Curated Lesson Intake.
-- Paste into Supabase SQL Editor if migrations are not being run.
-- Keeps RLS enabled and does not add anon write access.

alter table if exists public.source_lessons
  add column if not exists admin_feedback text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if to_regclass('public.source_lessons') is not null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'source_lessons'
        and column_name = 'reviewed_by'
    )
  then
    alter table public.source_lessons
      add column reviewed_by uuid references auth.users(id) on delete set null;
  end if;
end $$;

update public.source_lessons
set admin_feedback = ''
where admin_feedback is null;

alter table if exists public.source_lessons
  alter column admin_feedback set default '',
  alter column admin_feedback set not null;

create or replace function public.touch_source_lessons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_source_lessons_updated_at on public.source_lessons;
create trigger touch_source_lessons_updated_at
before update on public.source_lessons
for each row execute function public.touch_source_lessons_updated_at();

create index if not exists source_lessons_updated_at_idx
  on public.source_lessons(updated_at desc);

alter table if exists public.source_lessons enable row level security;

notify pgrst, 'reload schema';
