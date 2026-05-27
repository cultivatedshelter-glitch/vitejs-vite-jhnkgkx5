-- Project cleanup metadata for Shelter Prep admin queue controls.
-- Adds soft archive/delete audit fields without dropping tables, functions, or storage objects.
-- RLS remains enabled. Admin/owner policies are scoped through public.is_admin_or_owner().

alter table if exists public.leads
  add column if not exists archived boolean default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table if exists public.properties
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

alter table if exists public.work_requests
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['leads', 'properties', 'work_requests']
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      execute format('drop policy if exists "project cleanup admin update" on public.%I', target_table);
      execute format(
        'create policy "project cleanup admin update" on public.%I for update to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())',
        target_table
      );

      execute format('drop policy if exists "project cleanup admin delete" on public.%I', target_table);
      execute format(
        'create policy "project cleanup admin delete" on public.%I for delete to authenticated using (public.is_admin_or_owner())',
        target_table
      );
    end if;
  end loop;
end $$;
