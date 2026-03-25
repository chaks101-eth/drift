import { NextRequest, NextResponse } from 'next/server'
import { personalizeItinerary } from '@/lib/ai-agent'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  // Load trip + items
  const [{ data: trip }, { data: items }] = await Promise.all([
    supabase.from('trips').select('destination, country, vibes, budget, travelers, start_date')
      .eq('id', tripId).single(),
    supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('position'),
  ])

  if (!trip || !items?.length) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Check if already personalized (items have whyFactors — not just trip_brief/reason from generation)
  const hasWhyFactors = items.some(i =>
    i.category !== 'day' && i.category !== 'flight' && i.category !== 'transfer' &&
    (i.metadata as Record<string, unknown>)?.whyFactors
  )
  if (hasWhyFactors) {
    return NextResponse.json({ status: 'already_personalized' })
  }

  console.log(`[Personalize] Starting for trip ${tripId} — ${trip.destination}, vibes: ${trip.vibes?.join(',')}`)

  try {
    // Build items in the format personalizeItinerary expects
    const itemsForPersonalize = items.map(i => ({
      category: i.category,
      name: i.name,
      detail: i.detail || '',
      description: i.description || '',
      price: i.price || '',
      image_url: i.image_url || '',
      time: i.time || '',
      position: i.position,
      metadata: (i.metadata || {}) as Record<string, unknown>,
    }))

    const personalized = await personalizeItinerary(itemsForPersonalize, {
      destination: trip.destination,
      country: trip.country,
      vibes: trip.vibes || [],
      budget: trip.budget || 'mid',
      travelers: trip.travelers || 2,
      startDate: trip.start_date,
    })

    // Update each item's metadata in DB
    let updated = 0
    for (let idx = 0; idx < personalized.length; idx++) {
      const original = items[idx]
      const p = personalized[idx]
      const origMeta = (original.metadata || {}) as Record<string, unknown>
      const newMeta = p.metadata

      // Only update if personalization added new fields
      const hasNewData = (
        (newMeta.trip_brief && !origMeta.trip_brief) ||
        (newMeta.day_insight && !origMeta.day_insight) ||
        (newMeta.reason && !origMeta.reason) ||
        (newMeta.whyFactors && !origMeta.whyFactors)
      )

      if (hasNewData) {
        await supabase.from('itinerary_items')
          .update({ metadata: { ...origMeta, ...newMeta } })
          .eq('id', original.id)
        updated++
      }
    }

    console.log(`[Personalize] Trip ${tripId}: updated ${updated}/${items.length} items`)
    return NextResponse.json({ status: 'personalized', updated })
  } catch (error) {
    console.error('[Personalize] Error:', error)
    return NextResponse.json({ error: 'Personalization failed' }, { status: 500 })
  }
}
