-- Project Gallery admin management.
-- The gallery is backed by public.files because uploads already write file rows.

alter table public.files
  add column if not exists display_title text,
  add column if not exists caption text,
  add column if not exists category text,
  add column if not exists trade text,
  add column if not exists visibility text default 'internal',
  add column if not exists featured boolean not null default false,
  add column if not exists hidden boolean not null default false,
  add column if not exists admin_notes text,
  add column if not exists photo_memory_candidate boolean not null default false,
  add column if not exists linked_property_id bigint,
  add column if not exists linked_work_request_id uuid,
  add column if not exists linked_repair_item_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

update public.files
set visibility = 'internal'
where visibility is null or visibility = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'files_gallery_visibility_check'
  ) then
    alter table public.files
      add constraint files_gallery_visibility_check
      check (visibility in ('private', 'internal', 'public'))
      not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.properties') is not null
    and not exists (select 1 from pg_constraint where conname = 'files_linked_property_id_fkey')
  then
    alter table public.files
      add constraint files_linked_property_id_fkey
      foreign key (linked_property_id) references public.properties(id) on delete set null;
  end if;

  if to_regclass('public.work_requests') is not null
    and not exists (select 1 from pg_constraint where conname = 'files_linked_work_request_id_fkey')
  then
    alter table public.files
      add constraint files_linked_work_request_id_fkey
      foreign key (linked_work_request_id) references public.work_requests(id) on delete set null;
  end if;

  if to_regclass('public.repair_items') is not null
    and not exists (select 1 from pg_constraint where conname = 'files_linked_repair_item_id_fkey')
  then
    alter table public.files
      add constraint files_linked_repair_item_id_fkey
      foreign key (linked_repair_item_id) references public.repair_items(id) on delete set null;
  end if;
end $$;

create index if not exists files_gallery_visibility_idx on public.files(visibility);
create index if not exists files_gallery_hidden_idx on public.files(hidden);
create index if not exists files_gallery_featured_idx on public.files(featured);
create index if not exists files_gallery_linked_property_idx on public.files(linked_property_id);
create index if not exists files_gallery_linked_work_request_idx on public.files(linked_work_request_id);

create or replace function public.touch_files_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_files_updated_at on public.files;
create trigger touch_files_updated_at
before update on public.files
for each row execute function public.touch_files_updated_at();

alter table public.files enable row level security;

drop policy if exists "gallery files public photo read" on public.files;
create policy "gallery files public photo read"
on public.files
for select
to anon
using (
  visibility = 'public'
  and hidden = false
  and (
    file_type = 'photo'
    or lower(coalesce(mime_type, '')) like 'image/%'
    or lower(coalesce(storage_path, file_url, file_name, '')) ~ '\.(jpg|jpeg|png|gif|webp|heic|heif)$'
  )
);

drop policy if exists "gallery files authenticated read" on public.files;
create policy "gallery files authenticated read"
on public.files
for select
to authenticated
using (
  public.is_admin_or_owner()
  or (visibility = 'public' and hidden = false)
  or (
    visibility = 'internal'
    and hidden = false
    and public.current_user_role() in ('admin', 'owner', 'estimator', 'contractor', 'agent')
  )
);

drop policy if exists "gallery files upload during intake" on public.files;
create policy "gallery files upload during intake"
on public.files
for insert
to anon, authenticated
with check (
  coalesce(visibility, 'internal') in ('private', 'internal', 'public')
);

drop policy if exists "gallery files admin update" on public.files;
create policy "gallery files admin update"
on public.files
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "gallery files admin delete" on public.files;
create policy "gallery files admin delete"
on public.files
for delete
to authenticated
using (public.is_admin_or_owner());

alter table public.photo_field_memory
  add column if not exists status text not null default 'needs_review',
  add column if not exists caption text,
  add column if not exists admin_notes text;

update public.photo_field_memory
set status = 'needs_review'
where status is null or status = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photo_field_memory_status_check'
  ) then
    alter table public.photo_field_memory
      add constraint photo_field_memory_status_check
      check (status in ('needs_review', 'approved', 'rejected'))
      not valid;
  end if;
end $$;
