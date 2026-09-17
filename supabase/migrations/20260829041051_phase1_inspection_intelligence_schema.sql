-- Shelter Prep Phase 1: Inspection Intelligence trust spine.
--
-- Migration file only. Do not apply until reviewed by a human operator.
--
-- Scope:
-- - Property/work-request anchors for inspection workflows.
-- - Evidence-linked inspection report extraction records.
-- - Written findings, embedded photos, visual interpretations, repair bundles,
--   verification questions, model runs, human review events, contractor packet
--   drafts, and agent-facing reviewed output.
-- - RLS and grants for newly introduced protected tables.
-- - Server-authoritative review/packet RPC rails. Browser clients do not get
--   direct UPDATE grants for AI draft, verified, agent-visible, final-pricing,
--   or memory-eligible fields.
--
-- Deliberate non-goals for this pass:
-- - No data backfill.
-- - No production migration application.
-- - No storage bucket creation.
-- - No UI/model execution wiring.
-- - No assumptions about the production `files.id` type. Source file
--   references are kept as text until the live schema is verified.

begin;

create extension if not exists pgcrypto;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.phase1_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.phase1_prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'This Phase 1 event table is immutable';
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer',
  company_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint phase1_profiles_role_check
    check (role in ('owner', 'admin', 'agent', 'property_manager', 'contractor', 'seller_owner', 'viewer'))
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text not null default 'viewer',
  add column if not exists company_name text,
  add column if not exists phone text,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function private.phase1_current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = (select auth.uid())
        and p.active = true
      limit 1
    ),
    'viewer'
  );
$$;

create or replace function private.phase1_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.phase1_current_app_role() in ('owner', 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Property anchors
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_from_lead_id text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  country text not null default 'US',
  normalized_address text,
  source_address text,
  property_type text,
  year_built integer,
  square_footage integer,
  bedrooms numeric,
  bathrooms numeric,
  status text not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_properties_status_check
    check (status in ('active', 'needs_review', 'blocked', 'archived')),
  constraint phase1_properties_year_built_check
    check (year_built is null or (year_built >= 1600 and year_built <= 2200)),
  constraint phase1_properties_square_footage_check
    check (square_footage is null or square_footage > 0)
);

create index if not exists phase1_properties_normalized_address_idx
  on public.properties(normalized_address)
  where normalized_address is not null;
create index if not exists phase1_properties_created_from_lead_idx
  on public.properties(created_from_lead_id)
  where created_from_lead_id is not null;
create index if not exists phase1_properties_created_by_idx on public.properties(created_by);
create index if not exists phase1_properties_status_idx on public.properties(status);

drop trigger if exists phase1_touch_properties_updated_at on public.properties;
create trigger phase1_touch_properties_updated_at
before update on public.properties
for each row execute function public.phase1_touch_updated_at();

create table if not exists public.property_access (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_on_property text not null default 'viewer',
  access_level text not null default 'view',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint phase1_property_access_role_check
    check (role_on_property in ('owner', 'admin', 'agent', 'property_manager', 'contractor', 'seller_owner', 'viewer')),
  constraint phase1_property_access_level_check
    check (access_level in ('view', 'comment', 'review', 'manage'))
);

create unique index if not exists phase1_property_access_active_unique_idx
  on public.property_access(property_id, user_id, role_on_property)
  where revoked_at is null;
create index if not exists phase1_property_access_user_idx on public.property_access(user_id);
create index if not exists phase1_property_access_property_idx on public.property_access(property_id);

create or replace function private.phase1_user_has_property_access(target_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    target_property_id is not null
    and (
      private.phase1_is_admin()
      or exists (
        select 1
        from public.properties p
        where p.id = target_property_id
          and p.created_by = (select auth.uid())
      )
      or exists (
        select 1
        from public.property_access pa
        where pa.property_id = target_property_id
          and pa.user_id = (select auth.uid())
          and pa.revoked_at is null
          and pa.access_level in ('view', 'comment', 'review', 'manage')
      )
    ),
    false
  );
$$;

create table if not exists public.work_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_lead_id text,
  created_by uuid references auth.users(id) on delete set null,
  requester_name text,
  requester_email text,
  requester_phone text,
  request_type text not null default 'inspection_repair',
  urgency text,
  occupancy text,
  description text,
  status text not null default 'new',
  secondary_flags text[] not null default '{}',
  budget_concern text,
  review_owner_type text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint phase1_work_requests_status_check
    check (status in ('new', 'in_progress', 'needs_info', 'needs_review', 'ready', 'done', 'blocked', 'archived')),
  constraint phase1_work_requests_review_owner_check
    check (review_owner_type in ('admin', 'agent', 'property_manager', 'contractor', 'seller_owner', 'system'))
);

create index if not exists phase1_work_requests_property_idx on public.work_requests(property_id);
create index if not exists phase1_work_requests_source_lead_idx
  on public.work_requests(source_lead_id)
  where source_lead_id is not null;
create index if not exists phase1_work_requests_status_idx on public.work_requests(status);
create index if not exists phase1_work_requests_created_at_idx on public.work_requests(created_at desc);

drop trigger if exists phase1_touch_work_requests_updated_at on public.work_requests;
create trigger phase1_touch_work_requests_updated_at
before update on public.work_requests
for each row execute function public.phase1_touch_updated_at();

do $$
begin
  if to_regclass('public.leads') is not null then
    alter table public.leads add column if not exists property_id uuid;
    create index if not exists phase1_leads_property_id_idx on public.leads(property_id);

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.leads'::regclass
        and conname = 'phase1_leads_property_id_fkey'
    ) then
      alter table public.leads
        add constraint phase1_leads_property_id_fkey
        foreign key (property_id) references public.properties(id) on delete set null
        not valid;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Model and extraction runs
-- ---------------------------------------------------------------------------

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete cascade,
  inspection_report_id uuid,
  stage text not null,
  trigger_source text not null default 'manual',
  provider text,
  model text,
  model_version text,
  prompt_version text not null,
  input_hash text not null,
  input_references jsonb not null default '[]'::jsonb,
  output jsonb,
  status text not null default 'queued',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  latency_ms integer,
  cost_usd numeric,
  token_usage jsonb not null default '{}'::jsonb,
  review_required boolean not null default true,
  memory_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  constraint phase1_model_runs_stage_check
    check (stage in (
      'document_extraction',
      'image_extraction',
      'evidence_linking',
      'inspection_interpretation',
      'repair_bundling',
      'verification_questions',
      'contractor_scope_draft',
      'agent_review_output'
    )),
  constraint phase1_model_runs_status_check
    check (status in ('queued', 'running', 'failed', 'draft_created', 'succeeded', 'superseded', 'archived')),
  constraint phase1_model_runs_no_memory_without_review_check
    check (memory_eligible = false)
);

create index if not exists phase1_model_runs_property_idx on public.model_runs(property_id);
create index if not exists phase1_model_runs_work_request_idx on public.model_runs(work_request_id);
create index if not exists phase1_model_runs_report_idx on public.model_runs(inspection_report_id);
create index if not exists phase1_model_runs_stage_status_idx on public.model_runs(stage, status);
create unique index if not exists phase1_model_runs_completed_dedupe_idx
  on public.model_runs(stage, prompt_version, input_hash)
  where status in ('draft_created', 'succeeded');

create table if not exists public.inspection_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  source_file_id text not null,
  inspection_report_id uuid,
  pipeline_version text not null default 'phase1.inspection_intelligence.v1',
  input_hash text not null,
  requested_by uuid references auth.users(id) on delete set null,
  trigger_source text not null default 'manual',
  current_stage text not null default 'document_extraction',
  stage_statuses jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_pipeline_runs_current_stage_check
    check (current_stage in (
      'document_extraction',
      'image_extraction',
      'evidence_linking',
      'inspection_interpretation',
      'repair_bundling',
      'verification_questions',
      'human_review',
      'contractor_scope_draft',
      'agent_review_output'
    )),
  constraint phase1_pipeline_runs_status_check
    check (status in ('queued', 'running', 'failed', 'draft_created', 'needs_review', 'completed', 'superseded', 'archived'))
);

create index if not exists phase1_pipeline_runs_property_idx on public.inspection_pipeline_runs(property_id);
create index if not exists phase1_pipeline_runs_work_request_idx on public.inspection_pipeline_runs(work_request_id);
create index if not exists phase1_pipeline_runs_source_file_idx on public.inspection_pipeline_runs(source_file_id);
create unique index if not exists phase1_pipeline_runs_active_dedupe_idx
  on public.inspection_pipeline_runs(source_file_id, pipeline_version, input_hash)
  where status in ('queued', 'running', 'draft_created', 'needs_review', 'completed');

drop trigger if exists phase1_touch_pipeline_runs_updated_at on public.inspection_pipeline_runs;
create trigger phase1_touch_pipeline_runs_updated_at
before update on public.inspection_pipeline_runs
for each row execute function public.phase1_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Report extraction and source evidence
-- ---------------------------------------------------------------------------

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  source_file_id text not null,
  source_storage_bucket text,
  source_storage_path text,
  original_filename text,
  source_checksum text,
  property_metadata jsonb not null default '{}'::jsonb,
  street_address text,
  city text,
  state text,
  zip text,
  year_built integer,
  square_footage integer,
  bedrooms numeric,
  bathrooms numeric,
  inspection_date date,
  inspector_name text,
  client_name text,
  inspection_company text,
  inspector_license_numbers text[] not null default '{}',
  inspector_phone text,
  inspector_email text,
  building_profile jsonb not null default '{}'::jsonb,
  inspection_limitations jsonb not null default '[]'::jsonb,
  page_count integer,
  text_extraction_status text not null default 'pending',
  image_extraction_status text not null default 'pending',
  evidence_linking_status text not null default 'pending',
  interpretation_status text not null default 'pending',
  bundling_status text not null default 'pending',
  review_status text not null default 'ai_draft',
  extraction_summary jsonb not null default '{}'::jsonb,
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_inspection_reports_page_count_check
    check (page_count is null or page_count > 0),
  constraint phase1_inspection_reports_extraction_status_check
    check (
      text_extraction_status in ('pending', 'running', 'partial', 'extracted', 'failed', 'not_available')
      and image_extraction_status in ('pending', 'running', 'partial', 'extracted', 'failed', 'not_available')
      and evidence_linking_status in ('pending', 'running', 'partial', 'linked', 'failed', 'not_available')
      and interpretation_status in ('pending', 'running', 'partial', 'draft_created', 'failed', 'not_available')
      and bundling_status in ('pending', 'running', 'partial', 'draft_created', 'failed', 'not_available')
    ),
  constraint phase1_inspection_reports_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated'))
);

alter table public.model_runs
  add constraint phase1_model_runs_inspection_report_id_fkey
  foreign key (inspection_report_id) references public.inspection_reports(id) on delete set null
  not valid;

alter table public.inspection_pipeline_runs
  add constraint phase1_pipeline_runs_inspection_report_id_fkey
  foreign key (inspection_report_id) references public.inspection_reports(id) on delete set null
  not valid;

create index if not exists phase1_inspection_reports_property_idx on public.inspection_reports(property_id);
create index if not exists phase1_inspection_reports_work_request_idx on public.inspection_reports(work_request_id);
create index if not exists phase1_inspection_reports_source_file_idx on public.inspection_reports(source_file_id);
create index if not exists phase1_inspection_reports_review_status_idx on public.inspection_reports(review_status);

drop trigger if exists phase1_touch_inspection_reports_updated_at on public.inspection_reports;
create trigger phase1_touch_inspection_reports_updated_at
before update on public.inspection_reports
for each row execute function public.phase1_touch_updated_at();

create table if not exists public.inspection_report_pages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  inspection_report_id uuid not null references public.inspection_reports(id) on delete cascade,
  source_file_id text not null,
  page_number integer not null,
  text_content text,
  extraction_status text not null default 'pending',
  extraction_method text,
  image_count integer,
  layout_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint phase1_report_pages_page_number_check
    check (page_number > 0),
  constraint phase1_report_pages_status_check
    check (extraction_status in ('pending', 'running', 'empty', 'extracted', 'partial', 'failed', 'not_available')),
  unique (inspection_report_id, page_number)
);

create index if not exists phase1_report_pages_property_idx on public.inspection_report_pages(property_id);
create index if not exists phase1_report_pages_report_idx on public.inspection_report_pages(inspection_report_id);
create index if not exists phase1_report_pages_source_file_idx on public.inspection_report_pages(source_file_id);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete cascade,
  source_type text not null,
  source_file_id text,
  source_page integer,
  source_section text,
  source_item_number text,
  source_image_id uuid,
  source_caption text,
  source_excerpt text,
  observation text,
  inspector_statement text,
  visual_observation text,
  shelter_prep_interpretation text,
  claim_type text not null default 'source_evidence',
  confidence text not null default 'low',
  requires_field_verification boolean not null default true,
  provenance jsonb not null default '{}'::jsonb,
  created_by_agent text,
  model_run_id uuid references public.model_runs(id) on delete set null,
  review_status text not null default 'ai_draft',
  created_at timestamptz not null default now(),
  constraint phase1_evidence_source_type_check
    check (source_type in (
      'inspection_report_text',
      'inspection_report_photo',
      'photo_caption',
      'inspector_recommendation',
      'visual_observation',
      'shelter_prep_interpretation',
      'contractor_input',
      'admin_note',
      'external_source'
    )),
  constraint phase1_evidence_confidence_check
    check (confidence in ('low', 'medium', 'high')),
  constraint phase1_evidence_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_evidence_no_source_no_claim_check
    check (
      source_file_id is not null
      or source_page is not null
      or source_image_id is not null
      or nullif(btrim(coalesce(source_excerpt, '')), '') is not null
      or nullif(btrim(coalesce(source_caption, '')), '') is not null
    )
);

create index if not exists phase1_evidence_property_idx on public.evidence_items(property_id);
create index if not exists phase1_evidence_work_request_idx on public.evidence_items(work_request_id);
create index if not exists phase1_evidence_report_idx on public.evidence_items(inspection_report_id);
create index if not exists phase1_evidence_source_file_idx on public.evidence_items(source_file_id);
create index if not exists phase1_evidence_item_number_idx on public.evidence_items(source_item_number);
create index if not exists phase1_evidence_review_status_idx on public.evidence_items(review_status);

-- ---------------------------------------------------------------------------
-- Written findings and embedded report images
-- ---------------------------------------------------------------------------

create table if not exists public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid not null references public.inspection_reports(id) on delete cascade,
  source_file_id text not null,
  source_page integer,
  source_section text,
  source_item_number text,
  original_text text not null,
  inspector_recommendation text,
  inspector_location text,
  normalized_location text,
  building_system text,
  trade_category text,
  urgency text not null default 'routine',
  safety_flag boolean not null default false,
  moisture_flag boolean not null default false,
  further_evaluation_flag boolean not null default false,
  maintenance_flag boolean not null default false,
  fyi_flag boolean not null default false,
  raw_evidence_ids uuid[] not null default '{}',
  known_facts text[] not null default '{}',
  observations text[] not null default '{}',
  interpretations text[] not null default '{}',
  assumptions text[] not null default '{}',
  unknowns text[] not null default '{}',
  needs_field_verification text[] not null default '{}',
  review_status text not null default 'ai_draft',
  review_event_id uuid,
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_findings_source_page_check
    check (source_page is null or source_page > 0),
  constraint phase1_findings_urgency_check
    check (urgency in ('routine', 'soon', 'urgent', 'asap', 'safety')),
  constraint phase1_findings_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_findings_no_source_no_claim_check
    check (
      nullif(btrim(original_text), '') is not null
      and (
        source_file_id is not null
        or source_page is not null
        or coalesce(cardinality(raw_evidence_ids), 0) > 0
      )
    )
);

create index if not exists phase1_findings_property_idx on public.inspection_findings(property_id);
create index if not exists phase1_findings_work_request_idx on public.inspection_findings(work_request_id);
create index if not exists phase1_findings_report_idx on public.inspection_findings(inspection_report_id);
create index if not exists phase1_findings_source_item_idx on public.inspection_findings(source_item_number);
create index if not exists phase1_findings_system_idx on public.inspection_findings(building_system);
create index if not exists phase1_findings_trade_idx on public.inspection_findings(trade_category);
create index if not exists phase1_findings_review_status_idx on public.inspection_findings(review_status);
create index if not exists phase1_findings_evidence_gin_idx on public.inspection_findings using gin(raw_evidence_ids);

drop trigger if exists phase1_touch_inspection_findings_updated_at on public.inspection_findings;
create trigger phase1_touch_inspection_findings_updated_at
before update on public.inspection_findings
for each row execute function public.phase1_touch_updated_at();

create table if not exists public.inspection_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid not null references public.inspection_reports(id) on delete cascade,
  source_file_id text not null,
  source_page integer not null,
  image_index integer not null,
  caption text,
  item_number text,
  related_written_finding_id uuid references public.inspection_findings(id) on delete set null,
  extracted_image_storage_bucket text,
  extracted_image_storage_path text,
  image_dimensions jsonb not null default '{}'::jsonb,
  extraction_method text,
  extraction_status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint phase1_images_page_check check (source_page > 0),
  constraint phase1_images_index_check check (image_index >= 0),
  constraint phase1_images_status_check
    check (extraction_status in ('pending', 'running', 'extracted', 'failed', 'not_available', 'skipped')),
  unique (inspection_report_id, source_page, image_index)
);

create index if not exists phase1_images_property_idx on public.inspection_images(property_id);
create index if not exists phase1_images_report_idx on public.inspection_images(inspection_report_id);
create index if not exists phase1_images_item_number_idx on public.inspection_images(item_number);
create index if not exists phase1_images_related_finding_idx on public.inspection_images(related_written_finding_id);

create table if not exists public.photo_interpretations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  inspection_image_id uuid not null references public.inspection_images(id) on delete cascade,
  related_finding_id uuid references public.inspection_findings(id) on delete set null,
  inspector_statement text,
  visual_observation text,
  shelter_prep_interpretation text,
  discrepancy_flag boolean not null default false,
  discrepancy_notes text,
  confidence text not null default 'low',
  review_status text not null default 'ai_draft',
  evidence_item_ids uuid[] not null default '{}',
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint phase1_photo_interpretations_confidence_check
    check (confidence in ('low', 'medium', 'high')),
  constraint phase1_photo_interpretations_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_photo_interpretations_state_separation_check
    check (
      inspector_statement is not null
      or visual_observation is not null
      or shelter_prep_interpretation is not null
    )
);

create index if not exists phase1_photo_interpretations_property_idx on public.photo_interpretations(property_id);
create index if not exists phase1_photo_interpretations_image_idx on public.photo_interpretations(inspection_image_id);
create index if not exists phase1_photo_interpretations_finding_idx on public.photo_interpretations(related_finding_id);
create index if not exists phase1_photo_interpretations_evidence_gin_idx on public.photo_interpretations using gin(evidence_item_ids);

-- ---------------------------------------------------------------------------
-- Operational repair bundles and missing information
-- ---------------------------------------------------------------------------

create table if not exists public.repair_bundles (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid not null references public.inspection_reports(id) on delete cascade,
  title text not null,
  building_system text,
  related_finding_ids uuid[] not null default '{}',
  related_evidence_ids uuid[] not null default '{}',
  locations text[] not null default '{}',
  operational_interpretation text,
  known_facts text[] not null default '{}',
  observations text[] not null default '{}',
  interpretations text[] not null default '{}',
  assumptions text[] not null default '{}',
  unknowns text[] not null default '{}',
  needs_field_verification text[] not null default '{}',
  likely_trades text[] not null default '{}',
  sequencing_notes text[] not null default '{}',
  hidden_labor_or_dependency_notes text[] not null default '{}',
  contractor_review_needed boolean not null default true,
  consequence_level text not null default 'medium',
  review_status text not null default 'ai_draft',
  review_event_id uuid,
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_repair_bundles_consequence_check
    check (consequence_level in ('low', 'medium', 'high', 'critical')),
  constraint phase1_repair_bundles_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_repair_bundles_source_link_check
    check (coalesce(cardinality(related_finding_ids), 0) > 0 or coalesce(cardinality(related_evidence_ids), 0) > 0)
);

create index if not exists phase1_repair_bundles_property_idx on public.repair_bundles(property_id);
create index if not exists phase1_repair_bundles_work_request_idx on public.repair_bundles(work_request_id);
create index if not exists phase1_repair_bundles_report_idx on public.repair_bundles(inspection_report_id);
create index if not exists phase1_repair_bundles_system_idx on public.repair_bundles(building_system);
create index if not exists phase1_repair_bundles_review_status_idx on public.repair_bundles(review_status);
create index if not exists phase1_repair_bundles_findings_gin_idx on public.repair_bundles using gin(related_finding_ids);
create index if not exists phase1_repair_bundles_evidence_gin_idx on public.repair_bundles using gin(related_evidence_ids);

drop trigger if exists phase1_touch_repair_bundles_updated_at on public.repair_bundles;
create trigger phase1_touch_repair_bundles_updated_at
before update on public.repair_bundles
for each row execute function public.phase1_touch_updated_at();

create table if not exists public.verification_questions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete cascade,
  repair_bundle_id uuid references public.repair_bundles(id) on delete cascade,
  inspection_finding_id uuid references public.inspection_findings(id) on delete cascade,
  evidence_item_ids uuid[] not null default '{}',
  question_text text not null,
  reason text,
  consequence_level text not null default 'medium',
  uncertainty_reduction_value text not null default 'medium',
  urgency text not null default 'routine',
  cost_to_obtain text not null default 'medium',
  rank_score integer not null default 50,
  owner_type text not null default 'admin',
  status text not null default 'open',
  answer_text text,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  review_status text not null default 'needs_review',
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_questions_consequence_check
    check (consequence_level in ('low', 'medium', 'high', 'critical')),
  constraint phase1_questions_uncertainty_check
    check (uncertainty_reduction_value in ('low', 'medium', 'high')),
  constraint phase1_questions_urgency_check
    check (urgency in ('routine', 'soon', 'urgent', 'asap', 'safety')),
  constraint phase1_questions_cost_check
    check (cost_to_obtain in ('low', 'medium', 'high')),
  constraint phase1_questions_status_check
    check (status in ('open', 'answered', 'needs_more_info', 'rejected', 'superseded')),
  constraint phase1_questions_review_status_check
    check (review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated'))
);

create index if not exists phase1_questions_property_idx on public.verification_questions(property_id);
create index if not exists phase1_questions_bundle_idx on public.verification_questions(repair_bundle_id);
create index if not exists phase1_questions_finding_idx on public.verification_questions(inspection_finding_id);
create index if not exists phase1_questions_status_rank_idx on public.verification_questions(status, rank_score desc);
create index if not exists phase1_questions_evidence_gin_idx on public.verification_questions using gin(evidence_item_ids);

drop trigger if exists phase1_touch_verification_questions_updated_at on public.verification_questions;
create trigger phase1_touch_verification_questions_updated_at
before update on public.verification_questions
for each row execute function public.phase1_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Review events, workflow events, contractor packets, and agent output
-- ---------------------------------------------------------------------------

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  reviewed_object_type text not null,
  reviewed_object_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  review_action text not null,
  previous_value jsonb not null default '{}'::jsonb,
  new_value jsonb not null default '{}'::jsonb,
  reason text,
  source_evidence_ids uuid[] not null default '{}',
  model_run_id uuid references public.model_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint phase1_review_events_object_type_check
    check (reviewed_object_type in (
      'inspection_finding',
      'inspection_image',
      'photo_interpretation',
      'repair_bundle',
      'verification_question',
      'contractor_scope_packet',
      'agent_report'
    )),
  constraint phase1_review_events_action_check
    check (review_action in ('approve', 'edit', 'needs_more_info', 'reject', 'deprecate'))
);

create index if not exists phase1_review_events_property_idx on public.review_events(property_id);
create index if not exists phase1_review_events_report_idx on public.review_events(inspection_report_id);
create index if not exists phase1_review_events_object_idx on public.review_events(reviewed_object_type, reviewed_object_id);
create index if not exists phase1_review_events_created_at_idx on public.review_events(created_at desc);

drop trigger if exists phase1_block_review_events_update on public.review_events;
create trigger phase1_block_review_events_update
before update on public.review_events
for each row execute function public.phase1_prevent_mutation();

drop trigger if exists phase1_block_review_events_delete on public.review_events;
create trigger phase1_block_review_events_delete
before delete on public.review_events
for each row execute function public.phase1_prevent_mutation();

alter table public.inspection_findings
  add constraint phase1_findings_review_event_fkey
  foreign key (review_event_id) references public.review_events(id) on delete set null
  not valid;

alter table public.repair_bundles
  add constraint phase1_repair_bundles_review_event_fkey
  foreign key (review_event_id) references public.review_events(id) on delete set null
  not valid;

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system',
  event_type text not null,
  event_title text not null,
  event_body text,
  object_type text,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint phase1_workflow_events_actor_type_check
    check (actor_type in ('system', 'admin', 'agent', 'property_manager', 'contractor', 'seller_owner'))
);

create index if not exists phase1_workflow_events_property_idx on public.workflow_events(property_id);
create index if not exists phase1_workflow_events_work_request_idx on public.workflow_events(work_request_id);
create index if not exists phase1_workflow_events_object_idx on public.workflow_events(object_type, object_id);
create index if not exists phase1_workflow_events_created_at_idx on public.workflow_events(created_at desc);

drop trigger if exists phase1_block_workflow_events_update on public.workflow_events;
create trigger phase1_block_workflow_events_update
before update on public.workflow_events
for each row execute function public.phase1_prevent_mutation();

drop trigger if exists phase1_block_workflow_events_delete on public.workflow_events;
create trigger phase1_block_workflow_events_delete
before delete on public.workflow_events
for each row execute function public.phase1_prevent_mutation();

create table if not exists public.contractor_inputs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  repair_bundle_id uuid references public.repair_bundles(id) on delete set null,
  contractor_id uuid,
  contractor_name text,
  source_file_id text,
  source_text text,
  source_type text not null default 'contractor_scope',
  source_uploaded_by text,
  source_uploaded_at timestamptz not null default now(),
  contractor_uploaded_source boolean not null default true,
  contractor_verified_ai_summary boolean not null default false,
  review_status text not null default 'contractor_uploaded_source',
  created_at timestamptz not null default now(),
  constraint phase1_contractor_inputs_source_type_check
    check (source_type in ('contractor_scope', 'contractor_estimate', 'contractor_photo', 'contractor_note', 'invoice_draft')),
  constraint phase1_contractor_inputs_review_status_check
    check (review_status in (
      'contractor_uploaded_source',
      'ai_structured_from_contractor_source',
      'admin_verified_structured_summary',
      'contractor_verified_structured_summary',
      'rejected',
      'deprecated'
    )),
  constraint phase1_contractor_inputs_not_auto_verified_check
    check (contractor_verified_ai_summary = false or review_status = 'contractor_verified_structured_summary')
);

create index if not exists phase1_contractor_inputs_property_idx on public.contractor_inputs(property_id);
create index if not exists phase1_contractor_inputs_bundle_idx on public.contractor_inputs(repair_bundle_id);
create index if not exists phase1_contractor_inputs_source_file_idx on public.contractor_inputs(source_file_id);

create table if not exists public.contractor_scope_packets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  repair_bundle_id uuid not null references public.repair_bundles(id) on delete restrict,
  generated_from_reviewed_only boolean not null default true,
  relevant_finding_ids uuid[] not null default '{}',
  relevant_image_ids uuid[] not null default '{}',
  relevant_evidence_ids uuid[] not null default '{}',
  verification_question_ids uuid[] not null default '{}',
  packet_status text not null default 'ai_draft',
  property_snapshot jsonb not null default '{}'::jsonb,
  system_or_trade text,
  requested_professional_task text,
  observed_conditions text[] not null default '{}',
  unresolved_unknowns text[] not null default '{}',
  known_exclusions text[] not null default '{}',
  access_information text,
  content jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  review_event_id uuid references public.review_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_scope_packets_status_check
    check (packet_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_scope_packets_reviewed_only_check
    check (generated_from_reviewed_only = true)
);

create index if not exists phase1_scope_packets_property_idx on public.contractor_scope_packets(property_id);
create index if not exists phase1_scope_packets_bundle_idx on public.contractor_scope_packets(repair_bundle_id);
create index if not exists phase1_scope_packets_status_idx on public.contractor_scope_packets(packet_status);
create index if not exists phase1_scope_packets_findings_gin_idx on public.contractor_scope_packets using gin(relevant_finding_ids);
create index if not exists phase1_scope_packets_evidence_gin_idx on public.contractor_scope_packets using gin(relevant_evidence_ids);

drop trigger if exists phase1_touch_contractor_scope_packets_updated_at on public.contractor_scope_packets;
create trigger phase1_touch_contractor_scope_packets_updated_at
before update on public.contractor_scope_packets
for each row execute function public.phase1_touch_updated_at();

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  work_request_id uuid references public.work_requests(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  report_type text not null default 'inspection_repair_clarity',
  report_status text not null default 'ai_draft',
  generated_from_reviewed_only boolean not null default true,
  summary jsonb not null default '{}'::jsonb,
  priority_items jsonb not null default '[]'::jsonb,
  repair_bundle_ids uuid[] not null default '{}',
  next_action text,
  human_review_status text not null default 'needs_review',
  source_evidence_ids uuid[] not null default '{}',
  model_run_id uuid references public.model_runs(id) on delete set null,
  review_event_id uuid references public.review_events(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint phase1_agent_reports_type_check
    check (report_type in ('inspection_repair_clarity', 'contractor_scope_summary', 'seller_prep_summary')),
  constraint phase1_agent_reports_status_check
    check (report_status in ('ai_draft', 'needs_review', 'human_reviewed', 'seller_ready', 'finalized', 'rejected', 'deprecated')),
  constraint phase1_agent_reports_human_review_status_check
    check (human_review_status in ('ai_draft', 'needs_review', 'human_reviewed', 'human_verified', 'rejected', 'deprecated')),
  constraint phase1_agent_reports_reviewed_only_check
    check (generated_from_reviewed_only = true)
);

create index if not exists phase1_agent_reports_property_idx on public.agent_reports(property_id);
create index if not exists phase1_agent_reports_report_idx on public.agent_reports(inspection_report_id);
create index if not exists phase1_agent_reports_status_idx on public.agent_reports(report_status);
create index if not exists phase1_agent_reports_bundles_gin_idx on public.agent_reports using gin(repair_bundle_ids);
create index if not exists phase1_agent_reports_evidence_gin_idx on public.agent_reports using gin(source_evidence_ids);

drop trigger if exists phase1_touch_agent_reports_updated_at on public.agent_reports;
create trigger phase1_touch_agent_reports_updated_at
before update on public.agent_reports
for each row execute function public.phase1_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Server-authoritative review and reviewed-output RPC rails
-- ---------------------------------------------------------------------------

create or replace function private.phase1_review_inspection_finding_impl(
  p_finding_id uuid,
  p_review_action text,
  p_new_value jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finding public.inspection_findings%rowtype;
  v_event_id uuid;
  v_next_status text;
begin
  if not private.phase1_is_admin() then
    raise exception 'Only an admin or owner can review inspection findings';
  end if;

  if p_review_action not in ('approve', 'edit', 'needs_more_info', 'reject', 'deprecate') then
    raise exception 'Unsupported review action: %', p_review_action;
  end if;

  select *
  into v_finding
  from public.inspection_findings
  where id = p_finding_id
  for update;

  if not found then
    raise exception 'Inspection finding not found: %', p_finding_id;
  end if;

  v_next_status := case p_review_action
    when 'approve' then 'human_verified'
    when 'edit' then 'human_reviewed'
    when 'needs_more_info' then 'needs_review'
    when 'reject' then 'rejected'
    when 'deprecate' then 'deprecated'
  end;

  insert into public.review_events (
    property_id,
    work_request_id,
    inspection_report_id,
    reviewed_object_type,
    reviewed_object_id,
    reviewer_id,
    review_action,
    previous_value,
    new_value,
    reason,
    source_evidence_ids,
    model_run_id
  )
  values (
    v_finding.property_id,
    v_finding.work_request_id,
    v_finding.inspection_report_id,
    'inspection_finding',
    v_finding.id,
    (select auth.uid()),
    p_review_action,
    to_jsonb(v_finding),
    coalesce(p_new_value, '{}'::jsonb),
    p_reason,
    v_finding.raw_evidence_ids,
    v_finding.model_run_id
  )
  returning id into v_event_id;

  update public.inspection_findings
  set review_status = v_next_status,
      review_event_id = v_event_id,
      updated_at = now()
  where id = p_finding_id;

  insert into public.workflow_events (
    property_id,
    work_request_id,
    actor_id,
    actor_type,
    event_type,
    event_title,
    event_body,
    object_type,
    object_id,
    metadata
  )
  values (
    v_finding.property_id,
    v_finding.work_request_id,
    (select auth.uid()),
    'admin',
    'inspection_finding_reviewed',
    'Inspection finding reviewed',
    p_reason,
    'inspection_finding',
    v_finding.id,
    jsonb_build_object('review_action', p_review_action, 'next_status', v_next_status, 'review_event_id', v_event_id)
  );

  return v_event_id;
end;
$$;

create or replace function private.phase1_review_repair_bundle_impl(
  p_repair_bundle_id uuid,
  p_review_action text,
  p_new_value jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.repair_bundles%rowtype;
  v_event_id uuid;
  v_next_status text;
begin
  if not private.phase1_is_admin() then
    raise exception 'Only an admin or owner can review repair bundles';
  end if;

  if p_review_action not in ('approve', 'edit', 'needs_more_info', 'reject', 'deprecate') then
    raise exception 'Unsupported review action: %', p_review_action;
  end if;

  select *
  into v_bundle
  from public.repair_bundles
  where id = p_repair_bundle_id
  for update;

  if not found then
    raise exception 'Repair bundle not found: %', p_repair_bundle_id;
  end if;

  v_next_status := case p_review_action
    when 'approve' then 'human_verified'
    when 'edit' then 'human_reviewed'
    when 'needs_more_info' then 'needs_review'
    when 'reject' then 'rejected'
    when 'deprecate' then 'deprecated'
  end;

  insert into public.review_events (
    property_id,
    work_request_id,
    inspection_report_id,
    reviewed_object_type,
    reviewed_object_id,
    reviewer_id,
    review_action,
    previous_value,
    new_value,
    reason,
    source_evidence_ids,
    model_run_id
  )
  values (
    v_bundle.property_id,
    v_bundle.work_request_id,
    v_bundle.inspection_report_id,
    'repair_bundle',
    v_bundle.id,
    (select auth.uid()),
    p_review_action,
    to_jsonb(v_bundle),
    coalesce(p_new_value, '{}'::jsonb),
    p_reason,
    v_bundle.related_evidence_ids,
    v_bundle.model_run_id
  )
  returning id into v_event_id;

  update public.repair_bundles
  set review_status = v_next_status,
      review_event_id = v_event_id,
      updated_at = now()
  where id = p_repair_bundle_id;

  insert into public.workflow_events (
    property_id,
    work_request_id,
    actor_id,
    actor_type,
    event_type,
    event_title,
    event_body,
    object_type,
    object_id,
    metadata
  )
  values (
    v_bundle.property_id,
    v_bundle.work_request_id,
    (select auth.uid()),
    'admin',
    'repair_bundle_reviewed',
    'Repair bundle reviewed',
    p_reason,
    'repair_bundle',
    v_bundle.id,
    jsonb_build_object('review_action', p_review_action, 'next_status', v_next_status, 'review_event_id', v_event_id)
  );

  return v_event_id;
end;
$$;

create or replace function private.phase1_create_contractor_scope_packet_impl(
  p_repair_bundle_id uuid,
  p_requested_professional_task text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.repair_bundles%rowtype;
  v_packet_id uuid;
begin
  if not private.phase1_is_admin() then
    raise exception 'Only an admin or owner can create contractor scope packets';
  end if;

  select *
  into v_bundle
  from public.repair_bundles
  where id = p_repair_bundle_id;

  if not found then
    raise exception 'Repair bundle not found: %', p_repair_bundle_id;
  end if;

  if v_bundle.review_status not in ('human_reviewed', 'human_verified') then
    raise exception 'Contractor packets require a reviewed repair bundle';
  end if;

  if coalesce(cardinality(v_bundle.related_finding_ids), 0) = 0 then
    raise exception 'Contractor packets require source findings';
  end if;

  if exists (
    select 1
    from public.inspection_findings f
    where f.id = any(v_bundle.related_finding_ids)
      and f.review_status not in ('human_reviewed', 'human_verified')
  ) then
    raise exception 'Contractor packets require reviewed source findings';
  end if;

  insert into public.contractor_scope_packets (
    property_id,
    work_request_id,
    inspection_report_id,
    repair_bundle_id,
    relevant_finding_ids,
    relevant_evidence_ids,
    property_snapshot,
    system_or_trade,
    requested_professional_task,
    observed_conditions,
    unresolved_unknowns,
    content,
    created_by
  )
  values (
    v_bundle.property_id,
    v_bundle.work_request_id,
    v_bundle.inspection_report_id,
    v_bundle.id,
    v_bundle.related_finding_ids,
    v_bundle.related_evidence_ids,
    jsonb_build_object('property_id', v_bundle.property_id, 'generated_at', now()),
    v_bundle.building_system,
    p_requested_professional_task,
    v_bundle.observations,
    v_bundle.unknowns,
    jsonb_build_object(
      'title', v_bundle.title,
      'known_facts', v_bundle.known_facts,
      'unknowns', v_bundle.unknowns,
      'needs_field_verification', v_bundle.needs_field_verification,
      'likely_trades', v_bundle.likely_trades,
      'review_status', v_bundle.review_status
    ),
    (select auth.uid())
  )
  returning id into v_packet_id;

  insert into public.workflow_events (
    property_id,
    work_request_id,
    actor_id,
    actor_type,
    event_type,
    event_title,
    object_type,
    object_id,
    metadata
  )
  values (
    v_bundle.property_id,
    v_bundle.work_request_id,
    (select auth.uid()),
    'admin',
    'contractor_scope_packet_created',
    'Contractor scope packet created from reviewed bundle',
    'contractor_scope_packet',
    v_packet_id,
    jsonb_build_object('repair_bundle_id', v_bundle.id)
  );

  return v_packet_id;
end;
$$;

create or replace function private.phase1_create_agent_report_impl(
  p_inspection_report_id uuid,
  p_repair_bundle_ids uuid[],
  p_summary jsonb,
  p_next_action text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.inspection_reports%rowtype;
  v_agent_report_id uuid;
begin
  if not private.phase1_is_admin() then
    raise exception 'Only an admin or owner can create agent-facing reviewed output';
  end if;

  if coalesce(cardinality(p_repair_bundle_ids), 0) = 0 then
    raise exception 'Agent-facing reports require at least one reviewed repair bundle';
  end if;

  select *
  into v_report
  from public.inspection_reports
  where id = p_inspection_report_id;

  if not found then
    raise exception 'Inspection report not found: %', p_inspection_report_id;
  end if;

  if exists (
    select 1
    from public.repair_bundles b
    where b.id = any(p_repair_bundle_ids)
      and (
        b.inspection_report_id <> p_inspection_report_id
        or b.review_status not in ('human_reviewed', 'human_verified')
      )
  ) then
    raise exception 'Agent-facing reports may only use reviewed bundles from the selected inspection report';
  end if;

  insert into public.agent_reports (
    property_id,
    work_request_id,
    inspection_report_id,
    report_status,
    summary,
    repair_bundle_ids,
    next_action,
    human_review_status,
    created_by
  )
  values (
    v_report.property_id,
    v_report.work_request_id,
    v_report.id,
    'human_reviewed',
    coalesce(p_summary, '{}'::jsonb),
    p_repair_bundle_ids,
    p_next_action,
    'human_reviewed',
    (select auth.uid())
  )
  returning id into v_agent_report_id;

  insert into public.workflow_events (
    property_id,
    work_request_id,
    actor_id,
    actor_type,
    event_type,
    event_title,
    object_type,
    object_id,
    metadata
  )
  values (
    v_report.property_id,
    v_report.work_request_id,
    (select auth.uid()),
    'admin',
    'agent_report_created',
    'Agent-facing reviewed output created',
    'agent_report',
    v_agent_report_id,
    jsonb_build_object('inspection_report_id', v_report.id, 'repair_bundle_ids', p_repair_bundle_ids)
  );

  return v_agent_report_id;
end;
$$;

create or replace function public.phase1_review_inspection_finding(
  p_finding_id uuid,
  p_review_action text,
  p_new_value jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.phase1_review_inspection_finding_impl(
    p_finding_id,
    p_review_action,
    p_new_value,
    p_reason
  );
$$;

create or replace function public.phase1_review_repair_bundle(
  p_repair_bundle_id uuid,
  p_review_action text,
  p_new_value jsonb default '{}'::jsonb,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.phase1_review_repair_bundle_impl(
    p_repair_bundle_id,
    p_review_action,
    p_new_value,
    p_reason
  );
$$;

create or replace function public.phase1_create_contractor_scope_packet(
  p_repair_bundle_id uuid,
  p_requested_professional_task text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.phase1_create_contractor_scope_packet_impl(
    p_repair_bundle_id,
    p_requested_professional_task
  );
$$;

create or replace function public.phase1_create_agent_report(
  p_inspection_report_id uuid,
  p_repair_bundle_ids uuid[],
  p_summary jsonb,
  p_next_action text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.phase1_create_agent_report_impl(
    p_inspection_report_id,
    p_repair_bundle_ids,
    p_summary,
    p_next_action
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_access enable row level security;
alter table public.work_requests enable row level security;
alter table public.model_runs enable row level security;
alter table public.inspection_pipeline_runs enable row level security;
alter table public.inspection_reports enable row level security;
alter table public.inspection_report_pages enable row level security;
alter table public.evidence_items enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.inspection_images enable row level security;
alter table public.photo_interpretations enable row level security;
alter table public.repair_bundles enable row level security;
alter table public.verification_questions enable row level security;
alter table public.review_events enable row level security;
alter table public.workflow_events enable row level security;
alter table public.contractor_inputs enable row level security;
alter table public.contractor_scope_packets enable row level security;
alter table public.agent_reports enable row level security;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.phase1_current_app_role() to authenticated;
grant execute on function private.phase1_is_admin() to authenticated;
grant execute on function private.phase1_user_has_property_access(uuid) to authenticated;
grant execute on function private.phase1_review_inspection_finding_impl(uuid, text, jsonb, text) to authenticated;
grant execute on function private.phase1_review_repair_bundle_impl(uuid, text, jsonb, text) to authenticated;
grant execute on function private.phase1_create_contractor_scope_packet_impl(uuid, text) to authenticated;
grant execute on function private.phase1_create_agent_report_impl(uuid, uuid[], jsonb, text) to authenticated;

revoke all on function public.phase1_review_inspection_finding(uuid, text, jsonb, text) from public;
revoke all on function public.phase1_review_repair_bundle(uuid, text, jsonb, text) from public;
revoke all on function public.phase1_create_contractor_scope_packet(uuid, text) from public;
revoke all on function public.phase1_create_agent_report(uuid, uuid[], jsonb, text) from public;
grant execute on function public.phase1_review_inspection_finding(uuid, text, jsonb, text) to authenticated;
grant execute on function public.phase1_review_repair_bundle(uuid, text, jsonb, text) to authenticated;
grant execute on function public.phase1_create_contractor_scope_packet(uuid, text) to authenticated;
grant execute on function public.phase1_create_agent_report(uuid, uuid[], jsonb, text) to authenticated;

revoke all on table
  public.profiles,
  public.properties,
  public.property_access,
  public.work_requests,
  public.model_runs,
  public.inspection_pipeline_runs,
  public.inspection_reports,
  public.inspection_report_pages,
  public.evidence_items,
  public.inspection_findings,
  public.inspection_images,
  public.photo_interpretations,
  public.repair_bundles,
  public.verification_questions,
  public.review_events,
  public.workflow_events,
  public.contractor_inputs,
  public.contractor_scope_packets,
  public.agent_reports
from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, email, full_name, company_name, phone) on public.profiles to authenticated;
grant update (email, full_name, company_name, phone, updated_at) on public.profiles to authenticated;

grant select, insert, update on public.properties to authenticated;
grant select on public.property_access to authenticated;
grant select, insert, update on public.work_requests to authenticated;

grant select on table
  public.model_runs,
  public.inspection_pipeline_runs,
  public.inspection_reports,
  public.inspection_report_pages,
  public.evidence_items,
  public.inspection_findings,
  public.inspection_images,
  public.photo_interpretations,
  public.repair_bundles,
  public.verification_questions,
  public.review_events,
  public.workflow_events,
  public.contractor_inputs,
  public.contractor_scope_packets,
  public.agent_reports
to authenticated;

create policy phase1_profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or private.phase1_is_admin());

create policy phase1_profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy phase1_profiles_update_own_non_role_fields
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy phase1_properties_select_accessible
on public.properties
for select
to authenticated
using (private.phase1_user_has_property_access(id));

create policy phase1_properties_insert_authenticated
on public.properties
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  or private.phase1_is_admin()
);

create policy phase1_properties_update_accessible_manager
on public.properties
for update
to authenticated
using (
  private.phase1_is_admin()
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.property_access pa
    where pa.property_id = properties.id
      and pa.user_id = (select auth.uid())
      and pa.revoked_at is null
      and pa.access_level = 'manage'
  )
)
with check (
  private.phase1_is_admin()
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.property_access pa
    where pa.property_id = properties.id
      and pa.user_id = (select auth.uid())
      and pa.revoked_at is null
      and pa.access_level = 'manage'
  )
);

create policy phase1_property_access_select_related
on public.property_access
for select
to authenticated
using (
  private.phase1_is_admin()
  or user_id = (select auth.uid())
  or private.phase1_user_has_property_access(property_id)
);

create policy phase1_work_requests_select_accessible
on public.work_requests
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_work_requests_insert_accessible
on public.work_requests
for insert
to authenticated
with check (
  private.phase1_user_has_property_access(property_id)
  and (created_by = (select auth.uid()) or private.phase1_is_admin())
);

create policy phase1_work_requests_update_accessible_manager
on public.work_requests
for update
to authenticated
using (
  private.phase1_is_admin()
  or exists (
    select 1
    from public.property_access pa
    where pa.property_id = work_requests.property_id
      and pa.user_id = (select auth.uid())
      and pa.revoked_at is null
      and pa.access_level in ('review', 'manage')
  )
)
with check (
  private.phase1_is_admin()
  or exists (
    select 1
    from public.property_access pa
    where pa.property_id = work_requests.property_id
      and pa.user_id = (select auth.uid())
      and pa.revoked_at is null
      and pa.access_level in ('review', 'manage')
  )
);

create policy phase1_model_runs_select_accessible
on public.model_runs
for select
to authenticated
using (private.phase1_is_admin() or private.phase1_user_has_property_access(property_id));

create policy phase1_pipeline_runs_select_accessible
on public.inspection_pipeline_runs
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_inspection_reports_select_accessible
on public.inspection_reports
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_report_pages_select_accessible
on public.inspection_report_pages
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_evidence_items_select_accessible
on public.evidence_items
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_inspection_findings_select_accessible
on public.inspection_findings
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_inspection_images_select_accessible
on public.inspection_images
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_photo_interpretations_select_accessible
on public.photo_interpretations
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_repair_bundles_select_accessible
on public.repair_bundles
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_verification_questions_select_accessible
on public.verification_questions
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_review_events_select_accessible
on public.review_events
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_workflow_events_select_accessible
on public.workflow_events
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_contractor_inputs_select_accessible
on public.contractor_inputs
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_contractor_scope_packets_select_accessible
on public.contractor_scope_packets
for select
to authenticated
using (private.phase1_user_has_property_access(property_id));

create policy phase1_agent_reports_select_accessible
on public.agent_reports
for select
to authenticated
using (
  private.phase1_is_admin()
  or (
    private.phase1_user_has_property_access(property_id)
    and report_status in ('human_reviewed', 'seller_ready', 'finalized')
  )
);

commit;

/*
Down migration for manual rollback review only. Do not apply if any later
migration or production data depends on these tables.

begin;

drop policy if exists phase1_agent_reports_select_accessible on public.agent_reports;
drop policy if exists phase1_contractor_scope_packets_select_accessible on public.contractor_scope_packets;
drop policy if exists phase1_contractor_inputs_select_accessible on public.contractor_inputs;
drop policy if exists phase1_workflow_events_select_accessible on public.workflow_events;
drop policy if exists phase1_review_events_select_accessible on public.review_events;
drop policy if exists phase1_verification_questions_select_accessible on public.verification_questions;
drop policy if exists phase1_repair_bundles_select_accessible on public.repair_bundles;
drop policy if exists phase1_photo_interpretations_select_accessible on public.photo_interpretations;
drop policy if exists phase1_inspection_images_select_accessible on public.inspection_images;
drop policy if exists phase1_inspection_findings_select_accessible on public.inspection_findings;
drop policy if exists phase1_evidence_items_select_accessible on public.evidence_items;
drop policy if exists phase1_report_pages_select_accessible on public.inspection_report_pages;
drop policy if exists phase1_inspection_reports_select_accessible on public.inspection_reports;
drop policy if exists phase1_pipeline_runs_select_accessible on public.inspection_pipeline_runs;
drop policy if exists phase1_model_runs_select_accessible on public.model_runs;
drop policy if exists phase1_work_requests_update_accessible_manager on public.work_requests;
drop policy if exists phase1_work_requests_insert_accessible on public.work_requests;
drop policy if exists phase1_work_requests_select_accessible on public.work_requests;
drop policy if exists phase1_property_access_select_related on public.property_access;
drop policy if exists phase1_properties_update_accessible_manager on public.properties;
drop policy if exists phase1_properties_insert_authenticated on public.properties;
drop policy if exists phase1_properties_select_accessible on public.properties;
drop policy if exists phase1_profiles_update_own_non_role_fields on public.profiles;
drop policy if exists phase1_profiles_insert_own on public.profiles;
drop policy if exists phase1_profiles_select_own_or_admin on public.profiles;

drop function if exists public.phase1_create_agent_report(uuid, uuid[], jsonb, text);
drop function if exists public.phase1_create_contractor_scope_packet(uuid, text);
drop function if exists public.phase1_review_repair_bundle(uuid, text, jsonb, text);
drop function if exists public.phase1_review_inspection_finding(uuid, text, jsonb, text);
drop function if exists private.phase1_create_agent_report_impl(uuid, uuid[], jsonb, text);
drop function if exists private.phase1_create_contractor_scope_packet_impl(uuid, text);
drop function if exists private.phase1_review_repair_bundle_impl(uuid, text, jsonb, text);
drop function if exists private.phase1_review_inspection_finding_impl(uuid, text, jsonb, text);

drop trigger if exists phase1_touch_agent_reports_updated_at on public.agent_reports;
drop trigger if exists phase1_touch_contractor_scope_packets_updated_at on public.contractor_scope_packets;
drop trigger if exists phase1_block_workflow_events_delete on public.workflow_events;
drop trigger if exists phase1_block_workflow_events_update on public.workflow_events;
drop trigger if exists phase1_block_review_events_delete on public.review_events;
drop trigger if exists phase1_block_review_events_update on public.review_events;
drop trigger if exists phase1_touch_verification_questions_updated_at on public.verification_questions;
drop trigger if exists phase1_touch_repair_bundles_updated_at on public.repair_bundles;
drop trigger if exists phase1_touch_inspection_findings_updated_at on public.inspection_findings;
drop trigger if exists phase1_touch_inspection_reports_updated_at on public.inspection_reports;
drop trigger if exists phase1_touch_pipeline_runs_updated_at on public.inspection_pipeline_runs;
drop trigger if exists phase1_touch_work_requests_updated_at on public.work_requests;
drop trigger if exists phase1_touch_properties_updated_at on public.properties;

alter table if exists public.leads drop constraint if exists phase1_leads_property_id_fkey;
drop index if exists public.phase1_leads_property_id_idx;
alter table if exists public.leads drop column if exists property_id;

drop table if exists public.agent_reports;
drop table if exists public.contractor_scope_packets;
drop table if exists public.contractor_inputs;
drop table if exists public.workflow_events;
drop table if exists public.review_events;
drop table if exists public.verification_questions;
drop table if exists public.repair_bundles;
drop table if exists public.photo_interpretations;
drop table if exists public.inspection_images;
drop table if exists public.inspection_findings;
drop table if exists public.evidence_items;
drop table if exists public.inspection_report_pages;
drop table if exists public.inspection_reports;
drop table if exists public.inspection_pipeline_runs;
drop table if exists public.model_runs;
drop table if exists public.work_requests;
drop table if exists public.property_access;
drop table if exists public.properties;
drop table if exists public.profiles;

drop function if exists private.phase1_user_has_property_access(uuid);
drop function if exists private.phase1_is_admin();
drop function if exists private.phase1_current_app_role();
drop function if exists public.phase1_prevent_mutation();
drop function if exists public.phase1_touch_updated_at();

commit;
*/
