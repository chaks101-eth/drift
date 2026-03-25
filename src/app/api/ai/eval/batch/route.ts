import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateItinerary } from '@/lib/eval/scorer'
import { judgeItinerary } from '@/lib/eval/judge'
import type { EvalItem, DimensionScores } from '@/lib/eval/types'

export const maxDuration = 300

const ADMIN_SECRET = process.env.ADMIN_SECRET
const CONCURRENCY = 3

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

// POST /api/ai/eval/batch — batch eval existing trips
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripIds, destination, limit: maxTrips, judge } = await req.json() as {
    tripIds?: string[]
    destination?: string
    limit?: number
    judge?: boolean
  }

  const db = getAdminClient()

  // Fetch trips
  let query = db.from('trips').select('id, destination, country, vibes, start_date, end_date').order('created_at', { ascending: false })

  if (tripIds?.length) {
    query = query.in('id', tripIds)
  } else if (destination) {
    query = query.ilike('destination', destination)
  }

  if (maxTrips) query = query.limit(maxTrips)

  const { data: trips, error: tripErr } = await query
  if (tripErr || !trips?.length) {
    return NextResponse.json({ error: 'No trips found', detail: tripErr?.message }, { status: 404 })
  }

  // Create eval run
  const { data: run } = await db.from('eval_runs').insert({
    run_type: 'batch',
    status: 'running',
    config: { tripIds: trips.map(t => t.id), destination, judge },
    total_tasks: trips.length,
    started_at: new Date().toISOString(),
  }).select('id').single()

  const runId = run?.id

  // Process trips with concurrency limit
  const results: Array<{ tripId: string; destination: string; score: number; error?: string }> = []
  const queue = [...trips]

  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async (trip) => {
        try {
          const { data: items } = await db
            .from('itinerary_items')
            .select('name, category, price, metadata')
            .eq('trip_id', trip.id)
            .order('position')

          if (!items?.length) {
            return { tripId: trip.id, destination: trip.destination, score: 0, error: 'No items' }
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

          const result = await evaluateItinerary(evalItems, trip.destination, trip.country || '', trip.vibes || [])

          let judgeAnalysis = null
          if (judge) {
            judgeAnalysis = await judgeItinerary(evalItems, trip.destination, trip.country || '', trip.vibes || [], result.dimensions)
          }

          // Persist
          await db.from('eval_results').insert({
            run_id: runId,
            trip_id: trip.id,
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
          })

          // Update run progress
          if (runId) {
            await db.from('eval_runs')
              .update({ completed_tasks: results.length + 1 })
              .eq('id', runId)
          }

          return { tripId: trip.id, destination: trip.destination, score: result.overallScore }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'

          if (runId) {
            await db.from('eval_results').insert({
              run_id: runId,
              trip_id: trip.id,
              llm_provider: 'drift',
              destination: trip.destination,
              country: trip.country || '',
              vibes: trip.vibes || [],
              overall_score: 0,
              dimension_scores: {},
              error: errorMsg,
            })
          }

          return { tripId: trip.id, destination: trip.destination, score: 0, error: errorMsg }
        }
      })
    )
    results.push(...batchResults)
  }

  // Compute aggregates
  const successful = results.filter(r => !r.error)
  const avgScore = successful.length > 0
    ? Math.round(successful.reduce((s, r) => s + r.score, 0) / successful.length)
    : 0

  const byDest: Record<string, number[]> = {}
  for (const r of successful) {
    if (!byDest[r.destination]) byDest[r.destination] = []
    byDest[r.destination].push(r.score)
  }
  const avgByDestination: Record<string, number> = {}
  for (const [dest, scores] of Object.entries(byDest)) {
    avgByDestination[dest] = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
  }

  // Update run as completed
  if (runId) {
    await db.from('eval_runs').update({
      status: 'completed',
      completed_tasks: successful.length,
      failed_tasks: results.length - successful.length,
      aggregate_scores: { avgScore, avgByDestination },
      completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return NextResponse.json({
    runId,
    total: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    avgScore,
    avgByDestination,
    results,
  })
}
