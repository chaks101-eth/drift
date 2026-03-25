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

// GET /api/growth/learnings — list active learnings
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const showAll = req.nextUrl.searchParams.get('all') === 'true'

  let query = db.from('growth_learnings').select('*').order('created_at', { ascending: false })
  if (!showAll) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byCategory: Record<string, number> = {}
  for (const l of data || []) {
    if (l.category) byCategory[l.category] = (byCategory[l.category] || 0) + 1
  }

  return NextResponse.json({ learnings: data || [], total: data?.length || 0, byCategory })
}
