import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/growth/content/:id — get single content item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()
  const { data, error } = await db.from('growth_content').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// PUT /api/growth/content/:id — update content (approve, reject, edit, schedule)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await req.json() as {
    status?: string; body?: string; title?: string; scheduledFor?: string; rejectionReason?: string
  }

  const db = getDb()
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updates.status) updateData.status = updates.status
  if (updates.body) updateData.body = updates.body
  if (updates.title) updateData.title = updates.title
  if (updates.scheduledFor) updateData.scheduled_for = updates.scheduledFor
  if (updates.rejectionReason) updateData.rejection_reason = updates.rejectionReason

  const { data, error } = await db.from('growth_content').update(updateData).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE /api/growth/content/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getDb()
  await db.from('growth_content').delete().eq('id', id)
  return NextResponse.json({ deleted: true })
}
