-- ============================================
-- DRIFT — Catalog Schema (Travel Data Pipeline)
-- ============================================

-- ============================================
-- CATALOG DESTINATIONS
-- Master list of destinations we've processed
-- ============================================
create table public.catalog_destinations (
  id uuid default uuid_generate_v4() primary key,
  city text not null,
  country text not null,
  vibes text[] default '{}',
  description text,
  cover_image text,
  best_months text[] default '{}',
  avg_budget_per_day jsonb default '{"budget": 50, "mid": 120, "luxury": 350}',
  currency text default 'USD',
  language text,
  timezone text,
  status text default 'draft' check (status in ('draft', 'processing', 'active', 'archived')),
  pipeline_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index idx_catalog_dest_city on public.catalog_destinations(lower(city), lower(country));

-- ============================================
-- CATALOG HOTELS
-- ============================================
create table public.catalog_hotels (
  id uuid default uuid_generate_v4() primary key,
  destination_id uuid references public.catalog_destinations(id) on delete cascade not null,
  name text not null,
  description text,
  detail text,
  category text default 'hotel' check (category in ('hotel', 'resort', 'hostel', 'villa', 'boutique')),
  price_per_night text,
  price_level text check (price_level in ('budget', 'mid', 'luxury')),
  rating numeric(2,1),
  vibes text[] default '{}',
  amenities text[] default '{}',
  image_url text,
  location text,
  booking_url text,
  source text default 'ai',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_catalog_hotels_dest on public.catalog_hotels(destination_id);
create index idx_catalog_hotels_vibe on public.catalog_hotels using gin(vibes);

-- ============================================
-- CATALOG ACTIVITIES
-- ============================================
create table public.catalog_activities (
  id uuid default uuid_generate_v4() primary key,
  destination_id uuid references public.catalog_destinations(id) on delete cascade not null,
  name text not null,
  description text,
  detail text,
  category text default 'sightseeing' check (category in ('sightseeing', 'adventure', 'cultural', 'nightlife', 'wellness', 'nature', 'food_tour', 'water_sport', 'shopping', 'event')),
  price text,
  duration text,
  vibes text[] default '{}',
  best_time text,
  image_url text,
  location text,
  booking_url text,
  source text default 'ai',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_catalog_activities_dest on public.catalog_activities(destination_id);
create index idx_catalog_activities_vibe on public.catalog_activities using gin(vibes);

-- ============================================
-- CATALOG RESTAURANTS
-- ============================================
create table public.catalog_restaurants (
  id uuid default uuid_generate_v4() primary key,
  destination_id uuid references public.catalog_destinations(id) on delete cascade not null,
  name text not null,
  description text,
  detail text,
  cuisine text,
  price_level text check (price_level in ('budget', 'mid', 'luxury')),
  avg_cost text,
  vibes text[] default '{}',
  must_try text[] default '{}',
  image_url text,
  location text,
  booking_url text,
  source text default 'ai',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_catalog_restaurants_dest on public.catalog_restaurants(destination_id);

-- ============================================
-- CATALOG ITINERARY TEMPLATES
-- Pre-built day-by-day plans per destination+vibe
-- ============================================
create table public.catalog_templates (
  id uuid default uuid_generate_v4() primary key,
  destination_id uuid references public.catalog_destinations(id) on delete cascade not null,
  name text not null,
  vibes text[] default '{}',
  budget_level text default 'mid' check (budget_level in ('budget', 'mid', 'luxury')),
  duration_days int default 5,
  items jsonb not null default '[]',
  created_at timestamptz default now()
);

create index idx_catalog_templates_dest on public.catalog_templates(destination_id);

-- ============================================
-- PIPELINE RUNS (audit log)
-- ============================================
create table public.pipeline_runs (
  id uuid default uuid_generate_v4() primary key,
  destination_id uuid references public.catalog_destinations(id) on delete cascade,
  status text default 'running' check (status in ('running', 'completed', 'failed')),
  steps_completed text[] default '{}',
  error text,
  stats jsonb default '{}',
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ============================================
-- RLS — Admin tables (service role only for writes, public reads for active)
-- ============================================
alter table public.catalog_destinations enable row level security;
alter table public.catalog_hotels enable row level security;
alter table public.catalog_activities enable row level security;
alter table public.catalog_restaurants enable row level security;
alter table public.catalog_templates enable row level security;
alter table public.pipeline_runs enable row level security;

-- Public can read active destinations and their items
create policy "Public can view active destinations"
  on public.catalog_destinations for select
  using (status = 'active');

create policy "Public can view catalog hotels"
  on public.catalog_hotels for select
  using (destination_id in (select id from public.catalog_destinations where status = 'active'));

create policy "Public can view catalog activities"
  on public.catalog_activities for select
  using (destination_id in (select id from public.catalog_destinations where status = 'active'));

create policy "Public can view catalog restaurants"
  on public.catalog_restaurants for select
  using (destination_id in (select id from public.catalog_destinations where status = 'active'));

create policy "Public can view catalog templates"
  on public.catalog_templates for select
  using (destination_id in (select id from public.catalog_destinations where status = 'active'));

-- Auto-update trigger
create trigger catalog_destinations_updated_at
  before update on public.catalog_destinations
  for each row execute function update_updated_at();
