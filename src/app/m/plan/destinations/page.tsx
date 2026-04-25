'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/mobile/BackButton'
import { useTripStore, type Destination } from '@/stores/trip-store'
import { supabase, ensureAnonSession } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

function DestCard({ dest, isSelected, onSelect, rank }: {
  dest: Destination; isSelected: boolean; onSelect: () => void; rank: number
}) {
  const matchVal = dest.match || 85
  return (
    <div
      data-dest-card
      onClick={onSelect}
      className={`relative flex flex-shrink-0 cursor-pointer snap-center flex-col overflow-hidden rounded-[20px] transition-all duration-300 active:scale-[0.98] ${
        isSelected
          ? 'border-2 border-drift-gold shadow-[0_0_0_1px_rgba(200,164,78,0.3),0_12px_40px_rgba(200,164,78,0.15)]'
          : 'border-2 border-transparent'
      }`}
      style={{ flex: '0 0 78%', maxWidth: 310, height: 320 }}
    >
      <div className="relative flex-1 overflow-hidden">
        <Image
          src={dest.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=90'}
          alt={dest.city}
          fill
          className="object-cover"
          sizes="78vw"
          unoptimized={!dest.image_url?.includes('unsplash.com') && !dest.image_url?.includes('googleusercontent.com')}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.95)] via-[rgba(8,8,12,0.55)_40%] via-[rgba(8,8,12,0.08)_60%] to-transparent" />
      </div>
      {/* Match badge */}
      <span className="absolute left-3 top-3 z-[3] flex items-center gap-1 rounded-[10px] border border-drift-gold/25 bg-drift-gold/15 px-2.5 py-1 text-[10px] font-bold text-drift-gold backdrop-blur-xl">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
        {matchVal}% vibe match
      </span>
      <div
        className={`absolute right-3 top-3 z-[3] flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300 ${
          isSelected
            ? 'border-drift-gold bg-drift-gold shadow-[0_4px_16px_rgba(200,164,78,0.35)]'
            : 'border-white/25 bg-transparent'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080810" strokeWidth="3"
          className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-[3] px-4 pb-4">
        <div className="font-serif text-[24px] font-normal leading-tight tracking-tight text-drift-text drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          {dest.city}
        </div>
        <div className="mb-1.5 text-[11px] tracking-wide text-drift-text/55">{dest.country || ''}</div>
        {dest.tagline && (
          <div className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed text-drift-text/70">
            {dest.tagline}
          </div>
        )}
        {dest.vibes && dest.vibes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dest.vibes.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.07] px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-lg">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DestinationsPage() {
  const router = useRouter()
  const {
    token,
    onboarding,
    setDestination,
    isAnonymous,
    userEmail,
  } = useTripStore()

  const { origin, startDate, endDate, budgetLevel, budgetAmount, travelers, pickedVibes, occasion } = onboarding

  const [destinations, setDestinations] = useState<Destination[]>([])
  const [originCountry, setOriginCountry] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [customDest, setCustomDest] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ city: string; country: string; description: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // First write moment — entering destinations means user committed to suggestions. Create anon session if none.
  useEffect(() => { ensureAnonSession() }, [])

  // Fetch destinations on mount
  useEffect(() => {
    const cacheKey = `drift-dests-${(origin || 'Delhi').toLowerCase()}-${pickedVibes.sort().join(',')}-${budgetLevel}-${startDate}-${travelers}`

    async function fetchDestinations() {
      try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const { destinations: dests, originCountry: oc } = JSON.parse(cached)
          if (dests?.length) {
            setDestinations(dests)
            if (oc) setOriginCountry(oc)
            setLoading(false)
            return
          }
        }
      } catch { /* cache miss */ }

      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: 'destinations',
            vibes: pickedVibes,
            budget: budgetLevel,
            budgetAmount: budgetAmount,
            origin: origin || 'Delhi',
            start_date: startDate,
            end_date: endDate,
            travelers: travelers,
          }),
        })

        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = await res.json()
        const dests: Destination[] = data.destinations || []
        if (data.originCountry) setOriginCountry(data.originCountry)

        if (dests.length === 0) {
          setError('No destinations found for your vibes. Try different vibes or check back soon.')
        } else {
          setDestinations(dests)
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ destinations: dests, originCountry: data.originCountry })) } catch { /* quota */ }
        }
      } catch {
        setError('Couldn\u2019t load destinations.')
      } finally {
        setLoading(false)
      }
    }

    fetchDestinations()
  }, [token, pickedVibes, budgetLevel, origin])

  const handleSelect = (dest: Destination) => {
    setSelectedDest(dest)
    setDestination(dest)
    trackEvent('destination_selected', 'onboarding', dest.city)
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    setDestinations([])
    ;(async () => {
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: 'destinations',
            vibes: pickedVibes,
            budget: budgetLevel,
            budgetAmount: budgetAmount,
            origin: origin || 'Delhi',
            start_date: startDate,
            end_date: endDate,
            travelers: travelers,
          }),
        })
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const data = await res.json()
        const dests: Destination[] = data.destinations || []
        if (dests.length === 0) {
          setError('No destinations found for your vibes. Try different vibes or check back soon.')
        } else {
          setDestinations(dests)
        }
      } catch {
        setError('Couldn\u2019t load destinations.')
      } finally {
        setLoading(false)
      }
    })()
  }

  const countryMap: Record<string, string> = {
    bali: 'Indonesia', bangkok: 'Thailand', dubai: 'UAE', paris: 'France', tokyo: 'Japan',
    istanbul: 'Turkey', phuket: 'Thailand', singapore: 'Singapore', maldives: 'Maldives',
    goa: 'India', london: 'UK', rome: 'Italy', santorini: 'Greece', 'new york': 'USA',
    barcelona: 'Spain', lisbon: 'Portugal', amsterdam: 'Netherlands', prague: 'Czech Republic',
    vienna: 'Austria', berlin: 'Germany', seoul: 'South Korea', sydney: 'Australia',
    'cape town': 'South Africa', marrakech: 'Morocco', cairo: 'Egypt', jaipur: 'India',
    manali: 'India', delhi: 'India', mumbai: 'India', colombo: 'Sri Lanka', hanoi: 'Vietnam',
    'chiang mai': 'Thailand', krabi: 'Thailand', pattaya: 'Thailand', uluwatu: 'Indonesia',
  }

  // Handle generate — auth gate if anonymous
  const handleGenerate = () => {
    // Validate custom destination
    if (customDest.trim().length > 1) {
      const city = customDest.trim()
      const country = customCountry || countryMap[city.toLowerCase()] || ''
      if (!country) {
        showToast('Pick a city from suggestions for best results')
        return // GAP-03 fix: block navigation when country is empty
      }
      setDestination({ city, country, tagline: `Your ${city} adventure`, match: 100, vibes: pickedVibes })
      trackEvent('destination_custom', 'funnel', city)
    } else if (!selectedDest) {
      return
    }

    // Auth gate: if user is anonymous, show auth prompt instead of generating
    if (isAnonymous) {
      setShowAuthGate(true)
      return
    }

    // Authenticated — go to loading
    proceedToGenerate()
  }

  const proceedToGenerate = () => {
    setGenerating(true)
    router.push('/m/loading')
  }

  // Google sign-in from auth gate
  const handleGoogleAuth = async () => {
    setAuthLoading(true)
    try {
      // Store return path so callback redirects back here
      sessionStorage.setItem('drift-login-return', '/m/plan/destinations')
      sessionStorage.setItem('drift-post-auth-action', 'generate')

      const { error: err } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (err) {
        console.warn('[Destinations] linkIdentity failed, trying OAuth:', err.message)
        const { error: err2 } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/api/auth/callback` },
        })
        if (err2) {
          showToast('Sign-in failed. Please try again.')
          setAuthLoading(false)
        }
      }
    } catch {
      showToast('Sign-in failed. Please try again.')
      setAuthLoading(false)
    }
  }

  // If user returns from OAuth already authenticated, auto-proceed
  useEffect(() => {
    if (!isAnonymous && userEmail) {
      const postAction = typeof window !== 'undefined' ? sessionStorage.getItem('drift-post-auth-action') : null
      if (postAction === 'generate') {
        sessionStorage.removeItem('drift-post-auth-action')
        proceedToGenerate()
      }
    }
  }, [isAnonymous, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasCustom = customDest.trim().length > 1
  const canConfirm = hasCustom || selectedDest !== null

  const domesticDests = destinations.filter(d => d.isDomestic)
  const internationalDests = destinations.filter(d => !d.isDomestic)

  // ensureAnonSession() on mount kicks off session creation. Page still renders during that
  // round-trip; the destinations fetch has its own `!token` guard and retries when token arrives.
  return (
    <div className="flex h-full flex-col overflow-hidden animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="mb-3 flex items-center justify-between">
          <BackButton href="/m/plan/details" />
        </div>
        <h1 className="mb-1 font-serif text-3xl font-light text-drift-text">
          Pick your <em className="font-normal italic text-drift-gold">destination</em>
        </h1>
        <p className="mb-3 text-xs text-drift-text3">Based on your vibes, or type your own</p>

        {/* Search */}
        <div className="relative mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5" className="absolute left-3 top-[13px] z-10">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={customDest}
            onChange={(e) => {
              const val = e.target.value
              setCustomDest(val)
              setCustomCountry('')
              if (val) setSelectedDest(null)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              if (val.length >= 2) {
                debounceRef.current = setTimeout(async () => {
                  try {
                    const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(val)}`)
                    const data = await res.json()
                    setSuggestions(data.predictions || [])
                    setShowSuggestions(true)
                  } catch { setSuggestions([]) }
                }, 300)
              } else {
                setSuggestions([])
                setShowSuggestions(false)
              }
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200) }}
            placeholder="Or search a destination..."
            className="w-full rounded-xl border border-drift-border2 bg-drift-surface py-2.5 pl-9 pr-9 text-sm text-drift-text placeholder:text-drift-text3/50 focus:border-drift-gold/30 focus:outline-none transition-colors"
          />
          {customDest && (
            <button onClick={() => { setCustomDest(''); setCustomCountry(''); setSuggestions([]); setShowSuggestions(false) }} className="absolute right-3 top-[13px] text-drift-text3 z-10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-drift-border2 bg-drift-card shadow-xl">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCustomDest(s.city)
                    setCustomCountry(s.country)
                    setSuggestions([])
                    setShowSuggestions(false)
                    setSelectedDest(null)
                    ;(document.activeElement as HTMLElement)?.blur()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-drift-surface2 active:bg-drift-surface2 border-b border-drift-border2 last:border-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-drift-text">{s.city}</div>
                    <div className="truncate text-[10px] text-drift-text3">{s.country}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {loading && (
          <div className="flex-1 px-6 pt-2">
            <div className="mb-3 text-[11px] text-drift-text3 animate-pulse">Matching destinations to your vibes...</div>
            <div className="flex gap-3 overflow-hidden">
              {[0, 1].map((i) => (
                <div key={i} className="flex-shrink-0 rounded-[20px] border-2 border-drift-border2 overflow-hidden animate-pulse" style={{ width: '78%', maxWidth: 310, height: 320 }}>
                  <div className="h-[65%] bg-drift-surface2" />
                  <div className="p-4 space-y-3">
                    <div className="h-6 w-3/4 rounded-lg bg-drift-surface2" />
                    <div className="h-3 w-1/2 rounded bg-drift-surface2" />
                    <div className="flex gap-1.5">
                      <div className="h-5 w-14 rounded-full bg-drift-surface2" />
                      <div className="h-5 w-14 rounded-full bg-drift-surface2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <p className="text-center text-[13px] text-drift-text2">{error}</p>
            <div className="flex gap-3">
              <button onClick={handleRetry} className="rounded-xl border border-drift-gold/15 bg-drift-gold-bg px-5 py-2.5 text-[11px] font-semibold text-drift-gold">
                Try Again
              </button>
              <button onClick={() => router.push('/m/plan/vibes')} className="rounded-xl border border-drift-border2 px-5 py-2.5 text-[11px] font-semibold text-drift-text3">
                Change Vibes
              </button>
            </div>
          </div>
        )}

        {!loading && !error && destinations.length > 0 && (
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {domesticDests.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 px-6">
                  <h2 className="font-serif text-lg text-drift-text">
                    Explore <em className="italic text-drift-gold">{originCountry || 'nearby'}</em>
                  </h2>
                </div>
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 scrollbar-none pb-2" style={{ scrollSnapType: 'x mandatory' }}>
                  {domesticDests.map((dest, idx) => (
                    <DestCard key={`d-${dest.city}-${idx}`} dest={dest} isSelected={selectedDest?.city === dest.city && selectedDest?.country === dest.country} onSelect={() => handleSelect(dest)} rank={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {internationalDests.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 px-6">
                  <h2 className="font-serif text-lg text-drift-text">
                    Go <em className="italic text-drift-gold">international</em>
                  </h2>
                </div>
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 scrollbar-none pb-2" style={{ scrollSnapType: 'x mandatory' }}>
                  {internationalDests.map((dest, idx) => (
                    <DestCard key={`i-${dest.city}-${idx}`} dest={dest} isSelected={selectedDest?.city === dest.city && selectedDest?.country === dest.country} onSelect={() => handleSelect(dest)} rank={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {domesticDests.length === 0 && internationalDests.length === 0 && destinations.length > 0 && (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 scrollbar-none pb-2" style={{ scrollSnapType: 'x mandatory' }}>
                {destinations.map((dest, idx) => (
                  <DestCard key={`a-${dest.city}-${idx}`} dest={dest} isSelected={selectedDest?.city === dest.city && selectedDest?.country === dest.country} onSelect={() => handleSelect(dest)} rank={idx + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm bar */}
      <div className="shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <button
          onClick={handleGenerate}
          disabled={!canConfirm || generating}
          className={`flex w-full items-center justify-center gap-2 rounded-[14px] px-6 py-4 text-xs font-extrabold uppercase tracking-widest transition-all duration-300 active:scale-[0.97] ${
            canConfirm && !generating
              ? 'bg-drift-gold text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)]'
              : 'bg-drift-card text-drift-text3 cursor-not-allowed'
          }`}
        >
          {generating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-drift-bg/30 border-t-drift-bg" />
              Building your trip...
            </>
          ) : hasCustom ? (
            <>
              Plan {customDest.trim()}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          ) : (
            <>
              Generate my trip
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* ── Auth Gate Overlay ── */}
      {showAuthGate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
          onClick={() => setShowAuthGate(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-t-3xl bg-drift-bg px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 animate-[slideUp_0.3s_var(--ease-smooth)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-drift-border2" />

            <h2 className="mb-1.5 font-serif text-[22px] font-light text-drift-text leading-tight">
              Your trip is <em className="font-normal italic text-drift-gold">ready</em>
            </h2>
            <p className="mb-5 text-[12px] leading-relaxed text-drift-text3">
              Sign in to keep it saved and come back anytime.
            </p>

            {/* Google button */}
            <button
              onClick={handleGoogleAuth}
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-3 rounded-[14px] bg-white py-4 text-sm font-semibold text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-all duration-200 active:scale-[0.97]"
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

            {/* Fine print */}
            <p className="mt-3 text-center text-[10px] text-drift-text3">
              Takes 2 seconds. We never post to your account.
            </p>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+16px)] z-50 animate-[fadeUp_0.3s_var(--ease-smooth)] rounded-xl border border-red-500/30 bg-drift-card px-4 py-3 shadow-xl">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span className="text-xs text-drift-text">{toast}</span>
          </div>
        </div>
      )}
    </div>
  )
}
