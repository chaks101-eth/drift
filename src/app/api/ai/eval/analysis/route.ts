import { NextRequest, NextResponse } from 'next/server'
import { loadEvalResults, analyzeResults, deepAnalysis } from '@/lib/eval/analyzer'

export const maxDuration = 120

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

// POST /api/ai/eval/analysis — run pattern analysis across eval results
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { runId, provider, deep } = await req.json() as {
    runId?: string
    provider?: string
    deep?: boolean
  }

  const results = await loadEvalResults(runId, provider)
  if (results.length === 0) {
    return NextResponse.json({ error: 'No eval results found' }, { status: 404 })
  }

  const analysis = analyzeResults(results)

  if (deep) {
    analysis.llmInsights = await deepAnalysis(analysis)
  }

  return NextResponse.json(analysis)
}
