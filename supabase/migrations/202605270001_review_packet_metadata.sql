-- Review Packet Size + Fast Human Review Doctrine
-- Store full evidence, but persist lightweight reviewer-facing packets.
-- Keeps RLS enabled and preserves existing admin/owner manage + estimator read policies.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'property_media_analysis',
    'property_media_findings',
    'scope_interpretations',
    'agent_research_tasks',
    'evidence_items',
    'inspection_reports',
    'inspection_findings',
    'repair_bundles',
    'repair_items'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists review_lane text', table_name);
      execute format('alter table public.%I add column if not exists review_status text', table_name);
      execute format('alter table public.%I add column if not exists target_review_time_seconds integer', table_name);
      execute format('alter table public.%I add column if not exists review_started_at timestamptz', table_name);
      execute format('alter table public.%I add column if not exists review_due_at timestamptz', table_name);
      execute format('alter table public.%I add column if not exists reviewed_at timestamptz', table_name);
      execute format('alter table public.%I add column if not exists reviewed_by text', table_name);
      execute format('alter table public.%I add column if not exists packet_size_bytes integer', table_name);
      execute format('alter table public.%I add column if not exists packet_warning text', table_name);
      execute format('alter table public.%I add column if not exists packet_version text not null default ''review-packet-v1''', table_name);
      execute format('alter table public.%I add column if not exists source_reference_count integer not null default 0', table_name);
      execute format('alter table public.%I add column if not exists compact_review_packet jsonb not null default ''{}''::jsonb', table_name);
      execute format('alter table public.%I add column if not exists full_source_refs jsonb not null default ''[]''::jsonb', table_name);
      execute format('alter table public.%I add column if not exists confidence text', table_name);
      execute format('alter table public.%I add column if not exists extended_review_message text', table_name);

      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_review_lane_check');
      execute format(
        'alter table public.%I add constraint %I check (review_lane is null or review_lane in (''standard'', ''deep'', ''extended''))',
        table_name,
        table_name || '_review_lane_check'
      );

      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_fast_review_status_check');
      execute format(
        'alter table public.%I add constraint %I check (review_status is null or review_status in (''ai_draft'', ''needs_review'', ''in_review'', ''needs_more_info'', ''research_requested'', ''research_drafted'', ''answered'', ''queued'', ''researching'', ''human_reviewed'', ''approved'', ''human_verified'', ''rejected'', ''deprecated''))',
        table_name,
        table_name || '_fast_review_status_check'
      );

      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_review_confidence_check');
      execute format(
        'alter table public.%I add constraint %I check (confidence is null or confidence in (''low'', ''medium'', ''high'')) not valid',
        table_name,
        table_name || '_review_confidence_check'
      );

      execute format('create index if not exists %I on public.%I(review_lane)', table_name || '_review_lane_idx', table_name);
      execute format('create index if not exists %I on public.%I(review_status)', table_name || '_fast_review_status_idx', table_name);
      execute format('alter table public.%I enable row level security', table_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.property_media_findings') is not null then
    alter table public.property_media_findings
      drop constraint if exists property_media_findings_review_status_check;

    alter table public.property_media_findings
      add constraint property_media_findings_review_status_check
      check (review_status in (
        'ai_draft',
        'needs_review',
        'in_review',
        'needs_more_info',
        'research_requested',
        'research_drafted',
        'approved',
        'rejected',
        'human_verified',
        'deprecated'
      ));
  end if;

  if to_regclass('public.property_media_analysis') is not null then
    alter table public.property_media_analysis
      drop constraint if exists property_media_analysis_review_status_check;

    alter table public.property_media_analysis
      add constraint property_media_analysis_review_status_check
      check (review_status in (
        'ai_draft',
        'needs_review',
        'in_review',
        'needs_more_info',
        'research_requested',
        'human_reviewed',
        'approved',
        'rejected',
        'human_verified',
        'deprecated'
      ));
  end if;
end $$;
