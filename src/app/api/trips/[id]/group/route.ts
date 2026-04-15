import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/trips/[id]/group — get group state (ready check + notes)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  const { data: trip } = await db()
    .from('trips')
    .select('metadata')
    .eq('id', tripId)
    .single()

  const meta = ((trip?.metadata || {}) as Record<string, unknown>)
  const groupState = (meta.group || {}) as {
    readyCheck?: { active: boolean; responses: Record<string, 'ready' | 'changes'>; startedBy?: string }
    notes?: Array<{ userId: string; userName: string; text: string; createdAt: string }>
  }

  return NextResponse.json({ group: groupState })
}

// POST /api/trips/[id]/group — actions: start_ready_check, respond_ready, add_note
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, ...payload } = await req.json()
  const userName = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Someone'

  // Get current trip metadata
  const { data: trip } = await db().from('trips').select('metadata').eq('id', tripId).single()
  const meta = ((trip?.metadata || {}) as Record<string, unknown>)
  const group = ((meta.group || {}) as Record<string, unknown>)

  if (action === 'start_ready_check') {
    group.readyCheck = {
      active: true,
      responses: { [user.id]: 'ready' }, // starter is auto-ready
      startedBy: userName,
    }
  } else if (action === 'respond_ready') {
    const rc = group.readyCheck as { active: boolean; responses: Record<string, string> } | undefined
    if (rc?.active) {
      rc.responses[user.id] = payload.response // 'ready' | 'changes'
    }
  } else if (action === 'close_ready_check') {
    const rc = group.readyCheck as { active: boolean } | undefined
    if (rc) rc.active = false
  } else if (action === 'add_note') {
    const notes = (group.notes || []) as Array<Record<string, unknown>>
    notes.push({
      userId: user.id,
      userName,
      text: payload.text,
      createdAt: new Date().toISOString(),
    })
    group.notes = notes.slice(-50) // keep last 50 notes
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  await db().from('trips').update({ metadata: { ...meta, group } }).eq('id', tripId)

  return NextResponse.json({ group })
}
