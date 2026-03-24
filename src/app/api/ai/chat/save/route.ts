import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/ai/chat/save — save assistant message after streaming completes
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId, content, contextItemId } = await req.json()
  if (!tripId || !content) return NextResponse.json({ error: 'Missing tripId or content' }, { status: 400 })

  await supabase.from('chat_messages').insert({
    trip_id: tripId,
    user_id: user.id,
    role: 'assistant',
    content,
    context_item_id: contextItemId || null,
  })

  return NextResponse.json({ ok: true })
}
