import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/trips/[id]/reactions — get all reactions for a trip
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  const { data, error } = await db()
    .from('reactions')
    .select('id, item_id, user_id, type, created_at')
    .eq('trip_id', tripId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate: { [itemId]: { heart: count, userReacted: boolean } }
  const userId = req.headers.get('x-user-id') || ''
  const byItem: Record<string, { count: number; reacted: boolean }> = {}
  for (const r of (data || [])) {
    if (!byItem[r.item_id]) byItem[r.item_id] = { count: 0, reacted: false }
    byItem[r.item_id].count++
    if (r.user_id === userId) byItem[r.item_id].reacted = true
  }

  return NextResponse.json({ reactions: byItem })
}

// POST /api/trips/[id]/reactions — toggle a reaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  // Allow reactions without auth (for share page viewers) — use anon user_id
  let userId: string | null = null
  if (token) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id || null
  }

  if (!userId) return NextResponse.json({ error: 'Auth required to react' }, { status: 401 })

  const { itemId, type = 'heart' } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const supadb = db()

  // Check if already reacted — toggle off
  const { data: existing } = await supadb
    .from('reactions')
    .select('id')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .eq('type', type)
    .single()

  if (existing) {
    await supadb.from('reactions').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  }

  // Add reaction
  const { error } = await supadb.from('reactions').insert({
    trip_id: tripId,
    item_id: itemId,
    user_id: userId,
    type,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'added' })
}
