-- Private Phase 1 evidence storage for the guided inspection workflow.
-- Object names follow: actor_id/property_id/evidence_id-filename.

begin;

create or replace function private.phase1_storage_property_id(object_name text)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  return nullif(split_part(object_name, '/', 2), '')::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.phase1_storage_property_id(text) from public;
grant execute on function private.phase1_storage_property_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('phase1-evidence', 'phase1-evidence', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create policy phase1_evidence_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'phase1-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.phase1_user_has_property_access(private.phase1_storage_property_id(name))
);

create policy phase1_evidence_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'phase1-evidence'
  and private.phase1_user_has_property_access(private.phase1_storage_property_id(name))
);

create policy phase1_evidence_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'phase1-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.phase1_user_has_property_access(private.phase1_storage_property_id(name))
);

commit;
