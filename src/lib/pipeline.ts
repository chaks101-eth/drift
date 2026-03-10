// ─── Travel Data Pipeline ─────────────────────────────────────
// Config-driven catalog builder. Multi-source real data + LLM enrichment.
// Hotels: Amadeus API + SerpAPI (Google Maps) → LLM enriches → Booking.com deep links
// Activities: Amadeus Tours API → LLM enriches → booking links preserved
// Restaurants: SerpAPI (Google Maps real data) → LLM enriches descriptions/vibes
// Templates: LLM builds from real catalog data

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getDestinationImage } from './images'
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

// LLM Provider: Gemini (primary) → Claude (fallback) → Groq (last resort)
// Lazy-init to avoid crash at build time when env vars aren't available
let _llmClient: OpenAI | null = null
let _llmProvider = 'unknown'
function getLlmClient() {
  if (!_llmClient) {
    if (process.env.GEMINI_API_KEY) {
      _llmProvider = 'Gemini'
      _llmClient = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      })
    } else if (process.env.ANTHROPIC_API_KEY) {
      _llmProvider = 'Anthropic'
      _llmClient = new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1/',
      })
    } else {
      _llmProvider = 'Groq'
      _llmClient = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      })
    }
  }
  return _llmClient
}
function getModel() {
  if (process.env.GEMINI_API_KEY) return 'gemini-2.5-flash'
  if (process.env.ANTHROPIC_API_KEY) return 'claude-sonnet-4-20250514'
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
}
const MODEL = getModel()

console.log(`[Pipeline] LLM provider: ${process.env.GEMINI_API_KEY ? 'Gemini' : process.env.ANTHROPIC_API_KEY ? 'Anthropic' : 'Groq'}, model: ${MODEL}`)

const AMADEUS_BASE = 'https://test.api.amadeus.com'

// ─── Admin DB client ─────────────────────────────────────────

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ────────────────────────────────────────────────────

export interface DestinationConfig {
  city: string
  country: string
  vibes: string[]
  description?: string
  language?: string
  timezone?: string
  best_months?: string[]
}

interface PipelineContext {
  config: DestinationConfig
  destinationId: string
  runId: string
  steps: string[]
}

// ─── City metadata (coords + IATA for Amadeus lookups) ───────

const CITY_DATA: Record<string, { lat: number; lng: number; iata: string }> = {
  'pattaya': { lat: 12.9236, lng: 100.8825, iata: 'UTP' },
  'bangkok': { lat: 13.7563, lng: 100.5018, iata: 'BKK' },
  'bali': { lat: -8.4095, lng: 115.1889, iata: 'DPS' },
  'denpasar': { lat: -8.6705, lng: 115.2126, iata: 'DPS' },
  'ubud': { lat: -8.5069, lng: 115.2625, iata: 'DPS' },
  'goa': { lat: 15.2993, lng: 74.1240, iata: 'GOI' },
  'panaji': { lat: 15.4909, lng: 73.8278, iata: 'GOI' },
  'delhi': { lat: 28.6139, lng: 77.2090, iata: 'DEL' },
  'mumbai': { lat: 19.0760, lng: 72.8777, iata: 'BOM' },
  'jaipur': { lat: 26.9124, lng: 75.7873, iata: 'JAI' },
  'tokyo': { lat: 35.6762, lng: 139.6503, iata: 'NRT' },
  'singapore': { lat: 1.3521, lng: 103.8198, iata: 'SIN' },
  'dubai': { lat: 25.2048, lng: 55.2708, iata: 'DXB' },
  'paris': { lat: 48.8566, lng: 2.3522, iata: 'CDG' },
  'london': { lat: 51.5074, lng: -0.1278, iata: 'LHR' },
  'santorini': { lat: 36.3932, lng: 25.4615, iata: 'JTR' },
  'rome': { lat: 41.9028, lng: 12.4964, iata: 'FCO' },
  'barcelona': { lat: 41.3874, lng: 2.1686, iata: 'BCN' },
  'cancun': { lat: 21.1619, lng: -86.8515, iata: 'CUN' },
  'maldives': { lat: 3.2028, lng: 73.2207, iata: 'MLE' },
  'phuket': { lat: 7.8804, lng: 98.3923, iata: 'HKT' },
  'cape town': { lat: -33.9249, lng: 18.4241, iata: 'CPT' },
  'new york': { lat: 40.7128, lng: -74.0060, iata: 'JFK' },
  'sydney': { lat: -33.8688, lng: 151.2093, iata: 'SYD' },
  'amsterdam': { lat: 52.3676, lng: 4.9041, iata: 'AMS' },
  'istanbul': { lat: 41.0082, lng: 28.9784, iata: 'IST' },
  'lisbon': { lat: 38.7223, lng: -9.1393, iata: 'LIS' },
  'marrakech': { lat: 31.6295, lng: -7.9811, iata: 'RAK' },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729, iata: 'GIG' },
  'miami': { lat: 25.7617, lng: -80.1918, iata: 'MIA' },
  'seoul': { lat: 37.5665, lng: 126.9780, iata: 'ICN' },
  'hong kong': { lat: 22.3193, lng: 114.1694, iata: 'HKG' },
  'prague': { lat: 50.0755, lng: 14.4378, iata: 'PRG' },
  'vienna': { lat: 48.2082, lng: 16.3738, iata: 'VIE' },
}

function getCityData(city: string) {
  const key = city.toLowerCase().trim()
  if (CITY_DATA[key]) return CITY_DATA[key]
  for (const [k, v] of Object.entries(CITY_DATA)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

// ─── Amadeus Auth ────────────────────────────────────────────

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getAmadeusToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    console.log(`[Amadeus] Using cached token (expires in ${Math.round((cachedToken.expires_at - Date.now()) / 1000)}s)`)
    return cachedToken.access_token
  }
  console.log(`[Amadeus] Authenticating...`)
  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    console.error(`[Amadeus] Auth failed (${res.status}): ${errText}`)
    throw new Error(`Amadeus auth failed: ${errText}`)
  }
  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }
  console.log(`[Amadeus] Authenticated OK (token valid ${data.expires_in}s)`)
  return cachedToken.access_token
}

// ─── Amadeus API calls ──────────────────────────────────────

async function fetchAmadeusHotels(iataCode: string): Promise<Array<{
  name: string; hotelId: string; chainCode?: string;
  lat: number; lng: number; address: string; distance: number
}>> {
  const token = await getAmadeusToken()
  const res = await fetch(
    `${AMADEUS_BASE}/v1/reference-data/locations/hotels/by-city?cityCode=${iataCode}&radius=50&radiusUnit=KM`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.data || []).map((h: Record<string, unknown>) => {
    const geo = h.geoCode as { latitude: number; longitude: number } | undefined
    const addr = h.address as { lines?: string[]; cityName?: string } | undefined
    const dist = h.distance as { value: number } | undefined
    return {
      name: h.name as string,
      hotelId: h.hotelId as string,
      chainCode: h.chainCode as string | undefined,
      lat: geo?.latitude || 0,
      lng: geo?.longitude || 0,
      address: addr?.lines?.[0] || addr?.cityName || '',
      distance: dist?.value || 0,
    }
  })
}

async function fetchAmadeusActivities(lat: number, lng: number): Promise<Array<{
  id: string; name: string; description: string; price: string; currency: string;
  pictures: string[]; bookingLink: string | null; duration: string | null
}>> {
  const token = await getAmadeusToken()
  const res = await fetch(
    `${AMADEUS_BASE}/v1/shopping/activities?latitude=${lat}&longitude=${lng}&radius=30`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.data || []).map((a: Record<string, unknown>) => {
    const price = a.price as { amount: string; currencyCode: string } | undefined
    // Strip HTML from description
    const rawDesc = (a.description as string) || ''
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').trim()
    return {
      id: a.id as string,
      name: a.name as string,
      description: cleanDesc,
      price: price ? `$${Math.round(parseFloat(price.amount) * 1.1)}` : '',  // EUR→USD approx
      currency: 'USD',
      pictures: (a.pictures as string[]) || [],
      bookingLink: (a.bookingLink as string) || null,
      duration: (a.minimumDuration as string) || null,
    }
  })
}

// ─── LLM Helper ──────────────────────────────────────────────

async function llmGenerate(prompt: string): Promise<string> {
  const llmStart = Date.now()
  const promptPreview = prompt.slice(0, 100).replace(/\n/g, ' ')
  console.log(`[LLM] Calling ${MODEL} — prompt: "${promptPreview}..."`)
  try {
    const res = await getLlmClient().chat.completions.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `You are a travel data enrichment engine. Return ONLY valid JSON. No markdown, no explanation. Be specific with real place names, realistic prices, and vivid descriptions. Write in a warm, editorial travel magazine voice.`,
        },
        { role: 'user', content: prompt },
      ],
    })
    const text = res.choices[0].message.content || '[]'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const elapsed = ((Date.now() - llmStart) / 1000).toFixed(1)
    const usage = res.usage
    console.log(`[LLM] Response in ${elapsed}s — ${cleaned.length} chars, tokens: ${usage?.total_tokens || '?'} (prompt: ${usage?.prompt_tokens || '?'}, completion: ${usage?.completion_tokens || '?'})`)
    return cleaned
  } catch (error) {
    const elapsed = ((Date.now() - llmStart) / 1000).toFixed(1)
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[LLM] FAILED after ${elapsed}s: ${msg}`)
    throw error
  }
}

// ─── Step 1: Create/Update Destination ───────────────────────

async function stepCreateDestination(config: DestinationConfig): Promise<string> {
  const db = getAdminClient()

  const { data: existing } = await db
    .from('catalog_destinations')
    .select('id')
    .ilike('city', config.city)
    .ilike('country', config.country)
    .single()

  if (existing) {
    await db
      .from('catalog_destinations')
      .update({
        vibes: config.vibes,
        description: config.description,
        cover_image: getDestinationImage(config.city),
        best_months: config.best_months || [],
        language: config.language,
        timezone: config.timezone,
        status: 'processing',
        pipeline_run_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: dest, error } = await db
    .from('catalog_destinations')
    .insert({
      city: config.city,
      country: config.country,
      vibes: config.vibes,
      description: config.description || `Explore ${config.city}, ${config.country}`,
      cover_image: getDestinationImage(config.city),
      best_months: config.best_months || [],
      language: config.language,
      timezone: config.timezone,
      status: 'processing',
      pipeline_run_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create destination: ${error.message}`)
  return dest.id
}

// ─── Booking.com deep link generator ─────────────────────────
// Generates affiliate-ready search URLs (add affiliate ID later)

function generateBookingLink(hotelName: string, city: string, country: string): string {
  const query = encodeURIComponent(`${hotelName} ${city} ${country}`)
  // This is a search link — replace with affiliate link once approved
  return `https://www.booking.com/searchresults.html?ss=${query}&lang=en-us`
}

// ─── Helper: build rich place context for LLM ───────────────

function buildPlaceContext(
  place: PlaceResult,
  details: PlaceDetails | undefined,
  reviews: PlaceReviewSummary | undefined,
): string {
  const lines: string[] = []
  lines.push(`${place.name} — ${place.rating}★ (${place.reviewCount} reviews), ${place.priceLevel}, ${place.address}`)

  if (details) {
    if (details.hours?.length) lines.push(`  Hours: ${details.hours.map(h => `${h.day}: ${h.hours}`).join(', ')}`)
    if (details.highlights?.length) lines.push(`  Highlights: ${details.highlights.join(', ')}`)
    if (details.amenities?.length) lines.push(`  Amenities: ${details.amenities.join(', ')}`)
    if (details.checkInOut) lines.push(`  Check-in: ${details.checkInOut.checkIn || '?'}, Check-out: ${details.checkInOut.checkOut || '?'}`)
    if (details.bookingUrl) lines.push(`  Booking: ${details.bookingUrl}`)
    if (details.website) lines.push(`  Website: ${details.website}`)
    if (details.phone) lines.push(`  Phone: ${details.phone}`)
  }

  if (reviews && reviews.reviews.length > 0) {
    lines.push(`  Top review topics: ${reviews.topTopics.join(', ')}`)
    const topReviews = reviews.reviews.slice(0, 3)
    for (const r of topReviews) {
      const text = r.text.slice(0, 200)
      lines.push(`  Review (${r.rating}★): "${text}"`)
    }
  }

  return lines.join('\n')
}

// ─── Step 2: Fetch Real Hotels + LLM Enrich ──────────────────

async function stepFetchAndEnrichHotels(ctx: PipelineContext) {
  const db = getAdminClient()
  const cityData = getCityData(ctx.config.city)

  // Level 1: Search from Amadeus + SerpAPI in parallel
  const [rawHotels, googleHotels] = await Promise.all([
    cityData ? fetchAmadeusHotels(cityData.iata) : Promise.resolve([]),
    serpSearchHotels(ctx.config.city, ctx.config.country).catch(() => []),
  ])
  console.log(`[Pipeline] Hotels: ${rawHotels.length} from Amadeus, ${googleHotels.length} from SerpAPI`)

  // Level 2+3: Get details and reviews for top SerpAPI results
  const [detailsMap, reviewsMap] = await Promise.all([
    enrichPlacesWithDetails(googleHotels, 8),
    enrichPlacesWithReviews(googleHotels, 6),
  ])
  console.log(`[Pipeline] Hotel details: ${detailsMap.size}, reviews: ${reviewsMap.size}`)

  // Build rich context for LLM with all 3 levels of data
  const richHotelData = googleHotels.slice(0, 12).map(h => {
    const details = detailsMap.get(h.dataId)
    const reviews = reviewsMap.get(h.dataId)
    return buildPlaceContext(h, details, reviews)
  }).join('\n\n')

  const amadeusData = rawHotels.slice(0, 10).map(h =>
    `${h.name} — ${h.address} (Amadeus ID: ${h.hotelId})`
  ).join('\n')

  const raw = await llmGenerate(`
You are enriching REAL hotel data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE MAPS (with reviews and details):
${richHotelData || 'No Google Maps data available.'}

REAL DATA FROM AMADEUS:
${amadeusData || 'No Amadeus data available.'}

Using ONLY the real hotels above, produce AI-ready structured data for each.
DO NOT invent hotels. Only use names from the data above.
Pick the best 8-10 (mix of budget/mid/luxury).

Return JSON array:
[{
  "name": "Exact Hotel Name from data above",
  "detail": "Brief tagline like '5-star beachfront resort with infinity pool'",
  "category": "hotel|resort|hostel|villa|boutique",
  "price_per_night": "$120",
  "price_level": "budget|mid|luxury",
  "vibes": ["beach", "romantic"],
  "location": "Neighborhood/area",
  "review_synthesis": {
    "loved": ["What guests consistently praise — from real reviews above"],
    "complaints": ["What guests consistently complain about"],
    "vibe_words": ["Words reviewers use to describe the feel"]
  },
  "practical_tips": ["Book 2 weeks ahead for pool-view rooms", "Ask for high floor for ocean view"],
  "honest_take": "1-2 sentences: Is it worth the price? What surprised people? Who should skip it?",
  "best_for": ["couples", "families", "solo", "backpackers", "business"],
  "pairs_with": ["Nearby restaurant or activity that complements a stay here"],
  "amenities": ["Pool", "Spa", "Free WiFi"],
  "accessibility": ["Wheelchair accessible", "Elevator"]
}]`)

  let enriched: Record<string, unknown>[]
  try {
    enriched = JSON.parse(raw)
    console.log(`[Pipeline] Hotels: LLM returned ${enriched.length} enriched hotels`)
  } catch (parseErr) {
    console.error(`[Pipeline] Hotels: Failed to parse LLM JSON response`)
    console.error(`[Pipeline] Raw response (first 500 chars): ${raw.slice(0, 500)}`)
    throw new Error(`Hotels LLM JSON parse failed: ${parseErr}`)
  }

  await db.from('catalog_hotels').delete().eq('destination_id', ctx.destinationId)

  const rows = enriched.map((h: Record<string, unknown>) => {
    const hName = (h.name as string).toLowerCase()
    const gpMatch = googleHotels.find(g =>
      g.name.toLowerCase().includes(hName.split(' ')[0]) ||
      hName.includes(g.name.toLowerCase().split(' ')[0])
    )
    const realMatch = rawHotels.find(r =>
      r.name.toLowerCase().includes(hName.split(' ')[0]) ||
      hName.includes(r.name.toLowerCase().split(' ')[0])
    )
    const details = gpMatch ? detailsMap.get(gpMatch.dataId) : undefined
    const reviews = gpMatch ? reviewsMap.get(gpMatch.dataId) : undefined

    const validHotelCats = new Set(['hotel', 'resort', 'hostel', 'villa', 'boutique'])
    const hotelCat = validHotelCats.has(String(h.category || 'hotel').toLowerCase()) ? String(h.category).toLowerCase() : 'hotel'

    const source = realMatch && gpMatch ? 'amadeus+serpapi+ai'
      : realMatch ? 'amadeus+ai'
      : gpMatch ? 'serpapi+ai' : 'ai'

    return {
      destination_id: ctx.destinationId,
      name: h.name,
      description: (h.honest_take as string) || '',
      detail: h.detail,
      category: hotelCat,
      price_per_night: h.price_per_night,
      price_level: ['budget', 'mid', 'luxury'].includes(String(h.price_level || 'mid').toLowerCase()) ? String(h.price_level).toLowerCase() : 'mid',
      rating: gpMatch?.rating || 0,
      vibes: h.vibes || [],
      amenities: h.amenities || [],
      image_url: details?.photos?.[0] || gpMatch?.photoUrls?.[0] || null,
      location: h.location || details?.address || gpMatch?.address || realMatch?.address || '',
      booking_url: details?.bookingUrl || generateBookingLink(h.name as string, ctx.config.city, ctx.config.country),
      source,
      metadata: {
        // Real data from SerpAPI
        ...(gpMatch ? { placeId: gpMatch.placeId, dataId: gpMatch.dataId, reviewCount: gpMatch.reviewCount, mapsUrl: gpMatch.mapsUrl } : {}),
        ...(realMatch ? { hotelId: realMatch.hotelId, chainCode: realMatch.chainCode } : {}),
        // Details from Level 2
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          checkInOut: details.checkInOut,
          photos: details.photos,
        } : {}),
        // Reviews from Level 3
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map(r => ({ rating: r.rating, text: r.text.slice(0, 300) })),
        } : {}),
        // AI-ready structured knowledge
        review_synthesis: h.review_synthesis || {},
        practical_tips: h.practical_tips || [],
        honest_take: h.honest_take || '',
        best_for: h.best_for || [],
        pairs_with: h.pairs_with || [],
        accessibility: h.accessibility || [],
        lat: gpMatch?.lat || realMatch?.lat || 0,
        lng: gpMatch?.lng || realMatch?.lng || 0,
        // UI helpers
        info: [
          ...(details?.hours?.length ? [{ l: 'Check-in', v: details.checkInOut?.checkIn || 'N/A' }] : []),
          ...(details?.phone ? [{ l: 'Phone', v: details.phone }] : []),
          { l: 'Price', v: (h.price_per_night as string) || '' },
          { l: 'Rating', v: `${gpMatch?.rating || 0}★ (${gpMatch?.reviewCount || 0} reviews)` },
        ],
        features: h.amenities || [],
        alts: [],
      },
    }
  })

  console.log(`[Pipeline] Hotels: inserting ${rows.length} rows — sources: ${rows.map(r => r.source).join(', ')}`)
  const { error } = await db.from('catalog_hotels').insert(rows)
  if (error) {
    console.error(`[Pipeline] Hotels insert failed: ${error.message}`)
    console.error(`[Pipeline] Hotels insert details: ${JSON.stringify(error)}`)
    throw new Error(`Hotels insert failed: ${error.message}`)
  }
  console.log(`[Pipeline] Hotels: ${rows.length} inserted OK`)

  return rows.length
}

// ─── Step 3: Fetch Real Activities + Enrich ──────────────────

async function stepFetchAndEnrichActivities(ctx: PipelineContext) {
  const db = getAdminClient()
  const cityData = getCityData(ctx.config.city)

  // Level 1: Fetch from Amadeus + SerpAPI attractions in parallel
  const [rawActivities, serpAttractions] = await Promise.all([
    cityData ? fetchAmadeusActivities(cityData.lat, cityData.lng) : Promise.resolve([]),
    serpSearchAttractions(ctx.config.city, ctx.config.country).catch(() => []),
  ])
  console.log(`[Pipeline] Activities: ${rawActivities.length} from Amadeus, ${serpAttractions.length} from SerpAPI`)

  // Level 2+3: Get details and reviews for top SerpAPI attractions
  const [detailsMap, reviewsMap] = await Promise.all([
    enrichPlacesWithDetails(serpAttractions, 8),
    enrichPlacesWithReviews(serpAttractions, 6),
  ])
  console.log(`[Pipeline] Activity details: ${detailsMap.size}, reviews: ${reviewsMap.size}`)

  // Build rich context
  const richAttractionData = serpAttractions.slice(0, 12).map(a => {
    const details = detailsMap.get(a.dataId)
    const reviews = reviewsMap.get(a.dataId)
    return buildPlaceContext(a, details, reviews)
  }).join('\n\n')

  const amadeusData = rawActivities.slice(0, 15).map(a =>
    `${a.name} (${a.price}, ${a.duration || '?'}): ${a.description.slice(0, 150)}`
  ).join('\n')

  const raw = await llmGenerate(`
You are enriching REAL activity/attraction data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE MAPS (with reviews and details):
${richAttractionData || 'No Google Maps data available.'}

REAL DATA FROM AMADEUS TOURS API:
${amadeusData || 'No Amadeus data available.'}

Using the real data above, produce AI-ready structured data.
Prefer names from the data. You may add 2-3 well-known must-do experiences if missing.
Pick 12-15 total (mix of categories).

Return JSON array:
[{
  "name": "Exact Name from data above",
  "detail": "Brief tagline",
  "category": "sightseeing|adventure|cultural|nightlife|wellness|nature|food_tour|water_sport|shopping|event",
  "price": "$45",
  "duration": "2-3 hours",
  "vibes": ["adventure", "nature"],
  "best_time": "Morning|Afternoon|Evening|Night|Any",
  "location": "Area name",
  "review_synthesis": {
    "loved": ["What visitors consistently praise"],
    "complaints": ["Common complaints or warnings"],
    "vibe_words": ["How people describe the experience"]
  },
  "practical_tips": ["Go early to avoid crowds", "Bring water shoes", "Book online for 20% off"],
  "honest_take": "Is it worth the hype? What surprised people? Who should skip it?",
  "best_for": ["couples", "families", "solo", "backpackers", "photographers"],
  "pairs_with": ["Nearby place or experience that complements this"],
  "is_from_api": true
}]`)

  let enriched: Record<string, unknown>[]
  try {
    enriched = JSON.parse(raw)
    console.log(`[Pipeline] Activities: LLM returned ${enriched.length} enriched activities`)
  } catch (parseErr) {
    console.error(`[Pipeline] Activities: Failed to parse LLM JSON response`)
    console.error(`[Pipeline] Raw response (first 500 chars): ${raw.slice(0, 500)}`)
    throw new Error(`Activities LLM JSON parse failed: ${parseErr}`)
  }

  await db.from('catalog_activities').delete().eq('destination_id', ctx.destinationId)

  const validCategories = new Set(['sightseeing', 'adventure', 'cultural', 'nightlife', 'wellness', 'nature', 'food_tour', 'water_sport', 'shopping', 'event'])
  const mapActivityCategory = (cat: string) => {
    if (validCategories.has(cat)) return cat
    const mapping: Record<string, string> = {
      'tour': 'sightseeing', 'temple': 'cultural', 'museum': 'cultural', 'historical': 'cultural',
      'beach': 'nature', 'hiking': 'adventure', 'diving': 'water_sport', 'snorkeling': 'water_sport',
      'surfing': 'water_sport', 'kayaking': 'water_sport', 'spa': 'wellness', 'yoga': 'wellness',
      'massage': 'wellness', 'meditation': 'wellness', 'club': 'nightlife', 'bar': 'nightlife',
      'party': 'nightlife', 'market': 'shopping', 'food': 'food_tour', 'cooking': 'food_tour',
      'tasting': 'food_tour', 'festival': 'event', 'concert': 'event', 'show': 'event',
      'entertainment': 'event', 'sport': 'adventure', 'extreme': 'adventure', 'zipline': 'adventure',
      'rafting': 'adventure', 'trekking': 'adventure', 'safari': 'nature', 'wildlife': 'nature',
      'photography': 'sightseeing', 'sunset': 'sightseeing', 'boat': 'nature', 'cruise': 'nature',
    }
    for (const [key, val] of Object.entries(mapping)) {
      if (cat.toLowerCase().includes(key)) return val
    }
    return 'sightseeing'
  }

  const rows = enriched.map((a: Record<string, unknown>) => {
    const aName = (a.name as string).toLowerCase()
    const realMatch = rawActivities.find(r =>
      r.name.toLowerCase().includes(aName.split(':')[0].split('–')[0].trim().slice(0, 20)) ||
      aName.includes(r.name.toLowerCase().slice(0, 20))
    )
    const serpMatch = serpAttractions.find(s =>
      s.name.toLowerCase().includes(aName.split(' ')[0]) ||
      aName.includes(s.name.toLowerCase().split(' ')[0])
    )
    const details = serpMatch ? detailsMap.get(serpMatch.dataId) : undefined
    const reviews = serpMatch ? reviewsMap.get(serpMatch.dataId) : undefined

    const mappedCat = mapActivityCategory(String(a.category || 'sightseeing'))
    const safeCat = validCategories.has(mappedCat) ? mappedCat : 'sightseeing'

    const source = realMatch && serpMatch ? 'amadeus+serpapi+ai'
      : realMatch ? 'amadeus+ai'
      : serpMatch ? 'serpapi+ai' : 'ai'

    return {
      destination_id: ctx.destinationId,
      name: a.name,
      description: (a.honest_take as string) || '',
      detail: a.detail,
      category: safeCat,
      price: a.price || realMatch?.price || '',
      duration: a.duration || realMatch?.duration || '',
      vibes: a.vibes || [],
      best_time: a.best_time,
      image_url: details?.photos?.[0] || serpMatch?.photoUrls?.[0] || realMatch?.pictures?.[0] || null,
      location: a.location || details?.address || serpMatch?.address || '',
      booking_url: realMatch?.bookingLink || details?.bookingUrl || null,
      source,
      metadata: {
        ...(realMatch ? { amadeusId: realMatch.id } : {}),
        ...(serpMatch ? { placeId: serpMatch.placeId, dataId: serpMatch.dataId, reviewCount: serpMatch.reviewCount, mapsUrl: serpMatch.mapsUrl } : {}),
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          photos: details.photos,
        } : {}),
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map(r => ({ rating: r.rating, text: r.text.slice(0, 300) })),
        } : {}),
        review_synthesis: a.review_synthesis || {},
        practical_tips: a.practical_tips || [],
        honest_take: a.honest_take || '',
        best_for: a.best_for || [],
        pairs_with: a.pairs_with || [],
        lat: serpMatch?.lat || 0,
        lng: serpMatch?.lng || 0,
        info: [
          { l: 'Duration', v: (a.duration as string) || realMatch?.duration || '' },
          { l: 'Best Time', v: (a.best_time as string) || '' },
          { l: 'Price', v: (a.price as string) || realMatch?.price || '' },
          ...(serpMatch ? [{ l: 'Rating', v: `${serpMatch.rating}★ (${serpMatch.reviewCount} reviews)` }] : []),
        ],
        features: (a.vibes as string[]) || [],
        alts: [],
      },
    }
  })

  console.log(`[Pipeline] Activities: inserting ${rows.length} rows — sources: ${rows.map(r => r.source).join(', ')}`)
  const { error } = await db.from('catalog_activities').insert(rows)
  if (error) {
    console.error(`[Pipeline] Activities insert failed: ${error.message}`)
    console.error(`[Pipeline] Activities insert details: ${JSON.stringify(error)}`)
    throw new Error(`Activities insert failed: ${error.message}`)
  }
  console.log(`[Pipeline] Activities: ${rows.length} inserted OK`)

  return rows.length
}

// ─── Step 4: SerpAPI Restaurants + LLM Enrich ────────────────

async function stepFetchAndEnrichRestaurants(ctx: PipelineContext) {
  const db = getAdminClient()

  // Level 1: Search restaurants
  let googleRestaurants: PlaceResult[] = []
  try {
    googleRestaurants = await serpSearchRestaurants(ctx.config.city, ctx.config.country)
    console.log(`[Pipeline] Fetched ${googleRestaurants.length} restaurants from SerpAPI`)
  } catch (e) {
    console.log(`[Pipeline] SerpAPI restaurants failed: ${e}`)
  }

  // Level 2+3: Details and reviews for top restaurants
  const [detailsMap, reviewsMap] = await Promise.all([
    enrichPlacesWithDetails(googleRestaurants, 8),
    enrichPlacesWithReviews(googleRestaurants, 6),
  ])
  console.log(`[Pipeline] Restaurant details: ${detailsMap.size}, reviews: ${reviewsMap.size}`)

  // Build rich context
  const richRestaurantData = googleRestaurants.slice(0, 15).map(r => {
    const details = detailsMap.get(r.dataId)
    const reviews = reviewsMap.get(r.dataId)
    return buildPlaceContext(r, details, reviews)
  }).join('\n\n')

  const raw = await llmGenerate(`
You are enriching REAL restaurant data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE MAPS (with reviews and details):
${richRestaurantData || 'No Google Maps data available.'}

Using ONLY the real restaurants above, produce AI-ready structured data.
DO NOT invent restaurants. Only use names from the data above.
Pick the best 8-10 (mix of street food, casual, fine dining).

Return JSON array:
[{
  "name": "Exact Restaurant Name from data above",
  "detail": "Brief tagline like 'Legendary street-side pad thai since 1966'",
  "cuisine": "Thai, Indian, Seafood, etc.",
  "price_level": "budget|mid|luxury",
  "avg_cost": "$15 per person",
  "vibes": ["foodie", "romantic", "local"],
  "must_try": ["Pad Thai", "Green Curry"],
  "location": "Real neighborhood/street",
  "review_synthesis": {
    "loved": ["What diners consistently praise"],
    "complaints": ["Common complaints — long wait, cash only, etc."],
    "vibe_words": ["How people describe the atmosphere"]
  },
  "practical_tips": ["Arrive before 6pm to avoid 1-hour wait", "Cash only", "Order the off-menu special"],
  "honest_take": "Is it worth the hype? What makes it special? Who should skip it?",
  "best_for": ["couples", "families", "foodies", "solo", "groups"],
  "pairs_with": ["Nearby bar or dessert spot to hit after"],
  "dietary": ["Vegetarian options available", "Halal", "Gluten-free menu"]
}]`)

  let enriched: Record<string, unknown>[]
  try {
    enriched = JSON.parse(raw)
    console.log(`[Pipeline] Restaurants: LLM returned ${enriched.length} enriched restaurants`)
  } catch (parseErr) {
    console.error(`[Pipeline] Restaurants: Failed to parse LLM JSON response`)
    console.error(`[Pipeline] Raw response (first 500 chars): ${raw.slice(0, 500)}`)
    throw new Error(`Restaurants LLM JSON parse failed: ${parseErr}`)
  }

  await db.from('catalog_restaurants').delete().eq('destination_id', ctx.destinationId)

  const rows = enriched.map((r: Record<string, unknown>) => {
    const rName = (r.name as string).toLowerCase()
    const gpMatch = googleRestaurants.find(g =>
      g.name.toLowerCase().includes(rName.split(' ')[0]) ||
      rName.includes(g.name.toLowerCase().split(' ')[0])
    )
    const details = gpMatch ? detailsMap.get(gpMatch.dataId) : undefined
    const reviews = gpMatch ? reviewsMap.get(gpMatch.dataId) : undefined

    return {
      destination_id: ctx.destinationId,
      name: r.name,
      description: (r.honest_take as string) || '',
      detail: r.detail,
      cuisine: r.cuisine,
      price_level: ['budget', 'mid', 'luxury'].includes(r.price_level as string) ? r.price_level : 'mid',
      avg_cost: r.avg_cost,
      vibes: r.vibes || [],
      must_try: r.must_try || [],
      image_url: details?.photos?.[0] || gpMatch?.photoUrls?.[0] || null,
      location: r.location || details?.address || gpMatch?.address || '',
      booking_url: details?.bookingUrl || gpMatch?.mapsUrl || null,
      source: gpMatch ? 'serpapi+ai' : 'ai',
      metadata: {
        ...(gpMatch ? { placeId: gpMatch.placeId, dataId: gpMatch.dataId, rating: gpMatch.rating, reviewCount: gpMatch.reviewCount, mapsUrl: gpMatch.mapsUrl } : {}),
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          photos: details.photos,
        } : {}),
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map(rv => ({ rating: rv.rating, text: rv.text.slice(0, 300) })),
        } : {}),
        review_synthesis: r.review_synthesis || {},
        practical_tips: r.practical_tips || [],
        honest_take: r.honest_take || '',
        best_for: r.best_for || [],
        pairs_with: r.pairs_with || [],
        dietary: r.dietary || [],
        lat: gpMatch?.lat || 0,
        lng: gpMatch?.lng || 0,
        info: [
          { l: 'Cuisine', v: (r.cuisine as string) || '' },
          { l: 'Avg Cost', v: (r.avg_cost as string) || '' },
          ...(gpMatch ? [{ l: 'Rating', v: `${gpMatch.rating}★ (${gpMatch.reviewCount} reviews)` }] : []),
          ...(details?.hours?.length ? [{ l: 'Hours', v: details.hours[0]?.hours || '' }] : []),
        ],
        features: (r.must_try as string[]) || [],
        alts: [],
      },
    }
  })

  console.log(`[Pipeline] Restaurants: inserting ${rows.length} rows — sources: ${rows.map(r => r.source).join(', ')}`)
  const { error } = await db.from('catalog_restaurants').insert(rows)
  if (error) {
    console.error(`[Pipeline] Restaurants insert failed: ${error.message}`)
    console.error(`[Pipeline] Restaurants insert details: ${JSON.stringify(error)}`)
    throw new Error(`Restaurants insert failed: ${error.message}`)
  }
  console.log(`[Pipeline] Restaurants: ${rows.length} inserted OK`)

  return rows.length
}

// ─── Step 5: Generate Itinerary Template from Catalog ────────

async function stepGenerateTemplate(ctx: PipelineContext) {
  const db = getAdminClient()

  // Pull the real catalog data we just created
  const [{ data: hotels }, { data: activities }, { data: restaurants }] = await Promise.all([
    db.from('catalog_hotels').select('name, price_per_night, price_level, location').eq('destination_id', ctx.destinationId),
    db.from('catalog_activities').select('name, price, duration, best_time, category, location').eq('destination_id', ctx.destinationId),
    db.from('catalog_restaurants').select('name, cuisine, avg_cost, price_level, location').eq('destination_id', ctx.destinationId),
  ])

  const catalogSummary = `
REAL HOTELS IN CATALOG:
${(hotels || []).map(h => `- ${h.name} (${h.price_per_night}/night, ${h.price_level}) — ${h.location}`).join('\n')}

REAL ACTIVITIES IN CATALOG:
${(activities || []).map(a => `- ${a.name} (${a.price}, ${a.duration}) — ${a.best_time}, ${a.location}`).join('\n')}

REAL RESTAURANTS IN CATALOG:
${(restaurants || []).map(r => `- ${r.name} (${r.cuisine}, ${r.avg_cost}) — ${r.location}`).join('\n')}`

  const raw = await llmGenerate(`
Build a 5-day itinerary template for ${ctx.config.city}, ${ctx.config.country} using ONLY items from our real catalog:

${catalogSummary}

Vibes: ${ctx.config.vibes.join(', ')}
Budget level: mid

Rules:
- ONLY use hotel, activity, and restaurant names from the catalog above
- Create a natural flow: arrival → settle → explore → meals → activities → departure
- Each day should have a theme and 4-6 items
- Include transfers between locations

Return JSON array:
[{
  "day": 1,
  "category": "flight|hotel|activity|food|transfer|day",
  "name": "Exact Name From Catalog",
  "detail": "Brief detail",
  "description": "Longer description",
  "price": "$100",
  "time": "09:00",
  "metadata": {
    "reason": "One-line explanation of why Drift picked this item for the user (e.g. 'Best price-to-comfort ratio in Seminyak')",
    "whyFactors": ["Factor 1 explaining the pick", "Factor 2", "Factor 3"],
    "info": [{"l": "Duration", "v": "2h"}],
    "features": ["Scenic"],
    "alts": [{"name": "Alt from catalog", "detail": "Why", "price": "$80"}]
  }
}]

IMPORTANT: Every non-day, non-transfer item MUST have metadata.reason (a short, opinionated tagline) and metadata.whyFactors (2-4 bullet reasons based on vibes, budget, timing, or location flow).

Start each day with a "day" separator (category: "day", name: "Day 1 — Theme").`)

  let items: Record<string, unknown>[]
  try {
    items = JSON.parse(raw)
    console.log(`[Pipeline] Template: LLM returned ${items.length} itinerary items`)
  } catch (parseErr) {
    console.error(`[Pipeline] Template: Failed to parse LLM JSON response`)
    console.error(`[Pipeline] Raw response (first 500 chars): ${raw.slice(0, 500)}`)
    throw new Error(`Template LLM JSON parse failed: ${parseErr}`)
  }

  await db.from('catalog_templates').delete().eq('destination_id', ctx.destinationId)

  const { error } = await db.from('catalog_templates').insert({
    destination_id: ctx.destinationId,
    name: `${ctx.config.city} — ${ctx.config.vibes.slice(0, 2).join(' & ')}`,
    vibes: ctx.config.vibes,
    budget_level: 'mid',
    duration_days: 5,
    items,
  })

  if (error) {
    console.error(`[Pipeline] Template insert failed: ${error.message}`)
    throw new Error(`Template insert failed: ${error.message}`)
  }
  console.log(`[Pipeline] Template: ${items.length} items inserted OK`)
  return items.length
}

// ─── Step 6: Enrich Destination ──────────────────────────────

async function stepEnrichDestination(ctx: PipelineContext) {
  const db = getAdminClient()
  console.log(`[Pipeline] Enriching destination metadata for ${ctx.config.city}...`)

  const raw = await llmGenerate(`
Write a compelling 2-3 sentence description of ${ctx.config.city}, ${ctx.config.country} as a travel destination.
Target vibes: ${ctx.config.vibes.join(', ')}.
Write in a warm, editorial tone. Make someone want to book immediately.
Return JSON: {"description": "...", "avg_budget_per_day": {"budget": 50, "mid": 120, "luxury": 350}}
Use realistic daily budget numbers in USD for this destination.`)

  let enriched: Record<string, unknown>
  try {
    enriched = JSON.parse(raw)
    console.log(`[Pipeline] Enrich: description="${(enriched.description as string)?.slice(0, 80)}..."`)
    console.log(`[Pipeline] Enrich: avg_budget_per_day=${JSON.stringify(enriched.avg_budget_per_day)}`)
  } catch (parseErr) {
    console.error(`[Pipeline] Enrich: Failed to parse LLM JSON`)
    console.error(`[Pipeline] Raw: ${raw.slice(0, 300)}`)
    throw new Error(`Enrich LLM JSON parse failed: ${parseErr}`)
  }

  const { error } = await db
    .from('catalog_destinations')
    .update({
      description: enriched.description,
      avg_budget_per_day: enriched.avg_budget_per_day,
      status: 'active',
    })
    .eq('id', ctx.destinationId)

  if (error) {
    console.error(`[Pipeline] Enrich update failed: ${error.message}`)
    throw new Error(`Enrich update failed: ${error.message}`)
  }
  console.log(`[Pipeline] Destination set to 'active' — pipeline complete for ${ctx.config.city}`)
}

// ─── Individual Step Runners (for dashboard) ────────────────

export async function runSingleStep(
  destinationId: string,
  stepName: string,
  config: DestinationConfig,
): Promise<{ step: string; count: number }> {
  const ctx: PipelineContext = {
    config,
    destinationId,
    runId: `manual-${Date.now()}`,
    steps: [],
  }

  const stepMap: Record<string, () => Promise<number | void>> = {
    hotels: () => stepFetchAndEnrichHotels(ctx),
    activities: () => stepFetchAndEnrichActivities(ctx),
    restaurants: () => stepFetchAndEnrichRestaurants(ctx),
    template: () => stepGenerateTemplate(ctx),
    enrich: () => stepEnrichDestination(ctx),
  }

  const fn = stepMap[stepName]
  if (!fn) throw new Error(`Unknown step: ${stepName}`)

  const result = await fn()
  return { step: stepName, count: typeof result === 'number' ? result : 1 }
}

// ─── Pipeline Runner ─────────────────────────────────────────

export async function runPipeline(config: DestinationConfig): Promise<{
  destinationId: string
  runId: string
  stats: Record<string, number>
}> {
  const pipelineStart = Date.now()
  console.log(`\n${'='.repeat(60)}`)
  console.log(`[Pipeline] STARTING full pipeline for ${config.city}, ${config.country}`)
  console.log(`[Pipeline] Vibes: ${config.vibes.join(', ')}`)
  console.log(`${'='.repeat(60)}\n`)

  const db = getAdminClient()
  const destinationId = await stepCreateDestination(config)
  console.log(`[Pipeline] Destination ID: ${destinationId}`)

  const { data: run, error: runError } = await db
    .from('pipeline_runs')
    .insert({ destination_id: destinationId, status: 'running' })
    .select('id')
    .single()

  if (runError) console.error(`[Pipeline] Failed to create pipeline_run: ${runError.message}`)

  const runId = run?.id || 'unknown'
  console.log(`[Pipeline] Run ID: ${runId}`)
  const ctx: PipelineContext = { config, destinationId, runId, steps: [] }
  const stats: Record<string, number> = {}

  const steps = [
    { name: 'hotels', fn: () => stepFetchAndEnrichHotels(ctx) },
    { name: 'activities', fn: () => stepFetchAndEnrichActivities(ctx) },
    { name: 'restaurants', fn: () => stepFetchAndEnrichRestaurants(ctx) },
    { name: 'template', fn: () => stepGenerateTemplate(ctx) },
    { name: 'enrich', fn: () => stepEnrichDestination(ctx) },
  ]

  try {
    for (const step of steps) {
      const stepStart = Date.now()
      console.log(`\n--- [Pipeline] Step: ${step.name.toUpperCase()} ---`)
      const result = await step.fn()
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      ctx.steps.push(step.name)
      stats[step.name] = typeof result === 'number' ? result : 1
      console.log(`[Pipeline] Step ${step.name} completed: ${stats[step.name]} items in ${elapsed}s`)

      await db
        .from('pipeline_runs')
        .update({ steps_completed: ctx.steps, stats })
        .eq('id', runId)
    }

    const totalElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)
    await db
      .from('pipeline_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), stats })
      .eq('id', runId)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[Pipeline] COMPLETED in ${totalElapsed}s`)
    console.log(`[Pipeline] Stats: ${JSON.stringify(stats)}`)
    console.log(`${'='.repeat(60)}\n`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const totalElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)
    console.error(`\n[Pipeline] FAILED at step "${ctx.steps.length > 0 ? ctx.steps[ctx.steps.length - 1] : 'init'}" after ${totalElapsed}s`)
    console.error(`[Pipeline] Error: ${msg}`)
    if (error instanceof Error && error.stack) console.error(`[Pipeline] Stack: ${error.stack}`)
    await db
      .from('pipeline_runs')
      .update({ status: 'failed', error: msg, completed_at: new Date().toISOString(), stats })
      .eq('id', runId)
    throw error
  }

  return { destinationId, runId, stats }
}

// ─── Helpers ─────────────────────────────────────────────────

export async function getPipelineRun(runId: string) {
  const db = getAdminClient()
  const { data } = await db
    .from('pipeline_runs')
    .select('*, catalog_destinations(city, country)')
    .eq('id', runId)
    .single()
  return data
}

export async function getCatalogStats() {
  const db = getAdminClient()
  const [destinations, hotels, activities, restaurants, templates] = await Promise.all([
    db.from('catalog_destinations').select('id, city, country, status, vibes, pipeline_run_at, cover_image'),
    db.from('catalog_hotels').select('id, destination_id'),
    db.from('catalog_activities').select('id, destination_id'),
    db.from('catalog_restaurants').select('id, destination_id'),
    db.from('catalog_templates').select('id, destination_id'),
  ])
  return {
    destinations: destinations.data || [],
    hotelCount: hotels.data?.length || 0,
    activityCount: activities.data?.length || 0,
    restaurantCount: restaurants.data?.length || 0,
    templateCount: templates.data?.length || 0,
  }
}
