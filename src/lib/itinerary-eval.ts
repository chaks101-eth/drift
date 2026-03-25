// ─── Itinerary Quality Evaluation ─────────────────────────────
// Automated scoring of generated itineraries across multiple dimensions.
// Uses Google Places to verify places exist + Gemini grounding to
// check vibe relevance and must-see coverage.
//
// Dimensions:
//   1. Place Validity — does it exist on Google Maps?
//   2. Vibe Match — does each place fit the requested vibes?
//   3. Must-See Coverage — are consensus must-sees included?
//   4. Price Realism — are prices in the right range for this destination?
//   5. Day Balance — are days evenly loaded?
//   6. Rating Quality — are we suggesting well-rated places?

import { getPlaceData } from './google-places-photos'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export interface EvalItem {
  name: string
  category: string
  price: string
  metadata: Record<string, unknown>
}

export interface EvalResult {
  destination: string
  vibes: string[]
  overallScore: number // 0-100
  dimensions: {
    placeValidity: { score: number; verified: number; total: number; invalid: string[] }
    vibeMatch: { score: number; matched: number; total: number; mismatches: string[] }
    mustSeeCoverage: { score: number; hit: number; total: number; mustSees: string[]; missing: string[] }
    priceRealism: { score: number; notes: string }
    dayBalance: { score: number; itemsPerDay: number[]; notes: string }
    ratingQuality: { score: number; avgRating: number; ratedCount: number; total: number }
  }
  summary: string
}

/**
 * Evaluate an itinerary's quality across all dimensions.
 */
export async function evaluateItinerary(
  items: EvalItem[],
  destination: string,
  country: string,
  vibes: string[],
): Promise<EvalResult> {
  const realItems = items.filter(i => ['hotel', 'activity', 'food'].includes(i.category))

  // Run all evaluations in parallel
  const [placeValidity, vibeAndMustSee, priceRealism, dayBalance, ratingQuality] = await Promise.all([
    evalPlaceValidity(realItems, destination, country),
    evalVibeMatchAndMustSees(realItems, destination, country, vibes),
    evalPriceRealism(realItems, destination, country),
    evalDayBalance(items),
    evalRatingQuality(realItems),
  ])

  const overallScore = Math.round(
    placeValidity.score * 0.25 +
    vibeAndMustSee.vibeMatch.score * 0.20 +
    vibeAndMustSee.mustSeeCoverage.score * 0.25 +
    priceRealism.score * 0.10 +
    dayBalance.score * 0.10 +
    ratingQuality.score * 0.10
  )

  const summary = buildSummary(overallScore, placeValidity, vibeAndMustSee, priceRealism)

  return {
    destination,
    vibes,
    overallScore,
    dimensions: {
      placeValidity,
      vibeMatch: vibeAndMustSee.vibeMatch,
      mustSeeCoverage: vibeAndMustSee.mustSeeCoverage,
      priceRealism,
      dayBalance,
      ratingQuality,
    },
    summary,
  }
}

// ─── Dimension 1: Place Validity ────────────────────────────────

async function evalPlaceValidity(
  items: EvalItem[], destination: string, country: string,
): Promise<{ score: number; verified: number; total: number; invalid: string[] }> {
  const invalid: string[] = []
  let verified = 0

  // Check a sample (max 8 items to avoid too many API calls)
  const sample = items.slice(0, 8)

  const results = await Promise.all(
    sample.map(item =>
      getPlaceData(item.name, destination, country)
        .then(data => ({ name: item.name, exists: !!data }))
        .catch(() => ({ name: item.name, exists: false }))
    )
  )

  for (const r of results) {
    if (r.exists) verified++
    else invalid.push(r.name)
  }

  const score = sample.length > 0 ? Math.round((verified / sample.length) * 100) : 0
  return { score, verified, total: sample.length, invalid }
}

// ─── Dimensions 2 & 3: Vibe Match + Must-See Coverage ────────────

async function evalVibeMatchAndMustSees(
  items: EvalItem[], destination: string, country: string, vibes: string[],
): Promise<{
  vibeMatch: { score: number; matched: number; total: number; mismatches: string[] }
  mustSeeCoverage: { score: number; hit: number; total: number; mustSees: string[]; missing: string[] }
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      vibeMatch: { score: 50, matched: 0, total: 0, mismatches: [] },
      mustSeeCoverage: { score: 50, hit: 0, total: 0, mustSees: [], missing: [] },
    }
  }

  const itemNames = items.map(i => `${i.name} (${i.category})`).join(', ')
  const vibeStr = vibes.join(', ')

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Evaluate this ${destination}, ${country} itinerary for "${vibeStr}" vibes.

Items: ${itemNames}

Return JSON:
{
  "vibeMatchPercent": 0-100,
  "mismatches": ["Place Name — why it doesn't match the vibes"],
  "mustSees": ["Place 1", "Place 2", "Place 3", "Place 4", "Place 5"],
  "mustSeesPresent": ["Place 1", "Place 3"],
  "mustSeesMissing": ["Place 2", "Place 4", "Place 5"],
  "priceRealistic": true/false,
  "priceNotes": "one line"
}

"mustSees" = the 5 absolute must-visit places in ${destination} for ${vibeStr} vibes.
"vibeMatchPercent" = what % of the listed items genuinely match ${vibeStr} vibes.
"mismatches" = items that don't fit the vibes at all.
JSON only.` }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : cleaned)

    const mustSees = (result.mustSees || []) as string[]
    const present = (result.mustSeesPresent || []) as string[]
    const missing = (result.mustSeesMissing || []) as string[]
    const mismatches = (result.mismatches || []) as string[]

    return {
      vibeMatch: {
        score: result.vibeMatchPercent || 50,
        matched: items.length - mismatches.length,
        total: items.length,
        mismatches,
      },
      mustSeeCoverage: {
        score: mustSees.length > 0 ? Math.round((present.length / mustSees.length) * 100) : 50,
        hit: present.length,
        total: mustSees.length,
        mustSees,
        missing,
      },
    }
  } catch {
    return {
      vibeMatch: { score: 50, matched: 0, total: items.length, mismatches: [] },
      mustSeeCoverage: { score: 50, hit: 0, total: 0, mustSees: [], missing: [] },
    }
  }
}

// ─── Dimension 4: Price Realism ─────────────────────────────────

async function evalPriceRealism(
  items: EvalItem[], destination: string, _country: string,
): Promise<{ score: number; notes: string }> {
  const prices = items
    .map(i => parseFloat(i.price.replace(/[^0-9.]/g, '')) || 0)
    .filter(p => p > 0)

  if (prices.length === 0) return { score: 50, notes: 'No prices to evaluate' }

  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
  const max = Math.max(...prices)
  const freeCount = items.filter(i => {
    const p = parseFloat(i.price.replace(/[^0-9.]/g, '')) || 0
    return p === 0 || i.price.toLowerCase().includes('free')
  }).length

  // Basic heuristics
  let score = 80
  let notes = `Avg: $${avg}, Max: $${max}, ${freeCount} free items`

  if (max > 500) { score -= 15; notes += '. Some prices seem high.' }
  if (avg < 5 && destination.toLowerCase() !== 'free') { score -= 20; notes += '. Prices seem too low.' }
  if (freeCount > items.length * 0.6) { score -= 10; notes += '. Too many free items.' }

  return { score: Math.max(0, Math.min(100, score)), notes }
}

// ─── Dimension 5: Day Balance ───────────────────────────────────

async function evalDayBalance(
  items: EvalItem[],
): Promise<{ score: number; itemsPerDay: number[]; notes: string }> {
  const itemsPerDay: number[] = []
  let currentCount = 0
  let dayStarted = false

  for (const item of items) {
    if (item.category === 'day') {
      if (dayStarted) itemsPerDay.push(currentCount)
      currentCount = 0
      dayStarted = true
    } else if (['hotel', 'activity', 'food'].includes(item.category)) {
      currentCount++
    }
  }
  if (dayStarted) itemsPerDay.push(currentCount)

  if (itemsPerDay.length === 0) return { score: 50, itemsPerDay: [], notes: 'No days found' }

  const avg = itemsPerDay.reduce((s, n) => s + n, 0) / itemsPerDay.length
  const emptyDays = itemsPerDay.filter(n => n === 0).length
  const overloadedDays = itemsPerDay.filter(n => n > 7).length
  const variance = itemsPerDay.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / itemsPerDay.length

  let score = 90
  if (emptyDays > 0) score -= emptyDays * 25
  if (overloadedDays > 0) score -= overloadedDays * 10
  if (variance > 4) score -= 10

  const notes = `${itemsPerDay.join(', ')} items/day. ${emptyDays > 0 ? `${emptyDays} empty days!` : 'No empty days.'}`

  return { score: Math.max(0, Math.min(100, score)), itemsPerDay, notes }
}

// ─── Dimension 6: Rating Quality ────────────────────────────────

async function evalRatingQuality(
  items: EvalItem[],
): Promise<{ score: number; avgRating: number; ratedCount: number; total: number }> {
  const ratings = items
    .map(i => i.metadata?.rating as number)
    .filter(r => r && r > 0)

  if (ratings.length === 0) return { score: 40, avgRating: 0, ratedCount: 0, total: items.length }

  const avg = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
  const coverageScore = Math.round((ratings.length / items.length) * 50) // 0-50 for coverage
  const qualityScore = avg >= 4.5 ? 50 : avg >= 4.0 ? 40 : avg >= 3.5 ? 30 : 20 // 0-50 for quality

  return {
    score: coverageScore + qualityScore,
    avgRating: avg,
    ratedCount: ratings.length,
    total: items.length,
  }
}

// ─── Summary Builder ────────────────────────────────────────────

function buildSummary(
  overall: number,
  validity: { score: number; invalid: string[] },
  vibeAndMust: { vibeMatch: { score: number }; mustSeeCoverage: { score: number; missing: string[] } },
  price: { notes: string },
): string {
  const parts: string[] = []

  if (overall >= 85) parts.push('Excellent itinerary — investor-ready.')
  else if (overall >= 70) parts.push('Good itinerary with minor gaps.')
  else if (overall >= 50) parts.push('Needs improvement — some issues found.')
  else parts.push('Significant quality issues detected.')

  if (validity.invalid.length > 0) parts.push(`${validity.invalid.length} places couldn't be verified on Google Maps.`)
  if (vibeAndMust.mustSeeCoverage.missing.length > 0) parts.push(`Missing must-sees: ${vibeAndMust.mustSeeCoverage.missing.join(', ')}.`)
  if (vibeAndMust.vibeMatch.score < 70) parts.push('Some items don\'t match the requested vibes.')

  return parts.join(' ')
}

// ─── Benchmark: Raw LLM vs Drift ─────────────────────────────
// Generates a "raw LLM" itinerary (same model, basic prompt, no infrastructure)
// and evals it with the same dimensions. Shows the value Drift adds.

export interface BenchmarkResult {
  destination: string
  vibes: string[]
  drift: EvalResult
  rawLlm: EvalResult
  delta: { overall: number; placeValidity: number; vibeMatch: number; mustSee: number; ratings: number }
}

/**
 * Generate a raw LLM itinerary (no grounding, no Places, no catalog)
 * and parse it into EvalItems for scoring.
 */
export async function generateRawLlmItinerary(
  destination: string,
  country: string,
  vibes: string[],
  days: number,
): Promise<EvalItem[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Plan a ${days}-day ${vibes.join(', ')} trip to ${destination}, ${country} for 2 travelers on a mid budget.

Return a JSON array of items:
[{"category":"day|hotel|activity|food","name":"Specific Place Name","price":"$XX","metadata":{}}]

Include: 1 hotel, then for each day: a day separator + 3-4 activities/restaurants.
Use REAL place names. JSON only, no markdown.` }] }],
      }),
    })

    if (!res.ok) return []
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []

    const items = JSON.parse(match[0]) as Array<{ category: string; name: string; price?: string; metadata?: Record<string, unknown> }>
    return items.map(i => ({
      name: i.name || '',
      category: i.category || 'activity',
      price: i.price || '',
      metadata: i.metadata || {},
    }))
  } catch {
    return []
  }
}

/**
 * Run a full benchmark: Drift pipeline vs raw LLM on same destination + vibes.
 * Both outputs scored with identical eval dimensions.
 */
export async function benchmarkVsRawLlm(
  driftItems: EvalItem[],
  destination: string,
  country: string,
  vibes: string[],
  days: number,
): Promise<BenchmarkResult> {
  // Generate raw LLM itinerary
  const rawItems = await generateRawLlmItinerary(destination, country, vibes, days)

  // Eval both with same dimensions
  const [driftEval, rawEval] = await Promise.all([
    evaluateItinerary(driftItems, destination, country, vibes),
    evaluateItinerary(rawItems, destination, country, vibes),
  ])

  return {
    destination,
    vibes,
    drift: driftEval,
    rawLlm: rawEval,
    delta: {
      overall: driftEval.overallScore - rawEval.overallScore,
      placeValidity: driftEval.dimensions.placeValidity.score - rawEval.dimensions.placeValidity.score,
      vibeMatch: driftEval.dimensions.vibeMatch.score - rawEval.dimensions.vibeMatch.score,
      mustSee: driftEval.dimensions.mustSeeCoverage.score - rawEval.dimensions.mustSeeCoverage.score,
      ratings: driftEval.dimensions.ratingQuality.score - rawEval.dimensions.ratingQuality.score,
    },
  }
}
