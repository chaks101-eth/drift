import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/trips/[id]/suggest — get suggested items
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  const { data, error } = await db()
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'suggested')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suggestions: data || [] })
}

// POST /api/trips/[id]/suggest — suggest a new place
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, category = 'activity', detail = '' } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const userName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Someone'

  // Get max position
  const { data: lastItem } = await db()
    .from('itinerary_items')
    .select('position')
    .eq('trip_id', tripId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = (lastItem?.position || 0) + 1

  const { data, error } = await db().from('itinerary_items').insert({
    trip_id: tripId,
    category,
    name: name.trim(),
    detail: detail.trim(),
    description: null,
    price: '',
    image_url: null,
    time: null,
    position,
    status: 'suggested',
    suggested_by: user.id,
    suggested_name: userName,
    metadata: {},
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suggestion: data })
}

// DELETE /api/trips/[id]/suggest — accept (move to 'none') or dismiss a suggestion
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId, action } = await req.json() // action: 'accept' | 'dismiss'
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  // Verify trip ownership
  const { data: trip } = await db().from('trips').select('user_id').eq('id', tripId).single()
  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the trip owner can manage suggestions' }, { status: 403 })
  }

  if (action === 'accept') {
    await db().from('itinerary_items').update({ status: 'none' }).eq('id', itemId)
    return NextResponse.json({ accepted: true })
  } else {
    await db().from('itinerary_items').delete().eq('id', itemId)
    return NextResponse.json({ dismissed: true })
  }
}
