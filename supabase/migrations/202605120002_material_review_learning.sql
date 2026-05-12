-- Material review safety and learning memory.
-- Pricing memory can support prices only after a material is already tied to
-- the current property/job/repair scope. Rejected records are retained as
-- negative learning and must not become approved suggestions.

alter table public.estimate_items
  add column if not exists property_id text,
  add column if not exists job_id text,
  add column if not exists request_id text,
  add column if not exists repair_item_id text,
  add column if not exists scope_source text,
  add column if not exists relevance_reason text,
  add column if not exists original_unit_price numeric,
  add column if not exists rejection_reason text,
  add column if not exists admin_notes text;

create index if not exists estimate_items_property_id_idx on public.estimate_items(property_id);
create index if not exists estimate_items_job_id_idx on public.estimate_items(job_id);
create index if not exists estimate_items_request_id_idx on public.estimate_items(request_id);
create index if not exists estimate_items_repair_item_id_idx on public.estimate_items(repair_item_id);

create table if not exists public.material_review_memory (
  id uuid primary key default gen_random_uuid(),
  property_id text,
  job_id text,
  request_id text,
  repair_item_id text,
  work_type text,
  repair_description text,
  material_name text not null,
  vendor_source text,
  source_url text,
  original_unit_price numeric,
  reviewed_unit_price numeric,
  quantity numeric,
  final_total numeric,
  admin_action text not null
    check (admin_action in ('approved', 'rejected', 'edited', 'added', 'saved_for_next_time')),
  rejection_reason text,
  admin_notes text,
  confidence_before text,
  confidence_after text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now()
);

create index if not exists material_review_memory_property_idx on public.material_review_memory(property_id);
create index if not exists material_review_memory_job_idx on public.material_review_memory(job_id);
create index if not exists material_review_memory_repair_item_idx on public.material_review_memory(repair_item_id);
create index if not exists material_review_memory_material_name_idx on public.material_review_memory(material_name);
create index if not exists material_review_memory_admin_action_idx on public.material_review_memory(admin_action);

alter table public.material_review_memory enable row level security;

drop policy if exists "pilot can manage material review memory" on public.material_review_memory;
create policy "pilot can manage material review memory"
on public.material_review_memory
for all
to anon, authenticated
using (true)
with check (true);
