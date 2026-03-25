// ─── LLM-as-Judge ────────────────────────────────────────────
// Deep qualitative analysis of itineraries beyond dimension scores.
// Evaluates narrative coherence, local authenticity, temporal logic,
// experience diversity, practical feasibility, and hallucination risk.

import type { EvalItem, JudgeAnalysis, DimensionScores } from './types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * Run LLM-as-judge analysis on an itinerary.
 */
export async function judgeItinerary(
  items: EvalItem[],
  destination: string,
  country: string,
  vibes: string[],
  dimensionScores: DimensionScores,
): Promise<JudgeAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const itemList = items
    .filter(i => i.category !== 'day')
    .map((item, idx) => {
      const meta = item.metadata || {}
      const time = meta.time || meta.best_time || ''
      const rating = meta.rating ? `★${meta.rating}` : ''
      const lat = meta.lat ? `(${meta.lat},${meta.lng})` : ''
      return `${idx + 1}. [${item.category}] ${item.name} — ${item.price} ${time} ${rating} ${lat}`.trim()
    })
    .join('\n')

  const dayStructure = items
    .filter(i => i.category === 'day')
    .map(d => d.name)
    .join(', ')

  const scoreSummary = `Place Validity: ${dimensionScores.placeValidity.score}/100, ` +
    `Vibe Match: ${dimensionScores.vibeMatch.score}/100, ` +
    `Landmarks: ${dimensionScores.landmarkCoverage.score}/100, ` +
    `Vibe Must-Haves: ${dimensionScores.vibeMustHaves.score}/100, ` +
    `Price: ${dimensionScores.priceRealism.score}/100, ` +
    `Day Balance: ${dimensionScores.dayBalance.score}/100, ` +
    `Ratings: ${dimensionScores.ratingQuality.score}/100`

  const prompt = `You are a travel itinerary quality judge. Analyze this ${destination}, ${country} itinerary planned for "${vibes.join(', ')}" vibes.

DAY STRUCTURE: ${dayStructure || 'Not specified'}

ITEMS:
${itemList}

AUTOMATED SCORES: ${scoreSummary}

Evaluate the itinerary on these 6 qualitative dimensions (0-100 each):

1. **Narrative Coherence** — Does each day flow logically? Are nearby places grouped? Is there a natural morning→afternoon→evening rhythm? Or does it zigzag across the city?

2. **Local Authenticity** — Are these genuinely good local picks or generic tourist traps? Would a well-traveled local recommend these? Look for hidden gems vs "every travel blog" picks.

3. **Temporal Logic** — Are restaurants suggested at meal times? Nightlife in the evening? Markets in the morning? Outdoor activities at reasonable times? Check for timing impossibilities.

4. **Experience Diversity** — Is there variety? Multiple categories (culture, food, nature, nightlife)? Or repetitive (3 temples in a row, 4 similar restaurants)? Rate the mix.

5. **Practical Feasibility** — Can a traveler realistically do everything listed in each day? Consider transit times, opening hours, energy levels. Are there impossibly packed days?

6. **Hallucination Risk** — Based on your knowledge, do all these places likely exist and match their descriptions? Flag anything that seems fabricated, mislocated, or misattributed. Score 100 = no hallucinations detected, 0 = many suspicious items.

Return ONLY this JSON (no markdown, no explanation):
{
  "qualitativeScores": {
    "narrativeCoherence": <0-100>,
    "localAuthenticity": <0-100>,
    "temporalLogic": <0-100>,
    "experienceDiversity": <0-100>,
    "practicalFeasibility": <0-100>,
    "hallucinationRisk": <0-100>
  },
  "overallJudgeScore": <0-100 weighted average>,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["actionable fix 1", "actionable fix 2"],
  "flaggedItems": [
    {"name": "Place Name", "issue": "description of problem", "severity": "low|medium|high"}
  ]
}`

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!res.ok) throw new Error(`Judge API ${res.status}`)
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    const result = JSON.parse(match ? match[0] : cleaned)

    return {
      qualitativeScores: {
        narrativeCoherence: result.qualitativeScores?.narrativeCoherence ?? 50,
        localAuthenticity: result.qualitativeScores?.localAuthenticity ?? 50,
        temporalLogic: result.qualitativeScores?.temporalLogic ?? 50,
        experienceDiversity: result.qualitativeScores?.experienceDiversity ?? 50,
        practicalFeasibility: result.qualitativeScores?.practicalFeasibility ?? 50,
        hallucinationRisk: result.qualitativeScores?.hallucinationRisk ?? 50,
      },
      overallJudgeScore: result.overallJudgeScore ?? 50,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      recommendations: result.recommendations || [],
      flaggedItems: (result.flaggedItems || []).map((f: Record<string, string>) => ({
        name: f.name || '',
        issue: f.issue || '',
        severity: (['low', 'medium', 'high'].includes(f.severity) ? f.severity : 'medium') as 'low' | 'medium' | 'high',
      })),
    }
  } catch (err) {
    console.error('[Judge] Failed:', err)
    return null
  }
}
