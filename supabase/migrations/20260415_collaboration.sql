-- ═══════════════════════════════════════════════════════════════
-- Drift Collaboration: Reactions, Comments, Collaborators
-- ═══════════════════════════════════════════════════════════════

-- ─── Reactions (hearts/upvotes on trip items) ─────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'heart', -- 'heart' for now, extensible later
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id, type) -- one reaction per type per user per item
);

CREATE INDEX IF NOT EXISTS idx_reactions_item ON reactions(item_id);
CREATE INDEX IF NOT EXISTS idx_reactions_trip ON reactions(trip_id);

-- ─── Comments (threaded discussion on items) ──────────────────
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  user_name TEXT, -- cached display name (avoid joins)
  user_avatar TEXT, -- cached avatar URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(item_id);
CREATE INDEX IF NOT EXISTS idx_comments_trip ON comments(trip_id);

-- ─── Collaborators (who can interact with a trip) ─────────────
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = pending invite
  email TEXT, -- for pending invites before user signs up
  role TEXT NOT NULL DEFAULT 'viewer', -- 'owner' | 'editor' | 'viewer'
  invite_token TEXT UNIQUE, -- for link-based invites
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, user_id) -- one role per user per trip
);

CREATE INDEX IF NOT EXISTS idx_collaborators_trip ON collaborators(trip_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_token ON collaborators(invite_token);

-- ─── Suggested items (friends propose places) ─────────────────
-- Uses existing itinerary_items table with status = 'suggested'
-- Adding suggested_by column to track who proposed it
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS suggested_by UUID REFERENCES auth.users(id);
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS suggested_name TEXT; -- display name of suggester

-- ─── RLS Policies ─────────────────────────────────────────────

-- Reactions: anyone who can view the trip can react
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on their trips" ON reactions
  FOR SELECT USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM collaborators WHERE user_id = auth.uid())
    OR trip_id IN (SELECT id FROM trips WHERE share_slug IS NOT NULL)
  );

CREATE POLICY "Authenticated users can add reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Comments: anyone who can view can comment
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible trips" ON comments
  FOR SELECT USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM collaborators WHERE user_id = auth.uid())
    OR trip_id IN (SELECT id FROM trips WHERE share_slug IS NOT NULL)
  );

CREATE POLICY "Authenticated users can add comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Collaborators: trip owner manages, collaborators can see their own
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip owners can manage collaborators" ON collaborators
  FOR ALL USING (
    trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can see trips they collaborate on" ON collaborators
  FOR SELECT USING (user_id = auth.uid());
