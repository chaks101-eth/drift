'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import { useTripStore } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

const quickCities = ['Delhi', 'Mumbai', 'Bangalore', 'London', 'New York', 'Dubai']

export default function OriginPage() {
  const router = useRouter()
  const { onboarding, setOrigin, token } = useTripStore()
  const [value, setValue] = useState(onboarding.origin)
  const [selectedChip, setSelectedChip] = useState<string | null>(onboarding.origin || null)
  const [isValidCity, setIsValidCity] = useState(!!onboarding.origin)
  const [suggestions, setSuggestions] = useState<Array<{ city: string; country: string; description: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync local state when store hydrates from sessionStorage
  useEffect(() => {
    if (onboarding.origin && !value) {
      setValue(onboarding.origin)
      setIsValidCity(true)
      // Check if it's a quick chip
      if (quickCities.includes(onboarding.origin)) setSelectedChip(onboarding.origin)
    }
  }, [onboarding.origin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [token])

  const handleChip = (city: string) => {
    setValue(city)
    setSelectedChip(city)
    setIsValidCity(true)
    setOrigin(city)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleInput = (v: string) => {
    setValue(v)
    setSelectedChip(null)
    setIsValidCity(false)
    setOrigin(v)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(v)}`)
          const data = await res.json()
          setSuggestions(data.predictions || [])
          setShowSuggestions(true)
        } catch { setSuggestions([]) }
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionSelect = (s: { city: string; country: string }) => {
    setValue(s.city)
    setSelectedChip(null)
    setIsValidCity(true)
    setOrigin(s.city)
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.blur() // dismiss keyboard
  }

  const isReady = value.trim().length > 1 && isValidCity

  if (!token) return null // wait for anonymous session

  return (
    <div className="flex h-full flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <StepHeader step={1} totalSteps={5} backHref="/m" />

      <h1 className="mb-2 font-serif text-4xl font-light leading-tight">
        Where are you<br />
        <em className="font-normal italic text-drift-gold">flying</em> from?
      </h1>
      <p className="mb-7 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">Your home city</p>

      {/* Input with autocomplete */}
      <div className="relative mb-7">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), 200) }}
          onKeyDown={(e) => e.key === 'Enter' && isReady && router.push('/m/plan/dates')}
          placeholder="Delhi"
          className="w-full border-b border-drift-border2 bg-transparent pb-3 text-2xl font-light text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-drift-border2 bg-drift-card shadow-xl">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionSelect(s)}
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

        {/* Hint when typing but not selected */}
        {value.length > 2 && !isValidCity && !showSuggestions && (
          <p className="mt-1 text-[10px] text-drift-warn">Pick a city from the suggestions for accurate flights</p>
        )}
      </div>

      {/* Quick chips */}
      <div className="mb-8 flex flex-wrap gap-2">
        {quickCities.map((city) => (
          <button
            key={city}
            onClick={() => handleChip(city)}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
              selectedChip === city
                ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton ready={isReady} onClick={() => router.push('/m/plan/dates')}>
          Continue
        </GoldButton>
        {/* Reel shortcut */}
        <button
          onClick={() => {
            trackEvent('plan_reel_shortcut', 'funnel')
            router.push('/m/plan/url')
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-drift-gold/20 bg-drift-gold/5 py-3 text-[12px] font-semibold text-drift-gold transition-all active:scale-[0.98]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
          </svg>
          Got a reel? Plan using it
        </button>
      </div>
    </div>
  )
}
