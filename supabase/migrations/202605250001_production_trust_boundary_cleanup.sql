-- Production trust-boundary cleanup.
-- Frontend PIN mode is only a local demo convenience. Supabase auth + RLS are
-- the production security boundary for operational records and private files.

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

create or replace function public.can_edit_operational_memory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'owner', 'estimator');
$$;

create or replace function public.is_shelter_prep_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'owner');
$$;

create or replace function public.normalize_review_status(value text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(nullif(trim(value), ''), 'needs_review'))
    when 'approved' then 'human_verified'
    when 'human_approved' then 'human_verified'
    when 'human_reviewed' then 'human_verified'
    when 'needs_confirmation' then 'needs_review'
    when 'draft' then 'ai_draft'
    when 'revise' then 'needs_review'
    when 'edited' then 'needs_review'
    when 'archived' then 'deprecated'
    else
      case
        when lower(value) in ('ai_draft', 'needs_review', 'human_verified', 'rejected', 'deprecated')
          then lower(value)
        else 'needs_review'
      end
  end;
$$;

insert into storage.buckets (id, name, public)
values
  ('job-files', 'job-files', false),
  ('invoices', 'invoices', false)
on conflict (id) do update
set public = false;

drop policy if exists "job files anon read public urls" on storage.objects;
drop policy if exists "job files authenticated read" on storage.objects;
create policy "job files authenticated read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-files'
  and public.current_user_role() in ('admin', 'owner', 'estimator', 'contractor')
);

drop policy if exists "invoices admin upload" on storage.objects;
create policy "invoices admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'invoices'
  and public.is_admin_or_owner()
);

drop policy if exists "invoices admin read" on storage.objects;
create policy "invoices admin read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'invoices'
  and public.is_admin_or_owner()
);

alter table public.files
  add column if not exists storage_bucket text not null default 'job-files',
  add column if not exists storage_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_size numeric;

update public.files
set storage_bucket = coalesce(nullif(storage_bucket, ''), 'job-files');

update public.files
set storage_path = split_part(split_part(file_url, '/storage/v1/object/public/' || storage_bucket || '/', 2), '?', 1)
where (storage_path is null or storage_path = '')
  and file_url like '%/storage/v1/object/public/%';

update public.files
set storage_path = split_part(split_part(file_url, '/storage/v1/object/sign/' || storage_bucket || '/', 2), '?', 1)
where (storage_path is null or storage_path = '')
  and file_url like '%/storage/v1/object/sign/%';

create index if not exists files_storage_path_idx on public.files(storage_path);

create table if not exists public.property_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid null references public.leads(id) on delete set null,
  property_id text,
  file_name text not null default '',
  file_url text,
  storage_bucket text not null default 'job-files',
  storage_path text,
  file_type text,
  mime_type text,
  file_size numeric,
  uploaded_by uuid references auth.users(id) on delete set null,
  notes text
);

alter table public.property_files
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists lead_id uuid null references public.leads(id) on delete set null,
  add column if not exists property_id text,
  add column if not exists file_name text not null default '',
  add column if not exists file_url text,
  add column if not exists storage_bucket text not null default 'job-files',
  add column if not exists storage_path text,
  add column if not exists file_type text,
  add column if not exists mime_type text,
  add column if not exists file_size numeric,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists notes text;

create index if not exists property_files_lead_id_idx on public.property_files(lead_id);
create index if not exists property_files_storage_path_idx on public.property_files(storage_path);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid null references public.leads(id) on delete set null,
  direction text,
  channel text,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  message_type text,
  message_body text not null default '',
  ai_generated boolean not null default false,
  auto_sent boolean not null default false,
  human_reviewed boolean not null default false,
  human_approved boolean not null default false,
  status text not null default 'draft',
  notes text,
  sent_at timestamptz
);

alter table public.message_logs
  add column if not exists lead_id uuid null references public.leads(id) on delete set null,
  add column if not exists direction text,
  add column if not exists channel text,
  add column if not exists recipient_name text,
  add column if not exists recipient_email text,
  add column if not exists recipient_phone text,
  add column if not exists message_type text,
  add column if not exists message_body text not null default '',
  add column if not exists ai_generated boolean not null default false,
  add column if not exists auto_sent boolean not null default false,
  add column if not exists human_reviewed boolean not null default false,
  add column if not exists human_approved boolean not null default false,
  add column if not exists status text not null default 'draft',
  add column if not exists notes text,
  add column if not exists sent_at timestamptz;

create index if not exists message_logs_lead_id_idx on public.message_logs(lead_id);
create index if not exists message_logs_status_idx on public.message_logs(status);
create index if not exists message_logs_created_at_idx on public.message_logs(created_at desc);

create table if not exists public.missing_info_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid null references public.leads(id) on delete set null,
  missing_address boolean not null default false,
  missing_photos boolean not null default false,
  missing_inspection_report boolean not null default false,
  missing_deadline boolean not null default false,
  missing_access_info boolean not null default false,
  missing_scope_clarity boolean not null default false,
  generated_message text,
  status text not null default 'draft',
  auto_send_allowed boolean not null default false,
  sent_at timestamptz,
  human_reviewed boolean not null default false
);

alter table public.missing_info_requests
  add column if not exists lead_id uuid null references public.leads(id) on delete set null,
  add column if not exists missing_address boolean not null default false,
  add column if not exists missing_photos boolean not null default false,
  add column if not exists missing_inspection_report boolean not null default false,
  add column if not exists missing_deadline boolean not null default false,
  add column if not exists missing_access_info boolean not null default false,
  add column if not exists missing_scope_clarity boolean not null default false,
  add column if not exists generated_message text,
  add column if not exists status text not null default 'draft',
  add column if not exists auto_send_allowed boolean not null default false,
  add column if not exists sent_at timestamptz,
  add column if not exists human_reviewed boolean not null default false;

create index if not exists missing_info_requests_lead_id_idx on public.missing_info_requests(lead_id);
create index if not exists missing_info_requests_status_idx on public.missing_info_requests(status);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null default '',
  file_url text,
  storage_bucket text not null default 'invoices',
  storage_path text,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  property_address text,
  extraction_status text not null default 'pending',
  extraction_error text,
  subtotal numeric,
  tax numeric,
  total numeric
);

alter table public.invoices
  add column if not exists file_name text not null default '',
  add column if not exists file_url text,
  add column if not exists storage_bucket text not null default 'invoices',
  add column if not exists storage_path text,
  add column if not exists vendor_name text,
  add column if not exists invoice_number text,
  add column if not exists invoice_date date,
  add column if not exists property_address text,
  add column if not exists extraction_status text not null default 'pending',
  add column if not exists extraction_error text,
  add column if not exists subtotal numeric,
  add column if not exists tax numeric,
  add column if not exists total numeric;

create index if not exists invoices_storage_path_idx on public.invoices(storage_path);
create index if not exists invoices_extraction_status_idx on public.invoices(extraction_status);

create table if not exists public.invoice_cost_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  risk_level text,
  summary text,
  client_summary text,
  overcharge_flags jsonb not null default '[]'::jsonb,
  scope_gaps jsonb not null default '[]'::jsonb,
  pricing_risks jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb
);

alter table public.invoice_cost_analyses
  add column if not exists invoice_id uuid references public.invoices(id) on delete cascade,
  add column if not exists risk_level text,
  add column if not exists summary text,
  add column if not exists client_summary text,
  add column if not exists overcharge_flags jsonb not null default '[]'::jsonb,
  add column if not exists scope_gaps jsonb not null default '[]'::jsonb,
  add column if not exists pricing_risks jsonb not null default '[]'::jsonb,
  add column if not exists recommended_actions jsonb not null default '[]'::jsonb;

create index if not exists invoice_cost_analyses_invoice_id_idx on public.invoice_cost_analyses(invoice_id);

create table if not exists public.material_costs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  item_name text,
  material_name text,
  normalized_name text,
  category text,
  unit text,
  low_price numeric,
  typical_price numeric,
  high_price numeric,
  current_price numeric,
  previous_price numeric,
  percent_change numeric,
  source text,
  source_url text,
  store_name text,
  zip text,
  region text,
  confidence text,
  human_verified boolean not null default false,
  last_checked timestamptz,
  notes text
);

alter table public.material_costs
  add column if not exists updated_at timestamptz,
  add column if not exists item_name text,
  add column if not exists material_name text,
  add column if not exists normalized_name text,
  add column if not exists category text,
  add column if not exists unit text,
  add column if not exists low_price numeric,
  add column if not exists typical_price numeric,
  add column if not exists high_price numeric,
  add column if not exists current_price numeric,
  add column if not exists previous_price numeric,
  add column if not exists percent_change numeric,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists store_name text,
  add column if not exists zip text,
  add column if not exists region text,
  add column if not exists confidence text,
  add column if not exists human_verified boolean not null default false,
  add column if not exists last_checked timestamptz,
  add column if not exists notes text;

create index if not exists material_costs_normalized_name_idx on public.material_costs(normalized_name);
create index if not exists material_costs_human_verified_idx on public.material_costs(human_verified);

alter table public.seller_prep_items
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (partition by analysis_id order by created_at, id) as rn
  from public.seller_prep_items
)
update public.seller_prep_items spi
set sort_order = ranked.rn
from ranked
where spi.id = ranked.id
  and coalesce(spi.sort_order, 0) = 0;

create index if not exists seller_prep_items_sort_order_idx on public.seller_prep_items(analysis_id, sort_order);

do $$
declare
  legacy record;
begin
  for legacy in
    select * from (values
      ('estimate_items', 'pilot can manage estimate items'),
      ('estimate_research', 'pilot can manage estimate research'),
      ('material_package_estimates', 'pilot can manage material package estimates'),
      ('job_execution_steps', 'pilot can manage job execution steps'),
      ('job_execution_step_learning', 'pilot can manage job execution learning'),
      ('ai_research_drafts', 'pilot can manage ai research drafts'),
      ('job_packets', 'pilot can manage job packets'),
      ('seller_prep_analyses', 'pilot can manage seller prep analyses'),
      ('seller_prep_items', 'pilot can manage seller prep items'),
      ('pricing_memory_entries', 'pilot can manage pricing memory'),
      ('property_intelligence_agent_outputs', 'pilot can manage property intelligence agent outputs'),
      ('material_review_memory', 'pilot can manage material review memory'),
      ('human_pricing_memory', 'pilot can manage human pricing memory'),
      ('photo_field_memory', 'pilot can manage photo field memory'),
      ('agent_learning_events', 'pilot can manage agent learning events'),
      ('agent_learning_rules', 'pilot can manage agent learning rules'),
      ('agent_memory_conflicts', 'pilot can manage agent memory conflicts'),
      ('agent_memory_audit_log', 'pilot can manage agent memory audit log'),
      ('agent_rule_applications', 'pilot can manage agent rule applications')
    ) as p(table_name, policy_name)
  loop
    if to_regclass('public.' || legacy.table_name) is not null then
      execute format('drop policy if exists %I on public.%I', legacy.policy_name, legacy.table_name);
    end if;
  end loop;
end $$;

do $$
declare
  target record;
  constraint_row record;
begin
  for target in
    select * from (values
      ('estimate_items', 'review_status'),
      ('estimate_items', 'status'),
      ('estimate_research', 'review_status'),
      ('estimate_research', 'status'),
      ('material_package_estimates', 'review_status'),
      ('material_package_estimates', 'package_status'),
      ('job_execution_steps', 'status'),
      ('ai_research_drafts', 'human_review_status'),
      ('job_packets', 'review_status'),
      ('seller_prep_analyses', 'human_review_status'),
      ('seller_prep_items', 'human_review_status'),
      ('property_intelligence_agent_outputs', 'status'),
      ('property_media_analysis', 'review_status'),
      ('property_media_findings', 'review_status'),
      ('source_lessons', 'human_review_status'),
      ('photo_field_memory', 'status')
    ) as t(table_name, column_name)
  loop
    if to_regclass('public.' || target.table_name) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target.table_name
          and column_name = target.column_name
      ) then
      for constraint_row in
        select conname
        from pg_constraint c
        join pg_class r on r.oid = c.conrelid
        join pg_namespace n on n.oid = r.relnamespace
        where n.nspname = 'public'
          and r.relname = target.table_name
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%' || target.column_name || '%'
      loop
        execute format('alter table public.%I drop constraint if exists %I', target.table_name, constraint_row.conname);
      end loop;
    end if;
  end loop;
end $$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('estimate_items', 'review_status'),
      ('estimate_items', 'status'),
      ('estimate_research', 'review_status'),
      ('estimate_research', 'status'),
      ('material_package_estimates', 'review_status'),
      ('material_package_estimates', 'package_status'),
      ('job_execution_steps', 'status'),
      ('ai_research_drafts', 'human_review_status'),
      ('job_packets', 'review_status'),
      ('seller_prep_analyses', 'human_review_status'),
      ('seller_prep_items', 'human_review_status'),
      ('property_intelligence_agent_outputs', 'status'),
      ('property_media_analysis', 'review_status'),
      ('property_media_findings', 'review_status'),
      ('source_lessons', 'human_review_status'),
      ('photo_field_memory', 'status')
    ) as t(table_name, column_name)
  loop
    if to_regclass('public.' || target.table_name) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target.table_name
          and column_name = target.column_name
      ) then
      execute format(
        'update public.%I set %I = public.normalize_review_status(%I) where %I is not null',
        target.table_name,
        target.column_name,
        target.column_name,
        target.column_name
      );
      execute format(
        'alter table public.%I add constraint %I check (%I in (''ai_draft'', ''needs_review'', ''human_verified'', ''rejected'', ''deprecated'')) not valid',
        target.table_name,
        target.table_name || '_' || target.column_name || '_standard_check',
        target.column_name
      );
    end if;
  end loop;
end $$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('estimate_items'),
      ('estimate_research'),
      ('material_package_estimates'),
      ('job_execution_steps'),
      ('job_execution_step_learning'),
      ('ai_research_drafts'),
      ('job_packets'),
      ('seller_prep_analyses'),
      ('seller_prep_items'),
      ('pricing_memory_entries'),
      ('property_intelligence_agent_outputs'),
      ('material_review_memory'),
      ('human_pricing_memory'),
      ('photo_field_memory'),
      ('agent_learning_events'),
      ('agent_learning_rules'),
      ('agent_memory_conflicts'),
      ('agent_memory_audit_log'),
      ('agent_rule_applications'),
      ('property_files'),
      ('message_logs'),
      ('missing_info_requests'),
      ('invoices'),
      ('invoice_cost_analyses'),
      ('material_costs')
    ) as t(table_name)
  loop
    if to_regclass('public.' || target.table_name) is not null then
      execute format('alter table public.%I enable row level security', target.table_name);

      execute format('drop policy if exists "pilot can manage %s" on public.%I', replace(target.table_name, '_', ' '), target.table_name);
      execute format('drop policy if exists "operational %s read" on public.%I', target.table_name, target.table_name);
      execute format('drop policy if exists "operational %s insert" on public.%I', target.table_name, target.table_name);
      execute format('drop policy if exists "operational %s update" on public.%I', target.table_name, target.table_name);
      execute format('drop policy if exists "operational %s delete" on public.%I', target.table_name, target.table_name);

      execute format(
        'create policy "operational %s read" on public.%I for select to authenticated using (public.current_user_role() in (''admin'', ''owner'', ''estimator''))',
        target.table_name,
        target.table_name
      );
      execute format(
        'create policy "operational %s insert" on public.%I for insert to authenticated with check (public.is_admin_or_owner())',
        target.table_name,
        target.table_name
      );
      execute format(
        'create policy "operational %s update" on public.%I for update to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())',
        target.table_name,
        target.table_name
      );
      execute format(
        'create policy "operational %s delete" on public.%I for delete to authenticated using (public.is_admin_or_owner())',
        target.table_name,
        target.table_name
      );
    end if;
  end loop;
end $$;
