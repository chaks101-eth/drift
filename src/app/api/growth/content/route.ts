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

// GET /api/growth/content — list content queue
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const status = req.nextUrl.searchParams.get('status')
  const platform = req.nextUrl.searchParams.get('platform')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

  let query = db.from('growth_content').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status) query = query.eq('status', status)
  if (platform) query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = {
    total: data?.length || 0,
    byStatus: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
  }
  for (const item of data || []) {
    summary.byStatus[item.status] = (summary.byStatus[item.status] || 0) + 1
    summary.byPlatform[item.platform] = (summary.byPlatform[item.platform] || 0) + 1
  }

  return NextResponse.json({ content: data || [], summary })
}
