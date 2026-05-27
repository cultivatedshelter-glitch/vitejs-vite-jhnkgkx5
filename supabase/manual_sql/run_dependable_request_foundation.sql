-- Dependable request foundation
-- Keeps the existing leads-based app, while making every lead attach to a durable property
-- and every uploaded file retain enough Supabase Storage metadata for admin open/download.

alter table public.leads
  add column if not exists property_id bigint;

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

create index if not exists leads_property_id_idx on public.leads(property_id);
create index if not exists files_lead_id_idx on public.files(lead_id);
create index if not exists files_storage_bucket_idx on public.files(storage_bucket);

insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "job files anon upload" on storage.objects;
create policy "job files anon upload"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'job-files');

drop policy if exists "job files authenticated read" on storage.objects;
create policy "job files authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'job-files');

drop policy if exists "job files anon read public urls" on storage.objects;
create policy "job files anon read public urls"
on storage.objects
for select
to anon
using (bucket_id = 'job-files');

create or replace function public.normalize_property_key(
  p_address text,
  p_city text default '',
  p_state text default '',
  p_zip text default ''
)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(
    concat_ws(' ',
      nullif(p_address, ''),
      nullif(p_city, ''),
      nullif(p_state, ''),
      nullif(left(coalesce(p_zip, ''), 5), '')
    )
  ), '\s+', ' ', 'g'));
$$;

create or replace function public.upsert_property_for_lead(
  p_lead_id uuid,
  p_address text,
  p_city text default '',
  p_state text default '',
  p_zip text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id bigint;
  v_key text;
  v_address text;
  v_city text;
  v_state text;
  v_zip text;
begin
  v_address := trim(coalesce(p_address, ''));
  v_city := trim(coalesce(p_city, ''));
  v_state := upper(left(trim(coalesce(p_state, '')), 2));
  v_zip := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  v_key := public.normalize_property_key(v_address, v_city, v_state, v_zip);

  if v_address = '' then
    return null;
  end if;

  select id
  into v_property_id
  from public.properties
  where public.normalize_property_key(address, city, state, zip) = v_key
  order by id
  limit 1;

  if v_property_id is null then
    insert into public.properties (
      address,
      canonical_address,
      street_line_1,
      city,
      state,
      zip
    )
    values (
      v_address,
      v_key,
      v_address,
      v_city,
      v_state,
      v_zip
    )
    returning id into v_property_id;
  end if;

  update public.leads
  set property_id = v_property_id
  where id = p_lead_id;

  return v_property_id;
end;
$$;

grant execute on function public.upsert_property_for_lead(uuid, text, text, text, text) to anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select id, address, city, state, zip
    from public.leads
    where property_id is null
      and coalesce(trim(address), '') <> ''
  loop
    perform public.upsert_property_for_lead(r.id, r.address, r.city, r.state, r.zip);
  end loop;
end $$;
