'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/NavBar'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import { useTripStore } from '@/stores/trip-store'
import { detectCurrencyFromOrigin, formatPrice } from '@/lib/currency'

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

export default function VibesPage() {
  return (
    <DesktopAuthProvider>
      <VibesContent />
    </DesktopAuthProvider>
  )
}

function VibesContent() {
  const router = useRouter()
  const { setVibes, setOrigin, setDates, setBudget, setTravelers, setDestination, onboarding } = useTripStore()
  const preselectedDest = onboarding.destination

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

  function toggleVibe(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : prev.length < 3 ? [...prev, id] : prev)
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

  const canContinue = selected.length > 0
  const detailsComplete = canContinue && origin.trim().length > 0 && startDate && endDate

  function handleContinue() {
    if (!canContinue || navigating) return
    setNavigating(true)

    setVibes(selected)
    if (origin) setOrigin(origin)
    if (startDate && endDate) setDates(startDate, endDate)
    const budgetDef = BUDGETS.find(b => b.id === budget)
    setBudget(budget, budgetDef?.amount || 3000)
    setTravelers(travelers)

    // If destination was preselected from the orbital landing, update its vibes
    // and skip the /destinations picker — go straight to generation
    if (preselectedDest) {
      setDestination({ ...preselectedDest, vibes: selected })
      router.push('/loading-trip')
    } else {
      router.push('/destinations')
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
            Pick up to three. Drift composes the trip around your energy — not boring filters.
          </p>
        </div>

        {/* ═══ Vibe Gallery ═══ */}
        <div className="grid grid-cols-5 gap-3 mb-14 max-lg:grid-cols-3 max-md:grid-cols-2">
          {VIBES.map((v, i) => {
            const isSelected = selected.includes(v.id)
            const selectionOrder = isSelected ? selected.indexOf(v.id) + 1 : 0
            const isDimmed = selected.length >= 3 && !isSelected
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

        {/* ═══ Trip Details — fade in once vibes selected ═══ */}
        <div className={`transition-all duration-700 ease-out ${
          canContinue ? 'opacity-100 translate-y-0' : 'opacity-25 translate-y-3 pointer-events-none'
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
                <div className="flex items-center gap-2 rounded-lg border border-drift-border bg-white/[0.02] px-3.5 py-2.5 focus-within:border-drift-gold/30 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <input
                    value={origin}
                    onChange={e => setOriginLocal(e.target.value)}
                    placeholder="Delhi, Mumbai, London…"
                    className="flex-1 bg-transparent text-[13px] text-drift-text placeholder:text-drift-text3 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="col-span-12 lg:col-span-5">
                <label className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2 block">
                  Dates {duration && <span className="text-drift-gold/70 normal-case tracking-normal">· {duration} {duration === 1 ? 'day' : 'days'}</span>}
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
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-400 ${
                  i < selected.length ? 'w-5 bg-drift-gold' : 'w-1.5 bg-white/12'
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
              {detailsComplete && (
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
    </div>
  )
}
