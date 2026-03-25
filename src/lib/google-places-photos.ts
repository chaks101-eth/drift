// ─── Google Places Photos ─────────────────────────────────────
// Fetches real venue photos from Google Maps for itinerary items.
// Uses the Places API Find Place + Photo endpoints.
//
// Pricing: $17 per 1000 Find Place requests + $7 per 1000 Photo requests
// Google gives $200/month free credit → covers ~8000 items/month

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

/**
 * Get a real photo URL for a place from Google Maps.
 * Returns a proxied Google photo URL or null.
 */
export async function getPlacePhoto(
  placeName: string,
  city: string,
  country?: string,
  maxWidth = 800,
): Promise<{ photoUrl: string; rating?: number; placeId?: string } | null> {
  if (!API_KEY) return null

  try {
    // Step 1: Find the place
    const query = encodeURIComponent(`${placeName}, ${city}${country ? ', ' + country : ''}`)
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,photos,rating&key=${API_KEY}`

    const findRes = await fetch(findUrl)
    if (!findRes.ok) return null

    const findData = await findRes.json()
    if (findData.status !== 'OK' || !findData.candidates?.length) return null

    const candidate = findData.candidates[0]
    const photos = candidate.photos || []
    if (!photos.length) return null

    // Step 2: Build photo URL (Google serves the actual image at this URL)
    const photoRef = photos[0].photo_reference
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoRef}&key=${API_KEY}`

    return {
      photoUrl,
      rating: candidate.rating,
      placeId: candidate.place_id,
    }
  } catch {
    return null
  }
}

/**
 * Batch fetch photos for multiple items. Runs in parallel with concurrency limit.
 * Returns a map of item name → photo URL.
 */
export async function batchGetPlacePhotos(
  items: Array<{ name: string; category: string }>,
  city: string,
  country?: string,
): Promise<Map<string, { photoUrl: string; rating?: number }>> {
  if (!API_KEY) return new Map()

  const results = new Map<string, { photoUrl: string; rating?: number }>()

  // Only fetch photos for hotels, activities, food — skip day/transfer/flight
  const photoItems = items.filter(i =>
    ['hotel', 'activity', 'food'].includes(i.category)
  )

  if (!photoItems.length) return results

  console.log(`[Places] Fetching photos for ${photoItems.length} items in ${city}...`)
  const startTime = Date.now()

  // Run in parallel batches of 5 to avoid rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < photoItems.length; i += BATCH_SIZE) {
    const batch = photoItems.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(item => getPlacePhoto(item.name, city, country).catch(() => null))
    )
    for (let j = 0; j < batch.length; j++) {
      if (batchResults[j]) {
        results.set(batch[j].name.toLowerCase(), batchResults[j]!)
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Places] Got ${results.size}/${photoItems.length} photos in ${elapsed}s`)

  return results
}
