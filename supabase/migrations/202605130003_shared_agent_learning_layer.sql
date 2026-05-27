-- Shared Agent Learning Layer.
-- Stores conditional, human-reviewed operational memory shared across agents.
-- AI may draft/suggest learning, but rules are reusable only when human_verified.

create table if not exists public.agent_learning_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id bigint,
  work_request_id uuid,
  memory_scope text not null default 'global_operational',
  lesson_status text not null default 'draft',
  source_agent text not null,
  affected_agents text[] not null default '{}'::text[],
  task_type text not null default '',
  original_agent_output text not null default '',
  human_correction text not null default '',
  correction_category text not null,
  inferred_reason text not null default '',
  confirmation_question text not null default '',
  human_confirmed_reason text not null default '',
  learning_value_score integer not null default 0,
  reusable boolean not null default false,
  human_verified boolean not null default false,
  verified_by uuid,
  confidence text not null default 'draft',
  notes text not null default ''
);

alter table public.agent_learning_events
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id bigint,
  add column if not exists work_request_id uuid,
  add column if not exists memory_scope text not null default 'global_operational',
  add column if not exists lesson_status text not null default 'draft',
  add column if not exists source_agent text not null default 'quality_check_agent',
  add column if not exists affected_agents text[] not null default '{}'::text[],
  add column if not exists task_type text not null default '',
  add column if not exists original_agent_output text not null default '',
  add column if not exists human_correction text not null default '',
  add column if not exists correction_category text not null default 'workflow_logic',
  add column if not exists inferred_reason text not null default '',
  add column if not exists confirmation_question text not null default '',
  add column if not exists human_confirmed_reason text not null default '',
  add column if not exists learning_value_score integer not null default 0,
  add column if not exists reusable boolean not null default false,
  add column if not exists human_verified boolean not null default false,
  add column if not exists verified_by uuid,
  add column if not exists confidence text not null default 'draft',
  add column if not exists notes text not null default '';

create table if not exists public.agent_learning_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null default '',
  memory_scope text not null default 'global_operational',
  lesson_status text not null default 'draft',
  rule_type text not null default 'workflow_logic',
  rule_text text not null default '',
  reason text not null default '',
  applies_when text not null default '',
  does_not_apply_when text not null default '',
  source_event_id uuid,
  source_agent text not null default 'quality_check_agent',
  affected_agents text[] not null default '{}'::text[],
  confidence text not null default 'draft',
  human_verified boolean not null default false,
  active boolean not null default true,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  conflict_group_id uuid,
  conflicts_with_rule_ids uuid[],
  conflict_notes text,
  priority_level text not null default 'normal',
  context_precedence text
);

alter table public.agent_learning_rules
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists title text not null default '',
  add column if not exists memory_scope text not null default 'global_operational',
  add column if not exists lesson_status text not null default 'draft',
  add column if not exists rule_type text not null default 'workflow_logic',
  add column if not exists rule_text text not null default '',
  add column if not exists reason text not null default '',
  add column if not exists applies_when text not null default '',
  add column if not exists does_not_apply_when text not null default '',
  add column if not exists source_event_id uuid,
  add column if not exists source_agent text not null default 'quality_check_agent',
  add column if not exists affected_agents text[] not null default '{}'::text[],
  add column if not exists confidence text not null default 'draft',
  add column if not exists human_verified boolean not null default false,
  add column if not exists active boolean not null default true,
  add column if not exists usage_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists conflict_group_id uuid,
  add column if not exists conflicts_with_rule_ids uuid[],
  add column if not exists conflict_notes text,
  add column if not exists priority_level text not null default 'normal',
  add column if not exists context_precedence text;

create table if not exists public.agent_memory_conflicts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  property_id bigint,
  work_request_id uuid,
  task_type text not null default '',
  detected_by_agent text not null default 'quality_check_agent',
  conflicting_rule_ids uuid[] not null default '{}'::uuid[],
  conflict_summary text not null default '',
  recommended_resolution text,
  human_selected_rule_id uuid,
  human_resolution_notes text,
  resolution_status text not null default 'needs_review',
  resolved_by uuid,
  creates_new_rule boolean not null default false,
  new_rule_id uuid
);

alter table public.agent_memory_conflicts
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists property_id bigint,
  add column if not exists work_request_id uuid,
  add column if not exists task_type text not null default '',
  add column if not exists detected_by_agent text not null default 'quality_check_agent',
  add column if not exists conflicting_rule_ids uuid[] not null default '{}'::uuid[],
  add column if not exists conflict_summary text not null default '',
  add column if not exists recommended_resolution text,
  add column if not exists human_selected_rule_id uuid,
  add column if not exists human_resolution_notes text,
  add column if not exists resolution_status text not null default 'needs_review',
  add column if not exists resolved_by uuid,
  add column if not exists creates_new_rule boolean not null default false,
  add column if not exists new_rule_id uuid;

create table if not exists public.agent_memory_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  action_type text not null,
  target_table text not null,
  target_id uuid not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  property_id bigint,
  work_request_id uuid
);

alter table public.agent_memory_audit_log
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists actor_id uuid,
  add column if not exists actor_role text,
  add column if not exists action_type text not null default 'memory_update',
  add column if not exists target_table text not null default '',
  add column if not exists target_id uuid,
  add column if not exists previous_value jsonb,
  add column if not exists new_value jsonb,
  add column if not exists reason text,
  add column if not exists property_id bigint,
  add column if not exists work_request_id uuid;

create table if not exists public.agent_rule_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rule_id uuid not null,
  application_type text not null default 'suggested',
  applied_by_agent text not null,
  property_id bigint,
  work_request_id uuid,
  task_type text not null default '',
  output_context text not null default '',
  generated_output_excerpt text not null default '',
  human_feedback_status text not null default 'ignored',
  human_feedback_notes text not null default '',
  confidence_before text,
  confidence_after text,
  reviewed_at timestamptz
);

alter table public.agent_rule_applications
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists rule_id uuid,
  add column if not exists application_type text not null default 'suggested',
  add column if not exists applied_by_agent text not null default 'quality_check_agent',
  add column if not exists property_id bigint,
  add column if not exists work_request_id uuid,
  add column if not exists task_type text not null default '',
  add column if not exists output_context text not null default '',
  add column if not exists generated_output_excerpt text not null default '',
  add column if not exists human_feedback_status text not null default 'ignored',
  add column if not exists human_feedback_notes text not null default '',
  add column if not exists confidence_before text,
  add column if not exists confidence_after text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists accepted_by_human boolean,
  add column if not exists rejected_by_human boolean,
  add column if not exists feedback text;

create index if not exists agent_learning_events_source_agent_idx on public.agent_learning_events(source_agent);
create index if not exists agent_learning_events_memory_scope_idx on public.agent_learning_events(memory_scope);
create index if not exists agent_learning_events_lesson_status_idx on public.agent_learning_events(lesson_status);
create index if not exists agent_learning_events_category_idx on public.agent_learning_events(correction_category);
create index if not exists agent_learning_events_verified_idx on public.agent_learning_events(human_verified);
create index if not exists agent_learning_events_task_type_idx on public.agent_learning_events(task_type);
create index if not exists agent_learning_rules_active_verified_idx on public.agent_learning_rules(active, human_verified);
create index if not exists agent_learning_rules_memory_scope_idx on public.agent_learning_rules(memory_scope);
create index if not exists agent_learning_rules_lesson_status_idx on public.agent_learning_rules(lesson_status);
create index if not exists agent_learning_rules_source_agent_idx on public.agent_learning_rules(source_agent);
create index if not exists agent_learning_rules_rule_type_idx on public.agent_learning_rules(rule_type);
create index if not exists agent_learning_rules_priority_level_idx on public.agent_learning_rules(priority_level);
create index if not exists agent_memory_conflicts_status_idx on public.agent_memory_conflicts(resolution_status);
create index if not exists agent_memory_conflicts_task_type_idx on public.agent_memory_conflicts(task_type);
create index if not exists agent_memory_conflicts_detected_agent_idx on public.agent_memory_conflicts(detected_by_agent);
create index if not exists agent_memory_audit_log_target_idx on public.agent_memory_audit_log(target_table, target_id);
create index if not exists agent_memory_audit_log_action_idx on public.agent_memory_audit_log(action_type);
create index if not exists agent_memory_audit_log_actor_role_idx on public.agent_memory_audit_log(actor_role);

update public.agent_learning_events
set lesson_status = case
  when human_verified = true then 'human_verified'
  when confidence = 'draft_needs_confirmation' then 'needs_confirmation'
  else lesson_status
end
where lesson_status = 'draft';

update public.agent_learning_rules
set lesson_status = case
  when active = false and human_verified = false then 'rejected'
  when human_verified = true then 'human_verified'
  else lesson_status
end
where lesson_status = 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_learning_events_lesson_status_check'
  ) then
    alter table public.agent_learning_events
      add constraint agent_learning_events_lesson_status_check
      check (lesson_status in ('draft', 'needs_confirmation', 'human_verified', 'rejected', 'deprecated'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_learning_rules_lesson_status_check'
  ) then
    alter table public.agent_learning_rules
      add constraint agent_learning_rules_lesson_status_check
      check (lesson_status in ('draft', 'needs_confirmation', 'human_verified', 'rejected', 'deprecated'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_learning_rules_priority_level_check'
  ) then
    alter table public.agent_learning_rules
      add constraint agent_learning_rules_priority_level_check
      check (priority_level in ('low', 'normal', 'high', 'critical'));
  end if;
end $$;
create index if not exists agent_rule_applications_rule_idx on public.agent_rule_applications(rule_id);
create index if not exists agent_rule_applications_type_idx on public.agent_rule_applications(application_type);
create index if not exists agent_rule_applications_agent_idx on public.agent_rule_applications(applied_by_agent);
create index if not exists agent_rule_applications_feedback_status_idx on public.agent_rule_applications(human_feedback_status);
create index if not exists agent_rule_applications_task_type_idx on public.agent_rule_applications(task_type);

update public.agent_rule_applications
set
  human_feedback_status = case
    when rejected_by_human = true then 'rejected'
    when accepted_by_human = true then 'accepted'
    else human_feedback_status
  end,
  human_feedback_notes = coalesce(nullif(human_feedback_notes, ''), feedback, ''),
  generated_output_excerpt = coalesce(nullif(generated_output_excerpt, ''), left(output_context, 800), '')
where accepted_by_human is not null
   or rejected_by_human is not null
   or feedback is not null
   or generated_output_excerpt = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_rule_applications_type_check'
  ) then
    alter table public.agent_rule_applications
      add constraint agent_rule_applications_type_check
      check (application_type in ('suggested', 'applied'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_rule_applications_feedback_status_check'
  ) then
    alter table public.agent_rule_applications
      add constraint agent_rule_applications_feedback_status_check
      check (human_feedback_status in ('accepted', 'edited', 'rejected', 'ignored'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_memory_conflicts_resolution_status_check'
  ) then
    alter table public.agent_memory_conflicts
      add constraint agent_memory_conflicts_resolution_status_check
      check (resolution_status in ('needs_review', 'resolved', 'dismissed', 'escalated', 'needs_site_review', 'ask_client'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'agent_memory_audit_log_actor_role_check'
  ) then
    alter table public.agent_memory_audit_log
      add constraint agent_memory_audit_log_actor_role_check
      check (
        actor_role is null
        or actor_role in ('owner', 'admin', 'estimator', 'contractor', 'agent', 'client', 'viewer')
      );
  end if;
end $$;

alter table public.agent_learning_events enable row level security;
alter table public.agent_learning_rules enable row level security;
alter table public.agent_memory_conflicts enable row level security;
alter table public.agent_memory_audit_log enable row level security;
alter table public.agent_rule_applications enable row level security;

drop policy if exists "pilot can manage agent learning events" on public.agent_learning_events;
create policy "pilot can manage agent learning events"
on public.agent_learning_events
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage agent learning rules" on public.agent_learning_rules;
create policy "pilot can manage agent learning rules"
on public.agent_learning_rules
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage agent memory conflicts" on public.agent_memory_conflicts;
create policy "pilot can manage agent memory conflicts"
on public.agent_memory_conflicts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage agent memory audit log" on public.agent_memory_audit_log;
create policy "pilot can manage agent memory audit log"
on public.agent_memory_audit_log
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage agent rule applications" on public.agent_rule_applications;
create policy "pilot can manage agent rule applications"
on public.agent_rule_applications
for all
to anon, authenticated
using (true)
with check (true);

insert into public.agent_learning_rules (
  title,
  memory_scope,
  lesson_status,
  rule_type,
  rule_text,
  reason,
  applies_when,
  does_not_apply_when,
  source_agent,
  affected_agents,
  confidence,
  human_verified,
  active
)
select
  'Remote shower control placement',
  'global_operational',
  'human_verified',
  'design_usability',
  'When feasible, place shower controls near the shower entry and outside the direct spray path so the user can turn on water before stepping in.',
  'This lets the user start the shower and adjust temperature without getting wet.',
  'New shower design, bathroom remodel, valve relocation is possible, and the door or glass layout allows reach-in access.',
  'Existing plumbing cannot be moved, budget does not allow valve relocation, code/access constraints prevent it, or client specifically requests standard same-wall controls.',
  'design_agent',
  array[
    'design_agent',
    'estimator_agent',
    'material_takeoff_agent',
    'client_communication_agent',
    'quality_check_agent'
  ]::text[],
  'high',
  true,
  true
where not exists (
  select 1
  from public.agent_learning_rules
  where title = 'Remote shower control placement'
    and rule_type = 'design_usability'
);

update public.agent_learning_rules
set
  memory_scope = 'global_operational',
  lesson_status = 'human_verified',
  human_verified = true,
  confidence = 'high',
  active = true
where title = 'Remote shower control placement'
  and rule_type = 'design_usability';
