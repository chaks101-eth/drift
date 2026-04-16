import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// POST /api/trips/[id]/publish — toggle trip public/private
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: trip } = await db().from('trips').select('user_id, is_public, destination').eq('id', tripId).single()
  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the trip owner can publish' }, { status: 403 })
  }

  const { is_public: makePublic } = await req.json()
  const newState = makePublic !== undefined ? !!makePublic : !trip.is_public

  // If making public, also extract trip_brief from the first day's metadata
  let tripBrief = null
  if (newState) {
    const { data: items } = await db()
      .from('itinerary_items')
      .select('metadata')
      .eq('trip_id', tripId)
      .eq('category', 'day')
      .order('position')
      .limit(1)

    if (items?.[0]) {
      const meta = items[0].metadata as Record<string, unknown>
      tripBrief = (meta?.trip_brief as string) || null
    }

    // Generate share slug if none exists
    const { data: existing } = await db().from('trips').select('share_slug').eq('id', tripId).single()
    if (!existing?.share_slug) {
      const slug = `${trip.destination.toLowerCase().replace(/\s+/g, '-')}-${tripId.slice(0, 8)}`
      await db().from('trips').update({ share_slug: slug }).eq('id', tripId)
    }
  }

  await db().from('trips').update({
    is_public: newState,
    ...(tripBrief ? { trip_brief: tripBrief } : {}),
  }).eq('id', tripId)

  return NextResponse.json({ is_public: newState })
}
