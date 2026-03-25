import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateItinerary } from '@/lib/eval/scorer'
import { judgeItinerary } from '@/lib/eval/judge'
import { getProviders, generateFromProvider } from '@/lib/eval/benchmark'
import type { BenchmarkParams } from '@/lib/eval/types'

export const maxDuration = 300

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

// POST /api/ai/eval/benchmark — multi-LLM benchmark
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { destinations, providerIds, judge, includeDrift } = await req.json() as {
    destinations: Array<{ destination: string; country: string; vibes: string[]; days: number; travelers?: number; budget?: string }>
    providerIds?: string[]
    judge?: boolean
    includeDrift?: boolean
  }

  if (!destinations?.length) {
    return NextResponse.json({ error: 'Missing destinations array' }, { status: 400 })
  }

  const providers = getProviders(providerIds)
  if (providers.length === 0) {
    return NextResponse.json({ error: 'No LLM providers available. Check API keys.' }, { status: 400 })
  }

  const db = getAdminClient()

  // Create benchmark run
  const totalTasks = destinations.length * (providers.length + (includeDrift ? 1 : 0))
  const { data: run } = await db.from('eval_runs').insert({
    run_type: 'benchmark',
    status: 'running',
    config: { destinations, providerIds: providers.map(p => p.id), judge, includeDrift },
    total_tasks: totalTasks,
    started_at: new Date().toISOString(),
  }).select('id').single()

  const runId = run?.id

  const allResults: Array<{
    destination: string
    provider: string
    overallScore: number
    itemCount: number
    judgeScore?: number
    error?: string
  }> = []

  for (const dest of destinations) {
    const params: BenchmarkParams = {
      destination: dest.destination,
      country: dest.country,
      vibes: dest.vibes,
      days: dest.days,
      travelers: dest.travelers || 2,
      budget: dest.budget || 'mid',
    }

    // If includeDrift, also eval the existing Drift-generated trip for this destination
    if (includeDrift) {
      const { data: driftTrip } = await db
        .from('trips')
        .select('id')
        .ilike('destination', dest.destination)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (driftTrip) {
        const { data: items } = await db
          .from('itinerary_items')
          .select('name, category, price, metadata')
          .eq('trip_id', driftTrip.id)
          .order('position')

        if (items?.length) {
          const evalItems = items.map(i => ({
            name: i.name,
            category: i.category,
            price: i.price || '',
            metadata: (i.metadata || {}) as Record<string, unknown>,
          }))

          const result = await evaluateItinerary(evalItems, dest.destination, dest.country, dest.vibes)
          const ja = judge ? await judgeItinerary(evalItems, dest.destination, dest.country, dest.vibes, result.dimensions) : null

          await db.from('eval_results').insert({
            run_id: runId,
            trip_id: driftTrip.id,
            llm_provider: 'drift',
            destination: dest.destination,
            country: dest.country,
            vibes: dest.vibes,
            days: dest.days,
            item_count: evalItems.length,
            overall_score: result.overallScore,
            dimension_scores: result.dimensions,
            items_snapshot: evalItems,
            judge_analysis: ja,
          })

          allResults.push({
            destination: dest.destination,
            provider: 'drift',
            overallScore: result.overallScore,
            itemCount: evalItems.length,
            judgeScore: ja?.overallJudgeScore,
          })
        }
      }
    }

    // Generate + eval from each raw LLM provider
    for (const provider of providers) {
      try {
        const items = await generateFromProvider(provider, params)
        if (items.length === 0) {
          allResults.push({ destination: dest.destination, provider: provider.id, overallScore: 0, itemCount: 0, error: 'Empty generation' })
          continue
        }

        const result = await evaluateItinerary(items, dest.destination, dest.country, dest.vibes)
        const ja = judge ? await judgeItinerary(items, dest.destination, dest.country, dest.vibes, result.dimensions) : null

        await db.from('eval_results').insert({
          run_id: runId,
          llm_provider: provider.id,
          destination: dest.destination,
          country: dest.country,
          vibes: dest.vibes,
          days: dest.days,
          item_count: items.length,
          overall_score: result.overallScore,
          dimension_scores: result.dimensions,
          items_snapshot: items,
          judge_analysis: ja,
        })

        allResults.push({
          destination: dest.destination,
          provider: provider.id,
          overallScore: result.overallScore,
          itemCount: items.length,
          judgeScore: ja?.overallJudgeScore,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        allResults.push({ destination: dest.destination, provider: provider.id, overallScore: 0, itemCount: 0, error: errorMsg })

        await db.from('eval_results').insert({
          run_id: runId,
          llm_provider: provider.id,
          destination: dest.destination,
          country: dest.country,
          vibes: dest.vibes,
          days: dest.days,
          overall_score: 0,
          dimension_scores: {},
          error: errorMsg,
        })
      }
    }
  }

  // Aggregate
  const byProvider: Record<string, number[]> = {}
  for (const r of allResults.filter(r => !r.error)) {
    if (!byProvider[r.provider]) byProvider[r.provider] = []
    byProvider[r.provider].push(r.overallScore)
  }
  const avgByProvider: Record<string, number> = {}
  for (const [prov, scores] of Object.entries(byProvider)) {
    avgByProvider[prov] = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
  }

  // Complete run
  if (runId) {
    await db.from('eval_runs').update({
      status: 'completed',
      completed_tasks: allResults.filter(r => !r.error).length,
      failed_tasks: allResults.filter(r => r.error).length,
      aggregate_scores: { avgByProvider },
      completed_at: new Date().toISOString(),
    }).eq('id', runId)
  }

  return NextResponse.json({
    runId,
    availableProviders: providers.map(p => ({ id: p.id, name: p.name })),
    results: allResults,
    avgByProvider,
  })
}
