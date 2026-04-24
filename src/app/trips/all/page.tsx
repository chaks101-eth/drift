'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getDestinationImage } from '@/lib/images'
import NavBar from '@/app/NavBar'

type TripSummary = {
  id: string; destination: string; country: string; vibes: string[]
  start_date: string; end_date: string; travelers: number; budget: string
  status: string; share_slug: string | null; is_public: boolean; created_at: string
}

function getDays(s: string, e: string) { return s && e ? Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)) : 0 }
function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '' }

type Category = 'all' | 'upcoming' | 'planning' | 'past'

function categorize(t: TripSummary): 'upcoming' | 'planning' | 'past' {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  if (t.end_date && new Date(t.end_date + 'T00:00:00') < now) return 'past'
  if (t.start_date && new Date(t.start_date + 'T00:00:00') >= now) return 'upcoming'
  return 'planning'
}

export default function AllTripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Category>('all')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('trips')
        .select('id, destination, country, vibes, start_date, end_date, travelers, budget, status, share_slug, is_public, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setTrips((data || []) as TripSummary[])
      setLoading(false)
    }
    load()
  }, [router])

  async function deleteTrip(e: React.MouseEvent, tripId: string) {
    e.stopPropagation()
    if (!confirm('Delete this trip?')) return
    await supabase.from('itinerary_items').delete().eq('trip_id', tripId)
    await supabase.from('trips').delete().eq('id', tripId)
    setTrips(prev => prev.filter(t => t.id !== tripId))
  }

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
    <div className="min-h-screen bg-[#050509] text-[#f0efe8]">
      <NavBar showBack />

      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 starfield" />
        <div className="aurora-blob h-[500px] w-[500px] left-[20%] top-[30%] bg-[#c8a44e]" style={{ opacity: 0.04 }} />
        <div className="absolute inset-0 noise-grain" />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-8 max-md:px-4 pt-24 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px w-6 bg-[#c8a44e]/60" />
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">Archive</span>
          </div>
          <h1 className="font-serif text-[clamp(28px,3.5vw,42px)] font-light leading-[1.05] tracking-[-0.02em] mb-4">
            All <em className="italic text-[#c8a44e]">trips</em>
          </h1>

          {/* Search */}
          <div className="relative max-w-[400px] mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by destination, country, or vibe..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] pl-9 pr-4 py-2.5 text-[12px] text-white/80 placeholder:text-white/25 focus:border-[#c8a44e]/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {([
              { key: 'all' as const, label: 'All' },
              { key: 'upcoming' as const, label: 'Upcoming' },
              { key: 'planning' as const, label: 'Planning' },
              { key: 'past' as const, label: 'Past' },
            ] as const).filter(t => t.key === 'all' || counts[t.key] > 0).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-[1.5px] transition-all ${
                  tab === t.key
                    ? 'bg-[#c8a44e]/10 text-[#c8a44e] border border-[#c8a44e]/20'
                    : 'text-white/35 hover:text-white/55 border border-transparent'
                }`}
              >
                {t.label} <span className="ml-1 tabular-nums">{counts[t.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e]" />
          </div>
        )}

        {/* Grid */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
            {filtered.map((trip, i) => {
              const cat = categorize(trip)
              const days = getDays(trip.start_date, trip.end_date)
              return (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="group/card relative text-left rounded-xl overflow-hidden border border-white/[0.06] bg-[#0a0a0f] transition-all duration-400 hover:border-white/[0.12] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                  style={{ animation: `fadeUp 0.4s ease ${0.03 * Math.min(i, 12)}s both` }}
                >
                  <div className="relative h-[140px] overflow-hidden">
                    <Image src={getDestinationImage(trip.destination)} alt={trip.destination} fill className="object-cover transition-transform duration-[2000ms] group-hover/card:scale-110" sizes="400px" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/30 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[8px] font-medium tracking-[1px] uppercase backdrop-blur-md border ${
                        cat === 'upcoming' ? 'bg-[#4ecdc4]/10 border-[#4ecdc4]/20 text-[#4ecdc4]'
                        : cat === 'planning' ? 'bg-[#c8a44e]/10 border-[#c8a44e]/20 text-[#c8a44e]'
                        : 'bg-white/[0.06] border-white/[0.08] text-white/50'
                      }`}>
                        {cat === 'upcoming' && <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />}
                        {cat}
                      </span>
                    </div>
                    <button
                      onClick={(e) => deleteTrip(e, trip.id)}
                      className="absolute top-3 right-3 h-7 w-7 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center opacity-0 group-hover/card:opacity-50 hover:!opacity-100 hover:bg-red-500/20 transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="font-serif text-[16px] font-light text-white/95 group-hover/card:text-[#c8a44e] transition-colors truncate">
                      {trip.destination}
                      {trip.country && <span className="text-white/35 italic text-[13px]">, {trip.country}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
                      {days > 0 && <span>{days}d</span>}
                      {trip.start_date && <><span className="text-white/12">·</span><span>{fmtDate(trip.start_date)}</span></>}
                      <span className="text-white/12">·</span>
                      <span>{trip.travelers} pax</span>
                    </div>
                    {trip.vibes?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {trip.vibes.slice(0, 3).map(v => (
                          <span key={v} className="rounded-full bg-[#c8a44e]/[0.06] px-2 py-0.5 text-[8px] text-[#c8a44e]/70">{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="font-serif text-[18px] text-white/50 mb-2">No trips found</div>
            <p className="text-[11px] text-white/30">{search ? 'Try a different search term.' : 'Nothing in this category yet.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
