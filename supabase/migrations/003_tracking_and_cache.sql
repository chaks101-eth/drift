-- ============================================
-- DRIFT — User Tracking & Price Cache
-- ============================================

-- ============================================
-- USER INTERACTIONS (picks, skips, saves)
-- Tracks what users do with itinerary items for popularity scoring
-- ============================================
create table public.user_interactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item_type text not null check (item_type in ('hotel', 'activity', 'restaurant', 'flight')),
  item_name text not null,
  destination text not null,
  action text not null check (action in ('picked', 'skipped', 'saved', 'clicked', 'booked')),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_interactions_dest on public.user_interactions(destination, item_name);
create index idx_interactions_user on public.user_interactions(user_id);

-- ============================================
-- POPULARITY SCORES (materialized from interactions)
-- ============================================
create table public.popularity_scores (
  id uuid default uuid_generate_v4() primary key,
  item_type text not null,
  item_name text not null,
  destination text not null,
  pick_count int default 0,
  skip_count int default 0,
  save_count int default 0,
  click_count int default 0,
  book_count int default 0,
  score numeric(5,2) default 0,
  updated_at timestamptz default now()
);

create unique index idx_popularity_unique on public.popularity_scores(item_type, lower(item_name), lower(destination));

-- ============================================
-- PRICE CACHE
-- Stores fetched prices with TTL for freshness
-- ============================================
create table public.price_cache (
  id uuid default uuid_generate_v4() primary key,
  provider text not null,
  item_type text not null,
  item_key text not null,
  price_data jsonb not null,
  fetched_at timestamptz default now(),
  expires_at timestamptz not null
);

create unique index idx_price_cache_key on public.price_cache(provider, item_type, item_key);
create index idx_price_cache_expires on public.price_cache(expires_at);

-- ============================================
-- RLS
-- ============================================
alter table public.user_interactions enable row level security;
alter table public.popularity_scores enable row level security;
alter table public.price_cache enable row level security;

-- Users can insert their own interactions
create policy "Users can create interactions"
  on public.user_interactions for insert
  with check (auth.uid() = user_id);

create policy "Users can view own interactions"
  on public.user_interactions for select
  using (auth.uid() = user_id);

-- Popularity scores are public read
create policy "Public can view popularity"
  on public.popularity_scores for select
  using (true);

-- Price cache is public read
create policy "Public can view prices"
  on public.price_cache for select
  using (true);
