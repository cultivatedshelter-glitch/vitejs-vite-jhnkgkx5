-- RLS for Historical Upload / Historical Memory.
--
-- Current pilot note:
-- The existing Shelter Prep admin screen is PIN-gated in React and writes with
-- the public Supabase anon key. These policies allow only sanitized
-- needs-review pilot inserts for anon users, while leaving a stricter
-- authenticated-admin path for full review/edit workflows.

alter table public.historical_projects enable row level security;
alter table public.historical_project_files enable row level security;
alter table public.historical_project_line_items enable row level security;
alter table public.historical_change_orders enable row level security;

create or replace function public.is_shelter_prep_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and user_type in ('admin', 'owner')
  );
$$;

drop policy if exists "historical projects admin read" on public.historical_projects;
create policy "historical projects admin read"
on public.historical_projects
for select
to authenticated
using (public.is_shelter_prep_admin());

drop policy if exists "historical projects pilot read anonymized" on public.historical_projects;
create policy "historical projects pilot read anonymized"
on public.historical_projects
for select
to anon
using (anonymized = true and customer_visible = false);

drop policy if exists "historical projects admin insert" on public.historical_projects;
create policy "historical projects admin insert"
on public.historical_projects
for insert
to authenticated
with check (public.is_shelter_prep_admin());

drop policy if exists "historical projects pilot insert anonymized review" on public.historical_projects;
create policy "historical projects pilot insert anonymized review"
on public.historical_projects
for insert
to anon
with check (
  anonymized = true
  and customer_visible = false
  and customer_name is null
  and review_status = 'needs_human_review'
  and human_verified = false
  and extraction_status in ('not_started', 'needs_human_review')
);

drop policy if exists "historical projects admin update" on public.historical_projects;
create policy "historical projects admin update"
on public.historical_projects
for update
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());

drop policy if exists "historical project files admin read" on public.historical_project_files;
create policy "historical project files admin read"
on public.historical_project_files
for select
to authenticated
using (public.is_shelter_prep_admin());

drop policy if exists "historical project files pilot read anonymized" on public.historical_project_files;
create policy "historical project files pilot read anonymized"
on public.historical_project_files
for select
to anon
using (
  exists (
    select 1
    from public.historical_projects hp
    where hp.id = historical_project_files.project_id
      and hp.anonymized = true
      and hp.customer_visible = false
  )
);

drop policy if exists "historical project files admin insert" on public.historical_project_files;
create policy "historical project files admin insert"
on public.historical_project_files
for insert
to authenticated
with check (public.is_shelter_prep_admin());

drop policy if exists "historical project files pilot insert needs review" on public.historical_project_files;
create policy "historical project files pilot insert needs review"
on public.historical_project_files
for insert
to anon
with check (
  storage_bucket = 'historical-project-files'
  and human_verified = false
  and extraction_status in ('not_started', 'needs_human_review')
  and exists (
    select 1
    from public.historical_projects hp
    where hp.id = historical_project_files.project_id
      and hp.anonymized = true
      and hp.customer_visible = false
      and hp.review_status = 'needs_human_review'
      and hp.human_verified = false
  )
);

drop policy if exists "historical project files admin update" on public.historical_project_files;
create policy "historical project files admin update"
on public.historical_project_files
for update
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());

drop policy if exists "historical line items admin manage" on public.historical_project_line_items;
create policy "historical line items admin manage"
on public.historical_project_line_items
for all
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());

drop policy if exists "historical change orders admin manage" on public.historical_change_orders;
create policy "historical change orders admin manage"
on public.historical_change_orders
for all
to authenticated
using (public.is_shelter_prep_admin())
with check (public.is_shelter_prep_admin());
