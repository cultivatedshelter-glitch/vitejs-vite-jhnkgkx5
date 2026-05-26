-- Inspection Intelligence workflow tables.
-- Property-centered records for inspection reports, findings, operational repair bundles,
-- repair items, review events, seller reports, and contractor scope packets.
-- AI rows stay draft/needs_review until an admin or owner reviews them.

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  source_file_id uuid references public.files(id) on delete set null,
  report_type text not null default 'inspection_report',
  report_source text,
  property_address text,
  inspection_date date,
  inspector_name text,
  inspector_company text,
  executive_summary text,
  estimate_confidence text not null default 'low',
  human_review_status text not null default 'ai_draft'
    check (human_review_status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create table if not exists public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  inspection_report_id uuid references public.inspection_reports(id) on delete cascade,
  property_id bigint references public.properties(id) on delete cascade,
  source_text text not null,
  category text,
  trade text,
  location text,
  severity text,
  urgency text,
  likely_hidden_damage text,
  buyer_seller_concern_level text,
  repair_vs_credit_recommendation text,
  missing_information_questions text[] not null default '{}',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create table if not exists public.repair_bundles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  inspection_report_id uuid references public.inspection_reports(id) on delete cascade,
  title text not null,
  system_category text,
  summary text,
  risk_explanation text,
  recommended_trade text,
  priority text,
  estimate_low numeric,
  estimate_high numeric,
  confidence text not null default 'low',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create table if not exists public.repair_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  inspection_report_id uuid references public.inspection_reports(id) on delete cascade,
  repair_bundle_id uuid references public.repair_bundles(id) on delete set null,
  source_text text not null,
  category text,
  trade text,
  description text not null,
  location text,
  severity text,
  urgency text,
  buyer_impact_score numeric,
  inspection_risk_score numeric,
  recommendation text
    check (recommendation in ('repair_before_listing', 'buyer_credit', 'optional', 'monitor', 'contractor_review')),
  estimate_low numeric,
  estimate_high numeric,
  confidence text not null default 'low',
  missing_info text[] not null default '{}',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  target_table text not null,
  target_id uuid,
  action text not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  previous_status text,
  next_status text,
  notes text
);

create table if not exists public.seller_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  summary text,
  priority_repair_roadmap text[] not null default '{}',
  buyer_credit_candidates text[] not null default '{}',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create table if not exists public.contractor_scope_packets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  property_id bigint references public.properties(id) on delete cascade,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  trade text,
  scope_summary text,
  included_repair_item_ids uuid[] not null default '{}',
  missing_information_questions text[] not null default '{}',
  status text not null default 'ai_draft'
    check (status in ('ai_draft', 'needs_review', 'approved', 'rejected')),
  admin_notes text
);

create index if not exists inspection_reports_property_idx on public.inspection_reports(property_id);
create index if not exists inspection_findings_report_idx on public.inspection_findings(inspection_report_id);
create index if not exists repair_bundles_property_idx on public.repair_bundles(property_id);
create index if not exists repair_items_bundle_idx on public.repair_items(repair_bundle_id);
create index if not exists review_events_property_idx on public.review_events(property_id);
create index if not exists seller_reports_property_idx on public.seller_reports(property_id);
create index if not exists contractor_scope_packets_property_idx on public.contractor_scope_packets(property_id);

alter table public.inspection_reports enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.repair_bundles enable row level security;
alter table public.repair_items enable row level security;
alter table public.review_events enable row level security;
alter table public.seller_reports enable row level security;
alter table public.contractor_scope_packets enable row level security;

-- Keep policies narrow: admin/owner manage; estimator can read draft records only.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inspection_reports',
    'inspection_findings',
    'repair_bundles',
    'repair_items',
    'review_events',
    'seller_reports',
    'contractor_scope_packets'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || ' admin manage', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())',
      table_name || ' admin manage',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || ' estimator read drafts', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.current_user_role() in (''admin'', ''owner'', ''estimator''))',
      table_name || ' estimator read drafts',
      table_name
    );
  end loop;
end $$;
