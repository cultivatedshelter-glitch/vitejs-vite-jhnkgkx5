-- Adds durable Supabase Storage metadata for active lead files and
-- historical project uploads. This is intentionally additive and safe to
-- run more than once.

-- Active lead/request files live in the private `job-files` bucket.
alter table public.files
  add column if not exists storage_bucket text not null default 'job-files',
  add column if not exists storage_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_size numeric;

update public.files
set storage_bucket = 'job-files'
where storage_bucket is null or storage_bucket = '';

update public.files
set storage_path = split_part(file_url, '/storage/v1/object/public/job-files/', 2)
where storage_path is null
  and file_url like '%/storage/v1/object/public/job-files/%';

update public.files
set file_type = case
  when lower(coalesce(mime_type, '')) like 'image/%' then 'photo'
  when lower(coalesce(storage_path, file_url, file_name, '')) like '%/photos/%' then 'photo'
  when lower(coalesce(storage_path, file_url, file_name, '')) ~ '\.(jpg|jpeg|png|gif|webp|heic|heif)$' then 'photo'
  else 'document'
end
where file_type is null or file_type = '';

create index if not exists files_lead_id_idx on public.files(lead_id);
create index if not exists files_storage_bucket_idx on public.files(storage_bucket);

-- Historical upload files live in the private `historical-project-files` bucket.
create table if not exists public.historical_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.historical_projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  file_type text not null default 'invoice_or_estimate',
  file_name text not null,
  storage_bucket text not null default 'historical-project-files',
  storage_path text not null,
  notes text,
  extraction_status text not null default 'not_started',
  human_verified boolean not null default false
);

alter table public.historical_project_files
  add column if not exists storage_bucket text not null default 'historical-project-files',
  add column if not exists storage_path text,
  add column if not exists file_type text not null default 'invoice_or_estimate',
  add column if not exists file_name text,
  add column if not exists notes text,
  add column if not exists extraction_status text not null default 'not_started',
  add column if not exists human_verified boolean not null default false;

update public.historical_project_files
set storage_bucket = 'historical-project-files'
where storage_bucket is null or storage_bucket = '';

create index if not exists historical_project_files_project_idx
  on public.historical_project_files(project_id);

create index if not exists historical_project_files_storage_bucket_idx
  on public.historical_project_files(storage_bucket);

-- Ensure both storage buckets exist as private buckets. The app generates
-- signed URLs at view/download time instead of relying on public URLs.
insert into storage.buckets (id, name, public)
values
  ('job-files', 'job-files', false),
  ('historical-project-files', 'historical-project-files', false)
on conflict (id) do update
set public = excluded.public;

