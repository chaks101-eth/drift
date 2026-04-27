'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import NavBar from '@/app/NavBar'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import { useTripStore } from '@/stores/trip-store'
import { supabase, ensureAnonSession } from '@/lib/supabase'
import { detectCurrencyFromOrigin, formatPrice } from '@/lib/currency'
import CityAutocomplete from '@/components/desktop/CityAutocomplete'

// ─── Vibe Library ─────────────────────────────────────────────────
const VIBES = [
  { id: 'beach', name: 'Beach Chill', desc: 'Sun, sand, zero stress', img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&h=600&fit=crop&q=80' },
  { id: 'adventure', name: 'Adventure', desc: 'Hikes, thrills, adrenaline', img: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800&h=600&fit=crop&q=80' },
  { id: 'city', name: 'City Nights', desc: 'Rooftops, lights, energy', img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&h=600&fit=crop&q=80' },
  { id: 'romance', name: 'Romance', desc: 'Sunsets, wine, intimacy', img: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=800&h=600&fit=crop&q=80' },
  { id: 'luxury', name: 'Luxury', desc: 'Five stars, private pools, VIP', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop&q=80' },
  { id: 'wellness', name: 'Wellness', desc: 'Detox, yoga, massages', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=600&fit=crop&q=80' },
  { id: 'spiritual', name: 'Spiritual', desc: 'Peace, temples, mindfulness', img: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800&h=600&fit=crop&q=80' },
  { id: 'foodie', name: 'Foodie Trail', desc: 'Street food & fine dining', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&q=80' },
  { id: 'party', name: 'Party Mode', desc: 'Clubs, festivals, all night', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop&q=80' },
  { id: 'nature', name: 'Nature Escape', desc: 'Mountains, lakes, wildlife', img: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop&q=80' },
  { id: 'family', name: 'Family Fun', desc: 'Kid-friendly, safe, memorable', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop&q=80' },
  { id: 'backpacker', name: 'Backpacker', desc: 'Hostels, budget, freedom', img: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&h=600&fit=crop&q=80' },
  { id: 'culture', name: 'Culture', desc: 'Art, history, local life', img: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800&h=600&fit=crop&q=80' },
  { id: 'shopping', name: 'Shopping', desc: 'Markets, malls, souvenirs', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop&q=80' },
  { id: 'hidden', name: 'Hidden Gems', desc: 'Off-the-beaten-path spots', img: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=800&h=600&fit=crop&q=80' },
]

const BUDGETS = [
  { id: 'budget', label: 'Budget', amount: 1500, hint: 'Hostels · street food' },
  { id: 'mid', label: 'Comfort', amount: 3000, hint: '3-4★ hotels · local spots' },
  { id: 'luxury', label: 'Luxury', amount: 7000, hint: '5★ resorts · premium' },
] as const

// Suspense wrapper required by Next.js 15 because VibesContent calls useSearchParams().
// Without it, `next build` fails with "useSearchParams() should be wrapped in a suspense boundary".
export default function VibesPage() {
  return (
    <DesktopAuthProvider>
      <Suspense fallback={null}>
        <VibesContent />
      </Suspense>
    </DesktopAuthProvider>
  )
}

function VibesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setVibes, setOrigin, setDates, setBudget, setTravelers, setDestination, onboarding } = useTripStore()
  const isAnonymous = useTripStore((s) => s.isAnonymous)
  const userEmail = useTripStore((s) => s.userEmail)
  const remixSource = useTripStore((s) => s.remixSource)
  const remixFromTrip = useTripStore((s) => s.remixFromTrip)
  const clearRemixSource = useTripStore((s) => s.clearRemixSource)
  const preselectedDest = onboarding.destination
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  // URL extraction state
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlExtracting, setUrlExtracting] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [urlExtracted, setUrlExtracted] = useState<{
    primaryDestination: string; country: string; vibes: string[]; suggestedDays: number;
    highlights: Array<{ name: string; category: string; detail: string; estimatedPrice?: string; inferredFromDestination?: boolean }>;
    budgetHint: string; summary: string; sourceType: string; sourceTitle: string;
  } | null>(null)

  // Sensible default: trip starts +7 days, lasts 5 days
  const defaultDates = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getTime() + 7 * 86400000)
    const end = new Date(start.getTime() + 5 * 86400000)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }, [])

  const [selected, setSelected] = useState<string[]>(onboarding.pickedVibes || [])
  const [origin, setOriginLocal] = useState(onboarding.origin || '')
  const [startDate, setStartDate] = useState(onboarding.startDate || defaultDates.start)
  const [endDate, setEndDate] = useState(onboarding.endDate || defaultDates.end)
  const [budget, setBudgetLocal] = useState<'budget' | 'mid' | 'luxury'>(onboarding.budgetLevel || 'mid')
  const [travelers, setTravelersLocal] = useState(onboarding.travelers || 2)
  const [hoveredVibe, setHoveredVibe] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const [pulseId, setPulseId] = useState<string | null>(null)

  // Local currency detection — updates as user types origin
  const currency = useMemo(() => detectCurrencyFromOrigin(origin || 'Delhi'), [origin])
  const fmt = (usd: number) => formatPrice(usd, currency)

  const MAX_VIBES = 5

  function toggleVibe(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : prev.length < MAX_VIBES ? [...prev, id] : prev)
    setPulseId(id)
    setTimeout(() => setPulseId(null), 600)
  }

  // Background image follows hover or first selected vibe
  const backgroundVibe = useMemo(() => {
    const id = hoveredVibe || selected[0]
    return id ? VIBES.find(v => v.id === id) : null
  }, [hoveredVibe, selected])

  // Trip duration helper
  const duration = useMemo(() => {
    if (!startDate || !endDate) return null
    const days = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    return days
  }, [startDate, endDate])

  // Fix endDate if it's before startDate
  const datesInvalid = startDate && endDate && endDate <= startDate

  const canContinue = selected.length > 0 && origin.trim().length > 0 && startDate && endDate && !datesInvalid

  function saveOnboarding() {
    setVibes(selected)
    if (origin) setOrigin(origin)
    if (startDate && endDate) setDates(startDate, endDate)
    const budgetDef = BUDGETS.find(b => b.id === budget)
    setBudget(budget, budgetDef?.amount || 3000)
    setTravelers(travelers)
  }

  function handleContinue() {
    if (!canContinue || navigating) return
    saveOnboarding()

    // If destination was preselected (orbital landing or URL extraction),
    // skip /destinations — but check auth first
    if (preselectedDest) {
      setDestination({ ...preselectedDest, vibes: selected })

      // Store URL highlights in sessionStorage for the loading page
      if (urlExtracted) {
        sessionStorage.setItem('drift-url-highlights', JSON.stringify({
          highlights: urlExtracted.highlights,
          summary: urlExtracted.summary,
        }))
      }

      if (isAnonymous) {
        setShowAuthGate(true)
        return
      }
      proceedToGenerate()
    } else {
      setNavigating(true)
      router.push('/destinations')
    }
  }

  function proceedToGenerate() {
    setNavigating(true)
    router.push('/loading-trip')
  }

  // After OAuth return, auto-proceed if authenticated + preselected dest exists
  useEffect(() => {
    if (!isAnonymous && userEmail && preselectedDest) {
      const postAction = typeof window !== 'undefined' ? sessionStorage.getItem('drift-post-auth-action') : null
      if (postAction === 'generate') {
        sessionStorage.removeItem('drift-post-auth-action')
        proceedToGenerate()
      }
    }
  }, [isAnonymous, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Remix handler — /vibes?remix=<trip_id> ─────────────────
  // Fetches the source trip via /api/trips/[id] (service role), prefills the store,
  // and syncs local controls. Idempotent: won't re-fetch if we've already remixed this id.
  const remixParam = searchParams?.get('remix')
  useEffect(() => {
    if (!remixParam || remixSource?.id === remixParam) return
    let cancelled = false
    fetch(`/api/trips/${remixParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.trip) return
        const t = data.trip
        remixFromTrip({
          id: t.id,
          destination: t.destination,
          country: t.country,
          vibes: t.vibes,
          travelers: t.travelers,
          budget: t.budget,
        })
        // Sync local state so the UI reflects the remix immediately
        const vibes = (t.vibes || []).slice(0, 5)
        setSelected(vibes)
        if (t.travelers && t.travelers > 0) setTravelersLocal(t.travelers)
        if (t.budget === 'budget' || t.budget === 'mid' || t.budget === 'luxury') setBudgetLocal(t.budget)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [remixParam, remixSource?.id, remixFromTrip])

  // ─── URL extraction ─────────────────────────────────────────
  async function handleUrlExtract() {
    if (!urlValue.trim()) return
    try { new URL(urlValue) } catch { setUrlError('Enter a valid URL'); return }
    setUrlError('')
    setUrlExtracting(true)
    try {
      // First write moment — URL extract calls Gemini (requires auth). Create anon session if needed.
      await ensureAnonSession()
      const token = useTripStore.getState().token
      const res = await fetch('/api/ai/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: urlValue }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setUrlError(data.error || 'Extraction failed'); setUrlExtracting(false); return }
      setUrlExtracted(data.extracted)
      // Pre-fill vibes + destination from extraction
      const extractedVibes = (data.extracted.vibes || []).slice(0, MAX_VIBES)
      setSelected(extractedVibes)
      setDestination({
        city: data.extracted.primaryDestination,
        country: data.extracted.country || '',
        tagline: data.extracted.summary || '',
        match: 100,
        vibes: extractedVibes,
      })
      // Pre-fill dates if suggested
      if (data.extracted.suggestedDays) {
        const start = new Date(Date.now() + 14 * 86400000)
        const end = new Date(start.getTime() + (data.extracted.suggestedDays - 1) * 86400000)
        setStartDate(start.toISOString().slice(0, 10))
        setEndDate(end.toISOString().slice(0, 10))
      }
    } catch {
      setUrlError('Network error. Try again.')
    } finally {
      setUrlExtracting(false)
    }
  }

  async function handleGoogleAuth() {
    setAuthLoading(true)
    try {
      sessionStorage.setItem('drift-post-auth-action', 'generate')

      const redirectUrl = `${window.location.origin}/api/auth/callback?next=/vibes`

      const { error: err } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: redirectUrl },
      })
      if (err) {
        const { error: err2 } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl },
        })
        if (err2) setAuthLoading(false)
      }
    } catch {
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text overflow-x-hidden">
      <NavBar />

      {/* ═══ Background Mood — follows hover/selection ═══ */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {backgroundVibe && (
          <div key={backgroundVibe.id} className="absolute inset-0 animate-[fadeIn_0.8s_ease]">
            <Image
              src={backgroundVibe.img}
              alt=""
              fill
              className="object-cover scale-110 blur-3xl opacity-25"
              sizes="100vw"
              unoptimized
              priority={false}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-drift-bg via-drift-bg/80 to-drift-bg" />
      </div>

      {/* ═══ Main Content ═══ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-8 pt-24 pb-40">

        {/* Destination badge — shown when user arrived via orbital landing pick */}
        {preselectedDest && (
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-drift-gold/25 bg-drift-gold/[0.05] backdrop-blur-sm px-4 py-2 animate-[fadeUp_0.4s_ease]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[11px] text-drift-text3">Composing your trip to</span>
            <span className="text-[12px] font-semibold text-drift-gold">{preselectedDest.city}</span>
            {preselectedDest.country && <span className="text-[10px] text-drift-text3">· {preselectedDest.country}</span>}
            <button
              onClick={() => setDestination(null)}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-drift-text3 hover:bg-white/10 hover:text-drift-text transition-colors text-sm leading-none"
              aria-label="Clear destination"
            >×</button>
          </div>
        )}

        {/* Step + headline */}
        <div className="mb-12 max-w-[640px]">
          {/* Remix pill — appears when /vibes?remix=<id> prefilled the form from a public trip */}
          {remixSource && (
            <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-drift-gold/30 bg-drift-gold/[0.06] pl-3 pr-2 py-1.5 text-[10px] text-drift-gold">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>Remixing <span className="font-medium">{remixSource.destination}</span>{remixSource.country ? `, ${remixSource.country}` : ''}</span>
              <button
                onClick={() => { clearRemixSource(); router.replace('/vibes') }}
                className="ml-1 h-5 w-5 flex items-center justify-center rounded-full hover:bg-drift-gold/10 transition-colors"
                aria-label="Clear remix source"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-6 bg-drift-gold/60" />
            <span className="text-[9px] font-semibold tracking-[3px] uppercase text-drift-gold/80">
              {preselectedDest ? 'Step 1 of 2 · Pick the mood' : 'Step 1 of 3'}
            </span>
          </div>
          <h1 className="font-serif text-[clamp(32px,4.2vw,52px)] font-light leading-[1.05] mb-3">
            {preselectedDest
              ? <>What&apos;s your <em className="italic text-drift-gold">{preselectedDest.city}</em> vibe?</>
              : <>What&apos;s your <em className="italic text-drift-gold">vibe</em>?</>
            }
          </h1>
          <p className="text-[14px] text-drift-text2 leading-relaxed">
            {remixSource
              ? `We've prefilled the vibes, travelers, and budget from ${remixSource.destination}. Tweak anything — or just pick dates and go.`
              : 'Pick up to five. Drift composes the trip around your energy — not boring filters.'}
          </p>

          {/* Paste a link toggle */}
          {!preselectedDest && !urlExtracted && (
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="mt-4 flex items-center gap-2 text-[11px] text-drift-text3 hover:text-drift-gold transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Or paste a YouTube / Instagram / TikTok link
            </button>
          )}
        </div>

        {/* URL extraction input */}
        {showUrlInput && !urlExtracted && (
          <div className="mb-10 max-w-[640px] animate-[fadeUp_0.3s_ease]">
            <div className="flex gap-2">
              <input
                value={urlValue}
                onChange={e => { setUrlValue(e.target.value); setUrlError('') }}
                onKeyDown={e => e.key === 'Enter' && handleUrlExtract()}
                placeholder="https://youtube.com/watch?v=... or instagram.com/reel/..."
                className="flex-1 rounded-xl border border-drift-border bg-white/[0.02] px-4 py-3 text-[13px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
              />
              <button
                onClick={handleUrlExtract}
                disabled={!urlValue.trim() || urlExtracting}
                className="shrink-0 rounded-xl bg-drift-gold px-5 py-3 text-[10px] font-bold uppercase tracking-[2px] text-drift-bg transition-all hover:-translate-y-0.5 disabled:opacity-40"
              >
                {urlExtracting ? 'Extracting…' : 'Extract'}
              </button>
            </div>
            {urlError && (
              <div className="mt-2 text-[11px] text-drift-err">{urlError}</div>
            )}
            <div className="mt-2 flex gap-2 flex-wrap">
              {['YouTube', 'Instagram Reels', 'TikTok', 'Travel blogs'].map(s => (
                <span key={s} className="rounded-md bg-white/[0.03] border border-white/[0.05] px-2 py-1 text-[9px] text-drift-text3">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* URL extraction result banner */}
        {urlExtracted && (
          <div className="mb-10 max-w-[640px] rounded-2xl border border-drift-gold/20 bg-drift-gold/[0.04] p-6 animate-[fadeUp_0.4s_ease]">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-gold/70 mb-1">Extracted from link</div>
                <div className="font-serif text-[22px] font-light text-drift-text">
                  {urlExtracted.primaryDestination}
                  {urlExtracted.country && <span className="text-drift-text3 italic"> · {urlExtracted.country}</span>}
                </div>
              </div>
              <button
                onClick={() => { setUrlExtracted(null); setDestination(null); setSelected([]); setShowUrlInput(true) }}
                className="shrink-0 text-drift-text3 hover:text-drift-text transition-colors text-sm"
              >×</button>
            </div>
            <p className="text-[12px] text-drift-text2 leading-relaxed mb-3">{urlExtracted.summary}</p>
            <div className="flex items-center gap-4 text-[10px] text-drift-text3">
              <span>{urlExtracted.highlights.length} places extracted</span>
              <span className="text-white/15">·</span>
              <span>{urlExtracted.suggestedDays} days suggested</span>
              <span className="text-white/15">·</span>
              <span className="capitalize">{urlExtracted.budgetHint} budget</span>
            </div>
          </div>
        )}

        {/* ═══ Vibe Gallery ═══ */}
        <div className="grid grid-cols-5 gap-3 mb-14 max-lg:grid-cols-3 max-md:grid-cols-2">
          {VIBES.map((v, i) => {
            const isSelected = selected.includes(v.id)
            const selectionOrder = isSelected ? selected.indexOf(v.id) + 1 : 0
            const isDimmed = selected.length >= MAX_VIBES && !isSelected
            const isPulsing = pulseId === v.id

            return (
              <button
                key={v.id}
                onClick={() => toggleVibe(v.id)}
                onMouseEnter={() => setHoveredVibe(v.id)}
                onMouseLeave={() => setHoveredVibe(null)}
                disabled={isDimmed}
                style={{ animationDelay: `${i * 35}ms` }}
                className={`group relative aspect-[4/5] overflow-hidden rounded-xl text-left opacity-0 animate-[fadeUp_0.5s_ease_forwards] transition-all duration-400 ease-out active:scale-[0.97] ${
                  isSelected
                    ? 'ring-1 ring-drift-gold shadow-[0_16px_48px_rgba(200,164,78,0.18)] -translate-y-1'
                    : isDimmed
                    ? 'opacity-25 cursor-not-allowed'
                    : 'ring-1 ring-white/[0.04] hover:ring-white/15 hover:-translate-y-1'
                }`}
              >
                {/* Pulse ring on click */}
                {isPulsing && (
                  <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-drift-gold/60 animate-[vibePulse_0.6s_ease-out]" />
                )}

                {/* Image */}
                <div className="absolute inset-0">
                  <Image
                    src={v.img}
                    alt={v.name}
                    fill
                    className={`object-cover transition-transform duration-700 ease-out ${
                      isSelected ? 'scale-110' : 'group-hover:scale-105'
                    }`}
                    sizes="240px"
                    unoptimized
                  />
                </div>

                {/* Gradient overlay */}
                <div className={`absolute inset-0 transition-all duration-500 ${
                  isSelected
                    ? 'bg-gradient-to-t from-drift-bg/95 via-drift-bg/40 to-drift-gold/10'
                    : 'bg-gradient-to-t from-drift-bg/90 via-drift-bg/20 to-transparent'
                }`} />

                {/* Selection order — minimal dot */}
                {isSelected && (
                  <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-drift-gold shadow-[0_2px_12px_rgba(200,164,78,0.5)] animate-[fadeIn_0.25s_ease]">
                    <span className="text-[10px] font-bold text-drift-bg">{selectionOrder}</span>
                  </div>
                )}

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                  <div className={`text-[13px] font-semibold leading-tight mb-0.5 transition-colors ${
                    isSelected ? 'text-drift-gold' : 'text-white'
                  }`}>
                    {v.name}
                  </div>
                  <div className="text-[10px] text-white/55 leading-snug">
                    {v.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ═══ Trip Details — fade in once at least 1 vibe selected ═══ */}
        <div className={`transition-all duration-700 ease-out ${
          selected.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-25 translate-y-3 pointer-events-none'
        }`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px w-6 bg-drift-gold/60" />
            <span className="text-[9px] font-semibold tracking-[3px] uppercase text-drift-gold/80">The basics</span>
          </div>

          <div className="rounded-2xl border border-drift-border bg-drift-card/40 backdrop-blur-xl p-7">
            <div className="grid grid-cols-12 gap-5">

              {/* Origin */}
              <div className="col-span-12 lg:col-span-4">
                <label className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2 block">Flying from</label>
                <CityAutocomplete value={origin} onChange={setOriginLocal} className="rounded-lg" />
              </div>

              {/* Dates */}
              <div className="col-span-12 lg:col-span-5">
                <label className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2 block">
                  Dates {datesInvalid
                    ? <span className="text-drift-err normal-case tracking-normal">· Return must be after departure</span>
                    : duration && <span className="text-drift-gold/70 normal-case tracking-normal">· {duration} {duration === 1 ? 'day' : 'days'}</span>
                  }
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-drift-border bg-white/[0.02] px-3.5 py-2.5 focus-within:border-drift-gold/30 transition-colors">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-transparent text-[13px] text-drift-text focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                  <span className="text-drift-text3 text-[10px]">→</span>
                  <div className="flex-1 rounded-lg border border-drift-border bg-white/[0.02] px-3.5 py-2.5 focus-within:border-drift-gold/30 transition-colors">
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-transparent text-[13px] text-drift-text focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Travelers */}
              <div className="col-span-12 lg:col-span-3">
                <label className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2 block">Travelers</label>
                <div className="flex items-center justify-between rounded-lg border border-drift-border bg-white/[0.02] px-2 py-1.5">
                  <button
                    onClick={() => setTravelersLocal(Math.max(1, travelers - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded text-drift-text2 hover:bg-drift-gold/10 hover:text-drift-gold transition-colors text-base"
                  >−</button>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[15px] font-semibold text-drift-text">{travelers}</span>
                    <span className="text-[9px] text-drift-text3 uppercase tracking-wider">{travelers === 1 ? 'guest' : 'guests'}</span>
                  </div>
                  <button
                    onClick={() => setTravelersLocal(Math.min(12, travelers + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded text-drift-text2 hover:bg-drift-gold/10 hover:text-drift-gold transition-colors text-base"
                  >+</button>
                </div>
              </div>

              {/* Budget tier — local currency */}
              <div className="col-span-12">
                <label className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2.5 block">
                  Budget per person <span className="text-drift-text3/60 normal-case tracking-normal">· shown in {currency}</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {BUDGETS.map(b => {
                    const isActive = budget === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBudgetLocal(b.id)}
                        className={`relative rounded-lg border px-4 py-3 text-left transition-all duration-300 ${
                          isActive
                            ? 'border-drift-gold/60 bg-drift-gold/[0.06] shadow-[0_0_20px_rgba(200,164,78,0.1)]'
                            : 'border-drift-border bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.035]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className={`text-[12px] font-semibold ${isActive ? 'text-drift-gold' : 'text-drift-text'}`}>{b.label}</div>
                          <div className={`text-[13px] font-medium tabular-nums ${isActive ? 'text-drift-gold' : 'text-drift-text2'}`}>
                            {fmt(b.amount)}
                          </div>
                        </div>
                        <div className="text-[10px] text-drift-text3 mt-1">{b.hint}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Sticky Bottom Summary Bar ═══ */}
      <div className={`fixed bottom-0 left-0 right-0 z-30 border-t border-drift-border bg-drift-bg/92 backdrop-blur-2xl transition-transform duration-500 ease-out ${
        canContinue ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="mx-auto max-w-[1180px] flex items-center justify-between gap-6 px-8 py-4">

          {/* Left: progress dots + selected vibes */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              {Array.from({ length: MAX_VIBES }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-400 ${
                  i < selected.length ? 'w-4 bg-drift-gold' : 'w-1.5 bg-white/12'
                }`} />
              ))}
            </div>

            {/* Selected vibes as text */}
            <div className="flex items-center gap-1.5 min-w-0 text-[12px]">
              {selected.map((id, i) => {
                const v = VIBES.find(x => x.id === id)
                return v ? (
                  <span key={id} className="text-drift-text whitespace-nowrap">
                    {v.name}{i < selected.length - 1 && <span className="text-drift-text3 mx-1.5">·</span>}
                  </span>
                ) : null
              })}
              {canContinue && origin.trim() && (
                <>
                  <span className="text-drift-text3 mx-2">|</span>
                  <span className="text-drift-text2 whitespace-nowrap">
                    {origin} · {duration}d · {travelers} {travelers === 1 ? 'guest' : 'guests'} · {fmt(BUDGETS.find(b => b.id === budget)!.amount)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleContinue}
            disabled={!canContinue || navigating}
            className={`shrink-0 group flex items-center gap-2.5 rounded-full px-7 py-3 text-[11px] font-semibold tracking-[1.5px] uppercase transition-all duration-300 ${
              canContinue && !navigating
                ? 'bg-drift-gold text-drift-bg shadow-[0_8px_28px_rgba(200,164,78,0.25)] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(200,164,78,0.35)]'
                : 'bg-drift-gold/20 text-drift-text3 cursor-not-allowed'
            }`}
          >
            {navigating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <>
                {preselectedDest ? `Compose ${preselectedDest.city} trip` : 'Find destinations'}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auth gate modal — only shows for preselected destination flow */}
      {showAuthGate && (
        <>
          <div className="fixed inset-0 z-[240] bg-black/75 backdrop-blur-lg animate-[fadeIn_0.3s_ease]" onClick={() => !authLoading && setShowAuthGate(false)} />
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-8 pointer-events-none">
            <div className="relative w-full max-w-[420px] rounded-3xl border border-white/[0.06] bg-[#0c0c12] p-10 shadow-[0_60px_140px_rgba(0,0,0,0.85)] pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">
              <button
                onClick={() => setShowAuthGate(false)}
                disabled={authLoading}
                className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-drift-text3 hover:bg-white/[0.06] transition-colors disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="font-serif text-[28px] font-light text-drift-text mb-2">
                Save your trip with <em className="italic text-drift-gold">Google</em>
              </div>
              <p className="text-[13px] text-drift-text3 leading-relaxed mb-8">
                Sign in so your {preselectedDest?.city} trip is saved across devices. Takes 2 seconds.
              </p>

              <button
                onClick={handleGoogleAuth}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 rounded-full bg-white py-3.5 text-[13px] font-semibold text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60"
              >
                {authLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-[10px] text-drift-text3">
                We need an account to save your trip
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
