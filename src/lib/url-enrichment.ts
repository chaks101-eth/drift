// ─── URL Extraction Enrichment (Mini-Pipeline) ──────────────
// After Gemini extracts highlights from a URL, this module enriches
// them with real SerpAPI data: photos, ratings, addresses, booking links.
// Uses ~3-5 SerpAPI calls (vs full pipeline's 30+), focused on the
// specific places mentioned in the content.

import { searchPlace, getPlaceDetails, type PlaceResult, type PlaceDetails } from './serpapi'
import { upsizeGoogleImage } from './images'

export interface UrlHighlight {
  name: string
  category: string
  detail: string
  estimatedPrice?: string
  inferredFromDestination?: boolean
}

export interface EnrichedHighlight extends UrlHighlight {
  // Real data from SerpAPI
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
  dataId?: string
  source: 'serpapi' | 'extracted'
}

// Match score: how well a SerpAPI result matches an extracted highlight
function matchScore(highlight: UrlHighlight, place: PlaceResult): number {
  const hName = highlight.name.toLowerCase()
  const pName = place.name.toLowerCase()

  // Exact match
  if (hName === pName) return 100

  // One contains the other
  if (pName.includes(hName) || hName.includes(pName)) return 80

  // Word overlap
  const hWords = hName.split(/\s+/).filter(w => w.length > 2)
  const pWords = pName.split(/\s+/).filter(w => w.length > 2)
  const overlap = hWords.filter(w => pWords.some(pw => pw.includes(w) || w.includes(pw))).length
  if (overlap >= 2) return 60 + (overlap * 5)
  if (overlap === 1 && hWords.length <= 2) return 50

  return 0
}

/**
 * Enrich URL-extracted highlights with real SerpAPI data.
 * Strategy: batch highlights by category, run 1 search per batch,
 * match results back to highlights by name similarity.
 *
 * @param highlights - Gemini-extracted highlights from URL
 * @param destination - Primary destination (city name)
 * @param country - Country name
 * @returns Enriched highlights with real photos, ratings, etc.
 */
export async function enrichUrlHighlights(
  highlights: UrlHighlight[],
  destination: string,
  country: string,
): Promise<EnrichedHighlight[]> {
  const start = Date.now()
  console.log(`[URLEnrich] Starting enrichment for ${highlights.length} highlights in ${destination}, ${country}`)

  // Group highlights by category for efficient searching
  const categories = new Map<string, UrlHighlight[]>()
  for (const h of highlights) {
    const cat = mapToSearchCategory(h.category)
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(h)
  }

  // Build search queries — one per category, focused on the destination
  const searchQueries: { query: string; category: string; highlights: UrlHighlight[] }[] = []

  for (const [cat, items] of categories) {
    if (cat === 'hotel') {
      searchQueries.push({
        query: `best hotels in ${destination} ${country}`,
        category: cat,
        highlights: items,
      })
    } else if (cat === 'food') {
      searchQueries.push({
        query: `best restaurants cafes in ${destination} ${country}`,
        category: cat,
        highlights: items,
      })
    } else {
      // Activities, sightseeing — search for top highlights by name
      const topNames = items.slice(0, 3).map(h => h.name).join(', ')
      searchQueries.push({
        query: `${topNames} ${destination} ${country}`,
        category: cat,
        highlights: items,
      })
      // If there are more, add a general attractions search
      if (items.length > 3) {
        searchQueries.push({
          query: `things to do attractions in ${destination} ${country}`,
          category: cat,
          highlights: items.slice(3),
        })
      }
    }
  }

  console.log(`[URLEnrich] Running ${searchQueries.length} SerpAPI searches`)

  // Execute searches in parallel (max 5 concurrent)
  const allResults = new Map<string, PlaceResult[]>()
  const batchSize = 3
  for (let i = 0; i < searchQueries.length; i += batchSize) {
    const batch = searchQueries.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(sq =>
        searchPlace(sq.query)
          .then(r => ({ key: sq.category + '_' + i, results: r }))
          .catch(e => {
            console.warn(`[URLEnrich] Search failed for "${sq.query}": ${e}`)
            return { key: sq.category + '_' + i, results: [] as PlaceResult[] }
          })
      )
    )
    for (const r of results) {
      const existing = allResults.get(r.key.split('_')[0]) || []
      allResults.set(r.key.split('_')[0], [...existing, ...r.results])
    }
  }

  // Deduplicate results per category
  for (const [cat, places] of allResults) {
    const seen = new Set<string>()
    allResults.set(cat, places.filter(p => {
      const key = p.placeId || p.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }))
  }

  // Match highlights to SerpAPI results
  const enriched: EnrichedHighlight[] = []
  const matchedPlaceIds = new Set<string>()
  const placesToDetail: PlaceResult[] = []

  for (const h of highlights) {
    const cat = mapToSearchCategory(h.category)
    const candidates = allResults.get(cat) || []

    // Find best matching place
    let bestMatch: PlaceResult | null = null
    let bestScore = 0

    for (const place of candidates) {
      if (matchedPlaceIds.has(place.placeId)) continue // don't reuse
      const score = matchScore(h, place)
      if (score > bestScore) {
        bestScore = score
        bestMatch = place
      }
    }

    if (bestMatch && bestScore >= 40) {
      matchedPlaceIds.add(bestMatch.placeId)
      if (bestMatch.dataId) placesToDetail.push(bestMatch)

      enriched.push({
        ...h,
        rating: bestMatch.rating,
        reviewCount: bestMatch.reviewCount,
        address: bestMatch.address,
        photoUrls: bestMatch.photoUrls.map(u => upsizeGoogleImage(u)),
        mapsUrl: bestMatch.mapsUrl,
        priceLevel: bestMatch.priceLevel,
        placeId: bestMatch.placeId,
        dataId: bestMatch.dataId,
        source: 'serpapi',
      })
    } else {
      // No match — keep original extracted data
      enriched.push({ ...h, source: 'extracted' })
    }
  }

  // Enrich top matched places with Level 2 details (photos, booking, hours)
  const topForDetails = placesToDetail
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 5)

  if (topForDetails.length > 0) {
    console.log(`[URLEnrich] Fetching details for ${topForDetails.length} top places`)
    const detailResults = new Map<string, PlaceDetails>()

    // Fetch in batches of 3
    for (let i = 0; i < topForDetails.length; i += 3) {
      const batch = topForDetails.slice(i, i + 3)
      const details = await Promise.all(
        batch.map(p => getPlaceDetails(p.dataId).catch(() => null))
      )
      for (let j = 0; j < batch.length; j++) {
        if (details[j]) detailResults.set(batch[j].dataId, details[j]!)
      }
    }

    // Merge details back into enriched highlights
    for (const eh of enriched) {
      if (eh.dataId && detailResults.has(eh.dataId)) {
        const detail = detailResults.get(eh.dataId)!
        eh.photos = detail.photos.map(u => upsizeGoogleImage(u))
        eh.bookingUrl = detail.bookingUrl
        eh.website = detail.website
        if (detail.rating) eh.rating = detail.rating
        if (detail.reviewCount) eh.reviewCount = detail.reviewCount
      }
    }
  }

  const matched = enriched.filter(e => e.source === 'serpapi').length
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`[URLEnrich] Done in ${elapsed}s — ${matched}/${highlights.length} highlights matched to real data`)

  return enriched
}

function mapToSearchCategory(category: string): string {
  if (['hotel', 'accommodation', 'resort', 'hostel'].includes(category)) return 'hotel'
  if (['food', 'restaurant', 'cafe', 'dining'].includes(category)) return 'food'
  return 'activity' // sightseeing, nature, cultural, nightlife, shopping, etc.
}
