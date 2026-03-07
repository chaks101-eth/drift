import { NextRequest, NextResponse } from 'next/server'
import { runPipeline, runSingleStep, getPipelineRun, getCatalogStats } from '@/lib/pipeline'

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'drift-admin-2026'

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

// POST /api/admin/pipeline — run pipeline or individual step
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { city, country, vibes, language, timezone, best_months, step, destinationId } = body

  // Run a single step for an existing destination
  if (step && destinationId) {
    try {
      const result = await runSingleStep(destinationId, step, {
        city: city || '',
        country: country || '',
        vibes: vibes || [],
        language,
        timezone,
      })
      return NextResponse.json(result)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // Run full pipeline
  if (!city || !country) {
    return NextResponse.json({ error: 'city and country are required' }, { status: 400 })
  }

  try {
    const result = await runPipeline({
      city,
      country,
      vibes: vibes || [],
      language,
      timezone,
      best_months,
    })
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/admin/pipeline?runId=xxx — get run status
// GET /api/admin/pipeline — get catalog stats
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runId = req.nextUrl.searchParams.get('runId')

  if (runId) {
    const run = await getPipelineRun(runId)
    return NextResponse.json(run)
  }

  const stats = await getCatalogStats()
  return NextResponse.json(stats)
}
