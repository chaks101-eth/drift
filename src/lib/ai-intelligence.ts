// ─── Drift Trip Intelligence ─────────────────────────────────
// Spatial, temporal, and pacing analysis using REAL catalog data.
// This is what ChatGPT can't do — we have GPS coords, hours, durations.

import type { ItineraryItem } from './database.types'

// ─── Types ──────────────────────────────────────────────────

export interface TripIssue {
  type: 'proximity' | 'timing' | 'pacing' | 'gap' | 'vibe' | 'scheduling'
  severity: 'info' | 'warn' | 'error'
  day?: number
  message: string
  suggestion?: string
  itemIds?: string[]
}

export interface TripAnalysis {
  issues: TripIssue[]
  score: number // 0-100 trip quality score
  summary: string
  dayBreakdown: DayAnalysis[]
}

export interface DayAnalysis {
  day: number
  theme: string
  itemCount: number
  totalHours: number
  totalDistance: number // km between items
  pacing: 'light' | 'balanced' | 'packed' | 'exhausting'
  issues: TripIssue[]
}

// ─── Geo Helpers ────────────────────────────────────────────

/** Haversine distance between two GPS points in km */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Rough travel time estimate based on distance */
function estimateTravelMinutes(km: number): number {
  if (km < 1) return 5     // walking distance
  if (km < 5) return 15    // short taxi/rickshaw
  if (km < 15) return 30   // cross-city
  if (km < 40) return 60   // outskirts
  return 90                 // far excursion
}

/** Parse duration strings like "2-3 hours", "Full day", "45 min" into minutes */
function parseDurationMinutes(duration: string | undefined | null): number {
  if (!duration) return 90 // default assumption
  const d = duration.toLowerCase()
  if (d.includes('full day')) return 480
  if (d.includes('half day')) return 240
  const hourMatch = d.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*h/)
  if (hourMatch) {
    const low = parseFloat(hourMatch[1])
    const high = hourMatch[2] ? parseFloat(hourMatch[2]) : low
    return ((low + high) / 2) * 60
  }
  const minMatch = d.match(/(\d+)\s*min/)
  if (minMatch) return parseInt(minMatch[1])
  return 90
}

/** Parse time string "09:00" to minutes since midnight */
function parseTimeToMinutes(time: string | undefined | null): number | null {
  if (!time) return null
  const match = time.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

/** Map best_time labels to time ranges (minutes since midnight) */
function bestTimeRange(bestTime: string | undefined): { start: number; end: number } | null {
  if (!bestTime) return null
  const bt = bestTime.toLowerCase()
  if (bt === 'morning') return { start: 360, end: 720 }      // 6am-12pm
  if (bt === 'afternoon') return { start: 720, end: 1020 }    // 12pm-5pm
  if (bt === 'evening') return { start: 1020, end: 1320 }     // 5pm-10pm
  if (bt === 'night') return { start: 1200, end: 1440 }       // 8pm-12am
  return null // "Any"
}

/** Parse opening hours strings like "09:00-18:00" */
function parseHoursRange(hoursStr: string): { open: number; close: number } | null {
  const match = hoursStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/)
  if (!match) return null
  return {
    open: parseInt(match[1]) * 60 + parseInt(match[2]),
    close: parseInt(match[3]) * 60 + parseInt(match[4]),
  }
}

// ─── Item Data Extraction ───────────────────────────────────

interface ItemGeo {
  id: string
  name: string
  category: string
  lat: number | null
  lng: number | null
  time: number | null // minutes since midnight
  duration: number // minutes
  bestTime: string | null
  hours: Array<{ day: string; hours: string }> | null
  day: number
  position: number
}

function extractItemGeo(item: ItineraryItem, dayNum: number): ItemGeo {
  const meta = (item.metadata || {}) as Record<string, unknown>
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    lat: (meta.lat as number) || null,
    lng: (meta.lng as number) || null,
    time: parseTimeToMinutes(item.time),
    duration: parseDurationMinutes((meta.duration as string) || (item.detail?.match(/\d+\s*h/)?.[0]) || null),
    bestTime: (meta.best_time as string) || null,
    hours: (meta.hours as Array<{ day: string; hours: string }>) || null,
    day: dayNum,
    position: item.position,
  }
}

// ─── Core Analysis ──────────────────────────────────────────

/** Group itinerary items by day */
function groupByDay(items: ItineraryItem[]): Map<number, ItineraryItem[]> {
  const days = new Map<number, ItineraryItem[]>()
  let currentDay = 0

  const sorted = [...items].sort((a, b) => a.position - b.position)

  for (const item of sorted) {
    if (item.category === 'day') {
      currentDay++
      continue
    }
    if (!days.has(currentDay)) days.set(currentDay, [])
    days.get(currentDay)!.push(item)
  }

  return days
}

/** Check proximity issues within a day — items far from each other */
function checkProximity(dayItems: ItemGeo[], dayNum: number): TripIssue[] {
  const issues: TripIssue[] = []
  const geoItems = dayItems.filter(i => i.lat && i.lng && i.category !== 'flight' && i.category !== 'transfer')

  for (let i = 0; i < geoItems.length - 1; i++) {
    const a = geoItems[i]
    const b = geoItems[i + 1]
    const dist = distanceKm(a.lat!, a.lng!, b.lat!, b.lng!)
    const travelMin = estimateTravelMinutes(dist)

    if (dist > 15) {
      issues.push({
        type: 'proximity',
        severity: 'warn',
        day: dayNum,
        message: `${a.name} → ${b.name} is ${Math.round(dist)}km apart (~${travelMin} min travel).`,
        suggestion: `Consider swapping the order or moving one to a different day when you're in that area.`,
        itemIds: [a.id, b.id],
      })
    } else if (dist > 30) {
      issues.push({
        type: 'proximity',
        severity: 'error',
        day: dayNum,
        message: `${a.name} → ${b.name} is ${Math.round(dist)}km apart — you'll spend over an hour just traveling.`,
        suggestion: `Move ${b.name} to a day when you're closer, or replace it with something nearby.`,
        itemIds: [a.id, b.id],
      })
    }
  }

  return issues
}

/** Check timing issues — scheduled outside opening hours or wrong time of day */
function checkTiming(dayItems: ItemGeo[], dayNum: number, tripStartDate?: string): TripIssue[] {
  const issues: TripIssue[] = []

  // Figure out day of week if we have trip start date
  let dayOfWeek: string | null = null
  if (tripStartDate) {
    const date = new Date(tripStartDate)
    date.setDate(date.getDate() + dayNum - 1)
    dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()]
  }

  for (const item of dayItems) {
    if (item.category === 'flight' || item.category === 'transfer' || item.category === 'hotel') continue

    // Check if scheduled time conflicts with best_time
    if (item.time && item.bestTime) {
      const range = bestTimeRange(item.bestTime)
      if (range && (item.time < range.start - 60 || item.time > range.end)) {
        issues.push({
          type: 'timing',
          severity: 'info',
          day: dayNum,
          message: `${item.name} is best visited in the ${item.bestTime.toLowerCase()}, but it's scheduled at ${formatTime(item.time)}.`,
          suggestion: `Move it to ${item.bestTime.toLowerCase()} for the best experience.`,
          itemIds: [item.id],
        })
      }
    }

    // Check opening hours for the specific day of week
    if (item.hours && dayOfWeek) {
      const dayHours = item.hours.find(h => h.day.toLowerCase() === dayOfWeek!.toLowerCase())
      if (dayHours) {
        if (dayHours.hours.toLowerCase().includes('closed')) {
          issues.push({
            type: 'scheduling',
            severity: 'error',
            day: dayNum,
            message: `${item.name} is closed on ${dayOfWeek}s.`,
            suggestion: `Move it to another day, or swap it for something open on ${dayOfWeek}.`,
            itemIds: [item.id],
          })
        } else if (item.time) {
          const range = parseHoursRange(dayHours.hours)
          if (range) {
            const endTime = item.time + item.duration
            if (item.time < range.open) {
              issues.push({
                type: 'scheduling',
                severity: 'warn',
                day: dayNum,
                message: `${item.name} doesn't open until ${formatTime(range.open)}, but you have it at ${formatTime(item.time)}.`,
                suggestion: `Push it to ${formatTime(range.open)} or later.`,
                itemIds: [item.id],
              })
            }
            if (endTime > range.close) {
              issues.push({
                type: 'scheduling',
                severity: 'warn',
                day: dayNum,
                message: `${item.name} closes at ${formatTime(range.close)} — you might not have enough time if you arrive at ${formatTime(item.time)}.`,
                suggestion: `Start earlier or plan for a shorter visit.`,
                itemIds: [item.id],
              })
            }
          }
        }
      }
    }
  }

  return issues
}

/** Detect gaps in the day schedule */
function checkGaps(dayItems: ItemGeo[], dayNum: number): TripIssue[] {
  const issues: TripIssue[] = []
  const scheduled = dayItems
    .filter(i => i.time && i.category !== 'hotel' && i.category !== 'flight')
    .sort((a, b) => a.time! - b.time!)

  for (let i = 0; i < scheduled.length - 1; i++) {
    const endCurrent = scheduled[i].time! + scheduled[i].duration
    const startNext = scheduled[i + 1].time!
    const gap = startNext - endCurrent

    if (gap > 180) { // 3+ hour gap
      issues.push({
        type: 'gap',
        severity: 'info',
        day: dayNum,
        message: `${Math.round(gap / 60)}-hour gap between ${scheduled[i].name} (ends ${formatTime(endCurrent)}) and ${scheduled[i + 1].name} (starts ${formatTime(startNext)}).`,
        suggestion: `This is free time — you could explore the area, grab a meal, or I can suggest something nearby.`,
        itemIds: [scheduled[i].id, scheduled[i + 1].id],
      })
    }
  }

  return issues
}

/** Check day-level pacing */
function analyzeDayPacing(dayItems: ItemGeo[], dayNum: number): DayAnalysis {
  const activities = dayItems.filter(i =>
    i.category !== 'hotel' && i.category !== 'flight' && i.category !== 'transfer'
  )

  const totalHours = activities.reduce((sum, i) => sum + i.duration, 0) / 60

  // Calculate total distance if we have GPS data
  let totalDistance = 0
  const geoItems = dayItems.filter(i => i.lat && i.lng && i.category !== 'flight')
  for (let i = 0; i < geoItems.length - 1; i++) {
    totalDistance += distanceKm(geoItems[i].lat!, geoItems[i].lng!, geoItems[i + 1].lat!, geoItems[i + 1].lng!)
  }

  let pacing: DayAnalysis['pacing']
  if (activities.length <= 2 && totalHours < 4) pacing = 'light'
  else if (activities.length <= 4 && totalHours < 8) pacing = 'balanced'
  else if (activities.length <= 6 && totalHours < 11) pacing = 'packed'
  else pacing = 'exhausting'

  const issues: TripIssue[] = []
  if (pacing === 'exhausting') {
    issues.push({
      type: 'pacing',
      severity: 'warn',
      day: dayNum,
      message: `Day ${dayNum} has ${activities.length} activities (~${Math.round(totalHours)}h). That's exhausting.`,
      suggestion: `Move 1-2 activities to a lighter day, or cut the least essential one.`,
    })
  }

  return {
    day: dayNum,
    theme: '', // filled from day separator
    itemCount: activities.length,
    totalHours: Math.round(totalHours * 10) / 10,
    totalDistance: Math.round(totalDistance * 10) / 10,
    pacing,
    issues,
  }
}

/** Check vibe coverage — are the user's selected vibes represented? */
function checkVibeCoverage(items: ItineraryItem[], tripVibes: string[]): TripIssue[] {
  if (!tripVibes.length) return []

  const coveredVibes = new Set<string>()
  for (const item of items) {
    const meta = (item.metadata || {}) as Record<string, unknown>
    const itemVibes = (meta.vibes as string[]) || (meta.best_for as string[]) || []
    for (const v of itemVibes) {
      for (const tv of tripVibes) {
        if (v.toLowerCase().includes(tv.toLowerCase()) || tv.toLowerCase().includes(v.toLowerCase())) {
          coveredVibes.add(tv)
        }
      }
    }
  }

  const missing = tripVibes.filter(v => !coveredVibes.has(v))
  if (missing.length === 0) return []

  return [{
    type: 'vibe',
    severity: missing.length > 1 ? 'warn' : 'info',
    message: `Your "${missing.join(', ')}" vibe${missing.length > 1 ? 's aren\'t' : ' isn\'t'} well represented in this itinerary.`,
    suggestion: `I can search for ${missing[0]}-focused activities to add.`,
  }]
}

// ─── Main Analysis Function ─────────────────────────────────

export function analyzeTrip(
  items: ItineraryItem[],
  options: {
    vibes?: string[]
    startDate?: string
    budget?: string
  } = {}
): TripAnalysis {
  const dayGroups = groupByDay(items)
  const allIssues: TripIssue[] = []
  const dayBreakdowns: DayAnalysis[] = []

  // Get day themes from day separators
  const dayThemes = new Map<number, string>()
  let dayCounter = 0
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    if (item.category === 'day') {
      dayCounter++
      dayThemes.set(dayCounter, item.name)
    }
  }

  for (const [dayNum, dayItems] of dayGroups) {
    if (dayNum === 0) continue // pre-day items (outbound flight)

    const geoItems = dayItems.map(i => extractItemGeo(i, dayNum))

    // Run all checks
    const proximityIssues = checkProximity(geoItems, dayNum)
    const timingIssues = checkTiming(geoItems, dayNum, options.startDate)
    const gapIssues = checkGaps(geoItems, dayNum)
    const dayAnalysis = analyzeDayPacing(geoItems, dayNum)
    dayAnalysis.theme = dayThemes.get(dayNum) || `Day ${dayNum}`

    allIssues.push(...proximityIssues, ...timingIssues, ...gapIssues, ...dayAnalysis.issues)
    dayBreakdowns.push(dayAnalysis)
  }

  // Trip-level checks
  if (options.vibes) {
    allIssues.push(...checkVibeCoverage(items, options.vibes))
  }

  // Calculate quality score
  const errorCount = allIssues.filter(i => i.severity === 'error').length
  const warnCount = allIssues.filter(i => i.severity === 'warn').length
  const infoCount = allIssues.filter(i => i.severity === 'info').length
  const score = Math.max(0, Math.min(100,
    100 - (errorCount * 15) - (warnCount * 7) - (infoCount * 2)
  ))

  // Build summary
  const summaryParts: string[] = []
  if (errorCount > 0) summaryParts.push(`${errorCount} issue${errorCount > 1 ? 's' : ''} to fix`)
  if (warnCount > 0) summaryParts.push(`${warnCount} thing${warnCount > 1 ? 's' : ''} to improve`)
  if (infoCount > 0) summaryParts.push(`${infoCount} suggestion${infoCount > 1 ? 's' : ''}`)
  const packedDays = dayBreakdowns.filter(d => d.pacing === 'packed' || d.pacing === 'exhausting')
  const lightDays = dayBreakdowns.filter(d => d.pacing === 'light')
  if (packedDays.length) summaryParts.push(`${packedDays.length} packed day${packedDays.length > 1 ? 's' : ''}`)
  if (lightDays.length) summaryParts.push(`${lightDays.length} light day${lightDays.length > 1 ? 's' : ''}`)

  return {
    issues: allIssues,
    score,
    summary: summaryParts.length ? summaryParts.join(', ') : 'Trip looks well-planned!',
    dayBreakdown: dayBreakdowns,
  }
}

// ─── Planning Notes (fed into generation prompt) ────────────

export interface PlanningNote {
  type: 'cluster' | 'timing' | 'pairing'
  note: string
}

/** Generate planning notes from catalog data to feed into the generation prompt.
 * This gives the LLM spatial + temporal intelligence it wouldn't otherwise have. */
export function generatePlanningNotes(
  catalogItems: Array<{
    name: string
    category: string
    metadata: Record<string, unknown>
    location?: string
  }>
): PlanningNote[] {
  const notes: PlanningNote[] = []

  // Extract GPS-enabled items
  const geoItems = catalogItems
    .filter(i => (i.metadata?.lat as number) && (i.metadata?.lng as number))
    .map(i => ({
      name: i.name,
      category: i.category,
      lat: i.metadata.lat as number,
      lng: i.metadata.lng as number,
      bestTime: i.metadata.best_time as string | undefined,
      duration: i.metadata.duration as string | undefined,
      hours: i.metadata.hours as Array<{ day: string; hours: string }> | undefined,
      pairsWith: i.metadata.pairs_with as string[] | undefined,
    }))

  if (geoItems.length < 2) return notes

  // Find geographic clusters (items within 2km of each other)
  const clustered = new Set<string>()
  for (let i = 0; i < geoItems.length; i++) {
    const nearby: string[] = []
    for (let j = i + 1; j < geoItems.length; j++) {
      const dist = distanceKm(geoItems[i].lat, geoItems[i].lng, geoItems[j].lat, geoItems[j].lng)
      if (dist < 2) {
        nearby.push(geoItems[j].name)
      }
    }
    if (nearby.length >= 1 && !clustered.has(geoItems[i].name)) {
      clustered.add(geoItems[i].name)
      nearby.forEach(n => clustered.add(n))
      notes.push({
        type: 'cluster',
        note: `${geoItems[i].name} is walking distance from ${nearby.join(', ')} — schedule them on the same day.`,
      })
    }
  }

  // Time-of-day notes
  for (const item of geoItems) {
    if (item.bestTime && item.bestTime !== 'Any') {
      notes.push({
        type: 'timing',
        note: `${item.name} is best visited in the ${item.bestTime.toLowerCase()}${item.duration ? ` (takes ${item.duration})` : ''}.`,
      })
    }
  }

  // Pairing notes from catalog
  for (const item of geoItems) {
    if (item.pairsWith?.length) {
      const validPairs = item.pairsWith.filter(p =>
        geoItems.some(g => g.name.toLowerCase().includes(p.toLowerCase().split(' ')[0]))
      )
      if (validPairs.length) {
        notes.push({
          type: 'pairing',
          note: `${item.name} pairs well with ${validPairs.join(', ')}.`,
        })
      }
    }
  }

  return notes
}

// ─── Format for LLM Context ────────────────────────────────

/** Format trip analysis as concise text for LLM system prompt */
export function formatAnalysisForLLM(analysis: TripAnalysis): string {
  const lines: string[] = [`Trip quality: ${analysis.score}/100 — ${analysis.summary}`]

  const errors = analysis.issues.filter(i => i.severity === 'error')
  const warns = analysis.issues.filter(i => i.severity === 'warn')

  if (errors.length) {
    lines.push('\nISSUES TO FIX:')
    for (const e of errors) lines.push(`  ⚠ ${e.message}`)
  }

  if (warns.length) {
    lines.push('\nCAN IMPROVE:')
    for (const w of warns) lines.push(`  • ${w.message}`)
  }

  // Day pacing summary
  const pacingMap = analysis.dayBreakdown.map(d =>
    `${d.theme}: ${d.pacing} (${d.itemCount} items, ~${d.totalHours}h${d.totalDistance > 0 ? `, ${d.totalDistance}km travel` : ''})`
  )
  if (pacingMap.length) {
    lines.push('\nDAY PACING:')
    pacingMap.forEach(p => lines.push(`  ${p}`))
  }

  return lines.join('\n')
}

/** Format planning notes as text for generation prompt */
export function formatPlanningNotes(notes: PlanningNote[]): string {
  if (!notes.length) return ''

  const clusters = notes.filter(n => n.type === 'cluster')
  const timing = notes.filter(n => n.type === 'timing')
  const pairings = notes.filter(n => n.type === 'pairing')

  const lines: string[] = ['\n\nPLANNING INTELLIGENCE (use this to make smarter decisions):']

  if (clusters.length) {
    lines.push('\nGeographic clusters (schedule together):')
    clusters.forEach(c => lines.push(`  • ${c.note}`))
  }

  if (timing.length) {
    lines.push('\nBest times:')
    timing.forEach(t => lines.push(`  • ${t.note}`))
  }

  if (pairings.length) {
    lines.push('\nGood pairings:')
    pairings.forEach(p => lines.push(`  • ${p.note}`))
  }

  return lines.join('\n')
}

// ─── Helpers ────────────────────────────────────────────────

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}
