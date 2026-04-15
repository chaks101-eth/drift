import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/invite/[token] — accept an invite
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: inviteToken } = await params
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!authHeader) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${authHeader}` } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Find the invite
  const { data: invite, error } = await db
    .from('collaborators')
    .select('id, trip_id, role')
    .eq('invite_token', inviteToken)
    .is('accepted_at', null)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Accept — set user_id and accepted_at
  await db.from('collaborators').update({
    user_id: user.id,
    accepted_at: new Date().toISOString(),
  }).eq('id', invite.id)

  return NextResponse.json({ tripId: invite.trip_id, role: invite.role })
}
