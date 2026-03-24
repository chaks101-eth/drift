// ─── Catalog Lookup ───────────────────────────────────────────
// Checks if a destination exists in our catalog and returns
// real hotels, activities, restaurants, and pre-built templates.
// Used by itinerary generation to serve real data instead of LLM hallucinations.

import { createClient } from '@supabase/supabase-js'
import { upsizeGoogleImage } from '@/lib/images'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface CatalogDestination {
  id: string
  city: string
  country: string
  vibes: string[]
  description: string
  cover_image: string
  avg_budget_per_day: { budget: number; mid: number; luxury: number }
}

export interface CatalogHotel {
  id: string
  name: string
  description: string
  detail: string
  category: string
  price_per_night: string
  price_level: string
  rating: number
  vibes: string[]
  amenities: string[]
  image_url: string | null
  location: string
  booking_url: string | null
  source: string
}

export interface CatalogActivity {
  id: string
  name: string
  description: string
  detail: string
  category: string
  price: string
  duration: string
  vibes: string[]
  best_time: string
  image_url: string | null
  location: string
  booking_url: string | null
  source: string
}

export interface CatalogRestaurant {
  id: string
  name: string
  description: string
  detail: string
  cuisine: string
  price_level: string
  avg_cost: string
  vibes: string[]
  must_try: string[]
  image_url: string | null
  location: string
  booking_url: string | null
  source: string
}

export interface CatalogTemplate {
  id: string
  name: string
  vibes: string[]
  budget_level: string
  duration_days: number
  items: TemplateItem[]
}

export interface TemplateItem {
  day?: number
  category: string
  name: string
  detail: string
  description: string
  price: string
  time: string
  metadata?: {
    reason?: string
    whyFactors?: string[]
    info?: { l: string; v: string }[]
    features?: string[]
    alts?: { name: string; detail: string; price: string; image_url?: string }[]
  }
}

export interface CatalogData {
  destination: CatalogDestination
  hotels: CatalogHotel[]
  activities: CatalogActivity[]
  restaurants: CatalogRestaurant[]
  template: CatalogTemplate | null
}

// ─── Lookup destination by city name ────────────────────────────

export async function findCatalogDestination(city: string): Promise<CatalogDestination | null> {
  console.log(`[Catalog] Looking up destination: "${city}"`)
  const db = getClient()
  const { data, error } = await db
    .from('catalog_destinations')
    .select('*')
    .eq('status', 'active')
    .ilike('city', city)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error(`[Catalog] Lookup error: ${error.message} (code: ${error.code})`)
  }
  console.log(`[Catalog] Destination "${city}": ${data ? `FOUND (id=${data.id}, status=${data.status})` : 'NOT FOUND'}`)
  return data || null
}

// ─── Get full catalog data for a destination ────────────────────

export async function getCatalogData(destinationId: string, vibes?: string[], budget?: string): Promise<CatalogData | null> {
  console.log(`[Catalog] Loading full catalog for destination ${destinationId} (vibes=${vibes?.join(',')}, budget=${budget})`)
  const db = getClient()

  const [
    { data: dest, error: destErr },
    { data: hotels, error: hotelErr },
    { data: activities, error: actErr },
    { data: restaurants, error: restErr },
    { data: templates, error: tmplErr },
  ] = await Promise.all([
    db.from('catalog_destinations').select('*').eq('id', destinationId).single(),
    db.from('catalog_hotels').select('*').eq('destination_id', destinationId),
    db.from('catalog_activities').select('*').eq('destination_id', destinationId),
    db.from('catalog_restaurants').select('*').eq('destination_id', destinationId),
    db.from('catalog_templates').select('*').eq('destination_id', destinationId),
  ])

  if (destErr) console.error(`[Catalog] Destination query error: ${destErr.message}`)
  if (hotelErr) console.error(`[Catalog] Hotels query error: ${hotelErr.message}`)
  if (actErr) console.error(`[Catalog] Activities query error: ${actErr.message}`)
  if (restErr) console.error(`[Catalog] Restaurants query error: ${restErr.message}`)
  if (tmplErr) console.error(`[Catalog] Templates query error: ${tmplErr.message}`)

  console.log(`[Catalog] Data loaded: dest=${dest ? 'yes' : 'NO'}, hotels=${hotels?.length || 0}, activities=${activities?.length || 0}, restaurants=${restaurants?.length || 0}, templates=${templates?.length || 0}`)

  if (!dest) return null

  // Pick best matching template: prefer matching budget level, then vibes overlap
  let bestTemplate: CatalogTemplate | null = null
  if (templates && templates.length > 0) {
    const budgetLevel = budget === 'luxury' ? 'luxury' : budget === 'budget' ? 'budget' : 'mid'
    const scored = templates.map(t => {
      let score = 0
      if (t.budget_level === budgetLevel) score += 10
      if (vibes) {
        const overlap = (t.vibes || []).filter((v: string) => vibes.includes(v)).length
        score += overlap * 2
      }
      return { template: t, score }
    })
    scored.sort((a, b) => b.score - a.score)
    bestTemplate = scored[0].template
  }

  // Filter hotels by budget level if specified
  let filteredHotels = hotels || []
  if (budget) {
    const level = budget === 'luxury' ? 'luxury' : budget === 'budget' ? 'budget' : 'mid'
    const matched = filteredHotels.filter(h => h.price_level === level)
    if (matched.length >= 2) filteredHotels = matched
  }

  return {
    destination: dest,
    hotels: filteredHotels,
    activities: activities || [],
    restaurants: restaurants || [],
    template: bestTemplate,
  }
}

// ─── Vibe Scoring ───────────────────────────────────────────────
// Scores a catalog item against trip vibes using metadata.best_for, vibes, features

function vibeScore(itemVibes: string[], tripVibes: string[]): number {
  if (!tripVibes.length || !itemVibes.length) return 0
  const lower = itemVibes.map(v => v.toLowerCase())
  let score = 0
  for (const tv of tripVibes) {
    const tvl = tv.toLowerCase()
    if (lower.some(iv => iv.includes(tvl) || tvl.includes(iv))) score++
  }
  return score
}

function getItemVibes(meta: Record<string, unknown> | null | undefined, fallbackVibes?: string[]): string[] {
  if (!meta && !fallbackVibes) return []
  const m = meta || {}
  return [
    ...((m.best_for as string[]) || []),
    ...((m.features as string[]) || []),
    ...(fallbackVibes || []),
  ]
}

// ─── Convert template items to itinerary items format ───────────
// Maps catalog template items into the same format the generate route expects,
// enriching with real catalog data (images, booking links, metadata).
// When tripVibes is provided, items and alternatives are ranked by vibe match.

export function templateToItineraryItems(
  catalog: CatalogData,
  _startDate?: string,
  tripVibes?: string[],
): Array<{
  category: string
  name: string
  detail: string
  description: string
  price: string
  image_url: string
  time: string
  position: number
  metadata: Record<string, unknown>
}> {
  if (!catalog.template) return []

  const hotelMap = new Map(catalog.hotels.map(h => [h.name.toLowerCase(), h]))
  const activityMap = new Map(catalog.activities.map(a => [a.name.toLowerCase(), a]))
  const restaurantMap = new Map(catalog.restaurants.map(r => [r.name.toLowerCase(), r]))

  return catalog.template.items.map((item, idx) => {
    // Try to match with catalog items for real images and booking links
    const nameLower = (item.name || '').toLowerCase()
    const hotel = hotelMap.get(nameLower) || [...hotelMap.values()].find(h =>
      nameLower.includes(h.name.toLowerCase().split(' ')[0]) ||
      h.name.toLowerCase().includes(nameLower.split(' ')[0])
    )
    const activity = activityMap.get(nameLower) || [...activityMap.values()].find(a =>
      nameLower.includes(a.name.toLowerCase().split(' ')[0]) ||
      a.name.toLowerCase().includes(nameLower.split(' ')[0])
    )
    const restaurant = restaurantMap.get(nameLower) || [...restaurantMap.values()].find(r =>
      nameLower.includes(r.name.toLowerCase().split(' ')[0]) ||
      r.name.toLowerCase().includes(nameLower.split(' ')[0])
    )

    // Determine image, booking URL, and enrichment from matched catalog item
    let imageUrl = ''
    let bookingUrl: string | null = null
    let source = 'catalog'
    let catalogMeta: Record<string, unknown> = {}

    if (item.category === 'hotel' && hotel) {
      imageUrl = upsizeGoogleImage(hotel.image_url || '')
      bookingUrl = hotel.booking_url
      source = hotel.source
      const hm = (hotel as unknown as Record<string, unknown>).metadata as Record<string, unknown> || {}
      catalogMeta = {
        features: hotel.amenities?.slice(0, 6) || [],
        honest_take: hm.honest_take,
        practical_tips: hm.practical_tips,
        best_for: hm.best_for || hotel.vibes || [],
        pairs_with: hm.pairs_with,
        review_synthesis: hm.review_synthesis,
        reviewCount: hm.reviewCount,
        mapsUrl: hm.mapsUrl,
        placeId: hm.placeId,
        dataId: hm.dataId,
        photos: (hm.photos as string[] || []).slice(0, 6),
        lat: hm.lat, lng: hm.lng,
        hours: hm.hours,
        checkInOut: hm.checkInOut,
      }
    } else if (item.category === 'activity' && activity) {
      imageUrl = upsizeGoogleImage(activity.image_url || '')
      bookingUrl = activity.booking_url
      source = activity.source
      const am = (activity as unknown as Record<string, unknown>).metadata as Record<string, unknown> || {}
      catalogMeta = {
        honest_take: am.honest_take,
        practical_tips: am.practical_tips,
        best_for: am.best_for || activity.vibes || [],
        pairs_with: am.pairs_with,
        review_synthesis: am.review_synthesis,
        features: am.features,
        reviewCount: am.reviewCount,
        mapsUrl: am.mapsUrl,
        placeId: am.placeId,
        dataId: am.dataId,
        photos: (am.photos as string[] || []).slice(0, 6),
        lat: am.lat, lng: am.lng,
        hours: am.hours,
        best_time: activity.best_time,
        duration: activity.duration,
      }
    } else if (item.category === 'food' && restaurant) {
      imageUrl = upsizeGoogleImage(restaurant.image_url || '')
      bookingUrl = restaurant.booking_url
      source = restaurant.source
      const rm = (restaurant as unknown as Record<string, unknown>).metadata as Record<string, unknown> || {}
      catalogMeta = {
        features: restaurant.must_try?.slice(0, 6) || [],
        honest_take: rm.honest_take,
        practical_tips: rm.practical_tips,
        best_for: rm.best_for || restaurant.vibes || [],
        pairs_with: rm.pairs_with,
        review_synthesis: rm.review_synthesis,
        reviewCount: rm.reviewCount,
        mapsUrl: rm.mapsUrl,
        placeId: rm.placeId,
        dataId: rm.dataId,
        photos: (rm.photos as string[] || []).slice(0, 6),
        lat: rm.lat, lng: rm.lng,
        hours: rm.hours,
      }
    }

    // Strip undefined values from catalog metadata
    Object.keys(catalogMeta).forEach(k => {
      if (catalogMeta[k] === undefined || catalogMeta[k] === null) delete catalogMeta[k]
    })

    // Build metadata: template metadata → catalog enrichment → source/booking
    const metadata: Record<string, unknown> = {
      ...item.metadata,
      ...catalogMeta,
      source,
      ...(bookingUrl ? { bookingUrl } : {}),
    }

    // Add alternatives from other catalog items of same type, with trust badges
    // Sort by vibe match when tripVibes is available
    const vibes = tripVibes || []

    if (item.category === 'hotel' && !metadata.alts && hotel) {
      const currentPrice = parsePrice(hotel.price_per_night)
      const currentRating = hotel.rating
      const others = catalog.hotels
        .filter(h => h.name.toLowerCase() !== nameLower)
        .map(h => ({ h, score: vibeScore(getItemVibes((h as unknown as Record<string, unknown>).metadata as Record<string, unknown> | null, h.vibes), vibes) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      metadata.alts = others.map(({ h }) => ({
        name: h.name,
        detail: `${h.detail || h.category} · ${h.rating}★`,
        price: h.price_per_night,
        image_url: h.image_url,
        bookingUrl: h.booking_url,
        trust: buildTrustBadges(currentPrice, currentRating, parsePrice(h.price_per_night), h.rating),
      }))
    }
    if (item.category === 'food' && !metadata.alts) {
      const currentPrice = parsePrice(restaurant?.avg_cost)
      const currentRating = (restaurant as unknown as Record<string, unknown>)?.rating as number | undefined
      const others = catalog.restaurants
        .filter(r => r.name.toLowerCase() !== nameLower)
        .map(r => ({ r, score: vibeScore(getItemVibes((r as unknown as Record<string, unknown>).metadata as Record<string, unknown> | null, r.vibes), vibes) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      metadata.alts = others.map(({ r }) => {
        const rm = (r as unknown as Record<string, unknown>).rating as number | undefined
        return {
          name: r.name,
          detail: `${r.cuisine} · ${r.price_level}`,
          price: r.avg_cost,
          image_url: r.image_url,
          bookingUrl: r.booking_url,
          trust: buildTrustBadges(currentPrice, currentRating, parsePrice(r.avg_cost), rm),
        }
      })
    }
    if (item.category === 'activity' && !metadata.alts) {
      const currentPrice = parsePrice(activity?.price)
      const others = catalog.activities
        .filter(a => a.name.toLowerCase() !== nameLower)
        .map(a => ({ a, score: vibeScore(getItemVibes((a as unknown as Record<string, unknown>).metadata as Record<string, unknown> | null, a.vibes), vibes) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      metadata.alts = others.map(({ a }) => ({
        name: a.name,
        detail: `${a.category} · ${a.duration}`,
        price: a.price,
        image_url: a.image_url,
        bookingUrl: a.booking_url,
        trust: buildTrustBadges(currentPrice, undefined, parsePrice(a.price), undefined),
      }))
    }

    return {
      category: item.category,
      name: item.name,
      detail: item.detail || '',
      description: item.description || '',
      price: item.price || '',
      image_url: imageUrl,
      time: item.time || '',
      position: idx,
      metadata,
    }
  })
}

// ─── Trust Badge Helpers ──────────────────────────────────────

function parsePrice(price?: string | null): number | undefined {
  if (!price) return undefined
  const num = parseFloat(price.replace(/[^0-9.]/g, ''))
  return isNaN(num) ? undefined : num
}

function buildTrustBadges(
  currentPrice: number | undefined,
  currentRating: number | undefined,
  altPrice: number | undefined,
  altRating: number | undefined,
): Array<{ type: 'success' | 'gold' | 'warn'; text: string }> {
  const badges: Array<{ type: 'success' | 'gold' | 'warn'; text: string }> = []

  // Price comparison
  if (currentPrice && altPrice) {
    const diff = currentPrice - altPrice
    if (diff > 5) {
      badges.push({ type: 'gold', text: `$${Math.round(diff)} cheaper` })
    } else if (diff < -5) {
      badges.push({ type: 'warn', text: `$${Math.round(Math.abs(diff))} more` })
    }
  }

  // Rating comparison
  if (altRating && altRating >= 4.5) {
    badges.push({ type: 'success', text: `${altRating}★ rated` })
  } else if (altRating && currentRating && altRating > currentRating) {
    badges.push({ type: 'success', text: `${altRating}★ (higher)` })
  }

  return badges
}
