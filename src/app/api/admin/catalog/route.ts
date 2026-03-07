import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'drift-admin-2026'

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/admin/catalog?type=hotels&destination_id=xxx
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') || 'destinations'
  const destinationId = req.nextUrl.searchParams.get('destination_id')
  const db = getAdmin()

  const tableMap: Record<string, string> = {
    destinations: 'catalog_destinations',
    hotels: 'catalog_hotels',
    activities: 'catalog_activities',
    restaurants: 'catalog_restaurants',
    templates: 'catalog_templates',
    runs: 'pipeline_runs',
  }

  const table = tableMap[type]
  if (!table) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  let query = db.from(table).select('*').order('created_at', { ascending: false })
  if (destinationId && type !== 'destinations') {
    query = query.eq('destination_id', destinationId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// PUT /api/admin/catalog — update a catalog item
export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id, updates } = await req.json()
  const db = getAdmin()

  const tableMap: Record<string, string> = {
    destinations: 'catalog_destinations',
    hotels: 'catalog_hotels',
    activities: 'catalog_activities',
    restaurants: 'catalog_restaurants',
  }

  const table = tableMap[type]
  if (!table || !id) return NextResponse.json({ error: 'Invalid type or missing id' }, { status: 400 })

  const { data, error } = await db.from(table).update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE /api/admin/catalog — delete a catalog item or destination
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, id } = await req.json()
  const db = getAdmin()

  const tableMap: Record<string, string> = {
    destinations: 'catalog_destinations',
    hotels: 'catalog_hotels',
    activities: 'catalog_activities',
    restaurants: 'catalog_restaurants',
    templates: 'catalog_templates',
  }

  const table = tableMap[type]
  if (!table || !id) return NextResponse.json({ error: 'Invalid type or missing id' }, { status: 400 })

  const { error } = await db.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
