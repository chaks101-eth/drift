'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getDestinationImage } from '@/lib/images'
import NavBar from '@/app/NavBar'

interface PublicTrip {
  id: string; destination: string; country: string; vibes: string[]
  start_date: string; end_date: string; travelers: number; budget: string
  share_slug: string | null; trip_brief: string | null; heartCount: number; created_at: string
}

interface DestInfo { destination: string; country: string }

function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }
function getDays(s: string, e: string) { return s && e ? Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)) : 0 }

export default function ExplorePage() {
  const router = useRouter()
  const [trips, setTrips] = useState<PublicTrip[]>([])
  const [destinations, setDestinations] = useState<DestInfo[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/trips/public?limit=50${filter ? `&destination=${encodeURIComponent(filter)}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setTrips(data.trips || [])
        if (!filter) setDestinations(data.destinations || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  // Featured trip — most hearts
  const featured = trips.length > 0 ? [...trips].sort((a, b) => b.heartCount - a.heartCount)[0] : null
  const rest = trips.filter(t => t.id !== featured?.id)

  return (
    <div className="min-h-screen bg-[#050509] text-[#f0efe8] overflow-x-hidden">
      <NavBar />

      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 starfield" />
        <div className="aurora-blob h-[600px] w-[600px] right-[10%] top-[20%] bg-[#4ecdc4]" style={{ opacity: 0.04 }} />
        <div className="aurora-blob h-[500px] w-[500px] left-[15%] bottom-[20%] bg-[#c8a44e]" style={{ opacity: 0.05, animationDelay: '-10s' }} />
        <div className="absolute inset-0 noise-grain" />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-8 max-md:px-4 pt-24 pb-16">

        {/* Header */}
        <div className="mb-10" style={{ animation: 'fadeUp 0.9s ease 0.15s both' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-6 bg-[#c8a44e]/60" />
            <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">Explore</span>
          </div>
          <h1 className="font-serif text-[clamp(32px,4vw,48px)] font-light leading-[1.05] tracking-[-0.02em] mb-3">
            Real trips, by <em className="italic text-[#c8a44e]">real travelers</em>.
          </h1>
          <p className="text-[14px] text-white/50 leading-relaxed max-w-[520px]">
            See how people planned with Drift. Get inspired. Steal their itinerary.
          </p>
        </div>

        {/* Destination filter */}
        {destinations.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-2" style={{ animation: 'fadeUp 0.9s ease 0.3s both' }}>
            <button
              onClick={() => { setFilter(''); setLoading(true) }}
              className={`rounded-full px-4 py-2 text-[10px] font-medium tracking-[1.5px] uppercase transition-all ${
                !filter ? 'bg-[#c8a44e] text-[#08080c]' : 'border border-white/[0.08] text-white/40 hover:border-[#c8a44e]/25 hover:text-[#c8a44e]'
              }`}
            >
              All
            </button>
            {destinations.map(d => (
              <button
                key={d.destination}
                onClick={() => { setFilter(d.destination); setLoading(true) }}
                className={`rounded-full px-4 py-2 text-[10px] font-medium tracking-[1.5px] uppercase transition-all ${
                  filter === d.destination ? 'bg-[#c8a44e] text-[#08080c]' : 'border border-white/[0.08] text-white/40 hover:border-[#c8a44e]/25 hover:text-[#c8a44e]'
                }`}
              >
                {d.destination}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e]" />
          </div>
        )}

        {/* Empty */}
        {!loading && trips.length === 0 && (
          <div className="text-center py-20" style={{ animation: 'fadeUp 0.8s ease both' }}>
            <div className="font-serif text-[24px] font-light text-white/70 mb-3">No public trips yet</div>
            <p className="text-[12px] text-white/35 mb-6">Be the first to share your trip with the community.</p>
            <button
              onClick={() => router.push('/vibes')}
              className="rounded-full bg-[#c8a44e] px-6 py-3 text-[10px] font-bold uppercase tracking-[2px] text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] transition-all"
            >
              Compose a trip
            </button>
          </div>
        )}

        {/* Featured trip — hero card */}
        {!loading && featured && (
          <div className="mb-10" style={{ animation: 'fadeUp 1s ease 0.4s both' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-6 bg-[#c8a44e]/40" />
              <span className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/60">Most loved</span>
            </div>
            <button
              onClick={() => featured.share_slug ? router.push(`/share/${featured.share_slug}`) : null}
              className="group relative w-full text-left rounded-2xl overflow-hidden border border-white/[0.06] transition-all duration-500 hover:border-[#c8a44e]/20 hover:shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
            >
              {/* Corner brackets */}
              <div className="pointer-events-none absolute -top-px -left-px h-5 w-5 border-l-2 border-t-2 border-[#c8a44e]/30 rounded-tl-2xl z-10" />
              <div className="pointer-events-none absolute -top-px -right-px h-5 w-5 border-r-2 border-t-2 border-[#c8a44e]/30 rounded-tr-2xl z-10" />
              <div className="pointer-events-none absolute -bottom-px -left-px h-5 w-5 border-l-2 border-b-2 border-[#c8a44e]/30 rounded-bl-2xl z-10" />
              <div className="pointer-events-none absolute -bottom-px -right-px h-5 w-5 border-r-2 border-b-2 border-[#c8a44e]/30 rounded-br-2xl z-10" />

              <div className="relative h-[280px] max-md:h-[200px] overflow-hidden">
                <Image src={getDestinationImage(featured.destination)} alt={featured.destination} fill
                  className="object-cover transition-transform duration-[4000ms] group-hover:scale-110" sizes="1200px" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a12]/50 via-transparent to-transparent" />

                {/* Hearts badge */}
                {featured.heartCount > 0 && (
                  <div className="absolute top-5 right-6 flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#c8a44e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                    <span className="text-[10px] font-semibold text-[#c8a44e] tabular-nums">{featured.heartCount}</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="font-serif text-[clamp(24px,3vw,38px)] font-light text-white leading-tight">
                    {featured.destination}
                    {featured.country && <span className="text-white/40 italic text-[0.65em]">, {featured.country}</span>}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-white/45 mt-1.5">
                    {getDays(featured.start_date, featured.end_date) > 0 && <span>{getDays(featured.start_date, featured.end_date)} days</span>}
                    {featured.travelers > 0 && <><span className="text-white/15">·</span><span>{featured.travelers} travelers</span></>}
                    {featured.budget && <><span className="text-white/15">·</span><span className="capitalize">{featured.budget}</span></>}
                  </div>
                  {featured.vibes?.length > 0 && (
                    <div className="flex gap-1.5 mt-3">
                      {featured.vibes.slice(0, 4).map(v => (
                        <span key={v} className="rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.06] px-2.5 py-0.5 text-[9px] text-white/60">{v}</span>
                      ))}
                    </div>
                  )}
                  {featured.trip_brief && (
                    <p className="mt-3 text-[11px] text-white/40 italic leading-relaxed max-w-[500px] line-clamp-2">
                      &ldquo;{featured.trip_brief}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Trip grid */}
        {!loading && rest.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-6 bg-[#c8a44e]/40" />
              <span className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/60">
                {filter ? filter : 'All destinations'}
              </span>
              <span className="font-mono text-[8px] text-white/20 tabular-nums">{rest.length} trips</span>
            </div>

            <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1">
              {rest.map((trip, i) => {
                const days = getDays(trip.start_date, trip.end_date)
                return (
                  <button
                    key={trip.id}
                    onClick={() => trip.share_slug ? router.push(`/share/${trip.share_slug}`) : router.push(`/trip/${trip.id}`)}
                    className="group text-left rounded-xl border border-white/[0.06] bg-[#0a0a0f] overflow-hidden transition-all duration-500 hover:border-white/[0.12] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                    style={{ animation: `fadeUp 0.5s ease ${0.45 + 0.04 * Math.min(i, 12)}s both` }}
                  >
                    <div className="relative h-[160px] overflow-hidden">
                      <Image src={getDestinationImage(trip.destination)} alt={trip.destination} fill
                        className="object-cover transition-transform duration-[2000ms] group-hover:scale-110" sizes="400px" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/25 to-transparent" />

                      {trip.heartCount > 0 && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-2 py-0.5">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="#c8a44e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          <span className="text-[8px] font-semibold text-[#c8a44e] tabular-nums">{trip.heartCount}</span>
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="font-serif text-[18px] font-light text-white leading-tight">{trip.destination}</div>
                        <div className="text-[10px] text-white/45 mt-0.5">{trip.country}</div>
                      </div>
                    </div>

                    <div className="p-4 pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-white/35 mb-2.5">
                        {days > 0 && <span>{days} days</span>}
                        {trip.travelers > 0 && <><span className="text-white/12">·</span><span>{trip.travelers} pax</span></>}
                        {trip.budget && <><span className="text-white/12">·</span><span className="capitalize">{trip.budget}</span></>}
                        {trip.start_date && <><span className="text-white/12">·</span><span>{fmtDate(trip.start_date)}</span></>}
                      </div>

                      {trip.vibes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {trip.vibes.slice(0, 4).map(v => (
                            <span key={v} className="rounded-full bg-[#c8a44e]/[0.06] px-2 py-0.5 text-[8px] text-[#c8a44e]/70">{v}</span>
                          ))}
                        </div>
                      )}

                      {trip.trip_brief && (
                        <p className="text-[10px] text-white/30 italic leading-relaxed line-clamp-2">
                          &ldquo;{trip.trip_brief}&rdquo;
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-1.5 text-[9px] text-white/25 group-hover:text-[#c8a44e] transition-colors">
                        <span>View itinerary</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
