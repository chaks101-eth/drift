'use client'

import { useState, useEffect } from 'react'

let _secret = ''
const getSecret = () => _secret
const api = (path: string) => { const u = new URL(path, window.location.origin); u.searchParams.set('secret', getSecret()); return u.toString() }

type Analytics = {
  asOf: string
  summary: {
    totalUsers: number; totalTrips: number; totalItems: number; totalChats: number
    avgEvalScore: number; weeklyNewUsers: number; weeklyTrips: number; monthlyTrips: number
    tripsWoW: number; chatEngagementRate: number; avgItemsPerTrip: number
  }
  dailyTrips: Array<{ date: string; count: number }>
  topDestinations: Array<{ destination: string; trips: number }>
  topVibes: Array<{ vibe: string; count: number }>
  budgetBreakdown: Record<string, number>
  categoryBreakdown: Record<string, number>
  qualityByDestination: Array<{ destination: string; avgScore: number; evalCount: number }>
  evalCount: number
  growth: { totalPosts: number; postsByPlatform: Record<string, number>; metrics: Record<string, number> }
  recentTrips: Array<{ id: string; destination: string; country: string; vibes: string[]; budget: string; travelers: number; createdAt: string }>
  popularItems: Array<{ name: string; destination: string; type: string; score: number; picks: number; skips: number }>
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
      <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-[#f0efe8]'}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#7a7a85] mt-1">{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max, color = '#c8a44e' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-[#1a1a22] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function SparkChart({ data, color = '#c8a44e' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const h = 60
  const w = data.length * 10
  const points = data.map((v, i) => `${i * 10},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[60px]" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${points} ${w},${h}`} fill={`${color}15`} stroke="none" />
    </svg>
  )
}

export default function AnalyticsDashboard() {
  const [authed, setAuthed] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    fetch(api('/api/admin/analytics'), { headers: { 'x-admin-secret': getSecret() } })
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [authed])

  if (!authed) return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 w-[380px]">
        <h1 className="font-serif text-2xl text-[#c8a44e] mb-4">Analytics</h1>
        <input value={secretInput} onChange={e => setSecretInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { _secret = secretInput; setAuthed(true) } }}
          placeholder="Admin secret" type="password"
          className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-[#f0efe8] mb-4" />
        <button onClick={() => { _secret = secretInput; setAuthed(true) }}
          className="w-full bg-[#c8a44e] text-[#08080c] rounded-xl py-3 text-sm font-medium">Enter</button>
      </div>
    </div>
  )

  if (loading || !data) return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e]" />
    </div>
  )

  const s = data.summary
  const maxDailyTrips = Math.max(...data.dailyTrips.map(d => d.count), 1)
  const maxDestTrips = data.topDestinations[0]?.trips || 1

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-[#7a7a85] text-sm hover:text-[#f0efe8]">&larr; Admin</a>
          <h1 className="font-serif text-xl text-[#c8a44e]">Analytics</h1>
        </div>
        <div className="text-[10px] text-[#4a4a55]">As of {data.asOf}</div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 space-y-8">
        {/* ─── Key Metrics ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Users" value={s.totalUsers} sub={`+${s.weeklyNewUsers} this week`} />
          <StatCard label="Total Trips" value={s.totalTrips} sub={`+${s.weeklyTrips} this week`} />
          <StatCard label="WoW Growth" value={`${s.tripsWoW > 0 ? '+' : ''}${s.tripsWoW}%`}
            color={s.tripsWoW > 0 ? 'text-[#4ecdc4]' : s.tripsWoW < 0 ? 'text-[#e74c3c]' : 'text-[#7a7a85]'} />
          <StatCard label="Avg Quality" value={`${s.avgEvalScore}/100`}
            color={s.avgEvalScore >= 80 ? 'text-[#4ecdc4]' : s.avgEvalScore >= 60 ? 'text-[#c8a44e]' : 'text-[#e74c3c]'} />
          <StatCard label="Chat Rate" value={`${s.chatEngagementRate}%`} sub="of trips use chat" />
          <StatCard label="Items/Trip" value={s.avgItemsPerTrip} sub={`${s.totalItems} total items`} />
        </div>

        {/* ─── Daily Trips Chart ────────────────────── */}
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[#f0efe8] mb-1">Trips Created — Last 30 Days</h2>
          <p className="text-[10px] text-[#4a4a55] mb-4">{s.monthlyTrips} trips this month</p>
          <SparkChart data={data.dailyTrips.map(d => d.count)} />
          <div className="flex justify-between mt-2 text-[9px] text-[#4a4a55]">
            <span>{data.dailyTrips[0]?.date.slice(5)}</span>
            <span>{data.dailyTrips[data.dailyTrips.length - 1]?.date.slice(5)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Top Destinations ──────────────────── */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[#f0efe8] mb-4">Top Destinations</h2>
            <div className="space-y-3">
              {data.topDestinations.slice(0, 10).map((d, i) => (
                <div key={d.destination} className="flex items-center gap-3">
                  <span className="text-[10px] text-[#4a4a55] w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#f0efe8]">{d.destination}</span>
                      <span className="text-xs text-[#7a7a85]">{d.trips}</span>
                    </div>
                    <MiniBar value={d.trips} max={maxDestTrips} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Quality by Destination ────────────── */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[#f0efe8] mb-1">Quality by Destination</h2>
            <p className="text-[10px] text-[#4a4a55] mb-4">{data.evalCount} evals total · avg {s.avgEvalScore}/100</p>
            <div className="space-y-3">
              {data.qualityByDestination.map(d => (
                <div key={d.destination} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#f0efe8]">{d.destination}</span>
                      <span className={`text-xs font-medium ${d.avgScore >= 80 ? 'text-[#4ecdc4]' : d.avgScore >= 60 ? 'text-[#c8a44e]' : 'text-[#e74c3c]'}`}>
                        {d.avgScore}/100
                      </span>
                    </div>
                    <MiniBar value={d.avgScore} max={100}
                      color={d.avgScore >= 80 ? '#4ecdc4' : d.avgScore >= 60 ? '#c8a44e' : '#e74c3c'} />
                  </div>
                  <span className="text-[9px] text-[#4a4a55]">{d.evalCount} evals</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Vibes Popularity ──────────────────── */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[#f0efe8] mb-4">Popular Vibes</h2>
            <div className="flex flex-wrap gap-2">
              {data.topVibes.map(v => (
                <div key={v.vibe} className="flex items-center gap-1.5 rounded-full bg-[rgba(200,164,78,0.1)] px-3 py-1.5">
                  <span className="text-xs text-[#c8a44e]">{v.vibe}</span>
                  <span className="text-[10px] text-[#7a7a85]">{v.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Budget Split ─────────────────────── */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[#f0efe8] mb-4">Budget Distribution</h2>
            <div className="space-y-4">
              {Object.entries(data.budgetBreakdown).map(([tier, count]) => {
                const total = Object.values(data.budgetBreakdown).reduce((s, v) => s + v, 0) || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={tier}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#f0efe8] capitalize">{tier}</span>
                      <span className="text-xs text-[#7a7a85]">{count} ({pct}%)</span>
                    </div>
                    <MiniBar value={count} max={total}
                      color={tier === 'budget' ? '#4ecdc4' : tier === 'mid' ? '#c8a44e' : '#e74c3c'} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── Growth Marketing ──────────────────── */}
        {data.growth.totalPosts > 0 && (
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <h2 className="text-sm font-medium text-[#f0efe8] mb-4">Growth Marketing</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div><div className="text-lg font-bold text-[#f0efe8]">{data.growth.totalPosts}</div><div className="text-[10px] text-[#4a4a55]">Posts</div></div>
              <div><div className="text-lg font-bold text-[#f0efe8]">{data.growth.metrics.impressions?.toLocaleString()}</div><div className="text-[10px] text-[#4a4a55]">Impressions</div></div>
              <div><div className="text-lg font-bold text-[#f0efe8]">{data.growth.metrics.clicks?.toLocaleString()}</div><div className="text-[10px] text-[#4a4a55]">Clicks</div></div>
              <div><div className="text-lg font-bold text-[#4ecdc4]">{data.growth.metrics.signups}</div><div className="text-[10px] text-[#4a4a55]">Signups</div></div>
            </div>
            <div className="flex gap-2">
              {Object.entries(data.growth.postsByPlatform).map(([platform, count]) => (
                <div key={platform} className="rounded-lg bg-[#08080c] px-3 py-2 text-xs">
                  <span className="text-[#7a7a85]">{platform}</span>
                  <span className="text-[#f0efe8] ml-2 font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Recent Trips (Activity Feed) ─────── */}
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h2 className="text-sm font-medium text-[#f0efe8] mb-4">Recent Trips</h2>
          <div className="space-y-2">
            {data.recentTrips.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[#08080c] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#f0efe8]">{t.destination}{t.country ? `, ${t.country}` : ''}</div>
                  <div className="text-[10px] text-[#4a4a55]">
                    {t.vibes?.join(', ')} · {t.budget} · {t.travelers} {t.travelers === 1 ? 'traveler' : 'travelers'}
                  </div>
                </div>
                <div className="text-[10px] text-[#4a4a55] shrink-0">
                  {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
