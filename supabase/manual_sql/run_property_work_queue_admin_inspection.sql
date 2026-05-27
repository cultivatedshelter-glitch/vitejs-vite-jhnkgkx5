-- Property Work Queue admin editing + inspection extraction support.
-- Adds property-centered records for PDF extraction summaries, admin notes, and scope interpretations.
-- Does not drop tables, functions, or disable RLS.

create table if not exists public.inspection_extractions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  property_id bigint references public.properties(id) on delete cascade,
  source_file_id uuid references public.files(id) on delete set null,
  file_name text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracting_pdf', 'inspection_review_drafted', 'needs_human_review', 'human_verified', 'extraction_failed')),
  payload_bytes numeric,
  extracted_text text,
  extraction_summary text,
  human_review_status text not null default 'ai_draft'
    check (human_review_status in ('ai_draft', 'needs_review', 'approved', 'rejected', 'human_verified')),
  admin_notes text
);

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  property_id bigint references public.properties(id) on delete cascade,
  note_type text not null default 'internal'
    check (note_type in ('internal', 'agent-facing', 'contractor-facing')),
  body text not null,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  author_label text
);

create table if not exists public.scope_interpretations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  property_id bigint references public.properties(id) on delete cascade,
  scope_interpretation text,
  missing_information text,
  internal_notes text,
  agent_facing_notes text,
  contractor_facing_notes text,
  human_review_status text not null default 'needs_review'
    check (human_review_status in ('ai_draft', 'needs_review', 'approved', 'rejected', 'human_verified'))
);

create index if not exists inspection_extractions_lead_id_idx on public.inspection_extractions(lead_id);
create index if not exists inspection_extractions_property_id_idx on public.inspection_extractions(property_id);
create index if not exists admin_notes_lead_id_idx on public.admin_notes(lead_id);
create index if not exists admin_notes_property_id_idx on public.admin_notes(property_id);
create index if not exists scope_interpretations_lead_id_idx on public.scope_interpretations(lead_id);
create index if not exists scope_interpretations_property_id_idx on public.scope_interpretations(property_id);

alter table public.inspection_extractions enable row level security;
alter table public.admin_notes enable row level security;
alter table public.scope_interpretations enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inspection_extractions',
    'admin_notes',
    'scope_interpretations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || ' admin owner manage', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner())',
      table_name || ' admin owner manage',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || ' estimator read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.current_user_role() in (''admin'', ''owner'', ''estimator''))',
      table_name || ' estimator read',
      table_name
    );
  end loop;
end $$;
