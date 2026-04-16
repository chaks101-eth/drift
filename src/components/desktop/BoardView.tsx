'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { parsePrice } from '@/lib/parse-price'
import { supabase } from '@/lib/supabase'
import { useTripStore, type Trip, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'
import dynamic from 'next/dynamic'
import DesktopItemCard from './ItemCard'
import DesktopFlightCard from './FlightCard'
import DayWeather from './DayWeather'
import { useReactions, useCollaborators } from '@/hooks/useCollaboration'
import { usePolls, useGroupTrip } from '@/hooks/useGroupTrip'

const TripMap = dynamic(() => import('./TripMap'), { ssr: false })

interface Day {
  label: string
  theme: string
  date: string
  items: ItineraryItem[]
  insight?: string
  weather?: Record<string, unknown>
}

interface Stay {
  item: ItineraryItem
  startDayIdx: number
  endDayIdx: number
  nights: number
}

interface Props {
  trip: Trip
  items: ItineraryItem[]
  onOpenDetail: (itemId: string) => void
  onOpenChat?: () => void
  onToggleGroup?: () => void
  groupPanelOpen?: boolean
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const BUDGET_DEFAULTS: Record<string, number> = { budget: 1500, mid: 3000, luxury: 7000 }

export default function DesktopBoardView({ trip, items, onOpenDetail, onOpenChat, onToggleGroup, groupPanelOpen }: Props) {
  const { formatBudget } = useTripStore()
  const { reactions, toggleReaction } = useReactions(trip.id)
  const userId = useTripStore((s) => s.userId)
  const { collaborators } = useCollaborators(trip.id)
  const { polls, createPoll, vote, applyPoll, closePoll } = usePolls(trip.id)
  const isOwner = trip.user_id === userId
  const { readyCheck, notes, startReadyCheck, respondReady, addNote } = useGroupTrip(trip.id)
  // Only treat as "group" when at least one invite has been accepted — avoids pending-pollution
  const joinedCount = collaborators.filter(c => c.accepted_at).length
  const hasGroup = joinedCount > 0
  const [noteInput, setNoteInput] = useState('')
  const setCurrentItems = useTripStore((s) => s.setCurrentItems)
  const toast = useUIStore((s) => s.toast)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [insightOpen, setInsightOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Drag handlers
  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedId) setDragOverId(id)
  }

  const handleDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return

    const fromIdx = items.findIndex(i => i.id === draggedId)
    const toIdx = items.findIndex(i => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    // Reorder locally (optimistic)
    const newItems = [...items]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    // Update positions
    const reordered = newItems.map((item, idx) => ({ ...item, position: idx }))
    setCurrentItems(reordered)

    setDraggedId(null)
    setDragOverId(null)

    // Persist to DB
    try {
      await Promise.all(reordered.map(item =>
        supabase.from('itinerary_items').update({ position: item.position }).eq('id', item.id)
      ))
      toast('Reordered')
    } catch {
      toast('Reorder failed — refresh', true)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // Parse days
  const { days, tripBrief } = useMemo(() => {
    const dayList: Day[] = []
    let currentDay: Day | null = null
    let brief = ''
    for (const item of items) {
      if (item.category === 'day') {
        const meta = (item.metadata || {}) as ItemMetadata
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
  const travelers = trip.travelers || 1

  // Budget calculation
  const budgetPerPerson = (trip as Trip & { budget_amount?: number }).budget_amount || BUDGET_DEFAULTS[trip.budget as string] || 3000
  const budgetTotal = budgetPerPerson * travelers
  const budgetUsedPct = Math.min(100, Math.round((totalCost / budgetTotal) * 100))
  const isOverBudget = totalCost > budgetTotal * 1.05
  const budgetColor = isOverBudget ? 'text-drift-err' : budgetUsedPct > 85 ? 'text-drift-warn' : 'text-drift-ok'

  // ─── Stays: extract all hotels with day-range coverage ───
  const stays = useMemo<Stay[]>(() => {
    const result: Stay[] = []
    let currentDay = -1 // -1 = before day 1
    for (const item of items) {
      if (item.category === 'day') currentDay++
      else if (item.category === 'hotel') {
        result.push({ item, startDayIdx: Math.max(0, currentDay), endDayIdx: 0, nights: 0 })
      }
    }
    const totalDays = days.length || 1
    result.forEach((stay, i) => {
      const next = result[i + 1]
      stay.endDayIdx = next ? Math.max(stay.startDayIdx, next.startDayIdx - 1) : totalDays - 1
      stay.nights = stay.endDayIdx - stay.startDayIdx + 1
    })
    return result
  }, [items, days.length])

  // Pre-day items (excluding hotels — they live in Stays section now)
  const preItems = useMemo(() => {
    const firstDayIdx = items.findIndex(i => i.category === 'day')
    if (firstDayIdx <= 0) return []
    return items.slice(0, firstDayIdx).filter(i => i.category !== 'transfer' && i.category !== 'hotel')
  }, [items])

  // Track active day on scroll
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return

    const handleScroll = () => {
      const dayEls = scroller.querySelectorAll('[data-day]')
      const scrollTop = scroller.scrollTop
      const offset = 200

      for (let i = dayEls.length - 1; i >= 0; i--) {
        const el = dayEls[i] as HTMLElement
        if (el.offsetTop - offset <= scrollTop) {
          setActiveDay(i)
          break
        }
      }
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToDay = (idx: number) => {
    setActiveDay(idx)
    const el = scrollRef.current?.querySelector(`[data-day="${idx}"]`)
    if (el && scrollRef.current) {
      const top = (el as HTMLElement).offsetTop - 100
      scrollRef.current.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative h-full">
      {/* ─── Sticky Top Bar — refined ───── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-drift-bg/92 backdrop-blur-xl">
        {/* Row 1: Trip identity + budget */}
        <div className="mx-auto max-w-[1180px] flex items-center justify-between gap-6 px-8 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="font-serif text-[20px] font-light text-drift-text truncate">
              {trip.destination}
              {trip.country && <span className="text-drift-text3 font-light italic">, {trip.country}</span>}
            </h1>
            <div className="h-3.5 w-px bg-white/10 shrink-0" />
            <span className="text-[11px] text-drift-text3 whitespace-nowrap">
              {fmtDate(trip.start_date)} → {fmtDate(trip.end_date)} · {nights}N · {travelers} {travelers === 1 ? 'traveler' : 'travelers'}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Group / Invite button */}
            <button
              onClick={() => onToggleGroup?.()}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                groupPanelOpen
                  ? 'bg-white/[0.06] text-drift-text border border-white/12'
                  : 'border border-white/[0.06] text-drift-text3 hover:text-drift-text2 hover:border-white/12'
              }`}
            >
              {hasGroup ? (
                <>
                  <div className="flex -space-x-1">
                    {collaborators.filter(c => c.accepted_at).slice(0, 3).map((c, i) => (
                      <div key={c.id} className="h-4 w-4 rounded-full bg-drift-gold/20 border border-drift-bg flex items-center justify-center text-[6px] font-bold text-drift-gold" style={{ zIndex: 3 - i }}>
                        {c.email?.[0]?.toUpperCase() || '?'}
                      </div>
                    ))}
                  </div>
                  Group ({joinedCount + 1})
                  {polls.filter(p => p.status === 'open').length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-drift-gold" />
                  )}
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Invite
                </>
              )}
            </button>

            {/* Publish toggle — owner only */}
            {isOwner && (
              <button
                onClick={async () => {
                  const t = useTripStore.getState().token
                  if (!t) return
                  const res = await fetch(`/api/trips/${trip.id}/publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
                    body: JSON.stringify({ is_public: !(trip as Trip & { is_public?: boolean }).is_public }),
                  })
                  const data = await res.json()
                  if (data.is_public !== undefined) {
                    toast(data.is_public ? 'Trip is now public — visible on /explore' : 'Trip is now private')
                    // Update the trip object locally
                    useTripStore.getState().setCurrentTrip({ ...trip, is_public: data.is_public } as Trip)
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                  (trip as Trip & { is_public?: boolean }).is_public
                    ? 'bg-drift-gold/10 text-drift-gold border border-drift-gold/25'
                    : 'border border-white/[0.06] text-drift-text3 hover:text-drift-gold hover:border-drift-gold/25'
                }`}
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                {(trip as Trip & { is_public?: boolean }).is_public ? 'Public' : 'Publish'}
              </button>
            )}

            {/* Remix — opens vibes modal */}
            <button
              onClick={() => useUIStore.getState().openRemix()}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-drift-text3 transition-all hover:text-drift-gold hover:border-drift-gold/25"
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              Remix
            </button>

            {/* Map toggle */}
            <button
              onClick={() => setMapOpen(!mapOpen)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all ${
                mapOpen
                  ? 'bg-white/[0.06] text-drift-text border border-white/12'
                  : 'border border-white/[0.06] text-drift-text3 hover:text-drift-text2 hover:border-white/12'
              }`}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><path d="M8 2v16M16 6v16" />
              </svg>
              Map
            </button>

            {/* Budget — restrained */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`text-[12px] font-semibold tabular-nums ${budgetColor}`}>{formatBudget(totalCost)}</div>
                <div className="text-[9px] text-drift-text3 tabular-nums">of {formatBudget(budgetTotal)}</div>
              </div>
              <div className="w-20 h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-drift-err' : budgetUsedPct > 85 ? 'bg-drift-warn' : 'bg-drift-text2'}`}
                  style={{ width: `${Math.min(budgetUsedPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Day navigator — single line, minimal */}
        {days.length > 0 && (
          <div className="mx-auto max-w-[1180px] flex items-center gap-1 px-8 pb-3 overflow-x-auto scrollbar-hide">
            {days.map((day, i) => (
              <button
                key={i}
                onClick={() => scrollToDay(i)}
                className={`shrink-0 flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] transition-all whitespace-nowrap ${
                  activeDay === i
                    ? 'bg-white/[0.06] text-drift-text'
                    : 'text-drift-text3 hover:text-drift-text2 hover:bg-white/[0.02]'
                }`}
              >
                <span className={`font-semibold tracking-wider uppercase text-[9px] ${activeDay === i ? 'text-drift-gold' : 'text-drift-text3/70'}`}>
                  Day {i + 1}
                </span>
                <span className="text-[10px] opacity-80">{day.date}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Scrollable Content ───────────────────────────── */}
      <div ref={scrollRef} className="absolute inset-0 top-[92px] overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-8 py-8 pb-24">

          {/* Trip Map (toggle from top bar) */}
          {mapOpen && (
            <div className="mb-8 animate-[fadeUp_0.3s_ease]">
              <TripMap items={items} height="360px" />
            </div>
          )}

          {/* AI Insight — compact pill that expands on click */}
          {tripBrief && (
            <div className="mb-8">
              {!insightOpen ? (
                <button
                  onClick={() => setInsightOpen(true)}
                  className="group flex items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] text-drift-text3 hover:border-white/12 hover:text-drift-text2 hover:bg-white/[0.04] transition-all"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-drift-gold/70">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <span>Why Drift composed this trip</span>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50 group-hover:opacity-80 transition-opacity">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 animate-[fadeUp_0.3s_ease]">
                  <div className="flex items-start gap-3">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0 text-drift-gold/70">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-drift-text3 mb-1.5">Why this trip</div>
                      <div className="text-[13px] text-drift-text2 leading-relaxed">{tripBrief}</div>
                    </div>
                    <button onClick={() => setInsightOpen(false)} className="shrink-0 text-drift-text3 hover:text-drift-text2 transition-colors -mt-1 text-lg leading-none">&times;</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-day items (flights, etc — not hotels) */}
          {preItems.length > 0 && (
            <div className="mb-10 flex flex-wrap items-start gap-4">
              {preItems.map(item => (
                item.category === 'flight'
                  ? <DesktopFlightCard key={item.id} item={item} onClick={() => onOpenDetail(item.id)} />
                  : <DesktopItemCard key={item.id} item={item} onClick={() => onOpenDetail(item.id)}
                      {...(hasGroup ? { reaction: reactions[item.id], onReact: () => toggleReaction(item.id), onStartPoll: () => createPoll(item.id), poll: polls.find(p => p.itemId === item.id), onVote: (i: number) => vote(item.id, i), onApplyPoll: () => applyPoll(item.id), onClosePoll: () => closePoll(item.id), isOwner } : {})}
                    />
              ))}
            </div>
          )}


          {/* Day Sections */}
          {days.map((day, di) => (
            <section key={di} data-day={di} className="mb-14 scroll-mt-[120px]">
              {/* Lane header — restrained */}
              <div className="mb-6 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-drift-gold/80" />
                <div className="flex items-baseline gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[2px] text-drift-text3">Day {di + 1}</span>
                  {day.theme && <span className="text-[13px] font-medium text-drift-text">{day.theme}</span>}
                </div>
                <div className="flex-1 h-px bg-white/[0.05]" />
                {day.date && <div className="text-[10px] text-drift-text3">{day.date}</div>}
                {day.weather && <DayWeather weather={day.weather} compact />}
              </div>

              {/* Items — horizontal rail with check-in stays at the start */}
              {(() => {
                const dayStays = stays.filter(s => s.startDayIdx === di)
                const dayItems = day.items.filter(i => i.category !== 'transfer' && i.category !== 'hotel')
                const hasContent = dayStays.length > 0 || dayItems.length > 0
                if (!hasContent) return null

                return (
                  <div className="relative -mx-8">
                    <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide px-8 pb-2">
                      {/* Check-in stays first */}
                      {dayStays.map(stay => (
                        <div key={`stay-${stay.item.id}`} className="flex items-start shrink-0">
                          <StayCard stay={stay} onClick={() => onOpenDetail(stay.item.id)} />
                          {(dayItems.length > 0 || dayStays.indexOf(stay) < dayStays.length - 1) && (
                            <div className="flex flex-col items-center justify-center px-1 pt-[70px] opacity-30">
                              <div className="h-px w-4 bg-white/12" />
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Regular activities/food/flights */}
                      {dayItems.map((item, ii) => {
                        const isLast = ii === dayItems.length - 1
                        return (
                          <div key={item.id} className="flex items-start shrink-0">
                            {item.category === 'flight'
                              ? <DesktopFlightCard item={item} onClick={() => onOpenDetail(item.id)} />
                              : <DesktopItemCard
                                  item={item}
                                  onClick={() => onOpenDetail(item.id)}
                                  draggable
                                  onDragStart={handleDragStart(item.id)}
                                  onDragOver={handleDragOver(item.id)}
                                  onDrop={handleDrop(item.id)}
                                  onDragEnd={handleDragEnd}
                                  isDragging={draggedId === item.id}
                                  isDragTarget={dragOverId === item.id}
                                  {...(hasGroup ? { reaction: reactions[item.id], onReact: () => toggleReaction(item.id), onStartPoll: () => createPoll(item.id), poll: polls.find(p => p.itemId === item.id), onVote: (i: number) => vote(item.id, i), onApplyPoll: () => applyPoll(item.id), onClosePoll: () => closePoll(item.id), isOwner } : {})}
                                />
                            }

                            {!isLast && (
                              <div className="flex flex-col items-center justify-center px-1 pt-[70px] opacity-30">
                                <div className="h-px w-4 bg-white/12" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Edge fade hints */}
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-drift-bg to-transparent" />
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-drift-bg to-transparent" />
                  </div>
                )
              })()}

              {/* Day insight — neutral */}
              {day.insight && (
                <div className="mt-5 ml-5 border-l border-white/[0.06] pl-4 py-1">
                  <p className="text-[12px] leading-relaxed text-drift-text3 italic">{day.insight}</p>
                </div>
              )}

            </section>
          ))}


          {/* Cost Breakdown — restrained */}
          <div className="mt-12 rounded-xl border border-white/[0.05] bg-white/[0.015] px-8 py-7">
            <div className="flex items-end justify-between gap-6">
              <div className="flex gap-10 flex-wrap">
                {[
                  { label: 'Flights', val: costs.flights },
                  { label: 'Hotels', val: costs.hotels },
                  { label: 'Activities', val: costs.activities },
                  { label: 'Food', val: costs.food },
                ].filter(r => r.val > 0).map(row => (
                  <div key={row.label}>
                    <div className="text-[13px] font-medium text-drift-text2 tabular-nums">{formatBudget(row.val)}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[1.5px] text-drift-text3">{row.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <div className="font-serif text-[26px] font-light text-drift-text tabular-nums">{formatBudget(totalCost)}</div>
                <div className="text-[9px] uppercase tracking-[1.5px] text-drift-text3">Total estimate</div>
              </div>
            </div>

            {isOverBudget && (
              <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-drift-warn/15 bg-drift-warn/[0.04] px-4 py-3">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="1.5" className="mt-0.5 shrink-0 opacity-80">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="flex-1">
                  <p className="text-[11px] text-drift-warn">~{Math.round((totalCost / budgetTotal - 1) * 100)}% over your budget</p>
                  {onOpenChat && (
                    <button onClick={onOpenChat} className="mt-0.5 text-[10px] text-drift-text3 hover:text-drift-text2 transition-colors">
                      Chat with Drift to find cheaper swaps →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions — minimal */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                const token = useTripStore.getState().token
                if (token) window.open(`/api/trips/${trip.id}/calendar?token=${token}`, '_blank')
              }}
              className="flex items-center gap-2 rounded-full border border-white/[0.06] px-4 py-2 text-[10px] uppercase tracking-wider text-drift-text3 transition-all hover:border-white/15 hover:text-drift-text2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calendar
            </button>
            <button
              onClick={() => {
                if (navigator.share) navigator.share({ title: `${trip.destination} Trip`, url: window.location.href })
                else navigator.clipboard.writeText(window.location.href)
              }}
              className="flex items-center gap-2 rounded-full border border-white/[0.06] px-4 py-2 text-[10px] uppercase tracking-wider text-drift-text3 transition-all hover:border-white/15 hover:text-drift-text2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── StayCard: check-in card embedded inside a day rail ────────────
interface StayCardProps {
  stay: Stay
  onClick: () => void
}

function StayCard({ stay, onClick }: StayCardProps) {
  const formatBudget = useTripStore((s) => s.formatBudget)
  const item = stay.item
  const meta = (item.metadata || {}) as ItemMetadata
  const rating = meta.rating as number | undefined
  const reviewCount = meta.reviewCount as number | undefined
  const img = item.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop&q=80'

  // Per-night vs total pricing
  const priceRaw = item.price || ''
  const isPerNight = /\/\s*night|per\s*night/i.test(priceRaw)
  const basePrice = parsePrice(priceRaw)
  const perNight = isPerNight ? basePrice : (stay.nights > 0 ? basePrice / stay.nights : basePrice)
  const total = isPerNight ? basePrice * stay.nights : basePrice

  const dayLabel = stay.startDayIdx === stay.endDayIdx
    ? `Day ${stay.startDayIdx + 1}`
    : `Days ${stay.startDayIdx + 1}–${stay.endDayIdx + 1}`

  return (
    <div
      onClick={onClick}
      className="group relative w-[380px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-drift-ok/15 bg-[#0c0c12] transition-all duration-400 hover:border-drift-ok/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
    >
      {/* Top accent stripe */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-drift-ok/40 via-drift-ok/20 to-transparent" />

      <div className="flex">
        {/* Image */}
        <div className="relative h-[140px] w-[130px] shrink-0 overflow-hidden">
          <Image
            src={img}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="130px"
            unoptimized={!img.includes('unsplash.com') && !img.includes('googleusercontent.com')}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[rgba(8,8,12,0.45)]" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3.5 min-w-0">
          {/* Check-in label */}
          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-drift-ok/80">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M14 11h4M6 15h4M14 15h4M10 21V7l2-4 2 4v14" />
            </svg>
            Check in · {dayLabel}
          </div>

          {/* Name */}
          <div className="mt-1 text-[14px] font-semibold leading-snug text-drift-text truncate">{item.name}</div>

          {/* Detail */}
          <div className="mt-0.5 text-[11px] text-drift-text3 line-clamp-1">{item.detail}</div>

          {/* Rating */}
          {rating && rating > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-drift-text3">
              <span className="text-amber-400/80">★</span>
              <span className="font-medium text-drift-text2">{rating.toFixed(1)}</span>
              {reviewCount && reviewCount > 0 && (
                <span className="text-drift-text3/60">({reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount})</span>
              )}
            </div>
          )}

          {/* Price footer */}
          <div className="mt-auto pt-2 flex items-end justify-between gap-3 border-t border-white/[0.05]">
            <div>
              <div className="text-[10px] text-drift-text3 tabular-nums">{stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</div>
              <div className="text-[10px] text-drift-text3/70 tabular-nums">{formatBudget(perNight)}/night</div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-semibold text-drift-text tabular-nums">{formatBudget(total)}</div>
              <div className="text-[8px] uppercase tracking-wider text-drift-text3">total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
