import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

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
