'use client'
import { parsePrice } from '@/lib/parse-price'
import { trackEvent } from '@/lib/analytics'
import { supabase, ensureAnonSession } from '@/lib/supabase'
import { getDestinationImage } from '@/lib/images'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

type Trip = {
  destination: string; country: string; vibes: string[];
  start_date: string; end_date: string; travelers: number; budget: string
}

// Lightweight reaction state for share page (no trip store dependency)
function useShareReactions(tripId: string | undefined) {
  const [reactions, setReactions] = useState<Record<string, { count: number; reacted: boolean }>>({})
  const [token, setToken] = useState<string | null>(null)

  // Only read an existing session. Reactions lazy-create an anon session on first toggle.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  // Fetch reactions
  useEffect(() => {
    if (!tripId) return
    fetch(`/api/trips/${tripId}/reactions`)
      .then(r => r.json())
      .then(data => { if (data.reactions) setReactions(data.reactions) })
      .catch(() => {})
  }, [tripId])

  const toggle = useCallback(async (itemId: string) => {
    if (!tripId) return
    // Lazy-create anon session on first reaction (a write).
    let authToken = token
    if (!authToken) {
      const session = await ensureAnonSession()
      authToken = session?.access_token ?? null
      if (authToken) setToken(authToken)
    }
    if (!authToken) return // sign-in failed; bail silently

    setReactions(prev => {
      const c = prev[itemId] || { count: 0, reacted: false }
      return { ...prev, [itemId]: { count: c.reacted ? c.count - 1 : c.count + 1, reacted: !c.reacted } }
    })
    try {
      await fetch(`/api/trips/${tripId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ itemId }),
      })
    } catch {}
  }, [tripId, token])

  return { reactions, toggle }
}

type Item = {
  id: string; category: string; name: string; detail: string; description: string | null;
  price: string; image_url: string | null; time: string | null; position: number;
  metadata: Record<string, unknown> | null
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const categoryColors: Record<string, string> = {
  flight: '#c8a44e', hotel: '#4ecdc4', activity: '#e8cc6e', food: '#f0a500', transfer: '#7a7a85',
}

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400',
}

type ShareTripViewProps = {
  trip: Trip
  items: Item[]
  tripId?: string
  heartCount?: number
  creatorName?: string | null
  creatorAvatar?: string | null
  overviewMapUrl?: string | null
}

export default function ShareTripView({
  trip, items, tripId,
  heartCount = 0,
  creatorName = null,
  creatorAvatar = null,
  overviewMapUrl = null,
}: ShareTripViewProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const { reactions, toggle: toggleReaction } = useShareReactions(tripId)

  // Join-trip state — only for authed, non-owner, non-member users
  const [joinState, setJoinState] = useState<'loading' | 'owner' | 'member' | 'can-join' | 'guest'>('loading')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    trackEvent('share_page_view', 'engagement', trip.destination)
  }, [trip.destination])

  // Check if the viewer can join this trip
  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      // Anonymous / no session → guest, can't join without signing in
      if (!session?.user || session.user.is_anonymous) {
        setJoinState('guest')
        return
      }

      // Fetch the trip to check ownership + collaborators to check membership
      const [{ data: tripRow }, { data: collabRow }] = await Promise.all([
        supabase.from('trips').select('user_id').eq('id', tripId).single(),
        supabase.from('collaborators').select('id, accepted_at').eq('trip_id', tripId).eq('user_id', session.user.id).maybeSingle(),
      ])

      if (cancelled) return
      if (tripRow?.user_id === session.user.id) {
        setJoinState('owner')
      } else if (collabRow?.accepted_at) {
        setJoinState('member')
      } else {
        setJoinState('can-join')
      }
    })
    return () => { cancelled = true }
  }, [tripId])

  async function handleJoin() {
    if (!tripId || joining) return
    setJoining(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        // Shouldn't happen if joinState === 'can-join', but fallback
        sessionStorage.setItem('drift-login-return', window.location.pathname)
        window.location.href = '/m/login'
        return
      }
      const res = await fetch(`/api/trips/${tripId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.status === 'joined' || data.status === 'owner') {
        // Redirect to the actual board — mobile or desktop
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        window.location.href = isMobile ? `/m/board/${tripId}` : `/trip/${tripId}`
      }
    } finally {
      setJoining(false)
    }
  }

  function handleSignInToJoin() {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('drift-login-return', window.location.pathname)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    window.location.href = isMobile ? '/m/login' : '/login'
  }

  // Parse days
  const days: { label: string; items: Item[]; insight?: string; mapUrl?: string; weather?: Record<string, unknown> }[] = []
  let currentDay: typeof days[0] | null = null
  let tripBrief = ''
  let weatherSummary = ''

  for (const item of items) {
    if (item.category === 'day') {
      const meta = item.metadata || {}
      if (meta.trip_brief) tripBrief = meta.trip_brief as string
      if (meta.weatherSummary) weatherSummary = meta.weatherSummary as string
      currentDay = {
        label: item.name,
        items: [],
        insight: meta.day_insight as string | undefined,
        mapUrl: meta.dayMapUrl as string | undefined,
        weather: meta.weather as Record<string, unknown> | undefined,
      }
      days.push(currentDay)
    } else if (currentDay) {
      currentDay.items.push(item)
    } else {
      if (!days.length) days.push({ label: 'Overview', items: [] })
      days[0].items.push(item)
    }
  }

  // Stats
  const real = items.filter(i => i.category !== 'day' && i.category !== 'transfer')
  const totalCost = real.reduce((s, i) => s + parsePrice(i.price), 0)
  const perPerson = trip.travelers ? Math.round(totalCost / trip.travelers) : totalCost

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function onImageError(id: string) {
    setFailedImages(prev => new Set([...prev, id]))
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* ═══ Cinematic hero — full-bleed destination image, content overlaid at bottom ═══ */}
      <div className="relative h-[78vh] min-h-[560px] max-h-[820px] w-full overflow-hidden">
        {/* Backdrop image */}
        <Image
          src={getDestinationImage(trip.destination)}
          alt={trip.destination}
          fill
          priority
          className="object-cover scale-[1.02]"
          sizes="100vw"
          unoptimized
        />
        {/* Multi-stop gradient: dark at top for nav legibility, then transparent middle, then dark bottom for content */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080c]/85 via-[#08080c]/15 to-[#08080c]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-transparent to-transparent" />
        {/* Subtle gold radial */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(200,164,78,0.08), transparent 65%)' }} />

        {/* Top-left brand mark (small, doesn't compete with the destination) */}
        <div className="absolute top-6 left-8 max-md:top-4 max-md:left-5 flex items-center gap-2 z-10">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#8B7845] flex items-center justify-center font-serif italic text-[12px] text-[#08080c]">D</div>
          <span className="text-[10px] tracking-[2.5px] uppercase text-white/60">Drift</span>
        </div>

        {/* Top-right utility — heart count + copy link, icon-only */}
        <div className="absolute top-6 right-8 max-md:top-4 max-md:right-5 flex items-center gap-2 z-10">
          {heartCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md px-3 py-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#c8a44e" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              <span className="text-[10px] tabular-nums text-white/80">{heartCount}</span>
            </div>
          )}
          <button
            onClick={copyLink}
            aria-label={copiedLink ? 'Link copied' : 'Copy link'}
            className="h-9 w-9 rounded-full border border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-[#c8a44e] hover:border-[#c8a44e]/40 transition-all active:scale-95"
          >
            {copiedLink ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        {/* Bottom: title + meta + CTAs */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-12 pb-14 max-md:px-5 max-md:pb-8 max-w-[1100px] mx-auto">
          {/* Eyebrow: creator on its own row (so it doesn't collide with vibes on mobile) */}
          {(creatorName || (trip.vibes && trip.vibes.length > 0)) && (
            <div className="flex flex-col gap-2 mb-3 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.15s]">
              {creatorName && (
                <div className="flex items-center gap-2">
                  {creatorAvatar ? (
                    <Image src={creatorAvatar} alt={creatorName} width={22} height={22} className="rounded-full" unoptimized />
                  ) : (
                    <div className="h-[22px] w-[22px] rounded-full bg-[#c8a44e]/20 border border-[#c8a44e]/30 flex items-center justify-center text-[9px] font-bold text-[#c8a44e] uppercase">
                      {creatorName.charAt(0)}
                    </div>
                  )}
                  <span className="text-[11px] text-white/70">composed by <span className="text-[#c8a44e]">{creatorName}</span></span>
                </div>
              )}
              {trip.vibes && trip.vibes.length > 0 && (
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                  {trip.vibes.slice(0, 4).map((v, i, arr) => (
                    <span key={v} className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-[1.5px] text-white/55">{v}</span>
                      {i < arr.length - 1 && <span className="text-white/15 text-[8px]">·</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <h1 className="font-serif text-[clamp(48px,8vw,96px)] font-light leading-[0.95] tracking-[-0.02em] mb-4 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.25s] max-w-[800px]">
            {trip.destination}
            {trip.country && trip.country.toLowerCase() !== trip.destination?.toLowerCase() && (
              <span className="block italic font-serif text-[#c8a44e] text-[clamp(28px,5vw,56px)] mt-1">{trip.country}</span>
            )}
          </h1>

          {/* Inline meta row — replaces the 4-stat box clutter */}
          <div className="flex items-center gap-x-4 gap-y-1 mb-7 flex-wrap text-white/65 text-[12px] opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.35s]">
            <span className="font-mono tabular-nums">{days.length} {days.length === 1 ? 'day' : 'days'}</span>
            <span className="text-white/15">·</span>
            <span className="font-mono tabular-nums">{items.filter(i => i.category === 'activity' || i.category === 'food').length} stops</span>
            <span className="text-white/15">·</span>
            <span className="font-mono tabular-nums">${totalCost.toLocaleString()} total</span>
            <span className="text-white/15">·</span>
            <span className="font-mono tabular-nums text-white/45">${perPerson.toLocaleString()} pp</span>
            {trip.start_date && (<>
              <span className="text-white/15">·</span>
              <span>{fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}</span>
            </>)}
          </div>

          {/* CTAs — Remix is the hero, owner/member contextual variants stay subordinate */}
          <div className="flex items-center gap-3 flex-wrap opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.45s]">
            {/* Primary: Remix — shown unless the viewer is the owner or already a member */}
            {joinState !== 'member' && joinState !== 'owner' && tripId && (
              <a
                href={(typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
                  ? `/m/plan/vibes?remix=${tripId}`
                  : `/vibes?remix=${tripId}`}
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#08080c] text-[12px] font-bold tracking-[2px] uppercase rounded-full hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(200,164,78,0.35)] transition-all active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                Remix this trip
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
            )}

            {/* Owner: open their board */}
            {joinState === 'owner' && (
              <a
                href={(typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) ? `/m/board/${tripId}` : `/trip/${tripId}`}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#08080c] text-[12px] font-bold tracking-[2px] uppercase rounded-full hover:-translate-y-0.5 transition-all active:scale-95"
              >
                Manage trip
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
            )}

            {/* Member: open their copy of the board */}
            {joinState === 'member' && (
              <a
                href={(typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) ? `/m/board/${tripId}` : `/trip/${tripId}`}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#08080c] text-[12px] font-bold tracking-[2px] uppercase rounded-full hover:-translate-y-0.5 transition-all active:scale-95"
              >
                Open trip
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
            )}

            {/* Secondary: Join (only meaningful for an authed non-owner who hasn't joined yet — kept subordinate) */}
            {joinState === 'can-join' && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="inline-flex items-center gap-2 px-5 py-3 border border-white/15 bg-white/[0.04] backdrop-blur-md text-white/80 text-[11px] font-medium tracking-[1.5px] uppercase rounded-full hover:border-white/30 hover:bg-white/[0.08] transition-all active:scale-95 disabled:opacity-60"
              >
                {joining ? 'Joining…' : 'Join group'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Drift's strategy — centered pull-quote section, breathes between hero and itinerary ═══ */}
      {tripBrief && (
        <div className="relative px-8 max-md:px-5 py-14 max-md:py-10 max-w-[760px] mx-auto opacity-0 animate-[fadeUp_0.9s_ease_forwards_0.55s]">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px w-6 bg-[#c8a44e]/40" />
            <span className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/70">Drift&apos;s strategy</span>
          </div>
          <p className="font-serif text-[clamp(18px,2vw,24px)] font-light leading-[1.55] tracking-[-0.005em] text-white/85">{tripBrief}</p>
          {weatherSummary && (
            <div className="mt-6 flex items-center gap-2.5 text-[11px] text-white/45">
              <span className="text-base">{weatherSummary.toLowerCase().includes('rain') ? '🌧' : '☀️'}</span>
              <span className="leading-snug">{weatherSummary}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ Overview map — single image showing the journey shape (Static Maps + polyline) ═══ */}
      {overviewMapUrl && (
        <div className="relative z-[1] max-w-[1100px] mx-auto px-10 max-md:px-5 pb-12 max-md:pb-8 opacity-0 animate-[fadeUp_0.9s_ease_forwards_0.65s]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-px w-6 bg-[#c8a44e]/40" />
              <span className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/70">The journey</span>
            </div>
            <span className="font-mono text-[9px] tabular-nums text-white/35">
              {items.filter(i => i.category !== 'day' && i.category !== 'flight' && i.category !== 'transfer').length} stops · {days.length} {days.length === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={overviewMapUrl} alt={`Map of ${trip.destination} trip`} className="w-full h-[280px] max-md:h-[200px] object-cover" loading="lazy" />
            {/* Subtle gradient at the bottom for visual cohesion with the dark theme */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#08080c] to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* ═══ Itinerary — magazine-style day spreads ═══ */}
      <div className="relative z-[1] max-w-[860px] mx-auto px-10 max-md:px-5 pb-20">
        {days.map((day, di) => (
          <section key={di} id={`day-${di + 1}`} className="mb-20 max-md:mb-14">
            {/* Day header — bigger number, serif label, weather pill */}
            <div className="flex items-end gap-5 mb-7 max-md:gap-4 max-md:mb-5">
              <div className="shrink-0">
                <div className="font-mono text-[8px] tracking-[2.5px] uppercase text-[#c8a44e]/60 mb-1">Day {di + 1}</div>
                <div className="h-px w-12 bg-[#c8a44e]/30" />
              </div>
              <h2 className="flex-1 font-serif text-[clamp(22px,2.6vw,32px)] font-light leading-[1.1] tracking-[-0.01em] text-white/90">{day.label}</h2>
              {day.weather && (
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0 ${(day.weather.isRainy) ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <span className="text-sm">{(day.weather.isRainy) ? '🌧' : (day.weather.isSunny) ? '☀️' : '⛅'}</span>
                  <span className={`text-[11px] tabular-nums font-medium ${(day.weather.isRainy) ? 'text-blue-300' : 'text-amber-300'}`}>{day.weather.tempMax as number}°</span>
                </div>
              )}
            </div>

            {/* Day insight — pull-quote treatment, no box */}
            {day.insight && (
              <blockquote className="mb-7 max-md:mb-5 pl-5 border-l-2 border-[#c8a44e]/40 max-w-[640px]">
                <p className="font-serif italic text-[clamp(15px,1.5vw,18px)] leading-[1.6] text-white/70">
                  &ldquo;{day.insight}&rdquo;
                </p>
              </blockquote>
            )}

            {/* Day map — wider + taller for context */}
            {day.mapUrl && (
              <div className="mb-7 max-md:mb-5 overflow-hidden rounded-2xl border border-white/[0.06] shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
                <img src={day.mapUrl} alt={`Map for Day ${di + 1}`} className="h-[200px] w-full object-cover max-md:h-[160px]" loading="lazy" />
              </div>
            )}

            {/* Items — alternating image side, larger images, magazine spreads */}
            <div className="space-y-5 max-md:space-y-4">
              {day.items.filter(i => i.category !== 'transfer').map((item, idx) => {
                const meta = item.metadata as Record<string, unknown> | null
                const reason = meta?.reason as string | undefined
                const rating = meta?.rating as number | undefined
                const catColor = categoryColors[item.category] || '#7a7a85'
                const imgSrc = failedImages.has(item.id) ? FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.activity : item.image_url
                const imageRight = idx % 2 === 1

                return (
                  <article
                    key={item.id}
                    className="group relative grid grid-cols-[200px_1fr] gap-5 rounded-2xl bg-white/[0.015] border border-white/[0.05] overflow-hidden hover:border-white/[0.12] hover:bg-white/[0.025] transition-all max-md:grid-cols-[110px_1fr] max-md:gap-3"
                    style={imageRight ? { gridTemplateColumns: '1fr 200px' } : undefined}
                  >
                    {/* Image — bigger, square aspect */}
                    {imgSrc && (
                      <div
                        className="relative aspect-square max-md:aspect-[4/5] overflow-hidden"
                        style={imageRight ? { gridColumn: 2, gridRow: 1 } : undefined}
                      >
                        <Image
                          src={imgSrc}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-[1500ms] group-hover:scale-105"
                          sizes="200px"
                          unoptimized={!imgSrc.includes('unsplash.com')}
                          onError={() => onImageError(item.id)}
                        />
                        {rating && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5">
                            <span className="text-[9px] text-amber-400">★</span>
                            <span className="text-[9px] tabular-nums text-white/90">{rating}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div
                      className="flex flex-col justify-between p-5 max-md:p-3.5"
                      style={imageRight ? { gridColumn: 1, gridRow: 1 } : undefined}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-[8px] tracking-[2px] uppercase font-semibold" style={{ color: catColor }}>
                            {item.category}
                          </span>
                          {item.time && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="font-mono text-[9px] text-white/45 tabular-nums">{item.time}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-serif text-[clamp(17px,1.7vw,22px)] font-light leading-[1.2] text-white/95 mb-2">{item.name}</h3>
                        {item.detail && <p className="text-[12px] leading-[1.55] text-white/55 line-clamp-2 mb-2.5">{item.detail}</p>}
                        {reason && (
                          <p className="text-[11px] italic text-[#c8a44e]/85 leading-[1.5] line-clamp-2 mb-2.5">— {reason}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        {item.price ? (
                          <span className="text-[14px] font-light" style={{ color: catColor }}>{item.price}</span>
                        ) : <span />}
                        <button
                          onClick={() => toggleReaction(item.id)}
                          className={`flex items-center gap-1 text-[11px] transition-colors ${
                            reactions[item.id]?.reacted ? 'text-[#c8a44e]' : 'text-white/35 hover:text-[#c8a44e]'
                          }`}
                          aria-label={reactions[item.id]?.reacted ? 'Unlike' : 'Like'}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={reactions[item.id]?.reacted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          {reactions[item.id]?.count > 0 && <span className="tabular-nums">{reactions[item.id].count}</span>}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ═══ Footer — closing remix CTA, only shown to non-owners ═══ */}
      {joinState !== 'owner' && joinState !== 'member' && tripId && (
        <div className="relative z-[1] text-center py-20 max-md:py-14 border-t border-white/[0.04] px-6">
          <p className="font-mono text-[9px] tracking-[3px] uppercase text-[#c8a44e]/60 mb-3">Inspired?</p>
          <p className="font-serif text-[clamp(24px,3vw,38px)] font-light italic leading-tight text-white/85 mb-2">
            Make this trip <span className="text-[#c8a44e]">yours</span>.
          </p>
          <p className="text-[12px] text-white/45 mb-8 max-w-[440px] mx-auto leading-relaxed">
            Remix the vibes, swap the destination, change the dates. Drift composes your version in 30 seconds.
          </p>
          <a
            href={(typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
              ? `/m/plan/vibes?remix=${tripId}`
              : `/vibes?remix=${tripId}`}
            className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#08080c] text-[11px] font-bold tracking-[2px] uppercase rounded-full hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(200,164,78,0.35)] transition-all active:scale-95"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Remix this trip
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
        </div>
      )}
    </div>
  )
}
