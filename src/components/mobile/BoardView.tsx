'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import type { Trip, ItineraryItem, ItemMetadata } from '@/stores/trip-store'
import { parsePrice } from '@/lib/parse-price'
import FlightCard from '@/components/mobile/cards/FlightCard'
import ItemCard from '@/components/mobile/cards/ItemCard'
import MobileGroupSheet from '@/components/mobile/GroupSheet'
import { trackEvent } from '@/lib/analytics'
import { useReactions } from '@/hooks/useCollaboration'
import { usePolls, useGroupTrip } from '@/hooks/useGroupTrip'
import { useCollaborators } from '@/hooks/useCollaboration'

// Interactive map — same Leaflet-based component used on desktop
const TripMap = dynamic(() => import('@/components/desktop/TripMap'), { ssr: false })

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

interface Stay {
  item: ItineraryItem
  startDayIdx: number
  endDayIdx: number
  nights: number
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
  const { formatBudget, isAnonymous, token, userId } = useTripStore()
  const { reactions, toggleReaction } = useReactions(trip.id)
  const { polls, createPoll, vote, applyPoll, closePoll } = usePolls(trip.id)
  const { notes } = useGroupTrip(trip.id)
  const { collaborators } = useCollaborators(trip.id)
  // Only treat as "group" when at least one invite has been accepted
  const hasGroup = collaborators.some(c => c.accepted_at)
  const isOwner = trip.user_id === userId
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeDay, setActiveDay] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showDiscoveryHint, setShowDiscoveryHint] = useState(false)
  const [insightOpen, setInsightOpen] = useState(false)
  const [showMaps, setShowMaps] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [lastSeenGroup, setLastSeenGroup] = useState<number>(0)

  // Read last-seen timestamp for this trip on mount; write when user opens the sheet
  useEffect(() => {
    try {
      const key = `drift-group-seen-${trip.id}`
      const v = localStorage.getItem(key)
      setLastSeenGroup(v ? parseInt(v, 10) : 0)
    } catch {}
  }, [trip.id])

  // Any signal that deserves a pulse: open poll, a new note since last open,
  // or a new collaborator joined since last open. We use note timestamps as a
  // rough "activity" signal since polls don't have created_at and collaborators
  // track accepted_at.
  const latestNoteAt = notes.length > 0 ? new Date(notes[notes.length - 1].createdAt).getTime() : 0
  const latestJoinAt = collaborators
    .filter(c => c.accepted_at)
    .reduce((max, c) => Math.max(max, new Date(c.accepted_at!).getTime()), 0)
  const openPollCount = polls.filter(p => p.status === 'open').length
  const hasNewActivity = openPollCount > 0 || latestNoteAt > lastSeenGroup || latestJoinAt > lastSeenGroup

  const handleOpenGroup = () => {
    setGroupOpen(true)
    try {
      const now = Date.now()
      localStorage.setItem(`drift-group-seen-${trip.id}`, String(now))
      setLastSeenGroup(now)
    } catch {}
  }

  // Show "tap to see why" hint once per session on first board visit
  useEffect(() => {
    try {
      if (!sessionStorage.getItem('drift-hint-seen')) {
        const t = setTimeout(() => setShowDiscoveryHint(true), 2000)
        return () => clearTimeout(t)
      }
    } catch { /* SSR */ }
  }, [])

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
  const { days, tripBrief } = useMemo(() => {
    const dayList: Day[] = []
    let curDay: Day | null = null
    let preItems: ItineraryItem[] = []
    let brief = ''

    items.forEach((item) => {
      if (item.category === 'day') {
        if (curDay) dayList.push(curDay)
        const dayLabel = item.name.replace(/^Day\s*\d+\s*[:—–\-]\s*/i, '').trim() || item.detail || `Day ${dayList.length + 1}`
        const meta = (item.metadata || {}) as ItemMetadata
        if (meta.trip_brief) brief = meta.trip_brief as string
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

    return { days: dayList, tripBrief: brief }
  }, [items])

  const briefText = tripBrief || getFallbackBrief(trip.vibes || [])

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
      {/* ─── Header — trip identity + actions ─── */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[22px] font-light text-drift-text leading-tight">
              {trip.destination}
              {trip.country && <span className="text-drift-text3 font-light italic">, {trip.country}</span>}
            </h1>
            <p className="mt-1 font-mono text-[10px] tracking-[0.5px] text-drift-text3">
              {fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}{yr ? `, ${yr}` : ''} · {nights}N · {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}
            </p>
          </div>
          {/* Actions */}
          <div className="flex gap-1.5 shrink-0">
            {/* Group — open sheet to share link, see people, notes, votes */}
            <button
              onClick={handleOpenGroup}
              aria-label="Group"
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                hasGroup
                  ? 'border-drift-gold/25 bg-drift-gold/[0.06] text-drift-gold'
                  : 'border-drift-border2 bg-drift-surface text-drift-text2'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              {/* Activity pulse — new notes, new joiners, or open polls */}
              {hasNewActivity && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-drift-gold opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-drift-gold ring-2 ring-drift-bg" />
                </span>
              )}
            </button>

            <button
              onClick={() => setShowMaps(!showMaps)}
              aria-label={showMaps ? 'Hide maps' : 'Show maps'}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                showMaps
                  ? 'border-drift-gold/30 bg-drift-gold/10 text-drift-gold'
                  : 'border-drift-border2 bg-drift-surface text-drift-text2'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><path d="M8 2v16" /><path d="M16 6v16" />
              </svg>
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share trip"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (token) window.open(`/api/trips/${trip.id}/calendar?token=${token}`, '_blank')
              }}
              aria-label="Export to Calendar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text2 active:scale-95 transition-transform"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>
        </div>

        {/* "Why this trip" — collapsible pill */}
        {briefText && (
          <div className="mt-4">
            {!insightOpen ? (
              <button
                onClick={() => setInsightOpen(true)}
                className="group flex w-full items-center gap-2 rounded-full border border-drift-gold/20 bg-drift-gold/[0.04] px-3.5 py-2 text-left text-[11px] text-drift-gold active:bg-drift-gold/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-drift-gold/70">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                <span>Why Drift composed this trip</span>
                <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto opacity-50">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : (
              <div className="rounded-xl border border-drift-border2 bg-drift-surface p-4 animate-[fadeUp_0.3s_ease]">
                <div className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-0.5 shrink-0 text-drift-gold/70">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-[9px] font-semibold uppercase tracking-[1.5px] text-drift-text3 mb-1.5">Why this trip</div>
                    <div className="text-[12px] text-drift-text2 leading-relaxed">{briefText}</div>
                  </div>
                  <button onClick={() => setInsightOpen(false)} className="shrink-0 text-drift-text3 -mt-1 p-1 text-lg leading-none">&times;</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Discovery hint — compact one-liner */}
      {showDiscoveryHint && (
        <button
          onClick={() => { setShowDiscoveryHint(false); try { sessionStorage.setItem('drift-hint-seen', '1') } catch {} }}
          className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] text-drift-text3 active:bg-white/[0.03] transition-colors animate-[fadeUp_0.4s_var(--ease-smooth)]"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-60">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          <span className="flex-1 text-left">Tap any item to see why — swap alternatives inline</span>
          <span className="shrink-0 opacity-50">×</span>
        </button>
      )}

      {/* Save trip prompt — compact, only for anon users */}
      {isAnonymous && !authPromptDismissed && (
        <div className="mx-5 mt-3 flex items-center gap-2.5 rounded-xl border border-drift-gold/15 bg-drift-gold/[0.04] px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-drift-text">Save this trip</div>
            <div className="text-[9px] text-drift-text3">Sign in to keep it forever</div>
          </div>
          <a
            href="/m/login"
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#1a1a1a]"
          >
            <svg width="11" height="11" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </a>
          <button onClick={dismissAuthPrompt} className="shrink-0 p-0.5 text-drift-text3" aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Budget warning — compact */}
      {overBudgetPct > 15 && totalCost > budgetTarget && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-drift-warn/20 bg-drift-warn/[0.04] px-3 py-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="1.5" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="flex-1 text-[10px] text-drift-text2">
            <span className="font-semibold text-drift-warn">~{overBudgetPct}% over budget.</span>{' '}
            <button onClick={() => openChat('Help me reduce the budget for this trip')} className="font-semibold text-drift-gold">Adjust →</button>
          </p>
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
          <div key={di} data-day={di} className="mb-7">
            {/* Day header — single line, editorial */}
            <div className="mb-4 flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-drift-gold/80" />
              <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[1.5px] text-drift-text3">Day {di + 1}</span>
              {day.label && !day.label.toLowerCase().startsWith('day ') && (
                <span className="shrink-0 text-[12px] font-medium text-drift-text truncate max-w-[140px]">{day.label}</span>
              )}
              <div className="flex-1 h-px bg-white/[0.05]" />
              {day.weather && (
                <div className="flex shrink-0 items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                    {day.weather.isRainy ? (
                      <><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25" stroke="#60a5fa" /><path d="M8 19v2M12 19v2M16 19v2" stroke="#60a5fa" /></>
                    ) : day.weather.isSunny ? (
                      <><circle cx="12" cy="12" r="4" stroke="#fbbf24" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#fbbf24" /></>
                    ) : (
                      <><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M17.66 6.34l1.41-1.41M2 12h4" stroke="#9ca3af" /><path d="M17.5 21H9a5 5 0 01-.5-9.97A7 7 0 0117 10a4.5 4.5 0 01.5 11z" stroke="#9ca3af" /></>
                    )}
                  </svg>
                  <span className={`font-mono text-[10px] ${day.weather.isRainy ? 'text-blue-400/80' : day.weather.isSunny ? 'text-amber-400/80' : 'text-drift-text3'}`}>
                    {day.weather.tempMax}°
                  </span>
                </div>
              )}
            </div>

            {/* Day map — interactive Leaflet, shown when map toggle is on */}
            {showMaps && day.items.some(it => {
              const m = (it.metadata || {}) as ItemMetadata
              return typeof m.lat === 'number' && typeof m.lng === 'number'
            }) && (
              <div className="mb-3 animate-[fadeUp_0.3s_var(--ease-smooth)]">
                <TripMap items={day.items} height="180px" />
              </div>
            )}

            {/* Arrival flight — flights that come BEFORE the first activity of the day */}
            {(() => {
              const firstNonFlight = day.items.findIndex(it => it.category !== 'flight' && it.category !== 'hotel' && it.category !== 'transfer')
              const arrivals = firstNonFlight === -1
                ? [] // no activities — flights are all "arrival" style
                : day.items.slice(0, firstNonFlight).filter(it => it.category === 'flight')
              return arrivals.map(item => (
                <div key={item.id} className="mb-3">
                  <FlightCard item={item} onTap={() => openDetail(item.id)} />
                </div>
              ))
            })()}

            {/* Stay check-in — appears above the day's activities */}
            {stays.filter(s => s.startDayIdx === di).map(stay => (
              <StayCard key={`stay-${stay.item.id}`} stay={stay} onClick={() => openDetail(stay.item.id)} />
            ))}

            {/* Day timeline — activities, food, departure flights in chronological order */}
            <div className="ml-1.5 space-y-3 border-l border-drift-border2 pl-6">
              {(() => {
                const firstNonFlight = day.items.findIndex(it => it.category !== 'flight' && it.category !== 'hotel' && it.category !== 'transfer')
                const arrivalIds = firstNonFlight === -1
                  ? new Set<string>()
                  : new Set(day.items.slice(0, firstNonFlight).filter(it => it.category === 'flight').map(it => it.id))
                return day.items.map((item, ii) => {
                // Arrival flights already rendered above
                if (item.category === 'flight' && arrivalIds.has(item.id)) return null
                if (item.category === 'transfer') return null

                // Hotels are now shown as StayCard above the day timeline — skip here
                if (item.category === 'hotel') return null

                // Departure flights — render inline in timeline
                if (item.category === 'flight') {
                  return (
                    <div key={item.id} className="-ml-6 pl-0">
                      <FlightCard item={item} onTap={() => openDetail(item.id)} />
                    </div>
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
                      {...(hasGroup ? { reaction: reactions[item.id], onReact: () => toggleReaction(item.id), onStartPoll: () => createPoll(item.id), poll: polls.find(p => p.itemId === item.id), onVote: (i: number) => vote(item.id, i), onApplyPoll: () => applyPoll(item.id), onClosePoll: () => closePoll(item.id), isOwner } : {})}
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
              })
              })()}

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

      {/* Plan another trip */}
      <div className="mx-5 mt-4 mb-4">
        <button
          onClick={() => {
            useTripStore.getState().resetOnboarding()
            window.location.href = '/m/plan/vibes'
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-drift-border2 py-3 text-[11px] font-semibold text-drift-text3 transition-all active:scale-[0.98]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Plan Another Trip
        </button>
      </div>

      {/* ─── Group collaboration sheet ─── */}
      <MobileGroupSheet
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        tripId={trip.id}
        isOwner={isOwner}
      />
    </div>
  )
}

// ─── StayCard: check-in card that precedes the day timeline ───
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
    <button
      onClick={onClick}
      className="group relative mb-3 w-full overflow-hidden rounded-2xl border border-drift-ok/15 bg-[#0c0c12] text-left transition-all active:scale-[0.99]"
    >
      {/* Top accent stripe */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-drift-ok/50 via-drift-ok/20 to-transparent" />

      <div className="flex">
        {/* Image */}
        <div className="relative h-[112px] w-[104px] shrink-0 overflow-hidden">
          <Image
            src={img}
            alt={item.name}
            fill
            className="object-cover"
            sizes="104px"
            unoptimized={!img.includes('unsplash.com') && !img.includes('googleusercontent.com')}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[rgba(8,8,12,0.45)]" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3 min-w-0">
          {/* Check-in label */}
          <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[1.5px] text-drift-ok/80">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M14 11h4M6 15h4M14 15h4M10 21V7l2-4 2 4v14" />
            </svg>
            Check in · {dayLabel}
          </div>

          {/* Name */}
          <div className="mt-1 text-[13px] font-semibold leading-snug text-drift-text truncate">{item.name}</div>

          {/* Detail */}
          {item.detail && <div className="mt-0.5 text-[10px] text-drift-text3 line-clamp-1">{item.detail}</div>}

          {/* Rating */}
          {rating && rating > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[9px] text-drift-text3">
              <span className="text-amber-400/80">★</span>
              <span className="font-medium text-drift-text2">{rating.toFixed(1)}</span>
              {reviewCount && reviewCount > 0 && (
                <span className="text-drift-text3/60">({reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount})</span>
              )}
            </div>
          )}

          {/* Price footer */}
          <div className="mt-auto pt-1.5 flex items-end justify-between gap-2 border-t border-white/[0.05]">
            <div>
              <div className="text-[9px] text-drift-text3 tabular-nums">{stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</div>
              {perNight > 0 && <div className="text-[9px] text-drift-text3/70 tabular-nums">{formatBudget(perNight)}/night</div>}
            </div>
            {total > 0 && (
              <div className="text-right">
                <div className="text-[12px] font-semibold text-drift-text tabular-nums">{formatBudget(total)}</div>
                <div className="text-[7px] uppercase tracking-wider text-drift-text3">total</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
