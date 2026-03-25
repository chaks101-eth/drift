import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/admin/trips — list all trips (across all users) for eval system
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const destination = req.nextUrl.searchParams.get('destination')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '500')

  let query = db
    .from('trips')
    .select('id, destination, country, vibes, start_date, end_date, travelers, budget, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (destination) {
    query = query.ilike('destination', `%${destination}%`)
  }

  const { data: trips, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary stats
  const destinations = [...new Set((trips || []).map(t => t.destination))].sort()
  const totalTrips = trips?.length || 0

  return NextResponse.json({ trips: trips || [], destinations, totalTrips })
}
