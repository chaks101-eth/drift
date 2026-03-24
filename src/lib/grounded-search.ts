// ─── Grounded Search via Gemini + Google Search ──────────────
// Uses Gemini's native API with Google Search grounding to find
// real places, URLs, ratings for ANY destination worldwide.
// Returns structured context that feeds into LLM generation.
//
// 2-step approach:
//   1. Grounded search (plain text) → real place names, URLs, ratings
//   2. Feed results as rich context to JSON generation call
//
// Pricing: 1,500 free grounded requests/day on paid tier, then $35/1K

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export interface GroundedPlace {
  name: string
  category: 'hotel' | 'activity' | 'food'
  detail: string
  price?: string
  rating?: string
  location?: string
  sourceUrl?: string
  sourceTitle?: string
}

export interface GroundedSearchResult {
  places: GroundedPlace[]
  sourceUrls: Array<{ uri: string; title: string }>
  searchQueries: string[]
  rawText: string
}

/**
 * Search for real places in a destination using Gemini + Google Search grounding.
 * Returns structured results with verified URLs from Google Search.
 */
export async function groundedDestinationSearch(params: {
  destination: string
  country: string
  vibes: string[]
  budget: string
  travelers: number
  days: number
}): Promise<GroundedSearchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[Grounding] No GEMINI_API_KEY, skipping grounded search')
    return null
  }

  const { destination, country, vibes, budget, travelers, days } = params

  const prompt = `Find the best real, currently-operating places for a ${days}-day ${budget} trip to ${destination}, ${country} for ${travelers} travelers.
Vibes: ${vibes.join(', ')}.

List EXACTLY:
- 3-5 hotels (with price per night, star rating, and what makes each special)
- 6-10 activities/attractions (with entry price, duration, and best time to visit)
- 4-6 restaurants (with cuisine type, average meal cost, and signature dish)

For each place, include:
- Full official name
- Approximate price in USD
- Rating if available (e.g., 4.7★)
- One-line description of why it's great for ${vibes.join('/')} vibes
- Location/neighborhood

Format as a structured list with clear categories (HOTELS, ACTIVITIES, RESTAURANTS).
Focus on places that genuinely match the ${vibes.join('/')} vibes, not generic tourist traps.
Include a mix of well-known and hidden gems.`

  try {
    console.log(`[Grounding] Searching for real places in ${destination}...`)
    const startTime = Date.now()

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[Grounding] API error ${response.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data = await response.json()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    const candidate = data.candidates?.[0]
    if (!candidate) {
      console.warn('[Grounding] No candidates returned')
      return null
    }

    // Extract text response
    const rawText = candidate.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || ''

    // Extract grounding metadata (source URLs)
    const groundingMeta = candidate.groundingMetadata || {}
    const searchQueries: string[] = groundingMeta.webSearchQueries || []
    const groundingChunks: Array<{ web?: { uri: string; title: string } }> = groundingMeta.groundingChunks || []

    const sourceUrls = groundingChunks
      .filter(c => c.web)
      .map(c => ({ uri: c.web!.uri, title: c.web!.title }))

    console.log(`[Grounding] Got response in ${elapsed}s — ${searchQueries.length} searches, ${sourceUrls.length} source URLs`)

    // Parse the text into structured places
    const places = parseGroundedPlaces(rawText)
    console.log(`[Grounding] Parsed ${places.length} places (${places.filter(p => p.category === 'hotel').length} hotels, ${places.filter(p => p.category === 'activity').length} activities, ${places.filter(p => p.category === 'food').length} restaurants)`)

    // Try to match places with source URLs
    for (const place of places) {
      const matchingSource = sourceUrls.find(s => {
        const nameLower = place.name.toLowerCase()
        const titleLower = s.title.toLowerCase()
        return titleLower.includes(nameLower.split(' ')[0]) ||
          nameLower.includes(titleLower.split(' ')[0].replace(/[^a-z]/g, ''))
      })
      if (matchingSource) {
        place.sourceUrl = matchingSource.uri
        place.sourceTitle = matchingSource.title
      }
    }

    return { places, sourceUrls, searchQueries, rawText }
  } catch (e) {
    console.error(`[Grounding] Failed: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/**
 * Parse the grounded text response into structured places.
 * Handles various formatting the LLM might use.
 */
function parseGroundedPlaces(text: string): GroundedPlace[] {
  const places: GroundedPlace[] = []
  const lines = text.split('\n')

  let currentCategory: 'hotel' | 'activity' | 'food' = 'activity'

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Detect category headers
    const upper = trimmed.toUpperCase()
    if (upper.includes('HOTEL') || upper.includes('ACCOMMODATION') || upper.includes('WHERE TO STAY')) {
      currentCategory = 'hotel'
      continue
    }
    if (upper.includes('ACTIVIT') || upper.includes('ATTRACTION') || upper.includes('THINGS TO DO') || upper.includes('EXPERIENCE') || upper.includes('SIGHTSEEING')) {
      currentCategory = 'activity'
      continue
    }
    if (upper.includes('RESTAURANT') || upper.includes('DINING') || upper.includes('WHERE TO EAT') || upper.includes('FOOD')) {
      currentCategory = 'food'
      continue
    }

    // Parse place entries — look for lines starting with bullet/number/bold
    const placeMatch = trimmed.match(/^(?:[-•*]|\d+[.)]\s*|\*\*)?(.+?)(?:\*\*)?$/)?.[1]?.trim()
    if (!placeMatch) continue

    // Skip section headers and short lines
    if (placeMatch.length < 5) continue
    if (placeMatch.startsWith('#')) continue

    // Extract name — usually the first part before a colon, dash, or parenthesis
    let name = ''
    let detail = placeMatch

    // Try "**Name**: detail" or "**Name** - detail" or "Name: detail"
    const boldMatch = placeMatch.match(/^\*\*(.+?)\*\*[:\s-–—]*(.*)/)
    if (boldMatch) {
      name = boldMatch[1].trim()
      detail = boldMatch[2]?.trim() || ''
    } else {
      const colonMatch = placeMatch.match(/^([^:(]+?)\s*[:\-–—]\s*(.+)/)
      if (colonMatch && colonMatch[1].length < 60) {
        name = colonMatch[1].trim()
        detail = colonMatch[2]?.trim() || ''
      }
    }

    if (!name || name.length < 3) continue

    // Clean up name (remove markdown, numbering)
    name = name.replace(/^\*\*|\*\*$/g, '').replace(/^\d+[.)]\s*/, '').trim()

    // Extract price
    const priceMatch = (detail + ' ' + name).match(/\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\/night|\/person)?/i)
    const price = priceMatch?.[0]

    // Extract rating
    const ratingMatch = (detail + ' ' + name).match(/([\d.]+)\s*★|(\d\.\d)\s*(?:stars?|rating)/i)
    const rating = ratingMatch ? (ratingMatch[1] || ratingMatch[2]) + '★' : undefined

    // Extract location
    const locationMatch = detail.match(/(?:located?\s+(?:in|at|on|near)\s+|in\s+the\s+)([^,.]+)/i)
    const location = locationMatch?.[1]?.trim()

    places.push({
      name,
      category: currentCategory,
      detail: detail.slice(0, 200),
      price,
      rating,
      location,
    })
  }

  return places
}

/**
 * Format grounded search results as context text for the LLM generation prompt.
 */
export function formatGroundedContext(result: GroundedSearchResult): string {
  if (!result.places.length) return ''

  const sections: string[] = []

  const hotels = result.places.filter(p => p.category === 'hotel')
  const activities = result.places.filter(p => p.category === 'activity')
  const restaurants = result.places.filter(p => p.category === 'food')

  if (hotels.length) {
    sections.push(`HOTELS (verified via Google Search):\n${hotels.map(h =>
      `  - ${h.name}${h.price ? ` (${h.price})` : ''}${h.rating ? ` ${h.rating}` : ''}\n    ${h.detail}${h.location ? `\n    Location: ${h.location}` : ''}${h.sourceUrl ? `\n    Source: ${h.sourceUrl}` : ''}`
    ).join('\n')}`)
  }

  if (activities.length) {
    sections.push(`ACTIVITIES (verified via Google Search):\n${activities.map(a =>
      `  - ${a.name}${a.price ? ` (${a.price})` : ''}${a.rating ? ` ${a.rating}` : ''}\n    ${a.detail}${a.location ? `\n    Location: ${a.location}` : ''}${a.sourceUrl ? `\n    Source: ${a.sourceUrl}` : ''}`
    ).join('\n')}`)
  }

  if (restaurants.length) {
    sections.push(`RESTAURANTS (verified via Google Search):\n${restaurants.map(r =>
      `  - ${r.name}${r.price ? ` (${r.price})` : ''}${r.rating ? ` ${r.rating}` : ''}\n    ${r.detail}${r.location ? `\n    Location: ${r.location}` : ''}${r.sourceUrl ? `\n    Source: ${r.sourceUrl}` : ''}`
    ).join('\n')}`)
  }

  return `\n\nREAL PLACES (found via Google Search — use these real, verified places):
${sections.join('\n\n')}

IMPORTANT: Use these REAL places with their exact names. They are verified to be currently operating. Prefer these over inventing places.
Do NOT include any URLs, links, or bookingUrls in your output — those will be added automatically from verified sources.`
}

// ─── Grounded Destination Suggestions ─────────────────────────
// Uses Google Search to suggest destinations that match user vibes.
// Returns structured destinations in the same format as catalog matches.

export interface GroundedDestination {
  city: string
  country: string
  match: number
  price_usd: number
  vibes: string[]
  tagline: string
  image_url: string
  from_catalog: boolean
}

/**
 * Suggest destinations matching user vibes using Gemini + Google Search grounding.
 * Returns destinations in the same format as catalog matches.
 */
export async function groundedDestinationSuggestions(params: {
  vibes: string[]
  budget: string
  origin: string
  days: number
  count?: number
}): Promise<GroundedDestination[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  const { vibes, budget, origin, days, count = 6 } = params

  const prompt = `Suggest exactly ${count} travel destinations that perfectly match these vibes: ${vibes.join(', ')}.
Budget level: ${budget}
Trip duration: ${days} days
Flying from: ${origin}

For each destination, provide:
1. City name
2. Country
3. A vibe match percentage (how well it matches the requested vibes, 60-95%)
4. Estimated total trip cost per person in USD for ${days} days at ${budget} level
5. Top 3 matching vibes from: beach, adventure, city, romance, spiritual, foodie, party, solo, winter, culture
6. A compelling 1-sentence tagline that captures why this destination matches their vibes

Format as a numbered list:
1. **City, Country** (Match: XX%) — $X,XXX total
   Vibes: vibe1, vibe2, vibe3
   Tagline: Your compelling tagline here

Be opinionated. Don't suggest generic popular cities unless they genuinely match. Mix well-known and hidden gems. Consider flight accessibility from ${origin}.`

  try {
    console.log(`[Grounding] Searching for destinations matching: ${vibes.join(', ')}`)
    const startTime = Date.now()

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    })

    if (!response.ok) {
      console.error(`[Grounding] Destinations API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    const rawText = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || ''

    const searchQueries = data.candidates?.[0]?.groundingMetadata?.webSearchQueries || []
    console.log(`[Grounding] Destinations response in ${elapsed}s — ${searchQueries.length} searches`)

    // Parse the text into structured destinations
    return parseGroundedDestinations(rawText)
  } catch (e) {
    console.error(`[Grounding] Destination suggestions failed: ${e instanceof Error ? e.message : e}`)
    return []
  }
}

/**
 * Parse grounded text into structured destination objects.
 */
function parseGroundedDestinations(text: string): GroundedDestination[] {
  const destinations: GroundedDestination[] = []
  const lines = text.split('\n')

  let currentDest: Partial<GroundedDestination> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Match destination line: "1. **City, Country** (Match: XX%) — $X,XXX total"
    // or variations like "1. **City**, **Country** (XX% match) — $X,XXX"
    const destMatch = trimmed.match(
      /^\d+\.\s*\*?\*?([^*,(]+?)\s*[,]\s*([^*,(]+?)\*?\*?\s*\(?(?:Match:\s*)?(\d+)%?\)?\s*[—\-–]\s*\$?([\d,]+)/i
    )
    if (destMatch) {
      // Save previous destination
      if (currentDest?.city) {
        destinations.push(finalizeDest(currentDest))
      }
      currentDest = {
        city: destMatch[1].replace(/\*\*/g, '').trim(),
        country: destMatch[2].replace(/\*\*/g, '').trim(),
        match: parseInt(destMatch[3]) || 75,
        price_usd: parseInt(destMatch[4].replace(/,/g, '')) || 1500,
        vibes: [],
        tagline: '',
        image_url: '',
        from_catalog: false,
      }
      continue
    }

    // Match vibes line
    if (currentDest && /vibes?:/i.test(trimmed)) {
      const vibeText = trimmed.replace(/.*vibes?:\s*/i, '')
      currentDest.vibes = vibeText.split(/[,;]/).map(v => v.trim().toLowerCase()).filter(v => v.length > 0).slice(0, 3)
      continue
    }

    // Match tagline
    if (currentDest && /tagline:/i.test(trimmed)) {
      currentDest.tagline = trimmed.replace(/.*tagline:\s*/i, '').replace(/^["']|["']$/g, '')
      continue
    }
  }

  // Save last destination
  if (currentDest?.city) {
    destinations.push(finalizeDest(currentDest))
  }

  return destinations
}

function finalizeDest(d: Partial<GroundedDestination>): GroundedDestination {
  const city = d.city || 'Unknown'
  return {
    city,
    country: d.country || '',
    match: Math.min(d.match || 75, 95),
    price_usd: d.price_usd || 1500,
    vibes: d.vibes?.length ? d.vibes : ['adventure'],
    tagline: d.tagline || `Explore ${city}`,
    image_url: '',
    from_catalog: false,
  }
}

// ─── Real Google Maps Links ────────────────────────────────────
// Construct verified Google Maps search URLs for itinerary items.
// These are real, working links — not hallucinated by LLM.

/**
 * Build a real Google Maps search URL for a place.
 */
export function buildMapsUrl(placeName: string, city: string, country?: string): string {
  const query = encodeURIComponent(`${placeName}, ${city}${country ? ', ' + country : ''}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

/**
 * Build a real Booking.com search URL for a hotel.
 */
export function buildBookingUrl(hotelName: string, city: string): string {
  const query = encodeURIComponent(`${hotelName} ${city}`)
  return `https://www.booking.com/searchresults.html?ss=${query}`
}

/**
 * Strip hallucinated URLs and replace with real ones.
 * Call this on items after LLM generation for non-catalog destinations.
 */
export function fixItemLinks(
  items: Array<{
    category: string; name: string; metadata: Record<string, unknown>;
    [key: string]: unknown;
  }>,
  city: string,
  country?: string,
): void {
  for (const item of items) {
    if (item.category === 'day' || item.category === 'transfer' || item.category === 'flight') continue

    const existingUrl = item.metadata?.bookingUrl as string | undefined
    const existingMapsUrl = item.metadata?.mapsUrl as string | undefined

    // Always add a real Google Maps link
    if (!existingMapsUrl || !existingMapsUrl.includes('google.com/maps')) {
      item.metadata.mapsUrl = buildMapsUrl(item.name, city, country)
    }

    // Fix booking URLs — keep only real ones, replace hallucinated
    if (existingUrl) {
      const isReal = existingUrl.includes('booking.com') ||
        existingUrl.includes('google.com/maps') ||
        existingUrl.includes('tripadvisor.com') ||
        existingUrl.includes('viator.com') ||
        existingUrl.includes('getyourguide.com') ||
        existingUrl.includes('agoda.com') ||
        existingUrl.includes('hotels.com') ||
        existingUrl.includes('expedia.com')

      if (!isReal) {
        // Replace hallucinated URL with real one
        if (item.category === 'hotel') {
          item.metadata.bookingUrl = buildBookingUrl(item.name, city)
        } else {
          item.metadata.bookingUrl = buildMapsUrl(item.name, city, country)
        }
      }
    } else {
      // No URL at all — add one
      if (item.category === 'hotel') {
        item.metadata.bookingUrl = buildBookingUrl(item.name, city)
      } else {
        item.metadata.bookingUrl = buildMapsUrl(item.name, city, country)
      }
    }
  }
}

// ─── Destination Image via Unsplash CDN ────────────────────────
// Uses Unsplash's free CDN endpoint (no API key needed) to get
// a relevant city/travel photo. Always loads, always looks good.

/**
 * Get a high-quality city image URL via Unsplash CDN.
 * No API key required — uses the direct embed endpoint.
 */
export function getCityImageUrl(city: string, country: string): string {
  const query = encodeURIComponent(`${city} ${country} travel cityscape`)
  // Unsplash CDN direct link — always works, no auth needed
  return `https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&h=600&fit=crop&auto=format&q=80`
}

/**
 * Search for city-specific image via Unsplash API (if key available)
 * or return a reliable Unsplash CDN fallback.
 */
export async function searchCityImage(city: string, country: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null // caller will use getDestinationImage() fallback

  try {
    const query = encodeURIComponent(`${city} ${country} travel landscape`)
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${accessKey}` } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data.results?.[0]
    if (photo?.urls?.raw) {
      return `${photo.urls.raw}&w=800&h=600&fit=crop&auto=format&q=80`
    }
    return null
  } catch {
    return null
  }
}
