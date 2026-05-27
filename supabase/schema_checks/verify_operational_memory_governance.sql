-- Verify operational memory governance hardening.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'agent_learning_events',
    'agent_learning_rules',
    'agent_rule_applications',
    'agent_memory_conflicts',
    'agent_memory_audit_log',
    'human_pricing_memory',
    'job_execution_step_learning',
    'photo_field_memory',
    'pricing_memory_entries'
  )
order by table_name;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'current_user_role',
    'is_admin_or_owner',
    'can_manage_operational_memory',
    'can_edit_operational_memory',
    'can_provide_contractor_feedback'
  )
order by routine_name;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'agent_learning_events',
    'agent_learning_rules',
    'agent_rule_applications',
    'agent_memory_conflicts',
    'agent_memory_audit_log',
    'human_pricing_memory',
    'job_execution_step_learning',
    'photo_field_memory',
    'pricing_memory_entries'
  )
order by tablename, policyname;

select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in (
    'agent_learning_events',
    'agent_learning_rules',
    'agent_rule_applications',
    'agent_memory_conflicts',
    'agent_memory_audit_log',
    'human_pricing_memory',
    'job_execution_step_learning',
    'photo_field_memory',
    'pricing_memory_entries'
  )
  and (
    'anon' = any(roles)
    or coalesce(qual, '') = 'true'
    or coalesce(with_check, '') = 'true'
  )
order by tablename, policyname;

select count(*) as audit_log_count
from public.agent_memory_audit_log;
