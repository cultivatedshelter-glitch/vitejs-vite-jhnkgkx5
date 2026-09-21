alter table public.properties
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

alter table public.properties
  drop constraint if exists phase1_properties_archive_reason_length_check;

alter table public.properties
  add constraint phase1_properties_archive_reason_length_check
  check (archive_reason is null or char_length(archive_reason) <= 1000);

create index if not exists phase1_properties_active_updated_idx
  on public.properties(updated_at desc)
  where archived_at is null;

create index if not exists phase1_properties_archived_at_idx
  on public.properties(archived_at desc)
  where archived_at is not null;

create or replace function private.phase1_guard_property_archive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (
    new.archived_at is distinct from old.archived_at
    or new.archived_by is distinct from old.archived_by
    or new.archive_reason is distinct from old.archive_reason
  ) then
    raise exception 'Property archive state is server-authoritative';
  end if;
  return new;
end;
$$;

revoke all on function private.phase1_guard_property_archive_fields() from public, anon, authenticated;

drop trigger if exists phase1_guard_property_archive_fields on public.properties;
create trigger phase1_guard_property_archive_fields
before update on public.properties
for each row execute function private.phase1_guard_property_archive_fields();

create or replace function public.phase1_set_property_archive(
  target_property_id uuid,
  target_actor_id uuid,
  target_archived boolean,
  target_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_record public.properties%rowtype;
  normalized_reason text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = target_actor_id
      and active = true
      and role in ('owner', 'admin')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  select * into property_record
  from public.properties
  where id = target_property_id
  for update;

  if not found then
    raise exception 'Property not found';
  end if;

  normalized_reason := nullif(left(trim(coalesce(target_reason, '')), 1000), '');

  if target_archived then
    if property_record.archived_at is not null then
      return jsonb_build_object(
        'id', property_record.id,
        'status', property_record.status,
        'archived_at', property_record.archived_at,
        'archived_by', property_record.archived_by,
        'archive_reason', property_record.archive_reason
      );
    end if;

    if exists (
      select 1
      from public.inspection_pipeline_runs
      where property_id = target_property_id
        and status in ('draft', 'queued', 'running')
    ) then
      raise exception 'Property has active submission or processing work';
    end if;

    update public.properties
    set archived_at = now(),
        archived_by = target_actor_id,
        archive_reason = normalized_reason,
        updated_at = now()
    where id = target_property_id
    returning * into property_record;

    insert into public.workflow_events (
      property_id, actor_id, actor_type, event_type, event_title,
      object_type, object_id, metadata
    ) values (
      target_property_id, target_actor_id, 'admin', 'property_archived', 'Property archived',
      'property', target_property_id,
      jsonb_build_object('preserved_status', property_record.status, 'archive_reason', normalized_reason)
    );
  else
    if property_record.archived_at is null then
      return jsonb_build_object(
        'id', property_record.id,
        'status', property_record.status,
        'archived_at', null,
        'archived_by', null,
        'archive_reason', null
      );
    end if;

    update public.properties
    set archived_at = null,
        archived_by = null,
        archive_reason = null,
        updated_at = now()
    where id = target_property_id
    returning * into property_record;

    insert into public.workflow_events (
      property_id, actor_id, actor_type, event_type, event_title,
      object_type, object_id, metadata
    ) values (
      target_property_id, target_actor_id, 'admin', 'property_restored', 'Property restored',
      'property', target_property_id,
      jsonb_build_object('restored_status', property_record.status)
    );
  end if;

  return jsonb_build_object(
    'id', property_record.id,
    'status', property_record.status,
    'archived_at', property_record.archived_at,
    'archived_by', property_record.archived_by,
    'archive_reason', property_record.archive_reason
  );
end;
$$;

revoke all on function public.phase1_set_property_archive(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.phase1_set_property_archive(uuid, uuid, boolean, text) to service_role;

comment on function public.phase1_set_property_archive(uuid, uuid, boolean, text) is
  'Server-only atomic Property archive/restore with active-work guard and immutable workflow audit event.';

-- Rollback (manual and intentionally non-destructive):
-- drop function if exists public.phase1_set_property_archive(uuid, uuid, boolean, text);
-- drop trigger if exists phase1_guard_property_archive_fields on public.properties;
-- drop function if exists private.phase1_guard_property_archive_fields();
-- drop index if exists public.phase1_properties_active_updated_idx;
-- drop index if exists public.phase1_properties_archived_at_idx;
-- alter table public.properties drop constraint if exists phase1_properties_archive_reason_length_check;
-- alter table public.properties drop column if exists archive_reason, drop column if exists archived_by, drop column if exists archived_at;
