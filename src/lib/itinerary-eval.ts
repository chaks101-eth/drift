// ─── Legacy Re-export ────────────────────────────────────────
// Preserved for backward compatibility. All logic now lives in src/lib/eval/.

export { evaluateItinerary } from './eval/scorer'
export type { EvalItem, EvalResult } from './eval/types'

// Legacy benchmark function — now uses the new multi-provider system
// but maintains the same interface for existing callers.
import { evaluateItinerary } from './eval/scorer'
import { getProviders, generateFromProvider } from './eval/benchmark'
import type { EvalItem, EvalResult } from './eval/types'

export interface BenchmarkResult {
  destination: string
  vibes: string[]
  drift: EvalResult
  rawLlm: EvalResult
  delta: { overall: number; placeValidity: number; vibeMatch: number; landmarks: number; vibeMustHaves: number; ratings: number }
}

export async function benchmarkVsRawLlm(
  driftItems: EvalItem[],
  destination: string,
  country: string,
  vibes: string[],
  days: number,
): Promise<BenchmarkResult> {
  const providers = getProviders(['gemini-raw'])
  const gemini = providers[0]

  let rawItems: EvalItem[] = []
  if (gemini) {
    rawItems = await generateFromProvider(gemini, {
      destination, country, vibes, days, travelers: 2, budget: 'mid',
    })
  }

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
      landmarks: driftEval.dimensions.landmarkCoverage.score - rawEval.dimensions.landmarkCoverage.score,
      vibeMustHaves: driftEval.dimensions.vibeMustHaves.score - rawEval.dimensions.vibeMustHaves.score,
      ratings: driftEval.dimensions.ratingQuality.score - rawEval.dimensions.ratingQuality.score,
    },
  }
}
