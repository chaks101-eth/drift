'use client'

import { useState, useEffect } from 'react'

let _secret = ''
const getSecret = () => _secret
const hdrs = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': getSecret() })
const api = (path: string) => { const u = new URL(path, window.location.origin); u.searchParams.set('secret', getSecret()); return u.toString() }

type ContentItem = {
  id: string; platform: string; content_type: string; title: string; body: string
  destination: string; eval_score: number; status: string; rejection_reason: string | null
  scheduled_for: string | null; utm_campaign: string; created_at: string
}

type Learning = { id: string; category: string; insight: string; action: string; confidence: number; based_on_posts: number; is_active: boolean; created_at: string }

function statusColor(s: string) {
  if (s === 'approved' || s === 'posted') return '#4ecdc4'
  if (s === 'draft') return '#c8a44e'
  if (s === 'rejected' || s === 'failed') return '#e74c3c'
  if (s === 'scheduled') return '#7a7aff'
  return '#7a7a85'
}

export default function GrowthDashboard() {
  const [authed, setAuthed] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [tab, setTab] = useState<'generate' | 'queue' | 'metrics' | 'learnings'>('generate')

  if (!authed) return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 w-[380px]">
        <h1 className="font-serif text-2xl text-[#c8a44e] mb-4">Growth Engine</h1>
        <input value={secretInput} onChange={e => setSecretInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { _secret = secretInput; setAuthed(true) } }}
          placeholder="Admin secret" type="password"
          className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-[#f0efe8] mb-4" />
        <button onClick={() => { _secret = secretInput; setAuthed(true) }}
          className="w-full bg-[#c8a44e] text-[#08080c] rounded-xl py-3 text-sm font-medium">Enter</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-[#7a7a85] text-sm hover:text-[#f0efe8]">&larr; Admin</a>
          <h1 className="font-serif text-xl text-[#c8a44e]">Growth Engine</h1>
        </div>
        <div className="flex gap-2">
          {(['generate', 'queue', 'metrics', 'learnings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${tab === t ? 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]' : 'text-[#7a7a85] hover:text-[#f0efe8]'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {tab === 'generate' && <GenerateTab />}
        {tab === 'queue' && <QueueTab />}
        {tab === 'metrics' && <MetricsTab />}
        {tab === 'learnings' && <LearningsTab />}
      </div>
    </div>
  )
}

// ─── Generate Tab ────────────────────────────────────────────

function GenerateTab() {
  const [platform, setPlatform] = useState('reddit')
  const [destination, setDestination] = useState('')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<Array<{ id: string; platform: string; title: string; destination: string; evalScore: number | null }>>([])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/growth/generate', {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ platform, destination: destination || undefined, count }),
      })
      const data = await res.json()
      setResults(data.items || [])
    } catch { /* ignore */ } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h2 className="text-lg font-serif text-[#f0efe8] mb-4">Generate Content</h2>
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div>
            <label className="text-[10px] text-[#4a4a55] uppercase tracking-wider block mb-1">Platform</label>
            <select value={platform} onChange={e => setPlatform(e.target.value)}
              className="bg-[#08080c] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f0efe8]">
              <option value="reddit">Reddit</option>
              <option value="twitter">Twitter/X</option>
              <option value="blog">Blog (dev.to)</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#4a4a55] uppercase tracking-wider block mb-1">Destination (auto if blank)</label>
            <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Istanbul, Tokyo..."
              className="bg-[#08080c] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f0efe8] w-[200px]" />
          </div>
          <div>
            <label className="text-[10px] text-[#4a4a55] uppercase tracking-wider block mb-1">Count</label>
            <select value={count} onChange={e => setCount(parseInt(e.target.value))}
              className="bg-[#08080c] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f0efe8]">
              {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={generating}
            className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
        <p className="text-[10px] text-[#4a4a55]">Uses eval scores to pick the best destination. Content saved as draft for review.</p>
      </div>

      {results.length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-[#f0efe8] mb-3 uppercase tracking-wider">Generated ({results.length})</h3>
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.06)] mb-2">
              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[rgba(200,164,78,0.1)] text-[#c8a44e]">{r.platform}</span>
              <span className="text-sm text-[#f0efe8] flex-1 truncate">{r.title}</span>
              <span className="text-xs text-[#4a4a55]">{r.destination}</span>
              {r.evalScore && <span className="text-xs text-[#4ecdc4]">{r.evalScore}/100</span>}
            </div>
          ))}
          <p className="text-[10px] text-[#4a4a55] mt-2">Go to Queue tab to review and approve.</p>
        </div>
      )}
    </div>
  )
}

// ─── Queue Tab ───────────────────────────────────────────────

function QueueTab() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [posting, setPosting] = useState<string | null>(null)

  useEffect(() => { loadQueue() }, [])

  async function loadQueue() {
    const res = await fetch(api('/api/growth/content'), { headers: hdrs() })
    const data = await res.json()
    setContent(data.content || [])
  }

  async function updateStatus(id: string, status: string, reason?: string) {
    await fetch(`/api/growth/content/${id}`, {
      method: 'PUT', headers: hdrs(),
      body: JSON.stringify({ status, rejectionReason: reason }),
    })
    loadQueue()
  }

  async function publishPost(id: string, platform: string) {
    setPosting(id)
    try {
      const res = await fetch('/api/growth/post', {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ contentId: id, platform }),
      })
      const data = await res.json()
      if (data.postUrl) alert(`Posted! URL: ${data.postUrl}`)
      else if (data.instructions) alert(data.instructions)
      loadQueue()
    } catch { /* ignore */ } finally { setPosting(null) }
  }

  async function deleteContent(id: string) {
    await fetch(`/api/growth/content/${id}`, { method: 'DELETE', headers: hdrs() })
    loadQueue()
  }

  const filtered = filter ? content.filter(c => c.status === filter) : content

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif text-[#f0efe8]">Content Queue</h2>
          <div className="flex gap-2">
            {['', 'draft', 'approved', 'posted', 'rejected'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider ${filter === f ? 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]' : 'text-[#4a4a55] hover:text-[#7a7a85]'}`}>
                {f || 'all'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && <div className="text-sm text-[#4a4a55] py-4 text-center">No content. Generate some first.</div>}

        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id}>
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded" style={{ color: statusColor(item.status), backgroundColor: `${statusColor(item.status)}20` }}>
                  {item.status}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[#4a4a55] w-[60px]">{item.platform}</span>
                <span className="text-sm text-[#f0efe8] flex-1 truncate">{item.title}</span>
                <span className="text-xs text-[#4a4a55]">{item.destination}</span>
                {item.eval_score && <span className="text-[10px] text-[#4ecdc4]">{item.eval_score}</span>}
                <span className="text-[10px] text-[#4a4a55]">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>

              {expandedId === item.id && (
                <div className="ml-4 mt-2 mb-4 p-4 bg-[rgba(255,255,255,0.02)] rounded-xl">
                  <pre className="text-xs text-[#7a7a85] whitespace-pre-wrap mb-4 max-h-[300px] overflow-y-auto leading-relaxed">{item.body}</pre>
                  {item.rejection_reason && <div className="text-xs text-[#e74c3c] mb-3">Rejected: {item.rejection_reason}</div>}
                  <div className="flex gap-2">
                    {item.status === 'draft' && (
                      <>
                        <button onClick={() => updateStatus(item.id, 'approved')}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[rgba(78,205,196,0.15)] text-[#4ecdc4] hover:bg-[rgba(78,205,196,0.25)]">Approve</button>
                        <button onClick={() => updateStatus(item.id, 'rejected', prompt('Rejection reason:') || 'Not suitable')}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[rgba(231,76,60,0.15)] text-[#e74c3c] hover:bg-[rgba(231,76,60,0.25)]">Reject</button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <button onClick={() => publishPost(item.id, item.platform)} disabled={posting === item.id}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#c8a44e] text-[#08080c] disabled:opacity-50">
                        {posting === item.id ? 'Posting...' : `Post to ${item.platform}`}
                      </button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(item.body); }}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium border border-[rgba(255,255,255,0.1)] text-[#7a7a85] hover:text-[#f0efe8]">Copy</button>
                    <button onClick={() => deleteContent(item.id)}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#e74c3c] hover:bg-[rgba(231,76,60,0.1)]">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Metrics Tab ─────────────────────────────────────────────

function MetricsTab() {
  const [metrics, setMetrics] = useState<{ totals: Record<string, number>; byPlatform: Record<string, Record<string, number>>; byDestination: Record<string, Record<string, number>>; queueStats: Record<string, number> } | null>(null)

  useEffect(() => {
    fetch(api('/api/growth/metrics'), { headers: hdrs() })
      .then(r => r.json()).then(setMetrics).catch(() => {})
  }, [])

  if (!metrics) return <div className="text-[#4a4a55] py-8 text-center">Loading metrics...</div>

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Posts', value: metrics.totals.posts || 0 },
          { label: 'Clicks', value: metrics.totals.clicks || 0 },
          { label: 'Likes', value: metrics.totals.likes || 0 },
          { label: 'Signups', value: metrics.totals.signups || 0 },
        ].map(m => (
          <div key={m.label} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 text-center">
            <div className="text-3xl font-serif text-[#f0efe8]">{m.value}</div>
            <div className="text-[10px] text-[#4a4a55] uppercase tracking-wider mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Queue Stats */}
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <h3 className="text-sm font-medium text-[#f0efe8] mb-3 uppercase tracking-wider">Content Queue</h3>
        <div className="flex gap-6">
          {Object.entries(metrics.queueStats).map(([status, count]) => (
            <div key={status} className="text-center">
              <div className="text-xl font-serif" style={{ color: statusColor(status) }}>{count}</div>
              <div className="text-[10px] text-[#4a4a55] uppercase">{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By Platform */}
      {Object.keys(metrics.byPlatform).length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-[#f0efe8] mb-3 uppercase tracking-wider">By Platform</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[#4a4a55] uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2">Platform</th><th className="text-right py-2">Posts</th><th className="text-right py-2">Clicks</th><th className="text-right py-2">Likes</th><th className="text-right py-2">Signups</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byPlatform).map(([plat, data]) => (
                <tr key={plat} className="border-b border-[rgba(255,255,255,0.03)]">
                  <td className="py-2 text-[#f0efe8]">{plat}</td>
                  <td className="py-2 text-right text-[#7a7a85]">{data.posts}</td>
                  <td className="py-2 text-right text-[#7a7a85]">{data.clicks}</td>
                  <td className="py-2 text-right text-[#7a7a85]">{data.likes}</td>
                  <td className="py-2 text-right text-[#4ecdc4]">{data.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By Destination */}
      {Object.keys(metrics.byDestination).length > 0 && (
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-[#f0efe8] mb-3 uppercase tracking-wider">By Destination</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-[#4a4a55] uppercase tracking-wider border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2">Destination</th><th className="text-right py-2">Posts</th><th className="text-right py-2">Clicks</th><th className="text-right py-2">Signups</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.byDestination).sort((a, b) => (b[1].signups || 0) - (a[1].signups || 0)).map(([dest, data]) => (
                <tr key={dest} className="border-b border-[rgba(255,255,255,0.03)]">
                  <td className="py-2 text-[#f0efe8]">{dest}</td>
                  <td className="py-2 text-right text-[#7a7a85]">{data.posts}</td>
                  <td className="py-2 text-right text-[#7a7a85]">{data.clicks}</td>
                  <td className="py-2 text-right text-[#4ecdc4]">{data.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Learnings Tab ───────────────────────────────────────────

function LearningsTab() {
  const [learnings, setLearnings] = useState<Learning[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => { loadLearnings() }, [])

  async function loadLearnings() {
    const res = await fetch(api('/api/growth/learnings'), { headers: hdrs() })
    const data = await res.json()
    setLearnings(data.learnings || [])
  }

  async function runLearning() {
    setRunning(true)
    try {
      const res = await fetch('/api/growth/learn', { method: 'POST', headers: hdrs() })
      const data = await res.json()
      alert(`Generated ${data.newLearnings} new insights, deactivated ${data.deactivated} old ones.`)
      loadLearnings()
    } catch { /* ignore */ } finally { setRunning(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif text-[#f0efe8]">Growth Learnings</h2>
          <button onClick={runLearning} disabled={running}
            className="bg-[#c8a44e] text-[#08080c] px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {running ? 'Analyzing...' : 'Run Learning Cycle'}
          </button>
        </div>
        <p className="text-xs text-[#7a7a85] mb-4">
          Analyzes all posted content + metrics to find patterns. Insights are fed back into content generation.
        </p>

        {learnings.length === 0 && <div className="text-sm text-[#4a4a55] py-4 text-center">No learnings yet. Post some content and collect metrics first.</div>}

        <div className="space-y-3">
          {learnings.map(l => (
            <div key={l.id} className="border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[rgba(200,164,78,0.1)] text-[#c8a44e]">{l.category}</span>
                <span className="text-[10px] text-[#4a4a55]">confidence: {Math.round(l.confidence * 100)}% · {l.based_on_posts} posts</span>
                {!l.is_active && <span className="text-[9px] text-[#e74c3c]">INACTIVE</span>}
              </div>
              <p className="text-sm text-[#f0efe8] mb-1">{l.insight}</p>
              {l.action && <p className="text-xs text-[#4ecdc4]">Action: {l.action}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
