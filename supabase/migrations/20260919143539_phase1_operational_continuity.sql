-- Durable Phase 1 submission, review-resume, and release continuity.
-- The pipeline row remains server-owned. Browser roles retain SELECT-only access.

begin;

alter table public.inspection_pipeline_runs
  add column if not exists submitter_name text,
  add column if not exists submitter_email text,
  add column if not exists delivery_recipient_name text,
  add column if not exists delivery_recipient_email text,
  add column if not exists delivery_recipient_source text not null default 'submitter_default',
  add column if not exists submitted_at timestamptz,
  add column if not exists workflow_state text not null default 'submitted',
  add column if not exists next_responsible_role text not null default 'system',
  add column if not exists next_action text not null default 'Process submitted evidence',
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists last_viewed_observation_id text,
  add column if not exists released_artifact_version text,
  add column if not exists released_at timestamptz;

update public.inspection_pipeline_runs
set
  workflow_state = case status
    when 'queued' then 'submitted'
    when 'running' then 'processing'
    when 'needs_review' then 'under_review'
    when 'completed' then 'released'
    when 'failed' then 'failed'
    else workflow_state
  end,
  next_responsible_role = case status
    when 'needs_review' then 'reviewer'
    when 'completed' then 'submitter'
    when 'failed' then 'reviewer'
    else 'system'
  end,
  next_action = case status
    when 'needs_review' then 'Review remaining findings'
    when 'completed' then 'View reviewed result'
    when 'failed' then 'Review processing failure'
    else next_action
  end,
  submitted_at = coalesce(submitted_at, created_at),
  last_activity_at = coalesce(updated_at, created_at, now())
where workflow_state is not null;

alter table public.inspection_pipeline_runs
  drop constraint if exists phase1_pipeline_runs_current_stage_check,
  drop constraint if exists phase1_pipeline_runs_status_check,
  drop constraint if exists phase1_pipeline_runs_recipient_source_check,
  drop constraint if exists phase1_pipeline_runs_workflow_state_check,
  drop constraint if exists phase1_pipeline_runs_next_role_check;

alter table public.inspection_pipeline_runs
  add constraint phase1_pipeline_runs_current_stage_check
    check (current_stage in (
      'submission_review',
      'document_extraction',
      'image_extraction',
      'evidence_linking',
      'inspection_interpretation',
      'repair_bundling',
      'verification_questions',
      'human_review',
      'contractor_scope_draft',
      'agent_review_output',
      'released_result'
    )),
  add constraint phase1_pipeline_runs_status_check
    check (status in ('draft', 'queued', 'running', 'failed', 'draft_created', 'needs_review', 'completed', 'superseded', 'archived')),
  add constraint phase1_pipeline_runs_recipient_source_check
    check (delivery_recipient_source in ('submitter_default', 'manually_changed')),
  add constraint phase1_pipeline_runs_workflow_state_check
    check (workflow_state in ('draft', 'submitted', 'processing', 'under_review', 'needs_information', 'released', 'failed')),
  add constraint phase1_pipeline_runs_next_role_check
    check (next_responsible_role in ('submitter', 'reviewer', 'contractor', 'system'));

create index if not exists phase1_pipeline_runs_requested_by_activity_idx
  on public.inspection_pipeline_runs(requested_by, last_activity_at desc);

create index if not exists phase1_pipeline_runs_workflow_activity_idx
  on public.inspection_pipeline_runs(workflow_state, last_activity_at desc);

commit;

-- Manual rollback intentionally requires resolving any draft or released-result rows first.
-- drop index if exists public.phase1_pipeline_runs_workflow_activity_idx;
-- drop index if exists public.phase1_pipeline_runs_requested_by_activity_idx;
-- alter table public.inspection_pipeline_runs drop column if exists released_at;
-- alter table public.inspection_pipeline_runs drop column if exists released_artifact_version;
-- alter table public.inspection_pipeline_runs drop column if exists last_viewed_observation_id;
-- alter table public.inspection_pipeline_runs drop column if exists last_activity_at;
-- alter table public.inspection_pipeline_runs drop column if exists next_action;
-- alter table public.inspection_pipeline_runs drop column if exists next_responsible_role;
-- alter table public.inspection_pipeline_runs drop column if exists workflow_state;
-- alter table public.inspection_pipeline_runs drop column if exists submitted_at;
-- alter table public.inspection_pipeline_runs drop column if exists delivery_recipient_source;
-- alter table public.inspection_pipeline_runs drop column if exists delivery_recipient_email;
-- alter table public.inspection_pipeline_runs drop column if exists delivery_recipient_name;
-- alter table public.inspection_pipeline_runs drop column if exists submitter_email;
-- alter table public.inspection_pipeline_runs drop column if exists submitter_name;
