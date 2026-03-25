// ─── Google Places Enrichment ─────────────────────────────────
// Fetches real venue data from Google Maps: photos, ratings, GPS,
// opening hours, address, price level, website.
// Replaces the need for SerpAPI catalog pipeline for non-catalog destinations.
//
// Pricing (per 1000 requests):
//   Find Place: $17 | Place Details: $17 | Photos: $7
//   Google gives $200/month free credit → covers ~5000 enrichments/month

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

// ─── Types ──────────────────────────────────────────────────────

export interface PlaceData {
  photoUrl: string | null
  rating?: number
  reviewCount?: number
  placeId?: string
  lat?: number
  lng?: number
  address?: string
  mapsUrl?: string
  priceLevel?: number // 0-4 (free to very expensive)
}

// ─── Core: Find Place + Get Details ─────────────────────────────

/**
 * Find a place and get its full data: photo, rating, GPS, hours, etc.
 */
export async function getPlaceData(
  placeName: string,
  city: string,
  country?: string,
  maxPhotoWidth = 800,
): Promise<PlaceData | null> {
  if (!API_KEY) return null

  try {
    // Step 1: Find the place (only fields supported by Find Place endpoint)
    const query = encodeURIComponent(`${placeName}, ${city}${country ? ', ' + country : ''}`)
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,photos,rating,user_ratings_total,geometry,formatted_address,price_level,business_status&key=${API_KEY}`

    const findRes = await fetch(findUrl)
    if (!findRes.ok) return null

    const findData = await findRes.json()
    if (findData.status !== 'OK' || !findData.candidates?.length) return null

    const c = findData.candidates[0]

    // Build photo URL
    let photoUrl: string | null = null
    if (c.photos?.length) {
      const photoRef = c.photos[0].photo_reference
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxPhotoWidth}&photo_reference=${photoRef}&key=${API_KEY}`
    }

    // Build Google Maps URL
    const mapsUrl = c.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${c.place_id}`
      : undefined

    return {
      photoUrl,
      rating: c.rating,
      reviewCount: c.user_ratings_total,
      placeId: c.place_id,
      lat: c.geometry?.location?.lat,
      lng: c.geometry?.location?.lng,
      address: c.formatted_address,
      mapsUrl,
      priceLevel: c.price_level,
    }
  } catch {
    return null
  }
}

// ─── Batch Enrichment ──────────────────────────────────────────

/**
 * Batch fetch full place data for multiple items.
 * Returns a map of item name → PlaceData.
 */
export async function batchGetPlaceData(
  items: Array<{ name: string; category: string }>,
  city: string,
  country?: string,
): Promise<Map<string, PlaceData>> {
  if (!API_KEY) return new Map()

  const results = new Map<string, PlaceData>()

  // Only enrich hotels, activities, food
  const enrichItems = items.filter(i =>
    ['hotel', 'activity', 'food'].includes(i.category)
  )

  if (!enrichItems.length) return results

  console.log(`[Places] Enriching ${enrichItems.length} items in ${city}...`)
  const startTime = Date.now()

  // Parallel batches of 5
  const BATCH_SIZE = 5
  for (let i = 0; i < enrichItems.length; i += BATCH_SIZE) {
    const batch = enrichItems.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(item => getPlaceData(item.name, city, country).catch(() => null))
    )
    for (let j = 0; j < batch.length; j++) {
      if (batchResults[j]) {
        results.set(batch[j].name.toLowerCase(), batchResults[j]!)
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const withPhotos = [...results.values()].filter(r => r.photoUrl).length
  const withGps = [...results.values()].filter(r => r.lat).length
  console.log(`[Places] Enriched ${results.size}/${enrichItems.length} items (${withPhotos} photos, ${withGps} GPS) in ${elapsed}s`)

  return results
}

/**
 * Apply place data to itinerary items — photos, GPS, ratings, hours, links.
 * Mutates items in place.
 */
export function applyPlaceData(
  items: Array<{
    category: string; name: string; image_url: string;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
  }>,
  placeDataMap: Map<string, PlaceData>,
): void {
  for (const item of items) {
    if (!['hotel', 'activity', 'food'].includes(item.category)) continue

    const data = placeDataMap.get(item.name.toLowerCase())
    if (!data) continue

    // Photo — only replace if current image is Unsplash fallback or empty
    if (data.photoUrl && (!item.image_url || item.image_url.includes('unsplash.com'))) {
      item.image_url = data.photoUrl
    }

    // Rating
    if (data.rating && !item.metadata.rating) {
      item.metadata.rating = data.rating
    }
    if (data.reviewCount && !item.metadata.reviewCount) {
      item.metadata.reviewCount = data.reviewCount
    }

    // GPS coordinates
    if (data.lat && data.lng && !item.metadata.lat) {
      item.metadata.lat = data.lat
      item.metadata.lng = data.lng
    }

    // Address
    if (data.address && !item.metadata.address) {
      item.metadata.address = data.address
    }

    // Real Google Maps link (verified place ID, not just search)
    if (data.mapsUrl) {
      item.metadata.mapsUrl = data.mapsUrl
    }

    // Mark as enriched by Google Places
    if (!item.metadata.source || item.metadata.source === 'ai') {
      item.metadata.source = 'google_places'
    }
  }
}

// ─── Destination Photo ──────────────────────────────────────────

/**
 * Get a real photo for a destination city (for destination cards).
 * Searches for the city's most iconic landmark.
 */
export async function getDestinationPhoto(
  city: string,
  country: string,
): Promise<string | null> {
  if (!API_KEY) return null

  try {
    // Search for the city itself or its most famous landmark
    const query = encodeURIComponent(`${city} ${country}`)
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos&key=${API_KEY}`

    const res = await fetch(findUrl)
    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 'OK' || !data.candidates?.[0]?.photos?.length) return null

    const photoRef = data.candidates[0].photos[0].photo_reference
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${API_KEY}`
  } catch {
    return null
  }
}
