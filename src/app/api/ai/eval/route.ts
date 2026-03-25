import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { evaluateItinerary } from '@/lib/itinerary-eval'

export const maxDuration = 60

// POST /api/ai/eval — evaluate an itinerary's quality
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const [{ data: trip }, { data: items }] = await Promise.all([
    supabase.from('trips').select('destination, country, vibes').eq('id', tripId).single(),
    supabase.from('itinerary_items').select('name, category, price, metadata').eq('trip_id', tripId).order('position'),
  ])

  if (!trip || !items?.length) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const evalItems = items.map(i => ({
    name: i.name,
    category: i.category,
    price: i.price || '',
    metadata: (i.metadata || {}) as Record<string, unknown>,
  }))

  const result = await evaluateItinerary(
    evalItems,
    trip.destination,
    trip.country || '',
    trip.vibes || [],
  )

  return NextResponse.json(result)
}
