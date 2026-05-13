// ─── Multi-Source Place Discovery ──────────────────────────────
// Combines Google Places (bulk search) + SerpAPI (details/reviews)
// to build deep catalog data per destination.

import {
  searchPlaces,
  type GooglePlace,
} from './google-places'
import {
  searchRestaurants as serpSearchRestaurants,
  searchHotels as serpSearchHotels,
  searchAttractions as serpSearchAttractions,
  enrichPlacesWithDetails,
  enrichPlacesWithReviews,
  type PlaceResult,
  type PlaceDetails,
  type PlaceReviewSummary,
} from './serpapi'

// ─── Types ─────────────────────────────────────────────────────

export type CategoryType = 'hotels' | 'activities' | 'restaurants'

export interface DiscoveryResult {
  places: PlaceResult[]
  detailsMap: Map<string, PlaceDetails>
  reviewsMap: Map<string, PlaceReviewSummary>
  stats: {
    googlePlacesResults: number
    serpApiResults: number
    afterDedup: number
    detailsFetched: number
    reviewsFetched: number
  }
}

// ─── Retry wrapper ─────────────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 3,
  baseDelay: number = 2000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const isRetryable = msg.includes('429') || msg.includes('503') || msg.includes('413') || msg.includes('too large')
        || msg.includes('rate') || msg.includes('quota')
        || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')

      if (isRetryable && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`[Retry] ${label} — attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms: ${msg}`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
  throw new Error(`${label}: retries exhausted`)
}

// ─── Google Places → PlaceResult normalizer ────────────────────

function googlePlaceToPlaceResult(gp: GooglePlace): PlaceResult {
  return {
    name: gp.name,
    placeId: gp.placeId,
    dataId: '', // Google Places doesn't have dataId — SerpAPI detail calls won't work for these
    rating: gp.rating,
    reviewCount: gp.reviewCount,
    priceLevel: gp.priceLevel,
    address: gp.address,
    description: gp.description,
    photoUrls: gp.photoUrls,
    type: gp.type,
    mapsUrl: gp.mapsUrl,
    lat: gp.lat,
    lng: gp.lng,
  }
}

// ─── Deduplicate across sources ────────────────────────────────

function deduplicatePlaces(places: PlaceResult[]): PlaceResult[] {
  const seen = new Map<string, PlaceResult>()

  for (const place of places) {
    if (!place.name) continue

    // Prefer match by placeId first
    if (place.placeId && seen.has(`pid:${place.placeId}`)) continue
    if (place.placeId) seen.set(`pid:${place.placeId}`, place)

    // Fuzzy name dedup: normalize to lowercase, remove common suffixes
    const normName = place.name
      .toLowerCase()
      .replace(/\s*(hotel|resort|hostel|restaurant|cafe|bar)\s*$/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()

    if (seen.has(`name:${normName}`)) {
      // Keep the one with more data (higher review count)
      const existing = seen.get(`name:${normName}`)!
      if (place.reviewCount > existing.reviewCount) {
        seen.set(`name:${normName}`, place)
      }
      continue
    }
    seen.set(`name:${normName}`, place)
  }

  return [...new Map([...seen].filter(([k]) => k.startsWith('name:') || k.startsWith('pid:'))).values()]
    // Actually just return unique values — the above is getting complex. Simpler approach:
}

// Simpler dedup that actually works
function dedup(places: PlaceResult[]): PlaceResult[] {
  const result: PlaceResult[] = []
  const seenNames = new Set<string>()
  const seenPlaceIds = new Set<string>()

  for (const place of places) {
    if (!place.name) continue

    // Skip if we've seen this placeId
    if (place.placeId && seenPlaceIds.has(place.placeId)) continue

    // Fuzzy name check
    const normName = place.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
    if (seenNames.has(normName)) continue

    result.push(place)
    seenNames.add(normName)
    if (place.placeId) seenPlaceIds.add(place.placeId)
  }

  return result
}

// ─── Batch Google Places search ────────────────────────────────

async function batchGooglePlacesSearch(queries: string[]): Promise<PlaceResult[]> {
  const allResults: PlaceResult[] = []

  // Run queries in batches of 3 to avoid rate limits
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3)
    const results = await Promise.all(
      batch.map(q =>
        withRetry(
          () => searchPlaces(q, 20),
          `GooglePlaces:${q.slice(0, 40)}`,
        ).catch(err => {
          console.warn(`[Discovery] Google Places query failed: "${q}" — ${err}`)
          return [] as GooglePlace[]
        })
      )
    )

    for (const places of results) {
      allResults.push(...places.map(googlePlaceToPlaceResult))
    }

    // Small delay between batches
    if (i + 3 < queries.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return allResults
}

// ─── SerpAPI backup search ─────────────────────────────────────

async function serpSearch(city: string, country: string, category: CategoryType): Promise<PlaceResult[]> {
  const searchFn = {
    hotels: () => serpSearchHotels(city, country),
    activities: () => serpSearchAttractions(city, country),
    restaurants: () => serpSearchRestaurants(city, country),
  }[category]

  return withRetry(searchFn, `SerpAPI:${category}`).catch(err => {
    console.warn(`[Discovery] SerpAPI ${category} search failed: ${err}`)
    return [] as PlaceResult[]
  })
}

// ─── Main discovery function ───────────────────────────────────

export async function discoverPlaces(
  city: string,
  country: string,
  category: CategoryType,
  queries: string[],
  options: {
    maxDetails?: number
    maxReviews?: number
  } = {},
): Promise<DiscoveryResult> {
  const maxDetails = options.maxDetails ?? 25
  const maxReviews = options.maxReviews ?? 15

  console.log(`[Discovery] ${category}: running ${queries.length} Google Places queries + SerpAPI backup`)

  // Run Google Places and SerpAPI in parallel
  const [googleResults, serpResults] = await Promise.all([
    batchGooglePlacesSearch(queries),
    serpSearch(city, country, category),
  ])

  console.log(`[Discovery] ${category}: Google Places returned ${googleResults.length}, SerpAPI returned ${serpResults.length}`)

  // Merge and deduplicate — prefer SerpAPI entries (they have dataId for detail/review lookups)
  const merged = dedup([...serpResults, ...googleResults])
  console.log(`[Discovery] ${category}: ${merged.length} unique after dedup`)

  // Get details and reviews from SerpAPI for places that have dataId
  const placesWithDataId = merged.filter(p => p.dataId)
  const placesForDetails = placesWithDataId.length > 0 ? placesWithDataId : merged

  const [detailsMap, reviewsMap] = await Promise.all([
    enrichPlacesWithDetails(placesForDetails, maxDetails),
    enrichPlacesWithReviews(placesForDetails, maxReviews),
  ])

  console.log(`[Discovery] ${category}: ${detailsMap.size} details, ${reviewsMap.size} reviews fetched`)

  return {
    places: merged,
    detailsMap,
    reviewsMap,
    stats: {
      googlePlacesResults: googleResults.length,
      serpApiResults: serpResults.length,
      afterDedup: merged.length,
      detailsFetched: detailsMap.size,
      reviewsFetched: reviewsMap.size,
    },
  }
}
