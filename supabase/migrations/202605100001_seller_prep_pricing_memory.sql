create table if not exists seller_prep_analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references leads(id) on delete set null,
  property_address text,
  summary text,
  total_low_estimate numeric,
  total_high_estimate numeric,
  seller_net_impact text,
  confidence text,
  human_review_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seller_prep_analyses
  add column if not exists lead_id uuid null references leads(id) on delete set null,
  add column if not exists property_address text,
  add column if not exists summary text,
  add column if not exists total_low_estimate numeric,
  add column if not exists total_high_estimate numeric,
  add column if not exists seller_net_impact text,
  add column if not exists confidence text,
  add column if not exists human_review_status text not null default 'draft',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists seller_prep_analyses_lead_id_idx on seller_prep_analyses(lead_id);
create index if not exists seller_prep_analyses_human_review_status_idx on seller_prep_analyses(human_review_status);

create table if not exists seller_prep_items (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references seller_prep_analyses(id) on delete cascade,
  repair_item text not null,
  trade_category text,
  estimated_low numeric,
  estimated_high numeric,
  buyer_impact_score int,
  inspection_risk_score int,
  recommendation text,
  missing_info text,
  ai_notes text,
  human_review_status text not null default 'needs_review',
  created_at timestamptz not null default now()
);

alter table seller_prep_items
  add column if not exists analysis_id uuid references seller_prep_analyses(id) on delete cascade,
  add column if not exists repair_item text,
  add column if not exists trade_category text,
  add column if not exists estimated_low numeric,
  add column if not exists estimated_high numeric,
  add column if not exists buyer_impact_score int,
  add column if not exists inspection_risk_score int,
  add column if not exists recommendation text,
  add column if not exists missing_info text,
  add column if not exists ai_notes text,
  add column if not exists human_review_status text not null default 'needs_review';

create index if not exists seller_prep_items_analysis_id_idx on seller_prep_items(analysis_id);
create index if not exists seller_prep_items_human_review_status_idx on seller_prep_items(human_review_status);

create table if not exists pricing_memory_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_project_id uuid,
  source_line_item_id uuid,
  trade text,
  repair_type text,
  item_name text,
  description text,
  city text,
  state text,
  zip text,
  property_type text,
  category text,
  quantity numeric,
  unit text,
  unit_cost numeric,
  verified_price numeric,
  labor_cost numeric,
  material_cost numeric,
  total_cost numeric,
  markup_percent numeric,
  source text,
  confidence_level text,
  human_verified boolean not null default false,
  notes text,
  last_checked timestamptz
);

alter table pricing_memory_entries
  add column if not exists source_project_id uuid,
  add column if not exists source_line_item_id uuid,
  add column if not exists trade text,
  add column if not exists repair_type text,
  add column if not exists item_name text,
  add column if not exists description text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists property_type text,
  add column if not exists category text,
  add column if not exists quantity numeric,
  add column if not exists unit text,
  add column if not exists unit_cost numeric,
  add column if not exists verified_price numeric,
  add column if not exists labor_cost numeric,
  add column if not exists material_cost numeric,
  add column if not exists total_cost numeric,
  add column if not exists markup_percent numeric,
  add column if not exists source text,
  add column if not exists confidence_level text,
  add column if not exists human_verified boolean not null default false,
  add column if not exists notes text,
  add column if not exists last_checked timestamptz;

create index if not exists pricing_memory_entries_item_name_idx on pricing_memory_entries(item_name);
create index if not exists pricing_memory_entries_trade_idx on pricing_memory_entries(trade);
create index if not exists pricing_memory_entries_zip_idx on pricing_memory_entries(zip);
create index if not exists pricing_memory_entries_human_verified_idx on pricing_memory_entries(human_verified);

alter table seller_prep_analyses enable row level security;
alter table seller_prep_items enable row level security;
alter table pricing_memory_entries enable row level security;

drop policy if exists "pilot can manage seller prep analyses" on seller_prep_analyses;
create policy "pilot can manage seller prep analyses"
on seller_prep_analyses
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage seller prep items" on seller_prep_items;
create policy "pilot can manage seller prep items"
on seller_prep_items
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pilot can manage pricing memory" on pricing_memory_entries;
create policy "pilot can manage pricing memory"
on pricing_memory_entries
for all
to anon, authenticated
using (true)
with check (true);
