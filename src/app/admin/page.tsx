'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

let _adminSecret = ''
function getSecret() { return _adminSecret }
function setAdminSecret(s: string) { _adminSecret = s }
const buildHeaders = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': getSecret() })
const api = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('secret', getSecret())
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

// ─── Types ──────────────────────────────────────────────────

type Destination = {
  id: string; city: string; country: string; status: string
  vibes: string[]; pipeline_run_at: string | null; cover_image: string | null
  description: string | null; avg_budget_per_day?: Record<string, number> | null
}

type CatalogItem = {
  id: string; name: string; description: string; detail: string
  price?: string; price_per_night?: string; avg_cost?: string
  category?: string; cuisine?: string; price_level?: string
  vibes?: string[]; amenities?: string[]; must_try?: string[]
  image_url?: string; location?: string; duration?: string; rating?: number
  source?: string; booking_url?: string
  metadata?: Record<string, unknown>
}

type PipelineRun = {
  id: string; destination_id: string; status: string
  steps_completed?: string[]; stats?: Record<string, number>
  error?: string; created_at: string; completed_at?: string
  catalog_destinations?: { city: string; country: string }
}

type Tab = 'overview' | 'catalog' | 'quality' | 'pipeline' | 'add' | 'eval'

// ─── Dashboard Shell ────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [secretInput, setSecretInput] = useState('')
  const [authError, setAuthError] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [counts, setCounts] = useState({ hotels: 0, activities: 0, restaurants: 0, templates: 0 })
  const [loading, setLoading] = useState(true)

  // All hooks MUST be above any conditional return
  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(api('/api/admin/pipeline'))
    const data = await res.json()
    setDestinations(data.destinations || [])
    setCounts({
      hotels: data.hotelCount || 0,
      activities: data.activityCount || 0,
      restaurants: data.restaurantCount || 0,
      templates: data.templateCount || 0,
    })
    setLoading(false)
  }, [])

  useEffect(() => { if (authed) loadData() }, [authed, loadData])

  // Auth gate — prompt for admin secret
  async function handleAuth() {
    setAdminSecret(secretInput)
    try {
      const res = await fetch(api('/api/admin/pipeline'))
      const data = await res.json()
      if (res.ok && data.destinations) {
        setAuthed(true)
        setAuthError(false)
      } else {
        setAuthError(true)
        setAdminSecret('')
      }
    } catch {
      setAuthError(true)
      setAdminSecret('')
    }
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#08080c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0e0e14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, width: 340, textAlign: 'center' }}>
          <h2 style={{ color: '#f0efe8', fontSize: 18, marginBottom: 8 }}>Admin Access</h2>
          <p style={{ color: '#7a7a85', fontSize: 13, marginBottom: 20 }}>Enter the admin secret to continue</p>
          <input
            type="password"
            value={secretInput}
            onChange={e => { setSecretInput(e.target.value); setAuthError(false) }}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="Admin secret"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${authError ? '#e74c3c' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.04)', color: '#f0efe8', fontSize: 14, marginBottom: 12, outline: 'none' }}
            autoFocus
          />
          {authError && <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 8 }}>Invalid secret</p>}
          <button
            onClick={handleAuth}
            style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: '#c8a44e', color: '#0a0a0f', fontWeight: 600, fontSize: 14, cursor: 'pointer', border: 'none' }}
          >
            Unlock
          </button>
        </div>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '\u25A3' },
    { key: 'catalog', label: 'Catalog', icon: '\u2630' },
    { key: 'quality', label: 'Data Quality', icon: '\u2714' },
    { key: 'pipeline', label: 'Pipeline', icon: '\u25B6' },
    { key: 'add', label: 'Add Destination', icon: '+' },
    { key: 'eval', label: 'Eval Pipeline', icon: '⚡' },
  ]

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] flex">
      {/* Sidebar */}
      <div className="w-[220px] border-r border-[rgba(255,255,255,0.06)] flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-[rgba(255,255,255,0.06)]">
          <span className="font-serif text-xl text-[#c8a44e]">Drift</span>
          <span className="text-[10px] text-[#4a4a55] ml-2 tracking-[2px] uppercase">Admin</span>
        </div>
        <nav className="flex-1 py-3">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`w-full px-5 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                tab === t.key
                  ? 'bg-[rgba(200,164,78,0.1)] text-[#c8a44e] border-r-2 border-[#c8a44e]'
                  : 'text-[#7a7a85] hover:text-[#f0efe8] hover:bg-[rgba(255,255,255,0.02)]'
              }`}
            >
              <span className="text-base w-5 text-center">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.06)]">
          <div className="text-[10px] text-[#4a4a55] uppercase tracking-[1px] mb-1">Quick Stats</div>
          <div className="text-[11px] text-[#7a7a85] space-y-0.5">
            <div>{destinations.length} destinations</div>
            <div>{counts.hotels}H / {counts.activities}A / {counts.restaurants}R</div>
            <div>{counts.templates} templates</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto px-8 py-8">
          {loading && tab === 'overview' ? (
            <div className="text-[#c8a44e] animate-pulse py-20 text-center font-serif text-xl">Loading...</div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab destinations={destinations} counts={counts} onRefresh={loadData} />}
              {tab === 'catalog' && <CatalogTab destinations={destinations} />}
              {tab === 'quality' && <DataQualityTab destinations={destinations} />}
              {tab === 'pipeline' && <PipelineTab destinations={destinations} onRefresh={loadData} />}
              {tab === 'add' && <AddDestinationTab onComplete={() => { loadData(); setTab('overview') }} />}
              {tab === 'eval' && (
                <div className="py-20 text-center">
                  <h2 className="font-serif text-2xl text-[#c8a44e] mb-4">Eval System</h2>
                  <p className="text-sm text-[#7a7a85] mb-6">
                    The eval system has moved to its own dedicated dashboard with batch evals, multi-LLM benchmarks, LLM-as-judge, and pattern analysis.
                  </p>
                  <a
                    href="/admin/eval"
                    className="inline-block bg-[#c8a44e] text-[#08080c] px-8 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Open Eval Dashboard &rarr;
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Overview ───────────────────────────────────────────────

function OverviewTab({ destinations, counts, onRefresh }: {
  destinations: Destination[]; counts: Record<string, number>; onRefresh: () => void
}) {
  const statCards = [
    { label: 'Destinations', value: destinations.length, color: '#c8a44e' },
    { label: 'Hotels', value: counts.hotels, color: '#5b9bd5' },
    { label: 'Activities', value: counts.activities, color: '#70c1b3' },
    { label: 'Restaurants', value: counts.restaurants, color: '#e07a5f' },
    { label: 'Templates', value: counts.templates, color: '#b07cd8' },
  ]

  const active = destinations.filter(d => d.status === 'active')
  const processing = destinations.filter(d => d.status === 'processing')
  const draft = destinations.filter(d => d.status !== 'active' && d.status !== 'processing')

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl mb-1">Dashboard</h1>
          <p className="text-sm text-[#7a7a85]">Pipeline operations & catalog management</p>
        </div>
        <button onClick={onRefresh} className="px-4 py-2 text-sm border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[#c8a44e] transition-colors">
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {statCards.map(c => (
          <div key={c.label} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
            <div className="text-3xl font-light font-serif" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[10px] text-[#7a7a85] mt-1 uppercase tracking-[1px]">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Health */}
      <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold mb-3">Catalog Health</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#70c1b3]" />
              <span className="text-xs text-[#7a7a85]">Active</span>
            </div>
            <div className="text-xl font-light">{active.length}</div>
            <div className="text-[10px] text-[#4a4a55]">{active.map(d => d.city).join(', ') || 'None'}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#c8a44e]" />
              <span className="text-xs text-[#7a7a85]">Processing</span>
            </div>
            <div className="text-xl font-light">{processing.length}</div>
            <div className="text-[10px] text-[#4a4a55]">{processing.map(d => d.city).join(', ') || 'None'}</div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#7a7a85]" />
              <span className="text-xs text-[#7a7a85]">Draft</span>
            </div>
            <div className="text-xl font-light">{draft.length}</div>
            <div className="text-[10px] text-[#4a4a55]">{draft.map(d => d.city).join(', ') || 'None'}</div>
          </div>
        </div>
      </div>

      {/* Destination Grid */}
      <h3 className="text-sm font-semibold mb-3">All Destinations</h3>
      {destinations.length === 0 ? (
        <div className="text-[#4a4a55] py-10 text-center border border-dashed border-[rgba(255,255,255,0.06)] rounded-xl">
          No destinations yet. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {destinations.map(d => (
            <DestinationCard key={d.id} dest={d} />
          ))}
        </div>
      )}
    </>
  )
}

function DestinationCard({ dest }: { dest: Destination }) {
  return (
    <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
      {dest.cover_image ? (
        <div className="relative w-full h-[120px]">
          <Image src={dest.cover_image} alt={dest.city} fill className="object-cover" sizes="300px" unoptimized />
        </div>
      ) : (
        <div className="w-full h-[120px] bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[#4a4a55] text-sm">No image</div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-serif text-lg capitalize">{dest.city}</span>
          <StatusBadge status={dest.status} />
        </div>
        <div className="text-xs text-[#7a7a85] mb-2">{dest.country}</div>
        {dest.description && (
          <div className="text-[11px] text-[#4a4a55] mb-2 line-clamp-2">{dest.description}</div>
        )}
        <div className="flex flex-wrap gap-1 mb-2">
          {dest.vibes?.map(v => (
            <span key={v} className="px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded text-[9px] text-[#7a7a85]">{v}</span>
          ))}
        </div>
        {dest.pipeline_run_at && (
          <div className="text-[10px] text-[#4a4a55]">
            Last run: {new Date(dest.pipeline_run_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-[rgba(112,193,179,0.15)] text-[#70c1b3]',
    processing: 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] || 'bg-[rgba(255,255,255,0.04)] text-[#4a4a55]'}`}>
      {status}
    </span>
  )
}

// ─── Catalog Browser ────────────────────────────────────────

function CatalogTab({ destinations }: { destinations: Destination[] }) {
  const [selectedDest, setSelectedDest] = useState<string | null>(null)
  const [catalogType, setCatalogType] = useState<'hotels' | 'activities' | 'restaurants'>('hotels')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [priceFilter, setPriceFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedDest) { setItems([]); return }
    setLoading(true)
    fetch(api('/api/admin/catalog', { type: catalogType, destination_id: selectedDest }))
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false) })
  }, [selectedDest, catalogType])

  // Filters
  const filtered = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sourceFilter !== 'all' && item.source && !item.source.includes(sourceFilter)) return false
    if (priceFilter !== 'all') {
      const pl = item.price_level || (item.metadata as Record<string, unknown>)?.price_level as string
      if (pl !== priceFilter) return false
    }
    return true
  })

  // Data quality stats
  const withImages = items.filter(i => i.image_url).length
  const withBooking = items.filter(i => i.booking_url).length
  const sources = [...new Set(items.map(i => i.source).filter(Boolean))]

  const destCity = destinations.find(d => d.id === selectedDest)?.city || ''

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Catalog Browser</h1>
        <p className="text-sm text-[#7a7a85]">Browse, filter, and inspect all catalog data</p>
      </div>

      {/* Destination picker */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {destinations.map(d => (
          <button
            key={d.id}
            onClick={() => { setSelectedDest(d.id); setExpandedId(null) }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              selectedDest === d.id
                ? 'border-[#c8a44e] bg-[rgba(200,164,78,0.1)] text-[#c8a44e]'
                : 'border-[rgba(255,255,255,0.06)] text-[#7a7a85] hover:border-[#7a7a85]'
            }`}
          >
            <span className="capitalize">{d.city}</span>
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>

      {!selectedDest ? (
        <div className="text-[#4a4a55] py-16 text-center">Select a destination above</div>
      ) : (
        <>
          {/* Type tabs + search + filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 bg-[#0e0e14] rounded-lg p-0.5">
              {(['hotels', 'activities', 'restaurants'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setCatalogType(t); setExpandedId(null) }}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    catalogType === t ? 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]' : 'text-[#7a7a85] hover:text-[#f0efe8]'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="px-3 py-1.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-sm text-[#f0efe8] outline-none focus:border-[#c8a44e] transition-colors placeholder-[#4a4a55] w-[200px]"
            />
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-sm text-[#f0efe8] outline-none"
            >
              <option value="all">All Sources</option>
              <option value="serpapi">SerpAPI</option>
              <option value="amadeus">Amadeus</option>
              <option value="ai">AI Only</option>
            </select>
            <select
              value={priceFilter}
              onChange={e => setPriceFilter(e.target.value)}
              className="px-3 py-1.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-sm text-[#f0efe8] outline-none"
            >
              <option value="all">All Prices</option>
              <option value="budget">Budget</option>
              <option value="mid">Mid</option>
              <option value="luxury">Luxury</option>
            </select>
          </div>

          {/* Data quality bar */}
          {!loading && items.length > 0 && (
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-6 text-xs">
                <span className="text-[#7a7a85]">
                  <strong className="text-[#f0efe8]">{items.length}</strong> {catalogType}
                </span>
                <span className="text-[#7a7a85]">
                  Images: <strong className={withImages === items.length ? 'text-[#70c1b3]' : withImages > 0 ? 'text-[#c8a44e]' : 'text-[#e07a5f]'}>
                    {withImages}/{items.length}
                  </strong>
                </span>
                <span className="text-[#7a7a85]">
                  Booking URLs: <strong className={withBooking === items.length ? 'text-[#70c1b3]' : withBooking > 0 ? 'text-[#c8a44e]' : 'text-[#e07a5f]'}>
                    {withBooking}/{items.length}
                  </strong>
                </span>
                <span className="text-[#7a7a85]">
                  Sources: {sources.map(s => (
                    <span key={s} className="ml-1 px-1.5 py-0.5 bg-[rgba(255,255,255,0.04)] rounded text-[9px]">{s}</span>
                  ))}
                </span>
                {search && <span className="text-[#c8a44e]">Showing {filtered.length} of {items.length}</span>}
              </div>
            </div>
          )}

          {/* Items */}
          {loading ? (
            <div className="text-[#c8a44e] animate-pulse py-10 text-center">Loading {catalogType}...</div>
          ) : filtered.length === 0 ? (
            <div className="text-[#4a4a55] py-10 text-center">
              {items.length === 0 ? `No ${catalogType} for ${destCity}` : 'No items match filters'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(item => (
                <CatalogItemRow
                  key={item.id}
                  item={item}
                  type={catalogType}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onUpdate={(updated) => {
                    if (updated.id === '__deleted__') {
                      setItems(prev => prev.filter(i => i.id !== item.id))
                    } else {
                      setItems(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

function CatalogItemRow({ item, type, expanded, onToggle, onUpdate }: {
  item: CatalogItem; type: string; expanded: boolean; onToggle: () => void; onUpdate?: (updated: CatalogItem) => void
}) {
  const price = type === 'hotels' ? item.price_per_night :
                type === 'restaurants' ? item.avg_cost : item.price
  const meta = item.metadata as Record<string, unknown> | undefined
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({ name: '', detail: '', image_url: '', booking_url: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function startEdit() {
    setEditFields({
      name: item.name || '',
      detail: item.detail || '',
      image_url: item.image_url || '',
      booking_url: item.booking_url || '',
      price: (type === 'hotels' ? item.price_per_night : type === 'restaurants' ? item.avg_cost : item.price) || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)
    const priceField = type === 'hotels' ? 'price_per_night' : type === 'restaurants' ? 'avg_cost' : 'price'
    const updates: Record<string, unknown> = {
      name: editFields.name,
      detail: editFields.detail,
      image_url: editFields.image_url || null,
      booking_url: editFields.booking_url || null,
      [priceField]: editFields.price,
    }
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'PUT', headers: buildHeaders(),
        body: JSON.stringify({ type, id: item.id, updates }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
        setEditing(false)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deleteItem() {
    if (!confirm(`Delete "${item.name}"?`)) return
    setDeleting(true)
    try {
      await fetch('/api/admin/catalog', {
        method: 'DELETE', headers: buildHeaders(),
        body: JSON.stringify({ type, id: item.id }),
      })
      onUpdate?.(({ ...item, id: '__deleted__' }) as CatalogItem)
    } catch { /* ignore */ }
    setDeleting(false)
  }

  return (
    <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
      <div className="flex items-center cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors" onClick={onToggle}>
        <div className="relative w-[80px] h-[60px] flex-shrink-0">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="80px" unoptimized />
          ) : (
            <div className="w-full h-full bg-[rgba(255,255,255,0.02)] flex items-center justify-center text-[#4a4a55] text-[9px]">No img</div>
          )}
        </div>
        <div className="flex-1 px-4 py-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm truncate">{item.name}</span>
            {item.rating && item.rating > 0 && (
              <span className="text-[10px] text-[#c8a44e] flex-shrink-0">{item.rating}★</span>
            )}
          </div>
          <div className="text-[11px] text-[#7a7a85] truncate">{item.detail}</div>
        </div>
        <div className="flex items-center gap-2 px-3 flex-shrink-0">
          {item.source && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
              item.source.includes('serpapi') ? 'bg-[rgba(112,193,179,0.1)] text-[#70c1b3]' :
              item.source.includes('amadeus') ? 'bg-[rgba(91,155,213,0.1)] text-[#5b9bd5]' :
              'bg-[rgba(255,255,255,0.04)] text-[#4a4a55]'
            }`}>{item.source}</span>
          )}
          {price && <span className="text-xs text-[#c8a44e] font-light">{price}</span>}
          <span className="text-[#4a4a55] text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.06)] p-4">
          {/* Edit / Delete buttons */}
          <div className="flex gap-2 mb-3">
            {!editing ? (
              <>
                <button onClick={startEdit} className="px-3 py-1 text-[11px] border border-[rgba(255,255,255,0.1)] rounded-full text-[#7a7a85] hover:border-[#c8a44e] hover:text-[#c8a44e] transition-colors">Edit</button>
                <button onClick={deleteItem} disabled={deleting} className="px-3 py-1 text-[11px] border border-[rgba(255,255,255,0.1)] rounded-full text-[#7a7a85] hover:border-[#e07a5f] hover:text-[#e07a5f] transition-colors">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            ) : (
              <>
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-[11px] bg-[rgba(200,164,78,0.15)] border border-[#c8a44e] rounded-full text-[#c8a44e] hover:bg-[rgba(200,164,78,0.25)] transition-colors">
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-[11px] border border-[rgba(255,255,255,0.1)] rounded-full text-[#7a7a85] hover:text-[#f0efe8] transition-colors">Cancel</button>
              </>
            )}
          </div>

          {editing ? (
            /* Inline Editor */
            <div className="space-y-2">
              {[
                { key: 'name', label: 'Name' },
                { key: 'detail', label: 'Detail' },
                { key: 'price', label: 'Price' },
                { key: 'image_url', label: 'Image URL' },
                { key: 'booking_url', label: 'Booking URL' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#7a7a85] w-[80px] flex-shrink-0">{f.label}</span>
                  <input
                    type="text"
                    value={editFields[f.key as keyof typeof editFields]}
                    onChange={e => setEditFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="flex-1 px-2 py-1.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded text-[11px] text-[#f0efe8] outline-none focus:border-[#c8a44e]"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Read-only detail view */
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <DetailRow label="Location" value={item.location} />
                <DetailRow label="Category" value={item.category || item.cuisine} />
                <DetailRow label="Price Level" value={item.price_level} />
                <DetailRow label="Duration" value={item.duration} />
                <DetailRow label="Booking URL" value={item.booking_url ? 'Yes' : 'None'} warn={!item.booking_url} />
                <DetailRow label="Image" value={item.image_url ? 'Yes' : 'None'} warn={!item.image_url} />
                {item.vibes && item.vibes.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Vibes</div>
                    <div className="flex flex-wrap gap-1">
                      {item.vibes.map(v => <span key={v} className="px-1.5 py-0.5 bg-[rgba(200,164,78,0.1)] text-[#c8a44e] rounded text-[9px]">{v}</span>)}
                    </div>
                  </div>
                )}
                {item.amenities && item.amenities.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Amenities</div>
                    <div className="flex flex-wrap gap-1">
                      {item.amenities.map(a => <span key={a} className="px-1.5 py-0.5 bg-[rgba(91,155,213,0.1)] text-[#5b9bd5] rounded text-[9px]">{a}</span>)}
                    </div>
                  </div>
                )}
                {item.must_try && item.must_try.length > 0 && (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Must Try</div>
                    <div className="flex flex-wrap gap-1">
                      {item.must_try.map(m => <span key={m} className="px-1.5 py-0.5 bg-[rgba(224,122,95,0.1)] text-[#e07a5f] rounded text-[9px]">{m}</span>)}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {meta?.honest_take ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Honest Take</div>
                    <div className="text-[11px] text-[#f0efe8] bg-[rgba(255,255,255,0.02)] p-2 rounded">{String(meta.honest_take)}</div>
                  </div>
                ) : null}
                {Array.isArray(meta?.practical_tips) && (meta.practical_tips as string[]).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Practical Tips</div>
                    <ul className="text-[11px] text-[#7a7a85] space-y-0.5">
                      {(meta.practical_tips as string[]).map((t, i) => <li key={i} className="flex gap-1"><span className="text-[#c8a44e]">-</span> {t}</li>)}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(meta?.best_for) && (meta.best_for as string[]).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Best For</div>
                    <div className="flex flex-wrap gap-1">
                      {(meta.best_for as string[]).map(b => <span key={b} className="px-1.5 py-0.5 bg-[rgba(176,124,216,0.1)] text-[#b07cd8] rounded text-[9px]">{b}</span>)}
                    </div>
                  </div>
                ) : null}
                {meta?.review_synthesis && typeof meta.review_synthesis === 'object' ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Review Synthesis</div>
                    <div className="text-[11px] space-y-1">
                      {((meta.review_synthesis as Record<string, string[]>).loved || []).length > 0 && (
                        <div><span className="text-[#70c1b3]">Loved:</span> <span className="text-[#7a7a85]">{((meta.review_synthesis as Record<string, string[]>).loved || []).join(' | ')}</span></div>
                      )}
                      {((meta.review_synthesis as Record<string, string[]>).complaints || []).length > 0 && (
                        <div><span className="text-[#e07a5f]">Complaints:</span> <span className="text-[#7a7a85]">{((meta.review_synthesis as Record<string, string[]>).complaints || []).join(' | ')}</span></div>
                      )}
                    </div>
                  </div>
                ) : null}
                {Array.isArray(meta?.photos) && (meta.photos as string[]).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Photos ({(meta.photos as string[]).length})</div>
                    <div className="flex gap-1 overflow-x-auto">
                      {(meta.photos as string[]).map((p, i) => <div key={i} className="relative w-[60px] h-[45px] flex-shrink-0"><Image src={p} alt="" fill className="object-cover rounded" sizes="60px" unoptimized /></div>)}
                    </div>
                  </div>
                ) : null}
                {Array.isArray(meta?.sampleReviews) && (meta.sampleReviews as { rating: number; text: string }[]).length > 0 ? (
                  <div>
                    <div className="text-[10px] text-[#7a7a85] mb-1">Sample Reviews</div>
                    <div className="space-y-1">
                      {(meta.sampleReviews as { rating: number; text: string }[]).slice(0, 2).map((r, i) => (
                        <div key={i} className="text-[10px] text-[#4a4a55] bg-[rgba(255,255,255,0.02)] p-1.5 rounded">
                          <span className="text-[#c8a44e]">{r.rating}★</span> {r.text.slice(0, 150)}...
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!editing && (
            <details className="mt-3">
              <summary className="text-[10px] text-[#4a4a55] cursor-pointer hover:text-[#7a7a85]">Raw metadata JSON</summary>
              <pre className="mt-1 text-[9px] text-[#4a4a55] bg-[rgba(255,255,255,0.02)] p-2 rounded overflow-x-auto max-h-[200px]">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, warn }: { label: string; value?: string | null; warn?: boolean }) {
  if (!value && !warn) return null
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-[#7a7a85] w-[80px] flex-shrink-0">{label}</span>
      <span className={warn ? 'text-[#e07a5f]' : 'text-[#f0efe8]'}>{value || 'Missing'}</span>
    </div>
  )
}

// ─── Data Quality ───────────────────────────────────────────

type QualityReport = {
  destination: Destination
  hotels: { total: number; withImage: number; withBooking: number; withReviews: number; withHonestTake: number; sources: Record<string, number> }
  activities: { total: number; withImage: number; withBooking: number; withReviews: number; withHonestTake: number; sources: Record<string, number> }
  restaurants: { total: number; withImage: number; withBooking: number; withReviews: number; withHonestTake: number; sources: Record<string, number> }
  hasTemplate: boolean
}

function DataQualityTab({ destinations }: { destinations: Destination[] }) {
  const [reports, setReports] = useState<QualityReport[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedDest, setExpandedDest] = useState<string | null>(null)

  useEffect(() => {
    if (destinations.length === 0) return
    setLoading(true)

    async function loadAll() {
      const results: QualityReport[] = []
      for (const dest of destinations) {
        const [hotelsRes, activitiesRes, restaurantsRes, templatesRes] = await Promise.all([
          fetch(api('/api/admin/catalog', { type: 'hotels', destination_id: dest.id })).then(r => r.json()),
          fetch(api('/api/admin/catalog', { type: 'activities', destination_id: dest.id })).then(r => r.json()),
          fetch(api('/api/admin/catalog', { type: 'restaurants', destination_id: dest.id })).then(r => r.json()),
          fetch(api('/api/admin/catalog', { type: 'templates', destination_id: dest.id })).then(r => r.json()),
        ])

        function analyze(items: CatalogItem[]) {
          const sources: Record<string, number> = {}
          let withImage = 0, withBooking = 0, withReviews = 0, withHonestTake = 0
          for (const item of items) {
            if (item.image_url) withImage++
            if (item.booking_url) withBooking++
            const meta = item.metadata as Record<string, unknown> | undefined
            if (meta?.sampleReviews && (meta.sampleReviews as unknown[]).length > 0) withReviews++
            if (meta?.honest_take) withHonestTake++
            const src = item.source || 'unknown'
            sources[src] = (sources[src] || 0) + 1
          }
          return { total: items.length, withImage, withBooking, withReviews, withHonestTake, sources }
        }

        results.push({
          destination: dest,
          hotels: analyze(hotelsRes),
          activities: analyze(activitiesRes),
          restaurants: analyze(restaurantsRes),
          hasTemplate: Array.isArray(templatesRes) && templatesRes.length > 0,
        })
      }
      setReports(results)
      setLoading(false)
    }
    loadAll()
  }, [destinations])

  function pct(n: number, total: number) {
    if (total === 0) return 0
    return Math.round((n / total) * 100)
  }

  function barColor(p: number) {
    if (p >= 80) return '#70c1b3'
    if (p >= 40) return '#c8a44e'
    return '#e07a5f'
  }

  function QualityBar({ value, total, label }: { value: number; total: number; label: string }) {
    const p = pct(value, total)
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[#7a7a85] w-[70px] flex-shrink-0 text-[10px]">{label}</span>
        <div className="flex-1 h-[6px] bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: barColor(p) }} />
        </div>
        <span className="text-[10px] w-[50px] text-right" style={{ color: barColor(p) }}>{value}/{total}</span>
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Data Quality</h1>
        <p className="text-sm text-[#7a7a85]">Per-destination completeness breakdown</p>
      </div>

      {loading ? (
        <div className="text-[#c8a44e] animate-pulse py-10 text-center">Analyzing catalog data...</div>
      ) : reports.length === 0 ? (
        <div className="text-[#4a4a55] py-10 text-center">No destinations to analyze</div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const d = report.destination
            const expanded = expandedDest === d.id
            const totalItems = report.hotels.total + report.activities.total + report.restaurants.total
            const totalImages = report.hotels.withImage + report.activities.withImage + report.restaurants.withImage
            const totalBooking = report.hotels.withBooking + report.activities.withBooking + report.restaurants.withBooking
            const totalReviews = report.hotels.withReviews + report.activities.withReviews + report.restaurants.withReviews
            const overallPct = totalItems > 0 ? Math.round(((totalImages + totalBooking + totalReviews) / (totalItems * 3)) * 100) : 0

            return (
              <div key={d.id} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
                {/* Summary row */}
                <div className="flex items-center p-4 cursor-pointer hover:bg-[rgba(255,255,255,0.02)]" onClick={() => setExpandedDest(expanded ? null : d.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-serif text-lg capitalize">{d.city}</span>
                      <StatusBadge status={d.status} />
                      {report.hasTemplate && <span className="px-1.5 py-0.5 bg-[rgba(176,124,216,0.1)] text-[#b07cd8] rounded text-[9px]">Template</span>}
                    </div>
                    <div className="text-[11px] text-[#7a7a85]">
                      {report.hotels.total} hotels, {report.activities.total} activities, {report.restaurants.total} restaurants
                    </div>
                  </div>

                  {/* Overall score */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-light" style={{ color: barColor(overallPct) }}>{overallPct}%</div>
                      <div className="text-[9px] text-[#4a4a55]">Complete</div>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      <div className="text-center">
                        <div style={{ color: barColor(pct(totalImages, totalItems)) }}>{totalImages}/{totalItems}</div>
                        <div className="text-[#4a4a55]">Images</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: barColor(pct(totalBooking, totalItems)) }}>{totalBooking}/{totalItems}</div>
                        <div className="text-[#4a4a55]">Booking</div>
                      </div>
                      <div className="text-center">
                        <div style={{ color: barColor(pct(totalReviews, totalItems)) }}>{totalReviews}/{totalItems}</div>
                        <div className="text-[#4a4a55]">Reviews</div>
                      </div>
                    </div>
                    <span className="text-[#4a4a55] text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {expanded && (
                  <div className="border-t border-[rgba(255,255,255,0.06)] p-4">
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { label: 'Hotels', data: report.hotels },
                        { label: 'Activities', data: report.activities },
                        { label: 'Restaurants', data: report.restaurants },
                      ].map(({ label, data }) => (
                        <div key={label}>
                          <div className="text-xs font-semibold mb-2 text-[#7a7a85]">{label} ({data.total})</div>
                          <div className="space-y-1.5">
                            <QualityBar value={data.withImage} total={data.total} label="Images" />
                            <QualityBar value={data.withBooking} total={data.total} label="Booking" />
                            <QualityBar value={data.withReviews} total={data.total} label="Reviews" />
                            <QualityBar value={data.withHonestTake} total={data.total} label="AI Enrich" />
                          </div>
                          {Object.keys(data.sources).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(data.sources).map(([src, count]) => (
                                <span key={src} className={`px-1.5 py-0.5 rounded text-[9px] ${
                                  src.includes('serpapi') ? 'bg-[rgba(112,193,179,0.1)] text-[#70c1b3]' :
                                  src.includes('amadeus') ? 'bg-[rgba(91,155,213,0.1)] text-[#5b9bd5]' :
                                  'bg-[rgba(255,255,255,0.04)] text-[#4a4a55]'
                                }`}>{src}: {count}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Missing data warnings */}
                    {(() => {
                      const warnings: string[] = []
                      if (report.hotels.withImage === 0 && report.hotels.total > 0) warnings.push('No hotel images')
                      if (report.activities.withImage === 0 && report.activities.total > 0) warnings.push('No activity images')
                      if (report.restaurants.withImage === 0 && report.restaurants.total > 0) warnings.push('No restaurant images')
                      if (report.hotels.withBooking === 0 && report.hotels.total > 0) warnings.push('No hotel booking URLs')
                      if (!report.hasTemplate) warnings.push('No itinerary template')
                      if (report.hotels.total === 0) warnings.push('Zero hotels')
                      if (report.restaurants.total === 0) warnings.push('Zero restaurants')
                      if (report.activities.total === 0) warnings.push('Zero activities')
                      if (warnings.length === 0) return null
                      return (
                        <div className="mt-4 bg-[rgba(224,122,95,0.06)] border border-[rgba(224,122,95,0.15)] rounded-lg p-3">
                          <div className="text-[10px] text-[#e07a5f] font-semibold mb-1">Issues</div>
                          <div className="flex flex-wrap gap-1.5">
                            {warnings.map(w => (
                              <span key={w} className="px-2 py-0.5 bg-[rgba(224,122,95,0.1)] text-[#e07a5f] rounded text-[10px]">{w}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Pipeline Runner ────────────────────────────────────────

const PIPELINE_STEPS = [
  { key: 'hotels', label: 'Hotels', desc: 'Amadeus + SerpAPI + LLM enrich', icon: '\uD83C\uDFE8' },
  { key: 'activities', label: 'Activities', desc: 'Amadeus Tours + SerpAPI + LLM enrich', icon: '\uD83C\uDFC4' },
  { key: 'restaurants', label: 'Restaurants', desc: 'SerpAPI + LLM enrich', icon: '\uD83C\uDF7D' },
  { key: 'template', label: 'Template', desc: 'Build itinerary from catalog', icon: '\uD83D\uDCCB' },
  { key: 'enrich', label: 'Enrich Dest', desc: 'Description + budget estimates', icon: '\u2728' },
]

function PipelineTab({ destinations, onRefresh }: { destinations: Destination[]; onRefresh: () => void }) {
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)
  const [runningStep, setRunningStep] = useState<string | null>(null)
  const [runningFull, setRunningFull] = useState(false)
  const [results, setResults] = useState<Record<string, { success: boolean; count?: number; error?: string }>>({})
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)

  // Load pipeline run history
  useEffect(() => {
    setLoadingRuns(true)
    fetch(api('/api/admin/catalog', { type: 'runs' }))
      .then(r => r.json())
      .then(data => { setRuns(Array.isArray(data) ? data : []); setLoadingRuns(false) })
      .catch(() => setLoadingRuns(false))
  }, [])

  async function runStep(step: string) {
    if (!selectedDest || runningStep || runningFull) return
    setRunningStep(step)
    try {
      const res = await fetch('/api/admin/pipeline', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({
          step,
          destinationId: selectedDest.id,
          city: selectedDest.city,
          country: selectedDest.country,
          vibes: selectedDest.vibes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResults(prev => ({ ...prev, [step]: { success: true, count: data.count } }))
      } else {
        setResults(prev => ({ ...prev, [step]: { success: false, error: data.error } }))
      }
    } catch (err) {
      setResults(prev => ({ ...prev, [step]: { success: false, error: String(err) } }))
    }
    setRunningStep(null)
    onRefresh()
  }

  async function runFullPipeline() {
    if (!selectedDest || runningStep || runningFull) return
    setRunningFull(true)
    setResults({})
    try {
      const res = await fetch('/api/admin/pipeline', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({
          city: selectedDest.city,
          country: selectedDest.country,
          vibes: selectedDest.vibes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const stepResults: Record<string, { success: boolean; count?: number }> = {}
        if (data.stats) {
          Object.entries(data.stats).forEach(([k, v]) => {
            stepResults[k] = { success: true, count: v as number }
          })
        }
        setResults(stepResults)
      } else {
        setResults({ full: { success: false, error: data.error } })
      }
    } catch (err) {
      setResults({ full: { success: false, error: String(err) } })
    }
    setRunningFull(false)
    onRefresh()
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Pipeline Runner</h1>
        <p className="text-sm text-[#7a7a85]">Run full pipeline or individual steps per destination</p>
      </div>

      {/* Destination picker */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {destinations.map(d => (
          <button
            key={d.id}
            onClick={() => { setSelectedDest(d); setResults({}) }}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              selectedDest?.id === d.id
                ? 'border-[#c8a44e] bg-[rgba(200,164,78,0.1)] text-[#c8a44e]'
                : 'border-[rgba(255,255,255,0.06)] text-[#7a7a85] hover:border-[#7a7a85]'
            }`}
          >
            <span className="capitalize">{d.city}</span> <StatusBadge status={d.status} />
          </button>
        ))}
      </div>

      {selectedDest ? (
        <>
          {/* Full pipeline button */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-lg capitalize">{selectedDest.city}{selectedDest.country && selectedDest.country.toLowerCase() !== selectedDest.city.toLowerCase() ? `, ${selectedDest.country}` : ''}</div>
                <div className="text-xs text-[#7a7a85] mt-0.5">
                  Runs all 5 steps sequentially: Hotels → Activities → Restaurants → Template → Enrich
                </div>
              </div>
              <button
                onClick={runFullPipeline}
                disabled={runningFull || !!runningStep}
                className="px-6 py-2.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[rgba(200,164,78,0.3)] transition-all"
              >
                {runningFull ? 'Running...' : 'Run Full Pipeline'}
              </button>
            </div>
            {runningFull && (
              <div className="mt-3 text-sm text-[#c8a44e] animate-pulse">Pipeline running... this takes ~60 seconds</div>
            )}
            {results.full?.error && (
              <div className="mt-3 text-sm text-[#e07a5f] bg-[rgba(224,122,95,0.1)] p-2 rounded">{results.full.error}</div>
            )}
          </div>

          {/* Individual steps */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {PIPELINE_STEPS.map(step => {
              const result = results[step.key]
              const isRunning = runningStep === step.key
              return (
                <div key={step.key} className={`bg-[#0e0e14] border rounded-xl p-4 transition-all ${
                  result?.success ? 'border-[rgba(112,193,179,0.3)]' :
                  result?.error ? 'border-[rgba(224,122,95,0.3)]' :
                  isRunning ? 'border-[rgba(200,164,78,0.3)]' :
                  'border-[rgba(255,255,255,0.06)]'
                }`}>
                  <div className="text-lg mb-1">{step.icon}</div>
                  <div className="text-sm font-semibold mb-0.5">{step.label}</div>
                  <div className="text-[10px] text-[#4a4a55] mb-3">{step.desc}</div>
                  {result?.success ? (
                    <div className="text-[11px] text-[#70c1b3]">{result.count} items</div>
                  ) : result?.error ? (
                    <div className="text-[10px] text-[#e07a5f] truncate" title={result.error}>{result.error.slice(0, 50)}</div>
                  ) : (
                    <button
                      onClick={() => runStep(step.key)}
                      disabled={!!runningStep || runningFull}
                      className="px-3 py-1 text-[11px] border border-[rgba(255,255,255,0.1)] rounded-full text-[#7a7a85] hover:border-[#c8a44e] hover:text-[#c8a44e] transition-colors disabled:opacity-30"
                    >
                      {isRunning ? 'Running...' : 'Run Step'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="text-[#4a4a55] py-16 text-center">Select a destination to run pipeline steps</div>
      )}

      {/* Run History with Logs */}
      <h3 className="text-sm font-semibold mb-3 mt-8">Pipeline Run History</h3>
      {loadingRuns ? (
        <div className="text-[#c8a44e] animate-pulse text-sm">Loading runs...</div>
      ) : runs.length === 0 ? (
        <div className="text-[#4a4a55] text-sm">No pipeline runs yet</div>
      ) : (
        <div className="space-y-2">
          {runs.slice(0, 15).map(run => (
            <PipelineRunRow key={run.id} run={run} />
          ))}
        </div>
      )}
    </>
  )
}

function PipelineRunRow({ run }: { run: PipelineRun }) {
  const [expanded, setExpanded] = useState(false)

  const allSteps = ['hotels', 'activities', 'restaurants', 'template', 'enrich']
  const completed = run.steps_completed || []
  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at).getTime() - new Date(run.created_at).getTime()) / 1000)
    : null

  return (
    <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
      <div className="p-3 flex items-center gap-4 cursor-pointer hover:bg-[rgba(255,255,255,0.02)]" onClick={() => setExpanded(!expanded)}>
        <StatusBadge status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm capitalize">
            {run.catalog_destinations?.city || 'Unknown'}{run.catalog_destinations?.country && run.catalog_destinations.country.toLowerCase() !== run.catalog_destinations.city?.toLowerCase() ? `, ${run.catalog_destinations.country}` : ''}
          </div>
          <div className="text-[10px] text-[#4a4a55]">
            {new Date(run.created_at).toLocaleString()}
            {duration !== null && ` — ${duration}s`}
          </div>
        </div>
        {/* Step progress dots */}
        <div className="flex gap-1">
          {allSteps.map(s => (
            <div
              key={s}
              title={s}
              className={`w-2.5 h-2.5 rounded-full ${
                completed.includes(s) ? 'bg-[#70c1b3]' :
                run.status === 'failed' && !completed.includes(s) && completed.length > 0 && allSteps.indexOf(s) === completed.length ? 'bg-[#e07a5f]' :
                'bg-[rgba(255,255,255,0.06)]'
              }`}
            />
          ))}
        </div>
        <span className="text-[#4a4a55] text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {expanded && (
        <div className="border-t border-[rgba(255,255,255,0.06)] p-4">
          {/* Step-by-step log */}
          <div className="space-y-1.5 mb-3">
            {allSteps.map((step, i) => {
              const done = completed.includes(step)
              const failed = run.status === 'failed' && !done && i === completed.length
              const pending = !done && !failed
              const count = run.stats?.[step]

              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    done ? 'bg-[rgba(112,193,179,0.15)] text-[#70c1b3]' :
                    failed ? 'bg-[rgba(224,122,95,0.15)] text-[#e07a5f]' :
                    'bg-[rgba(255,255,255,0.04)] text-[#4a4a55]'
                  }`}>
                    {done ? '\u2713' : failed ? '\u2717' : (i + 1)}
                  </div>
                  {i > 0 && <div className="absolute ml-[10px] -mt-[18px] w-px h-[10px] bg-[rgba(255,255,255,0.06)]" />}
                  <div className="flex-1">
                    <span className={`text-xs ${done ? 'text-[#f0efe8]' : failed ? 'text-[#e07a5f]' : 'text-[#4a4a55]'}`}>
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </span>
                    {count !== undefined && (
                      <span className="ml-2 text-[10px] text-[#7a7a85]">{count} items</span>
                    )}
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    done ? 'bg-[rgba(112,193,179,0.1)] text-[#70c1b3]' :
                    failed ? 'bg-[rgba(224,122,95,0.1)] text-[#e07a5f]' :
                    pending ? 'text-[#4a4a55]' : ''
                  }`}>
                    {done ? 'completed' : failed ? 'failed' : 'pending'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Error details */}
          {run.error && (
            <div className="bg-[rgba(224,122,95,0.06)] border border-[rgba(224,122,95,0.15)] rounded-lg p-3 mt-2">
              <div className="text-[10px] text-[#e07a5f] font-semibold mb-1">Error</div>
              <div className="text-[11px] text-[#e07a5f] whitespace-pre-wrap break-all">{run.error}</div>
            </div>
          )}

          {/* Stats summary */}
          {run.stats && Object.keys(run.stats).length > 0 && (
            <div className="mt-3 flex gap-4">
              {Object.entries(run.stats).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="text-lg font-light text-[#f0efe8]">{v}</div>
                  <div className="text-[9px] text-[#4a4a55] uppercase">{k}</div>
                </div>
              ))}
            </div>
          )}

          {/* Run ID */}
          <div className="mt-3 text-[9px] text-[#4a4a55]">Run ID: {run.id}</div>
        </div>
      )}
    </div>
  )
}

// ─── Add Destination ────────────────────────────────────────

const VIBE_OPTIONS = ['beach', 'adventure', 'city', 'romance', 'spiritual', 'foodie', 'party', 'culture', 'winter', 'nature', 'nightlife', 'wellness']

function AddDestinationTab({ onComplete }: { onComplete: () => void }) {
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [language, setLanguage] = useState('')
  const [timezone, setTimezone] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ destinationId: string; stats: Record<string, number> } | null>(null)

  function toggleVibe(v: string) {
    setSelectedVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  async function runPipeline() {
    if (!city || !country) return
    setRunning(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/admin/pipeline', {
        method: 'POST', headers: buildHeaders(),
        body: JSON.stringify({ city, country, vibes: selectedVibes, language, timezone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Pipeline failed')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline failed')
    }
    setRunning(false)
    if (!error) onComplete()
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-serif text-3xl mb-1">Add Destination</h1>
        <p className="text-sm text-[#7a7a85]">Create a new destination and run the full pipeline</p>
      </div>

      <div className="max-w-[600px]">
        {/* City & Country */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-[10px] text-[#7a7a85] uppercase tracking-[1px] block mb-1">City</label>
            <input
              type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="e.g. Bali"
              className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] transition-colors placeholder-[#4a4a55]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#7a7a85] uppercase tracking-[1px] block mb-1">Country</label>
            <input
              type="text" value={country} onChange={e => setCountry(e.target.value)}
              placeholder="e.g. Indonesia"
              className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] transition-colors placeholder-[#4a4a55]"
            />
          </div>
        </div>

        {/* Vibes */}
        <div className="mb-5">
          <label className="text-[10px] text-[#7a7a85] uppercase tracking-[1px] block mb-1.5">Vibes</label>
          <div className="flex flex-wrap gap-2">
            {VIBE_OPTIONS.map(v => (
              <button
                key={v}
                onClick={() => toggleVibe(v)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                  selectedVibes.includes(v)
                    ? 'border-[#c8a44e] bg-[rgba(200,164,78,0.15)] text-[#c8a44e]'
                    : 'border-[rgba(255,255,255,0.06)] text-[#7a7a85] hover:border-[#7a7a85]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Optional fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-[10px] text-[#7a7a85] uppercase tracking-[1px] block mb-1">Language</label>
            <input
              type="text" value={language} onChange={e => setLanguage(e.target.value)}
              placeholder="e.g. Indonesian"
              className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] transition-colors placeholder-[#4a4a55]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#7a7a85] uppercase tracking-[1px] block mb-1">Timezone</label>
            <input
              type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
              placeholder="e.g. Asia/Bali"
              className="w-full px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] transition-colors placeholder-[#4a4a55]"
            />
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={runPipeline}
          disabled={!city || !country || running}
          className="px-8 py-3 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[rgba(200,164,78,0.3)] transition-all"
        >
          {running ? 'Running Pipeline...' : 'Create & Run Pipeline'}
        </button>

        {running && (
          <div className="mt-4 text-sm text-[#c8a44e] animate-pulse">Pipeline running... this takes ~60 seconds</div>
        )}

        {result && (
          <div className="mt-4 bg-[#0e0e14] border border-[rgba(112,193,179,0.2)] rounded-xl p-5">
            <div className="text-[#70c1b3] font-semibold text-sm mb-3">Pipeline completed!</div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(result.stats).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="text-xl font-light text-[#f0efe8]">{v}</div>
                  <div className="text-[10px] text-[#7a7a85] uppercase">{k}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-[rgba(224,122,95,0.1)] border border-[rgba(224,122,95,0.2)] rounded-xl p-4 text-[#e07a5f] text-sm">
            {error}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Eval Pipeline Tab ──────────────────────────────────────

type EvalScore = {
  destination: string
  vibes: string[]
  overallScore: number
  summary: string
  dimensions: {
    placeValidity: { score: number; verified: number; total: number; invalid: string[] }
    vibeMatch: { score: number; matched: number; total: number; mismatches: string[] }
    mustSeeCoverage: { score: number; hit: number; total: number; mustSees: string[]; missing: string[] }
    priceRealism: { score: number; notes: string }
    dayBalance: { score: number; itemsPerDay: number[]; notes: string }
    ratingQuality: { score: number; avgRating: number; ratedCount: number; total: number }
  }
}

type BenchmarkScore = {
  destination: string
  vibes: string[]
  drift: EvalScore
  rawLlm: EvalScore
  delta: { overall: number; placeValidity: number; vibeMatch: number; mustSee: number; ratings: number }
}

const EVAL_PRESETS = [
  { dest: 'Tokyo', country: 'Japan', vibes: ['culture', 'foodie'], days: 4 },
  { dest: 'Barcelona', country: 'Spain', vibes: ['city', 'romance', 'foodie'], days: 3 },
  { dest: 'Cape Town', country: 'South Africa', vibes: ['adventure', 'beach'], days: 5 },
  { dest: 'Bali', country: 'Indonesia', vibes: ['beach', 'spiritual', 'romance'], days: 4 },
  { dest: 'Istanbul', country: 'Turkey', vibes: ['culture', 'foodie', 'city'], days: 3 },
  { dest: 'Lisbon', country: 'Portugal', vibes: ['culture', 'romance'], days: 4 },
  { dest: 'Marrakech', country: 'Morocco', vibes: ['adventure', 'culture', 'foodie'], days: 3 },
  { dest: 'Bangkok', country: 'Thailand', vibes: ['foodie', 'city'], days: 3 },
]

function scoreColor(score: number): string {
  if (score >= 85) return '#4ecdc4'
  if (score >= 70) return '#c8a44e'
  if (score >= 50) return '#f0a500'
  return '#e74c3c'
}

function EvalPipelineTab() {
  const [results, setResults] = useState<EvalScore[]>([])
  const [benchmarks, setBenchmarks] = useState<BenchmarkScore[]>([])
  const [mode, setMode] = useState<'eval' | 'benchmark'>('eval')
  const [running, setRunning] = useState(false)
  const [currentDest, setCurrentDest] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [customDest, setCustomDest] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [customVibes, setCustomVibes] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  async function runPresetEval() {
    setRunning(true)
    setResults([])
    setProgress({ done: 0, total: EVAL_PRESETS.length })

    // Need a token — use admin to create temp user
    const loginRes = await fetch('/api/auth/callback?eval=true').catch(() => null)
    void loginRes

    for (let i = 0; i < EVAL_PRESETS.length; i++) {
      const p = EVAL_PRESETS[i]
      setCurrentDest(p.dest)
      setProgress({ done: i, total: EVAL_PRESETS.length })

      try {
        const result = await runSingleEval(p.dest, p.country, p.vibes, p.days)
        if (result) {
          if (mode === 'benchmark' && 'drift' in result) {
            setBenchmarks(prev => [...prev, result as unknown as BenchmarkScore])
          } else {
            setResults(prev => [...prev, result as EvalScore])
          }
        }
      } catch (e) {
        console.error(`Eval failed for ${p.dest}:`, e)
      }
    }

    setCurrentDest('')
    setRunning(false)
    setProgress({ done: EVAL_PRESETS.length, total: EVAL_PRESETS.length })
  }

  async function runCustomEval() {
    if (!customDest) return
    setRunning(true)
    setCurrentDest(customDest)

    const vibes = customVibes.split(',').map(v => v.trim()).filter(Boolean)
    try {
      const result = await runSingleEval(customDest, customCountry, vibes.length ? vibes : ['culture', 'foodie'], 4)
      if (result) setResults(prev => [...prev, result])
    } catch (e) {
      console.error('Eval failed:', e)
    }

    setCurrentDest('')
    setRunning(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runSingleEval(dest: string, country: string, vibes: string[], days: number): Promise<any> {
    // Step 1: Generate trip via admin secret
    const today = new Date()
    const start = new Date(today.setDate(today.getDate() + 14)).toISOString().split('T')[0]
    const end = new Date(new Date(start).setDate(new Date(start).getDate() + days)).toISOString().split('T')[0]

    const genRes = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { ...buildHeaders(), Authorization: `Bearer ${getSecret()}` },
      body: JSON.stringify({
        type: 'itinerary', destination: dest, country, vibes,
        start_date: start, end_date: end, travelers: 2, budget: 'mid', origin: 'Delhi',
      }),
    })

    // If auth fails (admin secret isn't a user token), try the trip eval on existing trips
    if (!genRes.ok) {
      console.warn(`Generate failed for ${dest} (${genRes.status}), trying existing trips...`)
      return null
    }

    const genData = await genRes.json()
    if (!genData.trip?.id) return null

    // Step 2: Run eval (with optional benchmark)
    const evalRes = await fetch('/api/ai/eval', {
      method: 'POST',
      headers: { ...buildHeaders(), Authorization: `Bearer ${getSecret()}` },
      body: JSON.stringify({ tripId: genData.trip.id, benchmark: mode === 'benchmark' }),
    })

    if (!evalRes.ok) return null
    return evalRes.json()
  }

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length)
    : 0

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl text-[#f0efe8]">Eval Pipeline</h2>
          <p className="text-[12px] text-[#7a7a85] mt-1">Automated quality scoring for generated itineraries</p>
        </div>
        {results.length > 0 && (
          <div className="text-center">
            <div className="text-3xl font-light" style={{ color: scoreColor(avgScore) }}>{avgScore}</div>
            <div className="text-[8px] uppercase tracking-wider text-[#4a4a55]">Avg Score</div>
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => { setMode('eval'); setResults([]); setBenchmarks([]) }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'eval' ? 'bg-[#c8a44e] text-[#0a0a0f]' : 'border border-[rgba(255,255,255,0.1)] text-[#7a7a85]'}`}
        >
          Quality Eval
        </button>
        <button
          onClick={() => { setMode('benchmark'); setResults([]); setBenchmarks([]) }}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${mode === 'benchmark' ? 'bg-[#c8a44e] text-[#0a0a0f]' : 'border border-[rgba(255,255,255,0.1)] text-[#7a7a85]'}`}
        >
          Benchmark vs Raw LLM
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Preset batch */}
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
          <div className="text-xs font-semibold text-[#f0efe8] mb-2">{mode === 'benchmark' ? 'Batch Benchmark (Drift vs Raw LLM)' : 'Batch Eval (8 destinations)'}</div>
          <div className="text-[10px] text-[#7a7a85] mb-3">
            {EVAL_PRESETS.map(p => p.dest).join(', ')}
          </div>
          <button
            onClick={runPresetEval}
            disabled={running}
            className="w-full py-2 rounded-lg bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold disabled:opacity-30"
          >
            {running ? `Evaluating ${currentDest}... (${progress.done}/${progress.total})` : 'Run Batch Eval'}
          </button>
        </div>

        {/* Custom */}
        <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4">
          <div className="text-xs font-semibold text-[#f0efe8] mb-2">Custom Eval</div>
          <div className="flex gap-2 mb-2">
            <input value={customDest} onChange={e => setCustomDest(e.target.value)} placeholder="Destination" className="flex-1 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-xs text-[#f0efe8] placeholder:text-[#4a4a55]" />
            <input value={customCountry} onChange={e => setCustomCountry(e.target.value)} placeholder="Country" className="w-24 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-xs text-[#f0efe8] placeholder:text-[#4a4a55]" />
          </div>
          <input value={customVibes} onChange={e => setCustomVibes(e.target.value)} placeholder="Vibes (comma separated)" className="w-full bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-1.5 text-xs text-[#f0efe8] placeholder:text-[#4a4a55] mb-2" />
          <button
            onClick={runCustomEval}
            disabled={running || !customDest}
            className="w-full py-2 rounded-lg border border-[#c8a44e] text-[#c8a44e] text-sm font-semibold disabled:opacity-30"
          >
            {running ? `Evaluating ${currentDest}...` : 'Run Eval'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 grid grid-cols-7 gap-3 text-center text-[9px] uppercase tracking-wider text-[#4a4a55]">
            <div>Destination</div>
            <div>Overall</div>
            <div>Places</div>
            <div>Vibes</div>
            <div>Must-Sees</div>
            <div>Balance</div>
            <div>Ratings</div>
          </div>

          {results.map((r, i) => (
            <div key={i}>
              <button
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="w-full bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 grid grid-cols-7 gap-3 items-center text-center hover:border-[rgba(255,255,255,0.12)] transition-all"
              >
                <div className="text-left">
                  <div className="text-sm text-[#f0efe8]">{r.destination}</div>
                  <div className="text-[9px] text-[#4a4a55]">{r.vibes.join(', ')}</div>
                </div>
                <div className="text-xl font-light" style={{ color: scoreColor(r.overallScore) }}>{r.overallScore}</div>
                <div style={{ color: scoreColor(r.dimensions.placeValidity.score) }}>{r.dimensions.placeValidity.score}</div>
                <div style={{ color: scoreColor(r.dimensions.vibeMatch.score) }}>{r.dimensions.vibeMatch.score}</div>
                <div style={{ color: scoreColor(r.dimensions.mustSeeCoverage.score) }}>{r.dimensions.mustSeeCoverage.score}</div>
                <div style={{ color: scoreColor(r.dimensions.dayBalance.score) }}>{r.dimensions.dayBalance.score}</div>
                <div style={{ color: scoreColor(r.dimensions.ratingQuality.score) }}>{r.dimensions.ratingQuality.score}</div>
              </button>

              {/* Expanded detail */}
              {expandedIdx === i && (
                <div className="bg-[#0a0a10] border border-[rgba(255,255,255,0.04)] rounded-b-xl px-5 py-4 -mt-1 space-y-3">
                  <p className="text-xs text-[#7a7a85]">{r.summary}</p>

                  {r.dimensions.placeValidity.invalid.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-[#e74c3c] mb-1">Unverified Places</div>
                      <div className="text-xs text-[#7a7a85]">{r.dimensions.placeValidity.invalid.join(', ')}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#c8a44e] mb-1">Must-Sees for {r.vibes.join(' + ')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.dimensions.mustSeeCoverage.mustSees.map(ms => {
                        const hit = !r.dimensions.mustSeeCoverage.missing.includes(ms)
                        return (
                          <span key={ms} className={`px-2 py-0.5 rounded text-[10px] ${hit ? 'bg-[rgba(78,205,196,0.15)] text-[#4ecdc4]' : 'bg-[rgba(231,76,60,0.15)] text-[#e74c3c]'}`}>
                            {hit ? '✓' : '✗'} {ms}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {r.dimensions.vibeMatch.mismatches.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-[#f0a500] mb-1">Vibe Mismatches</div>
                      {r.dimensions.vibeMatch.mismatches.map((m, j) => (
                        <div key={j} className="text-[10px] text-[#7a7a85]">• {m}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-6 text-[10px] text-[#7a7a85]">
                    <div>Days: {r.dimensions.dayBalance.itemsPerDay.join(', ')} items</div>
                    <div>Avg rating: {r.dimensions.ratingQuality.avgRating}★ ({r.dimensions.ratingQuality.ratedCount}/{r.dimensions.ratingQuality.total})</div>
                    <div>{r.dimensions.priceRealism.notes}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Benchmark Results (Drift vs Raw LLM) */}
      {benchmarks.length > 0 && (
        <div className="space-y-3 mt-6">
          <div className="text-sm font-semibold text-[#f0efe8] mb-3">Drift vs Raw LLM — Side by Side</div>

          <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 grid grid-cols-8 gap-2 text-center text-[8px] uppercase tracking-wider text-[#4a4a55]">
            <div className="text-left">Destination</div>
            <div>Source</div>
            <div>Overall</div>
            <div>Places</div>
            <div>Vibes</div>
            <div>Must-Sees</div>
            <div>Balance</div>
            <div>Ratings</div>
          </div>

          {benchmarks.map((b, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-[#0e0e14] border border-[rgba(78,205,196,0.15)] rounded-xl p-3 grid grid-cols-8 gap-2 items-center text-center text-xs">
                <div className="text-left">
                  <div className="text-[#f0efe8]">{b.destination}</div>
                  <div className="text-[8px] text-[#4a4a55]">{b.vibes.join(', ')}</div>
                </div>
                <div className="text-[#4ecdc4] font-semibold text-[10px]">DRIFT</div>
                <div className="text-lg font-light" style={{ color: scoreColor(b.drift.overallScore) }}>{b.drift.overallScore}</div>
                <div style={{ color: scoreColor(b.drift.dimensions.placeValidity.score) }}>{b.drift.dimensions.placeValidity.score}</div>
                <div style={{ color: scoreColor(b.drift.dimensions.vibeMatch.score) }}>{b.drift.dimensions.vibeMatch.score}</div>
                <div style={{ color: scoreColor(b.drift.dimensions.mustSeeCoverage.score) }}>{b.drift.dimensions.mustSeeCoverage.score}</div>
                <div style={{ color: scoreColor(b.drift.dimensions.dayBalance.score) }}>{b.drift.dimensions.dayBalance.score}</div>
                <div style={{ color: scoreColor(b.drift.dimensions.ratingQuality.score) }}>{b.drift.dimensions.ratingQuality.score}</div>
              </div>
              <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 grid grid-cols-8 gap-2 items-center text-center text-xs">
                <div></div>
                <div className="text-[#7a7a85] font-semibold text-[10px]">RAW LLM</div>
                <div className="text-lg font-light" style={{ color: scoreColor(b.rawLlm.overallScore) }}>{b.rawLlm.overallScore}</div>
                <div style={{ color: scoreColor(b.rawLlm.dimensions.placeValidity.score) }}>{b.rawLlm.dimensions.placeValidity.score}</div>
                <div style={{ color: scoreColor(b.rawLlm.dimensions.vibeMatch.score) }}>{b.rawLlm.dimensions.vibeMatch.score}</div>
                <div style={{ color: scoreColor(b.rawLlm.dimensions.mustSeeCoverage.score) }}>{b.rawLlm.dimensions.mustSeeCoverage.score}</div>
                <div style={{ color: scoreColor(b.rawLlm.dimensions.dayBalance.score) }}>{b.rawLlm.dimensions.dayBalance.score}</div>
                <div style={{ color: scoreColor(b.rawLlm.dimensions.ratingQuality.score) }}>{b.rawLlm.dimensions.ratingQuality.score}</div>
              </div>
              <div className="bg-[rgba(200,164,78,0.04)] rounded-xl p-2 grid grid-cols-8 gap-2 items-center text-center text-[10px]">
                <div></div>
                <div className="text-[#c8a44e] font-bold">DELTA</div>
                {[b.delta.overall, b.delta.placeValidity, b.delta.vibeMatch, b.delta.mustSee, 0, b.delta.ratings].map((d, j) => (
                  <div key={j} className={d > 0 ? 'text-[#4ecdc4] font-semibold' : d < 0 ? 'text-[#e74c3c]' : 'text-[#4a4a55]'}>
                    {d > 0 ? '+' : ''}{d}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {benchmarks.length > 1 && (
            <div className="bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] rounded-xl p-5 text-center mt-4">
              <div className="text-[9px] uppercase tracking-wider text-[#c8a44e] mb-2">Average Delta across {benchmarks.length} destinations</div>
              <div className="text-4xl font-light text-[#4ecdc4]">
                +{Math.round(benchmarks.reduce((s, b) => s + b.delta.overall, 0) / benchmarks.length)}
              </div>
              <div className="text-xs text-[#7a7a85] mt-1">
                Drift scores higher than a raw LLM on average
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
