// ─── Cross-Eval Pattern Analyzer ─────────────────────────────
// Detects patterns and shortcomings across eval results.
// Two modes: heuristic (fast, no LLM) and LLM-powered (deeper insights).

import { createClient } from '@supabase/supabase-js'
import type { EvalPattern, AnalysisResult, DimensionScores, EvalResultRow } from './types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Load Results from DB ────────────────────────────────────

export async function loadEvalResults(
  runId?: string,
  provider?: string,
): Promise<EvalResultRow[]> {
  const db = getAdminClient()
  let query = db.from('eval_results').select('*').order('created_at', { ascending: false })

  if (runId) query = query.eq('run_id', runId)
  if (provider) query = query.eq('llm_provider', provider)

  const { data } = await query.limit(500)
  return (data || []) as EvalResultRow[]
}

// ─── Heuristic Analysis ──────────────────────────────────────

export function analyzeResults(results: EvalResultRow[]): AnalysisResult {
  if (results.length === 0) {
    return {
      totalEvals: 0, avgOverallScore: 0, scoreDistribution: [],
      byDestination: {}, byDimension: {}, patterns: [],
    }
  }

  const totalEvals = results.length
  const avgOverallScore = Math.round(results.reduce((s, r) => s + r.overall_score, 0) / totalEvals)

  // Score distribution
  const buckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }
  for (const r of results) {
    if (r.overall_score <= 20) buckets['0-20']++
    else if (r.overall_score <= 40) buckets['21-40']++
    else if (r.overall_score <= 60) buckets['41-60']++
    else if (r.overall_score <= 80) buckets['61-80']++
    else buckets['81-100']++
  }
  const scoreDistribution = Object.entries(buckets).map(([range, count]) => ({ range, count }))

  // By destination
  const byDestination: Record<string, { scores: number[]; dimensions: Record<string, number[]> }> = {}
  for (const r of results) {
    const dest = r.destination
    if (!byDestination[dest]) byDestination[dest] = { scores: [], dimensions: {} }
    byDestination[dest].scores.push(r.overall_score)

    const dims = r.dimension_scores as DimensionScores
    if (dims) {
      for (const [key, val] of Object.entries(dims)) {
        if (!byDestination[dest].dimensions[key]) byDestination[dest].dimensions[key] = []
        byDestination[dest].dimensions[key].push((val as { score: number }).score)
      }
    }
  }

  const byDestinationSummary: Record<string, { avgScore: number; count: number; weakestDimension: string }> = {}
  for (const [dest, data] of Object.entries(byDestination)) {
    const avgScore = Math.round(data.scores.reduce((s, n) => s + n, 0) / data.scores.length)
    let weakestDim = ''
    let weakestAvg = 100
    for (const [dim, scores] of Object.entries(data.dimensions)) {
      const dimAvg = scores.reduce((s, n) => s + n, 0) / scores.length
      if (dimAvg < weakestAvg) { weakestAvg = dimAvg; weakestDim = dim }
    }
    byDestinationSummary[dest] = { avgScore, count: data.scores.length, weakestDimension: weakestDim }
  }

  // By dimension
  const dimAggs: Record<string, number[]> = {}
  for (const r of results) {
    const dims = r.dimension_scores as DimensionScores
    if (!dims) continue
    for (const [key, val] of Object.entries(dims)) {
      if (!dimAggs[key]) dimAggs[key] = []
      dimAggs[key].push((val as { score: number }).score)
    }
  }

  const byDimension: Record<string, { avgScore: number; lowestDestination: string }> = {}
  for (const [dim, scores] of Object.entries(dimAggs)) {
    const avgScore = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
    // Find which destination scores lowest on this dimension
    let lowestDest = ''
    let lowestAvg = 100
    for (const [dest, data] of Object.entries(byDestination)) {
      const destDimScores = data.dimensions[dim] || []
      if (destDimScores.length > 0) {
        const destAvg = destDimScores.reduce((s, n) => s + n, 0) / destDimScores.length
        if (destAvg < lowestAvg) { lowestAvg = destAvg; lowestDest = dest }
      }
    }
    byDimension[dim] = { avgScore, lowestDestination: lowestDest }
  }

  // Detect patterns
  const patterns: EvalPattern[] = []

  // Pattern: Consistently low-scoring destinations
  for (const [dest, data] of Object.entries(byDestinationSummary)) {
    if (data.avgScore < 50 && data.count >= 2) {
      patterns.push({
        type: 'destination_weakness',
        severity: data.avgScore < 30 ? 'high' : 'medium',
        title: `${dest} consistently scores low`,
        description: `Average score ${data.avgScore}/100 across ${data.count} evals. Weakest: ${data.weakestDimension}.`,
        affectedTrips: data.count,
        examples: [],
        suggestedFix: `Review catalog data for ${dest}. Consider enriching ${data.weakestDimension} dimension.`,
      })
    }
  }

  // Pattern: Systemic dimension weakness
  for (const [dim, data] of Object.entries(byDimension)) {
    if (data.avgScore < 50) {
      patterns.push({
        type: 'dimension_weakness',
        severity: data.avgScore < 30 ? 'high' : 'medium',
        title: `${dim} is systemically weak`,
        description: `Average ${data.avgScore}/100 across all evals. Worst in ${data.lowestDestination}.`,
        affectedTrips: totalEvals,
        examples: [],
        suggestedFix: `Improve ${dim} scoring pipeline or generation prompt.`,
      })
    }
  }

  // Pattern: Common hallucinations (invalid places appearing in multiple evals)
  const invalidPlaceCounts: Record<string, number> = {}
  for (const r of results) {
    const dims = r.dimension_scores as DimensionScores
    if (dims?.placeValidity?.invalid) {
      for (const place of dims.placeValidity.invalid) {
        invalidPlaceCounts[place] = (invalidPlaceCounts[place] || 0) + 1
      }
    }
  }
  const repeatedInvalid = Object.entries(invalidPlaceCounts).filter(([, count]) => count >= 2)
  if (repeatedInvalid.length > 0) {
    patterns.push({
      type: 'common_hallucination',
      severity: 'high',
      title: `${repeatedInvalid.length} places repeatedly fail verification`,
      description: 'These places appear in multiple itineraries but cannot be found on Google Maps.',
      affectedTrips: repeatedInvalid.reduce((s, [, c]) => s + c, 0),
      examples: repeatedInvalid.slice(0, 5).map(([name, count]) => `${name} (${count} times)`),
      suggestedFix: 'Add these to a blocklist in the generation prompt or verify/fix their names.',
    })
  }

  return {
    totalEvals,
    avgOverallScore,
    scoreDistribution,
    byDestination: byDestinationSummary,
    byDimension,
    patterns,
  }
}

// ─── LLM-Powered Deep Analysis ──────────────────────────────

export async function deepAnalysis(analysis: AnalysisResult): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return 'No Gemini API key — cannot run deep analysis.'

  const prompt = `You are a travel AI quality analyst. Analyze these itinerary evaluation results and provide actionable insights.

SUMMARY:
- Total evals: ${analysis.totalEvals}
- Average score: ${analysis.avgOverallScore}/100
- Score distribution: ${JSON.stringify(analysis.scoreDistribution)}

BY DESTINATION:
${Object.entries(analysis.byDestination).map(([d, s]) => `  ${d}: avg ${s.avgScore}, ${s.count} evals, weakest: ${s.weakestDimension}`).join('\n')}

BY DIMENSION:
${Object.entries(analysis.byDimension).map(([d, s]) => `  ${d}: avg ${s.avgScore}, lowest in ${s.lowestDestination}`).join('\n')}

DETECTED PATTERNS:
${analysis.patterns.map(p => `  [${p.severity}] ${p.title}: ${p.description}`).join('\n')}

Provide:
1. **Top 3 systemic issues** that would most improve quality if fixed
2. **Destination-specific recommendations** for the weakest performers
3. **Generation prompt improvements** — specific wording changes to reduce hallucinations and improve vibe matching
4. **Catalog gaps** — what data is missing that would improve scores
5. **Priority ranking** — what to fix first for maximum impact

Be specific and actionable. Reference specific destinations and dimensions.`

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!res.ok) return `Deep analysis failed: API ${res.status}`
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from analysis.'
  } catch (err) {
    return `Deep analysis failed: ${err}`
  }
}
