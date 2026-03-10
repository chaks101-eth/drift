import { NextRequest, NextResponse } from 'next/server'
import { generateItinerary } from '@/lib/ai-agent'
import { createServerClient } from '@/lib/supabase'
import { getDestinationImage, getItemImage, resetImageCounter, upsizeGoogleImage } from '@/lib/images'
import { searchFlights, flightToItineraryItem, cityToIATA } from '@/lib/amadeus'
import { findCatalogDestination, getCatalogData, templateToItineraryItems } from '@/lib/catalog'

// POST /api/ai/generate — generate itinerary or destinations
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const reqStart = Date.now()
  console.log(`\n[Generate] Request: type=${body.type}, destination=${body.destination || '-'}, vibes=${(body.vibes || []).join(',')}`)

  try {
    if (body.type === 'destinations') {
      // Check catalog for real destinations first
      const { createClient } = await import('@supabase/supabase-js')
      const adminDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: catalogDests, error: catErr } = await adminDb
        .from('catalog_destinations')
        .select('city, country, vibes, description, cover_image, avg_budget_per_day')
        .eq('status', 'active')

      if (catErr) console.error(`[Generate] Catalog query error: ${catErr.message}`)
      console.log(`[Generate] Found ${catalogDests?.length || 0} active catalog destinations`)

      // Score catalog destinations by vibe overlap
      const userVibes = body.vibes || []
      const catalogMatches = (catalogDests || [])
        .map(d => {
          const overlap = (d.vibes || []).filter((v: string) => userVibes.includes(v)).length
          const matchPct = userVibes.length > 0 ? Math.round((overlap / userVibes.length) * 100) : 50
          const budgetData = d.avg_budget_per_day || {}
          const budgetLevel = body.budget || 'mid'
          const dailyCost = budgetData[budgetLevel] || budgetData.mid || 120
          return {
            name: d.city.charAt(0).toUpperCase() + d.city.slice(1),
            country: d.country.charAt(0).toUpperCase() + d.country.slice(1),
            match: Math.min(matchPct + 15, 99), // boost catalog destinations
            price: `$${dailyCost * 5}`,
            tags: (d.vibes || []).slice(0, 3),
            description: d.description || `Explore ${d.city}`,
            image_url: d.cover_image || getDestinationImage(d.city),
            from_catalog: true,
          }
        })
        .filter(d => d.match > 20)
        .sort((a, b) => b.match - a.match)

      console.log(`[Generate] Catalog matches (score>20): ${catalogMatches.map(d => `${d.name}(${d.match}%)`).join(', ') || 'none'}`)

      // Catalog-only — no LLM suggestions, no hardcoded fallbacks
      const elapsed = ((Date.now() - reqStart) / 1000).toFixed(1)
      if (catalogMatches.length > 0) {
        console.log(`[Generate] Serving ${catalogMatches.length} catalog destinations in ${elapsed}s`)
        return NextResponse.json({ destinations: catalogMatches.slice(0, 4), source: 'catalog' })
      }

      // No catalog destinations available
      console.log(`[Generate] No catalog destinations available (${elapsed}s)`)
      return NextResponse.json({ destinations: [], source: 'catalog' })
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

      const useCatalog = catalogData?.template && catalogData.template.items.length > 0
      console.log(`[Generate] ${body.destination}: ${useCatalog ? 'CATALOG (real data)' : 'LLM (fallback)'}`)
      if (catalogData) {
        console.log(`[Generate] Catalog data: ${catalogData.hotels.length} hotels, ${catalogData.activities.length} activities, ${catalogData.restaurants.length} restaurants, template: ${catalogData.template ? `${catalogData.template.items.length} items` : 'NONE'}`)
      } else {
        console.log(`[Generate] No catalog data found for "${body.destination}" — falling back to LLM`)
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

      if (useCatalog) {
        // Use pre-built template with real catalog data — no LLM needed
        const [outboundFlights, returnFlights] = await Promise.all(flightPromises)
        items = templateToItineraryItems(catalogData!, body.start_date, body.vibes)

        // Merge flights
        items = mergeFlights(items, outboundFlights, returnFlights)
      } else {
        // Fall back to LLM generation + real flights
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
          }),
          ...flightPromises,
        ])

        // Sanitize LLM categories
        const nonFlightItems = llmItems
          .filter(i => mapCategory(i.category) !== 'flight')
          .map((item, idx) => ({
            ...item,
            category: mapCategory(item.category),
            position: idx,
            image_url: item.image_url || '',
            metadata: (item.metadata || {}) as Record<string, unknown>,
          }))

        items = mergeFlights(nonFlightItems, outboundFlights, returnFlights)
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

      // ─── Apply images and insert ──────────────────────────────
      resetImageCounter()
      const itemsToInsert = items.map((item, idx) => {
        const cat = mapCategory(item.category)
        // Prefer catalog image, fall back to curated Unsplash
        const hasRealImage = item.image_url && !item.image_url.startsWith('https://images.unsplash')
        const imageUrl = hasRealImage
          ? upsizeGoogleImage(item.image_url)
          : getItemImage(cat, item.name, body.destination)

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
          metadata: item.metadata || null,
        }
      })

      const { error: itemsError } = await supabase
        .from('itinerary_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error(`[Generate] Items insert failed: ${itemsError.message}`)
        return NextResponse.json({ error: itemsError.message }, { status: 500 })
      }

      const dataSource = useCatalog ? 'catalog' : 'ai'
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
