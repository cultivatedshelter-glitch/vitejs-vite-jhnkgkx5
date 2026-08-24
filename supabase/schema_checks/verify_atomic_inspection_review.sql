-- Run after migrations. This script is rollback-only and raises if the atomic
-- inspection-review boundary, privileges, or behavioral guards are incomplete.

begin;

do $$
declare
  v_security_definer boolean;
  v_search_path text[];
  v_direct_write_policy_count integer;
  v_owner text;
  v_rls_enabled boolean;
  v_read_policy_count integer;
  v_function_source text;
  v_public_execute boolean;
  v_review_event_column_count integer;
begin
  select count(*) into v_review_event_column_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'review_events'
    and is_nullable = 'YES'
    and (
      (column_name in ('work_request_id', 'repair_item_id') and data_type = 'uuid')
      or (column_name in ('review_type', 'decision') and data_type = 'text')
      or (column_name = 'payload' and data_type = 'jsonb')
    );
  if v_review_event_column_count <> 5 then
    raise exception 'review_events must contain the five nullable atomic-review columns with expected types';
  end if;

  select p.prosecdef, p.proconfig, owner_role.rolname, p.prosrc
  into v_security_definer, v_search_path, v_owner, v_function_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles owner_role on owner_role.oid = p.proowner
  where n.nspname = 'public'
    and p.proname = 'apply_inspection_review'
    and pg_get_function_identity_arguments(p.oid) =
      'p_lead_id uuid, p_expected_property_id bigint, p_object_type text, p_object_id text, p_previous_value jsonb, p_next_value jsonb, p_next_inspection_intelligence jsonb, p_work_request_id uuid, p_repair_item_id uuid';

  if not found then
    raise exception 'apply_inspection_review RPC is missing';
  end if;

  if not v_security_definer then
    raise exception 'apply_inspection_review must be SECURITY DEFINER';
  end if;

  if v_owner <> 'postgres' then
    raise exception 'apply_inspection_review owner is %, expected postgres', v_owner;
  end if;

  if v_search_path is null or not ('search_path=public, pg_temp' = any(v_search_path)) then
    raise exception 'apply_inspection_review must use a fixed search_path';
  end if;

  select count(*)
  into v_direct_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'review_events'
    and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE');

  if v_direct_write_policy_count <> 0 then
    raise exception 'review_events still has direct client write policies';
  end if;

  select c.relrowsecurity into v_rls_enabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'review_events';
  if not coalesce(v_rls_enabled, false) then
    raise exception 'RLS must remain enabled on review_events';
  end if;

  select count(*) into v_read_policy_count
  from pg_policies where schemaname = 'public' and tablename = 'review_events'
    and cmd = 'SELECT' and policyname = 'review_events estimator read drafts';
  if v_read_policy_count <> 1 then
    raise exception 'intended review_events read policy is missing';
  end if;

  if has_table_privilege('authenticated', 'public.review_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.review_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.review_events', 'DELETE') then
    raise exception 'authenticated still has direct review_events write privileges';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.apply_inspection_review(uuid,bigint,text,text,jsonb,jsonb,jsonb,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute apply_inspection_review';
  end if;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where n.nspname='public' and p.proname='apply_inspection_review'
      and acl.grantee=0 and acl.privilege_type='EXECUTE'
  ) into v_public_execute;
  if v_public_execute then raise exception 'PUBLIC can execute apply_inspection_review'; end if;

  if has_function_privilege(
    'anon',
    'public.apply_inspection_review(uuid,bigint,text,text,jsonb,jsonb,jsonb,uuid,uuid)',
    'EXECUTE'
  ) then raise exception 'anon can execute apply_inspection_review'; end if;

  -- Behavioral guard verification. Full calls require a project-specific auth
  -- fixture; these assertions ensure the deployed body contains every guard
  -- before that rollback-only authenticated fixture is run.
  if position('p_object_type is null' in v_function_source) = 0
    or position('v_cf<>1 or v_nf<>1' in v_function_source) = 0
    or position('v_cw>1 or v_cb>1 or v_nw>1 or v_nb>1' in v_function_source) = 0
    or position('Other inspection findings changed during review' in v_function_source) = 0
    or position('Inspection review is stale' in v_function_source) = 0
    or position('v_previous?v_key' in v_function_source) = 0
    or position('Submitted work request is not the target lead canonical work request' in v_function_source) = 0
    or position('Bundle reviews cannot link to a repair item' in v_function_source) = 0
    or position('ri.id::text=p_object_id and ri.property_id=v_property_id' in v_function_source) = 0
    or position('insert into public.review_events' in v_function_source) = 0
    or position('update public.leads' in v_function_source) = 0 then
    raise exception 'apply_inspection_review behavioral guards are incomplete';
  end if;
end;
$$;

rollback;
