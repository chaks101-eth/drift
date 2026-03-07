-- ============================================
-- DRIFT — Database Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- TRIPS
-- ============================================
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  destination text not null,
  country text not null default '',
  vibes text[] default '{}',
  start_date date not null,
  end_date date not null,
  travelers int default 2,
  budget text default 'mid',
  status text default 'planning' check (status in ('planning', 'booked', 'completed')),
  share_slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast user lookups
create index idx_trips_user on public.trips(user_id);
create index idx_trips_share on public.trips(share_slug);

-- ============================================
-- ITINERARY ITEMS
-- ============================================
create table public.itinerary_items (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  category text not null check (category in ('flight', 'hotel', 'activity', 'food', 'transfer', 'day')),
  name text not null,
  detail text default '',
  description text,
  price text default '',
  image_url text,
  time text,
  position int not null default 0,
  status text default 'none' check (status in ('none', 'picked', 'skipped', 'saved')),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_items_trip on public.itinerary_items(trip_id);
create index idx_items_position on public.itinerary_items(trip_id, position);

-- ============================================
-- CHAT MESSAGES
-- ============================================
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  trip_id uuid references public.trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  context_item_id uuid references public.itinerary_items(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_chat_trip on public.chat_messages(trip_id, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.trips enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.chat_messages enable row level security;

-- Trips: users can only access their own trips
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "Users can create trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- Shared trips: anyone with the slug can view
create policy "Anyone can view shared trips"
  on public.trips for select
  using (share_slug is not null);

-- Itinerary items: accessible if user owns the trip
create policy "Users can manage trip items"
  on public.itinerary_items for all
  using (trip_id in (select id from public.trips where user_id = auth.uid()));

-- Shared trip items: readable if trip is shared
create policy "Anyone can view shared trip items"
  on public.itinerary_items for select
  using (trip_id in (select id from public.trips where share_slug is not null));

-- Chat: users can access their own chat
create policy "Users can manage own chat"
  on public.chat_messages for all
  using (user_id = auth.uid());

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on public.trips
  for each row execute function update_updated_at();
