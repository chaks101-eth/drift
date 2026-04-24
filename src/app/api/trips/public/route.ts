import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/trips/public?destination=Bali&limit=20&offset=0&minItems=5
// Returns public trips, optionally filtered by destination.
// `minItems` filters out empty-draft trips — important for the showroom on /trips + /m.
// Default minItems=0 (no filter) so existing callers (explore page, all-trips archive) are unchanged.
export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get('destination')
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') || '20'))
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')
  const minItems = Math.max(0, parseInt(req.nextUrl.searchParams.get('minItems') || '0'))

  // Fetch 3x the asked limit when filtering by minItems, so we have candidates after filtering.
  const fetchLimit = minItems > 0 ? Math.min(150, limit * 3) : limit

  let query = db()
    .from('trips')
    .select('id, destination, country, vibes, start_date, end_date, travelers, budget, share_slug, created_at, trip_brief, user_id')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1)

  if (destination) {
    query = query.ilike('destination', `%${destination}%`)
  }

  const { data: rawTrips, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If minItems filter is active, count items per trip and drop trips with too few items.
  let filteredTrips = rawTrips || []
  if (minItems > 0 && filteredTrips.length > 0) {
    const { data: itemCounts } = await db()
      .from('itinerary_items')
      .select('trip_id')
      .in('trip_id', filteredTrips.map(t => t.id))

    const counts: Record<string, number> = {}
    for (const row of itemCounts || []) counts[row.trip_id] = (counts[row.trip_id] || 0) + 1
    filteredTrips = filteredTrips.filter(t => (counts[t.id] || 0) >= minItems).slice(0, limit)
  }

  const data = filteredTrips

  // Get reaction counts per trip
  const tripIds = data.map(t => t.id)
  let reactionCounts: Record<string, number> = {}

  if (tripIds.length > 0) {
    const { data: reactions } = await db()
      .from('reactions')
      .select('trip_id')
      .in('trip_id', tripIds)

    if (reactions) {
      reactionCounts = reactions.reduce((acc: Record<string, number>, r: { trip_id: string }) => {
        acc[r.trip_id] = (acc[r.trip_id] || 0) + 1
        return acc
      }, {})
    }
  }

  // Get unique destinations for the explore page
  const { data: destinations } = await db()
    .from('trips')
    .select('destination, country')
    .eq('is_public', true)

  const uniqueDestinations = [...new Map((destinations || []).map(d => [d.destination, d])).values()]
    .sort((a, b) => a.destination.localeCompare(b.destination))

  const trips = data.map(t => ({
    ...t,
    heartCount: reactionCounts[t.id] || 0,
  }))

  return NextResponse.json({
    trips,
    destinations: uniqueDestinations,
    total: trips.length,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
