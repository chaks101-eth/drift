-- ============================================
-- CATALOG FRESHNESS & DEDUP SUPPORT
-- Adds updated_at, place_id, status, and restaurant rating
-- Regular unique indexes for Supabase JS .upsert() compatibility
-- ============================================

-- Hotels: add updated_at and place_id for stable dedup
ALTER TABLE public.catalog_hotels ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.catalog_hotels ADD COLUMN IF NOT EXISTS place_id text;

-- Activities: add updated_at and place_id
ALTER TABLE public.catalog_activities ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.catalog_activities ADD COLUMN IF NOT EXISTS place_id text;

-- Restaurants: add updated_at, place_id, and missing rating column
ALTER TABLE public.catalog_restaurants ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.catalog_restaurants ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE public.catalog_restaurants ADD COLUMN IF NOT EXISTS rating numeric(2,1);

-- Status column for soft-delete on all three catalog item tables
ALTER TABLE public.catalog_hotels ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.catalog_activities ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.catalog_restaurants ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Drop partial indexes if they exist (from prior versions of this migration)
DROP INDEX IF EXISTS idx_catalog_hotels_place;
DROP INDEX IF EXISTS idx_catalog_activities_place;
DROP INDEX IF EXISTS idx_catalog_restaurants_place;

-- Regular unique indexes (compatible with Supabase JS .upsert({ onConflict }))
-- NULL != NULL in PostgreSQL, so multiple rows with NULL place_id are allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_hotels_dest_place
  ON public.catalog_hotels(destination_id, place_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_activities_dest_place
  ON public.catalog_activities(destination_id, place_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_restaurants_dest_place
  ON public.catalog_restaurants(destination_id, place_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_hotels_updated_at
  BEFORE UPDATE ON public.catalog_hotels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER catalog_activities_updated_at
  BEFORE UPDATE ON public.catalog_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER catalog_restaurants_updated_at
  BEFORE UPDATE ON public.catalog_restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
