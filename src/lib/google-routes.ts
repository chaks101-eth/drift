// ─── Google Routes API ────────────────────────────────────────
// Real travel times between itinerary items.
// Replaces haversine distance estimates with actual driving/walking times.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY // Same GCP key

export interface TravelTime {
  fromName: string
  toName: string
  distanceMeters: number
  durationSeconds: number
  durationText: string // "18 min"
  distanceText: string // "4.2 km"
  mode: 'DRIVE' | 'WALK'
}

/**
 * Get real travel time between two GPS points.
 */
async function getRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  mode: 'DRIVE' | 'WALK' = 'DRIVE',
): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  if (!API_KEY) return null

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
        destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
        travelMode: mode,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null

    return {
      distanceMeters: route.distanceMeters || 0,
      durationSeconds: parseInt(route.duration?.replace('s', '') || '0'),
    }
  } catch {
    return null
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return '1 min'
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)} km`
}

/**
 * Calculate travel times between consecutive items in a day.
 * Returns array of travel segments with real durations.
 */
export async function getDayTravelTimes(
  items: Array<{ name: string; lat: number; lng: number }>,
): Promise<TravelTime[]> {
  if (!API_KEY || items.length < 2) return []

  const results: TravelTime[] = []

  // Calculate routes between consecutive items in parallel
  const routePromises = items.slice(0, -1).map((from, i) => {
    const to = items[i + 1]
    // Use WALK for distances < 1km (estimated by rough lat/lng diff), DRIVE otherwise
    const roughDistKm = Math.sqrt(
      Math.pow((to.lat - from.lat) * 111, 2) +
      Math.pow((to.lng - from.lng) * 111 * Math.cos(from.lat * Math.PI / 180), 2)
    )
    const mode = roughDistKm < 1 ? 'WALK' as const : 'DRIVE' as const

    return getRoute(from.lat, from.lng, to.lat, to.lng, mode)
      .then(route => ({ from: from.name, to: to.name, route, mode }))
  })

  const routeResults = await Promise.all(routePromises)

  for (const { from, to, route, mode } of routeResults) {
    if (route) {
      results.push({
        fromName: from,
        toName: to,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        durationText: formatDuration(route.durationSeconds),
        distanceText: formatDistance(route.distanceMeters),
        mode,
      })
    }
  }

  return results
}

/**
 * Calculate travel times for entire itinerary, grouped by day.
 * Stores results in item metadata as `travelToNext`.
 */
export async function addTravelTimesToItems(
  items: Array<{
    category: string; name: string; metadata: Record<string, unknown>;
    [key: string]: unknown
  }>,
): Promise<void> {
  if (!API_KEY) return

  // Group items by day, collect GPS-enabled items
  const dayGroups: Array<Array<{ name: string; lat: number; lng: number; itemRef: typeof items[0] }>> = []
  let currentDay: typeof dayGroups[0] = []

  for (const item of items) {
    if (item.category === 'day') {
      if (currentDay.length > 0) dayGroups.push(currentDay)
      currentDay = []
      continue
    }
    const lat = item.metadata?.lat as number
    const lng = item.metadata?.lng as number
    if (lat && lng && item.category !== 'flight' && item.category !== 'transfer') {
      currentDay.push({ name: item.name, lat, lng, itemRef: item })
    }
  }
  if (currentDay.length > 0) dayGroups.push(currentDay)

  console.log(`[Routes] Calculating travel times for ${dayGroups.length} days`)
  const startTime = Date.now()

  // Process all days in parallel
  const allDayResults = await Promise.all(
    dayGroups.map(group => getDayTravelTimes(group).catch(() => []))
  )

  // Store travel times in item metadata
  for (let d = 0; d < dayGroups.length; d++) {
    const group = dayGroups[d]
    const travelTimes = allDayResults[d]

    for (let i = 0; i < travelTimes.length; i++) {
      const travel = travelTimes[i]
      const item = group[i]?.itemRef
      if (item) {
        item.metadata.travelToNext = {
          to: travel.toName,
          duration: travel.durationText,
          distance: travel.distanceText,
          mode: travel.mode === 'WALK' ? 'walk' : 'drive',
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const totalRoutes = allDayResults.reduce((s, r) => s + r.length, 0)
  console.log(`[Routes] ${totalRoutes} travel times calculated in ${elapsed}s`)
}
