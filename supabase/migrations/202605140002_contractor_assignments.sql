-- Contractor assignment infrastructure for scoped contractor participation.
-- No marketplace, bidding, or payment behavior is introduced here.

create table if not exists public.contractor_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint,
  work_request_id uuid,
  contractor_profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  status text not null default 'assigned',
  assignment_notes text,
  contractor_notes text,
  last_status_change_at timestamptz not null default now()
);

alter table public.contractor_assignments
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists property_id bigint,
  add column if not exists work_request_id uuid,
  add column if not exists contractor_profile_id uuid,
  add column if not exists assigned_by uuid,
  add column if not exists status text not null default 'assigned',
  add column if not exists assignment_notes text,
  add column if not exists contractor_notes text,
  add column if not exists last_status_change_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.properties') is not null
    and not exists (select 1 from pg_constraint where conname = 'contractor_assignments_property_fk')
  then
    alter table public.contractor_assignments
      add constraint contractor_assignments_property_fk
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;

  if to_regclass('public.work_requests') is not null
    and not exists (select 1 from pg_constraint where conname = 'contractor_assignments_work_request_fk')
  then
    alter table public.contractor_assignments
      add constraint contractor_assignments_work_request_fk
      foreign key (work_request_id) references public.work_requests(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contractor_assignments_status_check') then
    alter table public.contractor_assignments
      add constraint contractor_assignments_status_check
      check (status in (
        'assigned',
        'accepted',
        'declined',
        'walkthrough_requested',
        'revision_requested',
        'completed',
        'cancelled'
      ));
  end if;

end $$;

create or replace function public.enforce_contractor_assignment_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.contractor_profile_id
      and p.role = 'contractor'
  ) then
    raise exception 'contractor_profile_id must reference a contractor profile';
  end if;

  if tg_op = 'UPDATE'
    and public.current_user_role() = 'contractor'
    and not public.is_admin_or_owner()
  then
    if new.property_id is distinct from old.property_id
      or new.work_request_id is distinct from old.work_request_id
      or new.contractor_profile_id is distinct from old.contractor_profile_id
      or new.assigned_by is distinct from old.assigned_by
      or new.assignment_notes is distinct from old.assignment_notes
    then
      raise exception 'contractors may only update contractor-facing assignment fields';
    end if;
  end if;

  new.updated_at = now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.last_status_change_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists contractor_assignments_enforce_rules on public.contractor_assignments;
create trigger contractor_assignments_enforce_rules
before insert or update on public.contractor_assignments
for each row execute function public.enforce_contractor_assignment_rules();

create index if not exists contractor_assignments_property_idx on public.contractor_assignments(property_id);
create index if not exists contractor_assignments_work_request_idx on public.contractor_assignments(work_request_id);
create index if not exists contractor_assignments_contractor_idx on public.contractor_assignments(contractor_profile_id);
create index if not exists contractor_assignments_status_idx on public.contractor_assignments(status);

create or replace function public.is_assigned_contractor_for_property(target_property_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'contractor'
    and exists (
      select 1
      from public.contractor_assignments ca
      where ca.contractor_profile_id = auth.uid()
        and ca.property_id = target_property_id
        and ca.status in ('assigned', 'accepted', 'walkthrough_requested', 'revision_requested')
    );
$$;

create or replace function public.is_assigned_contractor_for_work_request(target_work_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'contractor'
    and exists (
      select 1
      from public.contractor_assignments ca
      where ca.contractor_profile_id = auth.uid()
        and ca.work_request_id = target_work_request_id
        and ca.status in ('assigned', 'accepted', 'walkthrough_requested', 'revision_requested')
    );
$$;

create or replace function public.can_view_contractor_assignment(assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_or_owner()
    or exists (
      select 1
      from public.contractor_assignments ca
      where ca.id = assignment_id
        and ca.contractor_profile_id = auth.uid()
        and public.current_user_role() = 'contractor'
    );
$$;

create or replace function public.can_update_contractor_assignment(assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_or_owner()
    or exists (
      select 1
      from public.contractor_assignments ca
      where ca.id = assignment_id
        and ca.contractor_profile_id = auth.uid()
        and public.current_user_role() = 'contractor'
        and ca.status <> 'cancelled'
    );
$$;

create or replace function public.can_provide_contractor_feedback(application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'contractor'
    and exists (
      select 1
      from public.agent_rule_applications ara
      where ara.id = application_id
        and ara.application_type = 'applied'
        and (
          (
            ara.property_id is not null
            and public.is_assigned_contractor_for_property(ara.property_id)
          )
          or (
            ara.work_request_id is not null
            and public.is_assigned_contractor_for_work_request(ara.work_request_id)
          )
        )
    );
$$;

alter table public.contractor_assignments enable row level security;

drop policy if exists "contractor assignments admin manage" on public.contractor_assignments;
create policy "contractor assignments admin manage"
on public.contractor_assignments
for all
to authenticated
using (public.is_admin_or_owner())
with check (public.is_admin_or_owner());

drop policy if exists "contractor assignments contractor read own" on public.contractor_assignments;
create policy "contractor assignments contractor read own"
on public.contractor_assignments
for select
to authenticated
using (
  public.current_user_role() = 'contractor'
  and contractor_profile_id = auth.uid()
);

drop policy if exists "contractor assignments contractor update own" on public.contractor_assignments;
create policy "contractor assignments contractor update own"
on public.contractor_assignments
for update
to authenticated
using (
  public.current_user_role() = 'contractor'
  and contractor_profile_id = auth.uid()
  and status <> 'cancelled'
)
with check (
  public.current_user_role() = 'contractor'
  and contractor_profile_id = auth.uid()
  and status in ('accepted', 'declined', 'walkthrough_requested', 'revision_requested', 'completed')
);

-- Tighten contractor feedback now that assignment infrastructure exists.
drop policy if exists "operational memory applications read" on public.agent_rule_applications;
create policy "operational memory applications read"
on public.agent_rule_applications
for select
to authenticated
using (
  public.current_user_role() in ('admin', 'owner', 'estimator')
  or public.can_provide_contractor_feedback(id)
);

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
