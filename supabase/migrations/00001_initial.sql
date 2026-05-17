create table services (
  slug text primary key,
  name text not null,
  short_name text not null,
  description text not null,
  quote_mode text not null default 'instant',
  unit text not null,
  unit_label text not null,
  size_label text not null,
  size_options jsonb not null
);

create table cost_inputs (
  service_slug text primary key references services(slug),
  hourly_labor_rate numeric not null,
  material_cost_per_unit numeric not null,
  equipment_wear_per_hour numeric not null default 0,
  hours_per_unit numeric not null,
  drive_reserve_minutes numeric not null default 30,
  overhead_pct numeric not null default 0.15,
  min_margin_pct numeric not null default 0.30,
  service_minimum numeric not null default 225,
  deposit_threshold numeric not null default 900,
  buffer_active boolean not null default true,
  source text not null default 'industry_default',
  updated_at timestamptz not null default now()
);

create table competitor_prices (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null references services(slug),
  competitor_name text not null,
  zip_or_region text not null,
  price_low numeric not null,
  price_median numeric not null,
  price_high numeric not null,
  unit text not null,
  source_url text not null,
  observed_date date not null,
  created_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  preferred_contact_method text not null default 'text',
  source text not null,
  property_type text not null default 'single_family',
  address_street text not null,
  address_city text not null,
  address_zip text not null,
  service_slug text not null references services(slug),
  job_size numeric not null,
  job_size_label text not null,
  service_lines jsonb not null default '[]'::jsonb,
  stories int not null,
  urgency text not null,
  risk_profile jsonb not null default '{}'::jsonb,
  service_details jsonb not null default '{}'::jsonb,
  photo_attachments jsonb not null default '[]'::jsonb,
  preferred_windows jsonb not null default '[]'::jsonb,
  notes text,
  internal_notes text not null default '',
  status text not null default 'pending',
  estimate jsonb not null,
  final_quote_amount numeric,
  send_review jsonb,
  follow_ups jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  outcome_check_date date,
  approval jsonb,
  photos_requested_at timestamptz,
  expires_at timestamptz,
  duplicate_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table outcomes (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id),
  outcome text not null,
  amount numeric,
  amount_explicit boolean not null default false,
  source text not null,
  notes text,
  actuals jsonb,
  created_at timestamptz not null default now()
);

create table decision_log (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  evidence text not null,
  next_review text not null,
  created_at timestamptz not null default now()
);

create index quotes_status_created_idx on quotes(status, created_at desc);
create index quotes_zip_idx on quotes(address_zip);
create index quotes_outcome_check_idx on quotes(outcome_check_date) where outcome_check_date is not null;
create index outcomes_quote_idx on outcomes(quote_id, created_at desc);
create index competitor_prices_lookup_idx on competitor_prices(service_slug, zip_or_region);
