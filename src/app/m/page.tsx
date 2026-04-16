'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import { getDestinationImage } from '@/lib/images'

// ─── Mobile orbital system config ────────────────────────────
// 8 planets across 2 rings, smaller radii for mobile viewport
interface OrbitalPlanet {
  name: string
  ring: 0 | 1
  angle: number
  size: number
  color: string
  img: string
}

const ORBITAL_PLANETS: OrbitalPlanet[] = [
  // Inner ring — 4 planets
  { name: 'Bali', ring: 0, angle: 0, size: 28, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=200&q=80' },
  { name: 'Tokyo', ring: 0, angle: 90, size: 26, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200&q=80' },
  { name: 'Paris', ring: 0, angle: 180, size: 26, color: '#a880ff', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80' },
  { name: 'Maldives', ring: 0, angle: 270, size: 28, color: '#4ecdc4', img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=200&q=80' },
  // Outer ring — 4 planets
  { name: 'Dubai', ring: 1, angle: 45, size: 24, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=200&q=80' },
  { name: 'Phuket', ring: 1, angle: 135, size: 22, color: '#ffeb6c', img: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=200&q=80' },
  { name: 'Istanbul', ring: 1, angle: 225, size: 24, color: '#5ea8ff', img: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=200&q=80' },
  { name: 'Singapore', ring: 1, angle: 315, size: 22, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=200&q=80' },
]
const ORBIT_RADII = [85, 140]
const ORBIT_PERIODS_MS = [38000, 62000]
const ELLIPSE_TILT = 0.7

// Mini orbital system for the mobile hero
function MobileOrbitalSystem() {
  const [time, setTime] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // rAF time loop — pause on hidden tab
  useEffect(() => {
    let frame: number
    let last = performance.now()
    let visible = true
    const onVis = () => { visible = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVis)
    const tick = (now: number) => {
      if (visible) setTime(prev => prev + (now - last))
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // Live positions
  const positions = ORBITAL_PLANETS.map(p => {
    const period = ORBIT_PERIODS_MS[p.ring]
    const angleDeg = p.angle + (time / period) * 360
    const angleRad = (angleDeg * Math.PI) / 180
    const x = Math.cos(angleRad) * ORBIT_RADII[p.ring]
    const y = Math.sin(angleRad) * ORBIT_RADII[p.ring] * ELLIPSE_TILT
    return { p, x, y, angleDeg }
  })

  const SVG_SIZE = (ORBIT_RADII[1] + 30) * 2

  return (
    <div ref={containerRef} className="relative flex items-center justify-center" style={{ height: SVG_SIZE * ELLIPSE_TILT + 40, width: '100%' }}>
      {/* Elliptical orbit rings */}
      {ORBIT_RADII.map((r, i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full border border-white/[0.06]"
          style={{
            width: r * 2,
            height: r * 2 * ELLIPSE_TILT,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Comet trails via SVG */}
      <svg
        className="absolute top-1/2 left-1/2 pointer-events-none"
        width={SVG_SIZE}
        height={SVG_SIZE * ELLIPSE_TILT + 40}
        viewBox={`-${SVG_SIZE / 2} -${(SVG_SIZE * ELLIPSE_TILT + 40) / 2} ${SVG_SIZE} ${SVG_SIZE * ELLIPSE_TILT + 40}`}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {positions.map(({ p, angleDeg }) => {
          const r = ORBIT_RADII[p.ring]
          const ry = r * ELLIPSE_TILT
          return (
            <g key={`trail-${p.name}`}>
              {Array.from({ length: 6 }).map((_, i) => {
                const segLen = 4
                const a1 = ((angleDeg - (i + 1) * segLen) * Math.PI) / 180
                const a2 = ((angleDeg - i * segLen) * Math.PI) / 180
                const x1 = Math.cos(a1) * r
                const y1 = Math.sin(a1) * ry
                const x2 = Math.cos(a2) * r
                const y2 = Math.sin(a2) * ry
                const alpha = ((6 - i) / 6) * 0.45
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} A ${r} ${ry} 0 0 1 ${x2} ${y2}`}
                    stroke={p.color}
                    strokeWidth={1.5 - i * 0.15}
                    fill="none"
                    opacity={alpha}
                    strokeLinecap="round"
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Center core */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        {/* Energy waves */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[70px] w-[70px] rounded-full border border-drift-gold/40"
            style={{
              animation: 'coreWave 5s ease-out infinite',
              animationDelay: `${i * 1.66}s`,
            }}
          />
        ))}
        {/* Static rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[82px] w-[82px] rounded-full border border-drift-gold/40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[94px] w-[94px] rounded-full border border-drift-gold/25" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[104px] w-[104px] rounded-full border border-drift-gold/15" />
        {/* Core sphere */}
        <div
          className="relative h-[70px] w-[70px] rounded-full bg-gradient-to-br from-[#e8cc6e] via-drift-gold to-[#8b7034] flex items-center justify-center"
          style={{ animation: 'corePulse 4s ease-in-out infinite' }}
        >
          <span className="font-serif italic text-[40px] text-drift-bg leading-none translate-y-[-2px]">D</span>
        </div>
      </div>

      {/* Planets */}
      {positions.map(({ p, x, y }, i) => (
        <div
          key={p.name}
          className="absolute top-1/2 left-1/2 z-30 opacity-0 animate-[fadeIn_0.7s_ease_forwards]"
          style={{
            width: p.size,
            height: p.size,
            transform: `translate(${x - p.size / 2}px, ${y - p.size / 2}px)`,
            animationDelay: `${0.4 + i * 0.06}s`,
            willChange: 'transform',
          }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-full scale-[1.3] opacity-50"
            style={{ background: `radial-gradient(circle, ${p.color}50, transparent 70%)` }}
          />
          {/* Sphere */}
          <div
            className="relative h-full w-full rounded-full overflow-hidden border"
            style={{
              borderColor: `${p.color}60`,
              boxShadow: `0 0 10px ${p.color}55`,
            }}
          >
            <Image src={p.img} alt={p.name} fill className="object-cover" sizes={`${p.size}px`} unoptimized />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Types ───────────────────────────────────────────────────
interface TripSummary {
  id: string
  destination: string
  country: string
  start_date: string
  end_date: string
  vibes: string[]
  travelers?: number
  created_at: string
  share_slug?: string | null
}
interface TrendingTrip extends TripSummary { heartCount: number }

// ─── Helpers ─────────────────────────────────────────────────
function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function getDays(s: string, e: string) {
  return s && e ? Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000)) : 0
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
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Late night'
}
// Time-based aurora color
function getAuroraColor(): string {
  const h = new Date().getHours()
  if (h < 5) return '#a880ff'
  if (h < 8) return '#4ecdc4'
  if (h < 17) return '#c8a44e'
  if (h < 21) return '#ff6b9e'
  return '#a880ff'
}

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

// ─── Page ────────────────────────────────────────────────────
export default function MobileHomePage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)
  const userEmail = useTripStore((s) => s.userEmail)
  const isAnonymous = useTripStore((s) => s.isAnonymous)

  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [trending, setTrending] = useState<TrendingTrip[]>([])
  const [auroraColor] = useState(getAuroraColor)
  const [authResolved, setAuthResolved] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleSignOut = async () => {
    setProfileOpen(false)
    await supabase.auth.signOut()
    router.replace('/m')
  }

  // Wait for Supabase to resolve auth state before deciding what to render.
  // Without this, the page briefly renders the guest hero for logged-in users
  // (because isAnonymous is initially true while the session is loading).
  useEffect(() => {
    supabase.auth.getSession().then(() => setAuthResolved(true))
  }, [])

  // Post-auth return path
  useEffect(() => {
    if (!token || !userId) return
    const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('drift-login-return') : null
    if (returnTo) {
      sessionStorage.removeItem('drift-login-return')
      router.replace(returnTo)
    }
  }, [token, userId, router])

  // Fetch trips
  useEffect(() => {
    if (!authResolved) return
    if (!token || !userId || isAnonymous) {
      setLoading(false)
      return
    }

    const fetchTrips = () => {
      supabase
        .from('trips')
        .select('id, destination, country, start_date, end_date, vibes, travelers, created_at, share_slug')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data, error }) => {
          if (!error && data) setTrips(data as TripSummary[])
          setLoading(false)
        }, () => setLoading(false))
    }

    fetchTrips()

    // Re-fetch when user returns to the tab (e.g. after deleting a trip from /m/trips/all)
    const onVis = () => { if (document.visibilityState === 'visible') fetchTrips() }
    document.addEventListener('visibilitychange', onVis)

    // Fetch trending in background (only once)
    if (!checked) {
      setChecked(true)
      fetch('/api/trips/public?limit=6')
        .then(r => r.json())
        .then(d => setTrending(d.trips || []))
        .catch(() => {})
    }

    return () => document.removeEventListener('visibilitychange', onVis)
  }, [authResolved, token, userId, checked, isAnonymous])

  // Loading — show until auth is resolved AND (if logged in) trips are loaded
  if (!authResolved || (loading && !isAnonymous && token)) {
    return (
      <div className="flex h-full items-center justify-center bg-drift-bg">
        <div className="text-center">
          <div className="mb-4 font-serif text-xl text-drift-gold opacity-80">Drift</div>
          <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
        </div>
      </div>
    )
  }

  const handleStart = () => {
    if (starting) return
    setStarting(true)
    router.push('/m/plan/vibes')
  }

  const isReturningUser = !isAnonymous && trips.length > 0
  const firstName = userEmail?.split('@')[0]?.split('.')[0] || ''

  // ─── Returning user: home with trips ───
  if (isReturningUser) {
    // Active trip: first upcoming, else first planning, else most recent
    const upcoming = trips.find(t => t.start_date && tripStatus(t) === 'upcoming')
    const planning = trips.find(t => tripStatus(t) === 'planning')
    const activeTrip = upcoming || planning || trips[0]
    const recentTrips = trips.filter(t => t.id !== activeTrip.id).slice(0, 6)
    const status = tripStatus(activeTrip)
    const away = activeTrip.start_date && status === 'upcoming' ? daysUntil(activeTrip.start_date) : null
    const days = getDays(activeTrip.start_date, activeTrip.end_date)

    return (
      <div className="relative h-full bg-drift-bg">
        {/* Atmosphere */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 starfield opacity-60" />
          <div
            className="aurora-blob h-[400px] w-[400px] left-[50%] top-[30%] -translate-x-1/2"
            style={{ background: auroraColor, opacity: 0.05 }}
          />
          <div className="absolute inset-0 noise-grain opacity-50" />
        </div>

        {/* Scroll content */}
        <div className="relative z-10 h-full overflow-y-auto overflow-x-hidden px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+28px)]">

          {/* ─── Greeting ─── */}
          <div className="mb-6 flex items-start justify-between gap-3" style={{ animation: 'fadeUp 0.9s ease 0.15s both' }}>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[8px] tracking-[2.5px] uppercase text-drift-gold/70 mb-1.5">
                {getGreeting()}{firstName ? `, ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}` : ''}
              </div>
              <div className="font-serif text-[24px] font-light italic leading-[1.05] tracking-tight">
                Where will you <span className="text-drift-gold">drift</span> next?
              </div>
            </div>

            {/* Profile avatar — opens floating dropdown */}
            <button
              onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen) }}
              aria-label="Profile menu"
              className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
                profileOpen ? 'bg-drift-gold text-drift-bg' : 'bg-white/[0.06] text-drift-text2 active:bg-white/[0.12]'
              }`}
            >
              {firstName ? firstName[0].toUpperCase() : 'D'}
            </button>
          </div>

          {/* Profile dropdown — fixed to viewport to escape scroll container's stacking context */}
          {profileOpen && (
            <>
              {/* Invisible backdrop for outside-click dismiss */}
              <div
                className="fixed inset-0 z-[150]"
                onClick={() => setProfileOpen(false)}
              />
              {/* The dropdown itself — anchored near the avatar */}
              <div
                className="fixed z-[160] min-w-[220px] rounded-2xl overflow-hidden border border-drift-border2 bg-drift-card shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-[fadeUp_0.2s_ease]"
                style={{
                  top: 'calc(env(safe-area-inset-top) + 64px)',
                  right: '20px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-drift-border">
                  <div className="text-[13px] font-semibold text-drift-text truncate">
                    {firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'Account'}
                  </div>
                  {userEmail && <div className="mt-0.5 text-[11px] text-drift-text3 truncate">{userEmail}</div>}
                </div>

                {/* Items */}
                <div className="py-1.5">
                  <button
                    onClick={() => { setProfileOpen(false); router.push('/m/trips/all') }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] text-drift-text2 transition-colors active:bg-drift-surface active:text-drift-text"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                    All trips
                  </button>

                  <div className="my-1.5 mx-3 border-t border-drift-border" />

                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] text-drift-text3 transition-colors active:bg-drift-surface active:text-drift-text2"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ─── Active trip — circular center ─── */}
          <div className="flex justify-center mb-8" style={{ animation: 'fadeUp 1s ease 0.3s both' }}>
            <button
              onClick={() => router.push(`/m/board/${activeTrip.id}`)}
              className="group relative active:scale-[0.97] transition-transform duration-300"
            >
              {/* Orbital rings */}
              <div className="absolute inset-0 -m-[20px] rounded-full border border-drift-gold/[0.08] compass-ring" style={{ animationDuration: '60s' }} />
              <div className="absolute inset-0 -m-[10px] rounded-full border border-drift-gold/[0.12] compass-ring-reverse" />

              {/* Orbiting dot */}
              <div className="absolute inset-0 -m-[20px] compass-ring pointer-events-none" style={{ animationDuration: '60s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-drift-gold/60" />
              </div>

              {/* Energy waves */}
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-drift-gold/25 pointer-events-none"
                  style={{
                    width: 'calc(100% + 6px)', height: 'calc(100% + 6px)',
                    animation: 'coreWave 5s ease-out infinite',
                    animationDelay: `${i * 2.2}s`,
                  }}
                />
              ))}

              {/* The circle — sized for mobile (260px) */}
              <div
                className="relative w-[260px] h-[260px] rounded-full overflow-hidden border-2 border-drift-gold/30"
                style={{ animation: 'corePulse 4s ease-in-out infinite' }}
              >
                <Image
                  src={getDestinationImage(activeTrip.destination)}
                  alt={activeTrip.destination}
                  fill
                  className="object-cover"
                  sizes="260px"
                  unoptimized
                />
                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)' }} />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-6">
                  {/* Status badge */}
                  <div className="mb-2 flex items-center gap-1.5 rounded-full border border-drift-gold/30 bg-black/50 backdrop-blur-md px-2.5 py-1">
                    {status === 'upcoming' && <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />}
                    <span className="font-mono text-[7px] tracking-[1.5px] uppercase text-drift-gold">
                      {status === 'upcoming'
                        ? away === 0 ? 'Today!' : away === 1 ? 'Tomorrow' : `${away} days away`
                        : 'Continue'
                      }
                    </span>
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </div>

                  {/* Destination */}
                  <div className="font-serif text-[22px] font-light text-white leading-tight text-center">
                    {activeTrip.destination}
                  </div>
                  {activeTrip.country && (
                    <div className="text-[10px] text-white/45 italic mt-0.5">{activeTrip.country}</div>
                  )}

                  {/* Vibes */}
                  {activeTrip.vibes?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap justify-center">
                      {activeTrip.vibes.slice(0, 3).map(v => (
                        <span key={v} className="rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.08] px-2 py-0.5 text-[7px] font-medium tracking-[1px] uppercase text-white/70">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="mt-1.5 font-mono text-[8px] text-white/35 tracking-[0.5px]">
                    {days > 0 && `${days}d`}
                    {activeTrip.start_date && `${days > 0 ? ' · ' : ''}${fmtDate(activeTrip.start_date)}`}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* ─── Recent orbs — horizontal scroll ─── */}
          {recentTrips.length > 0 && (
            <div className="mb-7" style={{ animation: 'fadeUp 1s ease 0.45s both' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif text-[13px] italic text-drift-gold/90">Recent Drifts</span>
                {trips.length > 7 && (
                  <button
                    onClick={() => router.push('/m/trips/all')}
                    className="font-mono text-[7px] tracking-[1.5px] uppercase text-white/30 active:text-drift-gold"
                  >
                    View all {trips.length} →
                  </button>
                )}
              </div>

              <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-5 px-5 pb-1">
                {recentTrips.map((trip, i) => {
                  const color = vibeColor(trip, i)
                  return (
                    <button
                      key={trip.id}
                      onClick={() => router.push(`/m/board/${trip.id}`)}
                      className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                    >
                      <div
                        className="relative w-[58px] h-[58px] rounded-full overflow-hidden"
                        style={{ border: `2px solid ${color}45`, boxShadow: `0 0 14px ${color}25` }}
                      >
                        <Image src={getDestinationImage(trip.destination)} alt={trip.destination} fill className="object-cover" sizes="58px" unoptimized />
                        <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 12px rgba(0,0,0,0.4)' }} />
                      </div>
                      <span className="text-[9px] text-white/55 max-w-[60px] truncate text-center">
                        {trip.destination}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Compose + Build actions ─── */}
          <div className="mb-7 grid grid-cols-2 gap-3" style={{ animation: 'fadeUp 1s ease 0.6s both' }}>
            <button
              onClick={handleStart}
              disabled={starting}
              className="group relative flex items-center gap-3 rounded-xl border border-drift-gold/25 bg-drift-gold/[0.06] p-3.5 active:scale-[0.97] transition-transform"
            >
              <div className="h-10 w-10 shrink-0 rounded-lg bg-drift-gold/10 border border-drift-gold/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c8a44e" strokeWidth="1.3">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[12px] font-semibold text-drift-text leading-tight">Compose</div>
                <div className="text-[9px] text-white/40 tracking-[0.5px] uppercase mt-0.5">From vibes</div>
              </div>
            </button>

            <button
              onClick={() => router.push('/m/plan/url')}
              className="group relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 active:scale-[0.97] transition-transform"
            >
              <div className="h-10 w-10 shrink-0 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-white/60">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-[12px] font-semibold text-drift-text leading-tight">Build</div>
                <div className="text-[9px] text-white/40 tracking-[0.5px] uppercase mt-0.5">From a reel</div>
              </div>
            </button>
          </div>

          {/* ─── Trending ─── */}
          {trending.length > 0 && (
            <div style={{ animation: 'fadeUp 1s ease 0.75s both' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px w-4 bg-drift-gold/40" />
                <span className="font-mono text-[7px] tracking-[2px] uppercase text-drift-gold/60">Distant Galaxies</span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto scrollbar-none -mx-5 px-5 pb-2">
                {trending.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => trip.share_slug ? router.push(`/share/${trip.share_slug}`) : null}
                    className="shrink-0 w-[150px] rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.015] active:scale-[0.97] transition-transform"
                  >
                    <div className="relative h-[85px]">
                      <Image src={getDestinationImage(trip.destination)} alt={trip.destination} fill className="object-cover" sizes="150px" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-drift-bg via-transparent to-transparent" />
                    </div>
                    <div className="p-2">
                      <div className="text-[10px] text-white/70 truncate">{trip.destination}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {trip.vibes?.slice(0, 2).map(v => (
                          <span key={v} className="text-[6px] text-white/25 uppercase tracking-wide">{v}</span>
                        ))}
                        {trip.heartCount > 0 && (
                          <span className="ml-auto flex items-center gap-0.5">
                            <svg width="6" height="6" viewBox="0 0 24 24" fill="#c8a44e" stroke="none" opacity={0.4}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            <span className="text-[6px] text-drift-gold/40 tabular-nums">{trip.heartCount}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Telemetry footer */}
          <div className="mt-6 flex items-center gap-2 font-mono text-[7px] tracking-[1px] text-white/20 uppercase justify-center">
            <span>{trips.length} trips</span>
            <span className="text-white/10">◆</span>
            <span>{new Set(trips.map(t => t.destination)).size} destinations</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── New user / anonymous: hero landing ───
  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden bg-drift-bg">
      {/* ═══ Atmosphere ═══ */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 starfield opacity-70" />
        <div
          className="aurora-blob h-[500px] w-[500px] left-[20%] top-[10%]"
          style={{ background: auroraColor, opacity: 0.08 }}
        />
        <div
          className="aurora-blob h-[400px] w-[400px] right-[10%] bottom-[15%]"
          style={{ background: '#4ecdc4', opacity: 0.04, animationDelay: '-10s' }}
        />
        <div className="absolute inset-0 noise-grain opacity-50" />
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10">

        {/* ─── HERO SECTION ─── */}
        <section className="flex min-h-[100dvh] flex-col justify-between px-6 pt-[calc(env(safe-area-inset-top)+28px)] pb-8">

          {/* Top: Drift mark + telemetry */}
          <div className="flex items-center justify-between opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.15s_forwards]">
            <div className="flex items-center gap-2">
              <div className="h-px w-4 bg-drift-gold/60" />
              <span className="font-serif text-[13px] italic text-drift-gold">Drift</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/40 backdrop-blur-md px-2.5 py-1">
              <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />
              <span className="font-mono text-[7px] tracking-[1.5px] text-white/70 uppercase">Online</span>
            </div>
          </div>

          {/* Middle: Mini orbital system — 8 planets orbiting the D core */}
          <div className="opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.3s_forwards]">
            <MobileOrbitalSystem />
          </div>

          {/* Bottom: copy + CTAs */}
          <div>
            {/* Eyebrow */}
            <div className="mb-3 flex items-center gap-2 opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.3s_forwards]">
              <div className="h-px w-4 bg-drift-gold/50" />
              <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Drift · MMXXVI</span>
            </div>

            {/* Headline */}
            <h1 className="mb-3.5 font-serif text-[38px] font-light leading-[1.02] tracking-[-0.02em]">
              <span className="inline opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.5s_forwards]">Your next </span>
              <span className="inline opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.7s_forwards]">trip is </span>
              <span className="inline opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.9s_forwards]">already</span>
              <br />
              <em className="inline font-normal italic text-drift-gold opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_1.1s_forwards]">in orbit.</em>
            </h1>

            {/* Subtitle */}
            <p className="mb-7 max-w-[300px] text-[13px] leading-[1.65] text-drift-text2 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_1.3s_forwards]">
              Pick a vibe. Paste a reel. Drift composes a trip you&apos;d actually book.
            </p>

            {/* Primary CTA */}
            <button
              onClick={handleStart}
              disabled={starting}
              className={"relative mb-2.5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] px-6 py-[17px] text-[12px] font-bold uppercase tracking-[2px] opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_1.5s_forwards] transition-transform duration-200 " + (starting ? "bg-drift-gold/50 text-drift-text3" : "bg-drift-gold text-drift-bg shadow-[0_16px_48px_rgba(200,164,78,0.18)] active:scale-[0.97]")}
            >
              {starting && <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/25 border-t-current" />}
              {!starting && (
                <span className="flex items-center gap-2.5">
                  Compose a trip
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              )}
              {!starting && (
                <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_3s_infinite]" />
              )}
            </button>

            {/* Secondary CTA — build from reel */}
            <button
              onClick={() => router.push('/m/plan/url')}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.02] px-4 py-[15px] text-[11px] font-semibold tracking-[1.5px] uppercase text-drift-text2 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_1.7s_forwards] transition-all duration-200 active:scale-[0.97]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Build from a reel or link
            </button>

            {/* Scroll hint */}
            <div className="mt-6 flex flex-col items-center gap-1.5 opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_2s_forwards]">
              <span className="font-mono text-[7px] tracking-[2px] text-white/25 uppercase">Scroll</span>
              <div className="h-4 w-px bg-gradient-to-b from-drift-gold/50 to-transparent animate-[scrollHint_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="px-6 py-16">
          <div className="mb-10">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px w-4 bg-drift-gold/50" />
              <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">How it works</span>
            </div>
            <h2 className="font-serif text-[28px] font-light leading-[1.05] tracking-[-0.02em]">
              Three beats. <em className="italic text-drift-gold">Under 30s.</em>
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { num: '01', eyebrow: 'Input', title: 'Type a feeling', desc: 'Not a destination — a mood. Drift reads intent.' },
              { num: '02', eyebrow: 'Compose', title: 'The board builds', desc: 'Real flights. Real hotels. 21 stops, ranked.' },
              { num: '03', eyebrow: 'Refine', title: 'Swap and go', desc: 'Ask for something quieter. The whole trip adjusts.' },
            ].map((s, i) => (
              <div
                key={s.num}
                className="relative flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 opacity-0"
                style={{ animation: `fadeUp 0.6s var(--ease-smooth) ${2.2 + i * 0.12}s forwards` }}
              >
                <div className="shrink-0">
                  <div className="font-serif text-[28px] font-light text-drift-gold/30 leading-none italic">{s.num}</div>
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[7px] tracking-[1.5px] uppercase text-drift-gold/70 mb-1">{s.eyebrow}</div>
                  <div className="font-serif text-[15px] font-normal text-drift-text mb-1">{s.title}</div>
                  <div className="text-[11px] text-drift-text3 leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PRINCIPLES ─── */}
        <section className="px-6 py-14 border-t border-white/[0.04]">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px w-4 bg-drift-gold/50" />
              <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Principles</span>
            </div>
            <h2 className="font-serif text-[28px] font-light leading-[1.05] tracking-[-0.02em]">
              Not search. <em className="italic text-drift-gold">Curation.</em>
            </h2>
          </div>

          <div className="space-y-5">
            {[
              { num: 'I', title: 'Every pick is explained', desc: 'Each stop shows its reasoning — vibe, budget, timing, tradeoffs.' },
              { num: 'II', title: 'Every price is live', desc: 'Pulled from Amadeus at generation time. No stale averages.' },
              { num: 'III', title: 'Every place is real', desc: 'Grounded in Google Maps and two million reviews. Zero invented venues.' },
              { num: 'IV', title: 'Every swap is one sentence', desc: '"Somewhere quieter." "Cheaper." The whole board adjusts.' },
            ].map((p) => (
              <div key={p.num} className="flex gap-4">
                <div className="shrink-0 font-serif text-[24px] font-light text-drift-gold/25 italic leading-none w-8">{p.num}</div>
                <div className="flex-1">
                  <div className="font-serif text-[15px] text-drift-text mb-0.5">{p.title}</div>
                  <div className="text-[11px] text-drift-text3 leading-relaxed">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative px-6 py-16 text-center overflow-hidden border-t border-white/[0.04]">
          <div
            className="aurora-blob h-[400px] w-[400px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ background: 'var(--color-drift-gold)', opacity: 0.05 }}
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[280px] w-[280px] rounded-full border border-drift-gold/10" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[380px] w-[380px] rounded-full border border-drift-gold/[0.05]" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2">
              <div className="h-px w-4 bg-drift-gold/50" />
              <span className="font-mono text-[8px] tracking-[2px] uppercase text-drift-gold/70">Departure</span>
              <div className="h-px w-4 bg-drift-gold/50" />
            </div>

            <h2 className="mb-3 font-serif text-[30px] font-light leading-[1.05] tracking-[-0.02em]">
              Stop planning.<br />
              <em className="italic text-drift-gold">Start drifting.</em>
            </h2>

            <p className="mb-7 text-[12px] text-drift-text3 leading-[1.6] max-w-[280px] mx-auto">
              Your next trip is one sentence away.
            </p>

            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 rounded-full bg-drift-gold px-8 py-3.5 text-[11px] font-bold tracking-[2px] uppercase text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.25)] active:scale-[0.97] transition-transform"
            >
              Compose my trip
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>

            <div className="mt-5 flex items-center justify-center gap-3 font-mono text-[8px] text-white/30 tracking-[1.5px] uppercase">
              <span>Free</span>
              <span className="text-white/15">◆</span>
              <span>No card</span>
              <span className="text-white/15">◆</span>
              <span>~30s</span>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="px-6 py-8 border-t border-white/[0.04]">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-serif text-[15px] italic text-drift-gold">Drift</span>
            <span className="font-mono text-[7px] tracking-[1px] text-white/30">/ v1.0 · MMXXVI</span>
          </div>
          <p className="text-[10px] text-white/30 leading-relaxed mb-4 max-w-[240px]">
            Travel composed, not searched.
          </p>
          <div className="flex items-center gap-3 text-[9px] text-[#4a4a55]">
            <Link href="/privacy" className="transition-colors active:text-drift-gold">Privacy</Link>
            <span className="text-white/15">·</span>
            <Link href="/terms" className="transition-colors active:text-drift-gold">Terms</Link>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />
              <span className="font-mono tracking-[1px] uppercase">Nominal</span>
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
