import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'

// GET /api/trips/[id] — fetch trip + items (public read for desktop board + shared trips)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Use service role to bypass RLS — trips should be viewable on desktop/shared links
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const [tripRes, itemsRes] = await Promise.all([
    db.from('trips').select('*').eq('id', id).single(),
    db.from('itinerary_items').select('*').eq('trip_id', id).order('position'),
  ])

  if (!tripRes.data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  return NextResponse.json({
    trip: tripRes.data,
    items: itemsRes.data || [],
  })
}

// DELETE /api/trips/[id] — delete a trip and all its items + chat messages
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify trip belongs to this user
  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (trip.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete cascade: items, chat messages, then trip
  await supabase.from('itinerary_items').delete().eq('trip_id', id)
  await supabase.from('chat_messages').delete().eq('trip_id', id)
  const { error } = await supabase.from('trips').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
