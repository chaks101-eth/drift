import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { findCatalogDestination, getCatalogData, templateToItineraryItems } from '@/lib/catalog'
import { getItemImage, resetImageCounter } from '@/lib/images'

// POST /api/ai/regenerate — regenerate itinerary items with new params
// Supports: budget switch, vibe remix, lock+regenerate, day regenerate
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tripId, mode, lockedItemIds = [], budget, vibes, dayIndex } = body as {
    tripId: string
    mode: 'full' | 'budget' | 'vibes' | 'day'
    lockedItemIds: string[]
    budget?: string
    vibes?: string[]
    dayIndex?: number
  }

  if (!tripId || !mode) {
    return NextResponse.json({ error: 'tripId and mode required' }, { status: 400 })
  }

  try {
    // 1. Fetch trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }

    // 2. Fetch current items
    const { data: currentItems } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('position')

    if (!currentItems) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 })
    }

    // 3. Determine effective params
    const effectiveBudget = mode === 'budget' && budget ? budget : trip.budget
    const effectiveVibes = mode === 'vibes' && vibes ? vibes : trip.vibes

    // 4. Look up catalog
    const catalogDest = await findCatalogDestination(trip.destination)
    const catalogData = catalogDest
      ? await getCatalogData(catalogDest.id, effectiveVibes, effectiveBudget)
      : null

    const hasTemplate = catalogData?.template && catalogData.template.items.length > 0

    if (!hasTemplate) {
      return NextResponse.json({
        error: 'No catalog template available for this destination. Run the pipeline first.',
        needsPipeline: true,
      }, { status: 422 })
    }

    // 5. Generate new items from catalog template
    const newTemplateItems = templateToItineraryItems(catalogData!, trip.start_date)

    // 6. Determine which items to keep vs replace
    const lockedSet = new Set(lockedItemIds)
    const lockedItems = currentItems.filter(i => lockedSet.has(i.id))
    const flightItems = currentItems.filter(i => i.category === 'flight')

    // Always keep flights and locked items
    const keepItems = [...flightItems]
    for (const item of lockedItems) {
      if (item.category !== 'flight') keepItems.push(item)
    }

    let itemsToReplace: typeof currentItems
    let newItems: typeof newTemplateItems

    if (mode === 'day' && dayIndex !== undefined) {
      // Day regenerate: only replace items in a specific day
      // Parse days from current items
      const days: { startIdx: number; endIdx: number; items: typeof currentItems }[] = []
      let dayStart = -1
      for (let i = 0; i < currentItems.length; i++) {
        if (currentItems[i].category === 'day') {
          if (dayStart >= 0) {
            days.push({ startIdx: dayStart, endIdx: i - 1, items: currentItems.slice(dayStart + 1, i) })
          }
          dayStart = i
        }
      }
      if (dayStart >= 0) {
        days.push({ startIdx: dayStart, endIdx: currentItems.length - 1, items: currentItems.slice(dayStart + 1) })
      }

      if (dayIndex >= days.length) {
        return NextResponse.json({ error: 'Invalid day index' }, { status: 400 })
      }

      const targetDay = days[dayIndex]
      // Items to replace: non-locked, non-flight items in this day
      itemsToReplace = targetDay.items.filter(i =>
        !lockedSet.has(i.id) && i.category !== 'flight'
      )

      // Get replacement items from template for same day
      // Parse days from template items too
      const templateDays: typeof newTemplateItems[] = []
      let tempDay: typeof newTemplateItems = []
      for (const ti of newTemplateItems) {
        if (ti.category === 'day') {
          if (tempDay.length > 0) templateDays.push(tempDay)
          tempDay = []
        } else {
          tempDay.push(ti)
        }
      }
      if (tempDay.length > 0) templateDays.push(tempDay)

      // Use same day index from template, or last available
      const templateDayIdx = Math.min(dayIndex, templateDays.length - 1)
      newItems = templateDayIdx >= 0 && templateDays[templateDayIdx]
        ? templateDays[templateDayIdx].filter(i =>
            // Only get item types that we're replacing
            itemsToReplace.some(r => r.category === i.category) ||
            ['activity', 'food'].includes(i.category)
          )
        : []
    } else {
      // Full / budget / vibes: replace all non-locked, non-flight items
      itemsToReplace = currentItems.filter(i =>
        !lockedSet.has(i.id) && i.category !== 'flight' && i.category !== 'day'
      )
      newItems = newTemplateItems.filter(i => i.category !== 'flight')
    }

    // 7. Delete items being replaced
    const idsToDelete = itemsToReplace.map(i => i.id)
    if (idsToDelete.length > 0) {
      await supabase
        .from('itinerary_items')
        .delete()
        .in('id', idsToDelete)
    }

    // 8. Apply images and insert new items
    resetImageCounter()
    const validCategories = ['flight', 'hotel', 'activity', 'food', 'transfer', 'day'] as const
    const mapCat = (c: string) => validCategories.includes(c as typeof validCategories[number]) ? c : 'activity'

    const insertItems = newItems.map((item, idx) => {
      const cat = mapCat(item.category)
      const hasRealImage = item.image_url && !item.image_url.startsWith('https://images.unsplash')
      const imageUrl = hasRealImage
        ? item.image_url
        : getItemImage(cat, item.name, trip.destination)

      return {
        trip_id: tripId,
        category: cat as typeof validCategories[number],
        name: item.name,
        detail: item.detail || '',
        description: item.description || null,
        price: item.price || '',
        image_url: imageUrl,
        time: item.time || null,
        position: 1000 + idx, // temporary positions, will reindex
        status: 'none' as const,
        metadata: item.metadata || null,
      }
    })

    if (insertItems.length > 0) {
      const { error: insertError } = await supabase
        .from('itinerary_items')
        .insert(insertItems)

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    // 9. Re-fetch all items and reindex positions
    const { data: allItems } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('position')

    if (allItems) {
      // Reindex: flights first/last, day markers in order, items grouped by day
      const flights = allItems.filter(i => i.category === 'flight')
      const nonFlights = allItems.filter(i => i.category !== 'flight')

      const reordered = [
        ...(flights.length > 0 ? [flights[0]] : []),
        ...nonFlights,
        ...(flights.length > 1 ? [flights[flights.length - 1]] : []),
      ]

      // Batch update positions
      const updates = reordered.map((item, idx) => ({
        id: item.id,
        position: idx,
      }))

      for (const u of updates) {
        await supabase
          .from('itinerary_items')
          .update({ position: u.position })
          .eq('id', u.id)
      }
    }

    // 10. Update trip if budget or vibes changed
    if (mode === 'budget' && budget && budget !== trip.budget) {
      await supabase.from('trips').update({ budget }).eq('id', tripId)
    }
    if (mode === 'vibes' && vibes) {
      await supabase.from('trips').update({ vibes }).eq('id', tripId)
    }

    // 11. Return fresh items
    const { data: finalItems } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('position')

    return NextResponse.json({
      items: finalItems || [],
      replaced: idsToDelete.length,
      added: insertItems.length,
      mode,
      source: 'catalog',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Regeneration error:', msg)
    return NextResponse.json({ error: `Regeneration failed: ${msg}` }, { status: 500 })
  }
}
