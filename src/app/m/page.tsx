'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

interface TripSummary {
  id: string
  destination: string
  country: string
  start_date: string
  end_date: string
  vibes: string[]
  created_at: string
}

const words = [
  { text: 'Every trip ', delay: 0.3 },
  { text: 'begins with ', delay: 0.5 },
  { text: 'a ', delay: 0.7 },
  { text: 'feeling.', delay: 0.9, italic: true },
]

// Destination cover images for trip cards
const destCovers: Record<string, string> = {
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=400&fit=crop&q=80',
  bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=600&h=400&fit=crop&q=80',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop&q=80',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop&q=80',
  tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop&q=80',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&h=400&fit=crop&q=80',
  phuket: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=600&h=400&fit=crop&q=80',
  pattaya: 'https://images.unsplash.com/photo-1562602833-0f4ab2fc46e5?w=600&h=400&fit=crop&q=80',
  maldives: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=400&fit=crop&q=80',
  jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&h=400&fit=crop&q=80',
  manali: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=600&h=400&fit=crop&q=80',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&h=400&fit=crop&q=80',
}
const defaultCover = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop&q=80'

function getCover(dest: string): string {
  const key = dest.toLowerCase()
  for (const [k, url] of Object.entries(destCovers)) {
    if (key.includes(k)) return url
  }
  return defaultCover
}

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isUpcoming(startDate: string): boolean {
  return new Date(startDate + 'T00:00:00') >= new Date(new Date().toDateString())
}

function daysUntil(startDate: string): number {
  const diff = new Date(startDate + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function HeroPage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)
  const userEmail = useTripStore((s) => s.userEmail)
  const isAnonymous = useTripStore((s) => s.isAnonymous)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [upcomingTrip, setUpcomingTrip] = useState<TripSummary | null>(null)

  // Check for post-auth return path (e.g., returning from Google OAuth during onboarding)
  useEffect(() => {
    if (!token || !userId) return
    const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('drift-login-return') : null
    if (returnTo) {
      sessionStorage.removeItem('drift-login-return')
      router.replace(returnTo)
      return
    }
  }, [token, userId, router])

  // Fetch trips for returning users
  useEffect(() => {
    if (!token || !userId || checked || isAnonymous) {
      setLoading(false)
      return
    }
    setChecked(true)

    supabase
      .from('trips')
      .select('id, destination, country, start_date, end_date, vibes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data?.length) {
          setTrips(data)
          // Find upcoming trip (start_date in future)
          const upcoming = data.find(t => t.start_date && isUpcoming(t.start_date))
          if (upcoming) {
            setUpcomingTrip(upcoming)
          }
        }
        setLoading(false)
      }, () => { setLoading(false) })
  }, [token, userId, checked, isAnonymous])

  // Show loading screen while checking
  if (loading && !isAnonymous && token) {
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
  const pastTrips = trips.filter(t => !t.start_date || !isUpcoming(t.start_date))
  const firstName = userEmail?.split('@')[0]?.split('.')[0] || ''

  // ─── Returning user: has trips ───
  if (isReturningUser) {
    return (
      <div className="flex h-full flex-col bg-drift-bg">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(200,164,78,0.04)_0%,transparent_55%)]" />
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-6 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="font-serif text-[22px] font-light text-drift-text">
                {firstName ? `Hey, ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}` : 'Welcome back'}
              </div>
              <div className="mt-0.5 text-[11px] text-drift-text3">Where to next?</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-light uppercase tracking-[4px] text-drift-gold/50">Drift</span>
            </div>
          </div>

          {/* Upcoming trip — hero card */}
          {upcomingTrip && (
            <button
              onClick={() => router.push(`/m/board/${upcomingTrip.id}`)}
              className="relative mb-5 w-full overflow-hidden rounded-2xl border border-drift-gold/20 text-left active:scale-[0.98] transition-transform"
            >
              <div className="relative h-[160px] w-full">
                <Image src={getCover(upcomingTrip.destination)} alt={upcomingTrip.destination} fill className="object-cover" sizes="100vw" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.9)] via-[rgba(8,8,12,0.4)] to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-drift-gold px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-drift-bg">
                    {daysUntil(upcomingTrip.start_date) === 0 ? 'Today!' : `In ${daysUntil(upcomingTrip.start_date)} days`}
                  </span>
                </div>
                <div className="font-serif text-[22px] font-normal text-drift-text">{upcomingTrip.destination}</div>
                <div className="text-[11px] text-drift-text/60">
                  {fmtDate(upcomingTrip.start_date)} — {fmtDate(upcomingTrip.end_date)} · {upcomingTrip.country}
                </div>
              </div>
            </button>
          )}

          {/* Plan next trip CTA */}
          <button
            onClick={handleStart}
            disabled={starting}
            className="relative mb-5 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] bg-drift-gold px-6 py-[17px] text-[13px] font-bold uppercase tracking-widest text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)] transition-transform active:scale-[0.97]"
          >
            {starting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
            ) : (
              <span className="flex items-center gap-2.5">
                Plan a new trip
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            )}
            <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_2s_infinite]" />
          </button>

          {/* Past trips grid */}
          {pastTrips.length > 0 && (
            <>
              <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
                Your trips
              </div>
              <div className="grid grid-cols-2 gap-3">
                {pastTrips.slice(0, 4).map((trip, i) => (
                  <button
                    key={trip.id}
                    onClick={() => router.push(`/m/board/${trip.id}`)}
                    className="overflow-hidden rounded-xl border border-drift-border2 bg-drift-card text-left transition-all active:scale-[0.97] animate-[fadeUp_0.4s_var(--ease-smooth)_forwards]"
                    style={{ opacity: 0, animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="relative h-[80px] w-full">
                      <Image src={getCover(trip.destination)} alt={trip.destination} fill className="object-cover" sizes="50vw" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.85)] to-transparent" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <div className="text-[13px] font-semibold text-drift-text">{trip.destination}</div>
                      <div className="text-[9px] text-drift-text3">
                        {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Reel CTA */}
          <button
            onClick={() => router.push('/m/plan/url')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-drift-gold/15 bg-transparent px-4 py-3 text-[11px] font-semibold tracking-wider text-drift-gold transition-all active:scale-[0.97]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Got a travel reel? Plan from it
          </button>
        </div>
      </div>
    )
  }

  // ─── New user: no trips (first time or anonymous) ───
  return (
    <div className="flex h-full flex-col justify-end px-6 pb-[env(safe-area-inset-bottom)]">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_85%,rgba(200,164,78,0.06)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-drift-bg via-drift-bg/40 to-drift-bg" />
      </div>

      {/* Content */}
      <div className="relative z-10 pb-4">
        {/* Drift mark */}
        <div className="mb-11 flex items-center gap-2.5 opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.2s_forwards]">
          <div className="h-px w-5 bg-drift-gold opacity-40" />
          <span className="font-serif text-sm font-light uppercase tracking-[6px] text-drift-gold opacity-70">
            Drift
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-[18px] font-serif text-[46px] font-light leading-[1.04] tracking-tight">
          {words.map((w, i) => (
            <span
              key={i}
              className="inline opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_forwards]"
              style={{ animationDelay: `${w.delay}s` }}
            >
              {w.italic ? <em className="font-normal italic text-drift-gold">{w.text}</em> : w.text}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="mb-8 max-w-[260px] text-[13px] leading-[1.7] tracking-wide text-drift-text2 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.4s_forwards]">
          Your vibe. Your budget. Your dates. AI builds a trip you&apos;d actually book.
        </p>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={starting}
          className={"relative mb-0 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] px-6 py-[19px] text-[13px] font-bold uppercase tracking-widest opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.6s_forwards] transition-transform duration-200 " + (starting ? "bg-drift-gold/50 text-drift-text3" : "bg-drift-gold text-drift-bg shadow-[0_16px_48px_rgba(200,164,78,0.18)] active:scale-[0.97]")}
        >
          {starting && (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
          )}
          {!starting && (
            <span className="flex items-center gap-2.5">
              Start Planning
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          )}
          {!starting && (
            <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_3s_infinite]" />
          )}
        </button>

        {/* Reel CTA */}
        <button
          onClick={() => router.push('/m/plan/url')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] border border-drift-gold/20 bg-transparent px-4 py-[15px] text-xs font-semibold tracking-wider text-drift-gold opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.8s_forwards] transition-all duration-200 active:scale-[0.97] active:bg-drift-gold/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Got a travel reel? Create from URL
        </button>

        {/* Legal links */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[10px] text-[#4a4a55] opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_2s_forwards]">
          <Link href="/privacy" className="hover:text-[#c8a44e] transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-[#c8a44e] transition-colors">Terms</Link>
        </div>
      </div>
    </div>
  )
}
