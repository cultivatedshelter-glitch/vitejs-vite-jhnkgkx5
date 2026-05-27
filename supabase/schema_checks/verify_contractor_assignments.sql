-- Verify contractor assignment infrastructure and scoped feedback.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('contractor_assignments', 'profiles', 'agent_rule_applications')
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_assigned_contractor_for_property',
    'is_assigned_contractor_for_work_request',
    'can_view_contractor_assignment',
    'can_update_contractor_assignment',
    'can_provide_contractor_feedback',
    'enforce_contractor_assignment_rules'
  )
order by routine_name;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('contractor_assignments', 'agent_rule_applications')
order by tablename, policyname;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename = 'contractor_assignments'
  and (
    'anon' = any(roles)
    or coalesce(with_check, '') = 'true'
  )
order by policyname;

select pg_get_functiondef('public.can_provide_contractor_feedback(uuid)'::regprocedure) as feedback_function_definition;
