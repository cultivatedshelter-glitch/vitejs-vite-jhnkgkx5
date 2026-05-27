-- Site Media Intelligence
-- Uses existing uploaded files first. No outside media scraping or autonomous approval.

create table if not exists public.property_media_analysis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint,
  lead_id uuid references public.leads(id) on delete cascade,
  source_type text not null default 'uploaded_photo'
    check (source_type in ('uploaded_photo', 'inspection_photo', 'listing_photo', 'satellite', 'map', 'aerial', 'street_view', 'other')),
  source_url text,
  source_file_id uuid,
  captured_at timestamptz,
  analyzed_at timestamptz not null default now(),
  roof_size_estimate text,
  roof_pitch_estimate text,
  roof_complexity_notes text,
  ladder_access_notes text,
  lift_access_notes text,
  crane_access_notes text,
  truck_access_notes text,
  machinery_access_notes text,
  staging_notes text,
  slope_notes text,
  water_ravine_notes text,
  tree_obstruction_notes text,
  overhead_obstruction_notes text,
  terrain_risk_level text not null default 'unknown'
    check (terrain_risk_level in ('low', 'medium', 'high', 'unknown')),
  access_risk_level text not null default 'unknown'
    check (access_risk_level in ('low', 'medium', 'high', 'unknown')),
  estimate_impact_notes text,
  missing_info text,
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  review_status text not null default 'ai_draft'
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text
);

create table if not exists public.property_media_findings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_media_analysis_id uuid references public.property_media_analysis(id) on delete cascade,
  property_id bigint,
  lead_id uuid references public.leads(id) on delete cascade,
  finding_type text not null default 'access',
  observation text not null default '',
  field_consequence text not null default '',
  estimate_impact text not null default '',
  access_notes text not null default '',
  safety_notes text not null default '',
  confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  source_file_id uuid,
  review_status text not null default 'needs_review'
    check (review_status in ('ai_draft', 'needs_review', 'approved', 'rejected', 'human_verified')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text not null default ''
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'property_media_analysis'
      and column_name = 'property_id'
      and data_type = 'uuid'
  ) then
    alter table public.property_media_analysis
      alter column property_id type bigint using null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'property_media_findings'
      and column_name = 'property_id'
      and data_type = 'uuid'
  ) then
    alter table public.property_media_findings
      alter column property_id type bigint using null;
  end if;

  if to_regclass('public.properties') is not null then
    if not exists (select 1 from pg_constraint where conname = 'property_media_analysis_property_id_fkey') then
      alter table public.property_media_analysis
        add constraint property_media_analysis_property_id_fkey
        foreign key (property_id) references public.properties(id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'property_media_findings_property_id_fkey') then
      alter table public.property_media_findings
        add constraint property_media_findings_property_id_fkey
        foreign key (property_id) references public.properties(id) on delete set null;
    end if;
  end if;

  if to_regclass('public.files') is not null then
    if not exists (select 1 from pg_constraint where conname = 'property_media_analysis_source_file_id_fkey') then
      alter table public.property_media_analysis
        add constraint property_media_analysis_source_file_id_fkey
        foreign key (source_file_id) references public.files(id) on delete set null;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'property_media_findings_source_file_id_fkey') then
      alter table public.property_media_findings
        add constraint property_media_findings_source_file_id_fkey
        foreign key (source_file_id) references public.files(id) on delete set null;
    end if;
  end if;
end $$;

create index if not exists property_media_analysis_lead_idx on public.property_media_analysis(lead_id);
create index if not exists property_media_analysis_property_idx on public.property_media_analysis(property_id);
create index if not exists property_media_analysis_source_file_idx on public.property_media_analysis(source_file_id);
create index if not exists property_media_analysis_review_idx on public.property_media_analysis(review_status);

create index if not exists property_media_findings_analysis_idx on public.property_media_findings(property_media_analysis_id);
create index if not exists property_media_findings_lead_idx on public.property_media_findings(lead_id);
create index if not exists property_media_findings_property_idx on public.property_media_findings(property_id);
create index if not exists property_media_findings_source_file_idx on public.property_media_findings(source_file_id);
create index if not exists property_media_findings_review_idx on public.property_media_findings(review_status);

create or replace function public.touch_property_media_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_property_media_analysis_updated_at on public.property_media_analysis;
create trigger touch_property_media_analysis_updated_at
before update on public.property_media_analysis
for each row execute function public.touch_property_media_updated_at();

drop trigger if exists touch_property_media_findings_updated_at on public.property_media_findings;
create trigger touch_property_media_findings_updated_at
before update on public.property_media_findings
for each row execute function public.touch_property_media_updated_at();

alter table public.property_media_analysis enable row level security;
alter table public.property_media_findings enable row level security;

drop policy if exists "property media analysis admin manage" on public.property_media_analysis;
create policy "property media analysis admin manage"
on public.property_media_analysis
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "property media analysis estimator read" on public.property_media_analysis;
create policy "property media analysis estimator read"
on public.property_media_analysis
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "property media analysis estimator create drafts" on public.property_media_analysis;
create policy "property media analysis estimator create drafts"
on public.property_media_analysis
for insert
to authenticated
with check (
  public.current_user_role() = 'estimator'
  and review_status in ('ai_draft', 'needs_review')
);

drop policy if exists "property media findings admin manage" on public.property_media_findings;
create policy "property media findings admin manage"
on public.property_media_findings
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "property media findings estimator read" on public.property_media_findings;
create policy "property media findings estimator read"
on public.property_media_findings
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "property media findings estimator create drafts" on public.property_media_findings;
create policy "property media findings estimator create drafts"
on public.property_media_findings
for insert
to authenticated
with check (
  public.current_user_role() = 'estimator'
  and review_status in ('ai_draft', 'needs_review')
);
