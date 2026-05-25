-- Site media analysis rows inherit access from the referenced lead/property/file context.
-- This keeps RLS enabled and prevents orphan media intelligence rows from being created
-- unless an operational user can prove the row belongs to an existing work context.

create or replace function public.property_media_context_matches(
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      target_lead_id is not null
      and exists (
        select 1
        from public.leads l
        where l.id = target_lead_id
          and (
            target_property_id is null
            or l.property_id is null
            or l.property_id = target_property_id
          )
      )
    )
    or (
      target_source_file_id is not null
      and exists (
        select 1
        from public.files f
        left join public.leads fl on fl.id = f.lead_id
        where f.id = target_source_file_id
          and (
            target_lead_id is null
            or f.lead_id = target_lead_id
          )
          and (
            target_property_id is null
            or f.linked_property_id = target_property_id
            or fl.property_id = target_property_id
          )
      )
    )
    or (
      target_property_id is not null
      and exists (
        select 1
        from public.leads l
        where l.property_id = target_property_id
          and (
            target_lead_id is null
            or l.id = target_lead_id
          )
      )
    );
$$;

create or replace function public.can_read_property_media_context(
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or (
      public.current_user_role() = 'estimator'
      and public.property_media_context_matches(target_property_id, target_lead_id, target_source_file_id)
    )
    or (
      target_property_id is not null
      and public.is_assigned_contractor_for_property(target_property_id)
    )
    or (
      target_lead_id is not null
      and public.is_assigned_contractor_for_work_request(target_lead_id)
    );
$$;

create or replace function public.can_write_property_media_context(
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or (
      public.current_user_role() = 'estimator'
      and public.property_media_context_matches(target_property_id, target_lead_id, target_source_file_id)
    );
$$;

create or replace function public.property_media_finding_context_matches(
  target_analysis_id uuid,
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.property_media_analysis pma
    where pma.id = target_analysis_id
      and (
        target_property_id is null
        or pma.property_id is null
        or pma.property_id = target_property_id
      )
      and (
        target_lead_id is null
        or pma.lead_id is null
        or pma.lead_id = target_lead_id
      )
      and (
        target_source_file_id is null
        or pma.source_file_id is null
        or pma.source_file_id = target_source_file_id
      )
      and public.property_media_context_matches(
        coalesce(target_property_id, pma.property_id),
        coalesce(target_lead_id, pma.lead_id),
        coalesce(target_source_file_id, pma.source_file_id)
      )
  );
$$;

create or replace function public.can_read_property_media_finding_context(
  target_analysis_id uuid,
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or (
      public.current_user_role() = 'estimator'
      and public.property_media_finding_context_matches(
        target_analysis_id,
        target_property_id,
        target_lead_id,
        target_source_file_id
      )
    )
    or (
      target_property_id is not null
      and public.is_assigned_contractor_for_property(target_property_id)
    )
    or (
      target_lead_id is not null
      and public.is_assigned_contractor_for_work_request(target_lead_id)
    );
$$;

create or replace function public.can_write_property_media_finding_context(
  target_analysis_id uuid,
  target_property_id bigint,
  target_lead_id uuid,
  target_source_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_or_owner()
    or (
      public.current_user_role() = 'estimator'
      and public.property_media_finding_context_matches(
        target_analysis_id,
        target_property_id,
        target_lead_id,
        target_source_file_id
      )
    );
$$;

alter table public.property_media_analysis enable row level security;
alter table public.property_media_findings enable row level security;

drop policy if exists "property media analysis estimator read" on public.property_media_analysis;
drop policy if exists "property media analysis context read" on public.property_media_analysis;
create policy "property media analysis context read"
on public.property_media_analysis
for select
to authenticated
using (
  public.can_read_property_media_context(property_id, lead_id, source_file_id)
);

drop policy if exists "property media analysis estimator create drafts" on public.property_media_analysis;
drop policy if exists "property media analysis context create drafts" on public.property_media_analysis;
create policy "property media analysis context create drafts"
on public.property_media_analysis
for insert
to authenticated
with check (
  review_status in ('ai_draft', 'needs_review')
  and public.can_write_property_media_context(property_id, lead_id, source_file_id)
);

drop policy if exists "property media findings estimator read" on public.property_media_findings;
drop policy if exists "property media findings context read" on public.property_media_findings;
create policy "property media findings context read"
on public.property_media_findings
for select
to authenticated
using (
  public.can_read_property_media_finding_context(
    property_media_analysis_id,
    property_id,
    lead_id,
    source_file_id
  )
);

drop policy if exists "property media findings estimator create drafts" on public.property_media_findings;
drop policy if exists "property media findings context create drafts" on public.property_media_findings;
create policy "property media findings context create drafts"
on public.property_media_findings
for insert
to authenticated
with check (
  review_status in ('ai_draft', 'needs_review')
  and public.can_write_property_media_finding_context(
    property_media_analysis_id,
    property_id,
    lead_id,
    source_file_id
  )
);
