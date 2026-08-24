-- Run only after 202608240002_verified_finding_contractor_scope.sql exists in the target schema.
-- Every assertion is read-only and the transaction is always rolled back.
begin;

do $$
declare
  v_column text;
  v_function record;
  v_definition text;
  v_public_execute boolean;
begin
  foreach v_column in array array[
    'lead_id','source_finding_id','source_review_event_id','source_evidence_ids','source_references',
    'title','repair_objective','trade_category','known_conditions','reviewed_interpretation',
    'unknown_conditions','field_verification_items','missing_information','access_setup_notes',
    'sequencing_dependencies','cleanup_disposal_expectations','exclusions','scope_status',
    'generation_provenance','created_by','reviewed_by','reviewed_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='contractor_scope_packets' and column_name=v_column
    ) then raise exception 'contractor_scope_packets.% is missing',v_column; end if;
  end loop;

  for v_function in
    select p.oid,p.proname,p.prosecdef,r.rolname owner,coalesce(p.proconfig,array[]::text[]) config
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
    where n.nspname='public' and p.proname in ('prepare_contractor_scope','apply_contractor_scope_review')
  loop
    if not v_function.prosecdef then raise exception '% must be SECURITY DEFINER',v_function.proname; end if;
    if v_function.owner<>'postgres' then raise exception '% owner is %, expected postgres',v_function.proname,v_function.owner; end if;
    if not ('search_path=public, pg_temp'=any(v_function.config)) then raise exception '% search_path is not constrained',v_function.proname; end if;
  end loop;

  if to_regprocedure('public.prepare_contractor_scope(uuid,bigint,text,jsonb)') is null
    or to_regprocedure('public.apply_contractor_scope_review(uuid,jsonb,jsonb,text)') is null then
    raise exception 'Contractor scope RPCs are missing';
  end if;
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    where n.nspname='public' and p.proname in ('prepare_contractor_scope','apply_contractor_scope_review')
      and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) into v_public_execute;
  if v_public_execute
    or has_function_privilege('anon','public.prepare_contractor_scope(uuid,bigint,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.apply_contractor_scope_review(uuid,jsonb,jsonb,text)','EXECUTE') then
    raise exception 'PUBLIC/anon must not execute contractor scope RPCs';
  end if;
  if not has_function_privilege('authenticated','public.prepare_contractor_scope(uuid,bigint,text,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.apply_contractor_scope_review(uuid,jsonb,jsonb,text)','EXECUTE') then
    raise exception 'authenticated must execute contractor scope RPCs';
  end if;
  if has_table_privilege('authenticated','public.contractor_scope_packets','INSERT')
    or has_table_privilege('authenticated','public.contractor_scope_packets','UPDATE')
    or has_table_privilege('authenticated','public.contractor_scope_packets','DELETE') then
    raise exception 'authenticated direct contractor_scope_packets mutation must be blocked';
  end if;
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contractor_scope_packets' and c.relrowsecurity) then
    raise exception 'RLS must remain enabled on contractor_scope_packets';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contractor_scope_packets' and cmd='SELECT') then
    raise exception 'Intended contractor_scope_packets read policy is missing';
  end if;

  select pg_get_functiondef('public.prepare_contractor_scope(uuid,bigint,text,jsonb)'::regprocedure) into v_definition;
  if v_definition not like '%for update%'
    or v_definition not like '%Only a human-verified inspection finding%'
    or v_definition not like '%matching authoritative approval event%'
    or v_definition not like '%source_evidence_ids%'
    or v_definition not like '%''needs_review''%' then
    raise exception 'prepare_contractor_scope eligibility/provenance guards are incomplete';
  end if;
  select pg_get_functiondef('public.apply_contractor_scope_review(uuid,jsonb,jsonb,text)'::regprocedure) into v_definition;
  if v_definition not like '%for update%'
    or v_definition not like '%review is stale%'
    or v_definition not like '%source review provenance is stale or invalid%'
    or v_definition not like '%insert into public.review_events%'
    or v_definition not like '%scope_status=v_next_status%' then
    raise exception 'apply_contractor_scope_review atomicity/provenance guards are incomplete';
  end if;
end
$$;

rollback;
