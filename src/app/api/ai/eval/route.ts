import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateItinerary } from '@/lib/eval/scorer'
import { judgeItinerary } from '@/lib/eval/judge'
import type { EvalItem } from '@/lib/eval/types'

export const maxDuration = 120

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

// POST /api/ai/eval — evaluate a single trip's quality, persist result
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId, judge, runId } = await req.json()
  if (!tripId) return NextResponse.json({ error: 'Missing tripId' }, { status: 400 })

  const db = getAdminClient()

  const [{ data: trip }, { data: items }] = await Promise.all([
    db.from('trips').select('destination, country, vibes, start_date, end_date').eq('id', tripId).single(),
    db.from('itinerary_items').select('name, category, price, metadata').eq('trip_id', tripId).order('position'),
  ])

  if (!trip || !items?.length) {
    return NextResponse.json({ error: 'Trip not found or empty' }, { status: 404 })
  }

  const evalItems: EvalItem[] = items.map(i => ({
    name: i.name,
    category: i.category,
    price: i.price || '',
    metadata: (i.metadata || {}) as Record<string, unknown>,
  }))

  const days = trip.start_date && trip.end_date
    ? Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)))
    : 4

  // Run eval
  const result = await evaluateItinerary(evalItems, trip.destination, trip.country || '', trip.vibes || [])

  // Optional: LLM-as-judge
  let judgeAnalysis = null
  if (judge) {
    judgeAnalysis = await judgeItinerary(evalItems, trip.destination, trip.country || '', trip.vibes || [], result.dimensions)
  }

  // Persist to eval_results
  const { data: saved, error: saveErr } = await db.from('eval_results').insert({
    run_id: runId || null,
    trip_id: tripId,
    llm_provider: 'drift',
    destination: trip.destination,
    country: trip.country || '',
    vibes: trip.vibes || [],
    days,
    item_count: evalItems.length,
    overall_score: result.overallScore,
    dimension_scores: result.dimensions,
    items_snapshot: evalItems,
    judge_analysis: judgeAnalysis,
  }).select('id').single()

  if (saveErr) console.error('[Eval] Save failed:', saveErr.message)

  return NextResponse.json({
    ...result,
    judgeAnalysis,
    evalResultId: saved?.id || null,
  })
}
