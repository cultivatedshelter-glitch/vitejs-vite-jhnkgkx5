create table if not exists historical_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  project_type text not null,
  city text,
  state text not null default 'OR',
  zip text,
  property_type text,

  estimated_amount numeric,
  final_invoice_amount numeric,
  notes text,

  customer_name text,
  customer_visible boolean not null default false,
  anonymized boolean not null default true,

  review_status text not null default 'needs_human_review'
    check (review_status in ('needs_human_review', 'reviewed', 'human_verified', 'archived')),
  human_verified boolean not null default false,

  extraction_status text not null default 'not_started'
    check (extraction_status in ('not_started', 'needs_human_review', 'reviewed', 'failed', 'complete')),
  extraction_notes text,
  raw_extraction jsonb not null default '{}'::jsonb
);

create index if not exists historical_projects_project_type_idx on historical_projects(project_type);
create index if not exists historical_projects_zip_idx on historical_projects(zip);
create index if not exists historical_projects_review_status_idx on historical_projects(review_status);
create index if not exists historical_projects_human_verified_idx on historical_projects(human_verified);

create table if not exists historical_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references historical_projects(id) on delete cascade,
  created_at timestamptz not null default now(),

  file_type text not null default 'invoice_or_estimate'
    check (file_type in ('estimate_pdf', 'invoice_pdf', 'change_order', 'receipt', 'invoice_or_estimate', 'other')),
  file_name text not null,
  storage_bucket text not null default 'historical-project-files',
  storage_path text not null,
  notes text,

  extraction_status text not null default 'not_started'
    check (extraction_status in ('not_started', 'needs_human_review', 'reviewed', 'failed', 'complete')),
  human_verified boolean not null default false
);

create index if not exists historical_project_files_project_idx on historical_project_files(project_id);
create index if not exists historical_project_files_file_type_idx on historical_project_files(file_type);

create table if not exists historical_project_line_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references historical_projects(id) on delete cascade,
  created_at timestamptz not null default now(),

  category text,
  trade text,
  description text,
  quantity numeric,
  unit text,
  unit_cost numeric,
  labor_cost numeric,
  material_cost numeric,
  total_cost numeric,
  markup_percent numeric,

  source text not null default 'manual'
    check (source in ('manual', 'extracted', 'imported')),
  confidence_level text not null default 'low'
    check (confidence_level in ('low', 'medium', 'high')),
  review_status text not null default 'needs_human_review'
    check (review_status in ('needs_human_review', 'reviewed', 'human_verified')),
  human_verified boolean not null default false,
  notes text
);

create index if not exists historical_project_line_items_project_idx on historical_project_line_items(project_id);
create index if not exists historical_project_line_items_trade_idx on historical_project_line_items(trade);
create index if not exists historical_project_line_items_review_status_idx on historical_project_line_items(review_status);

create table if not exists historical_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references historical_projects(id) on delete cascade,
  created_at timestamptz not null default now(),

  title text not null,
  description text,
  reason text,
  amount numeric,
  approved boolean not null default false,
  date_approved date,
  notes text,
  human_verified boolean not null default false
);

create index if not exists historical_change_orders_project_idx on historical_change_orders(project_id);

create table if not exists pricing_memory_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  source_project_id uuid not null references historical_projects(id) on delete cascade,
  source_line_item_id uuid references historical_project_line_items(id) on delete set null,

  trade text,
  repair_type text,
  item_name text,
  description text,
  city text,
  state text,
  zip text,
  property_type text,

  quantity numeric,
  unit text,
  unit_cost numeric,
  labor_cost numeric,
  material_cost numeric,
  total_cost numeric,
  markup_percent numeric,

  confidence_level text not null default 'low'
    check (confidence_level in ('low', 'medium', 'high')),
  human_verified boolean not null default true,
  notes text
);

create index if not exists pricing_memory_entries_source_project_idx on pricing_memory_entries(source_project_id);
create index if not exists pricing_memory_entries_trade_idx on pricing_memory_entries(trade);
create index if not exists pricing_memory_entries_zip_idx on pricing_memory_entries(zip);

insert into storage.buckets (id, name, public)
values ('historical-project-files', 'historical-project-files', false)
on conflict (id) do nothing;

create policy "historical project files can be uploaded during pilot"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'historical-project-files');

create policy "historical project files can be read during pilot"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'historical-project-files');
