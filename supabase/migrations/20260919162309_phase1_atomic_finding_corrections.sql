-- Persist reviewed finding corrections and their audit event atomically.

begin;

alter table public.inspection_findings
  add column if not exists reviewed_value jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

update public.inspection_findings as finding
set
  reviewed_value = coalesce(event.new_value -> 'corrections', '{}'::jsonb),
  reviewed_by = event.reviewer_id,
  reviewed_at = event.created_at
from public.review_events as event
where finding.review_event_id = event.id
  and finding.reviewed_value = '{}'::jsonb
  and jsonb_typeof(event.new_value -> 'corrections') = 'object';

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
  v_observation jsonb;
  v_draft_value jsonb;
  v_current_value jsonb;
  v_corrections jsonb;
  v_canonical_value jsonb;
  v_changed_fields jsonb := '{}'::jsonb;
  v_event_value jsonb;
  v_event_id uuid;
  v_expected_event_id uuid;
  v_price jsonb;
  v_original_path jsonb;
  v_price_path_id text;
  v_price_version integer;
  v_price_adjustments jsonb;
  v_next_status text;
  v_remaining integer;
  v_waiting_for_evidence boolean;
begin
  if not private.phase1_is_admin() then
    raise exception 'Only an admin or owner can review inspection findings';
  end if;

  if p_review_action not in ('approve', 'edit', 'needs_more_info', 'reject', 'deprecate') then
    raise exception 'Unsupported review action: %', p_review_action;
  end if;

  if p_review_action in ('edit', 'needs_more_info', 'reject')
    and nullif(btrim(p_reason), '') is null then
    raise exception 'A reviewer reason is required for action: %', p_review_action;
  end if;

  select *
  into v_finding
  from public.inspection_findings
  where id = p_finding_id
  for update;

  if not found then
    raise exception 'Inspection finding not found: %', p_finding_id;
  end if;

  select observation
  into v_observation
  from public.model_runs as model_run
  cross join lateral jsonb_array_elements(
    coalesce(
      model_run.output -> 'atomicObservations',
      model_run.output -> 'atomic_observations',
      '[]'::jsonb
    )
  ) as observation
  where model_run.id = v_finding.model_run_id
    and observation ->> 'id' = p_new_value ->> 'observation_id'
  limit 1;

  v_draft_value := jsonb_build_object(
    'title', coalesce(v_observation #>> '{finding_card,finding_title}', v_finding.original_text),
    'interpretation', coalesce(v_observation #> '{epistemic_states,shelter_prep_interpretation}', to_jsonb(v_finding.interpretations)),
    'known', coalesce(v_observation #> '{finding_card,what_we_know}', to_jsonb(v_finding.known_facts)),
    'unknown', coalesce(v_observation #> '{finding_card,what_we_dont_know}', to_jsonb(v_finding.unknowns)),
    'affected_location', coalesce(v_observation #> '{finding_card,affected_location}', '{}'::jsonb),
    'repair_paths', coalesce(v_observation #> '{finding_card,repair_paths}', '[]'::jsonb),
    'next_step', v_observation #> '{finding_card,recommended_next_step}',
    'rationale', v_observation #> '{finding_card,why_next_step}',
    'likely_trade', coalesce(v_observation #> '{finding_card,next_step_owner}', to_jsonb(v_finding.trade_category)),
    'evidence_relationship', coalesce(v_observation #> '{finding_card,reviewed_evidence_relationship}', '""'::jsonb),
    'field_knowledge', '""'::jsonb,
    'price', coalesce(v_observation #> '{finding_card,released_price_correction}', 'null'::jsonb)
  );
  v_current_value := v_draft_value || coalesce(v_finding.reviewed_value, '{}'::jsonb);
  v_canonical_value := v_current_value;

  if p_review_action = 'edit' then
    if not (p_new_value ? 'expected_review_event_id') then
      raise exception 'Edit requires the expected review version';
    end if;
    v_expected_event_id := nullif(p_new_value ->> 'expected_review_event_id', '')::uuid;
    if v_finding.review_event_id is distinct from v_expected_event_id then
      raise exception 'Finding changed after it was loaded; reload before saving';
    end if;

    v_corrections := coalesce(p_new_value -> 'corrections', '{}'::jsonb);
    if jsonb_typeof(v_corrections) <> 'object' or v_corrections = '{}'::jsonb then
      raise exception 'Edit requires at least one correction';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(v_corrections) as correction_key
      where correction_key not in (
        'title', 'interpretation', 'known', 'unknown', 'affected_location', 'repair_paths',
        'next_step', 'rationale', 'likely_trade', 'price',
        'evidence_relationship', 'confirmed_evidence', 'field_knowledge'
      )
    ) then
      raise exception 'Edit contains an unsupported correction field';
    end if;

    if v_corrections ? 'repair_paths' and (
      jsonb_typeof(v_corrections -> 'repair_paths') <> 'array'
      or exists (
        select 1
        from jsonb_array_elements(v_corrections -> 'repair_paths') as submitted_path
        where nullif(btrim(submitted_path ->> 'id'), '') is null
          or nullif(btrim(submitted_path ->> 'label'), '') is null
          or not exists (
            select 1
            from jsonb_array_elements(coalesce(v_observation #> '{finding_card,repair_paths}', '[]'::jsonb)) as original_path
            where original_path ->> 'id' = submitted_path ->> 'id'
          )
      )
      or (
        select count(*)
        from jsonb_array_elements(v_corrections -> 'repair_paths')
      ) <> (
        select count(distinct submitted_path ->> 'id')
        from jsonb_array_elements(v_corrections -> 'repair_paths') as submitted_path
      )
    ) then
      raise exception 'Repair-path corrections are invalid';
    end if;

    if v_corrections ? 'price' then
      v_price := v_corrections -> 'price';
      v_price_path_id := nullif(v_price ->> 'path_id', '');
      if jsonb_typeof(v_price) <> 'object'
        or jsonb_typeof(v_price -> 'low') <> 'number'
        or jsonb_typeof(v_price -> 'high') <> 'number'
        or (v_price ->> 'low')::numeric < 0
        or (v_price ->> 'high')::numeric < (v_price ->> 'low')::numeric
        or v_price ->> 'confidence_status' not in ('broad_preliminary', 'moderate_confidence', 'field_supported')
        or v_price ->> 'source_type' not in ('external_sources', 'reviewer_professional_judgment')
        or nullif(btrim(v_price ->> 'geography'), '') is null
        or jsonb_typeof(v_price -> 'assumptions') <> 'array'
        or jsonb_typeof(v_price -> 'exclusions') <> 'array' then
        raise exception 'Price correction is incomplete';
      end if;

      select repair_path
      into v_original_path
      from jsonb_array_elements(coalesce(v_observation #> '{finding_card,repair_paths}', '[]'::jsonb)) as repair_path
      where repair_path ->> 'id' = v_price_path_id
      limit 1;
      if v_original_path is null then
        raise exception 'Price correction repair path is not available';
      end if;
      if v_price ->> 'source_type' = 'external_sources' and (
        jsonb_typeof(v_price -> 'supporting_source_ids') <> 'array'
        or jsonb_array_length(v_price -> 'supporting_source_ids') = 0
        or jsonb_array_length(v_price -> 'supporting_source_ids') > 3
        or exists (
          select 1
          from jsonb_array_elements_text(v_price -> 'supporting_source_ids') as selected_source(source_id)
          where not coalesce(v_original_path -> 'price_source_refs', '[]'::jsonb) ? selected_source.source_id
        )
      ) then
        raise exception 'Price correction source selection is invalid';
      end if;

      v_price_adjustments := coalesce(v_current_value -> 'price_adjustments', '[]'::jsonb);
      if jsonb_typeof(v_price_adjustments) <> 'array' then
        v_price_adjustments := '[]'::jsonb;
      end if;
      if v_price_adjustments = '[]'::jsonb
        and jsonb_typeof(v_current_value -> 'price') = 'object' then
        v_price_adjustments := jsonb_build_array(v_current_value -> 'price');
      end if;
      select coalesce(max((adjustment ->> 'version')::integer), 0) + 1
      into v_price_version
      from jsonb_array_elements(v_price_adjustments) as adjustment
      where adjustment ->> 'path_id' = v_price_path_id;
      v_price := v_price || jsonb_build_object(
        'version', v_price_version,
        'reviewer_id', (select auth.uid()),
        'reviewed_at', now(),
        'evidence_state', coalesce(nullif(v_price ->> 'evidence_state', ''), 'inspection_report_only'),
        'original_range', jsonb_build_object(
          'low', v_original_path -> 'price_low',
          'high', v_original_path -> 'price_high',
          'unit', v_original_path -> 'price_unit',
          'source_ids', coalesce(v_original_path -> 'price_source_refs', '[]'::jsonb)
        )
      );
      select coalesce(jsonb_agg(adjustment), '[]'::jsonb)
      into v_price_adjustments
      from jsonb_array_elements(v_price_adjustments) as adjustment
      where adjustment ->> 'path_id' is distinct from v_price_path_id;
      v_price_adjustments := v_price_adjustments || jsonb_build_array(v_price);
      v_corrections := jsonb_set(v_corrections, '{price}', v_price, true);
      v_corrections := jsonb_set(v_corrections, '{price_adjustments}', v_price_adjustments, true);
    end if;

    select coalesce(
      jsonb_object_agg(
        changed.key,
        jsonb_build_object('previous', v_current_value -> changed.key, 'new', changed.value)
      ),
      '{}'::jsonb
    )
    into v_changed_fields
    from jsonb_each(v_corrections) as changed
    where v_current_value -> changed.key is distinct from changed.value;

    if v_changed_fields = '{}'::jsonb then
      raise exception 'No correction values changed';
    end if;
    v_canonical_value := v_current_value || v_corrections;
  end if;

  v_next_status := case p_review_action
    when 'approve' then 'human_verified'
    when 'edit' then 'human_reviewed'
    when 'needs_more_info' then 'needs_review'
    when 'reject' then 'rejected'
    when 'deprecate' then 'deprecated'
  end;

  v_event_value := (coalesce(p_new_value, '{}'::jsonb) - 'expected_review_event_id') || jsonb_build_object(
    'corrections', v_canonical_value,
    'changed_fields', v_changed_fields,
    'reviewer_note', p_reason
  );

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
    jsonb_build_object(
      'finding', to_jsonb(v_finding),
      'canonical_value', v_current_value,
      'changed_fields', v_changed_fields
    ),
    v_event_value,
    p_reason,
    v_finding.raw_evidence_ids,
    v_finding.model_run_id
  )
  returning id into v_event_id;

  update public.inspection_findings
  set
    reviewed_value = v_canonical_value,
    reviewed_by = (select auth.uid()),
    reviewed_at = now(),
    review_status = v_next_status,
    review_event_id = v_event_id,
    updated_at = now()
  where id = p_finding_id;

  if not found then
    raise exception 'Corrected finding could not be persisted';
  end if;

  select count(*)
  into v_remaining
  from public.inspection_findings
  where model_run_id = v_finding.model_run_id
    and review_status in ('ai_draft', 'needs_review');

  select exists (
    select 1
    from public.inspection_findings as reviewed_finding
    join public.review_events as review_event
      on review_event.id = reviewed_finding.review_event_id
    where reviewed_finding.model_run_id = v_finding.model_run_id
      and review_event.review_action = 'needs_more_info'
  )
  into v_waiting_for_evidence;

  update public.inspection_pipeline_runs
  set
    workflow_state = case when v_waiting_for_evidence then 'needs_information' else 'under_review' end,
    next_responsible_role = case when v_waiting_for_evidence then 'submitter' else 'reviewer' end,
    next_action = case
      when v_waiting_for_evidence then 'Add requested evidence'
      when v_remaining > 0 then format('Review %s remaining findings', v_remaining)
      else 'Release reviewed result'
    end,
    last_viewed_observation_id = p_new_value ->> 'observation_id',
    last_activity_at = now()
  where id = nullif(p_new_value ->> 'processing_request_id', '')::uuid
    and property_id = v_finding.property_id;

  if not found then
    raise exception 'Review request continuity could not be persisted';
  end if;

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
    jsonb_build_object(
      'review_action', p_review_action,
      'next_status', v_next_status,
      'review_event_id', v_event_id,
      'changed_fields', v_changed_fields
    )
  );

  return v_event_id;
end;
$$;

revoke execute on function private.phase1_review_inspection_finding_impl(uuid, text, jsonb, text) from public, anon;
grant execute on function private.phase1_review_inspection_finding_impl(uuid, text, jsonb, text) to authenticated;

revoke execute on function public.phase1_review_inspection_finding(uuid, text, jsonb, text) from public, anon;
grant execute on function public.phase1_review_inspection_finding(uuid, text, jsonb, text) to authenticated;

commit;

-- Manual rollback requires first deciding how to preserve reviewed corrections.
-- Restoring the prior function body is required before dropping these columns.
-- alter table public.inspection_findings drop column if exists reviewed_at;
-- alter table public.inspection_findings drop column if exists reviewed_by;
-- alter table public.inspection_findings drop column if exists reviewed_value;
