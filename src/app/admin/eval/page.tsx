'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Auth ────────────────────────────────────────────────────

let _secret = ''
function getSecret() { return _secret }
const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': getSecret() })
const api = (path: string) => {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('secret', getSecret())
  return url.toString()
}

// ─── Types ───────────────────────────────────────────────────

type Trip = { id: string; destination: string; country: string; vibes: string[]; start_date: string; end_date: string; created_at: string }

type DimensionScores = {
  placeValidity: { score: number; verified: number; total: number; invalid: string[] }
  vibeMatch: { score: number; matched: number; total: number; mismatches: string[] }
  landmarkCoverage: { score: number; hit: number; total: number; landmarks: string[]; missing: string[] }
  vibeMustHaves: { score: number; hit: number; total: number; vibeMustHaves: string[]; missing: string[] }
  priceRealism: { score: number; notes: string }
  dayBalance: { score: number; itemsPerDay: number[]; notes: string }
  ratingQuality: { score: number; avgRating: number; ratedCount: number; total: number }
}

type JudgeAnalysis = {
  qualitativeScores: Record<string, number>
  overallJudgeScore: number
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  flaggedItems: Array<{ name: string; issue: string; severity: string }>
}

type EvalResultRow = {
  id: string; run_id: string; trip_id: string; llm_provider: string
  destination: string; country: string; vibes: string[]; days: number
  item_count: number; overall_score: number; dimension_scores: DimensionScores
  judge_analysis: JudgeAnalysis | null; error: string | null; created_at: string
}

type EvalRun = {
  id: string; run_type: string; status: string; config: Record<string, unknown>
  total_tasks: number; completed_tasks: number; failed_tasks: number
  aggregate_scores: Record<string, unknown>; analysis: Record<string, unknown> | null
  started_at: string; completed_at: string; created_at: string
}

type Pattern = {
  type: string; severity: string; title: string; description: string
  affectedTrips: number; examples: string[]; suggestedFix?: string
}

type AnalysisResult = {
  totalEvals: number; avgOverallScore: number
  scoreDistribution: Array<{ range: string; count: number }>
  byDestination: Record<string, { avgScore: number; count: number; weakestDimension: string }>
  byDimension: Record<string, { avgScore: number; lowestDestination: string }>
  patterns: Pattern[]; llmInsights?: string
}

// ─── Helpers ─────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return '#4ecdc4'
  if (score >= 70) return '#c8a44e'
  if (score >= 50) return '#f0a500'
  return '#e74c3c'
}

function scoreBg(score: number): string {
  return `${scoreColor(score)}20`
}

const dimLabels: Record<string, string> = {
  placeValidity: 'Places', vibeMatch: 'Vibes', landmarkCoverage: 'Landmarks',
  vibeMustHaves: 'Vibe Picks', priceRealism: 'Prices', dayBalance: 'Balance', ratingQuality: 'Ratings',
}

const judgeDimLabels: Record<string, string> = {
  narrativeCoherence: 'Flow', localAuthenticity: 'Authenticity', temporalLogic: 'Timing',
  experienceDiversity: 'Diversity', practicalFeasibility: 'Feasibility', hallucinationRisk: 'Hallucination',
}

// ─── Main Page ───────────────────────────────────────────────

export default function EvalDashboard() {
  const [authed, setAuthed] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [tab, setTab] = useState<'eval' | 'benchmark' | 'history' | 'analysis'>('eval')

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 w-[380px]">
          <h1 className="font-serif text-2xl text-[#c8a44e] mb-4">Eval Dashboard</h1>
          <input
            value={secretInput}
            onChange={e => setSecretInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { _secret = secretInput; setAuthed(true) } }}
            placeholder="Admin secret"
            type="password"
            className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-[#f0efe8] mb-4"
          />
          <button
            onClick={() => { _secret = secretInput; setAuthed(true) }}
            className="w-full bg-[#c8a44e] text-[#08080c] rounded-xl py-3 text-sm font-medium"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-[#7a7a85] text-sm hover:text-[#f0efe8]">&larr; Admin</a>
          <h1 className="font-serif text-xl text-[#c8a44e]">Eval System</h1>
        </div>
        <div className="flex gap-2">
          {(['eval', 'benchmark', 'history', 'analysis'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${
                tab === t
                  ? 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]'
                  : 'text-[#7a7a85] hover:text-[#f0efe8]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {tab === 'eval' && <BatchEvalTab />}
        {tab === 'benchmark' && <BenchmarkTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'analysis' && <AnalysisTab />}
      </div>
    </div>
  )
}

// ─── Batch Eval Tab ──────────────────────────────────────────

function BatchEvalTab() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [destFilter, setDestFilter] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Array<{ tripId: string; destination: string; score: number; error?: string }>>([])
  const [runMeta, setRunMeta] = useState<{ runId?: string; avgScore?: number; total?: number } | null>(null)
  const [withJudge, setWithJudge] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<EvalResultRow | null>(null)

  // Load all trips via admin endpoint
  useEffect(() => {
    fetch(api('/api/admin/trips'), { headers: headers() })
      .then(r => r.json())
      .then(d => {
        if (d.trips) setTrips(d.trips)
      })
      .catch(err => console.error('Failed to load trips:', err))
  }, [])

  const destinations = [...new Set(trips.map(t => t.destination))].sort()
  const filteredTrips = destFilter ? trips.filter(t => t.destination === destFilter) : trips

  function toggleAll() {
    if (selected.size === filteredTrips.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredTrips.map(t => t.id)))
    }
  }

  function toggleTrip(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function runBatchEval() {
    setRunning(true)
    setResults([])
    setRunMeta(null)

    try {
      const body: Record<string, unknown> = { judge: withJudge }
      if (selected.size > 0) body.tripIds = [...selected]
      else if (destFilter) body.destination = destFilter

      const res = await fetch('/api/ai/eval/batch', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResults(data.results || [])
      setRunMeta({ runId: data.runId, avgScore: data.avgScore, total: data.total })
    } catch (err) {
      console.error('Batch eval failed:', err)
    } finally {
      setRunning(false)
    }
  }

  async function loadResultDetail(tripId: string) {
    if (expandedId === tripId) { setExpandedId(null); setExpandedDetail(null); return }
    setExpandedId(tripId)
    // Load from the run results
    if (runMeta?.runId) {
      const res = await fetch(api(`/api/ai/eval/runs/${runMeta.runId}`), { headers: headers() })
      const data = await res.json()
      const detail = data.results?.find((r: EvalResultRow) => r.trip_id === tripId)
      setExpandedDetail(detail || null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h2 className="text-lg font-serif text-[#f0efe8] mb-4">Batch Eval — Existing Trips</h2>

        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="text-[10px] text-[#4a4a55] uppercase tracking-wider block mb-1">Filter by Destination</label>
            <select
              value={destFilter}
              onChange={e => setDestFilter(e.target.value)}
              className="bg-[#08080c] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f0efe8] min-w-[180px]"
            >
              <option value="">All destinations</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#7a7a85] cursor-pointer">
            <input type="checkbox" checked={withJudge} onChange={e => setWithJudge(e.target.checked)} className="accent-[#c8a44e]" />
            LLM-as-Judge
          </label>

          <button
            onClick={runBatchEval}
            disabled={running}
            className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {running ? 'Running...' : `Eval ${selected.size > 0 ? selected.size : filteredTrips.length} Trips`}
          </button>

          <button
            onClick={toggleAll}
            className="text-[#7a7a85] hover:text-[#f0efe8] text-xs px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg"
          >
            {selected.size === filteredTrips.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Trip list */}
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filteredTrips.map(trip => (
            <label
              key={trip.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(trip.id)}
                onChange={() => toggleTrip(trip.id)}
                className="accent-[#c8a44e]"
              />
              <span className="text-sm text-[#f0efe8] flex-1">{trip.destination}, {trip.country}</span>
              <span className="text-xs text-[#4a4a55]">{trip.vibes?.join(', ')}</span>
              <span className="text-xs text-[#4a4a55]">{trip.start_date?.slice(0, 10)}</span>
            </label>
          ))}
          {filteredTrips.length === 0 && (
            <div className="text-sm text-[#4a4a55] py-4 text-center">No trips found. Trips load from your database.</div>
          )}
        </div>
      </div>

      {/* Progress */}
      {running && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#c8a44e] rounded-full animate-pulse" />
            <span className="text-sm text-[#c8a44e]">Evaluating trips...</span>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          {/* Summary */}
          {runMeta && (
            <div className="flex gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-serif" style={{ color: scoreColor(runMeta.avgScore || 0) }}>
                  {runMeta.avgScore}
                </div>
                <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider">Avg Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-serif text-[#f0efe8]">{runMeta.total}</div>
                <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider">Trips Evaluated</div>
              </div>
            </div>
          )}

          {/* Results table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[#4a4a55] uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 px-2">Destination</th>
                <th className="text-right py-2 px-2">Score</th>
                <th className="text-right py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.sort((a, b) => b.score - a.score).map((r, i) => (
                <>
                  <tr
                    key={i}
                    onClick={() => loadResultDetail(r.tripId)}
                    className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                  >
                    <td className="py-2 px-2 text-[#f0efe8]">{r.destination}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: scoreColor(r.score), backgroundColor: scoreBg(r.score) }}>
                        {r.score}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-xs">
                      {r.error ? <span className="text-[#e74c3c]">{r.error}</span> : <span className="text-[#4ecdc4]">OK</span>}
                    </td>
                  </tr>
                  {expandedId === r.tripId && expandedDetail && (
                    <tr key={`${i}-detail`}>
                      <td colSpan={3} className="px-4 py-4 bg-[rgba(255,255,255,0.02)]">
                        <ResultDetail result={expandedDetail} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Benchmark Tab ───────────────────────────────────────────

function BenchmarkTab() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<Array<{ destination: string; provider: string; overallScore: number; itemCount: number; judgeScore?: number; error?: string }>>([])
  const [avgByProvider, setAvgByProvider] = useState<Record<string, number>>({})
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([])
  const [withJudge, setWithJudge] = useState(false)
  const [includeDrift, setIncludeDrift] = useState(true)

  const PRESETS = [
    { destination: 'Bali', country: 'Indonesia', vibes: ['beach', 'spiritual'], days: 4 },
    { destination: 'Tokyo', country: 'Japan', vibes: ['culture', 'foodie'], days: 4 },
    { destination: 'Dubai', country: 'UAE', vibes: ['luxury', 'city'], days: 3 },
    { destination: 'Bangkok', country: 'Thailand', vibes: ['foodie', 'city'], days: 3 },
    { destination: 'Paris', country: 'France', vibes: ['romance', 'culture'], days: 4 },
  ]

  async function runBenchmark() {
    setRunning(true)
    setResults([])
    setAvgByProvider({})
    try {
      const res = await fetch('/api/ai/eval/benchmark', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ destinations: PRESETS, judge: withJudge, includeDrift }),
      })
      const data = await res.json()
      setResults(data.results || [])
      setAvgByProvider(data.avgByProvider || {})
      setProviders(data.availableProviders || [])
    } catch (err) {
      console.error('Benchmark failed:', err)
    } finally {
      setRunning(false)
    }
  }

  const allProviders = [...new Set(results.map(r => r.provider))]
  const allDests = [...new Set(results.map(r => r.destination))]

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h2 className="text-lg font-serif text-[#f0efe8] mb-4">Multi-LLM Benchmark</h2>
        <p className="text-xs text-[#7a7a85] mb-4">
          Generates itineraries from each available LLM provider with identical prompts, then scores all with the same eval dimensions.
        </p>

        <div className="flex flex-wrap gap-4 items-end mb-4">
          <label className="flex items-center gap-2 text-sm text-[#7a7a85] cursor-pointer">
            <input type="checkbox" checked={includeDrift} onChange={e => setIncludeDrift(e.target.checked)} className="accent-[#c8a44e]" />
            Include Drift (full pipeline)
          </label>
          <label className="flex items-center gap-2 text-sm text-[#7a7a85] cursor-pointer">
            <input type="checkbox" checked={withJudge} onChange={e => setWithJudge(e.target.checked)} className="accent-[#c8a44e]" />
            LLM-as-Judge
          </label>
          <button
            onClick={runBenchmark}
            disabled={running}
            className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {running ? 'Running...' : `Benchmark ${PRESETS.length} Destinations`}
          </button>
        </div>

        <div className="text-xs text-[#4a4a55]">
          Destinations: {PRESETS.map(p => p.destination).join(', ')}
        </div>
      </div>

      {/* Provider averages */}
      {Object.keys(avgByProvider).length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Average Scores by Provider</h3>
          <div className="flex gap-6">
            {Object.entries(avgByProvider).sort((a, b) => b[1] - a[1]).map(([prov, avg]) => (
              <div key={prov} className="text-center">
                <div className="text-3xl font-serif" style={{ color: scoreColor(avg) }}>{avg}</div>
                <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mt-1">{prov}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison grid */}
      {results.length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 overflow-x-auto">
          <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Detailed Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[#4a4a55] uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 px-2">Destination</th>
                {allProviders.map(p => (
                  <th key={p} className="text-center py-2 px-2">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allDests.map(dest => (
                <tr key={dest} className="border-b border-[rgba(255,255,255,0.03)]">
                  <td className="py-2 px-2 text-[#f0efe8]">{dest}</td>
                  {allProviders.map(prov => {
                    const r = results.find(x => x.destination === dest && x.provider === prov)
                    if (!r) return <td key={prov} className="py-2 px-2 text-center text-[#4a4a55]">-</td>
                    return (
                      <td key={prov} className="py-2 px-2 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: scoreColor(r.overallScore), backgroundColor: scoreBg(r.overallScore) }}>
                          {r.overallScore}
                        </span>
                        {r.judgeScore !== undefined && (
                          <div className="text-[10px] text-[#7a7a85] mt-0.5">Judge: {r.judgeScore}</div>
                        )}
                        {r.error && <div className="text-[10px] text-[#e74c3c] mt-0.5">{r.error}</div>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────

function HistoryTab() {
  const [runs, setRuns] = useState<EvalRun[]>([])
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [runResults, setRunResults] = useState<EvalResultRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch(api('/api/ai/eval/runs'), { headers: headers() })
      .then(r => r.json())
      .then(d => setRuns(d.runs || []))
      .catch(() => {})
  }, [])

  async function loadRun(runId: string) {
    if (selectedRun === runId) { setSelectedRun(null); setRunResults([]); return }
    setSelectedRun(runId)
    const res = await fetch(api(`/api/ai/eval/runs/${runId}`), { headers: headers() })
    const data = await res.json()
    setRunResults(data.results || [])
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h2 className="text-lg font-serif text-[#f0efe8] mb-4">Run History</h2>

        {runs.length === 0 && <div className="text-sm text-[#4a4a55]">No eval runs yet. Run a batch eval or benchmark first.</div>}

        <div className="space-y-2">
          {runs.map(run => (
            <div key={run.id}>
              <button
                onClick={() => loadRun(run.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedRun === run.id
                    ? 'border-[#c8a44e33] bg-[rgba(200,164,78,0.05)]'
                    : 'border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                      run.run_type === 'benchmark' ? 'bg-[rgba(78,205,196,0.1)] text-[#4ecdc4]' : 'bg-[rgba(200,164,78,0.1)] text-[#c8a44e]'
                    }`}>
                      {run.run_type}
                    </span>
                    <span className="text-sm text-[#f0efe8]">{run.completed_tasks}/{run.total_tasks} tasks</span>
                    <span className={`text-xs ${run.status === 'completed' ? 'text-[#4ecdc4]' : run.status === 'failed' ? 'text-[#e74c3c]' : 'text-[#c8a44e]'}`}>
                      {run.status}
                    </span>
                  </div>
                  <span className="text-xs text-[#4a4a55]">{new Date(run.created_at).toLocaleDateString()}</span>
                </div>
              </button>

              {selectedRun === run.id && runResults.length > 0 && (
                <div className="mt-2 ml-4 space-y-1">
                  {runResults.map(r => (
                    <div key={r.id}>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
                      >
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ color: scoreColor(r.overall_score), backgroundColor: scoreBg(r.overall_score) }}>
                          {r.overall_score}
                        </span>
                        <span className="text-sm text-[#f0efe8] flex-1">{r.destination}</span>
                        <span className="text-xs text-[#4a4a55]">{r.llm_provider}</span>
                        {r.error && <span className="text-xs text-[#e74c3c]">Error</span>}
                      </button>
                      {expandedId === r.id && (
                        <div className="ml-4 mt-2 mb-3">
                          <ResultDetail result={r} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Analysis Tab ────────────────────────────────────────────

function AnalysisTab() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [deep, setDeep] = useState(false)

  async function runAnalysis() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/eval/analysis', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ deep }),
      })
      const data = await res.json()
      setAnalysis(data)
    } catch (err) {
      console.error('Analysis failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h2 className="text-lg font-serif text-[#f0efe8] mb-4">Pattern Analysis</h2>
        <p className="text-xs text-[#7a7a85] mb-4">
          Analyzes all eval results to find systemic patterns, shortcomings, and improvement opportunities.
        </p>

        <div className="flex gap-4 items-end">
          <label className="flex items-center gap-2 text-sm text-[#7a7a85] cursor-pointer">
            <input type="checkbox" checked={deep} onChange={e => setDeep(e.target.checked)} className="accent-[#c8a44e]" />
            Deep Analysis (LLM-powered)
          </label>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {analysis && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 text-center">
              <div className="text-3xl font-serif" style={{ color: scoreColor(analysis.avgOverallScore) }}>
                {analysis.avgOverallScore}
              </div>
              <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mt-1">Avg Score</div>
            </div>
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 text-center">
              <div className="text-3xl font-serif text-[#f0efe8]">{analysis.totalEvals}</div>
              <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mt-1">Total Evals</div>
            </div>
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 text-center">
              <div className="text-3xl font-serif text-[#f0efe8]">{analysis.patterns.length}</div>
              <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mt-1">Patterns Found</div>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Score Distribution</h3>
            <div className="flex items-end gap-2 h-[120px]">
              {analysis.scoreDistribution.map(b => {
                const maxCount = Math.max(...analysis.scoreDistribution.map(x => x.count), 1)
                const height = (b.count / maxCount) * 100
                return (
                  <div key={b.range} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-[#7a7a85]">{b.count}</div>
                    <div
                      className="w-full rounded-t-lg"
                      style={{ height: `${height}%`, backgroundColor: scoreColor(parseInt(b.range.split('-')[0]) + 10), minHeight: b.count > 0 ? '4px' : '0' }}
                    />
                    <div className="text-[9px] text-[#4a4a55]">{b.range}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Destination */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">By Destination</h3>
            <div className="space-y-2">
              {Object.entries(analysis.byDestination).sort((a, b) => b[1].avgScore - a[1].avgScore).map(([dest, data]) => (
                <div key={dest} className="flex items-center gap-3">
                  <span className="text-sm text-[#f0efe8] w-[120px]">{dest}</span>
                  <div className="flex-1 h-6 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${data.avgScore}%`, backgroundColor: scoreColor(data.avgScore) }}
                    />
                  </div>
                  <span className="text-sm font-medium w-[36px] text-right" style={{ color: scoreColor(data.avgScore) }}>{data.avgScore}</span>
                  <span className="text-[10px] text-[#4a4a55] w-[80px]">{data.count} evals</span>
                  <span className="text-[10px] text-[#7a7a85] w-[100px]">weak: {dimLabels[data.weakestDimension] || data.weakestDimension}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Dimension */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">By Dimension</h3>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(analysis.byDimension).map(([dim, data]) => (
                <div key={dim} className="border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                  <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">{dimLabels[dim] || dim}</div>
                  <div className="text-2xl font-serif" style={{ color: scoreColor(data.avgScore) }}>{data.avgScore}</div>
                  <div className="text-[10px] text-[#7a7a85] mt-1">Lowest: {data.lowestDestination}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {analysis.patterns.length > 0 && (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Detected Patterns</h3>
              <div className="space-y-3">
                {analysis.patterns.map((p, i) => (
                  <div key={i} className="border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.severity === 'high' ? 'bg-[rgba(231,76,60,0.1)] text-[#e74c3c]'
                          : p.severity === 'medium' ? 'bg-[rgba(240,165,0,0.1)] text-[#f0a500]'
                            : 'bg-[rgba(122,122,133,0.1)] text-[#7a7a85]'
                      }`}>
                        {p.severity}
                      </span>
                      <span className="text-sm text-[#f0efe8] font-medium">{p.title}</span>
                    </div>
                    <p className="text-xs text-[#7a7a85] mb-2">{p.description}</p>
                    {p.examples.length > 0 && (
                      <div className="text-[10px] text-[#4a4a55] mb-2">
                        Examples: {p.examples.join(', ')}
                      </div>
                    )}
                    {p.suggestedFix && (
                      <div className="text-xs text-[#4ecdc4] mt-2">Fix: {p.suggestedFix}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LLM Insights */}
          {analysis.llmInsights && (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h3 className="text-sm font-medium text-[#f0efe8] mb-4 uppercase tracking-wider">Deep Analysis (LLM)</h3>
              <div className="text-sm text-[#7a7a85] whitespace-pre-wrap leading-relaxed">
                {analysis.llmInsights}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Shared: Result Detail ───────────────────────────────────

function ResultDetail({ result }: { result: EvalResultRow }) {
  const dims = result.dimension_scores
  const judge = result.judge_analysis

  return (
    <div className="space-y-4">
      {/* Dimension scores */}
      {dims && (
        <div>
          <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">Dimension Scores</div>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(dims).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-lg font-serif" style={{ color: scoreColor((val as { score: number }).score) }}>
                  {(val as { score: number }).score}
                </div>
                <div className="text-[9px] text-[#4a4a55]">{dimLabels[key] || key}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalid places */}
      {dims?.placeValidity?.invalid?.length > 0 && (
        <div>
          <div className="text-[10px] text-[#e74c3c] uppercase tracking-wider mb-1">Unverified Places</div>
          <div className="text-xs text-[#7a7a85]">{dims.placeValidity.invalid.join(', ')}</div>
        </div>
      )}

      {/* Missing landmarks */}
      {dims?.landmarkCoverage?.missing?.length > 0 && (
        <div>
          <div className="text-[10px] text-[#f0a500] uppercase tracking-wider mb-1">Missing Landmarks</div>
          <div className="text-xs text-[#7a7a85]">{dims.landmarkCoverage.missing.join(', ')}</div>
        </div>
      )}

      {/* Missing vibe must-haves */}
      {dims?.vibeMustHaves?.missing?.length > 0 && (
        <div>
          <div className="text-[10px] text-[#c8a44e] uppercase tracking-wider mb-1">Missing Vibe Picks</div>
          <div className="text-xs text-[#7a7a85]">{dims.vibeMustHaves.missing.join(', ')}</div>
        </div>
      )}

      {/* Judge analysis */}
      {judge && (
        <div className="border-t border-[rgba(255,255,255,0.06)] pt-3">
          <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-2">
            Judge Score: <span style={{ color: scoreColor(judge.overallJudgeScore) }}>{judge.overallJudgeScore}</span>
          </div>

          <div className="grid grid-cols-6 gap-2 mb-3">
            {Object.entries(judge.qualitativeScores).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-sm font-medium" style={{ color: scoreColor(val as number) }}>{val as number}</div>
                <div className="text-[8px] text-[#4a4a55]">{judgeDimLabels[key] || key}</div>
              </div>
            ))}
          </div>

          {judge.strengths.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-[#4ecdc4] mb-1">Strengths</div>
              {judge.strengths.map((s, i) => <div key={i} className="text-xs text-[#7a7a85]">+ {s}</div>)}
            </div>
          )}
          {judge.weaknesses.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-[#e74c3c] mb-1">Weaknesses</div>
              {judge.weaknesses.map((w, i) => <div key={i} className="text-xs text-[#7a7a85]">- {w}</div>)}
            </div>
          )}
          {judge.recommendations.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-[#c8a44e] mb-1">Recommendations</div>
              {judge.recommendations.map((r, i) => <div key={i} className="text-xs text-[#7a7a85]">{r}</div>)}
            </div>
          )}
          {judge.flaggedItems.length > 0 && (
            <div>
              <div className="text-[10px] text-[#f0a500] mb-1">Flagged Items</div>
              {judge.flaggedItems.map((f, i) => (
                <div key={i} className="text-xs text-[#7a7a85]">
                  <span className={f.severity === 'high' ? 'text-[#e74c3c]' : f.severity === 'medium' ? 'text-[#f0a500]' : 'text-[#7a7a85]'}>
                    [{f.severity}]
                  </span>{' '}
                  {f.name}: {f.issue}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
