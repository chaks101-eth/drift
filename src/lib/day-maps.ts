// ─── Day Maps (Google Maps Static API) ────────────────────────
// Generates a visual map image for each day of the itinerary
// showing numbered pins for each activity location.
// Dark-themed to match Drift's design language.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY // Same GCP key

/**
 * Generate a Google Maps Static API URL for a day's activities.
 * Returns a URL that serves a PNG map image with numbered pins.
 */
export function buildDayMapUrl(
  items: Array<{ lat: number; lng: number; name: string; position: number }>,
  width = 400,
  height = 200,
): string | null {
  if (!API_KEY || items.length === 0) return null

  // Build marker params — numbered pins in gold color
  const markers = items
    .slice(0, 9) // Maps Static API supports labels 1-9
    .map((item, i) =>
      `markers=color:0xc8a44e|label:${i + 1}|${item.lat},${item.lng}`
    )
    .join('&')

  // Dark theme styling to match Drift UI
  const styles = [
    'style=feature:all|element:geometry|color:0x1a1a2e',
    'style=feature:all|element:labels.text.fill|color:0xe0dfd8',
    'style=feature:all|element:labels.text.stroke|color:0x1a1a2e|weight:3',
    'style=feature:water|element:geometry|color:0x0e0e14',
    'style=feature:road|element:geometry|color:0x2a2a3e',
    'style=feature:road|element:geometry.stroke|color:0x1a1a2e',
    'style=feature:poi|element:geometry|color:0x22223a',
    'style=feature:poi.park|element:geometry|color:0x1a2e1a',
    'style=feature:transit|element:geometry|color:0x2a2a3e',
  ].join('&')

  // If only one point, center on it with zoom 14
  // If multiple points, let Google auto-fit
  const bounds = items.length === 1
    ? `center=${items[0].lat},${items[0].lng}&zoom=14`
    : '' // Google auto-fits when no center/zoom specified

  return `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&maptype=roadmap&${bounds}&${markers}&${styles}&key=${API_KEY}`
}

/**
 * Generate map URLs for each day of an itinerary.
 * Groups items by day (using "day" separator items) and creates a map per day.
 * Returns a map of day number → map URL.
 */
export function buildItineraryMaps(
  items: Array<{
    category: string
    name: string
    metadata: Record<string, unknown>
    position: number
  }>,
): Map<number, string> {
  if (!API_KEY) return new Map()

  const dayMaps = new Map<number, string>()
  let currentDay = 0
  let currentDayItems: Array<{ lat: number; lng: number; name: string; position: number }> = []

  for (const item of items) {
    if (item.category === 'day') {
      // Save previous day's map
      if (currentDay > 0 && currentDayItems.length > 0) {
        const mapUrl = buildDayMapUrl(currentDayItems)
        if (mapUrl) dayMaps.set(currentDay, mapUrl)
      }
      currentDay++
      currentDayItems = []
      continue
    }

    // Add item if it has GPS coordinates
    const lat = item.metadata?.lat as number
    const lng = item.metadata?.lng as number
    if (lat && lng && item.category !== 'flight' && item.category !== 'transfer') {
      currentDayItems.push({ lat, lng, name: item.name, position: item.position })
    }
  }

  // Save last day
  if (currentDay > 0 && currentDayItems.length > 0) {
    const mapUrl = buildDayMapUrl(currentDayItems)
    if (mapUrl) dayMaps.set(currentDay, mapUrl)
  }

  return dayMaps
}
