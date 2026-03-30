import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/trips/:id/calendar — download ICS calendar file for a trip
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
    || req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId } = await params
  const supabase = createServerClient(token)

  const [{ data: trip }, { data: items }] = await Promise.all([
    supabase.from('trips').select('destination, country, start_date, end_date, vibes').eq('id', tripId).single(),
    supabase.from('itinerary_items').select('name, detail, category, price, time, metadata').eq('trip_id', tripId).order('position'),
  ])

  if (!trip || !items?.length) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const startDate = new Date(trip.start_date + 'T00:00:00')
  const dest = trip.destination
  const country = trip.country || ''

  // Build day map
  let currentDay = -1
  const dayItems: Array<{ day: number; item: Item }> = []
  for (const item of items) {
    if (item.category === 'day') {
      currentDay++
    } else if (currentDay >= 0) {
      dayItems.push({ day: currentDay, item })
    } else {
      // Items before first day separator (flights, hotel) → day 0
      dayItems.push({ day: 0, item })
    }
  }

  // Default times for items without explicit time
  const defaultTimes: Record<string, string[]> = {
    flight: ['06:00'],
    hotel: ['15:00'],
    activity: ['09:00', '11:00', '14:00', '16:00'],
    food: ['08:00', '12:30', '19:30'],
    transfer: ['10:00'],
  }
  const usedTimes: Record<number, number> = {} // track which default time index per day per category

  type Item = NonNullable<typeof items>[0]

  function getEventTime(item: Item, day: number): string {
    if (item.time) return item.time // explicit time from LLM
    const cat = item.category || 'activity'
    const times = defaultTimes[cat] || defaultTimes.activity
    const key = day * 100 + (cat === 'food' ? 1 : cat === 'activity' ? 2 : 3)
    const idx = usedTimes[key] || 0
    usedTimes[key] = idx + 1
    return times[idx % times.length]
  }

  function formatICSDate(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(date)
    d.setHours(h || 0, m || 0, 0, 0)
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  function formatICSAllDay(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '')
  }

  function escapeICS(text: string): string {
    return (text || '').replace(/[\\;,\n]/g, (c) => c === '\n' ? '\\n' : `\\${c}`).slice(0, 500)
  }

  // Build ICS
  const events: string[] = []

  for (const { day, item } of dayItems) {
    const eventDate = new Date(startDate.getTime() + day * 86400000)
    const meta = (item.metadata || {}) as Record<string, unknown>
    const uid = `drift-${tripId}-${day}-${events.length}@driftntravel.com`

    if (item.category === 'hotel') {
      // Hotel as all-day event spanning nights
      const checkOut = new Date(eventDate.getTime() + 86400000) // at minimum 1 night
      events.push([
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;VALUE=DATE:${formatICSAllDay(eventDate)}`,
        `DTEND;VALUE=DATE:${formatICSAllDay(checkOut)}`,
        `SUMMARY:🏨 ${escapeICS(item.name)}`,
        `DESCRIPTION:${escapeICS(item.detail || '')}${item.price ? `\\nPrice: ${item.price}` : ''}`,
        meta.address ? `LOCATION:${escapeICS(String(meta.address))}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\r\n'))
      continue
    }

    const time = getEventTime(item, day)
    const dtStart = formatICSDate(eventDate, time)
    // Estimate duration: flights 3h, activities 2h, food 1.5h
    const durationMin = item.category === 'flight' ? 180 : item.category === 'activity' ? 120 : 90
    const endDate = new Date(eventDate.getTime() + day * 0)
    const [h, m] = time.split(':').map(Number)
    endDate.setHours(h || 0, m || 0, 0, 0)
    endDate.setMinutes(endDate.getMinutes() + durationMin)

    const catIcons: Record<string, string> = { flight: '✈️', activity: '🏛', food: '🍽', transfer: '🚗' }
    const catIcon = catIcons[item.category] || '📍'

    events.push([
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtStart}`,
      `DTEND:${formatICSDate(eventDate, `${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2, '0')}`)}`,
      `SUMMARY:${catIcon} ${escapeICS(item.name)}`,
      `DESCRIPTION:${escapeICS(item.detail || '')}${item.price ? `\\nPrice: ${item.price}` : ''}${meta.reason ? `\\n\\n${escapeICS(String(meta.reason))}` : ''}`,
      meta.address ? `LOCATION:${escapeICS(String(meta.address))}` : '',
      meta.mapsUrl ? `URL:${String(meta.mapsUrl)}` : '',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n'))
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drift//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${dest}${country ? `, ${country}` : ''} Trip`,
    `X-WR-CALDESC:${(trip.vibes || []).join(', ')} trip planned by Drift`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  const filename = `${dest.toLowerCase().replace(/[^a-z0-9]/g, '-')}-trip.ics`

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
