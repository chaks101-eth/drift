// ─── Eval System Types ───────────────────────────────────────

export interface EvalItem {
  name: string
  category: string
  price: string
  metadata: Record<string, unknown>
}

// ─── Dimension Scores ────────────────────────────────────────

export interface PlaceValidityScore {
  score: number
  verified: number
  total: number
  invalid: string[]
}

export interface VibeMatchScore {
  score: number
  matched: number
  total: number
  mismatches: string[]
}

export interface LandmarkCoverageScore {
  score: number
  hit: number
  total: number
  landmarks: string[]
  missing: string[]
}

export interface VibeMustHavesScore {
  score: number
  hit: number
  total: number
  vibeMustHaves: string[]
  missing: string[]
}

export interface PriceRealismScore {
  score: number
  notes: string
}

export interface DayBalanceScore {
  score: number
  itemsPerDay: number[]
  notes: string
}

export interface RatingQualityScore {
  score: number
  avgRating: number
  ratedCount: number
  total: number
}

export interface DimensionScores {
  placeValidity: PlaceValidityScore
  vibeMatch: VibeMatchScore
  landmarkCoverage: LandmarkCoverageScore
  vibeMustHaves: VibeMustHavesScore
  priceRealism: PriceRealismScore
  dayBalance: DayBalanceScore
  ratingQuality: RatingQualityScore
}

// ─── Eval Result ─────────────────────────────────────────────

export interface EvalResult {
  destination: string
  vibes: string[]
  overallScore: number
  dimensions: DimensionScores
  summary: string
}

// ─── LLM-as-Judge ────────────────────────────────────────────

export interface JudgeAnalysis {
  qualitativeScores: {
    narrativeCoherence: number
    localAuthenticity: number
    temporalLogic: number
    experienceDiversity: number
    practicalFeasibility: number
    hallucinationRisk: number // lower = better (fewer hallucinations)
  }
  overallJudgeScore: number
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  flaggedItems: Array<{
    name: string
    issue: string
    severity: 'low' | 'medium' | 'high'
  }>
}

// ─── Benchmark ───────────────────────────────────────────────

export interface BenchmarkParams {
  destination: string
  country: string
  vibes: string[]
  days: number
  travelers: number
  budget: string
}

export interface LLMProvider {
  id: string
  name: string
  available: boolean
  generate: (params: BenchmarkParams) => Promise<EvalItem[]>
}

export interface BenchmarkResult {
  destination: string
  vibes: string[]
  providers: Record<string, EvalResult & { judgeAnalysis?: JudgeAnalysis }>
  deltas: Record<string, { overall: number; placeValidity: number; vibeMatch: number; mustSee: number; ratings: number }>
}

// ─── Pattern Analysis ────────────────────────────────────────

export interface EvalPattern {
  type: 'destination_weakness' | 'dimension_weakness' | 'common_hallucination' | 'trend'
  severity: 'low' | 'medium' | 'high'
  title: string
  description: string
  affectedTrips: number
  examples: string[]
  suggestedFix?: string
}

export interface AnalysisResult {
  totalEvals: number
  avgOverallScore: number
  scoreDistribution: { range: string; count: number }[]
  byDestination: Record<string, { avgScore: number; count: number; weakestDimension: string }>
  byDimension: Record<string, { avgScore: number; lowestDestination: string }>
  patterns: EvalPattern[]
  llmInsights?: string // LLM-powered deep analysis
}

// ─── DB Row Types ────────────────────────────────────────────

export interface EvalRunRow {
  id: string
  run_type: 'single' | 'batch' | 'benchmark'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  config: Record<string, unknown>
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  aggregate_scores: Record<string, unknown>
  analysis: Record<string, unknown> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface EvalResultRow {
  id: string
  run_id: string | null
  trip_id: string | null
  llm_provider: string
  destination: string
  country: string
  vibes: string[]
  days: number
  item_count: number
  overall_score: number
  dimension_scores: DimensionScores
  items_snapshot: EvalItem[]
  judge_analysis: JudgeAnalysis | null
  error: string | null
  created_at: string
}
