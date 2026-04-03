'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import type { Trip, ItineraryItem, ItemMetadata } from '@/stores/trip-store'
import { parsePrice } from '@/lib/parse-price'
import FlightCard from '@/components/mobile/cards/FlightCard'
import ItemCard from '@/components/mobile/cards/ItemCard'
import { trackEvent } from '@/lib/analytics'

interface DayWeatherData {
  tempMax: number
  tempMin: number
  description: string
  rainProbability: number
  iconUri?: string
  isRainy: boolean
  isSunny: boolean
  uvIndex: number
}

interface Day {
  label: string
  detail: string
  items: ItineraryItem[]
  insight?: string
  mapUrl?: string
  weather?: DayWeatherData
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getFallbackBrief(vibes: string[]): string {
  if (vibes.includes('romance')) return 'Built for two. I prioritized intimate spots over crowded landmarks — sunset-facing restaurants, rooms with a view, and enough free time to get lost together.'
  if (vibes.includes('adventure')) return "This isn't a sightseeing tour. I front-loaded the adrenaline while you're fresh, wound down with culture toward the end."
  if (vibes.includes('foodie')) return 'I planned around meals, not museums. Morning markets, lunch spots locals fight over, and dinners you\'ll talk about for years.'
  if (vibes.includes('culture')) return "Deep, not wide. I picked fewer stops with more meaning — the temple the tour buses skip, the gallery with no line."
  if (vibes.includes('beach')) return "Light on schedule, heavy on vitamin D. I built in long gaps because the best beach days are the unplanned ones."
  return `I built this around your ${vibes.join(' + ')} energy. Every pick has a reason — tap any card to see why.`
}

interface BoardViewProps {
  trip: Trip
  items: ItineraryItem[]
}

export default function BoardView({ trip, items }: BoardViewProps) {
  const { openDetail, openCardMenu, openChat, authPromptDismissed, dismissAuthPrompt } = useUIStore()
  const { formatBudget, isAnonymous, token } = useTripStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const res = await fetch('/api/trips/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tripId: trip.id }),
      })
      const data = await res.json()
      if (data.url) {
        const fullUrl = `${window.location.origin}${data.url}`
        setShareUrl(fullUrl)
        trackEvent('funnel_trip_shared', 'conversion', trip.destination || '')
        if (navigator.share) {
          await navigator.share({ title: `${trip.destination} Trip — Drift`, url: fullUrl })
        } else {
          await navigator.clipboard.writeText(fullUrl)
          useUIStore.getState().toast('Share link copied!')
        }
      }
    } catch { /* user cancelled share or error */ }
    setSharing(false)
  }

  // Parse days from items
  const { days, tripBrief, weatherSummary } = useMemo(() => {
    const dayList: Day[] = []
    let curDay: Day | null = null
    let preItems: ItineraryItem[] = []
    let brief = ''
    let wSummary = ''

    items.forEach((item) => {
      if (item.category === 'day') {
        if (curDay) dayList.push(curDay)
        const dayLabel = item.name.replace(/^Day\s*\d+\s*[:—–\-]\s*/i, '').trim() || item.detail || `Day ${dayList.length + 1}`
        const meta = (item.metadata || {}) as ItemMetadata
        if (meta.trip_brief) brief = meta.trip_brief as string
        if (meta.weatherSummary) wSummary = meta.weatherSummary as string
        const weather = meta.weather as DayWeatherData | undefined
        curDay = { label: dayLabel, detail: item.detail, items: [], insight: meta.day_insight as string, mapUrl: meta.dayMapUrl as string | undefined, weather }
        if (preItems.length > 0) { curDay.items = [...preItems]; preItems = [] }
      } else {
        if (!curDay) preItems.push(item)
        else curDay.items.push(item)
      }
    })
    if (curDay) dayList.push(curDay)
    if (dayList.length === 0 && preItems.length > 0) {
      dayList.push({ label: 'Your Trip', detail: '', items: preItems })
    }

    return { days: dayList, tripBrief: brief, weatherSummary: wSummary }
  }, [items])

  const briefText = tripBrief || getFallbackBrief(trip.vibes || [])
  const vibes = trip.vibes || []
  const stopCount = items.filter((i) => i.category !== 'day' && i.category !== 'transfer').length

  // Empty trip state
  if (items.length === 0 || stopCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <div className="text-center">
          <div className="font-serif text-xl text-drift-text mb-2">Trip is empty</div>
          <p className="text-xs text-drift-text3">This trip has no activities yet. Try generating a new one or chat with Drift to add items.</p>
        </div>
        <button onClick={() => openChat('Help me build an itinerary for this trip')} className="rounded-xl bg-drift-gold px-6 py-3 text-xs font-semibold text-drift-bg">
          Chat with Drift
        </button>
      </div>
    )
  }
  const yr = trip.start_date ? new Date(trip.start_date + 'T00:00:00').getFullYear() : ''

  // Scroll to day
  const scrollToDay = (idx: number) => {
    setActiveDay(idx)
    const el = scrollRef.current?.querySelector(`[data-day="${idx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Number of nights (for hotel cost calculation)
  const nights = useMemo(() => {
    if (trip.start_date && trip.end_date) {
      const d1 = new Date(trip.start_date + 'T00:00:00')
      const d2 = new Date(trip.end_date + 'T00:00:00')
      return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
    }
    return days.length || 1
  }, [trip.start_date, trip.end_date, days.length])

  // Hotels — extracted for separate section
  const hotels = useMemo(() => {
    const allHotels = items.filter(i => i.category === 'hotel')
    return allHotels.map((hotel, idx) => {
      const meta = (hotel.metadata || {}) as ItemMetadata
      const perNightNum = parsePrice(hotel.price)
      const isPN = (hotel.price || '').toLowerCase().includes('/night') || (hotel.price || '').toLowerCase().includes('per night')
      let hotelNights = nights
      if (allHotels.length > 1) {
        const thisDayIdx = days.findIndex(d => d.items.some(i => i.id === hotel.id))
        if (thisDayIdx < 0) { /* hotel not in any day — use full trip */ }
        else if (idx < allHotels.length - 1) {
          const nextDayIdx = days.findIndex(d => d.items.some(i => i.id === allHotels[idx + 1]?.id))
          if (nextDayIdx > thisDayIdx) hotelNights = Math.max(1, nextDayIdx - thisDayIdx)
        } else {
          hotelNights = Math.max(1, days.length - thisDayIdx)
        }
      }
      const totalCost = isPN ? perNightNum * hotelNights : perNightNum
      const startDay = days.findIndex(d => d.items.some(i => i.id === hotel.id)) + 1
      const endDay = startDay + hotelNights - 1
      return { ...hotel, meta, perNightNum, isPN, hotelNights, totalCost, startDay, endDay, rating: meta.rating as number | undefined }
    })
  }, [items, days, nights])

  // Cost breakdown — multiply hotel per-night price by number of nights
  const costs = useMemo(() => {
    const c = { flights: 0, hotels: 0, activities: 0, food: 0 }
    items.forEach((i) => {
      const p = parsePrice(i.price)
      if (i.category === 'flight') c.flights += p
      else if (i.category === 'hotel') {
        // Hotel prices are per-night — multiply by nights
        const lower = (i.price || '').toLowerCase()
        const isPN = lower.includes('/night') || lower.includes('per night') || lower.includes('/per')
        c.hotels += isPN ? p * nights : p
      }
      else if (i.category === 'activity') c.activities += p
      else if (i.category === 'food') c.food += p
    })
    return c
  }, [items, nights])

  const totalCost = costs.flights + costs.hotels + costs.activities + costs.food

  // Budget warning
  const budgetDefaults: Record<string, number> = { budget: 1500, mid: 3000, luxury: 7000 }
  const budgetTarget = budgetDefaults[trip.budget || 'mid'] || 3000
  const overBudgetPct = totalCost > 0 && budgetTarget > 0
    ? Math.round(((totalCost - budgetTarget) / budgetTarget) * 100)
    : 0

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto pb-24">
      {/* Header */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-drift-text">
              {trip.destination}
              {trip.country && <span className="font-normal italic text-drift-text2">, {trip.country}</span>}
            </h1>
            <p className="mt-1 text-[11px] text-drift-text3">
              {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}{yr ? `, ${yr}` : ''} · {trip.travelers} travelers
            </p>
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share trip"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text2 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (token) window.open(`/api/trips/${trip.id}/calendar?token=${token}`, '_blank')
              }}
              aria-label="Export to Calendar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
            <button
              onClick={() => openChat()}
              aria-label="Chat with Drift AI"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Trip Brief */}
      <div className="mx-5 mt-5 rounded-2xl border border-drift-border bg-drift-card p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[8px] font-extrabold text-drift-bg">D</div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-drift-text3">Drift&apos;s reasoning</span>
        </div>
        <p className="text-xs leading-relaxed text-drift-text2">{briefText}</p>
        {weatherSummary && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-drift-surface2 px-3 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <p className="text-[11px] leading-snug text-drift-text2">{weatherSummary}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {vibes.map((v) => (
            <span key={v} className="rounded-full border border-drift-gold/15 bg-drift-gold-bg px-2.5 py-1 text-[9px] font-medium text-drift-gold">
              {v}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-3 border-t border-drift-border2 pt-3">
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-drift-text">{days.length}</div>
            <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Days</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-drift-text">{formatBudget(totalCost)}</div>
            <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Est. Total</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-drift-text">{stopCount}</div>
            <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Stops</div>
          </div>
        </div>
      </div>

      {/* Save trip prompt — for anonymous users */}
      {isAnonymous && !authPromptDismissed && (
        <div className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-drift-gold/20 bg-drift-gold/5 px-4 py-3">
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-drift-text">Save this trip</div>
            <div className="text-[10px] text-drift-text3">Sign in to keep it forever</div>
          </div>
          <a
            href="/m/login"
            className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-[10px] font-bold text-[#1a1a1a] shadow-sm"
          >
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </span>
          </a>
          <button onClick={dismissAuthPrompt} className="shrink-0 p-1 text-drift-text3" aria-label="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Budget warning — only show when OVER budget, not under */}
      {overBudgetPct > 15 && totalCost > budgetTarget && (
        <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-xl border border-drift-warn/20 bg-drift-warn/5 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="1.5" className="mt-0.5 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-[11px] font-semibold text-drift-warn">~{overBudgetPct}% over budget</p>
            <p className="mt-0.5 text-[10px] text-drift-text3">
              Chat with Drift to find cheaper swaps.{' '}
              <button onClick={() => openChat('Help me reduce the budget for this trip')} className="font-semibold text-drift-gold">Adjust →</button>
            </p>
          </div>
        </div>
      )}

      {/* Day pills — sticky on scroll */}
      <div className="sticky top-0 z-30 mt-5 flex gap-2 overflow-x-auto bg-drift-bg/95 backdrop-blur-sm px-5 py-2 scrollbar-hide">
        {days.map((day, i) => (
          <button
            key={i}
            onClick={() => scrollToDay(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeDay === i
                ? 'bg-drift-gold text-drift-bg'
                : 'border border-drift-border2 bg-transparent text-drift-text3'
            }`}
          >
            Day {i + 1}
            {day.weather && (
              <span className={`h-1.5 w-1.5 rounded-full ${day.weather.isRainy ? 'bg-blue-400' : day.weather.isSunny ? 'bg-amber-400' : 'bg-drift-text3'}`} />
            )}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="mt-5 px-5">
        {days.map((day, di) => (
          <div key={di} data-day={di} className="mb-6">
            {/* Day header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative">
                <div className="h-3 w-3 rounded-full border-2 border-drift-gold bg-drift-bg" />
                {di === 0 && (
                  <div className="absolute inset-0 animate-ping rounded-full border border-drift-gold opacity-30" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-drift-text">{day.label}</div>
              </div>
              {day.weather && (
                <div className={`flex items-center gap-1 rounded-full px-2 py-1 ${day.weather.isRainy ? 'bg-blue-500/8' : day.weather.isSunny ? 'bg-amber-500/8' : 'bg-drift-surface2'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" className="shrink-0">
                    {day.weather.isRainy ? (
                      <><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25" stroke="#60a5fa" /><path d="M8 19v2M12 19v2M16 19v2" stroke="#60a5fa" /></>
                    ) : day.weather.isSunny ? (
                      <><circle cx="12" cy="12" r="4" stroke="#fbbf24" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#fbbf24" /></>
                    ) : (
                      <><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 6.34l1.41-1.41M2 12h4" stroke="#9ca3af" /><path d="M17.5 21H9a5 5 0 01-.5-9.97A7 7 0 0117 10a4.5 4.5 0 01.5 11z" stroke="#9ca3af" /></>
                    )}
                  </svg>
                  <span className={`text-[10px] font-medium ${day.weather.isRainy ? 'text-blue-400' : day.weather.isSunny ? 'text-amber-400' : 'text-drift-text3'}`}>
                    {day.weather.tempMax}°
                  </span>
                </div>
              )}
            </div>

            {/* Day Map — tap to expand */}
            {day.mapUrl && (
              <button
                onClick={() => window.open(day.mapUrl!, '_blank')}
                className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-drift-border2 bg-drift-surface px-3 py-2.5 text-left transition-all active:scale-[0.98]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="shrink-0">
                  <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><path d="M8 2v16" /><path d="M16 6v16" />
                </svg>
                <span className="text-[11px] text-drift-text2">View Day {di + 1} on map</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="2" className="ml-auto shrink-0">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
            )}

            {/* Timeline — flights, hotels, activities, food in natural order */}
            <div className="ml-1.5 space-y-3 border-l border-drift-border2 pl-6">
              {day.items.map((item, ii) => {
                if (item.category === 'flight') {
                  return <FlightCard key={item.id} item={item} onTap={() => openDetail(item.id)} />
                }
                if (item.category === 'transfer') return null

                // Hotel — uses same ItemCard but with stay-specific detail override
                if (item.category === 'hotel') {
                  const hData = hotels.find(h => h.id === item.id)
                  const hNights = hData?.hotelNights || nights
                  const hPriceNum = hData?.perNightNum || parsePrice(item.price)
                  const hIsPN = hData?.isPN ?? false
                  const hTotalNum = hIsPN ? hPriceNum * hNights : 0
                  const hotelDetail = `${hNights} ${hNights === 1 ? 'night' : 'nights'}${hIsPN && hTotalNum > 0 ? ` · ${formatBudget(hTotalNum)} total` : ''}`
                  const hotelItem = { ...item, detail: hotelDetail }
                  return (
                    <ItemCard
                      key={item.id}
                      item={hotelItem}
                      tripVibes={vibes}
                      onTap={() => openDetail(item.id)}
                      onMenu={() => openCardMenu(item.id)}
                    />
                  )
                }

                const meta = (item.metadata || {}) as ItemMetadata
                const travel = meta.travelToNext as { to: string; duration: string; distance: string; mode: string } | undefined
                const nextItem = day.items[ii + 1]
                const showTravel = travel && nextItem && nextItem.category !== 'transfer' && nextItem.category !== 'flight' && nextItem.category !== 'hotel'

                return (
                  <div key={item.id}>
                    <ItemCard
                      item={item}
                      tripVibes={vibes}
                      onTap={() => openDetail(item.id)}
                      onMenu={() => openCardMenu(item.id)}
                    />
                    {showTravel && (
                      <div className="flex items-center gap-2 py-2 pl-1">
                        <div className="h-4 border-l border-dashed border-drift-gold/30" />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="shrink-0 opacity-70">
                          {travel.mode === 'walk'
                            ? <><circle cx="12" cy="5" r="2" /><path d="M10 22l2-7 4 1v-6l-4-1-2 3" /></>
                            : <><path d="M5 17h14l1-5H4l1 5z" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M5 12l1-4h12l1 4" /></>
                          }
                        </svg>
                        <span className="text-[11px] font-medium text-drift-text2">{travel.duration}</span>
                        <span className="text-[10px] text-drift-text3">{travel.distance}</span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* AI insight */}
              {day.insight && (
                <div className="flex gap-2.5 rounded-[14px] border border-drift-gold/8 bg-gradient-to-br from-drift-gold/4 to-drift-gold/1 p-3">
                  <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[8px] font-extrabold text-drift-bg">D</div>
                  <p className="flex-1 text-[10.5px] leading-relaxed text-drift-text2">
                    <strong className="text-drift-text">Drift:</strong> {day.insight}{' '}
                    <button onClick={() => openChat(`Tell me more about day ${di + 1}`)} className="font-semibold text-drift-gold">
                      Ask Drift →
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Trip Summary */}
      <div className="mx-5 mt-4 rounded-2xl border border-drift-border bg-drift-card p-5">
        <div className="mb-4 text-[10px] font-bold uppercase tracking-wider text-drift-text3">Trip Estimate</div>
        {[
          { label: 'Flights', val: costs.flights, color: 'text-drift-gold' },
          { label: 'Hotels', val: costs.hotels, color: 'text-drift-ok' },
          { label: 'Activities', val: costs.activities, color: 'text-drift-gold2' },
          { label: 'Food', val: costs.food, color: 'text-drift-warn' },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-drift-border2 py-2.5 last:border-b-0">
            <span className="text-xs text-drift-text2">{row.label}</span>
            <span className={`text-sm font-bold ${row.color}`}>{formatBudget(row.val)}</span>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between border-t border-drift-border2 pt-3">
          <span className="text-xs font-semibold text-drift-text2">Total Estimated</span>
          <span className="text-base font-bold text-drift-text">{formatBudget(totalCost)}</span>
        </div>

        <button
          onClick={() => useUIStore.getState().toast('Booking links coming soon!')}
          className="relative mt-4 w-full overflow-hidden rounded-[14px] bg-drift-gold py-4 text-xs font-extrabold uppercase tracking-widest text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)]"
        >
          Start Booking
          <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_2s_infinite]" />
        </button>
        <p className="mt-2 text-center text-[8px] text-drift-text3">We redirect you to each provider. No markup.</p>
      </div>
    </div>
  )
}
