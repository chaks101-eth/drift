// ─── Google Places API (New) Integration ─────────────────────
// Uses Places API v1 for restaurants, hotels, activities with
// real ratings, reviews, photos, and editorial summaries.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

const BASE_URL = 'https://places.googleapis.com/v1'

// ─── Types ────────────────────────────────────────────────────

export interface GooglePlace {
  name: string
  placeId: string
  rating: number
  reviewCount: number
  priceLevel: string
  address: string
  description: string
  photos: string[] // photo resource names (need to resolve to URLs)
  photoUrls: string[]
  type: string
  cuisine?: string
  website?: string
  mapsUrl?: string
  lat: number
  lng: number
}

// ─── Search places ───────────────────────────────────────────

export async function searchPlaces(query: string, maxResults = 10): Promise<GooglePlace[]> {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const res = await fetch(`${BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
        'places.formattedAddress', 'places.priceLevel', 'places.photos',
        'places.primaryType', 'places.primaryTypeDisplayName',
        'places.editorialSummary', 'places.websiteUri', 'places.googleMapsUri',
        'places.location',
      ].join(','),
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: maxResults }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Places search failed: ${err}`)
  }

  const data = await res.json()
  const places = data.places || []

  return places.map((p: Record<string, unknown>) => {
    const displayName = p.displayName as { text: string } | undefined
    const editorial = p.editorialSummary as { text: string } | undefined
    const location = p.location as { latitude: number; longitude: number } | undefined
    const photos = (p.photos as Array<{ name: string }>) || []
    const primaryType = p.primaryTypeDisplayName as { text: string } | undefined

    return {
      name: displayName?.text || '',
      placeId: p.id as string,
      rating: (p.rating as number) || 0,
      reviewCount: (p.userRatingCount as number) || 0,
      priceLevel: mapPriceLevel(p.priceLevel as string),
      address: (p.formattedAddress as string) || '',
      description: editorial?.text || '',
      photos: photos.slice(0, 3).map(ph => ph.name),
      photoUrls: photos.slice(0, 3).map(ph => getPhotoUrl(ph.name)),
      type: primaryType?.text || (p.primaryType as string) || '',
      website: (p.websiteUri as string) || undefined,
      mapsUrl: (p.googleMapsUri as string) || undefined,
      lat: location?.latitude || 0,
      lng: location?.longitude || 0,
    }
  })
}

// ─── Search restaurants specifically ─────────────────────────

export async function searchRestaurants(city: string, country: string): Promise<GooglePlace[]> {
  const queries = [
    `best restaurants in ${city} ${country}`,
    `popular street food in ${city} ${country}`,
    `fine dining ${city} ${country}`,
  ]

  const results = await Promise.all(queries.map(q => searchPlaces(q, 8).catch(() => [])))
  const all = results.flat()

  // Deduplicate by placeId
  const seen = new Set<string>()
  return all.filter(p => {
    if (seen.has(p.placeId)) return false
    seen.add(p.placeId)
    return true
  })
}

// ─── Search hotels ───────────────────────────────────────────

export async function searchHotels(city: string, country: string): Promise<GooglePlace[]> {
  const queries = [
    `best hotels in ${city} ${country}`,
    `budget hostels ${city} ${country}`,
    `luxury resorts ${city} ${country}`,
  ]

  const results = await Promise.all(queries.map(q => searchPlaces(q, 8).catch(() => [])))
  const all = results.flat()

  const seen = new Set<string>()
  return all.filter(p => {
    if (seen.has(p.placeId)) return false
    seen.add(p.placeId)
    return true
  })
}

// ─── Search activities/attractions ───────────────────────────

export async function searchAttractions(city: string, country: string): Promise<GooglePlace[]> {
  const queries = [
    `top attractions in ${city} ${country}`,
    `things to do in ${city} ${country}`,
    `adventure activities ${city} ${country}`,
  ]

  const results = await Promise.all(queries.map(q => searchPlaces(q, 8).catch(() => [])))
  const all = results.flat()

  const seen = new Set<string>()
  return all.filter(p => {
    if (seen.has(p.placeId)) return false
    seen.add(p.placeId)
    return true
  })
}

// ─── Photo URL helper ────────────────────────────────────────
// Resolves photo resource name to a URL

function getPhotoUrl(photoName: string, maxWidth = 600): string {
  if (!API_KEY || !photoName) return ''
  return `${BASE_URL}/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`
}

// ─── Price level mapping ─────────────────────────────────────

function mapPriceLevel(level: string | undefined): string {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 'budget'
    case 'PRICE_LEVEL_MODERATE':
      return 'mid'
    case 'PRICE_LEVEL_EXPENSIVE':
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 'luxury'
    default:
      return 'mid'
  }
}
