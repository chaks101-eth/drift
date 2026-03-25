'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import type { Trip, ItineraryItem, ItemMetadata } from '@/stores/trip-store'
import FlightCard from '@/components/mobile/cards/FlightCard'
import ItemCard from '@/components/mobile/cards/ItemCard'

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
  const { openDetail, openCardMenu, openChat } = useUIStore()
  const { formatBudget } = useTripStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)

  // Parse days from items
  const { days, tripBrief, weatherSummary, totalCost } = useMemo(() => {
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

    const cost = items.reduce((s, i) => s + (parseFloat((i.price || '0').replace(/[^0-9.]/g, '')) || 0), 0)

    return { days: dayList, tripBrief: brief, weatherSummary: wSummary, totalCost: cost }
  }, [items])

  const briefText = tripBrief || getFallbackBrief(trip.vibes || [])
  const vibes = trip.vibes || []
  const stopCount = items.filter((i) => i.category !== 'day' && i.category !== 'transfer').length
  const yr = trip.start_date ? new Date(trip.start_date + 'T00:00:00').getFullYear() : ''

  // Scroll to day
  const scrollToDay = (idx: number) => {
    setActiveDay(idx)
    const el = scrollRef.current?.querySelector(`[data-day="${idx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Cost breakdown
  const costs = useMemo(() => {
    const c = { flights: 0, hotels: 0, activities: 0, food: 0 }
    items.forEach((i) => {
      const p = parseFloat((i.price || '0').replace(/[^0-9.]/g, '')) || 0
      if (i.category === 'flight') c.flights += p
      else if (i.category === 'hotel') c.hotels += p
      else if (i.category === 'activity') c.activities += p
      else if (i.category === 'food') c.food += p
    })
    return c
  }, [items])

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
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-drift-surface2 px-3 py-2">
            <span className="mt-px text-sm">
              {weatherSummary.includes('rain') || weatherSummary.includes('Rain') ? '🌧' : weatherSummary.includes('Clear') || weatherSummary.includes('sunny') ? '☀️' : '⛅'}
            </span>
            <p className="text-[10.5px] leading-snug text-drift-text2">{weatherSummary}</p>
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

      {/* Day pills */}
      <div className="mt-5 flex gap-2 overflow-x-auto px-5 scrollbar-hide">
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
              <span className="text-xs normal-case">
                {day.weather.isRainy ? '🌧' : day.weather.isSunny ? '☀️' : '⛅'}
              </span>
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
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${day.weather.isRainy ? 'bg-blue-500/10' : day.weather.isSunny ? 'bg-amber-500/10' : 'bg-drift-surface2'}`}>
                  <span className="text-xs">
                    {day.weather.isRainy ? '🌧' : day.weather.isSunny ? '☀️' : '⛅'}
                  </span>
                  <span className={`text-[10px] font-semibold ${day.weather.isRainy ? 'text-blue-400' : day.weather.isSunny ? 'text-amber-400' : 'text-drift-text2'}`}>
                    {day.weather.tempMax}°
                  </span>
                  {day.weather.isRainy && (
                    <span className="text-[9px] text-blue-400/70">{day.weather.rainProbability}%</span>
                  )}
                </div>
              )}
            </div>

            {/* Day Map */}
            {day.mapUrl && (
              <div className="mb-3 overflow-hidden rounded-xl border border-drift-border2">
                <img
                  src={day.mapUrl}
                  alt={`Map for Day ${di + 1}`}
                  className="h-[140px] w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Items */}
            <div className="ml-1.5 space-y-3 border-l border-drift-border2 pl-6">
              {day.items.map((item) => {
                if (item.category === 'flight') {
                  return <FlightCard key={item.id} item={item} onTap={() => openDetail(item.id)} />
                }
                if (item.category === 'transfer') return null
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    tripVibes={vibes}
                    onTap={() => openDetail(item.id)}
                    onMenu={() => openCardMenu(item.id)}
                  />
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
