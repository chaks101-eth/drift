// ─── URL Extraction Enrichment ────────────────────────────────
// After Gemini extracts highlights from a URL, this module enriches
// them with real data from Google Places API + Gemini grounded search.
//
// Replaces the old SerpAPI-based enrichment (quota exhausted).
// Uses the same infrastructure as the main generation flow.

import { batchGetPlaceData, type PlaceData } from './google-places-photos'
import { groundedDestinationSearch, formatGroundedContext } from './grounded-search'

export interface UrlHighlight {
  name: string
  category: string
  detail: string
  estimatedPrice?: string
  inferredFromDestination?: boolean
}

export interface EnrichedHighlight extends UrlHighlight {
  // Real data from Google Places
  rating?: number
  reviewCount?: number
  address?: string
  photoUrls?: string[]
  photos?: string[]
  mapsUrl?: string
  bookingUrl?: string
  website?: string
  priceLevel?: string
  placeId?: string
  lat?: number
  lng?: number
  source: 'google_places' | 'grounded' | 'extracted'
  // Legacy fields for compatibility
  dataId?: string
}

/**
 * Enrich URL-extracted highlights with real Google Places data.
 * Also runs grounded search to verify places and find additional context.
 *
 * @param highlights - Gemini-extracted highlights from URL
 * @param destination - Primary destination (city name)
 * @param country - Country name
 * @returns Enriched highlights with real photos, ratings, GPS, etc.
 */
export async function enrichUrlHighlights(
  highlights: UrlHighlight[],
  destination: string,
  country: string,
): Promise<EnrichedHighlight[]> {
  const start = Date.now()
  console.log(`[URLEnrich] Enriching ${highlights.length} highlights in ${destination}, ${country}`)

  // Run Google Places lookup + grounded verification in PARALLEL
  const [placeDataMap, groundedResult] = await Promise.all([
    // Google Places: photos, ratings, GPS, address for each highlight
    batchGetPlaceData(
      highlights.map(h => ({ name: h.name, category: mapCategory(h.category) })),
      destination,
      country,
    ).catch(e => {
      console.warn(`[URLEnrich] Google Places failed: ${e}`)
      return new Map<string, PlaceData>()
    }),
    // Grounded search: verify places exist, find additional context
    groundedDestinationSearch({
      destination,
      country,
      vibes: [], // no vibes filter for URL extraction
      budget: 'mid',
      travelers: 2,
      days: 5,
    }).catch(e => {
      console.warn(`[URLEnrich] Grounded search failed: ${e}`)
      return null
    }),
  ])

  // Build enriched highlights
  const enriched: EnrichedHighlight[] = highlights.map(h => {
    const placeData = placeDataMap.get(h.name.toLowerCase())

    if (placeData) {
      return {
        ...h,
        rating: placeData.rating,
        reviewCount: placeData.reviewCount,
        address: placeData.address,
        photos: placeData.photoUrl ? [placeData.photoUrl] : undefined,
        photoUrls: placeData.photoUrl ? [placeData.photoUrl] : undefined,
        mapsUrl: placeData.mapsUrl,
        placeId: placeData.placeId,
        lat: placeData.lat,
        lng: placeData.lng,
        source: 'google_places' as const,
      }
    }

    // Check if grounded search found this place
    if (groundedResult) {
      const groundedMatch = groundedResult.places.find(p =>
        p.name.toLowerCase().includes(h.name.toLowerCase().split(' ')[0]) ||
        h.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
      )
      if (groundedMatch) {
        return {
          ...h,
          rating: groundedMatch.rating ? parseFloat(groundedMatch.rating.replace('★', '')) : undefined,
          source: 'grounded' as const,
        }
      }
    }

    return { ...h, source: 'extracted' as const }
  })

  const googleMatched = enriched.filter(e => e.source === 'google_places').length
  const groundedMatched = enriched.filter(e => e.source === 'grounded').length
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[URLEnrich] Done in ${elapsed}s — ${googleMatched} Google Places, ${groundedMatched} grounded, ${highlights.length - googleMatched - groundedMatched} unmatched`)

  return enriched
}

/**
 * Format grounded context from URL enrichment for the generation prompt.
 * Re-exports for compatibility.
 */
export { formatGroundedContext }

function mapCategory(category: string): string {
  if (['hotel', 'accommodation', 'resort', 'hostel'].includes(category)) return 'hotel'
  if (['food', 'restaurant', 'cafe', 'dining'].includes(category)) return 'food'
  return 'activity'
}
