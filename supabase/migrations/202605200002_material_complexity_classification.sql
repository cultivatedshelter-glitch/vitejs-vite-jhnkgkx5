-- Material List Complexity Classification
-- Adds review metadata for generated material rows.

alter table public.estimate_items
  add column if not exists material_complexity text
    check (material_complexity in ('small_simple', 'medium_defined', 'large_complex', 'unknown_needs_review')),
  add column if not exists quantity_low numeric,
  add column if not exists quantity_high numeric,
  add column if not exists required_optional text not null default 'required'
    check (required_optional in ('required', 'optional', 'review')),
  add column if not exists admin_editable boolean not null default true,
  add column if not exists material_review_notes text;

create index if not exists estimate_items_material_complexity_idx
  on public.estimate_items(material_complexity);
