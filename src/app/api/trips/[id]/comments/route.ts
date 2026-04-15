import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/trips/[id]/comments?itemId=xxx — get comments for a trip or specific item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const itemId = req.nextUrl.searchParams.get('itemId')

  let query = db()
    .from('comments')
    .select('id, item_id, user_id, text, user_name, user_avatar, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (itemId) query = query.eq('item_id', itemId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data || [] })
}

// POST /api/trips/[id]/comments — add a comment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId, text } = await req.json()
  if (!itemId || !text?.trim()) return NextResponse.json({ error: 'itemId and text required' }, { status: 400 })

  const userName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Traveler'
  const userAvatar = (user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string) || null

  const { data, error } = await db().from('comments').insert({
    trip_id: tripId,
    item_id: itemId,
    user_id: user.id,
    text: text.trim(),
    user_name: userName,
    user_avatar: userAvatar,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

// DELETE /api/trips/[id]/comments — delete own comment
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await req.json()
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

  const { error } = await db()
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id) // only delete own

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
