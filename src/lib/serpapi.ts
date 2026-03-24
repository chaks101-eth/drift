// ─── SerpAPI Google Maps Integration ─────────────────────────
// 3-Level data pipeline:
//   Level 1: Search (google_maps) — bulk discovery of places
//   Level 2: Place Details (google_maps with data_id) — hours, highlights, booking
//   Level 3: Reviews (google_maps_reviews) — real user reviews + sentiment

const API_KEY = process.env.SERPAPI_KEY

const BASE_URL = 'https://serpapi.com/search.json'

// ─── Types ───────────────────────────────────────────────────

export interface PlaceResult {
  name: string
  placeId: string
  dataId: string
  rating: number
  reviewCount: number
  priceLevel: string
  address: string
  description: string
  photoUrls: string[]
  type: string
  mapsUrl?: string
  lat: number
  lng: number
}

export interface PlaceDetails {
  name: string
  placeId: string
  address: string
  phone?: string
  website?: string
  rating: number
  reviewCount: number
  priceLevel?: string
  hours?: { day: string; hours: string }[]
  popularTimes?: { day: string; busiest: string }[]
  highlights?: string[]
  accessibility?: string[]
  amenities?: string[]
  checkInOut?: { checkIn?: string; checkOut?: string }
  bookingUrl?: string
  photos: string[]
  categories?: string[]
  lat: number
  lng: number
}

export interface PlaceReview {
  rating: number
  text: string
  date: string
  likes: number
  snippet?: string
  topics?: string[]
}

export interface PlaceReviewSummary {
  placeId: string
  averageRating: number
  totalReviews: number
  reviews: PlaceReview[]
  topTopics: string[]
}

// ─── Level 1: Search ─────────────────────────────────────────

async function searchGoogleMaps(query: string, coordinates?: { lat: number; lng: number }): Promise<PlaceResult[]> {
  if (!API_KEY) throw new Error('SERPAPI_KEY not set')

  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    type: 'search',
    api_key: API_KEY,
  })

  if (coordinates) {
    params.set('ll', `@${coordinates.lat},${coordinates.lng},14z`)
  }

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SerpAPI search failed: ${err}`)
  }

  const data = await res.json()
  const places = data.local_results || []

  return places.map((p: Record<string, unknown>) => {
    const gps = p.gps_coordinates as { latitude: number; longitude: number } | undefined

    return {
      name: (p.title as string) || '',
      placeId: (p.place_id as string) || '',
      dataId: (p.data_id as string) || '',
      rating: (p.rating as number) || 0,
      reviewCount: (p.reviews as number) || 0,
      priceLevel: mapPriceLevel(p.price as string),
      address: (p.address as string) || '',
      description: (p.description as string) || (p.type as string) || '',
      photoUrls: p.thumbnail ? [p.thumbnail as string] : [],
      type: (p.type as string) || '',
      mapsUrl: (p.links as Record<string, string>)?.directions || undefined,
      lat: gps?.latitude || 0,
      lng: gps?.longitude || 0,
    }
  })
}

// ─── Level 2: Place Details ──────────────────────────────────

export async function getPlaceDetails(dataId: string): Promise<PlaceDetails | null> {
  if (!API_KEY) throw new Error('SERPAPI_KEY not set')
  if (!dataId) return null

  const params = new URLSearchParams({
    engine: 'google_maps',
    data_id: dataId,
    api_key: API_KEY,
  })

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) return null

  const data = await res.json()
  const p = data.place_results
  if (!p) return null

  const gps = p.gps_coordinates as { latitude: number; longitude: number } | undefined

  // Parse operating hours
  let hours: { day: string; hours: string }[] | undefined
  if (p.operating_hours) {
    hours = Object.entries(p.operating_hours as Record<string, string>).map(([day, h]) => ({
      day, hours: h,
    }))
  }

  // Parse popular times
  let popularTimes: { day: string; busiest: string }[] | undefined
  if (p.popular_times) {
    const pt = p.popular_times as Record<string, unknown>[]
    popularTimes = pt.map((t) => ({
      day: (t.day as string) || '',
      busiest: ((t.busy_times as { time: string }[])?.find(() => true)?.time) || '',
    }))
  }

  // Extract highlights, amenities, accessibility
  const highlights = (p.highlights as string[]) || []
  const amenities = (p.amenities as string[]) || []
  const accessibility = (p.accessibility as string[]) || []

  // Photos — extract up to 8 direct Google image URLs (not serpapi proxied)
  const photos: string[] = []
  if (p.images) {
    const imgs = p.images as { thumbnail?: string; title?: string }[]
    // Filter out category headers like "Videos" and extract direct Google URLs
    const photoUrls = imgs
      .filter(i => i.thumbnail && !['Videos', 'Street View & 360°'].includes(i.title || ''))
      .map(i => i.thumbnail as string)
      .filter(u => u.includes('googleusercontent.com'))
      .slice(0, 8)
    photos.push(...photoUrls)
  }
  if (p.thumbnail && photos.length === 0) {
    photos.push(p.thumbnail as string)
  }

  // Check-in/out for hotels
  let checkInOut: { checkIn?: string; checkOut?: string } | undefined
  if (p.check_in_time || p.check_out_time) {
    checkInOut = {
      checkIn: p.check_in_time as string | undefined,
      checkOut: p.check_out_time as string | undefined,
    }
  }

  // Booking link
  const bookingUrl = (p.reservation_link as string)
    || (p.order_online_link as string)
    || (p.website as string)
    || undefined

  return {
    name: (p.title as string) || '',
    placeId: (p.place_id as string) || '',
    address: (p.address as string) || '',
    phone: (p.phone as string) || undefined,
    website: (p.website as string) || undefined,
    rating: (p.rating as number) || 0,
    reviewCount: (p.reviews as number) || 0,
    priceLevel: mapPriceLevel(p.price as string),
    hours,
    popularTimes,
    highlights,
    accessibility,
    amenities,
    checkInOut,
    bookingUrl,
    photos,
    categories: (p.type as string)?.split(',').map((s: string) => s.trim()) || [],
    lat: gps?.latitude || 0,
    lng: gps?.longitude || 0,
  }
}

// ─── Level 3: Reviews ────────────────────────────────────────

export async function getPlaceReviews(dataId: string, limit: number = 10): Promise<PlaceReviewSummary | null> {
  if (!API_KEY) throw new Error('SERPAPI_KEY not set')
  if (!dataId) return null

  const params = new URLSearchParams({
    engine: 'google_maps_reviews',
    data_id: dataId,
    sort_by: 'qualityScore',
    api_key: API_KEY,
    num: String(limit),
  })

  const res = await fetch(`${BASE_URL}?${params}`)
  if (!res.ok) return null

  const data = await res.json()

  const reviews: PlaceReview[] = (data.reviews || []).map((r: Record<string, unknown>) => ({
    rating: (r.rating as number) || 0,
    text: (r.snippet as string) || (r.extracted_snippet as Record<string, string>)?.original || '',
    date: (r.date as string) || '',
    likes: (r.likes as number) || 0,
    snippet: (r.extracted_snippet as Record<string, string>)?.original || undefined,
    topics: ((r.details as Record<string, unknown>)
      ? Object.keys(r.details as Record<string, unknown>)
      : undefined),
  }))

  // Extract common topics across reviews
  const topicCounts = new Map<string, number>()
  for (const review of reviews) {
    if (review.topics) {
      for (const topic of review.topics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      }
    }
  }
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic]) => topic)

  return {
    placeId: dataId,
    averageRating: data.place_info?.rating || 0,
    totalReviews: data.place_info?.reviews || 0,
    reviews,
    topTopics,
  }
}

// ─── Batch helpers for pipeline ──────────────────────────────

export async function enrichPlacesWithDetails(
  places: PlaceResult[],
  maxCalls: number = 10,
): Promise<Map<string, PlaceDetails>> {
  const top = places
    .filter(p => p.dataId)
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, maxCalls)

  const results = new Map<string, PlaceDetails>()

  // Fetch in batches of 3 to avoid rate limits
  for (let i = 0; i < top.length; i += 3) {
    const batch = top.slice(i, i + 3)
    const details = await Promise.all(
      batch.map(p => getPlaceDetails(p.dataId).catch(() => null))
    )
    for (let j = 0; j < batch.length; j++) {
      if (details[j]) {
        results.set(batch[j].dataId, details[j]!)
      }
    }
    // Small delay between batches
    if (i + 3 < top.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return results
}

export async function enrichPlacesWithReviews(
  places: PlaceResult[],
  maxCalls: number = 8,
): Promise<Map<string, PlaceReviewSummary>> {
  const top = places
    .filter(p => p.dataId)
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, maxCalls)

  const results = new Map<string, PlaceReviewSummary>()

  // Fetch in batches of 3
  for (let i = 0; i < top.length; i += 3) {
    const batch = top.slice(i, i + 3)
    const reviews = await Promise.all(
      batch.map(p => getPlaceReviews(p.dataId, 8).catch(() => null))
    )
    for (let j = 0; j < batch.length; j++) {
      if (reviews[j]) {
        results.set(batch[j].dataId, reviews[j]!)
      }
    }
    if (i + 3 < top.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return results
}

// ─── Level 1 search functions ────────────────────────────────

export async function searchRestaurants(city: string, country: string): Promise<PlaceResult[]> {
  const queries = [
    `best restaurants in ${city} ${country}`,
    `popular street food in ${city} ${country}`,
    `fine dining ${city} ${country}`,
  ]

  const results = await Promise.all(
    queries.map(q => searchGoogleMaps(q).catch(() => []))
  )
  const all = results.flat()

  const seen = new Set<string>()
  return all.filter(p => {
    const key = p.placeId || p.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchHotels(city: string, country: string): Promise<PlaceResult[]> {
  const queries = [
    `best hotels in ${city} ${country}`,
    `budget hostels ${city} ${country}`,
    `luxury resorts ${city} ${country}`,
  ]

  const results = await Promise.all(
    queries.map(q => searchGoogleMaps(q).catch(() => []))
  )
  const all = results.flat()

  const seen = new Set<string>()
  return all.filter(p => {
    const key = p.placeId || p.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchAttractions(city: string, country: string): Promise<PlaceResult[]> {
  const queries = [
    `top attractions in ${city} ${country}`,
    `things to do in ${city} ${country}`,
  ]

  const results = await Promise.all(
    queries.map(q => searchGoogleMaps(q).catch(() => []))
  )
  const all = results.flat()

  const seen = new Set<string>()
  return all.filter(p => {
    const key = p.placeId || p.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── Targeted place search (for mini-pipeline) ──────────────

export async function searchPlace(query: string): Promise<PlaceResult[]> {
  return searchGoogleMaps(query)
}

// ─── Price level mapping ─────────────────────────────────────

function mapPriceLevel(price: string | undefined): string {
  if (!price) return 'mid'
  const dollarSigns = (price.match(/\$/g) || []).length
  if (dollarSigns >= 3) return 'luxury'
  if (dollarSigns === 2) return 'mid'
  if (dollarSigns === 1) return 'budget'
  if (price.includes('+') || price.includes('2,000') || price.includes('3,000')) return 'luxury'
  return 'mid'
}
