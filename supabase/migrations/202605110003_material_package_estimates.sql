-- Material package estimates for reviewable estimate line items.
-- Safe to re-run. This creates the base tables when missing and adds every
-- package/review/research column the app expects with IF NOT EXISTS.

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  research_id text,
  lead_id text,
  created_at timestamptz not null default now(),
  property_id text,
  job_id text,
  request_id text,
  repair_item_id text,
  item_name text not null default '',
  category text,
  source text,
  source_url text,
  quantity numeric,
  unit_price numeric,
  original_unit_price numeric,
  total_price numeric,
  required_quantity numeric,
  required_unit text,
  package_size numeric,
  package_unit text,
  package_coverage numeric,
  package_coverage_unit text,
  packages_needed numeric,
  package_price numeric,
  extended_total numeric,
  quantity_reason text,
  scope_source text,
  relevance_reason text,
  source_status text not null default 'needs_source_review',
  review_status text not null default 'needs_review',
  status text not null default 'needs_review',
  rejection_reason text,
  admin_notes text,
  confidence text,
  human_approved boolean not null default false
);

alter table public.estimate_items
  add column if not exists research_id text,
  add column if not exists lead_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists property_id text,
  add column if not exists job_id text,
  add column if not exists request_id text,
  add column if not exists repair_item_id text,
  add column if not exists item_name text not null default '',
  add column if not exists category text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists quantity numeric,
  add column if not exists unit_price numeric,
  add column if not exists original_unit_price numeric,
  add column if not exists total_price numeric,
  add column if not exists required_quantity numeric,
  add column if not exists required_unit text,
  add column if not exists package_size numeric,
  add column if not exists package_unit text,
  add column if not exists package_coverage numeric,
  add column if not exists package_coverage_unit text,
  add column if not exists packages_needed numeric,
  add column if not exists package_price numeric,
  add column if not exists extended_total numeric,
  add column if not exists quantity_reason text,
  add column if not exists scope_source text,
  add column if not exists relevance_reason text,
  add column if not exists source_status text not null default 'needs_source_review',
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists status text not null default 'needs_review',
  add column if not exists rejection_reason text,
  add column if not exists admin_notes text,
  add column if not exists confidence text,
  add column if not exists human_approved boolean not null default false;

create index if not exists estimate_items_lead_id_idx on public.estimate_items(lead_id);
create index if not exists estimate_items_property_id_idx on public.estimate_items(property_id);
create index if not exists estimate_items_job_id_idx on public.estimate_items(job_id);
create index if not exists estimate_items_request_id_idx on public.estimate_items(request_id);
create index if not exists estimate_items_repair_item_id_idx on public.estimate_items(repair_item_id);
create index if not exists estimate_items_review_status_idx on public.estimate_items(review_status);
create index if not exists estimate_items_status_idx on public.estimate_items(status);
create index if not exists estimate_items_source_status_idx on public.estimate_items(source_status);

create table if not exists public.estimate_research (
  id uuid primary key default gen_random_uuid(),
  lead_id text,
  created_at timestamptz not null default now(),
  status text not null default 'ai_draft',
  source text,
  search_query text,
  screenshot_url text,
  screenshot_file_reference text,
  source_url text,
  notes text,
  human_approved boolean not null default false,
  review_status text not null default 'needs_review',
  admin_notes text
);

alter table public.estimate_research
  add column if not exists lead_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists status text not null default 'ai_draft',
  add column if not exists source text,
  add column if not exists search_query text,
  add column if not exists screenshot_url text,
  add column if not exists screenshot_file_reference text,
  add column if not exists source_url text,
  add column if not exists notes text,
  add column if not exists human_approved boolean not null default false,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists admin_notes text;

create index if not exists estimate_research_lead_id_idx on public.estimate_research(lead_id);
create index if not exists estimate_research_status_idx on public.estimate_research(status);
create index if not exists estimate_research_review_status_idx on public.estimate_research(review_status);

create table if not exists public.material_package_estimates (
  id uuid primary key default gen_random_uuid(),
  lead_id text,
  property_id text,
  job_id text,
  request_id text,
  repair_item_id text,
  created_at timestamptz not null default now(),
  package_status text not null default 'needs_review',
  review_status text not null default 'needs_review',
  source_status text not null default 'needs_source_review',
  package_summary text,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.material_package_estimates
  add column if not exists lead_id text,
  add column if not exists property_id text,
  add column if not exists job_id text,
  add column if not exists request_id text,
  add column if not exists repair_item_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists package_status text not null default 'needs_review',
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists source_status text not null default 'needs_source_review',
  add column if not exists package_summary text,
  add column if not exists admin_notes text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists material_package_estimates_lead_idx on public.material_package_estimates(lead_id);
create index if not exists material_package_estimates_job_idx on public.material_package_estimates(job_id);
create index if not exists material_package_estimates_review_status_idx on public.material_package_estimates(review_status);

alter table public.estimate_items enable row level security;
alter table public.estimate_research enable row level security;
alter table public.material_package_estimates enable row level security;

drop policy if exists "pilot can manage estimate items" on public.estimate_items;
create policy "pilot can manage estimate items"
on public.estimate_items
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage estimate research" on public.estimate_research;
create policy "pilot can manage estimate research"
on public.estimate_research
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage material package estimates" on public.material_package_estimates;
create policy "pilot can manage material package estimates"
on public.material_package_estimates
for all
to anon, authenticated
using (true)
with check (true);
