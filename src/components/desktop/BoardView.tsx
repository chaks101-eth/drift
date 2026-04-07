'use client'

import { useMemo, useRef, useState } from 'react'
import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type Trip, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import DesktopItemCard from './ItemCard'
import DesktopFlightCard from './FlightCard'

interface Day {
  label: string
  theme: string
  date: string
  items: ItineraryItem[]
  insight?: string
  weather?: Record<string, unknown>
}

interface Props {
  trip: Trip
  items: ItineraryItem[]
  onOpenDetail: (itemId: string) => void
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function shortDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DesktopBoardView({ trip, items, onOpenDetail }: Props) {
  const { formatBudget } = useTripStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [insightDismissed, setInsightDismissed] = useState(false)

  // Parse days
  const { days, tripBrief } = useMemo(() => {
    const dayList: Day[] = []
    let currentDay: Day | null = null
    let brief = ''
    for (const item of items) {
      if (item.category === 'day') {
        const meta = (item.metadata || {}) as ItemMetadata
        // Extract date from name like "Day 1 — Beach Bliss · Mon, Mar 15"
        const dateMatch = item.name.match(/·\s*(.+)$/)
        currentDay = {
          label: item.name.replace(/\s*·\s*.+$/, ''),
          theme: item.detail || '',
          date: dateMatch?.[1] || '',
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

  // Costs
  const costs = useMemo(() => {
    const c = { flights: 0, hotels: 0, activities: 0, food: 0 }
    items.forEach((i) => {
      const p = parsePrice(i.price)
      if (i.category === 'flight') c.flights += p
      else if (i.category === 'hotel') {
        const lower = (i.price || '').toLowerCase()
        c.hotels += (lower.includes('/night') || lower.includes('per night')) ? p * nights : p
      }
      else if (i.category === 'activity') c.activities += p
      else if (i.category === 'food') c.food += p
    })
    return c
  }, [items, nights])
  const totalCost = costs.flights + costs.hotels + costs.activities + costs.food
  const stopCount = items.filter(i => !['day', 'transfer'].includes(i.category)).length

  // Pre-day items
  const preItems = useMemo(() => {
    const firstDayIdx = items.findIndex(i => i.category === 'day')
    return firstDayIdx > 0 ? items.slice(0, firstDayIdx).filter(i => i.category !== 'transfer') : []
  }, [items])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-10 py-8 pb-24">

        {/* ─── AI Insight Bar ──────────────────────── */}
        {!insightDismissed && tripBrief && (
          <div className="mb-8 relative">
            <div className="flex items-start gap-4 rounded-2xl bg-gradient-to-r from-drift-gold/[0.06] to-drift-gold/[0.02] border border-drift-gold/15 px-6 py-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-drift-gold">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#08080c" strokeWidth="1.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-semibold text-drift-gold mb-1">Here&apos;s what I considered building this itinerary</div>
                <div className="text-[13px] text-drift-text2 leading-relaxed">{tripBrief}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {vibes.map(v => (
                    <span key={v} className="flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[10px] text-drift-text2">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setInsightDismissed(true)} className="shrink-0 text-drift-text3 hover:text-drift-text transition-colors text-lg leading-none">&times;</button>
            </div>
          </div>
        )}

        {/* ─── Trip Brief Stats ────────────────────── */}
        <div className="mb-8 flex items-center gap-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#08080c" strokeWidth="1.5">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-drift-text3">Drift&apos;s Reasoning</div>
              <div className="text-[13px] text-drift-text2 mt-0.5">{shortDate(trip.start_date)} — {shortDate(trip.end_date)}</div>
            </div>
          </div>
          <div className="h-8 w-px bg-[rgba(255,255,255,0.06)]" />
          <div className="flex gap-8">
            {[
              { val: String(nights), label: 'Nights' },
              { val: String(stopCount), label: 'Experiences' },
              { val: formatBudget(totalCost), label: 'Est. Cost' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[18px] font-bold text-drift-gold">{s.val}</div>
                <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            {vibes.map(v => (
              <span key={v} className="rounded-full bg-drift-gold/[0.06] border border-drift-gold/10 px-3 py-1 text-[9px] font-semibold text-drift-gold uppercase tracking-wider">{v}</span>
            ))}
          </div>
        </div>

        {/* ─── Pre-day items (flights, hotel) ─────── */}
        {preItems.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-4">
            {preItems.map(item => (
              item.category === 'flight'
                ? <DesktopFlightCard key={item.id} item={item} onClick={() => onOpenDetail(item.id)} />
                : <DesktopItemCard key={item.id} item={item} onClick={() => onOpenDetail(item.id)} />
            ))}
          </div>
        )}

        {/* ─── Flowchart Lanes (Day Sections) ─────── */}
        {days.map((day, di) => (
          <div key={di} className="mb-10" data-day={di}>
            {/* Lane header */}
            <div className="mb-5 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-drift-gold shadow-[0_0_8px_rgba(200,164,78,0.4)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-drift-gold">Day {di + 1}</span>
              <span className="text-[12px] text-drift-text3">{day.date || day.theme}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-[rgba(255,255,255,0.08)] to-transparent" />
              {day.weather && (
                <div className="flex items-center gap-1.5 text-[10px] text-drift-text3">
                  <span className={`h-2 w-2 rounded-full ${(day.weather as Record<string, boolean>).isRainy ? 'bg-blue-400' : (day.weather as Record<string, boolean>).isSunny ? 'bg-amber-400' : 'bg-drift-text3'}`} />
                  {(day.weather as Record<string, unknown>).tempMax as number}°
                </div>
              )}
            </div>

            {/* Flowchart: nodes with arrows */}
            <div className="flex flex-wrap items-start gap-0">
              {day.items.map((item, ii) => {
                if (item.category === 'transfer') return null
                const isLast = ii === day.items.length - 1 || day.items.slice(ii + 1).every(i => i.category === 'transfer')

                return (
                  <div key={item.id} className="flex items-start">
                    {/* Node */}
                    {item.category === 'flight'
                      ? <DesktopFlightCard item={item} onClick={() => onOpenDetail(item.id)} />
                      : <DesktopItemCard item={item} onClick={() => onOpenDetail(item.id)} />
                    }

                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="flex flex-col items-center justify-center px-2 pt-[60px] opacity-30 group/arrow">
                        <div className="relative w-8">
                          <div className="h-[2px] w-full bg-gradient-to-r from-drift-gold/50 to-drift-gold/15" />
                          <div className="absolute right-[-1px] top-[-3px] h-0 w-0 border-b-[3.5px] border-l-[5px] border-t-[3.5px] border-b-transparent border-l-drift-gold/30 border-t-transparent" />
                        </div>
                        {/* + button on arrow hover */}
                        <button className="mt-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] text-drift-text3 text-sm opacity-0 transition-all group-hover/arrow:opacity-100 hover:border-drift-gold hover:text-drift-gold hover:bg-drift-gold/[0.08] hover:border-solid">
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Day insight */}
            {day.insight && (
              <div className="mt-4 ml-6 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-drift-gold/[0.05] to-transparent border-l-2 border-drift-gold/30 px-4 py-3">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="mt-0.5 shrink-0 opacity-60">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <p className="text-[12px] leading-relaxed text-drift-text2">{day.insight}</p>
              </div>
            )}

            {/* Day connector (except last day) */}
            {di < days.length - 1 && (
              <div className="flex items-center gap-2.5 py-3 pl-[5px]">
                <div className="w-[2px] h-8 bg-gradient-to-b from-drift-gold/40 to-[rgba(255,255,255,0.06)]" />
                <span className="text-[9px] uppercase tracking-wider text-drift-text3 font-medium">Next morning</span>
              </div>
            )}
          </div>
        ))}

        {/* ─── Cost Bar ───────────────────────────── */}
        <div className="mt-10 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] px-8 py-6">
          <div className="flex items-end justify-between">
            <div className="flex gap-8">
              {[
                { label: 'Flights', val: costs.flights, color: 'text-drift-gold' },
                { label: 'Hotels', val: costs.hotels, color: 'text-drift-ok' },
                { label: 'Activities', val: costs.activities, color: 'text-drift-text' },
                { label: 'Food', val: costs.food, color: 'text-drift-warn' },
              ].filter(r => r.val > 0).map(row => (
                <div key={row.label} className="text-center">
                  <div className={`text-[14px] font-semibold ${row.color}`}>{formatBudget(row.val)}</div>
                  <div className="mt-1 text-[9px] font-medium uppercase tracking-wider text-drift-text3">{row.label}</div>
                </div>
              ))}
            </div>
            <div className="text-right">
              <div className="font-serif text-[28px] font-light text-drift-gold">{formatBudget(totalCost)}</div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-drift-text3">Total Estimate</div>
            </div>
          </div>
        </div>

        {/* ─── Actions ────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              const token = useTripStore.getState().token
              if (token) window.open(`/api/trips/${trip.id}/calendar?token=${token}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-6 py-3 text-[11px] font-medium text-drift-text3 transition-all hover:border-drift-gold/20 hover:text-drift-gold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Export Calendar
          </button>
          <button
            onClick={() => {
              if (navigator.share) navigator.share({ title: `${trip.destination} Trip`, url: window.location.href })
              else navigator.clipboard.writeText(window.location.href)
            }}
            className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] px-6 py-3 text-[11px] font-medium text-drift-text3 transition-all hover:border-drift-gold/20 hover:text-drift-gold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share Trip
          </button>
        </div>
      </div>
    </div>
  )
}
