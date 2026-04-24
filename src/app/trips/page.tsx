'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { getDestinationImage } from '@/lib/images'
import NavBar from '@/app/NavBar'

// ─── Types ───────────────────────────────────────────────────
type TripSummary = {
  id: string; destination: string; country: string; vibes: string[]
  start_date: string; end_date: string; travelers: number; budget: string
  status: string; share_slug: string | null; is_public: boolean; created_at: string
}
type TrendingTrip = TripSummary & { heartCount: number }

// ─── Helpers ─────────────────────────────────────────────────
// Use the centralized image library — 80+ destinations with curated Unsplash photos
function getImg(d: string) { return getDestinationImage(d) }
function getDays(s: string, e: string) { return s && e ? Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)) : 0 }
function fmtDate(d: string) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }

const VIBE_COLORS: Record<string, string> = {
  beach: '#4ecdc4', party: '#ff6b9e', culture: '#a880ff', luxury: '#c8a44e',
  adventure: '#ffb347', romantic: '#ff6b9e', spiritual: '#a880ff', foodie: '#e8cc6e',
  nightlife: '#ff6b9e', nature: '#4ecdc4', city: '#5ea8ff', hidden: '#e8b56c',
}
const ORBIT_COLORS = ['#c8a44e', '#4ecdc4', '#a880ff', '#ff6b9e', '#5ea8ff', '#e8b56c']
function vibeColor(trip: TripSummary, i: number) {
  const v = trip.vibes?.[0]?.toLowerCase()
  return (v && VIBE_COLORS[v]) || ORBIT_COLORS[i % ORBIT_COLORS.length]
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Late night'
}

// Time-based aurora — page feels different at 2am vs 2pm
function getAuroraConfig(): Array<{ color: string; opacity: number }> {
  const h = new Date().getHours()
  if (h < 5)  return [{ color: '#a880ff', opacity: 0.05 }, { color: '#5ea8ff', opacity: 0.04 }, { color: '#4ecdc4', opacity: 0.02 }] // deep night — purple/blue
  if (h < 8)  return [{ color: '#4ecdc4', opacity: 0.05 }, { color: '#5ea8ff', opacity: 0.04 }, { color: '#c8a44e', opacity: 0.03 }] // dawn — teal/blue
  if (h < 12) return [{ color: '#c8a44e', opacity: 0.06 }, { color: '#4ecdc4', opacity: 0.04 }, { color: '#5ea8ff', opacity: 0.02 }] // morning — gold/teal
  if (h < 17) return [{ color: '#c8a44e', opacity: 0.06 }, { color: '#e8b56c', opacity: 0.04 }, { color: '#4ecdc4', opacity: 0.03 }] // afternoon — warm gold
  if (h < 21) return [{ color: '#ff6b9e', opacity: 0.04 }, { color: '#c8a44e', opacity: 0.05 }, { color: '#a880ff', opacity: 0.03 }] // evening — pink/gold/purple
  return [{ color: '#a880ff', opacity: 0.05 }, { color: '#ff6b9e', opacity: 0.03 }, { color: '#5ea8ff', opacity: 0.03 }] // late night — purple/pink
}

function daysUntil(d: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - now.getTime()) / 86400000)
}

function tripStatus(t: TripSummary): 'upcoming' | 'planning' | 'past' {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  if (t.end_date && new Date(t.end_date + 'T00:00:00') < now) return 'past'
  if (t.start_date && new Date(t.start_date + 'T00:00:00') >= now) return 'upcoming'
  return 'planning'
}

// ─── Main ────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [myTrips, setMyTrips] = useState<TripSummary[]>([])
  const [trending, setTrending] = useState<TrendingTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredOrb, setHoveredOrb] = useState<string | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [circleClicked, setCircleClicked] = useState(false)
  const circleRef = useRef<HTMLButtonElement>(null)
  const [aurora] = useState(getAuroraConfig)

  // ─── Cursor tracking (for parallax + glow) ───
  useEffect(() => {
    const move = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  // ─── Keyboard shortcuts ───
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'n' || e.key === 'N') { router.push('/vibes'); return }
    const num = parseInt(e.key)
    if (num >= 1 && num <= 6) {
      const trip = myTrips[num] // 1-indexed into recent (skip active)
      if (trip) router.push(`/trip/${trip.id}`)
    }
  }, [router, myTrips])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // ─── Load data ───
  // Do NOT auto-create an anonymous session here. A fresh visitor with no
  // session should see the showroom + launcher without being silently signed in.
  // Anon sign-in is deferred to the first write (ensureAnonSession in @/lib/supabase).
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const name = (session.user.user_metadata?.full_name as string) || (session.user.user_metadata?.name as string) || session.user.email?.split('@')[0] || ''
        setUserName(name)

        const { data: trips } = await supabase
          .from('trips')
          .select('id, destination, country, vibes, start_date, end_date, travelers, budget, status, share_slug, is_public, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
        setMyTrips((trips || []) as TripSummary[])
      }

      // Trending always loads — service-role endpoint, no auth needed.
      // minItems=5 filters out empty-draft trips so the showroom only surfaces finished itineraries.
      fetch('/api/trips/public?limit=6&minItems=5').then(r => r.json()).then(d => setTrending(d.trips || [])).catch(() => {})
      setLoading(false)
    }
    load()
  }, [router])

  async function deleteTrip(e: React.MouseEvent, tripId: string) {
    e.stopPropagation()
    if (!confirm('Delete this trip?')) return
    await supabase.from('itinerary_items').delete().eq('trip_id', tripId)
    await supabase.from('trips').delete().eq('id', tripId)
    setMyTrips(prev => prev.filter(t => t.id !== tripId))
  }

  // ─── Circle click with ripple ───
  function handleCircleClick(tripId: string) {
    setCircleClicked(true)
    setTimeout(() => router.push(`/trip/${tripId}`), 400)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050509]">
        <NavBar />
        <div className="flex h-[calc(100vh-56px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e]" />
        </div>
      </div>
    )
  }

  const activeTrip = myTrips[0] || null
  const recentTrips = myTrips.slice(1, 7)
  const status = activeTrip ? tripStatus(activeTrip) : null
  const days = activeTrip ? getDays(activeTrip.start_date, activeTrip.end_date) : 0
  const away = activeTrip?.start_date && status === 'upcoming' ? daysUntil(activeTrip.start_date) : null

  // Parallax offset for photo inside circle — cursor relative to circle center
  const circleRect = circleRef.current?.getBoundingClientRect()
  const photoParallax = circleRect ? {
    x: ((cursor.x - (circleRect.left + circleRect.width / 2)) / circleRect.width) * -12,
    y: ((cursor.y - (circleRect.top + circleRect.height / 2)) / circleRect.height) * -12,
  } : { x: 0, y: 0 }

  return (
    <div className="min-h-screen bg-[#050509] text-[#f0efe8] overflow-x-hidden">
      <NavBar />

      {/* ═══ Atmosphere — time-based aurora ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 starfield" />
        <div className="aurora-blob h-[600px] w-[600px] left-[10%] top-[25%]" style={{ background: aurora[0].color, opacity: aurora[0].opacity }} />
        <div className="aurora-blob h-[500px] w-[500px] right-[5%] bottom-[15%]" style={{ background: aurora[1].color, opacity: aurora[1].opacity, animationDelay: '-14s' }} />
        <div className="aurora-blob h-[400px] w-[400px] left-[55%] top-[10%]" style={{ background: aurora[2].color, opacity: aurora[2].opacity, animationDelay: '-8s' }} />
        <div className="absolute inset-0 noise-grain" />
      </div>

      {/* ═══ Cursor glow — subtle gold light follows mouse ═══ */}
      <div
        className="fixed pointer-events-none z-[1] rounded-full"
        style={{
          width: 400, height: 400,
          left: cursor.x - 200, top: cursor.y - 200,
          background: 'radial-gradient(circle, rgba(200,164,78,0.06), transparent 70%)',
          transition: 'left 0.3s ease-out, top 0.3s ease-out',
        }}
      />

      {/* ═══ Main content ═══ */}
      <div className="relative z-10 min-h-[calc(100vh-56px)] flex flex-col">
        <div className="flex-1 flex flex-col px-12 max-lg:px-6 pt-20 pb-10 max-w-[1400px] mx-auto w-full">

          {/* ─── Greeting — staggered entrance ─── */}
          <div className="mb-8" style={{ animation: 'fadeUp 0.9s ease 0.15s both' }}>
            <div className="font-mono text-[9px] tracking-[3px] uppercase text-[#c8a44e]/70 mb-3"
              style={{ animation: 'fadeUp 0.7s ease 0.1s both', filter: 'blur(0)' }}
            >
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </div>
            <h1
              className="font-serif text-[clamp(30px,4vw,50px)] font-light leading-[1.0] tracking-[-0.02em] italic"
              style={{ animation: 'fadeUp 0.9s ease 0.25s both' }}
            >
              Where will you <span className="text-[#c8a44e]">drift</span> next?
            </h1>
          </div>

          {/* ─── Split layout ─── */}
          <div className="flex-1 flex items-center gap-16 max-lg:flex-col max-lg:gap-10">

            {/* ─── LEFT: The gravitational center ─── */}
            <div className="flex-1 flex items-center justify-center max-lg:w-full" style={{ animation: 'fadeUp 1s ease 0.4s both' }}>
              {activeTrip ? (
                <button
                  ref={circleRef}
                  onClick={() => handleCircleClick(activeTrip.id)}
                  className={`group relative transition-transform duration-500 ${circleClicked ? 'scale-[1.08]' : ''}`}
                >
                  {/* Click ripple — expands outward on click */}
                  {circleClicked && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#c8a44e]/60 pointer-events-none"
                      style={{
                        width: 0, height: 0,
                        animation: 'coreWave 0.6s ease-out forwards',
                      }}
                    />
                  )}

                  {/* Outermost orbital ring */}
                  <div className="absolute inset-0 -m-[60px] rounded-full border border-[#c8a44e]/[0.06] compass-ring" style={{ animationDuration: '80s' }} />
                  {/* Outer orbital ring */}
                  <div className="absolute inset-0 -m-[40px] rounded-full border border-[#c8a44e]/[0.08] compass-ring-reverse" />
                  {/* Inner orbital ring */}
                  <div className="absolute inset-0 -m-[20px] rounded-full border border-[#c8a44e]/[0.12] compass-ring" style={{ animationDuration: '30s' }} />

                  {/* Orbiting dots */}
                  <div className="absolute inset-0 -m-[40px] compass-ring-reverse pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#c8a44e]/60" />
                  </div>
                  <div className="absolute inset-0 -m-[60px] compass-ring pointer-events-none" style={{ animationDuration: '80s' }}>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1 w-1 rounded-full bg-[#4ecdc4]/50" />
                  </div>

                  {/* Energy waves */}
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c8a44e]/30 pointer-events-none"
                      style={{
                        width: 'calc(100% + 10px)', height: 'calc(100% + 10px)',
                        animation: 'coreWave 5s ease-out infinite',
                        animationDelay: `${i * 1.66}s`,
                      }}
                    />
                  ))}

                  {/* The circle */}
                  <div
                    className={`relative w-[380px] h-[380px] max-lg:w-[320px] max-lg:h-[320px] max-md:w-[280px] max-md:h-[280px] rounded-full overflow-hidden border-2 transition-all duration-700 ${circleClicked ? 'border-[#c8a44e]/80' : 'border-[#c8a44e]/30 group-hover:border-[#c8a44e]/50'}`}
                    style={{ animation: 'corePulse 4s ease-in-out infinite' }}
                  >
                    {/* Photo — parallax with cursor */}
                    <div
                      className="absolute inset-[-20px] transition-transform duration-[600ms] ease-out group-hover:scale-105"
                      style={{
                        transform: `translate(${photoParallax.x}px, ${photoParallax.y}px) scale(1.1)`,
                      }}
                    >
                      <Image
                        src={getImg(activeTrip.destination)}
                        alt={activeTrip.destination}
                        fill
                        className="object-cover"
                        sizes="420px"
                        unoptimized
                      />
                    </div>

                    {/* Overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
                    <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)' }} />

                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 px-8">
                      {/* Status badge */}
                      <div className="mb-3 flex items-center gap-2 rounded-full border border-[#c8a44e]/30 bg-black/40 backdrop-blur-md px-3 py-1 transition-all duration-300 group-hover:border-[#c8a44e]/50 group-hover:bg-black/50">
                        {status === 'upcoming' && <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />}
                        <span className="font-mono text-[8px] tracking-[2px] uppercase text-[#c8a44e]">
                          {status === 'upcoming'
                            ? away === 0 ? 'Departing today' : away === 1 ? 'Tomorrow' : `${away} days away`
                            : 'Continue drifting'
                          }
                        </span>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="2.5" className="transition-transform duration-300 group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </div>

                      {/* Destination */}
                      <div className="font-serif text-[clamp(22px,3vw,32px)] font-light text-white leading-tight text-center">
                        {activeTrip.destination}
                        {activeTrip.country && <span className="text-white/40 italic">, {activeTrip.country}</span>}
                      </div>

                      {/* Vibes */}
                      {activeTrip.vibes?.length > 0 && (
                        <div className="flex gap-1.5 mt-2.5">
                          {activeTrip.vibes.slice(0, 3).map(v => (
                            <span key={v} className="rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.08] px-2.5 py-0.5 text-[8px] font-medium tracking-[1px] uppercase text-white/70">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="mt-2 font-mono text-[9px] text-white/35 tracking-[0.5px]">
                        {days > 0 && `${days} days`}
                        {activeTrip.start_date && `${days > 0 ? ' · ' : ''}${fmtDate(activeTrip.start_date)}`}
                        {` · ${activeTrip.travelers} traveler${activeTrip.travelers !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                /* Empty-state showroom: clickable portal at the center with public trips orbiting.
                   Two rings × 3 planets each = 6 total. Rings are at 280px + 360px radius, offset 60°
                   so planets feel like a constellation, not a clock face. */
                <div className="relative">
                  {/* Compass rings — visible spokes of the orbit so the empty space reads as intentional */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c8a44e]/[0.08] compass-ring-reverse pointer-events-none" style={{ width: 560, height: 560 }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c8a44e]/[0.06] compass-ring pointer-events-none" style={{ width: 720, height: 720, animationDuration: '80s' }} />

                  {/* Energy waves pulsing outward from the portal */}
                  {[0, 1, 2].map(i => (
                    <div key={i} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c8a44e]/20 pointer-events-none"
                      style={{ width: 340, height: 340, animation: 'coreWave 5s ease-out infinite', animationDelay: `${i * 1.66}s` }}
                    />
                  ))}

                  {/* The orbiting planets — public trips from trending.
                      Layout adapts to however many trips we have so it never looks like empty orbits:
                        1-5 trips  → single ring at 310px, evenly spaced, ~84px planets
                        6+ trips   → two rings (280px + 360px), 3 per ring at 120° apart, offset 60°
                      Planets are positioned with rotate→translate→reverse-rotate so each sits on
                      the ring without being rotated itself. */}
                  {trending.slice(0, 6).map((trip, i) => {
                    const total = Math.min(trending.length, 6)
                    const isSingleRing = total < 6
                    // Single-ring layout: evenly spaced around one ring
                    // Two-ring layout: first 3 on inner ring at 30°/150°/270°, next 3 on outer at 90°/210°/330°
                    const ring = isSingleRing ? 1 : (i < 3 ? 1 : 2)
                    const angle = isSingleRing
                      ? (360 / total) * i - 90  // start at top
                      : ring === 1 ? 30 + i * 120 : 90 + (i - 3) * 120
                    const radius = isSingleRing ? 310 : ring === 1 ? 280 : 360
                    const size = isSingleRing ? 84 : ring === 1 ? 90 : 68
                    const color = vibeColor(trip as TripSummary, i)
                    const isHovered = hoveredOrb === trip.id
                    return (
                      <button
                        key={trip.id}
                        onClick={() => trip.share_slug && router.push(`/share/${trip.share_slug}`)}
                        onMouseEnter={() => setHoveredOrb(trip.id)}
                        onMouseLeave={() => setHoveredOrb(null)}
                        className="absolute top-1/2 left-1/2 group/planet pointer-events-auto"
                        style={{
                          // Position on the orbital ring. Transform stays static — CSS animations
                          // that also set `transform` would override this. The breathing motion is
                          // handled by a separate animation on the inner circle div below.
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${radius}px) rotate(${-angle}deg)`,
                        }}
                      >
                        {/* Colored glow halo — intensifies on hover */}
                        <div
                          className="absolute rounded-full blur-xl transition-all duration-500 pointer-events-none"
                          style={{
                            width: size + 40, height: size + 40,
                            top: -20, left: -20,
                            background: `radial-gradient(circle, ${color}55, transparent 70%)`,
                            opacity: isHovered ? 0.9 : 0.35,
                          }}
                        />
                        {/* Planet circle */}
                        <div
                          className="relative rounded-full overflow-hidden transition-all duration-400"
                          style={{
                            width: size, height: size,
                            border: `1.5px solid ${isHovered ? color : `${color}50`}`,
                            transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                            boxShadow: isHovered ? `0 0 36px ${color}70` : `0 0 16px ${color}30`,
                          }}
                        >
                          <Image src={getImg(trip.destination)} alt={trip.destination} fill className="object-cover" sizes={`${size}px`} unoptimized />
                          <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.45)' }} />
                        </div>
                        {/* Tooltip — appears below the planet on hover */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none transition-all duration-300"
                          style={{
                            top: size + 14,
                            opacity: isHovered ? 1 : 0,
                            transform: `translate(-50%, ${isHovered ? '0' : '-4px'})`,
                          }}
                        >
                          <div className="rounded-lg border border-white/[0.08] bg-black/70 backdrop-blur-md px-2.5 py-1.5">
                            <div className="text-[10px] text-white/90 font-medium">{trip.destination}</div>
                            <div className="font-mono text-[7px] tracking-[1.5px] uppercase text-[#c8a44e]/80 mt-0.5">Preview →</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}

                  {/* The portal — the launcher. Click to start a fresh trip. */}
                  <button
                    onClick={() => {
                      setCircleClicked(true)
                      setTimeout(() => router.push('/vibes'), 400)
                    }}
                    className={`group relative transition-transform duration-500 ${circleClicked ? 'scale-[1.08]' : ''}`}
                  >
                    {/* Click ripple */}
                    {circleClicked && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#c8a44e]/60 pointer-events-none"
                        style={{ width: 0, height: 0, animation: 'coreWave 0.6s ease-out forwards' }}
                      />
                    )}

                    {/* Orbital rings tight to the portal (decorative) */}
                    <div className="absolute inset-0 -m-[20px] rounded-full border border-[#c8a44e]/[0.12] compass-ring" style={{ animationDuration: '30s' }} />
                    <div className="absolute inset-0 -m-[40px] rounded-full border border-[#c8a44e]/[0.08] compass-ring-reverse" />

                    {/* The portal core */}
                    <div
                      className={`relative w-[300px] h-[300px] max-lg:w-[260px] max-lg:h-[260px] max-md:w-[220px] max-md:h-[220px] rounded-full overflow-hidden border-2 transition-all duration-700 flex items-center justify-center ${circleClicked ? 'border-[#c8a44e]/80' : 'border-[#c8a44e]/35 group-hover:border-[#c8a44e]/65'}`}
                      style={{
                        background: 'radial-gradient(circle at 30% 30%, #1a1608 0%, #0a0906 60%, #050509 100%)',
                        animation: 'corePulse 4s ease-in-out infinite',
                        boxShadow: '0 0 100px rgba(200,164,78,0.2), inset 0 0 120px rgba(200,164,78,0.1)',
                      }}
                    >
                      {/* Inner glow that intensifies on hover */}
                      <div
                        className="absolute inset-0 rounded-full transition-opacity duration-500 opacity-70 group-hover:opacity-100"
                        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(200,164,78,0.3), transparent 65%)' }}
                      />
                      <div className="relative flex flex-col items-center gap-3 px-6">
                        <span className="font-serif italic text-[clamp(56px,6vw,80px)] text-[#c8a44e] leading-none translate-y-[-4px] transition-transform duration-500 group-hover:scale-110">D</span>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="font-serif text-[clamp(13px,1.3vw,17px)] italic text-white/90 text-center leading-tight">
                            Begin your first drift
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/80 transition-colors duration-300 group-hover:text-[#c8a44e]">
                            <span>Tap to start</span>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-300 group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* ─── RIGHT: Recent trips + actions ─── */}
            <div className="w-[340px] max-lg:w-full shrink-0 flex flex-col gap-8" style={{ animation: 'fadeUp 1s ease 0.55s both' }}>

              {/* Recent Drifts */}
              {recentTrips.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-serif text-[15px] italic text-[#c8a44e]/90">Recent Drifts</span>
                    {myTrips.length > 7 && (
                      <button onClick={() => router.push('/trips/all')} className="font-mono text-[8px] tracking-[1.5px] uppercase text-white/35 hover:text-[#c8a44e] transition-colors">
                        View all {myTrips.length} →
                      </button>
                    )}
                  </div>

                  {/* Orbs with hover preview */}
                  <div className="flex gap-3 flex-wrap">
                    {recentTrips.map((trip, i) => {
                      const isHovered = hoveredOrb === trip.id
                      const color = vibeColor(trip, i)
                      return (
                        <div key={trip.id} className="relative group/orb">
                          <button
                            onClick={() => router.push(`/trip/${trip.id}`)}
                            onMouseEnter={() => setHoveredOrb(trip.id)}
                            onMouseLeave={() => setHoveredOrb(null)}
                            className="relative flex flex-col items-center gap-1.5"
                          >
                            {/* Glow */}
                            <div
                              className="absolute rounded-full blur-xl transition-all duration-500 pointer-events-none"
                              style={{
                                width: 80, height: 80, top: -8, left: '50%', transform: 'translateX(-50%)',
                                background: `radial-gradient(circle, ${color}40, transparent 70%)`,
                                opacity: isHovered ? 0.8 : 0,
                              }}
                            />
                            {/* Circle */}
                            <div
                              className="relative w-[56px] h-[56px] rounded-full overflow-hidden transition-all duration-300"
                              style={{
                                border: `2px solid ${isHovered ? color : `${color}40`}`,
                                transform: isHovered ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
                                boxShadow: isHovered ? `0 0 24px ${color}50` : 'none',
                              }}
                            >
                              <Image src={getImg(trip.destination)} alt={trip.destination} fill className="object-cover" sizes="56px" unoptimized />
                              <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 15px rgba(0,0,0,0.4)' }} />
                            </div>
                            {/* Label */}
                            <span className={`text-[9px] transition-all duration-300 max-w-[60px] truncate text-center ${isHovered ? 'text-white/80' : 'text-white/40'}`}>
                              {trip.destination}
                            </span>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={(e) => deleteTrip(e, trip.id)}
                            className="absolute -top-0.5 -right-0.5 z-10 h-4 w-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover/orb:opacity-60 hover:!opacity-100 hover:bg-red-500/30 transition-all"
                          >
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Compose + Build */}
              <div>
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => router.push('/vibes')}
                    className="group flex flex-col items-center gap-2.5"
                  >
                    <div className="h-[60px] w-[60px] rounded-2xl border border-[#c8a44e]/25 bg-[#c8a44e]/[0.06] flex items-center justify-center transition-all duration-300 group-hover:border-[#c8a44e]/50 group-hover:bg-[#c8a44e]/[0.12] group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(200,164,78,0.15)] active:scale-95">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c8a44e" strokeWidth="1.3">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-medium text-white/80 group-hover:text-[#c8a44e] transition-colors">Compose</div>
                      <div className="text-[8px] text-white/30 tracking-[1px] uppercase mt-0.5">From vibes</div>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/build')}
                    className="group flex flex-col items-center gap-2.5"
                  >
                    <div className="h-[60px] w-[60px] rounded-2xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center transition-all duration-300 group-hover:border-[#c8a44e]/30 group-hover:bg-[#c8a44e]/[0.06] group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(200,164,78,0.1)] active:scale-95">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-white/50 group-hover:text-[#c8a44e] transition-colors">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-medium text-white/80 group-hover:text-[#c8a44e] transition-colors">Build</div>
                      <div className="text-[8px] text-white/30 tracking-[1px] uppercase mt-0.5">From a reel</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Telemetry + keyboard hint — for returning users. FTU gets a value-prop line instead. */}
              {activeTrip ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 font-mono text-[8px] tracking-[1px] text-white/25 uppercase">
                    <span>{myTrips.length} trips</span>
                    <span className="text-white/10">◆</span>
                    <span>{new Set(myTrips.map(t => t.destination)).size} dest</span>
                    <span className="text-white/10">◆</span>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />
                      <span>Active</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[7px] tracking-[0.5px] text-white/15">
                    <span className="rounded border border-white/[0.06] px-1 py-0.5">N</span>
                    <span>new trip</span>
                    <span className="text-white/8">·</span>
                    <span className="rounded border border-white/[0.06] px-1 py-0.5">1-6</span>
                    <span>open recent</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="font-serif italic text-[12px] text-white/55 leading-relaxed">
                    Pick a few vibes. We build a 5-day itinerary in 30 seconds — hotels, restaurants, timings, all grounded.
                  </p>
                  <div className="flex items-center gap-2 font-mono text-[7px] tracking-[1.5px] uppercase text-white/20">
                    <span className="rounded border border-white/[0.06] px-1 py-0.5">N</span>
                    <span>shortcut to start · or tap an orbit to preview</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Trending — only render for returning users. FTU gets the orbital showroom instead. ─── */}
        {activeTrip && trending.length > 0 && (
          <div className="px-12 max-lg:px-6 pb-12 max-w-[1400px] mx-auto w-full" style={{ animation: 'fadeUp 1s ease 0.75s both' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-px w-6 bg-[#c8a44e]/40" />
                <span className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/60">Distant Galaxies</span>
              </div>
              <button onClick={() => router.push('/explore')} className="font-mono text-[8px] text-white/30 hover:text-[#c8a44e] transition-colors tracking-[1.5px] uppercase">
                Explore →
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
              {trending.map((trip, i) => (
                <button
                  key={trip.id}
                  onClick={() => trip.share_slug ? router.push(`/share/${trip.share_slug}`) : null}
                  className="group/t shrink-0 w-[180px] rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.01] transition-all duration-400 hover:border-white/[0.1] hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{ animation: `fadeUp 0.5s ease ${0.8 + 0.06 * i}s both` }}
                >
                  <div className="relative h-[100px] overflow-hidden">
                    <Image src={getImg(trip.destination)} alt={trip.destination} fill className="object-cover transition-transform duration-[2000ms] group-hover/t:scale-110" sizes="180px" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-transparent to-transparent" />
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] text-white/70 group-hover/t:text-[#c8a44e] transition-colors truncate">{trip.destination}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {trip.vibes?.slice(0, 2).map(v => (
                        <span key={v} className="text-[7px] text-white/25 uppercase tracking-wide">{v}</span>
                      ))}
                      {trip.heartCount > 0 && (
                        <span className="ml-auto flex items-center gap-0.5">
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="#c8a44e" stroke="none" opacity={0.4}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          <span className="text-[7px] text-[#c8a44e]/40 tabular-nums">{trip.heartCount}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The orbital showroom above IS the empty state — no redundant bottom CTA block. */}
      </div>
    </div>
  )
}
