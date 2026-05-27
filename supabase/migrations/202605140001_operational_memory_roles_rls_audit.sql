-- Harden shared operational memory with profile-backed roles, RLS, and audit support.
-- Frontend checks are UX only; these policies are the production security boundary.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text not null default 'viewer',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_type'
  ) then
    execute 'update public.profiles set role = coalesce(nullif(role, ''''), nullif(user_type, ''''), ''viewer'')';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'owner', 'estimator', 'contractor', 'agent', 'client', 'viewer'))
      not valid;
  end if;
end $$;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'viewer'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
      limit 1
    ),
    'viewer'
  );
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'owner');
$$;

create or replace function public.can_manage_operational_memory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_or_owner();
$$;

create or replace function public.can_edit_operational_memory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'owner', 'estimator');
$$;

create or replace function public.can_provide_contractor_feedback(application_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  app_type text;
begin
  if public.current_user_role() <> 'contractor' then
    return false;
  end if;

  select application_type
  into app_type
  from public.agent_rule_applications
  where id = application_id;

  if app_type is distinct from 'applied' then
    return false;
  end if;

  -- TODO: Return true only after contractor assignment tables are implemented
  -- and the current contractor is assigned to the related property/work request.
  return false;
end;
$$;

alter table public.profiles enable row level security;
alter table public.agent_learning_events enable row level security;
alter table public.agent_learning_rules enable row level security;
alter table public.agent_rule_applications enable row level security;
alter table public.agent_memory_conflicts enable row level security;
alter table public.agent_memory_audit_log enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin_or_owner());

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "pilot can manage agent learning events" on public.agent_learning_events;
drop policy if exists "operational memory events read" on public.agent_learning_events;
create policy "operational memory events read"
on public.agent_learning_events
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory events insert" on public.agent_learning_events;
create policy "operational memory events insert"
on public.agent_learning_events
for insert
to authenticated
with check (
  public.is_admin_or_owner()
  or (
    public.current_user_role() = 'estimator'
    and human_verified = false
    and lesson_status in ('draft', 'needs_confirmation')
  )
);

drop policy if exists "operational memory events admin update" on public.agent_learning_events;
create policy "operational memory events admin update"
on public.agent_learning_events
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "pilot can manage agent learning rules" on public.agent_learning_rules;
drop policy if exists "operational memory rules read" on public.agent_learning_rules;
create policy "operational memory rules read"
on public.agent_learning_rules
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory rules admin insert" on public.agent_learning_rules;
create policy "operational memory rules admin insert"
on public.agent_learning_rules
for insert
to authenticated
with check (public.is_admin_or_owner());

drop policy if exists "operational memory rules admin update" on public.agent_learning_rules;
create policy "operational memory rules admin update"
on public.agent_learning_rules
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "pilot can manage agent rule applications" on public.agent_rule_applications;
drop policy if exists "operational memory applications read" on public.agent_rule_applications;
create policy "operational memory applications read"
on public.agent_rule_applications
for select
to authenticated
using (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  or public.can_provide_contractor_feedback(id)
);

drop policy if exists "operational memory applications insert" on public.agent_rule_applications;
create policy "operational memory applications insert"
on public.agent_rule_applications
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory applications feedback update" on public.agent_rule_applications;
create policy "operational memory applications feedback update"
on public.agent_rule_applications
for update
to authenticated
using (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  or public.can_provide_contractor_feedback(id)
)
with check (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  or public.can_provide_contractor_feedback(id)
);

drop policy if exists "pilot can manage agent memory conflicts" on public.agent_memory_conflicts;
drop policy if exists "operational memory conflicts read" on public.agent_memory_conflicts;
create policy "operational memory conflicts read"
on public.agent_memory_conflicts
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory conflicts insert" on public.agent_memory_conflicts;
create policy "operational memory conflicts insert"
on public.agent_memory_conflicts
for insert
to authenticated
with check (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory conflicts admin update" on public.agent_memory_conflicts;
create policy "operational memory conflicts admin update"
on public.agent_memory_conflicts
for update
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "pilot can manage agent memory audit log" on public.agent_memory_audit_log;
drop policy if exists "operational memory audit read" on public.agent_memory_audit_log;
create policy "operational memory audit read"
on public.agent_memory_audit_log
for select
to authenticated
using (public.current_user_role() in ('admin', 'owner', 'estimator'));

drop policy if exists "operational memory audit insert" on public.agent_memory_audit_log;
create policy "operational memory audit insert"
on public.agent_memory_audit_log
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and actor_role = public.current_user_role()
  and public.current_user_role() in ('admin', 'owner', 'estimator', 'contractor')
);

do $$
declare
  memory_record record;
begin
  for memory_record in
    select *
    from (values
      ('human_pricing_memory', 'pilot can manage human pricing memory'),
      ('job_execution_step_learning', 'pilot can manage job execution learning'),
      ('photo_field_memory', 'pilot can manage photo field memory'),
      ('pricing_memory_entries', 'pilot can manage pricing memory')
    ) as t(memory_table, pilot_policy)
  loop
    if to_regclass(format('public.%I', memory_record.memory_table)) is not null then
      execute format('alter table public.%I enable row level security', memory_record.memory_table);
      execute format('drop policy if exists %I on public.%I', memory_record.pilot_policy, memory_record.memory_table);
      execute format('drop policy if exists %I on public.%I', memory_record.memory_table || ' operational memory read', memory_record.memory_table);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.current_user_role() in (''admin'', ''owner'', ''estimator''))',
        memory_record.memory_table || ' operational memory read',
        memory_record.memory_table
      );
      execute format('drop policy if exists %I on public.%I', memory_record.memory_table || ' operational memory admin manage', memory_record.memory_table);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())',
        memory_record.memory_table || ' operational memory admin manage',
        memory_record.memory_table
      );
    end if;
  end loop;
end $$;
