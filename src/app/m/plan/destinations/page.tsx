'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/mobile/BackButton'
import { useTripStore, type Destination } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

export default function DestinationsPage() {
  const router = useRouter()
  const {
    token,
    onboarding,
    setCurrentTrip,
    setCurrentItems,
    setDestination,
    formatBudget,
  } = useTripStore()

  const { origin, startDate, endDate, budgetLevel, budgetAmount, travelers, pickedVibes, occasion } = onboarding

  if (token === null) return null // wait for anonymous session

  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeDot, setActiveDot] = useState(0)
  const [customDest, setCustomDest] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ city: string; country: string; description: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Show toast with auto-dismiss
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Fetch destinations on mount
  useEffect(() => {
    async function fetchDestinations() {
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
            origin: origin || 'Delhi',
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
    }

    fetchDestinations()
  }, [token, pickedVibes, budgetLevel, origin])

  // Scroll-based dot tracking
  useEffect(() => {
    const el = scrollRef.current
    if (!el || destinations.length === 0) return

    const handleScroll = () => {
      const card = el.querySelector<HTMLElement>('[data-dest-card]')
      if (!card) return
      const cardW = card.offsetWidth + 14 // gap
      const idx = Math.round(el.scrollLeft / cardW)
      setActiveDot(Math.min(idx, destinations.length - 1))
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [destinations])

  // Select a destination
  const handleSelect = (idx: number) => {
    setSelectedIdx(idx)
    setDestination(destinations[idx])
    trackEvent('destination_selected', 'onboarding', destinations[idx].city)
  }

  // Retry fetch
  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Re-trigger effect by clearing destinations
    setDestinations([])
    // Refetch
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
            origin: origin || 'Delhi',
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

  // Country auto-detection
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

  // Navigate to loading screen which handles generation
  const handleGenerate = () => {
    if (customDest.trim().length > 1) {
      // User selected from autocomplete or typed a destination
      const city = customDest.trim()
      const country = customCountry || countryMap[city.toLowerCase()] || ''
      setDestination({ city, country, tagline: `Your ${city} adventure`, match: 100, vibes: pickedVibes })
      trackEvent('destination_custom', 'funnel', city)
      setGenerating(true)
      router.push('/m/loading')
      return
    }
    if (selectedIdx === null) return
    const dest = destinations[selectedIdx]
    setDestination(dest)
    setGenerating(true)
    router.push('/m/loading')
  }

  const hasCustom = customDest.trim().length > 1
  const selectedDest = selectedIdx !== null ? destinations[selectedIdx] : null
  const canConfirm = hasCustom || selectedIdx !== null

  return (
    <div className="flex h-full flex-col overflow-hidden animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="mb-3 flex items-center justify-between">
          <BackButton href="/m/plan/vibes" />
          {/* Ask Drift button - placeholder */}
        </div>
        <h1 className="mb-1 font-serif text-3xl font-light text-drift-text">
          Pick your <em className="font-normal italic text-drift-gold">destination</em>
        </h1>
        <p className="mb-3 text-xs text-drift-text3">Based on your vibes, or type your own</p>

        {/* Inline destination search with Google Places autocomplete */}
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
              if (val) setSelectedIdx(null)
              // Fetch suggestions after 2+ chars with debounce
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

          {/* Autocomplete dropdown */}
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
                    setSelectedIdx(null)
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

      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
            <span className="text-[11px] text-drift-text3">Matching destinations to your vibes...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
            <p className="text-center text-[13px] text-drift-text2">{error}</p>
            <button
              onClick={handleRetry}
              className="rounded-xl border border-drift-gold/15 bg-drift-gold-bg px-5 py-2.5 text-[11px] font-semibold text-drift-gold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Destination cards carousel */}
        {!loading && !error && destinations.length > 0 && (
          <>
            <div
              ref={scrollRef}
              className="flex flex-1 snap-x snap-mandatory gap-3.5 overflow-x-auto px-6 scrollbar-none"
              style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
            >
              {destinations.map((dest, idx) => {
                const isSelected = selectedIdx === idx
                const matchVal = dest.match || 85
                const rankLabel = idx === 0 ? '#1 Top Pick' : `#${idx + 1} Match`

                return (
                  <div
                    key={`${dest.city}-${idx}`}
                    data-dest-card
                    onClick={() => handleSelect(idx)}
                    className={`relative flex flex-shrink-0 cursor-pointer snap-center flex-col overflow-hidden rounded-[20px] transition-all duration-300 active:scale-[0.98] ${
                      isSelected
                        ? 'border-2 border-drift-gold shadow-[0_0_0_1px_rgba(200,164,78,0.3),0_12px_40px_rgba(200,164,78,0.15)]'
                        : 'border-2 border-transparent'
                    }`}
                    style={{ flex: '0 0 82%', maxWidth: 340, minHeight: 0 }}
                  >
                    {/* Image */}
                    <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                      <Image
                        src={dest.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=90'}
                        alt={dest.city}
                        fill
                        className="object-cover"
                        sizes="82vw"
                        unoptimized={!dest.image_url?.includes('unsplash.com') && !dest.image_url?.includes('googleusercontent.com')}
                      />
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.95)] via-[rgba(8,8,12,0.55)_40%] via-[rgba(8,8,12,0.08)_60%] to-transparent" />
                    </div>

                    {/* Rank badge */}
                    <span className="absolute left-3.5 top-3.5 z-[3] rounded-[10px] border border-white/10 bg-[rgba(8,8,12,0.5)] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-drift-gold backdrop-blur-xl">
                      {rankLabel}
                    </span>

                    {/* Selection indicator */}
                    <div
                      className={`absolute right-3.5 top-3.5 z-[3] flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-drift-gold bg-drift-gold shadow-[0_4px_16px_rgba(200,164,78,0.35)]'
                          : 'border-white/25 bg-transparent'
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#080810"
                        strokeWidth="3"
                        className={`transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    {/* Card info */}
                    <div className="absolute inset-x-0 bottom-0 z-[3] px-5 pb-5">
                      <div className="font-serif text-[28px] font-normal leading-tight tracking-tight text-drift-text drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                        {dest.city}
                      </div>
                      <div className="mb-2 text-xs tracking-wide text-drift-text/55">
                        {dest.country || ''}
                      </div>
                      {dest.tagline && (
                        <div className="mb-3 line-clamp-2 text-[11.5px] leading-relaxed text-drift-text/70">
                          {dest.tagline}
                        </div>
                      )}
                      {dest.vibes && dest.vibes.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {dest.vibes.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-lg"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-light text-drift-gold drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
                          {dest.price_usd ? formatBudget(dest.price_usd) : dest.price || ''}
                          <span className="ml-1 text-[10px] font-normal text-drift-text/45">/ person</span>
                        </div>
                        <span className="rounded-xl border border-drift-gold/25 bg-drift-gold/15 px-2.5 py-1 text-[11px] font-semibold text-drift-gold">
                          {matchVal}% match
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Dots */}
            <div className="flex shrink-0 items-center justify-center gap-2 py-3">
              {destinations.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeDot ? 'w-4 bg-drift-gold' : 'w-1.5 bg-drift-border2'
                  }`}
                />
              ))}
            </div>
          </>
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
              Confirm Destination
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

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
