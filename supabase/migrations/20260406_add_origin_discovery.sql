-- Migration: Add onboarding inputs to trips + discovery cache for catalog growth
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/jxnrppnlnztlyputztlw/sql

-- 1. Add missing onboarding columns to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS origin_city text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_amount integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS occasion text;

-- 2. Create discovery cache table for grounded search results
CREATE TABLE IF NOT EXISTS discovered_places (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  destination text NOT NULL,
  country text NOT NULL DEFAULT '',
  name text NOT NULL,
  category text NOT NULL DEFAULT 'activity',
  price_hint text,
  rating_hint numeric,
  source text NOT NULL DEFAULT 'grounded_search',
  trip_count integer NOT NULL DEFAULT 1,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  enriched_at timestamptz,
  promoted_at timestamptz,
  UNIQUE(destination, name)
);

-- Index for finding popular unenriched places
CREATE INDEX IF NOT EXISTS idx_discovered_places_trip_count ON discovered_places(trip_count DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_places_destination ON discovered_places(destination);

-- 3. RPC function to upsert + increment trip_count
CREATE OR REPLACE FUNCTION upsert_discovered_place(
  p_destination text,
  p_country text,
  p_name text,
  p_category text DEFAULT 'activity',
  p_price_hint text DEFAULT NULL,
  p_rating_hint numeric DEFAULT NULL,
  p_source text DEFAULT 'grounded_search'
) RETURNS void AS $$
BEGIN
  INSERT INTO discovered_places (destination, country, name, category, price_hint, rating_hint, source, trip_count)
  VALUES (p_destination, p_country, p_name, p_category, p_price_hint, p_rating_hint, p_source, 1)
  ON CONFLICT (destination, name)
  DO UPDATE SET
    trip_count = discovered_places.trip_count + 1,
    rating_hint = COALESCE(EXCLUDED.rating_hint, discovered_places.rating_hint),
    price_hint = COALESCE(EXCLUDED.price_hint, discovered_places.price_hint);
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (allow service role only)
ALTER TABLE discovered_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON discovered_places FOR ALL USING (true) WITH CHECK (true);
