-- ═══════════════════════════════════════════════════════════════
-- Harden trips RLS: remove permissive global-read policies.
--
-- Context: Postgres RLS OR's multiple permissive SELECT policies together.
-- Before this migration, `trips` had three SELECT policies:
--   1. "Users can view own trips"      — auth.uid() = user_id       (correct)
--   2. "Anyone can view shared trips"  — share_slug IS NOT NULL     (leak)
--   3. "Anyone can view public trips"  — is_public = true           (leak)
--
-- Any authenticated user doing `from('trips').select()` with no client-side
-- user filter got their own trips + every shared + every public trip. A fresh
-- account at /trips saw ~13 strangers' trips as "their own Recent Drifts".
--
-- Safety: every user-facing public-trip read path uses service-role keys and
-- bypasses RLS entirely:
--   - GET /api/trips/public              (service role)
--   - GET /api/trips/[id]                (service role)
--   - /share/[slug]/page.tsx             (server component, service role)
--   - /share/[slug]/opengraph-image.tsx  (server component, service role)
-- The ownership check in ShareTripView.tsx (client, anon key) correctly falls
-- through to 'can-join' when RLS returns null for non-owners.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can view shared trips" ON public.trips;
DROP POLICY IF EXISTS "Anyone can view public trips" ON public.trips;
DROP POLICY IF EXISTS "Anyone can view shared trip items" ON public.itinerary_items;
