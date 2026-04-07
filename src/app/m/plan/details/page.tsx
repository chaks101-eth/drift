'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import { useTripStore } from '@/stores/trip-store'

// ─── Quick date helpers ────────────────────────────────────
function getQuickDates(type: string): { start: string; end: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (type === 'weekend') {
    const day = now.getDay()
    const fri = new Date(now)
    fri.setDate(now.getDate() + ((5 - day + 7) % 7 || 7))
    const sun = new Date(fri)
    sun.setDate(fri.getDate() + 2)
    return { start: fmt(fri), end: fmt(sun) }
  }
  if (type === 'nextweek') {
    const mon = new Date(now)
    mon.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    return { start: fmt(mon), end: fmt(fri) }
  }
  if (type === '2weeks') {
    const start = new Date(now)
    start.setDate(now.getDate() + 14)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }
  // month
  const start = new Date(now)
  start.setMonth(now.getMonth() + 1, 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: fmt(start), end: fmt(end) }
}

const quickDateOptions = [
  { label: 'This Weekend', key: 'weekend' },
  { label: 'Next Week', key: 'nextweek' },
  { label: 'In 2 Weeks', key: '2weeks' },
  { label: 'Next Month', key: 'month' },
]

const quickCities = ['Delhi', 'Mumbai', 'Bangalore', 'London', 'New York', 'Dubai']

const tiers = [
  { id: 'budget' as const, label: 'Budget', desc: 'Hostels & street food', defaultAmount: 1500 },
  { id: 'mid' as const, label: 'Comfort', desc: 'Hotels & dining out', defaultAmount: 3000 },
  { id: 'luxury' as const, label: 'Luxury', desc: '5-star & fine dining', defaultAmount: 7000 },
]

export default function DetailsPage() {
  const router = useRouter()
  const {
    onboarding,
    setOrigin,
    setDates,
    setBudget,
    setTravelers,
    formatBudget,
    token,
  } = useTripStore()

  // ─── Origin state ──────────────────────────────────────────
  const [origin, setOriginLocal] = useState(onboarding.origin)
  const [isValidCity, setIsValidCity] = useState(!!onboarding.origin)
  const [selectedChip, setSelectedChip] = useState<string | null>(onboarding.origin || null)
  const [suggestions, setSuggestions] = useState<Array<{ city: string; country: string; description: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ─── Dates state ───────────────────────────────────────────
  const defaultDates = onboarding.startDate ? null : getQuickDates('weekend')
  const [startDate, setStartDate] = useState(onboarding.startDate || defaultDates?.start || '')
  const [endDate, setEndDate] = useState(onboarding.endDate || defaultDates?.end || '')
  const [activeQuick, setActiveQuick] = useState<string | null>(onboarding.startDate ? null : 'weekend')
  const [dateError, setDateError] = useState('')

  // ─── Budget state ──────────────────────────────────────────
  const [level, setLevel] = useState(onboarding.budgetLevel)
  const [amount, setAmount] = useState(onboarding.budgetAmount)
  const [travelers, setTravelersLocal] = useState(onboarding.travelers)

  // Persist default dates to store on mount
  useEffect(() => {
    if (!onboarding.startDate && defaultDates) {
      setDates(defaultDates.start, defaultDates.end)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync from store when hydrating from sessionStorage
  useEffect(() => {
    if (onboarding.origin && !origin) {
      setOriginLocal(onboarding.origin)
      setIsValidCity(true)
      if (quickCities.includes(onboarding.origin)) setSelectedChip(onboarding.origin)
    }
  }, [onboarding.origin]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onboarding.startDate && !startDate) {
      setStartDate(onboarding.startDate)
      setEndDate(onboarding.endDate)
    }
  }, [onboarding.startDate, onboarding.endDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (onboarding.budgetAmount !== amount) setAmount(onboarding.budgetAmount)
    if (onboarding.budgetLevel !== level) setLevel(onboarding.budgetLevel)
    if (onboarding.travelers !== travelers) setTravelersLocal(onboarding.travelers)
  }, [onboarding.budgetAmount, onboarding.budgetLevel, onboarding.travelers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus origin input on mount
  useEffect(() => {
    if (!token) return
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [token])

  // ─── Origin handlers ──────────────────────────────────────
  const handleOriginInput = (v: string) => {
    setOriginLocal(v)
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

  const handleOriginChip = (city: string) => {
    setOriginLocal(city)
    setSelectedChip(city)
    setIsValidCity(true)
    setOrigin(city)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSuggestionSelect = (s: { city: string; country: string }) => {
    setOriginLocal(s.city)
    setSelectedChip(null)
    setIsValidCity(true)
    setOrigin(s.city)
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  // ─── Date handlers ─────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const handleStartChange = (v: string) => {
    setStartDate(v)
    setActiveQuick(null)
    if (endDate && v > endDate) {
      setEndDate(v)
      setDates(v, v)
      setDateError('End date adjusted to match')
    } else {
      setDates(v, endDate)
      setDateError('')
    }
  }

  const handleEndChange = (v: string) => {
    if (!startDate || v < startDate) {
      setDateError('Return must be after departure')
      return
    }
    setEndDate(v)
    setActiveQuick(null)
    setDates(startDate, v)
    setDateError('')
  }

  const handleQuick = (key: string) => {
    const { start, end } = getQuickDates(key)
    setStartDate(start)
    setEndDate(end)
    setActiveQuick(key)
    setDates(start, end)
    setDateError('')
  }

  // ─── Budget handlers ──────────────────────────────────────
  const handleTier = (tier: typeof tiers[number]) => {
    setLevel(tier.id)
    setAmount(tier.defaultAmount)
    setBudget(tier.id, tier.defaultAmount)
  }

  const handleSlider = (val: number) => {
    setAmount(val)
    const newLevel = val <= 2000 ? 'budget' : val <= 4500 ? 'mid' : 'luxury'
    setLevel(newLevel as 'budget' | 'mid' | 'luxury')
    setBudget(newLevel as 'budget' | 'mid' | 'luxury', val)
  }

  const adjustTravelers = (delta: number) => {
    const next = Math.max(1, Math.min(12, travelers + delta))
    setTravelersLocal(next)
    setTravelers(next)
  }

  // ─── Validation ────────────────────────────────────────────
  const originReady = origin.trim().length > 1 && isValidCity
  const datesReady = !!(startDate && endDate && endDate >= startDate)
  const isReady = originReady && datesReady

  const sliderPct = ((amount - 500) / (10000 - 500)) * 100

  if (token === null) {
    return (
      <div className="flex h-full items-center justify-center bg-drift-bg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Fixed header */}
      <div className="shrink-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)]">
        <StepHeader step={2} totalSteps={3} backHref="/m/plan/vibes" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-none">
        {/* ── SECTION 1: Origin ─── */}
        <h1 className="mb-1 font-serif text-[28px] font-light leading-tight">
          Your trip <em className="font-normal italic text-drift-gold">details</em>
        </h1>
        <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em] text-drift-text3">
          Where from, when, and how much
        </p>

        {/* Origin input */}
        <div className="mb-2">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
            Flying from
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={origin}
              onChange={(e) => handleOriginInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 200) }}
              placeholder="Your city"
              className="w-full rounded-[14px] border border-drift-border2 bg-drift-surface px-3.5 py-3 text-sm text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
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
          </div>
          {/* Hint */}
          {origin.length > 2 && !isValidCity && !showSuggestions && (
            <p className="mt-1 text-[10px] text-drift-text3">Pick a city from suggestions for accurate flights</p>
          )}
        </div>

        {/* Quick city chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {quickCities.map((city) => (
            <button
              key={city}
              onClick={() => handleOriginChip(city)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                selectedChip === city
                  ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                  : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* ── SECTION 2: Dates ─── */}
        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
          Travel dates
        </label>
        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full appearance-none rounded-[14px] border border-drift-border2 bg-drift-surface px-3.5 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none transition-colors [color-scheme:dark] min-h-[48px]"
            />
          </div>
          <div className="flex items-center text-drift-text3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </div>
          <div className="flex-1">
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => handleEndChange(e.target.value)}
              className="w-full appearance-none rounded-[14px] border border-drift-border2 bg-drift-surface px-3.5 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none transition-colors [color-scheme:dark] min-h-[48px]"
            />
          </div>
        </div>
        {dateError && <p className="mb-2 text-[10px] text-drift-err">{dateError}</p>}

        {/* Quick date chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {quickDateOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleQuick(opt.key)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                activeQuick === opt.key
                  ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                  : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── SECTION 3: Travelers + Budget ─── */}
        <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
          Travelers
        </label>
        <div className="mb-5 flex items-center gap-4">
          <button
            onClick={() => adjustTravelers(-1)}
            aria-label="Remove traveler"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-drift-border2 bg-drift-surface text-lg text-drift-text transition-all active:scale-95"
          >
            −
          </button>
          <div className="min-w-[40px] text-center">
            <div className="font-serif text-[32px] font-light leading-none text-drift-text" aria-live="polite">
              {travelers}
            </div>
          </div>
          <button
            onClick={() => adjustTravelers(1)}
            aria-label="Add traveler"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-drift-border2 bg-drift-surface text-lg text-drift-text transition-all active:scale-95"
          >
            +
          </button>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-drift-text3">
            {travelers === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* Budget tiers */}
        <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
          Budget per person
        </label>
        <div className="mb-4 flex gap-2">
          {tiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => handleTier(tier)}
              className={`flex-1 rounded-[14px] border p-3 text-center transition-all duration-300 ${
                level === tier.id
                  ? 'border-drift-gold/30 bg-drift-gold-bg'
                  : 'border-drift-border2 bg-drift-surface'
              }`}
            >
              <div className="text-[13px] font-bold">{tier.label}</div>
              <div className="text-[9px] leading-snug text-drift-text3">{tier.desc}</div>
            </button>
          ))}
        </div>

        {/* Fine-tune slider */}
        <div className="mb-4 rounded-2xl border border-drift-border2 bg-drift-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-drift-text3">
              Fine-tune
            </span>
            <span className="font-serif text-[24px] font-bold tracking-tight text-drift-gold">
              {formatBudget(amount)}
            </span>
          </div>
          <input
            type="range"
            min={500}
            max={10000}
            step={250}
            value={amount}
            onChange={(e) => handleSlider(Number(e.target.value))}
            className="w-full"
            style={{
              background: `linear-gradient(90deg, var(--color-drift-gold) ${sliderPct}%, var(--color-drift-border2) ${sliderPct}%)`,
            }}
          />
          <div className="mt-1 flex justify-between">
            <span className="text-[8px] text-drift-text3">{formatBudget(500)}</span>
            <span className="text-[8px] text-drift-text3">{formatBudget(10000)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-drift-border2 pt-2">
            <span className="text-[10px] text-drift-text3">Est. total for group</span>
            <span className="text-sm font-bold text-drift-text">{formatBudget(amount * travelers)}</span>
          </div>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="shrink-0 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton ready={isReady} onClick={() => router.push('/m/plan/destinations')}>
          Find destinations
        </GoldButton>
        {!originReady && origin.length > 0 && (
          <p className="mt-2 text-center text-[10px] text-drift-text3">
            Select your city from suggestions above
          </p>
        )}
      </div>
    </div>
  )
}
