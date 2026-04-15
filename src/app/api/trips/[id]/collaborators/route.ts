import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET /api/trips/[id]/collaborators — list collaborators
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  const { data, error } = await db()
    .from('collaborators')
    .select('id, user_id, email, role, accepted_at, created_at')
    .eq('trip_id', tripId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ collaborators: data || [] })
}

// POST /api/trips/[id]/collaborators — invite a collaborator
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user owns the trip
  const { data: trip } = await db().from('trips').select('user_id').eq('id', tripId).single()
  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the trip owner can invite collaborators' }, { status: 403 })
  }

  const { email, role = 'editor' } = await req.json()
  const inviteToken = randomBytes(24).toString('base64url')

  const { data, error } = await db().from('collaborators').insert({
    trip_id: tripId,
    email: email || null,
    role,
    invite_token: inviteToken,
    invited_by: user.id,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already invited' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Build invite link
  const baseUrl = req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host')}`
    : 'https://www.driftntravel.com'
  const inviteLink = `${baseUrl}/invite/${inviteToken}`

  return NextResponse.json({ collaborator: data, inviteLink })
}

// DELETE /api/trips/[id]/collaborators — remove a collaborator
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { collaboratorId } = await req.json()

  // Only trip owner can remove
  const { data: trip } = await db().from('trips').select('user_id').eq('id', tripId).single()
  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only the trip owner can remove collaborators' }, { status: 403 })
  }

  const { error } = await db().from('collaborators').delete().eq('id', collaboratorId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removed: true })
}
