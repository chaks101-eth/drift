import { NextRequest, NextResponse } from 'next/server'
import { generateItinerary, personalizeItinerary } from '@/lib/ai-agent'
import { parsePrice } from '@/lib/parse-price'
import { createServerClient } from '@/lib/supabase'
import { getDestinationImage, getItemImage, resetImageCounter, upsizeGoogleImage } from '@/lib/images'
import { searchFlights, searchFlightsGrounded, flightToItineraryItem, resolveIATA, searchGroundedTransport, transportToItineraryItem } from '@/lib/amadeus'
import { findCatalogDestination, getCatalogData, buildRichCatalogContext, enrichItemsWithCatalog } from '@/lib/catalog'
import { groundedDestinationSearch, formatGroundedContext, groundedDestinationSuggestions, fixItemLinks } from '@/lib/grounded-search'
import { enrichUrlHighlights } from '@/lib/url-enrichment'
import { rateLimit } from '@/lib/rate-limit'
import { generatePlanningNotes, formatPlanningNotes } from '@/lib/ai-intelligence'
import { batchGetPlaceData, applyPlaceData, getDestinationPhoto, getPlaceData } from '@/lib/google-places-photos'
import { getTripWeather, formatWeatherForLLM } from '@/lib/weather'
import { buildItineraryMaps } from '@/lib/day-maps'
import { addTravelTimesToItems } from '@/lib/google-routes'
import { detectCountry, isDomesticTrip } from '@/lib/country-detection'

export const maxDuration = 120

// POST /api/ai/generate — generate itinerary or destinations
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = rateLimit(ip, { limit: 20, windowMs: 60_000 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const reqStart = Date.now()
  console.log(`\n[Generate] Request: type=${body.type}, destination=${body.destination || '-'}, vibes=${(body.vibes || []).join(',')}${body.urlHighlights?.length ? `, urlHighlights: ${body.urlHighlights.length}` : ''}`)

  try {
    if (body.type === 'destinations') {
      const userVibes = body.vibes || []
      const userDays = (body.start_date && body.end_date)
        ? Math.max(1, Math.round((new Date(body.end_date).getTime() - new Date(body.start_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 5
      const MAX_DESTINATIONS = 8

      // Detect origin country for domestic/international split
      const originCountry = detectCountry(body.origin || 'Delhi')

      // Run catalog query + grounded search IN PARALLEL (catalog ~100ms, grounded ~2-3s)
      const { createClient } = await import('@supabase/supabase-js')
      const adminDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      const [catalogResult, groundedResult] = await Promise.all([
        // Catalog query
        adminDb
          .from('catalog_destinations')
          .select('city, country, vibes, description, cover_image, avg_budget_per_day')
          .eq('status', 'active')
          .then(({ data, error }) => {
            if (error) console.error(`[Generate] Catalog query error: ${error.message}`)
            return data || []
          }),
        // Grounded search — now requests domestic/international mix
        groundedDestinationSuggestions({
          vibes: userVibes,
          budget: body.budget || 'mid',
          origin: body.origin || 'Delhi',
          days: userDays,
          count: MAX_DESTINATIONS,
          originCountry: originCountry || undefined,
        }).catch(e => {
          console.warn(`[Generate] Grounded destination suggestions failed: ${e}`)
          return []
        }),
      ])

      console.log(`[Generate] Found ${catalogResult.length} catalog + ${groundedResult.length} grounded destinations`)

      // Score catalog destinations by vibe overlap + tag domestic/international
      const catalogMatches = catalogResult
        .map(d => {
          const overlap = (d.vibes || []).filter((v: string) => userVibes.includes(v)).length
          const matchPct = userVibes.length > 0 ? Math.round((overlap / userVibes.length) * 100) : 50
          const budgetData = d.avg_budget_per_day || {}
          const budgetLevel = body.budget || 'mid'
          const dailyCost = budgetData[budgetLevel] || budgetData.mid || 120
          const estimatedTotal = dailyCost * userDays
          return {
            city: d.city.charAt(0).toUpperCase() + d.city.slice(1),
            country: d.country.charAt(0).toUpperCase() + d.country.slice(1),
            match: Math.min(matchPct + 15, 99), // boost catalog destinations (richer data)
            price_usd: estimatedTotal,
            vibes: (d.vibes || []).slice(0, 3),
            tagline: d.description || `Explore ${d.city}`,
            image_url: d.cover_image || getDestinationImage(d.city),
            from_catalog: true,
            isDomestic: isDomesticTrip(body.origin || 'Delhi', d.city, d.country),
          }
        })
        .filter(d => d.match > 20)

      // Deduplicate grounded results against catalog cities, fetch real photos
      const catalogCities = new Set(catalogMatches.map(d => d.city.toLowerCase()))
      const filteredGrounded = groundedResult.filter(d => !catalogCities.has(d.city.toLowerCase()))

      // Fetch real Google Places photos for grounded destinations (parallel)
      const destPhotos = await Promise.all(
        filteredGrounded.map(d => getDestinationPhoto(d.city, d.country).catch(() => null))
      )

      const groundedDests = filteredGrounded.map((d, i) => ({
        ...d,
        image_url: destPhotos[i] || getDestinationImage(d.city),
        // Use grounded tag if available, else detect from city/country
        isDomestic: d.isDomestic ?? isDomesticTrip(body.origin || 'Delhi', d.city, d.country),
      }))

      // Merge, ensuring balanced domestic/international representation
      const allCandidates = [...catalogMatches, ...groundedDests].sort((a, b) => b.match - a.match)
      const domestic = allCandidates.filter(d => d.isDomestic)
      const international = allCandidates.filter(d => !d.isDomestic)
      const maxPerSection = Math.ceil(MAX_DESTINATIONS / 2)

      // Take up to half from each, fill remaining from whichever has surplus
      let picked = [
        ...domestic.slice(0, maxPerSection),
        ...international.slice(0, maxPerSection),
      ]
      if (picked.length < MAX_DESTINATIONS) {
        const remaining = allCandidates.filter(d => !picked.includes(d))
        picked = [...picked, ...remaining].slice(0, MAX_DESTINATIONS)
      }
      const allDestinations = picked.sort((a, b) => b.match - a.match)

      const catalogCount = allDestinations.filter(d => d.from_catalog).length
      const groundedCount = allDestinations.filter(d => !d.from_catalog).length
      const domesticCount = allDestinations.filter(d => d.isDomestic).length
      const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
      const source = groundedCount > 0 && catalogCount > 0 ? 'catalog+grounded' : groundedCount > 0 ? 'grounded' : 'catalog'
      console.log(`[Generate] Serving ${allDestinations.length} destinations (${catalogCount} catalog + ${groundedCount} grounded, ${domesticCount} domestic) in ${elapsed}s`)
      return NextResponse.json({ destinations: allDestinations, source, originCountry })
    }

    if (body.type === 'itinerary') {
      const origin = body.origin || 'Delhi'
      const travelers = body.travelers || 2
      const budget = body.budget || 'mid'

      // ─── Check if destination exists in our catalog ───────────
      const catalogDest = await findCatalogDestination(body.destination)
      const catalogData = catalogDest
        ? await getCatalogData(catalogDest.id, body.vibes, budget)
        : null

      // Calculate trip duration
      const tripDays = (body.start_date && body.end_date)
        ? Math.max(1, Math.round((new Date(body.end_date).getTime() - new Date(body.start_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 5

      // Always use LLM for generation — catalog provides context + post-generation enrichment
      console.log(`[Generate] ${body.destination}: LLM generation${catalogData ? ' + CATALOG CONTEXT' : ''} — ${tripDays} days`)
      if (catalogData) {
        console.log(`[Generate] Catalog data: ${catalogData.hotels.length} hotels, ${catalogData.activities.length} activities, ${catalogData.restaurants.length} restaurants`)
      } else {
        console.log(`[Generate] No catalog data for "${body.destination}" — LLM will generate from knowledge`)
      }

      // ─── Detect domestic trip + resolve IATA codes ──────
      const tripIsDomestic = isDomesticTrip(origin, body.destination, body.country)
      if (tripIsDomestic) console.log(`[Generate] Domestic trip detected: ${origin} → ${body.destination}`)

      const [originIATA, destIATA] = await Promise.all([
        resolveIATA(origin),
        resolveIATA(body.destination),
      ])
      const canSearchFlights = !!originIATA && !!destIATA
      if (canSearchFlights) {
        console.log(`[Generate] Flights: ${origin}(${originIATA}) → ${body.destination}(${destIATA})`)
      } else {
        console.log(`[Generate] Flights: skipped — ${!originIATA ? origin : body.destination} has no IATA code`)
      }

      // Search flights: Amadeus first, grounded fallback if empty
      async function findFlights(from: string, to: string, date: string): Promise<Awaited<ReturnType<typeof searchFlights>>> {
        if (!canSearchFlights) return []
        // Try Amadeus first
        try {
          const results = await searchFlights({ origin: from, destination: to, departureDate: date, adults: travelers, maxResults: 5 })
          if (results.length > 0) return results
        } catch (e) { console.warn(`[Flights] Amadeus failed ${from}→${to}: ${e}`) }
        // Fallback: grounded search
        return searchFlightsGrounded({ origin: body.origin || from, destination: body.destination || to, departureDate: date, adults: travelers })
      }

      const flightPromises = [
        findFlights(originIATA || origin, destIATA || body.destination, body.start_date),
        body.end_date ? findFlights(destIATA || body.destination, originIATA || origin, body.end_date) : Promise.resolve([]),
      ] as const

      // For domestic trips, also search trains/buses in parallel
      const transportPromise = tripIsDomestic
        ? searchGroundedTransport({ origin, destination: body.destination, departureDate: body.start_date, adults: travelers }).catch(() => [])
        : Promise.resolve([])

      // ─── Get itinerary items (catalog or LLM) ────────────────
      let items: Array<{
        category: string; name: string; detail: string; description: string;
        price: string; image_url: string; time: string; position: number;
        metadata: Record<string, unknown>
      }>

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let enrichedHighlights: any[] | undefined = undefined

      // ─── Enrich URL highlights with real data (mini-pipeline) ──
      if (body.urlHighlights?.length && body.destination) {
        enrichedHighlights = body.urlHighlights
        try {
          console.log(`[Generate] Running mini-pipeline for ${body.urlHighlights.length} URL highlights`)
          enrichedHighlights = await enrichUrlHighlights(
            body.urlHighlights,
            body.destination,
            body.country || '',
          )
          const matched = enrichedHighlights.filter((h: { source: string }) => h.source === 'serpapi').length
          console.log(`[Generate] Mini-pipeline: ${matched}/${body.urlHighlights.length} enriched with real data`)
        } catch (e) {
          console.warn(`[Generate] Mini-pipeline failed, using raw highlights: ${e}`)
        }
      }

      // ─── Parallel pre-generation: grounding + weather + flights ──
      // Run ALL pre-generation tasks in parallel to minimize latency
      const catalogContextText = catalogData ? buildRichCatalogContext(catalogData) : ''
      const needsGrounding = !catalogData || catalogData.hotels.length < 3

      // Get destination GPS (fast, from catalog metadata)
      let destLat: number | undefined
      let destLng: number | undefined
      if (catalogData?.hotels?.[0]) {
        const hm = (catalogData.hotels[0] as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined
        destLat = hm?.lat as number; destLng = hm?.lng as number
      }

      // Planning notes from URL enrichment
      let planningNotesText = ''
      if (enrichedHighlights?.length) {
        const planningItems = enrichedHighlights
          .filter((h: { source: string }) => h.source === 'serpapi' || h.source === 'google_places')
          .map((h: Record<string, unknown>) => ({
            name: h.name as string,
            category: h.category as string,
            metadata: {
              lat: h.lat || (h as Record<string, unknown>).latitude,
              lng: h.lng || (h as Record<string, unknown>).longitude,
              best_time: h.bestTime,
              duration: h.duration,
              pairs_with: h.pairsWith,
            } as Record<string, unknown>,
          }))
        if (planningItems.length > 1) {
          const notes = generatePlanningNotes(planningItems)
          planningNotesText = formatPlanningNotes(notes)
        }
      }

      // Fire grounding + weather + GPS lookup + flights ALL IN PARALLEL
      const [groundedResult, weatherAndGps, outboundFlights, returnFlights, domesticTransport] = await Promise.all([
        // Grounded search (only for non-catalog destinations)
        needsGrounding
          ? groundedDestinationSearch({
              destination: body.destination, country: body.country || '',
              vibes: body.vibes || [], budget, travelers, days: tripDays,
            }).catch(() => null)
          : Promise.resolve(null),

        // Weather + GPS (get GPS first if needed, then weather)
        (async () => {
          let lat = destLat, lng = destLng
          if (!lat && body.destination) {
            try {
              const destData = await getPlaceData(body.destination, body.destination, body.country)
              if (destData?.lat) { lat = destData.lat; lng = destData.lng }
            } catch { /* best effort */ }
          }
          let weather: Awaited<ReturnType<typeof getTripWeather>> = null
          if (lat && lng && body.start_date && body.end_date) {
            try {
              weather = await getTripWeather(lat, lng, body.start_date, body.end_date)
            } catch { /* best effort */ }
          }
          return { lat, lng, weather }
        })(),

        // Flights (already defined as promises)
        ...flightPromises,

        // Domestic transport (trains/buses)
        transportPromise,
      ])

      const groundedContextText = groundedResult?.places?.length
        ? formatGroundedContext(groundedResult)
        : ''
      if (groundedResult?.places?.length) {
        console.log(`[Generate] Grounded search: ${groundedResult.places.length} places found`)
      }

      const tripWeatherData = weatherAndGps.weather
      const weatherContextText = tripWeatherData ? formatWeatherForLLM(tripWeatherData) : ''
      if (!destLat && weatherAndGps.lat) { destLat = weatherAndGps.lat; destLng = weatherAndGps.lng }

      // ─── LLM generation (multi-step: outline → parallel days) ──
      const llmItems = await generateItinerary({
        destination: body.destination,
        country: body.country,
        vibes: body.vibes,
        startDate: body.start_date,
        endDate: body.end_date,
        travelers,
        budget,
        budgetAmount: body.budgetAmount || undefined,
        originCity: origin,
        occasion: body.occasion || undefined,
        urlHighlights: enrichedHighlights,
        urlSummary: body.urlSummary || undefined,
        planningNotes: (planningNotesText + catalogContextText + groundedContextText + weatherContextText) || undefined,
        isDomestic: tripIsDomestic,
      })

      // Sanitize LLM categories
      let nonFlightItems = llmItems
        .filter(i => mapCategory(i.category) !== 'flight')
        .map((item, idx) => ({
          ...item,
          category: mapCategory(item.category),
          position: idx,
          image_url: item.image_url || '',
          metadata: (item.metadata || {}) as Record<string, unknown>,
        }))

      // Enrich LLM items with catalog data (images, booking URLs, GPS, hours, alts)
      if (catalogData) {
        nonFlightItems = enrichItemsWithCatalog(nonFlightItems, catalogData, body.vibes)
        const matched = nonFlightItems.filter(i => (i.metadata?.source as string) === 'catalog').length
        console.log(`[Generate] Catalog enrichment: ${matched}/${nonFlightItems.length} items matched with real data`)
      }

      // Fix links: strip hallucinated URLs, add real Google Maps / Booking.com links
      fixItemLinks(nonFlightItems, body.destination, body.country)

      // Google Places enrichment: sync for non-catalog destinations (need photos),
      // skip for catalog destinations (already have photos/GPS from catalog)
      const itemsNeedingEnrichment = nonFlightItems.filter(i =>
        ['hotel', 'activity', 'food'].includes(i.category) &&
        (!i.metadata.lat || !i.image_url || i.image_url.includes('unsplash.com'))
      )
      if (itemsNeedingEnrichment.length > 0) {
        try {
          const placeDataMap = await batchGetPlaceData(
            itemsNeedingEnrichment.map(i => ({ name: i.name, category: i.category })),
            body.destination,
            body.country,
          )
          applyPlaceData(nonFlightItems, placeDataMap)
        } catch (e) {
          console.warn(`[Generate] Google Places enrichment failed, using fallbacks: ${e}`)
        }
      }

      // Calculate real travel times between items (Google Routes API)
      try {
        await addTravelTimesToItems(nonFlightItems)
      } catch (e) {
        console.warn(`[Generate] Travel times failed: ${e}`)
      }

      items = mergeFlights(nonFlightItems, outboundFlights, returnFlights)

      // ─── Attach transport alternatives for domestic trips ─────
      if (domesticTransport.length > 0) {
        const transportAlts = domesticTransport.map(t => ({
          mode: t.mode,
          name: `${t.departureStation} → ${t.arrivalStation}`,
          detail: `${t.operatorName} · ${t.duration}${t.class ? ` · ${t.class}` : ''}`,
          price: t.price,
          bookingUrl: t.bookingUrl,
        }))

        // Find the outbound flight item and attach transport alternatives
        const outboundItem = items.find(i => i.category === 'flight' && i.position === 0)
        if (outboundItem) {
          outboundItem.metadata.transportAlts = transportAlts
        } else {
          // No flight found — use best transport as primary outbound item
          const best = domesticTransport[0]
          const transportItem = transportToItineraryItem(best, 0)
          ;(transportItem.metadata as Record<string, unknown>).transportAlts = transportAlts.slice(1)
          items = [transportItem, ...items]
          // Reindex positions
          items.forEach((item, idx) => { item.position = idx })
          console.log(`[Generate] No flights — using ${best.mode} as primary transport`)
        }
        console.log(`[Generate] Attached ${transportAlts.length} transport alternatives (trains/buses)`)
      }

      // ─── Create trip in DB ────────────────────────────────────
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: body.destination,
          country: body.country,
          vibes: body.vibes,
          start_date: body.start_date,
          end_date: body.end_date,
          travelers,
          budget,
          status: 'planning',
        })
        .select()
        .single()

      if (tripError) {
        console.error(`[Generate] Trip creation failed: ${tripError.message}`)
        return NextResponse.json({ error: tripError.message }, { status: 500 })
      }
      console.log(`[Generate] Trip created: ${trip.id}`)

      // ─── Build enrichment lookup for URL trips ─────────────────
      const enrichmentMap = new Map<string, { photoUrls?: string[]; photos?: string[]; rating?: number; reviewCount?: number; bookingUrl?: string; mapsUrl?: string; address?: string }>()
      if (enrichedHighlights?.length) {
        for (const eh of enrichedHighlights) {
          if (eh.source === 'serpapi') {
            enrichmentMap.set(eh.name.toLowerCase(), eh)
          }
        }
      }

      // ─── Apply images and insert ──────────────────────────────
      resetImageCounter()
      const itemsToInsert = items.map((item, idx) => {
        const cat = mapCategory(item.category)

        // Check if this item matches an enriched highlight (real SerpAPI data)
        const enriched = enrichmentMap.get(item.name.toLowerCase())
          || [...enrichmentMap.entries()].find(([k]) =>
            item.name.toLowerCase().includes(k) || k.includes(item.name.toLowerCase())
          )?.[1]

        // Image priority: enriched SerpAPI photos > catalog image > curated Unsplash
        const enrichedPhoto = enriched?.photos?.[0] || enriched?.photoUrls?.[0]
        const hasRealImage = item.image_url && !item.image_url.startsWith('https://images.unsplash')
        const imageUrl = enrichedPhoto
          ? upsizeGoogleImage(enrichedPhoto)
          : hasRealImage
            ? upsizeGoogleImage(item.image_url)
            : getItemImage(cat, item.name, body.destination)

        // Merge enrichment metadata (ratings, booking, photos, maps)
        const meta = { ...(item.metadata || {}) }
        if (enriched) {
          if (enriched.rating) meta.rating = enriched.rating
          if (enriched.reviewCount) meta.reviewCount = enriched.reviewCount
          if (enriched.bookingUrl) meta.bookingUrl = enriched.bookingUrl
          if (enriched.mapsUrl) meta.mapsUrl = enriched.mapsUrl
          if (enriched.address) meta.address = enriched.address
          if (enriched.photos?.length) meta.photos = enriched.photos.map(u => upsizeGoogleImage(u))
          else if (enriched.photoUrls?.length) meta.photos = enriched.photoUrls.map(u => upsizeGoogleImage(u))
          meta.source = 'url_import_enriched'
        }

        // Inject weather data into day separators
        if (cat === 'day' && tripWeatherData?.days) {
          // Count which day number this is
          const dayNum = items.slice(0, idx).filter(i => mapCategory(i.category) === 'day').length + 1
          const dayWeather = tripWeatherData.days[dayNum - 1]
          if (dayWeather) {
            meta.weather = {
              tempMax: dayWeather.tempMax,
              tempMin: dayWeather.tempMin,
              description: dayWeather.description,
              rainProbability: dayWeather.rainProbability,
              iconUri: dayWeather.iconUri,
              isRainy: dayWeather.isRainy,
              isSunny: dayWeather.isSunny,
              uvIndex: dayWeather.uvIndex,
            }
          }
          // Store weather summary on first day
          if (dayNum === 1 && tripWeatherData.summary) {
            meta.weatherSummary = tripWeatherData.summary
          }
        }

        return {
          trip_id: trip.id,
          category: cat as 'flight' | 'hotel' | 'activity' | 'food' | 'transfer' | 'day',
          name: item.name,
          detail: item.detail || '',
          description: item.description || null,
          price: item.price || '',
          image_url: imageUrl,
          time: item.time || null,
          position: idx,
          status: 'none' as const,
          metadata: meta,
        }
      })

      const { error: itemsError } = await supabase
        .from('itinerary_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error(`[Generate] Items insert failed: ${itemsError.message}`)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }

      // ─── Generate day maps (non-blocking) ────────────────────
      // Build map URLs for each day and update day separators
      try {
        const dayMaps = buildItineraryMaps(itemsToInsert.map(i => ({
          category: i.category,
          name: i.name,
          metadata: i.metadata as Record<string, unknown>,
          position: i.position,
        })))
        if (dayMaps.size > 0) {
          // Update day separator items with map URLs
          let dayNum = 0
          for (const item of itemsToInsert) {
            if (item.category === 'day') {
              dayNum++
              const mapUrl = dayMaps.get(dayNum)
              if (mapUrl) {
                await supabase
                  .from('itinerary_items')
                  .update({ metadata: { ...(item.metadata as Record<string, unknown>), dayMapUrl: mapUrl } })
                  .eq('trip_id', trip.id)
                  .eq('position', item.position)
              }
            }
          }
          console.log(`[Generate] Day maps: ${dayMaps.size} maps generated`)
        }
      } catch (e) {
        console.warn(`[Generate] Day maps failed: ${e}`)
      }

      const catalogMatchCount = itemsToInsert.filter(i => (i.metadata as Record<string, unknown>)?.source === 'catalog').length
      const dataSource = enrichmentMap.size > 0 ? 'ai+serpapi' : catalogMatchCount > 0 ? 'ai+catalog' : groundedContextText ? 'ai+grounded' : 'ai'
      const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
      console.log(`[Generate] SUCCESS — trip=${trip.id}, items=${items.length}, source=${dataSource}${weatherContextText ? ', weather=yes' : ''}, time=${elapsed}s`)
      const categoryCounts = items.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc }, {} as Record<string, number>)
      console.log(`[Generate] Item breakdown: ${Object.entries(categoryCounts).map(([k, v]) => `${k}:${v}`).join(', ')}`)
      return NextResponse.json({ trip, itemCount: items.length, dataSource })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
    console.error(`[Generate] FAILED after ${elapsed}s: ${msg}`)
    if (error instanceof Error && error.stack) console.error(`[Generate] Stack: ${error.stack}`)
    return NextResponse.json({ error: `Generation failed: ${msg}` }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────

const validCategories = new Set(['flight', 'hotel', 'activity', 'food', 'transfer', 'day'])

function mapCategory(cat: string): string {
  if (validCategories.has(cat)) return cat
  if (['temple', 'beach', 'tour', 'sightseeing', 'shopping', 'entertainment', 'spa', 'adventure'].includes(cat)) return 'activity'
  if (['restaurant', 'cafe', 'dining', 'breakfast', 'lunch', 'dinner'].includes(cat)) return 'food'
  if (['taxi', 'drive', 'bus', 'train', 'transport'].includes(cat)) return 'transfer'
  if (['accommodation', 'resort', 'hostel', 'airbnb', 'villa'].includes(cat)) return 'hotel'
  return 'activity'
}

type ItemShape = {
  category: string; name: string; detail: string; description: string;
  price: string; image_url: string; time: string; position: number;
  metadata: Record<string, unknown>
}

function mergeFlights(
  items: ItemShape[],
  outboundFlights: Awaited<ReturnType<typeof searchFlights>>,
  returnFlights: Awaited<ReturnType<typeof searchFlights>>,
): ItemShape[] {
  const realFlightItems: ItemShape[] = []

  if (outboundFlights.length > 0) {
    const best = outboundFlights[0]
    const outItem = flightToItineraryItem(best, 0)
    const bestPrice = parsePrice(best.price)
    outItem.metadata.alts = outboundFlights.slice(1, 4).map(f => {
      const altPrice = parsePrice(f.price)
      const trust: Array<{ type: string; text: string }> = []
      const diff = bestPrice - altPrice
      if (diff > 5) trust.push({ type: 'gold', text: `$${Math.round(diff)} cheaper` })
      else if (diff < -5) trust.push({ type: 'warn', text: `$${Math.round(Math.abs(diff))} more` })
      if (f.stops === 0) trust.push({ type: 'success', text: 'Direct flight' })
      return {
        name: `${f.departure.airport} → ${f.arrival.airport}`,
        detail: `${f.airlineName} ${f.flightNumber} · ${f.duration} · ${f.stops === 0 ? 'Direct' : `${f.stops} stop`}`,
        price: f.price,
        bookingUrl: f.bookingUrl,
        trust,
      }
    })
    realFlightItems.push({
      ...outItem,
      image_url: '',
      description: outItem.description,
      position: 0,
    } as ItemShape)
  }

  if (returnFlights.length > 0) {
    const best = returnFlights[0]
    const retItem = flightToItineraryItem(best, 999)
    const bestPrice = parsePrice(best.price)
    retItem.metadata.alts = returnFlights.slice(1, 4).map(f => {
      const altPrice = parsePrice(f.price)
      const trust: Array<{ type: string; text: string }> = []
      const diff = bestPrice - altPrice
      if (diff > 5) trust.push({ type: 'gold', text: `$${Math.round(diff)} cheaper` })
      else if (diff < -5) trust.push({ type: 'warn', text: `$${Math.round(Math.abs(diff))} more` })
      if (f.stops === 0) trust.push({ type: 'success', text: 'Direct flight' })
      return {
        name: `${f.departure.airport} → ${f.arrival.airport}`,
        detail: `${f.airlineName} ${f.flightNumber} · ${f.duration} · ${f.stops === 0 ? 'Direct' : `${f.stops} stop`}`,
        price: f.price,
        bookingUrl: f.bookingUrl,
        trust,
      }
    })
    realFlightItems.push({
      ...retItem,
      image_url: '',
      description: retItem.description,
      position: 999,
    } as ItemShape)
  }

  // Remove any existing flight items from template/LLM output
  const nonFlightItems = items.filter(i => mapCategory(i.category) !== 'flight')

  // Merge: outbound flight → itinerary items → return flight
  const merged = [
    ...(realFlightItems.length > 0 ? [realFlightItems[0]] : []),
    ...nonFlightItems,
    ...(realFlightItems.length > 1 ? [realFlightItems[1]] : []),
  ]

  // Reindex positions
  return merged.map((item, idx) => ({ ...item, position: idx }))
}
