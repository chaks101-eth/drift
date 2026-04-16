import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// POST /api/trips/[id]/join — authed user joins a trip as collaborator
// Called when a user visits a /share/[slug] URL and taps "Join this trip".
// Idempotent: if already a collaborator, returns existing row.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  // Verify the caller's identity
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the trip exists and is shareable (owner-joined check + share_slug must exist)
  const { data: trip, error: tripErr } = await db()
    .from('trips')
    .select('id, user_id, share_slug')
    .eq('id', tripId)
    .single()

  if (tripErr || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  if (!trip.share_slug) return NextResponse.json({ error: 'This trip has no share link — ask the owner to generate one' }, { status: 403 })

  // Owner joining their own trip is a no-op
  if (trip.user_id === user.id) {
    return NextResponse.json({ status: 'owner', message: 'You are the trip owner' })
  }

  // Check if already a collaborator (accepted or not)
  const { data: existing } = await db()
    .from('collaborators')
    .select('id, accepted_at, role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // If they were pending, mark as joined
    if (!existing.accepted_at) {
      await db()
        .from('collaborators')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return NextResponse.json({ status: 'joined', collaboratorId: existing.id })
  }

  // Insert a new collaborator row — already accepted since they clicked the link + signed in
  const { data: newRow, error: insertErr } = await db()
    .from('collaborators')
    .insert({
      trip_id: tripId,
      user_id: user.id,
      email: user.email || null,
      role: 'member',
      accepted_at: new Date().toISOString(),
      invited_by: trip.user_id,
    })
    .select('id')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ status: 'joined', collaboratorId: newRow.id })
}
