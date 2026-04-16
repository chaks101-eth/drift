-- ═══════════════════════════════════════════════════════════════
-- Public Trip Feed: make trips discoverable
-- ═══════════════════════════════════════════════════════════════

-- Add is_public flag to trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Index for fast public trip queries
CREATE INDEX IF NOT EXISTS idx_trips_public ON trips(is_public, destination) WHERE is_public = true;

-- Add trip_brief column for display on cards (extracted from first day item metadata)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_brief TEXT;

-- RLS: anyone can read public trips
CREATE POLICY "Anyone can view public trips" ON trips
  FOR SELECT USING (is_public = true);
