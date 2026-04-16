'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import { getDestinationImage } from '@/lib/images'

type TripSummary = {
  id: string; destination: string; country: string; vibes: string[]
  start_date: string; end_date: string; travelers: number; budget: string
  status: string; share_slug: string | null; is_public: boolean; created_at: string
}

function getDays(s: string, e: string) { return s && e ? Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)) : 0 }
function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }

type Category = 'all' | 'upcoming' | 'planning' | 'past'

function categorize(t: TripSummary): 'upcoming' | 'planning' | 'past' {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  if (t.end_date && new Date(t.end_date + 'T00:00:00') < now) return 'past'
  if (t.start_date && new Date(t.start_date + 'T00:00:00') >= now) return 'upcoming'
  return 'planning'
}

export default function MobileAllTripsPage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Category>('all')

  useEffect(() => {
    if (!token || !userId) return
    supabase
      .from('trips')
      .select('id, destination, country, vibes, start_date, end_date, travelers, budget, status, share_slug, is_public, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTrips((data || []) as TripSummary[])
        setLoading(false)
      }, () => setLoading(false))
  }, [token, userId])

  const filtered = useMemo(() => {
    let list = tab === 'all' ? trips : trips.filter(t => categorize(t) === tab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.destination.toLowerCase().includes(q) ||
        t.country?.toLowerCase().includes(q) ||
        t.vibes?.some(v => v.toLowerCase().includes(q))
      )
    }
    return list
  }, [trips, tab, search])

  const counts = useMemo(() => ({
    all: trips.length,
    upcoming: trips.filter(t => categorize(t) === 'upcoming').length,
    planning: trips.filter(t => categorize(t) === 'planning').length,
    past: trips.filter(t => categorize(t) === 'past').length,
  }), [trips])

  return (
    <div className="relative h-full bg-drift-bg text-drift-text">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 starfield opacity-50" />
        <div className="aurora-blob h-[400px] w-[400px] left-[30%] top-[20%] bg-drift-gold" style={{ opacity: 0.04 }} />
        <div className="absolute inset-0 noise-grain opacity-40" />
      </div>

      <div className="relative z-10 h-full overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">

        {/* Back + header */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => router.push('/m')}
            className="flex items-center gap-1.5 text-drift-text2 text-[12px] active:text-drift-text"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Home
          </button>
        </div>

        {/* Title */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-4 bg-drift-gold/60" />
            <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/80">Archive</span>
          </div>
          <h1 className="font-serif text-[28px] font-light leading-[1.05] tracking-tight">
            All <em className="italic text-drift-gold">trips</em>
          </h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search destination, country, vibe..."
            className="w-full rounded-xl border border-drift-border2 bg-drift-surface pl-9 pr-4 py-2.5 text-[12px] text-drift-text placeholder:text-white/25 focus:border-drift-gold/30 focus:outline-none transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-5 px-5">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'upcoming' as const, label: 'Upcoming' },
            { key: 'planning' as const, label: 'Planning' },
            { key: 'past' as const, label: 'Past' },
          ] as const).filter(t => t.key === 'all' || counts[t.key] > 0).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg font-mono text-[8px] uppercase tracking-[1.5px] transition-all ${
                tab === t.key
                  ? 'bg-drift-gold/10 text-drift-gold border border-drift-gold/20'
                  : 'text-white/35 border border-transparent'
              }`}
            >
              {t.label} <span className="ml-1 tabular-nums">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-drift-gold/30 border-t-drift-gold" />
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((trip, i) => {
              const cat = categorize(trip)
              const days = getDays(trip.start_date, trip.end_date)
              return (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/m/board/${trip.id}`)}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-drift-border2 bg-drift-card p-3 text-left transition-all active:scale-[0.98]"
                  style={{ animation: `fadeUp 0.4s var(--ease-smooth) ${Math.min(i, 12) * 0.04}s both` }}
                >
                  <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-drift-border2">
                    <Image src={getDestinationImage(trip.destination)} alt={trip.destination} fill className="object-cover" sizes="56px" unoptimized />
                    <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 10px rgba(0,0,0,0.4)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-serif text-[15px] font-light text-drift-text truncate">
                        {trip.destination}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[7px] font-medium tracking-[0.5px] uppercase ${
                        cat === 'upcoming' ? 'bg-[#4ecdc4]/15 text-[#4ecdc4]'
                        : cat === 'planning' ? 'bg-drift-gold/15 text-drift-gold'
                        : 'bg-white/[0.06] text-white/40'
                      }`}>
                        {cat}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-drift-text3">
                      {days > 0 && <span>{days}d</span>}
                      {trip.start_date && days > 0 && <span className="text-white/15">·</span>}
                      {trip.start_date && <span>{fmtDate(trip.start_date)}</span>}
                      {trip.travelers > 1 && (
                        <>
                          <span className="text-white/15">·</span>
                          <span>{trip.travelers} pax</span>
                        </>
                      )}
                    </div>
                    {trip.vibes?.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {trip.vibes.slice(0, 3).map(v => (
                          <span key={v} className="rounded-full bg-drift-gold/[0.06] px-1.5 py-0.5 text-[8px] text-drift-gold/70">{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a4a55" strokeWidth="1.5" className="shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="font-serif text-[16px] text-white/50 mb-1">No trips found</div>
            <div className="text-[11px] text-drift-text3">
              {search ? 'Try a different search.' : trips.length === 0 ? 'Your planned trips will appear here.' : 'Nothing in this category.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
