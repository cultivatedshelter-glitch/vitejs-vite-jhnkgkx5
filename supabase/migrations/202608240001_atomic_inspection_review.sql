-- One review call changes one object; audit truth is derived from locked state.
begin;

-- Live review_events predates the canonical linkage/audit payload fields.
-- Add only nullable columns so historical rows are neither rewritten nor backfilled.
alter table public.review_events
  add column if not exists work_request_id uuid null,
  add column if not exists repair_item_id uuid null,
  add column if not exists review_type text null,
  add column if not exists decision text null,
  add column if not exists payload jsonb null;

create or replace function public.apply_inspection_review(
  p_lead_id uuid, p_expected_property_id bigint, p_object_type text, p_object_id text,
  p_previous_value jsonb, p_next_value jsonb, p_next_inspection_intelligence jsonb,
  p_work_request_id uuid default null, p_repair_item_id uuid default null
)
returns table (review_event_id uuid, property_facts jsonb, reviewer_id uuid,
  work_request_id uuid, repair_item_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_property_id bigint; v_property_facts jsonb; v_current jsonb; v_committed jsonb;
  v_previous jsonb; v_next jsonb; v_other_current jsonb; v_other_next jsonb;
  v_work_request_id uuid; v_work_request_count int;
  v_repair_item_id uuid; v_repair_item_count int;
  v_cf int; v_nf int; v_cw int; v_cb int; v_nw int; v_nb int;
  v_cwv jsonb; v_cbv jsonb; v_nwv jsonb; v_nbv jsonb;
  v_previous_status text; v_next_status text; v_previous_notes text; v_next_notes text;
  v_action text; v_decision text; v_payload jsonb; v_evidence_ids jsonb; v_source_references jsonb;
  v_next_property_facts jsonb; v_event_id uuid;
  v_findings_complete boolean; v_bundles_complete boolean; v_complete boolean; v_global_status text;
  v_key text;
  v_provenance_keys constant text[] := array[
    'source_text','evidence_ids','evidenceIds','full_source_refs','evidence_references',
    'source_references','sourceReferences','source_file_id','sourceFileId','source_ids','sourceIds',
    'source_page','sourcePage','page','page_number','pageNumber','page_range','pageRange',
    'inspection_report_id','inspectionReportId','repair_bundle_id','repairBundleId',
    'related_report_items','finding_ids'
  ];
begin
  if v_reviewer_id is null then
    raise exception using errcode='28000', message='Authentication is required to review inspection intelligence.';
  end if;
  if not public.is_admin_or_owner() then
    raise exception using errcode='42501', message='Admin or owner access is required to review inspection intelligence.';
  end if;
  if p_object_type is null or p_object_type <> all(array['inspection_finding','inspection_bundle']) then
    raise exception using errcode='22023', message='Unsupported inspection review object type.';
  end if;
  if coalesce(p_object_id,'')='' then
    raise exception using errcode='22023', message='Inspection review object ID is required.';
  end if;
  if p_previous_value is null or p_next_value is null or p_next_inspection_intelligence is null
    or jsonb_typeof(p_next_inspection_intelligence)<>'object' then
    raise exception using errcode='22023', message='Complete inspection review snapshots are required.';
  end if;

  select l.property_id,coalesce(l.property_facts,'{}'::jsonb)
    into v_property_id,v_property_facts from public.leads l where l.id=p_lead_id for update;
  if not found then raise exception using errcode='P0002',message='Target lead was not found.'; end if;
  if v_property_id is null then raise exception using errcode='23514',message='The target lead must be linked to a property before inspection review.'; end if;
  if p_expected_property_id is distinct from v_property_id then raise exception using errcode='23514',message='Submitted property does not match the target lead.'; end if;
  v_current:=coalesce(v_property_facts->'inspectionIntelligence','{}'::jsonb);

  if p_object_type='inspection_finding' then
    select count(*),(jsonb_agg(value)->0) into v_cf,v_previous
      from jsonb_array_elements(coalesce(v_current->'repairItems','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    select count(*),(jsonb_agg(value)->0) into v_nf,v_next
      from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'repairItems','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    if v_cf<>1 or v_nf<>1 then
      raise exception using errcode='23514',message='Reviewed finding must occur exactly once in current and submitted state.';
    end if;
    if (v_current-'repairItems'-'humanReviewStatus') is distinct from
       (p_next_inspection_intelligence-'repairItems'-'humanReviewStatus') then
      raise exception using errcode='40001',message='Inspection intelligence changed outside the reviewed finding.';
    end if;
    -- Cardinality is already exactly one, so this excludes one validated row, not all same-ID rows.
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_current
      from jsonb_array_elements(coalesce(v_current->'repairItems','[]'::jsonb)) with ordinality item(value,ordinality)
      where value->>'id' is distinct from p_object_id;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_next
      from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'repairItems','[]'::jsonb)) with ordinality item(value,ordinality)
      where value->>'id' is distinct from p_object_id;
    if v_other_current is distinct from v_other_next then raise exception using errcode='40001',message='Other inspection findings changed during review.'; end if;
  else
    select count(*),(jsonb_agg(value)->0) into v_cw,v_cwv from jsonb_array_elements(coalesce(v_current->'workGroups','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    select count(*),(jsonb_agg(value)->0) into v_cb,v_cbv from jsonb_array_elements(coalesce(v_current->'repairBundles','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    select count(*),(jsonb_agg(value)->0) into v_nw,v_nwv from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'workGroups','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    select count(*),(jsonb_agg(value)->0) into v_nb,v_nbv from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'repairBundles','[]'::jsonb)) item(value) where value->>'id'=p_object_id;
    if v_cw>1 or v_cb>1 or v_nw>1 or v_nb>1 or v_cw+v_cb=0 or v_nw<>v_cw or v_nb<>v_cb then
      raise exception using errcode='23514',message='Reviewed bundle occurrences are ambiguous or changed.';
    end if;
    -- Runtime treats workGroups as canonical and mirrors reviews into both arrays.
    -- One live legacy record has drift only in transient review timing metadata;
    -- tolerate only that exact pre-existing shape so the next write can reconcile it.
    if v_cw=1 and v_cb=1 and v_cwv is distinct from v_cbv
      and (v_cwv-'review_started_at'-'review_due_at') is distinct from
          (v_cbv-'review_started_at'-'review_due_at') then
      raise exception using errcode='23514',message='Persisted mirrored bundle copies disagree outside review timing metadata.';
    end if;
    if v_nw=1 and v_nb=1 and v_nwv is distinct from v_nbv then
      raise exception using errcode='23514',message='Submitted mirrored bundle copies must remain identical.';
    end if;
    v_previous:=coalesce(v_cwv,v_cbv); v_next:=coalesce(v_nwv,v_nbv);
    if (v_current-'repairBundles'-'workGroups'-'humanReviewStatus') is distinct from
       (p_next_inspection_intelligence-'repairBundles'-'workGroups'-'humanReviewStatus') then
      raise exception using errcode='40001',message='Inspection intelligence changed outside the reviewed bundle.';
    end if;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_current from jsonb_array_elements(coalesce(v_current->'workGroups','[]'::jsonb)) with ordinality item(value,ordinality) where value->>'id' is distinct from p_object_id;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_next from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'workGroups','[]'::jsonb)) with ordinality item(value,ordinality) where value->>'id' is distinct from p_object_id;
    if v_other_current is distinct from v_other_next then raise exception using errcode='40001',message='Other work groups changed during review.'; end if;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_current from jsonb_array_elements(coalesce(v_current->'repairBundles','[]'::jsonb)) with ordinality item(value,ordinality) where value->>'id' is distinct from p_object_id;
    select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_other_next from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'repairBundles','[]'::jsonb)) with ordinality item(value,ordinality) where value->>'id' is distinct from p_object_id;
    if v_other_current is distinct from v_other_next then raise exception using errcode='40001',message='Other repair bundles changed during review.'; end if;
  end if;

  if v_previous is distinct from p_previous_value then raise exception using errcode='40001',message='Inspection review is stale; reload the latest saved state.'; end if;
  if v_next is distinct from p_next_value then raise exception using errcode='23514',message='Submitted next snapshot does not match the proposed inspection state.'; end if;
  -- Presence is separate from value: missing, JSON null, and present are exact states.
  foreach v_key in array v_provenance_keys loop
    if (v_previous?v_key) is distinct from (v_next?v_key) or (v_previous->v_key) is distinct from (v_next->v_key) then
      raise exception using errcode='23514',message=format('Inspection provenance field %s cannot change during interpretation review.',v_key);
    end if;
  end loop;

  -- Derive a work request only from one unique lead-specific canonical row.
  select count(*),(array_agg(wr.id))[1] into v_work_request_count,v_work_request_id
    from public.work_requests wr where wr.lead_id=p_lead_id and wr.property_id=v_property_id;
  if v_work_request_count<>1 then v_work_request_id:=null; end if;
  if p_work_request_id is not null and p_work_request_id is distinct from v_work_request_id then
    raise exception using errcode='23514',message='Submitted work request is not the target lead canonical work request.';
  end if;
  if p_object_type='inspection_bundle' then
    if p_repair_item_id is not null then raise exception using errcode='23514',message='Bundle reviews cannot link to a repair item.'; end if;
    v_repair_item_id:=null;
  else
    select count(*),(array_agg(ri.id))[1] into v_repair_item_count,v_repair_item_id
      from public.repair_items ri
      where ri.id::text=p_object_id and ri.property_id=v_property_id;
    if v_repair_item_count<>1 then v_repair_item_id:=null; end if;
    if p_repair_item_id is not null and p_repair_item_id is distinct from v_repair_item_id then
      raise exception using errcode='23514',message='Submitted repair item is not the exact reviewed finding canonical repair item.';
    end if;
  end if;

  -- Global rule: every finding and canonical bundle is terminally human-reviewed;
  -- empty collections are neutral, but the inspection must contain an object.
  select count(*)=0 or bool_and(coalesce(value->>'status','') in ('approved','rejected')) into v_findings_complete
    from jsonb_array_elements(coalesce(p_next_inspection_intelligence->'repairItems','[]'::jsonb)) item(value);
  select count(*)=0 or bool_and(coalesce(value->>'status','') in ('approved','human_verified','rejected')) into v_bundles_complete
    from jsonb_array_elements(case when jsonb_array_length(coalesce(p_next_inspection_intelligence->'workGroups','[]'::jsonb))>0
      then p_next_inspection_intelligence->'workGroups' else coalesce(p_next_inspection_intelligence->'repairBundles','[]'::jsonb) end) item(value);
  v_complete:=v_findings_complete and v_bundles_complete and
    (jsonb_array_length(coalesce(p_next_inspection_intelligence->'repairItems','[]'::jsonb))>0
     or jsonb_array_length(coalesce(p_next_inspection_intelligence->'workGroups','[]'::jsonb))>0
     or jsonb_array_length(coalesce(p_next_inspection_intelligence->'repairBundles','[]'::jsonb))>0);
  v_global_status:=case when v_complete then 'human_verified' else 'needs_review' end;
  v_committed:=jsonb_set(p_next_inspection_intelligence,'{humanReviewStatus}',to_jsonb(v_global_status),true);

  v_previous_status:=coalesce(v_previous->>'status',v_previous->>'review_status');
  v_next_status:=coalesce(v_next->>'status',v_next->>'review_status');
  v_previous_notes:=nullif(trim(v_previous->>'admin_notes'),''); v_next_notes:=nullif(trim(v_next->>'admin_notes'),'');
  v_action:=case when v_previous_status is distinct from v_next_status and v_next_status is not null then v_next_status
    when v_previous_notes is distinct from v_next_notes then 'noted' else 'edited' end;
  v_decision:=case when v_next_status in ('approved','human_verified') then 'approved' when v_next_status='rejected' then 'rejected'
    when v_next_status='needs_more_info' then 'needs_more_info' else 'needs_review' end;

  -- Event provenance is extracted only from the locked previous object.
  with c(value,pos) as (
    select value,ordinality from jsonb_array_elements(coalesce(v_previous->'evidence_ids','[]'::jsonb)) with ordinality
    union all select value,1000+ordinality from jsonb_array_elements(coalesce(v_previous->'evidenceIds','[]'::jsonb)) with ordinality
    union all select to_jsonb(coalesce(r->>'id',r->>'evidence_id',r->>'evidenceItemId')),2000+ordinality
      from jsonb_array_elements(coalesce(v_previous->'full_source_refs','[]'::jsonb)) with ordinality s(r,ordinality)
      where lower(coalesce(r->>'type','')) like '%evidence%'
  ),u as (select value,min(pos) pos from c where value is not null and value not in ('null'::jsonb,'""'::jsonb) group by value)
  select coalesce(jsonb_agg(value order by pos),'[]'::jsonb) into v_evidence_ids from u;
  with c(value,pos) as (
    select value,ordinality from jsonb_array_elements(coalesce(v_previous->'full_source_refs','[]'::jsonb)) with ordinality
    union all select value,1000+ordinality from jsonb_array_elements(coalesce(v_previous->'evidence_references','[]'::jsonb)) with ordinality
    union all select value,2000+ordinality from jsonb_array_elements(coalesce(v_previous->'source_references','[]'::jsonb)) with ordinality
    union all select value,3000+ordinality from jsonb_array_elements(coalesce(v_previous->'finding_ids','[]'::jsonb)) with ordinality
    union all select to_jsonb(value),4000+pos from unnest(array[v_previous->>'inspection_report_id',v_previous->>'repair_bundle_id',v_previous->>'source_file_id',v_previous->>'source_page',v_previous->>'page_range']) with ordinality s(value,pos) where value is not null and value<>''
  ),u as (select value,min(pos) pos from c where value is not null and value not in ('null'::jsonb,'""'::jsonb) group by value)
  select coalesce(jsonb_agg(value order by pos),'[]'::jsonb) into v_source_references from u;
  v_payload:=jsonb_build_object('previous_value',v_previous,'next_value',v_next,'evidence_ids',v_evidence_ids,
    'source_references',v_source_references,'review_action',v_action,'object_type',p_object_type,'object_id',p_object_id);
  v_next_property_facts:=v_property_facts||jsonb_build_object('inspectionIntelligence',v_committed,
    'inspectionProcessingStatus',case when v_complete then 'human_verified' else 'needs_human_review' end,
    'inspectionExtractionMessage',case when v_complete then 'Human Verified' else 'Needs Human Review' end);

  insert into public.review_events(property_id,work_request_id,repair_item_id,target_table,target_id,review_type,
    decision,action,reviewer_id,previous_status,next_status,notes,payload)
  values(v_property_id,v_work_request_id,v_repair_item_id,'leads',p_lead_id,'human_review',v_decision,v_action,
    v_reviewer_id,v_previous_status,v_next_status,v_next_notes,v_payload) returning id into v_event_id;
  update public.leads set property_facts=v_next_property_facts where id=p_lead_id;
  if not found then raise exception using errcode='P0002',message='Target lead disappeared during inspection review.'; end if;
  return query select v_event_id,v_next_property_facts,v_reviewer_id,v_work_request_id,v_repair_item_id;
end;
$$;

revoke all on function public.apply_inspection_review(uuid,bigint,text,text,jsonb,jsonb,jsonb,uuid,uuid) from public,anon;
grant execute on function public.apply_inspection_review(uuid,bigint,text,text,jsonb,jsonb,jsonb,uuid,uuid) to authenticated;
drop policy if exists "review_events admin manage" on public.review_events;
revoke insert,update,delete on table public.review_events from anon,authenticated;
commit;
