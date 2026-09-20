-- Durable, Property-owned reviewed reports and private PDF storage.

begin;

create table public.phase1_reviewed_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  processing_request_id uuid references public.inspection_pipeline_runs(id) on delete set null,
  report_version integer not null,
  artifact_schema_version text not null,
  reviewed_artifact jsonb,
  reviewed_finding_versions jsonb not null default '[]'::jsonb,
  reviewed_pricing_versions jsonb not null default '[]'::jsonb,
  local_professional_research jsonb not null default '{"groups":[],"lookups":[]}'::jsonb,
  reviewer_id uuid references public.profiles(id) on delete set null,
  recipient text not null,
  report_status text not null default 'generating',
  pdf_bucket text,
  pdf_object_path text,
  pdf_sha256 text,
  pdf_size_bytes bigint,
  generation_failure text,
  generated_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  delivery_status text not null default 'not_sent',
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_reviewed_reports_version_positive check (report_version > 0),
  constraint phase1_reviewed_reports_status_check check (report_status in ('generating', 'draft', 'released', 'superseded', 'generation_failed', 'storage_failed')),
  constraint phase1_reviewed_reports_delivery_check check (delivery_status in ('not_sent', 'sending', 'sent', 'failed')),
  constraint phase1_reviewed_reports_recipient_check check (position('@' in recipient) > 1),
  constraint phase1_reviewed_reports_pdf_size_check check (pdf_size_bytes is null or pdf_size_bytes > 0),
  constraint phase1_reviewed_reports_property_version_key unique (property_id, report_version)
);

create index phase1_reviewed_reports_property_history_idx
  on public.phase1_reviewed_reports(property_id, report_version desc);
create index phase1_reviewed_reports_request_idx
  on public.phase1_reviewed_reports(processing_request_id, report_version desc)
  where processing_request_id is not null;

create or replace function public.phase1_protect_reviewed_report_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.report_status <> 'generating' and (
    new.reviewed_artifact is distinct from old.reviewed_artifact or
    new.reviewed_finding_versions is distinct from old.reviewed_finding_versions or
    new.reviewed_pricing_versions is distinct from old.reviewed_pricing_versions or
    new.local_professional_research is distinct from old.local_professional_research or
    new.pdf_object_path is distinct from old.pdf_object_path or
    new.pdf_sha256 is distinct from old.pdf_sha256
  ) then raise exception 'Reviewed report snapshots are immutable; generate a new version.'; end if;
  return new;
end;
$$;
create trigger phase1_reviewed_reports_snapshot_immutable
before update on public.phase1_reviewed_reports for each row
execute function public.phase1_protect_reviewed_report_snapshot();

alter table public.phase1_reviewed_reports enable row level security;
revoke all on public.phase1_reviewed_reports from anon, authenticated;
grant select, insert, update on public.phase1_reviewed_reports to service_role;

create policy phase1_reviewed_reports_deny_browser_access
on public.phase1_reviewed_reports
for all
to anon, authenticated
using (false)
with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('phase1-reviewed-reports', 'phase1-reviewed-reports', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy phase1_reviewed_reports_storage_deny_browser_select
on storage.objects for select to anon, authenticated
using (bucket_id = 'phase1-reviewed-reports' and false);
create policy phase1_reviewed_reports_storage_deny_browser_insert
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'phase1-reviewed-reports' and false);
create policy phase1_reviewed_reports_storage_deny_browser_update
on storage.objects for update to anon, authenticated
using (bucket_id = 'phase1-reviewed-reports' and false)
with check (bucket_id = 'phase1-reviewed-reports' and false);
create policy phase1_reviewed_reports_storage_deny_browser_delete
on storage.objects for delete to anon, authenticated
using (bucket_id = 'phase1-reviewed-reports' and false);

alter table public.phase1_notifications
  add column report_id uuid references public.phase1_reviewed_reports(id) on delete set null,
  add column report_version integer;

drop index if exists public.phase1_notifications_event_dedupe_idx;
create unique index phase1_notifications_request_event_dedupe_idx
  on public.phase1_notifications(event_type, processing_request_id, recipient, channel)
  where event_type in ('needs_review', 'processing_failed');
create unique index phase1_notifications_report_delivery_dedupe_idx
  on public.phase1_notifications(event_type, report_id, recipient, channel)
  where event_type = 'reviewed_result_ready' and report_id is not null;
create unique index phase1_notifications_legacy_result_dedupe_idx
  on public.phase1_notifications(event_type, processing_request_id, recipient, channel)
  where event_type = 'reviewed_result_ready' and report_id is null;

create or replace function public.phase1_reserve_reviewed_report(
  target_request_id uuid,
  target_reviewer_id uuid,
  target_recipient text,
  target_artifact_schema_version text
)
returns public.phase1_reviewed_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.inspection_pipeline_runs%rowtype;
  next_version integer;
  reserved public.phase1_reviewed_reports%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where id = target_reviewer_id and active = true and role in ('owner', 'admin')
  ) then
    raise exception 'Reviewer access is required.' using errcode = '42501';
  end if;

  select * into target_request
  from public.inspection_pipeline_runs
  where id = target_request_id
  for update;
  if target_request.id is null then raise exception 'Processing request is not available.'; end if;
  if target_request.status not in ('needs_review', 'completed') then
    raise exception 'Processing request is not ready for report generation.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_request.property_id::text, 0));
  select coalesce(max(report_version), 0) + 1 into next_version
  from public.phase1_reviewed_reports
  where property_id = target_request.property_id;

  insert into public.phase1_reviewed_reports (
    property_id, processing_request_id, report_version, artifact_schema_version,
    reviewer_id, recipient, report_status
  ) values (
    target_request.property_id, target_request.id, next_version,
    target_artifact_schema_version, target_reviewer_id, lower(target_recipient), 'generating'
  ) returning * into reserved;
  return reserved;
end;
$$;

create or replace function public.phase1_release_reviewed_report(
  target_report_id uuid,
  target_reviewer_id uuid
)
returns public.phase1_reviewed_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_report public.phase1_reviewed_reports%rowtype;
  released public.phase1_reviewed_reports%rowtype;
  released_time timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles
    where id = target_reviewer_id and active = true and role in ('owner', 'admin')
  ) then
    raise exception 'Reviewer access is required.' using errcode = '42501';
  end if;

  select * into target_report
  from public.phase1_reviewed_reports
  where id = target_report_id
  for update;
  if target_report.id is null then raise exception 'Reviewed report is not available.'; end if;
  if target_report.report_status in ('released', 'superseded') then return target_report; end if;
  if target_report.report_status <> 'draft' or target_report.pdf_object_path is null or target_report.reviewed_artifact is null then
    raise exception 'Reviewed report PDF is not ready for release.';
  end if;

  update public.phase1_reviewed_reports
  set report_status = 'superseded', updated_at = released_time
  where property_id = target_report.property_id
    and report_status = 'released'
    and id <> target_report.id;

  update public.phase1_reviewed_reports
  set report_status = 'released', released_by = target_reviewer_id,
      released_at = released_time, updated_at = released_time
  where id = target_report.id
  returning * into released;

  if released.processing_request_id is not null then
    update public.inspection_pipeline_runs
    set status = 'completed', current_stage = 'released_result', workflow_state = 'released',
        next_responsible_role = 'submitter', next_action = 'View reviewed result',
        released_artifact_version = released.artifact_schema_version,
        released_at = released_time, last_activity_at = released_time, completed_at = released_time
    where id = released.processing_request_id;
  end if;

  insert into public.workflow_events (
    property_id, actor_id, actor_type, event_type, event_title,
    object_type, object_id, metadata
  ) values (
    released.property_id, target_reviewer_id, 'admin', 'phase1_reviewed_report_released',
    'Reviewed report version released', 'phase1_reviewed_report', released.id,
    jsonb_build_object('report_version', released.report_version, 'processing_request_id', released.processing_request_id)
  );
  return released;
end;
$$;

revoke all on function public.phase1_reserve_reviewed_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.phase1_release_reviewed_report(uuid, uuid) from public, anon, authenticated;
grant execute on function public.phase1_reserve_reviewed_report(uuid, uuid, text, text) to service_role;
grant execute on function public.phase1_release_reviewed_report(uuid, uuid) to service_role;

comment on table public.phase1_reviewed_reports is
  'Server-owned immutable reviewed report versions. Browser access is mediated by authenticated application endpoints.';

commit;

-- Manual rollback requires deleting report objects through the Storage API first.
-- drop function if exists public.phase1_release_reviewed_report(uuid, uuid);
-- drop function if exists public.phase1_reserve_reviewed_report(uuid, uuid, text, text);
-- drop table if exists public.phase1_reviewed_reports;
