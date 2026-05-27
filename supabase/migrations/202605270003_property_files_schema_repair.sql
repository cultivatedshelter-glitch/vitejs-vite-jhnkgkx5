-- Repair production file metadata schema used by property dashboard file loading.
-- Keeps RLS enabled and does not add anon write access.

do $$
begin
  if to_regclass('public.files') is not null then
    alter table public.files
      add column if not exists linked_property_id text,
      add column if not exists linked_lead_id text,
      add column if not exists linked_request_id text;
  end if;
end $$;

create table if not exists public.property_files (
  id uuid primary key default gen_random_uuid(),
  property_id text,
  lead_id text,
  request_id text,
  file_id text,
  storage_bucket text,
  storage_path text,
  file_name text,
  file_type text,
  uploaded_by uuid,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.property_files
  add column if not exists property_id text,
  add column if not exists lead_id text,
  add column if not exists request_id text,
  add column if not exists file_id text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists uploaded_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

do $$
begin
  if to_regclass('public.files') is not null then
    execute 'create index if not exists files_linked_property_id_text_idx on public.files((linked_property_id::text)) where linked_property_id is not null';
    execute 'create index if not exists files_linked_lead_id_idx on public.files(linked_lead_id) where linked_lead_id is not null';
    execute 'create index if not exists files_linked_request_id_idx on public.files(linked_request_id) where linked_request_id is not null';
  end if;
end $$;

create index if not exists property_files_property_id_idx
  on public.property_files(property_id)
  where property_id is not null;

create index if not exists property_files_lead_id_text_idx
  on public.property_files(lead_id)
  where lead_id is not null;

create index if not exists property_files_request_id_idx
  on public.property_files(request_id)
  where request_id is not null;

create index if not exists property_files_file_id_idx
  on public.property_files(file_id)
  where file_id is not null;

create index if not exists property_files_deleted_at_idx
  on public.property_files(deleted_at);

alter table public.property_files enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin_or_owner'
  ) then
    drop policy if exists "property files admin owner manage" on public.property_files;
    create policy "property files admin owner manage"
    on public.property_files
    for all
    to authenticated
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

    drop policy if exists "property files admin owner read" on public.property_files;
    create policy "property files admin owner read"
    on public.property_files
    for select
    to authenticated
    using (public.is_admin_or_owner());
  end if;
end $$;

notify pgrst, 'reload schema';
