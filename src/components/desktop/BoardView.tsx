'use client'

import { useMemo, useRef, useState } from 'react'
import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type Trip, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import DesktopItemCard from './ItemCard'
import DesktopFlightCard from './FlightCard'

interface Day {
  label: string
  theme: string
  items: ItineraryItem[]
  insight?: string
  weather?: Record<string, unknown>
}

interface DesktopBoardViewProps {
  trip: Trip
  items: ItineraryItem[]
  onOpenChat: () => void
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DesktopBoardView({ trip, items, onOpenChat }: DesktopBoardViewProps) {
  const { formatBudget } = useTripStore()
  const mainRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)

  // Parse days from items
  const { days, tripBrief } = useMemo(() => {
    const dayList: Day[] = []
    let currentDay: Day | null = null
    let brief = ''

    for (const item of items) {
      if (item.category === 'day') {
        const meta = (item.metadata || {}) as ItemMetadata
        currentDay = {
          label: item.name,
          theme: item.detail || '',
          items: [],
          insight: meta.day_insight as string | undefined,
          weather: meta.weather as Record<string, unknown> | undefined,
        }
        if (meta.trip_brief) brief = meta.trip_brief as string
        dayList.push(currentDay)
      } else if (currentDay) {
        currentDay.items.push(item)
      }
    }
    return { days: dayList, tripBrief: brief }
  }, [items])

  const vibes = trip.vibes || []
  const nights = useMemo(() => {
    if (trip.start_date && trip.end_date) {
      return Math.max(1, Math.round((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000))
    }
    return days.length || 1
  }, [trip.start_date, trip.end_date, days.length])

  // Cost breakdown
  const costs = useMemo(() => {
    const c = { flights: 0, hotels: 0, activities: 0, food: 0 }
    items.forEach((i) => {
      const p = parsePrice(i.price)
      if (i.category === 'flight') c.flights += p
      else if (i.category === 'hotel') {
        const lower = (i.price || '').toLowerCase()
        const isPN = lower.includes('/night') || lower.includes('per night')
        c.hotels += isPN ? p * nights : p
      }
      else if (i.category === 'activity') c.activities += p
      else if (i.category === 'food') c.food += p
    })
    return c
  }, [items, nights])
  const totalCost = costs.flights + costs.hotels + costs.activities + costs.food

  const scrollToDay = (idx: number) => {
    setActiveDay(idx)
    const el = mainRef.current?.querySelector(`[data-day="${idx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Items before first day (flights, hotel)
  const preItems = useMemo(() => {
    const firstDayIdx = items.findIndex(i => i.category === 'day')
    return firstDayIdx > 0 ? items.slice(0, firstDayIdx).filter(i => i.category !== 'transfer') : []
  }, [items])

  return (
    <div className="flex h-full">
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-drift-border overflow-y-auto bg-drift-bg">
        <div className="p-6">
          {/* Trip header */}
          <h2 className="font-serif text-xl text-drift-text">
            {trip.destination}
            {trip.country && <span className="font-normal italic text-drift-text2">, {trip.country}</span>}
          </h2>
          <p className="mt-1 text-[11px] text-drift-text3">
            {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)} · {nights}N · {trip.travelers || 1} pax
          </p>

          {/* Vibes */}
          {vibes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {vibes.map(v => (
                <span key={v} className="rounded-full bg-drift-gold/10 px-2.5 py-0.5 text-[9px] font-medium text-drift-gold">{v}</span>
              ))}
            </div>
          )}

          {/* Day navigation */}
          <div className="mt-6">
            <div className="text-[9px] font-bold uppercase tracking-widest text-drift-text3 mb-2">Days</div>
            <div className="space-y-1">
              {days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => scrollToDay(i)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-[12px] transition-all ${
                    activeDay === i
                      ? 'bg-drift-gold/10 text-drift-gold border border-drift-gold/20'
                      : 'text-drift-text3 hover:bg-drift-surface hover:text-drift-text2 border border-transparent'
                  }`}
                >
                  <div className="font-medium">Day {i + 1}</div>
                  <div className="text-[10px] opacity-70 mt-0.5 truncate">{day.theme}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cost summary */}
          <div className="mt-6 rounded-xl border border-drift-border bg-drift-surface p-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-drift-text3 mb-3">Trip Estimate</div>
            {[
              { label: 'Flights', val: costs.flights, color: 'text-drift-gold' },
              { label: 'Hotels', val: costs.hotels, color: 'text-drift-ok' },
              { label: 'Activities', val: costs.activities, color: 'text-drift-text' },
              { label: 'Food', val: costs.food, color: 'text-drift-warn' },
            ].map(row => row.val > 0 && (
              <div key={row.label} className="flex justify-between py-1.5 text-[12px]">
                <span className="text-drift-text3">{row.label}</span>
                <span className={`font-medium ${row.color}`}>{formatBudget(row.val)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-drift-border pt-2">
              <span className="text-[12px] font-medium text-drift-text3">Total</span>
              <span className="font-serif text-lg text-drift-gold">{formatBudget(totalCost)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 space-y-2">
            <button
              onClick={onOpenChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-drift-gold px-4 py-3 text-[11px] font-bold text-drift-bg transition-all hover:shadow-[0_8px_24px_rgba(200,164,78,0.2)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Chat with Drift
            </button>
            <button
              onClick={() => {
                const token = useTripStore.getState().token
                if (token) window.open(`/api/trips/${trip.id}/calendar?token=${token}`, '_blank')
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-drift-border px-4 py-2.5 text-[11px] font-medium text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Export Calendar
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────── */}
      <div ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-8 py-8">
          {/* Trip brief */}
          {tripBrief && (
            <div className="mb-8 rounded-2xl border border-drift-border bg-drift-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[9px] font-extrabold text-drift-bg">D</div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-drift-text3">Drift&apos;s reasoning</span>
              </div>
              <p className="text-[13px] leading-relaxed text-drift-text2">{tripBrief}</p>
            </div>
          )}

          {/* Pre-day items (flights, hotel) */}
          {preItems.length > 0 && (
            <div className="mb-6 space-y-3">
              {preItems.map(item => {
                if (item.category === 'flight') return <DesktopFlightCard key={item.id} item={item} />
                return <DesktopItemCard key={item.id} item={item} tripVibes={vibes} />
              })}
            </div>
          )}

          {/* Day sections */}
          {days.map((day, di) => (
            <div key={di} data-day={di} className="mb-10">
              {/* Day header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-drift-gold/10 text-[12px] font-bold text-drift-gold">
                  {di + 1}
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-drift-text">{day.label}</h3>
                  {day.weather && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${(day.weather as Record<string, boolean>).isRainy ? 'bg-blue-400' : (day.weather as Record<string, boolean>).isSunny ? 'bg-amber-400' : 'bg-drift-text3'}`} />
                      <span className="text-[10px] text-drift-text3">{(day.weather as Record<string, unknown>).tempMax as number}° · {(day.weather as Record<string, unknown>).description as string}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI insight */}
              {day.insight && (
                <div className="mb-4 flex items-start gap-3 rounded-xl bg-drift-gold/5 border border-drift-gold/10 px-4 py-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="mt-0.5 shrink-0">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <p className="text-[12px] text-drift-text2 leading-relaxed">{day.insight}</p>
                </div>
              )}

              {/* Items */}
              <div className="space-y-3">
                {day.items.map((item) => {
                  if (item.category === 'flight') return <DesktopFlightCard key={item.id} item={item} />
                  if (item.category === 'transfer') return null

                  const meta = (item.metadata || {}) as ItemMetadata
                  const travel = meta.travelToNext as { mode: string; duration: string; distance: string } | undefined

                  return (
                    <div key={item.id}>
                      <DesktopItemCard item={item} tripVibes={vibes} />
                      {/* Travel marker */}
                      {travel && (
                        <div className="flex items-center gap-2 py-2 pl-6">
                          <div className="h-5 border-l border-dashed border-drift-gold/25" />
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="opacity-60">
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
