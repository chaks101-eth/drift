import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/trips/public?destination=Bali&limit=20&offset=0
// Returns public trips, optionally filtered by destination
export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get('destination')
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') || '20'))
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')

  let query = db()
    .from('trips')
    .select('id, destination, country, vibes, start_date, end_date, travelers, budget, share_slug, created_at, trip_brief, user_id')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (destination) {
    query = query.ilike('destination', `%${destination}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get reaction counts per trip
  const tripIds = (data || []).map(t => t.id)
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

  const trips = (data || []).map(t => ({
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
