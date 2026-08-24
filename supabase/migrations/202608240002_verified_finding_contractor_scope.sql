-- A verified finding may produce a draft; only a separate atomic human review
-- may make that draft Contractor Ready.
begin;

alter table public.contractor_scope_packets
  add column if not exists lead_id uuid null references public.leads(id) on delete cascade,
  add column if not exists source_finding_id text null,
  add column if not exists source_review_event_id uuid null references public.review_events(id) on delete restrict,
  add column if not exists source_evidence_ids jsonb null,
  add column if not exists source_references jsonb null,
  add column if not exists title text null,
  add column if not exists repair_objective text null,
  add column if not exists trade_category text null,
  add column if not exists known_conditions text[] null,
  add column if not exists reviewed_interpretation text null,
  add column if not exists unknown_conditions text[] null,
  add column if not exists field_verification_items text[] null,
  add column if not exists missing_information text[] null,
  add column if not exists access_setup_notes text[] null,
  add column if not exists sequencing_dependencies text[] null,
  add column if not exists cleanup_disposal_expectations text[] null,
  add column if not exists exclusions text[] null,
  add column if not exists scope_status text null,
  add column if not exists generation_provenance jsonb null,
  add column if not exists created_by uuid null,
  add column if not exists reviewed_by uuid null,
  add column if not exists reviewed_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.contractor_scope_packets'::regclass
      and conname='contractor_scope_packets_scope_status_check'
  ) then
    alter table public.contractor_scope_packets
      add constraint contractor_scope_packets_scope_status_check
      check (scope_status is null or scope_status in ('needs_review','contractor_ready','rejected'));
  end if;
end
$$;

create unique index if not exists contractor_scope_packets_lead_finding_uidx
  on public.contractor_scope_packets(lead_id,source_finding_id)
  where lead_id is not null and source_finding_id is not null;

create or replace function public.prepare_contractor_scope(
  p_lead_id uuid,
  p_expected_property_id bigint,
  p_source_finding_id text,
  p_draft jsonb
)
returns setof public.contractor_scope_packets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_property_id bigint;
  v_property_facts jsonb;
  v_inspection jsonb;
  v_finding jsonb;
  v_finding_count integer;
  v_source_review public.review_events%rowtype;
  v_evidence_ids jsonb;
  v_source_references jsonb;
  v_missing text[];
  v_unknown text[];
  v_field_verify text[];
  v_access text[];
  v_sequence text[];
  v_cleanup text[];
  v_exclusions text[];
  v_scope public.contractor_scope_packets%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode='28000',message='Authentication is required to prepare contractor scope.';
  end if;
  if not public.is_admin_or_owner() then
    raise exception using errcode='42501',message='Admin or owner access is required to prepare contractor scope.';
  end if;
  if coalesce(p_source_finding_id,'')='' or p_draft is null or jsonb_typeof(p_draft)<>'object' then
    raise exception using errcode='22023',message='A source finding and complete contractor scope draft are required.';
  end if;

  select l.property_id,coalesce(l.property_facts,'{}'::jsonb)
    into v_property_id,v_property_facts
    from public.leads l where l.id=p_lead_id for update;
  if not found then raise exception using errcode='P0002',message='Target lead was not found.'; end if;
  if v_property_id is null or p_expected_property_id is distinct from v_property_id then
    raise exception using errcode='23514',message='Submitted property does not match the locked target lead.';
  end if;

  v_inspection:=coalesce(v_property_facts->'inspectionIntelligence','{}'::jsonb);
  select count(*),(jsonb_agg(value)->0) into v_finding_count,v_finding
    from jsonb_array_elements(coalesce(v_inspection->'repairItems','[]'::jsonb)) item(value)
    where value->>'id'=p_source_finding_id;
  if v_finding_count<>1 then
    raise exception using errcode='23514',message='Source finding must occur exactly once in the locked inspection state.';
  end if;
  if coalesce(v_finding->>'status','') not in ('approved','human_verified') then
    raise exception using errcode='23514',message='Only a human-verified inspection finding can produce contractor scope.';
  end if;
  if not (v_finding?'source_text') or v_finding->'source_text'='null'::jsonb
    or nullif(trim(v_finding->>'source_text'),'') is null then
    raise exception using errcode='23514',message='Verified finding source_text is required for contractor scope.';
  end if;

  select e.* into v_source_review
    from public.review_events e
    where e.property_id=v_property_id
      and e.target_table='leads'
      and e.target_id=p_lead_id
      and e.review_type='human_review'
      and e.decision='approved'
      and e.payload->>'object_type'='inspection_finding'
      and e.payload->>'object_id'=p_source_finding_id
      and e.payload->'next_value'=v_finding
    order by e.created_at desc,e.id desc
    limit 1;
  if not found then
    raise exception using errcode='23514',message='The current finding has no matching authoritative approval event.';
  end if;
  v_evidence_ids:=coalesce(v_source_review.payload->'evidence_ids','[]'::jsonb);
  v_source_references:=coalesce(v_source_review.payload->'source_references','[]'::jsonb);
  if jsonb_typeof(v_evidence_ids)<>'array' or jsonb_typeof(v_source_references)<>'array'
    or jsonb_array_length(v_evidence_ids)+jsonb_array_length(v_source_references)=0 then
    raise exception using errcode='23514',message='The approved finding is missing required evidence/source provenance.';
  end if;

  if nullif(trim(p_draft->>'title'),'') is null or nullif(trim(p_draft->>'repair_objective'),'') is null then
    raise exception using errcode='23514',message='Scope title and repair objective are required.';
  end if;
  if jsonb_typeof(coalesce(p_draft->'unknown_conditions','null'::jsonb))<>'array'
    or jsonb_array_length(p_draft->'unknown_conditions')=0
    or jsonb_typeof(coalesce(p_draft->'field_verification_items','null'::jsonb))<>'array'
    or jsonb_array_length(p_draft->'field_verification_items')=0 then
    raise exception using errcode='23514',message='Unknown conditions and field verification must remain explicit.';
  end if;

  select coalesce(array_agg(value),array[]::text[]) into v_unknown from jsonb_array_elements_text(p_draft->'unknown_conditions') item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_field_verify from jsonb_array_elements_text(p_draft->'field_verification_items') item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_missing from jsonb_array_elements_text(coalesce(p_draft->'missing_information','[]'::jsonb)) item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_access from jsonb_array_elements_text(coalesce(p_draft->'access_setup_notes','[]'::jsonb)) item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_sequence from jsonb_array_elements_text(coalesce(p_draft->'sequencing_dependencies','[]'::jsonb)) item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_cleanup from jsonb_array_elements_text(coalesce(p_draft->'cleanup_disposal_expectations','[]'::jsonb)) item(value);
  select coalesce(array_agg(value),array[]::text[]) into v_exclusions from jsonb_array_elements_text(coalesce(p_draft->'exclusions','[]'::jsonb)) item(value);

  insert into public.contractor_scope_packets(
    property_id,lead_id,source_finding_id,source_review_event_id,source_evidence_ids,source_references,
    title,repair_objective,trade_category,known_conditions,reviewed_interpretation,
    unknown_conditions,field_verification_items,missing_information,access_setup_notes,
    sequencing_dependencies,cleanup_disposal_expectations,exclusions,scope_status,
    generation_provenance,created_by,trade,scope_summary,missing_information_questions,status
  ) values (
    v_property_id,p_lead_id,p_source_finding_id,v_source_review.id,v_evidence_ids,v_source_references,
    trim(p_draft->>'title'),trim(p_draft->>'repair_objective'),coalesce(nullif(trim(v_finding->>'trade'),''),nullif(trim(v_finding->>'category'),''),'Needs trade review'),
    array[v_finding->>'source_text'],coalesce(nullif(trim(v_finding->>'description'),''),'Reviewed finding; operational interpretation was not supplied.'),
    v_unknown,v_field_verify,v_missing,v_access,v_sequence,v_cleanup,v_exclusions,'needs_review',
    jsonb_build_object('generator','verified_finding_scope_v1','source_object_type','inspection_finding',
      'source_finding_id',p_source_finding_id,'source_review_event_id',v_source_review.id,
      'source_evidence_ids',v_evidence_ids,'source_references',v_source_references),
    v_actor_id,coalesce(nullif(trim(v_finding->>'trade'),''),nullif(trim(v_finding->>'category'),''),'Needs trade review'),
    trim(p_draft->>'repair_objective'),v_missing,'needs_review'
  ) returning * into v_scope;

  return next v_scope;
end;
$$;

create or replace function public.apply_contractor_scope_review(
  p_scope_id uuid,
  p_previous_scope jsonb,
  p_next_scope jsonb,
  p_review_action text
)
returns table(review_event_id uuid,scope jsonb,reviewer_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_scope public.contractor_scope_packets%rowtype;
  v_previous jsonb;
  v_current_finding jsonb;
  v_finding_count integer;
  v_property_facts jsonb;
  v_source_review public.review_events%rowtype;
  v_work_request_id uuid;
  v_work_request_count integer;
  v_repair_item_id uuid;
  v_repair_item_count integer;
  v_next_status text;
  v_decision text;
  v_event_id uuid;
  v_next jsonb;
  v_allowed_keys constant text[]:=array[
    'title','repair_objective','trade_category','reviewed_interpretation','unknown_conditions',
    'field_verification_items','missing_information','access_setup_notes','sequencing_dependencies',
    'cleanup_disposal_expectations','exclusions','admin_notes'
  ];
begin
  if v_actor_id is null then raise exception using errcode='28000',message='Authentication is required to review contractor scope.'; end if;
  if not public.is_admin_or_owner() then raise exception using errcode='42501',message='Admin or owner access is required to review contractor scope.'; end if;
  if p_review_action is null or p_review_action<>all(array['approve','reject','return_for_correction']) then
    raise exception using errcode='22023',message='Unsupported contractor scope review action.';
  end if;
  if p_previous_scope is null or p_next_scope is null or jsonb_typeof(p_next_scope)<>'object' then
    raise exception using errcode='22023',message='Complete contractor scope review snapshots are required.';
  end if;

  select s.* into v_scope from public.contractor_scope_packets s where s.id=p_scope_id for update;
  if not found then raise exception using errcode='P0002',message='Contractor scope was not found.'; end if;
  v_previous:=to_jsonb(v_scope);
  if v_previous is distinct from p_previous_scope then
    raise exception using errcode='40001',message='Contractor scope review is stale; reload the latest saved state.';
  end if;
  if v_scope.scope_status is distinct from 'needs_review' then
    raise exception using errcode='23514',message='Only a scope needing review may transition.';
  end if;
  if (v_previous-v_allowed_keys) is distinct from (p_next_scope-v_allowed_keys) then
    raise exception using errcode='23514',message='Contractor scope provenance or server-managed state cannot be changed by the client.';
  end if;

  select coalesce(l.property_facts,'{}'::jsonb) into v_property_facts
    from public.leads l where l.id=v_scope.lead_id and l.property_id=v_scope.property_id for update;
  if not found then raise exception using errcode='23514',message='Contractor scope source lead/property linkage is invalid.'; end if;
  select count(*),(jsonb_agg(value)->0) into v_finding_count,v_current_finding
    from jsonb_array_elements(coalesce(v_property_facts->'inspectionIntelligence'->'repairItems','[]'::jsonb)) item(value)
    where value->>'id'=v_scope.source_finding_id;
  if v_finding_count<>1 or coalesce(v_current_finding->>'status','') not in ('approved','human_verified') then
    raise exception using errcode='23514',message='Source finding is missing, ambiguous, or no longer human verified.';
  end if;
  select e.* into v_source_review from public.review_events e where e.id=v_scope.source_review_event_id;
  if not found or v_source_review.property_id is distinct from v_scope.property_id
    or v_source_review.target_table is distinct from 'leads' or v_source_review.target_id is distinct from v_scope.lead_id
    or v_source_review.review_type is distinct from 'human_review' or v_source_review.decision is distinct from 'approved'
    or v_source_review.payload->>'object_type' is distinct from 'inspection_finding'
    or v_source_review.payload->>'object_id' is distinct from v_scope.source_finding_id
    or v_source_review.payload->'next_value' is distinct from v_current_finding
    or v_source_review.payload->'evidence_ids' is distinct from v_scope.source_evidence_ids
    or v_source_review.payload->'source_references' is distinct from v_scope.source_references then
    raise exception using errcode='23514',message='Contractor scope source review provenance is stale or invalid.';
  end if;

  if nullif(trim(p_next_scope->>'title'),'') is null or nullif(trim(p_next_scope->>'repair_objective'),'') is null
    or jsonb_typeof(coalesce(p_next_scope->'unknown_conditions','null'::jsonb))<>'array'
    or jsonb_array_length(p_next_scope->'unknown_conditions')=0
    or jsonb_typeof(coalesce(p_next_scope->'field_verification_items','null'::jsonb))<>'array'
    or jsonb_array_length(p_next_scope->'field_verification_items')=0 then
    raise exception using errcode='23514',message='Approved scope must retain its objective, unknowns, and field verification.';
  end if;

  v_next_status:=case when p_review_action='approve' then 'contractor_ready'
    when p_review_action='reject' then 'rejected' else 'needs_review' end;
  v_decision:=case when p_review_action='approve' then 'approved'
    when p_review_action='reject' then 'rejected' else 'needs_more_info' end;

  update public.contractor_scope_packets set
    title=trim(p_next_scope->>'title'),repair_objective=trim(p_next_scope->>'repair_objective'),
    trade_category=trim(p_next_scope->>'trade_category'),reviewed_interpretation=trim(p_next_scope->>'reviewed_interpretation'),
    unknown_conditions=array(select jsonb_array_elements_text(p_next_scope->'unknown_conditions')),
    field_verification_items=array(select jsonb_array_elements_text(p_next_scope->'field_verification_items')),
    missing_information=array(select jsonb_array_elements_text(coalesce(p_next_scope->'missing_information','[]'::jsonb))),
    access_setup_notes=array(select jsonb_array_elements_text(coalesce(p_next_scope->'access_setup_notes','[]'::jsonb))),
    sequencing_dependencies=array(select jsonb_array_elements_text(coalesce(p_next_scope->'sequencing_dependencies','[]'::jsonb))),
    cleanup_disposal_expectations=array(select jsonb_array_elements_text(coalesce(p_next_scope->'cleanup_disposal_expectations','[]'::jsonb))),
    exclusions=array(select jsonb_array_elements_text(coalesce(p_next_scope->'exclusions','[]'::jsonb))),
    admin_notes=nullif(trim(p_next_scope->>'admin_notes'),''),scope_status=v_next_status,
    status=case when v_next_status='contractor_ready' then 'approved' when v_next_status='rejected' then 'rejected' else 'needs_review' end,
    scope_summary=trim(p_next_scope->>'repair_objective'),trade=trim(p_next_scope->>'trade_category'),
    missing_information_questions=array(select jsonb_array_elements_text(coalesce(p_next_scope->'missing_information','[]'::jsonb))),
    reviewed_by=v_actor_id,reviewed_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=p_scope_id returning * into v_scope;
  if not found then raise exception using errcode='P0002',message='Contractor scope disappeared during review.'; end if;
  v_next:=to_jsonb(v_scope);

  select count(*),(array_agg(wr.id))[1] into v_work_request_count,v_work_request_id
    from public.work_requests wr where wr.lead_id=v_scope.lead_id and wr.property_id=v_scope.property_id;
  if v_work_request_count<>1 then v_work_request_id:=null; end if;
  select count(*),(array_agg(ri.id))[1] into v_repair_item_count,v_repair_item_id
    from public.repair_items ri where ri.id::text=v_scope.source_finding_id and ri.property_id=v_scope.property_id;
  if v_repair_item_count<>1 then v_repair_item_id:=null; end if;

  insert into public.review_events(property_id,work_request_id,repair_item_id,target_table,target_id,review_type,
    decision,action,reviewer_id,previous_status,next_status,notes,payload)
  values(v_scope.property_id,v_work_request_id,v_repair_item_id,'contractor_scope_packets',v_scope.id,
    'contractor_scope_review',v_decision,p_review_action,v_actor_id,v_previous->>'scope_status',v_next_status,
    v_scope.admin_notes,jsonb_build_object('previous_value',v_previous,'next_value',v_next,
      'evidence_ids',v_scope.source_evidence_ids,'source_references',v_scope.source_references,
      'review_action',p_review_action,'object_type','contractor_scope','object_id',v_scope.id,
      'source_finding_id',v_scope.source_finding_id,'source_review_event_id',v_scope.source_review_event_id))
    returning id into v_event_id;

  return query select v_event_id,v_next,v_actor_id;
end;
$$;

revoke all on function public.prepare_contractor_scope(uuid,bigint,text,jsonb) from public,anon;
revoke all on function public.apply_contractor_scope_review(uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.prepare_contractor_scope(uuid,bigint,text,jsonb) to authenticated;
grant execute on function public.apply_contractor_scope_review(uuid,jsonb,jsonb,text) to authenticated;

-- Draft creation and consequential status changes must cross the RPC boundary.
drop policy if exists "contractor_scope_packets admin manage" on public.contractor_scope_packets;
revoke insert,update,delete on table public.contractor_scope_packets from anon,authenticated;

commit;
