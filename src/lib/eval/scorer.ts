// ─── Itinerary Quality Scorer ─────────────────────────────────
// Scores generated itineraries across 7 dimensions.
// Split must-see into: landmark coverage (iconic places) + vibe must-haves (best-for-this-vibe).

import { verifyPlace } from './place-cache'
import type {
  EvalItem, EvalResult, DimensionScores,
  PlaceValidityScore, VibeMatchScore, LandmarkCoverageScore, VibeMustHavesScore,
  PriceRealismScore, DayBalanceScore, RatingQualityScore,
} from './types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// ─── Dimension Weights (7 dimensions, sum = 1.0) ────────────

const WEIGHTS = {
  placeValidity: 0.20,
  vibeMatch: 0.15,
  landmarkCoverage: 0.15,
  vibeMustHaves: 0.20,
  priceRealism: 0.10,
  dayBalance: 0.10,
  ratingQuality: 0.10,
}

// ─── Main Eval Function ──────────────────────────────────────

export async function evaluateItinerary(
  items: EvalItem[],
  destination: string,
  country: string,
  vibes: string[],
): Promise<EvalResult> {
  const realItems = items.filter(i => ['hotel', 'activity', 'food'].includes(i.category))

  const [placeValidity, vibeMatchResult, landmarkAndVibeMustHaves, priceRealism, dayBalance, ratingQuality] = await Promise.all([
    evalPlaceValidity(realItems, destination, country),
    evalVibeMatch(realItems, destination, country, vibes),
    evalLandmarksAndVibeMustHaves(realItems, destination, country, vibes),
    evalPriceRealism(realItems, destination),
    evalDayBalance(items),
    evalRatingQuality(realItems),
  ])

  const overallScore = Math.round(
    placeValidity.score * WEIGHTS.placeValidity +
    vibeMatchResult.score * WEIGHTS.vibeMatch +
    landmarkAndVibeMustHaves.landmarks.score * WEIGHTS.landmarkCoverage +
    landmarkAndVibeMustHaves.vibeMustHaves.score * WEIGHTS.vibeMustHaves +
    priceRealism.score * WEIGHTS.priceRealism +
    dayBalance.score * WEIGHTS.dayBalance +
    ratingQuality.score * WEIGHTS.ratingQuality
  )

  const dimensions: DimensionScores = {
    placeValidity,
    vibeMatch: vibeMatchResult,
    landmarkCoverage: landmarkAndVibeMustHaves.landmarks,
    vibeMustHaves: landmarkAndVibeMustHaves.vibeMustHaves,
    priceRealism,
    dayBalance,
    ratingQuality,
  }

  return {
    destination,
    vibes,
    overallScore,
    dimensions,
    summary: buildSummary(overallScore, dimensions),
  }
}

// ─── Dimension 1: Place Validity (cached) ────────────────────

async function evalPlaceValidity(
  items: EvalItem[], destination: string, country: string,
): Promise<PlaceValidityScore> {
  const invalid: string[] = []
  let verified = 0

  const sample = items.slice(0, 8)

  const results = await Promise.all(
    sample.map(item =>
      verifyPlace(item.name, destination, country)
        .then(r => ({ name: item.name, exists: r.exists }))
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

// ─── Dimension 2: Vibe Match ─────────────────────────────────

async function evalVibeMatch(
  items: EvalItem[], destination: string, country: string, vibes: string[],
): Promise<VibeMatchScore> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { score: 50, matched: 0, total: 0, mismatches: [] }

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
  "mismatches": ["Place Name — why it doesn't match the ${vibeStr} vibes"]
}

"vibeMatchPercent" = what % of the listed items genuinely match ${vibeStr} vibes.
"mismatches" = items that clearly don't fit the requested vibes.
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

    const mismatches = (result.mismatches || []) as string[]
    return {
      score: result.vibeMatchPercent || 50,
      matched: items.length - mismatches.length,
      total: items.length,
      mismatches,
    }
  } catch {
    return { score: 50, matched: 0, total: items.length, mismatches: [] }
  }
}

// ─── Dimensions 3 & 4: Landmark Coverage + Vibe Must-Haves ──

async function evalLandmarksAndVibeMustHaves(
  items: EvalItem[], destination: string, country: string, vibes: string[],
): Promise<{
  landmarks: LandmarkCoverageScore
  vibeMustHaves: VibeMustHavesScore
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      landmarks: { score: 50, hit: 0, total: 0, landmarks: [], missing: [] },
      vibeMustHaves: { score: 50, hit: 0, total: 0, vibeMustHaves: [], missing: [] },
    }
  }

  const itemNames = items.map(i => `${i.name} (${i.category})`).join(', ')
  const vibeStr = vibes.join(', ')

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Analyze this ${destination}, ${country} itinerary.

Items: ${itemNames}

Return JSON with TWO separate lists:

{
  "landmarks": ["Place 1", "Place 2", "Place 3", "Place 4", "Place 5"],
  "landmarksPresent": ["Place 1"],
  "landmarksMissing": ["Place 2", "Place 3", "Place 4", "Place 5"],
  "vibeMustHaves": ["Place A", "Place B", "Place C", "Place D", "Place E"],
  "vibeMustHavesPresent": ["Place A", "Place B"],
  "vibeMustHavesMissing": ["Place C", "Place D", "Place E"]
}

"landmarks" = the 5 iconic, universally recognized landmarks/attractions in ${destination} that ANY tourist should see regardless of their travel style. Think: the places that appear on every postcard, travel guide, and "top 10" list.

"vibeMustHaves" = the 5 BEST places in ${destination} specifically for someone traveling with "${vibeStr}" vibes. These should NOT be generic landmarks — they should be the places a local would recommend to someone who specifically wants ${vibeStr} experiences. For example: if vibes are "foodie", list the best food spots, not temples. If vibes are "adventure", list thrill activities, not museums.

For both lists, check which items from the itinerary match (present) and which are missing.
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

    const landmarkList = (result.landmarks || []) as string[]
    const landmarkPresent = (result.landmarksPresent || []) as string[]
    const landmarkMissing = (result.landmarksMissing || []) as string[]

    const vibeList = (result.vibeMustHaves || []) as string[]
    const vibePresent = (result.vibeMustHavesPresent || []) as string[]
    const vibeMissing = (result.vibeMustHavesMissing || []) as string[]

    return {
      landmarks: {
        score: landmarkList.length > 0 ? Math.round((landmarkPresent.length / landmarkList.length) * 100) : 50,
        hit: landmarkPresent.length,
        total: landmarkList.length,
        landmarks: landmarkList,
        missing: landmarkMissing,
      },
      vibeMustHaves: {
        score: vibeList.length > 0 ? Math.round((vibePresent.length / vibeList.length) * 100) : 50,
        hit: vibePresent.length,
        total: vibeList.length,
        vibeMustHaves: vibeList,
        missing: vibeMissing,
      },
    }
  } catch {
    return {
      landmarks: { score: 50, hit: 0, total: 0, landmarks: [], missing: [] },
      vibeMustHaves: { score: 50, hit: 0, total: 0, vibeMustHaves: [], missing: [] },
    }
  }
}

// ─── Dimension 5: Price Realism ──────────────────────────────

async function evalPriceRealism(
  items: EvalItem[], destination: string,
): Promise<PriceRealismScore> {
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

  let score = 80
  let notes = `Avg: $${avg}, Max: $${max}, ${freeCount} free items`

  if (max > 500) { score -= 15; notes += '. Some prices seem high.' }
  if (avg < 5 && destination.toLowerCase() !== 'free') { score -= 20; notes += '. Prices seem too low.' }
  if (freeCount > items.length * 0.6) { score -= 10; notes += '. Too many free items.' }

  return { score: Math.max(0, Math.min(100, score)), notes }
}

// ─── Dimension 6: Day Balance ────────────────────────────────

async function evalDayBalance(items: EvalItem[]): Promise<DayBalanceScore> {
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

// ─── Dimension 7: Rating Quality ─────────────────────────────

async function evalRatingQuality(items: EvalItem[]): Promise<RatingQualityScore> {
  const ratings = items
    .map(i => i.metadata?.rating as number)
    .filter(r => r && r > 0)

  if (ratings.length === 0) return { score: 40, avgRating: 0, ratedCount: 0, total: items.length }

  const avg = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
  const coverageScore = Math.round((ratings.length / items.length) * 50)
  const qualityScore = avg >= 4.5 ? 50 : avg >= 4.0 ? 40 : avg >= 3.5 ? 30 : 20

  return { score: coverageScore + qualityScore, avgRating: avg, ratedCount: ratings.length, total: items.length }
}

// ─── Summary Builder ─────────────────────────────────────────

function buildSummary(overall: number, dims: DimensionScores): string {
  const parts: string[] = []

  if (overall >= 85) parts.push('Excellent itinerary — investor-ready.')
  else if (overall >= 70) parts.push('Good itinerary with minor gaps.')
  else if (overall >= 50) parts.push('Needs improvement — some issues found.')
  else parts.push('Significant quality issues detected.')

  if (dims.placeValidity.invalid.length > 0) parts.push(`${dims.placeValidity.invalid.length} places couldn't be verified on Google Maps.`)
  if (dims.landmarkCoverage.missing.length > 0) parts.push(`Missing landmarks: ${dims.landmarkCoverage.missing.join(', ')}.`)
  if (dims.vibeMustHaves.missing.length > 0) parts.push(`Missing vibe picks: ${dims.vibeMustHaves.missing.join(', ')}.`)
  if (dims.vibeMatch.score < 70) parts.push('Some items don\'t match the requested vibes.')
  if (dims.priceRealism.score < 60) parts.push(dims.priceRealism.notes)

  return parts.join(' ')
}
