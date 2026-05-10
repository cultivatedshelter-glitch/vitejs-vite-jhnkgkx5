create table if not exists property_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  normalized_address text not null unique,
  address text not null,
  city text,
  state text,
  zip text,

  bedrooms text,
  bathrooms text,
  square_feet text,
  lot_size text,
  year_built text,
  property_type text,
  jurisdiction text,
  zoning text,
  parcel_number text,
  assessor_url text,
  permit_url text,
  map_url text,

  verified boolean not null default false,
  verified_at timestamptz,
  verified_by text,
  verification_notes text,

  source text not null default 'manual',
  confidence text not null default 'needs_review',
  raw_data jsonb not null default '{}'::jsonb
);

create index if not exists property_profiles_zip_idx on property_profiles (zip);
create index if not exists property_profiles_city_idx on property_profiles (city);

alter table leads
  add column if not exists property_profile_id uuid references property_profiles(id),
  add column if not exists property_facts jsonb not null default '{}'::jsonb,
  add column if not exists property_verified boolean not null default false,
  add column if not exists property_jurisdiction text,
  add column if not exists property_type text,
  add column if not exists zoning text,
  add column if not exists parcel_number text;

create table if not exists contractor_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  business_name text not null,
  slug text not null unique,
  contact_name text,
  email text,
  phone text,
  website text,
  license_number text,
  insurance_status text not null default 'needs_review',
  trades text[] not null default '{}',
  service_areas text[] not null default '{}',
  profile_summary text,
  public_profile_enabled boolean not null default true,
  qr_intake_url text,

  trust_tier text not null default 'bronze',
  trust_score numeric,
  response_speed_score numeric,
  communication_score numeric,
  repeat_client_rate numeric,
  vetting_notes text
);

alter table leads
  add column if not exists contractor_profile_id uuid references contractor_profiles(id),
  add column if not exists intake_source text,
  add column if not exists intake_slug text;
