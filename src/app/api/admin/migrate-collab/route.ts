import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { secret } = await req.json()
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const results: string[] = []

  // Try to create tables via RPC, or check if they exist
  const tables = ['reactions', 'comments', 'collaborators']
  for (const table of tables) {
    const { error } = await db.from(table).select('id').limit(0)
    if (error?.code === '42P01') {
      // Table doesn't exist — needs manual SQL migration
      results.push(`${table}: NOT FOUND — run SQL migration manually`)
    } else {
      results.push(`${table}: exists`)
    }
  }

  // Check for suggested_by column
  const { error: colErr } = await db.from('itinerary_items').select('suggested_by').limit(0)
  if (colErr) {
    results.push('suggested_by column: NOT FOUND — run ALTER TABLE manually')
  } else {
    results.push('suggested_by column: exists')
  }

  return NextResponse.json({
    results,
    note: 'If tables are missing, run the SQL migration at supabase/migrations/20260415_collaboration.sql in the Supabase SQL Editor',
  })
}
