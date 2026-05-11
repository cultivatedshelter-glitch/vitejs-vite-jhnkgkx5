-- Material estimate package math for reviewable line items.
-- Existing estimate_items rows remain valid; these fields explain how the
-- required job quantity maps to real product/package quantities.

alter table public.estimate_items
  add column if not exists category text,
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
  add column if not exists source_status text not null default 'needs_source_review',
  add column if not exists review_status text not null default 'needs_review';

create index if not exists estimate_items_review_status_idx on public.estimate_items(review_status);
create index if not exists estimate_items_source_status_idx on public.estimate_items(source_status);
