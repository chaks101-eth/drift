import { NextRequest, NextResponse } from 'next/server'
import { generateItinerary, personalizeItinerary } from '@/lib/ai-agent'
import { createServerClient } from '@/lib/supabase'
import { getDestinationImage, getItemImage, resetImageCounter, upsizeGoogleImage } from '@/lib/images'
import { searchFlights, flightToItineraryItem, cityToIATA } from '@/lib/amadeus'
import { findCatalogDestination, getCatalogData, buildRichCatalogContext, enrichItemsWithCatalog } from '@/lib/catalog'
import { groundedDestinationSearch, formatGroundedContext, groundedDestinationSuggestions, fixItemLinks } from '@/lib/grounded-search'
import { enrichUrlHighlights } from '@/lib/url-enrichment'
import { rateLimit } from '@/lib/rate-limit'
import { generatePlanningNotes, formatPlanningNotes } from '@/lib/ai-intelligence'

export const maxDuration = 60

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
        // Grounded search
        groundedDestinationSuggestions({
          vibes: userVibes,
          budget: body.budget || 'mid',
          origin: body.origin || 'Delhi',
          days: userDays,
          count: MAX_DESTINATIONS,
        }).catch(e => {
          console.warn(`[Generate] Grounded destination suggestions failed: ${e}`)
          return []
        }),
      ])

      console.log(`[Generate] Found ${catalogResult.length} catalog + ${groundedResult.length} grounded destinations`)

      // Score catalog destinations by vibe overlap
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
          }
        })
        .filter(d => d.match > 20)

      // Deduplicate grounded results against catalog cities, use curated images
      const catalogCities = new Set(catalogMatches.map(d => d.city.toLowerCase()))
      const groundedDests = groundedResult
        .filter(d => !catalogCities.has(d.city.toLowerCase()))
        .map(d => ({
          ...d,
          image_url: getDestinationImage(d.city),
        }))

      // Merge both sources, sort by match score — best destinations win regardless of source
      const allDestinations = [...catalogMatches, ...groundedDests]
        .sort((a, b) => b.match - a.match)
        .slice(0, MAX_DESTINATIONS)

      const catalogCount = allDestinations.filter(d => d.from_catalog).length
      const groundedCount = allDestinations.filter(d => !d.from_catalog).length
      const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
      const source = groundedCount > 0 && catalogCount > 0 ? 'catalog+grounded' : groundedCount > 0 ? 'grounded' : 'catalog'
      console.log(`[Generate] Serving ${allDestinations.length} destinations (${catalogCount} catalog + ${groundedCount} grounded) sorted by match in ${elapsed}s`)
      return NextResponse.json({ destinations: allDestinations, source })
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

      // ─── Fetch flights (always real when possible) ────────────
      const canSearchFlights = cityToIATA(origin) && cityToIATA(body.destination)

      const flightPromises = [
        canSearchFlights
          ? searchFlights({
              origin,
              destination: body.destination,
              departureDate: body.start_date,
              adults: travelers,
              maxResults: 5,
            }).catch((e) => { console.error('Outbound flight search failed:', e); return [] })
          : Promise.resolve([]),
        canSearchFlights && body.end_date
          ? searchFlights({
              origin: body.destination,
              destination: origin,
              departureDate: body.end_date,
              adults: travelers,
              maxResults: 5,
            }).catch((e) => { console.error('Return flight search failed:', e); return [] })
          : Promise.resolve([]),
      ] as const

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

      // Build rich catalog context for LLM (ratings, GPS, hours, honest takes)
      const catalogContextText = catalogData ? buildRichCatalogContext(catalogData) : ''

      // ─── Grounded search for real-time web data ──────────────
      // Run Google Search grounding to find real, verified places.
      // Especially useful for non-catalog destinations or to supplement catalog.
      let groundedContextText = ''
      if (!catalogData || catalogData.hotels.length < 3) {
        try {
          const groundedResult = await groundedDestinationSearch({
            destination: body.destination,
            country: body.country || '',
            vibes: body.vibes || [],
            budget,
            travelers,
            days: tripDays,
          })
          if (groundedResult?.places.length) {
            groundedContextText = formatGroundedContext(groundedResult)
            console.log(`[Generate] Grounded search: ${groundedResult.places.length} real places found via ${groundedResult.searchQueries.length} Google searches`)
          }
        } catch (e) {
          console.warn(`[Generate] Grounded search failed, continuing without: ${e}`)
        }
      }

      // Generate planning intelligence from any enriched data
      let planningNotesText = ''
      if (enrichedHighlights?.length) {
        const planningItems = enrichedHighlights
          .filter((h: { source: string }) => h.source === 'serpapi')
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

      // ─── Always use LLM generation + real flights ──────────────
      const [llmItems, outboundFlights, returnFlights] = await Promise.all([
        generateItinerary({
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
          planningNotes: (planningNotesText + catalogContextText + groundedContextText) || undefined,
        }),
        ...flightPromises,
      ])

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

      items = mergeFlights(nonFlightItems, outboundFlights, returnFlights)

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

      const catalogMatchCount = itemsToInsert.filter(i => (i.metadata as Record<string, unknown>)?.source === 'catalog').length
      const dataSource = enrichmentMap.size > 0 ? 'ai+serpapi' : catalogMatchCount > 0 ? 'ai+catalog' : groundedContextText ? 'ai+grounded' : 'ai'
      const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
      console.log(`[Generate] SUCCESS — trip=${trip.id}, items=${items.length}, source=${dataSource}, time=${elapsed}s`)
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
    const bestPrice = parseFloat(best.price.replace(/[^0-9.]/g, ''))
    outItem.metadata.alts = outboundFlights.slice(1, 4).map(f => {
      const altPrice = parseFloat(f.price.replace(/[^0-9.]/g, ''))
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
    const bestPrice = parseFloat(best.price.replace(/[^0-9.]/g, ''))
    retItem.metadata.alts = returnFlights.slice(1, 4).map(f => {
      const altPrice = parseFloat(f.price.replace(/[^0-9.]/g, ''))
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
