// ─── Travel Data Pipeline ─────────────────────────────────────
// Config-driven catalog builder. Multi-source real data + LLM enrichment.
// Discovery: Google Places (bulk) + SerpAPI (details/reviews)
// Enrichment: LLM enriches ALL discovered places in batches
// Storage: Upsert by place_id for freshness tracking
// Templates: LLM builds from real catalog data

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getDestinationImage, upsizeGoogleImage } from './images'
import { getPlaceFallbackPhotos } from './unsplash'
import {
  type PlaceResult,
  type PlaceDetails,
  type PlaceReviewSummary,
} from './serpapi'
import {
  discoverPlaces,
  withRetry,
  type CategoryType,
  type DiscoveryResult,
} from './discovery'
import { QuotaTracker } from './quota-tracker'

// LLM Provider: Claude (primary) → Gemini (fallback) → Groq (last resort)
let _anthropicClient: Anthropic | null = null
let _openaiClient: OpenAI | null = null
let _llmProvider = 'unknown'
let _llmModel = 'unknown'
let _providerSwitchCount = 0

function initLlm() {
  if (_llmProvider !== 'unknown') return

  if (process.env.ANTHROPIC_API_KEY) {
    _llmProvider = 'Claude'
    _llmModel = 'claude-sonnet-4-20250514'
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  } else if (process.env.GEMINI_API_KEY) {
    _llmProvider = 'Gemini'
    _llmModel = 'gemini-3-flash-preview'
    _openaiClient = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    })
  } else {
    _llmProvider = 'Groq'
    _llmModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    _openaiClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }
  console.log(`[Pipeline] LLM provider: ${_llmProvider}, model: ${_llmModel}`)
}

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
  quota: QuotaTracker
  runStartTime: string
}

// ─── Upsert Helpers ─────────────────────────────────────────

export function splitByPlaceId<T extends { place_id?: string | null }>(
  rows: T[]
): { withPlaceId: T[]; withoutPlaceId: T[] } {
  const withPlaceId = rows.filter(r => r.place_id != null)
  const withoutPlaceId = rows.filter(r => r.place_id == null)
  return { withPlaceId, withoutPlaceId }
}

async function upsertCatalogItems(
  tableName: string,
  rows: Record<string, unknown>[],
  ctx: PipelineContext,
) {
  const db = getAdminClient()
  const { withPlaceId: rawWithPlaceId, withoutPlaceId } = splitByPlaceId(rows as Array<Record<string, unknown> & { place_id?: string | null }>)

  // Deduplicate by place_id (keep last occurrence) to avoid "cannot affect row a second time"
  const placeIdMap = new Map<string, Record<string, unknown>>()
  for (const row of rawWithPlaceId) {
    placeIdMap.set(row.place_id as string, row)
  }
  const withPlaceId = Array.from(placeIdMap.values())
  if (rawWithPlaceId.length !== withPlaceId.length) {
    console.log(`[Pipeline] ${tableName}: deduped ${rawWithPlaceId.length} → ${withPlaceId.length} by place_id`)
  }

  // Upsert items with place_id in chunks of 10 (avoid payload too large)
  if (withPlaceId.length > 0) {
    const batches = chunk(withPlaceId, 10)
    console.log(`[Pipeline] ${tableName}: upserting ${withPlaceId.length} items in ${batches.length} batches`)
    for (const batch of batches) {
      const { error } = await withRetry<{ error: { message: string } | null }>(
        async () => await db.from(tableName).upsert(batch, {
          onConflict: 'destination_id,place_id',
        }),
        `DB:upsert-${tableName}`,
      )
      if (error) throw new Error(`${tableName} upsert failed: ${error.message}`)
    }
    console.log(`[Pipeline] ${tableName}: ${withPlaceId.length} upserted`)
  }

  // Insert items without place_id in chunks of 10
  if (withoutPlaceId.length > 0) {
    const batches = chunk(withoutPlaceId, 10)
    console.log(`[Pipeline] ${tableName}: inserting ${withoutPlaceId.length} items (no place_id) in ${batches.length} batches`)
    for (const batch of batches) {
      const { error } = await withRetry<{ error: { message: string } | null }>(
        async () => await db.from(tableName).insert(batch),
        `DB:insert-${tableName}-no-placeid`,
      )
      if (error) console.warn(`[Pipeline] ${tableName} insert batch failed: ${error.message}`)
    }
    console.log(`[Pipeline] ${tableName}: ${withoutPlaceId.length} inserted (no place_id)`)
  }

  // Soft-delete stale items: mark items not updated in this run as inactive
  const { error: softDelError } = await db
    .from(tableName)
    .update({ status: 'inactive' })
    .eq('destination_id', ctx.destinationId)
    .lt('updated_at', ctx.runStartTime)
    .neq('status', 'inactive')

  if (softDelError) {
    console.warn(`[Pipeline] ${tableName} soft-delete failed: ${softDelError.message}`)
  } else {
    console.log(`[Pipeline] ${tableName}: stale items marked inactive (updated_at < ${ctx.runStartTime})`)
  }

  return withPlaceId.length + withoutPlaceId.length
}

// ─── Discovery: Query Generation + Batch Enrichment ─────────

async function generateDiscoveryQueries(
  city: string,
  country: string,
  vibes: string[],
  category: CategoryType,
): Promise<string[]> {
  const categoryDescriptions: Record<CategoryType, string> = {
    hotels: 'hotels, resorts, hostels, boutique stays, and accommodations',
    activities: 'attractions, tours, experiences, sightseeing, adventure, cultural activities, and things to do',
    restaurants: 'restaurants, street food, cafes, fine dining, local cuisine, and food experiences',
  }

  const raw = await withRetry(
    () => llmGenerate(`
You are generating Google Maps search queries to build a comprehensive travel catalog for ${city}, ${country}.
Category: ${categoryDescriptions[category]}
Destination vibes: ${vibes.join(', ')}

Generate 12 diverse search queries that will find REAL ${category} across:
- Price tiers (budget, mid-range, luxury)
- Different neighborhoods/areas of the city
- Different subcategories
- Traveler types (solo, couples, families, backpackers)
- Local/cultural specialties unique to this destination

Rules:
- Each query should target a DIFFERENT segment (don't repeat similar queries)
- Use local terms where appropriate (e.g. "ryokan" for Japan, "riad" for Morocco, "dhaba" for India)
- Include the city name in each query
- Queries should work well on Google Maps

Return JSON array of strings: ["query 1", "query 2", ...]`),
    'LLM:discovery-queries',
  )

  try {
    const queries = JSON.parse(repairJsonArray(raw))
    if (Array.isArray(queries) && queries.length > 0) {
      console.log(`[Pipeline] Generated ${queries.length} discovery queries for ${category}`)
      return queries.slice(0, 15) // Cap at 15
    }
  } catch {
    console.warn(`[Pipeline] Failed to parse discovery queries, using defaults`)
  }

  // Fallback queries if LLM fails
  const fallbacks: Record<CategoryType, string[]> = {
    hotels: [
      `best hotels in ${city} ${country}`,
      `budget hostels ${city} ${country}`,
      `luxury resorts ${city} ${country}`,
      `boutique hotels ${city}`,
      `family hotels ${city}`,
    ],
    activities: [
      `top attractions in ${city} ${country}`,
      `things to do in ${city} ${country}`,
      `adventure activities ${city} ${country}`,
      `cultural experiences ${city}`,
      `day trips from ${city}`,
    ],
    restaurants: [
      `best restaurants in ${city} ${country}`,
      `popular street food in ${city} ${country}`,
      `fine dining ${city} ${country}`,
      `local cuisine ${city}`,
      `cafes ${city}`,
    ],
  }
  return fallbacks[category]
}

// Chunk an array into batches of `size`
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

// Batch-enrich places through LLM in chunks
async function batchEnrich(
  places: PlaceResult[],
  detailsMap: Map<string, PlaceDetails>,
  reviewsMap: Map<string, PlaceReviewSummary>,
  promptFn: (context: string) => string,
  chunkSize: number = 4,
  quota?: QuotaTracker,
): Promise<Record<string, unknown>[]> {
  const allEnriched: Record<string, unknown>[] = []
  const batches = chunk(places, chunkSize)

  console.log(`[Pipeline] Batch enriching ${places.length} places in ${batches.length} batches of ~${chunkSize}`)

  // Process a single batch, splitting on 413 (request too large)
  async function processBatch(
    batch: PlaceResult[],
    batchLabel: string,
  ): Promise<Record<string, unknown>[]> {
    const batchContext = batch.map((p: PlaceResult) => {
      const details = detailsMap.get(p.dataId)
      const reviews = reviewsMap.get(p.dataId)
      return buildPlaceContext(p, details, reviews)
    }).join('\n\n')

    try {
      const raw = await withRetry(
        () => llmGenerate(promptFn(batchContext)),
        `LLM:${batchLabel}`,
      )
      quota?.increment('llm')

      const parsed = JSON.parse(repairJsonArray(raw))
      if (Array.isArray(parsed)) {
        console.log(`[Pipeline] ${batchLabel}: ${parsed.length} items enriched`)
        return parsed
      }
      return []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('413') || msg.includes('too large')) {
        if (batch.length <= 1) {
          console.error(`[Pipeline] ${batchLabel}: single item too large for model, skipping`)
          return []
        }
        const mid = Math.ceil(batch.length / 2)
        console.warn(`[Pipeline] ${batchLabel}: 413 too large (${batch.length} items), splitting into ${mid} + ${batch.length - mid}`)
        const left = await processBatch(batch.slice(0, mid), `${batchLabel}a`)
        await new Promise(r => setTimeout(r, 1000))
        const right = await processBatch(batch.slice(mid), `${batchLabel}b`)
        return [...left, ...right]
      }
      console.error(`[Pipeline] ${batchLabel}: LLM failed, skipping batch — ${msg}`)
      return []
    }
  }

  for (let i = 0; i < batches.length; i++) {
    const result = await processBatch(batches[i], `batch${i + 1}/${batches.length}`)
    allEnriched.push(...result)

    // Small delay between LLM batches
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log(`[Pipeline] Batch enrichment complete: ${allEnriched.length} total items`)
  return allEnriched
}

// Validate enriched items have required fields
function validateItem(item: Record<string, unknown>, category: CategoryType): boolean {
  if (!item.name || typeof item.name !== 'string') return false
  switch (category) {
    case 'hotels': return !!item.price_level && !!item.location
    case 'activities': return !!item.category && !!item.duration
    case 'restaurants': return !!item.cuisine && !!item.price_level
  }
}

// ─── Data source: Google Places (primary) + SerpAPI (details) ─

// ─── LLM Helper ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a travel data enrichment engine. Return ONLY valid JSON. No markdown, no explanation. Be specific with real place names, realistic prices, and vivid descriptions. Write in a warm, editorial travel magazine voice.`

async function llmGenerate(prompt: string): Promise<string> {
  initLlm()
  const llmStart = Date.now()
  const promptPreview = prompt.slice(0, 100).replace(/\n/g, ' ')
  console.log(`[LLM] Calling ${_llmProvider}/${_llmModel} — prompt: "${promptPreview}..."`)

  try {
    let text: string

    if (_anthropicClient) {
      const res = await _anthropicClient.messages.create({
        model: _llmModel,
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = res.content[0]
      text = block.type === 'text' ? block.text : '[]'
      const elapsed = ((Date.now() - llmStart) / 1000).toFixed(1)
      console.log(`[LLM] Response in ${elapsed}s — ${text.length} chars, tokens: ${res.usage.input_tokens + res.usage.output_tokens}`)
    } else if (_openaiClient) {
      const res = await _openaiClient.chat.completions.create({
        model: _llmModel,
        max_tokens: 16384,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      })
      text = res.choices[0].message.content || '[]'
      const elapsed = ((Date.now() - llmStart) / 1000).toFixed(1)
      const usage = res.usage
      console.log(`[LLM] Response in ${elapsed}s — ${text.length} chars, tokens: ${usage?.total_tokens || '?'}`)
    } else {
      throw new Error('No LLM configured — set ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY')
    }

    return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const isRateLimit = msg.includes('429') || msg.includes('503') || msg.includes('rate') || msg.includes('quota') || msg.includes('overloaded')
    const isTooLarge = msg.includes('413') || msg.includes('too large')

    // Cap provider switches to prevent infinite bounce between Gemini (503) and Groq (413)
    if (_providerSwitchCount >= 3) {
      console.error(`[LLM] Provider switch limit reached (${_providerSwitchCount}) — giving up`)
      throw error
    }

    // On 413 from Groq fallback, switch back to Gemini (Groq's 12K TPM is too small)
    if (isTooLarge && _llmProvider.includes('Groq') && process.env.GEMINI_API_KEY) {
      _providerSwitchCount++
      console.warn(`[LLM] Groq 413 (prompt too large for 12K TPM) — switching back to Gemini (switch ${_providerSwitchCount}/3)`)
      _openaiClient = new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
      _llmProvider = 'Gemini'
      _llmModel = 'gemini-3-flash-preview'
    }

    // Provider fallback on rate limit (Claude -> Gemini -> Groq)
    // Note: Don't fall back from Gemini to Groq — Groq's 12K TPM is too small for enrichment prompts.
    // Let withRetry handle Gemini 503s with exponential backoff instead.
    if (isRateLimit && _llmProvider === 'Claude' && process.env.GEMINI_API_KEY) {
      _providerSwitchCount++
      console.warn(`[LLM] Claude rate limited — falling back to Gemini`)
      _anthropicClient = null
      _openaiClient = new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' })
      _llmProvider = 'Gemini (fallback)'
      _llmModel = 'gemini-3-flash-preview'
    } else if (isRateLimit && _llmProvider === 'Claude' && process.env.GROQ_API_KEY) {
      _providerSwitchCount++
      console.warn(`[LLM] Falling back to Groq`)
      _anthropicClient = null
      _openaiClient = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
      _llmProvider = 'Groq (fallback)'
      _llmModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    }

    const elapsed = ((Date.now() - llmStart) / 1000).toFixed(1)
    console.error(`[LLM] FAILED after ${elapsed}s: ${msg}`)
    throw error
  }
}

// Repair truncated JSON arrays (when LLM output gets cut off)
function repairJsonArray(raw: string): string {
  try {
    JSON.parse(raw)
    return raw // Valid already
  } catch {
    // Try to close open strings, objects, and arrays
    let fixed = raw
    // Count open braces/brackets
    const opens = (fixed.match(/\{/g) || []).length
    const closes = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length

    // If we're inside a string, close it
    const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length
    if (quoteCount % 2 !== 0) fixed += '"'

    // Close any open objects
    for (let i = 0; i < opens - closes; i++) fixed += '}'
    // Close any open arrays
    for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']'

    // Remove trailing comma before closing bracket
    fixed = fixed.replace(/,\s*(\]|\})/g, '$1')

    try {
      JSON.parse(fixed)
      console.log(`[JSONRepair] Fixed truncated JSON (added ${fixed.length - raw.length} chars)`)
      return fixed
    } catch {
      // Last resort: try to find the last complete object and close the array
      const lastComplete = fixed.lastIndexOf('},')
      if (lastComplete > 0) {
        const trimmed = fixed.slice(0, lastComplete + 1) + ']'
        try {
          JSON.parse(trimmed)
          console.log(`[JSONRepair] Recovered by truncating to last complete object`)
          return trimmed
        } catch { /* give up */ }
      }
      return raw // Return original, let caller handle the error
    }
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
      description: config.description || `Explore ${config.city}${config.country && config.country.toLowerCase() !== config.city.toLowerCase() ? `, ${config.country}` : ''}`,
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

// ─── Multi-vendor offer URLs ─────────────────────────────────
// Builds search URLs across all relevant aggregators so the UI can
// offer price comparison. Domestic-IN vendors get included for India.

export interface VendorOffer {
  vendor: string
  kind: string
  url: string
}

export function buildVendorOffers(
  item: { name: string; placeId?: string | null; mapsUrl?: string | null; website?: string | null },
  category: 'hotel' | 'activity' | 'restaurant',
  city: string,
  country: string,
): VendorOffer[] {
  const q = encodeURIComponent(`${item.name} ${city}`)
  const qNoCity = encodeURIComponent(item.name)
  const isIndia = country.toLowerCase() === 'india'
  const mapsFallback = item.mapsUrl
    || `https://www.google.com/maps/search/?api=1&query=${q}${item.placeId ? `&query_place_id=${item.placeId}` : ''}`

  if (category === 'hotel') {
    return [
      { vendor: 'Booking.com', kind: 'aggregator', url: `https://www.booking.com/searchresults.html?ss=${q}` },
      { vendor: 'Agoda', kind: 'aggregator', url: `https://www.agoda.com/search?city=&textToSearch=${q}` },
      ...(isIndia ? [
        { vendor: 'MakeMyTrip', kind: 'aggregator-in', url: `https://www.makemytrip.com/hotels/hotel-listing/?checkin=&checkout=&city=${qNoCity}&country=IN` },
        { vendor: 'Goibibo', kind: 'aggregator-in', url: `https://www.goibibo.com/hotels/hotels-in-${encodeURIComponent(city.toLowerCase())}-ct/?q=${qNoCity}` },
      ] : []),
      { vendor: 'Expedia', kind: 'aggregator', url: `https://www.expedia.com/Hotel-Search?destination=${q}` },
      { vendor: 'Hotels.com', kind: 'aggregator', url: `https://www.hotels.com/Hotel-Search?destination=${q}` },
      { vendor: 'Trivago', kind: 'meta', url: `https://www.trivago.com/?query=${q}` },
      { vendor: 'Kayak', kind: 'meta', url: `https://www.kayak.com/hotels/${q}` },
      { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
      { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
      ...(item.website ? [{ vendor: 'Direct', kind: 'direct', url: item.website }] : []),
    ]
  }
  if (category === 'activity') {
    return [
      { vendor: 'GetYourGuide', kind: 'aggregator', url: `https://www.getyourguide.com/s?q=${q}` },
      { vendor: 'Viator', kind: 'aggregator', url: `https://www.viator.com/searchResults/all?text=${q}` },
      { vendor: 'Klook', kind: 'aggregator', url: `https://www.klook.com/search/result/?keyword=${q}` },
      { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
      ...(isIndia ? [
        { vendor: 'MakeMyTrip', kind: 'aggregator-in', url: `https://www.makemytrip.com/things-to-do/search?q=${qNoCity}` },
        { vendor: 'Headout', kind: 'aggregator-in', url: `https://www.headout.com/search/?query=${q}` },
      ] : []),
      { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
      ...(item.website ? [{ vendor: 'Official', kind: 'direct', url: item.website }] : []),
    ]
  }
  // restaurant
  return [
    ...(isIndia ? [
      { vendor: 'Zomato', kind: 'reviews-in', url: `https://www.zomato.com/search?query=${q}` },
      { vendor: 'Swiggy Dineout', kind: 'reservations-in', url: `https://www.swiggy.com/dineout/search?query=${q}` },
      { vendor: 'EazyDiner', kind: 'reservations-in', url: `https://www.eazydiner.com/search?keyword=${q}` },
    ] : []),
    { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
    { vendor: 'Yelp', kind: 'reviews', url: `https://www.yelp.com/search?find_desc=${q}` },
    { vendor: 'OpenTable', kind: 'reservations', url: `https://www.opentable.com/s?term=${q}` },
    { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
    ...(item.website ? [{ vendor: 'Official', kind: 'direct', url: item.website }] : []),
  ]
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

// ─── Step 2: Discover + Enrich Hotels ─────────────────────────

async function stepFetchAndEnrichHotels(ctx: PipelineContext) {
  const db = getAdminClient()

  // Generate targeted discovery queries
  const queries = await generateDiscoveryQueries(ctx.config.city, ctx.config.country, ctx.config.vibes, 'hotels')

  // Multi-source discovery: Google Places (bulk) + SerpAPI (details/reviews)
  if (ctx.quota.shouldStop('serpapi')) {
    console.warn(`[Pipeline] SerpAPI quota approaching limit, skipping hotel discovery`)
  }
  const discovery = await discoverPlaces(ctx.config.city, ctx.config.country, 'hotels', queries)
  const { places, detailsMap, reviewsMap, stats } = discovery
  ctx.quota.increment('google_places', stats.googlePlacesResults)
  ctx.quota.increment('serpapi', stats.serpApiResults)
  console.log(`[Pipeline] Hotels discovery: ${JSON.stringify(stats)}`)

  if (places.length === 0) {
    console.warn(`[Pipeline] Hotels: no places discovered, skipping`)
    return 0
  }

  // Batch LLM enrichment — process ALL discovered places
  const enriched = await batchEnrich(places, detailsMap, reviewsMap, (batchContext) => `
You are enriching REAL hotel data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE (with reviews and details where available):
${batchContext}

Enrich ALL of the hotels above. Do not skip any. Do not invent hotels not listed above.
If a hotel has limited data, still include it with available fields and reasonable defaults.

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
}]`, 4, ctx.quota)

  // Validate
  const valid = enriched.filter(h => validateItem(h, 'hotels'))
  console.log(`[Pipeline] Hotels: ${valid.length}/${enriched.length} passed validation`)

  // Build rows and upsert
  const rows = valid.map((h: Record<string, unknown>) => {
    const hName = (h.name as string).toLowerCase()
    const gpMatch = places.find((g: PlaceResult) =>
      g.name.toLowerCase().includes(hName.split(' ')[0]) ||
      hName.includes(g.name.toLowerCase().split(' ')[0])
    )
    const details = gpMatch?.dataId ? detailsMap.get(gpMatch.dataId) : undefined
    const reviews = gpMatch?.dataId ? reviewsMap.get(gpMatch.dataId) : undefined

    const validHotelCats = new Set(['hotel', 'resort', 'hostel', 'villa', 'boutique'])
    const hotelCat = validHotelCats.has(String(h.category || 'hotel').toLowerCase()) ? String(h.category).toLowerCase() : 'hotel'

    return {
      destination_id: ctx.destinationId,
      name: h.name,
      place_id: gpMatch?.placeId || null,
      description: (h.honest_take as string) || '',
      detail: h.detail,
      category: hotelCat,
      price_per_night: h.price_per_night,
      price_level: ['budget', 'mid', 'luxury'].includes(String(h.price_level || 'mid').toLowerCase()) ? String(h.price_level).toLowerCase() : 'mid',
      rating: gpMatch?.rating || 0,
      vibes: h.vibes || [],
      amenities: h.amenities || [],
      image_url: details?.photos?.[0] || gpMatch?.photoUrls?.[0] || null,
      location: h.location || details?.address || gpMatch?.address || '',
      booking_url: (() => {
        const vendors = buildVendorOffers({ name: h.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'hotel', ctx.config.city, ctx.config.country)
        return vendors.find(v => v.vendor === 'Booking.com')?.url || details?.bookingUrl || generateBookingLink(h.name as string, ctx.config.city, ctx.config.country)
      })(),
      source: gpMatch ? 'google+ai' : 'ai',
      metadata: {
        ...(gpMatch ? { placeId: gpMatch.placeId, dataId: gpMatch.dataId, reviewCount: gpMatch.reviewCount, mapsUrl: gpMatch.mapsUrl } : {}),
        vendors: buildVendorOffers({ name: h.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'hotel', ctx.config.city, ctx.config.country),
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          checkInOut: details.checkInOut,
          photos: details.photos,
        } : {}),
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map((r: { rating: number; text: string }) => ({ rating: r.rating, text: r.text.slice(0, 300) })),
        } : {}),
        review_synthesis: h.review_synthesis || {},
        practical_tips: h.practical_tips || [],
        honest_take: h.honest_take || '',
        best_for: h.best_for || [],
        pairs_with: h.pairs_with || [],
        accessibility: h.accessibility || [],
        lat: gpMatch?.lat || 0,
        lng: gpMatch?.lng || 0,
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

  await upsertCatalogItems('catalog_hotels', rows, ctx)

  return rows.length
}

// ─── Step 3: Discover + Enrich Activities ─────────────────────

async function stepFetchAndEnrichActivities(ctx: PipelineContext) {
  const db = getAdminClient()

  const queries = await generateDiscoveryQueries(ctx.config.city, ctx.config.country, ctx.config.vibes, 'activities')
  if (ctx.quota.shouldStop('serpapi')) {
    console.warn(`[Pipeline] SerpAPI quota approaching limit, skipping activity discovery`)
  }
  const discovery = await discoverPlaces(ctx.config.city, ctx.config.country, 'activities', queries)
  const { places, detailsMap, reviewsMap, stats } = discovery
  ctx.quota.increment('google_places', stats.googlePlacesResults)
  ctx.quota.increment('serpapi', stats.serpApiResults)
  console.log(`[Pipeline] Activities discovery: ${JSON.stringify(stats)}`)

  if (places.length === 0) {
    console.warn(`[Pipeline] Activities: no places discovered, skipping`)
    return 0
  }

  const enriched = await batchEnrich(places, detailsMap, reviewsMap, (batchContext) => `
You are enriching REAL activity/attraction data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE (with reviews and details where available):
${batchContext}

Enrich ALL of the activities above. Do not skip any. Do not add activities that aren't in the data above.
If an activity has limited data, still include it with available fields and reasonable defaults.

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
  "practical_tips": ["Go early to avoid crowds", "Bring water shoes"],
  "honest_take": "Is it worth the hype? Who should skip it?",
  "best_for": ["couples", "families", "solo", "backpackers", "photographers"],
  "pairs_with": ["Nearby place or experience that complements this"]
}]`, 4, ctx.quota)

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

  const valid = enriched.filter(a => validateItem(a, 'activities'))
  console.log(`[Pipeline] Activities: ${valid.length}/${enriched.length} passed validation`)

  const rows = valid.map((a: Record<string, unknown>) => {
    const aName = (a.name as string).toLowerCase()
    const gpMatch = places.find((s: PlaceResult) =>
      s.name.toLowerCase().includes(aName.split(' ')[0]) ||
      aName.includes(s.name.toLowerCase().split(' ')[0])
    )
    const details = gpMatch?.dataId ? detailsMap.get(gpMatch.dataId) : undefined
    const reviews = gpMatch?.dataId ? reviewsMap.get(gpMatch.dataId) : undefined

    const mappedCat = mapActivityCategory(String(a.category || 'sightseeing'))
    const safeCat = validCategories.has(mappedCat) ? mappedCat : 'sightseeing'

    return {
      destination_id: ctx.destinationId,
      name: a.name,
      place_id: gpMatch?.placeId || null,
      description: (a.honest_take as string) || '',
      detail: a.detail,
      category: safeCat,
      price: a.price || '',
      duration: a.duration || '',
      vibes: a.vibes || [],
      best_time: a.best_time,
      image_url: details?.photos?.[0] || gpMatch?.photoUrls?.[0] || null,
      location: a.location || details?.address || gpMatch?.address || '',
      booking_url: (() => {
        const vendors = buildVendorOffers({ name: a.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'activity', ctx.config.city, ctx.config.country)
        return vendors.find(v => v.vendor === 'GetYourGuide')?.url || details?.bookingUrl || null
      })(),
      source: gpMatch ? 'google+ai' : 'ai',
      metadata: {
        ...(gpMatch ? { placeId: gpMatch.placeId, dataId: gpMatch.dataId, reviewCount: gpMatch.reviewCount, mapsUrl: gpMatch.mapsUrl } : {}),
        vendors: buildVendorOffers({ name: a.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'activity', ctx.config.city, ctx.config.country),
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          photos: details.photos,
        } : {}),
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map((r: { rating: number; text: string }) => ({ rating: r.rating, text: r.text.slice(0, 300) })),
        } : {}),
        review_synthesis: a.review_synthesis || {},
        practical_tips: a.practical_tips || [],
        honest_take: a.honest_take || '',
        best_for: a.best_for || [],
        pairs_with: a.pairs_with || [],
        lat: gpMatch?.lat || 0,
        lng: gpMatch?.lng || 0,
        info: [
          { l: 'Duration', v: (a.duration as string) || '' },
          { l: 'Best Time', v: (a.best_time as string) || '' },
          { l: 'Price', v: (a.price as string) || '' },
          ...(gpMatch ? [{ l: 'Rating', v: `${gpMatch.rating}★ (${gpMatch.reviewCount} reviews)` }] : []),
        ],
        features: (a.vibes as string[]) || [],
        alts: [],
      },
    }
  })

  await upsertCatalogItems('catalog_activities', rows, ctx)

  return rows.length
}

// ─── Step 4: Discover + Enrich Restaurants ────────────────────

async function stepFetchAndEnrichRestaurants(ctx: PipelineContext) {
  const db = getAdminClient()

  const queries = await generateDiscoveryQueries(ctx.config.city, ctx.config.country, ctx.config.vibes, 'restaurants')
  if (ctx.quota.shouldStop('serpapi')) {
    console.warn(`[Pipeline] SerpAPI quota approaching limit, skipping restaurant discovery`)
  }
  const discovery = await discoverPlaces(ctx.config.city, ctx.config.country, 'restaurants', queries)
  const { places, detailsMap, reviewsMap, stats } = discovery
  ctx.quota.increment('google_places', stats.googlePlacesResults)
  ctx.quota.increment('serpapi', stats.serpApiResults)
  console.log(`[Pipeline] Restaurants discovery: ${JSON.stringify(stats)}`)

  if (places.length === 0) {
    console.warn(`[Pipeline] Restaurants: no places discovered, skipping`)
    return 0
  }

  const enriched = await batchEnrich(places, detailsMap, reviewsMap, (batchContext) => `
You are enriching REAL restaurant data for ${ctx.config.city}, ${ctx.config.country}.
Destination vibes: ${ctx.config.vibes.join(', ')}

REAL DATA FROM GOOGLE (with reviews and details where available):
${batchContext}

Enrich ALL of the restaurants above. Do not skip any. Do not invent restaurants.
If a restaurant has limited data, still include it with available fields and reasonable defaults.

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
  "practical_tips": ["Arrive before 6pm to avoid 1-hour wait", "Cash only"],
  "honest_take": "Is it worth the hype? What makes it special?",
  "best_for": ["couples", "families", "foodies", "solo", "groups"],
  "pairs_with": ["Nearby bar or dessert spot to hit after"],
  "dietary": ["Vegetarian options available", "Halal"]
}]`, 4, ctx.quota)

  const valid = enriched.filter(r => validateItem(r, 'restaurants'))
  console.log(`[Pipeline] Restaurants: ${valid.length}/${enriched.length} passed validation`)

  const rows = valid.map((r: Record<string, unknown>) => {
    const rName = (r.name as string).toLowerCase()
    const gpMatch = places.find(g =>
      g.name.toLowerCase().includes(rName.split(' ')[0]) ||
      rName.includes(g.name.toLowerCase().split(' ')[0])
    )
    const details = gpMatch?.dataId ? detailsMap.get(gpMatch.dataId) : undefined
    const reviews = gpMatch?.dataId ? reviewsMap.get(gpMatch.dataId) : undefined

    return {
      destination_id: ctx.destinationId,
      name: r.name,
      place_id: gpMatch?.placeId || null,
      description: (r.honest_take as string) || '',
      detail: r.detail,
      cuisine: r.cuisine,
      price_level: ['budget', 'mid', 'luxury'].includes(r.price_level as string) ? r.price_level : 'mid',
      avg_cost: r.avg_cost,
      rating: gpMatch?.rating || 0,
      vibes: r.vibes || [],
      must_try: r.must_try || [],
      image_url: details?.photos?.[0] || gpMatch?.photoUrls?.[0] || null,
      location: r.location || details?.address || gpMatch?.address || '',
      booking_url: (() => {
        const vendors = buildVendorOffers({ name: r.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'restaurant', ctx.config.city, ctx.config.country)
        const isIN = ctx.config.country.toLowerCase() === 'india'
        const primary = isIN ? vendors.find(v => v.vendor === 'Zomato') : vendors.find(v => v.vendor === 'OpenTable')
        return primary?.url || details?.bookingUrl || gpMatch?.mapsUrl || null
      })(),
      source: gpMatch ? 'google+ai' : 'ai',
      metadata: {
        ...(gpMatch ? { placeId: gpMatch.placeId, dataId: gpMatch.dataId, reviewCount: gpMatch.reviewCount, mapsUrl: gpMatch.mapsUrl } : {}),
        vendors: buildVendorOffers({ name: r.name as string, placeId: gpMatch?.placeId, mapsUrl: gpMatch?.mapsUrl, website: details?.website }, 'restaurant', ctx.config.city, ctx.config.country),
        ...(details ? {
          phone: details.phone,
          website: details.website,
          hours: details.hours,
          highlights: details.highlights,
          photos: details.photos,
        } : {}),
        ...(reviews ? {
          topReviewTopics: reviews.topTopics,
          sampleReviews: reviews.reviews.slice(0, 3).map((rv: { rating: number; text: string }) => ({ rating: rv.rating, text: rv.text.slice(0, 300) })),
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

  await upsertCatalogItems('catalog_restaurants', rows, ctx)

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

  const raw = await withRetry(
    () => llmGenerate(`
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

Start each day with a "day" separator (category: "day", name: "Day 1 — Theme").`),
    'LLM:template-generation',
  )
  ctx.quota.increment('llm')

  let items: Record<string, unknown>[]
  try {
    items = JSON.parse(repairJsonArray(raw))
    console.log(`[Pipeline] Template: LLM returned ${items.length} itinerary items`)
  } catch (parseErr) {
    console.error(`[Pipeline] Template: Failed to parse LLM JSON response`)
    console.error(`[Pipeline] Raw response (first 500 chars): ${raw.slice(0, 500)}`)
    throw new Error(`Template LLM JSON parse failed: ${parseErr}`)
  }

  await withRetry(
    async () => await db.from('catalog_templates').delete().eq('destination_id', ctx.destinationId),
    'DB:delete-templates',
  )

  const { error } = await withRetry<{ error: { message: string } | null }>(
    async () => await db.from('catalog_templates').insert({
      destination_id: ctx.destinationId,
      name: `${ctx.config.city} — ${ctx.config.vibes.slice(0, 2).join(' & ')}`,
      vibes: ctx.config.vibes,
      budget_level: 'mid',
      duration_days: 5,
      items,
    }),
    'DB:insert-templates',
  )

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

  const raw = await withRetry(
    () => llmGenerate(`
Write a compelling 2-3 sentence description of ${ctx.config.city}, ${ctx.config.country} as a travel destination.
Target vibes: ${ctx.config.vibes.join(', ')}.
Write in a warm, editorial tone. Make someone want to book immediately.
Return JSON: {"description": "...", "avg_budget_per_day": {"budget": 50, "mid": 120, "luxury": 350}}
Use realistic daily budget numbers in USD for this destination.`),
    'LLM:destination-enrichment',
  )
  ctx.quota.increment('llm')

  let enriched: Record<string, unknown>
  try {
    enriched = JSON.parse(repairJsonArray(raw))
    console.log(`[Pipeline] Enrich: description="${(enriched.description as string)?.slice(0, 80)}..."`)
    console.log(`[Pipeline] Enrich: avg_budget_per_day=${JSON.stringify(enriched.avg_budget_per_day)}`)
  } catch (parseErr) {
    console.error(`[Pipeline] Enrich: Failed to parse LLM JSON`)
    console.error(`[Pipeline] Raw: ${raw.slice(0, 300)}`)
    throw new Error(`Enrich LLM JSON parse failed: ${parseErr}`)
  }

  const { error } = await withRetry<{ error: { message: string } | null }>(
    async () => await db
      .from('catalog_destinations')
      .update({
        description: enriched.description,
        avg_budget_per_day: enriched.avg_budget_per_day,
        status: 'active',
      })
      .eq('id', ctx.destinationId),
    'DB:update-destination-enrichment',
  )

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
    quota: new QuotaTracker(),
    runStartTime: new Date().toISOString(),
  }

  const stepMap: Record<string, () => Promise<number | void>> = {
    hotels: () => stepFetchAndEnrichHotels(ctx),
    activities: () => stepFetchAndEnrichActivities(ctx),
    restaurants: () => stepFetchAndEnrichRestaurants(ctx),
    template: () => stepGenerateTemplate(ctx),
    enrich: () => stepEnrichDestination(ctx),
    photos: () => stepBackfillPhotos(ctx),
  }

  const fn = stepMap[stepName]
  if (!fn) throw new Error(`Unknown step: ${stepName}`)

  const result = await fn()
  return { step: stepName, count: typeof result === 'number' ? result : 1 }
}

// ─── Resolve Google Places API URLs ──────────────────────────
// Google Places API photo URLs (places.googleapis.com) embed the API key
// and act as redirects. Resolve them server-side to direct CDN URLs.
async function resolveGooglePlacesUrl(url: string): Promise<string> {
  if (!url.includes('places.googleapis.com')) return url
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location')
    if (location && location.includes('googleusercontent.com')) {
      return location
    }
    // If no redirect, keep original (might still work as direct image)
    return res.ok ? url : ''
  } catch {
    return url
  }
}

// ─── Photo Backfill Step ────────────────────────────────────
// Runs after all catalog items are created.
// 1. Resolves Google Places API URLs to direct CDN URLs
// 2. Upsizes existing Google images to w800
// 3. Fills missing images with Unsplash search
// 4. Stores multiple photos in metadata.photos
async function stepBackfillPhotos(ctx: PipelineContext): Promise<number> {
  const db = getAdminClient()
  const tables = ['catalog_hotels', 'catalog_activities', 'catalog_restaurants'] as const
  let fixed = 0

  for (const table of tables) {
    const { data: items } = await db
      .from(table)
      .select('id, name, image_url, metadata, category')
      .eq('destination_id', ctx.destinationId)

    if (!items || items.length === 0) continue

    for (const item of items) {
      const meta = (item.metadata || {}) as Record<string, unknown>
      const existingPhotos = (meta.photos as string[]) || []
      let imageUrl = item.image_url as string | null
      let photos = [...existingPhotos]

      // Step 1: Resolve Google Places API URLs to direct CDN URLs
      if (imageUrl && imageUrl.includes('places.googleapis.com')) {
        imageUrl = await resolveGooglePlacesUrl(imageUrl)
      }
      photos = await Promise.all(photos.map(p =>
        p.includes('places.googleapis.com') ? resolveGooglePlacesUrl(p) : Promise.resolve(p)
      ))
      photos = photos.filter(p => p.length > 0)

      // Step 2: Upsize existing Google CDN images
      if (imageUrl && imageUrl.includes('googleusercontent.com')) {
        imageUrl = upsizeGoogleImage(imageUrl, 800, 600)
      }

      // Step 3: If no photos in metadata, try Unsplash
      if (photos.length === 0 && !imageUrl) {
        const category = (item.category as string) || (table === 'catalog_hotels' ? 'hotel' : table === 'catalog_restaurants' ? 'food' : 'activity')
        const fallback = await getPlaceFallbackPhotos(
          item.name as string,
          ctx.config.city,
          category,
          3,
        )
        if (fallback.length > 0) {
          photos = fallback
          if (!imageUrl) imageUrl = fallback[0]
          console.log(`[Photos] Unsplash fallback for "${item.name}": ${fallback.length} photos`)
        }
      }

      // Step 4: Upsize any Google CDN photos in the array
      photos = photos.map(p =>
        p.includes('googleusercontent.com') ? upsizeGoogleImage(p, 800, 600) : p
      )

      // Step 5: If we have an image_url but no photos array, seed photos with it
      if (imageUrl && photos.length === 0) {
        photos = [imageUrl]
      }

      // Update if anything changed
      const hasChanges = imageUrl !== item.image_url || photos.length !== existingPhotos.length
      if (hasChanges) {
        await db.from(table).update({
          image_url: imageUrl,
          metadata: { ...meta, photos },
        }).eq('id', item.id)
        fixed++
      }
    }
  }

  console.log(`[Photos] Backfilled ${fixed} items across ${tables.length} tables`)
  return fixed
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
  const quota = new QuotaTracker()
  const runStartTime = new Date().toISOString()
  const ctx: PipelineContext = { config, destinationId, runId, steps: [], quota, runStartTime }
  const stats: Record<string, number> = {}

  const steps = [
    { name: 'hotels', fn: () => stepFetchAndEnrichHotels(ctx) },
    { name: 'activities', fn: () => stepFetchAndEnrichActivities(ctx) },
    { name: 'restaurants', fn: () => stepFetchAndEnrichRestaurants(ctx) },
    { name: 'template', fn: () => stepGenerateTemplate(ctx) },
    { name: 'enrich', fn: () => stepEnrichDestination(ctx) },
    { name: 'photos', fn: () => stepBackfillPhotos(ctx) },
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
        .update({ steps_completed: ctx.steps, stats: { ...stats, quota: ctx.quota.getSummary() } })
        .eq('id', runId)
    }

    const totalElapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1)
    await db
      .from('pipeline_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString(), stats: { ...stats, quota: ctx.quota.getSummary() } })
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
      .update({ status: 'failed', error: msg, completed_at: new Date().toISOString(), stats: { ...stats, quota: ctx.quota.getSummary() } })
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
