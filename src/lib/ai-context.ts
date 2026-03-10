// ─── Drift AI Context Manager ─────────────────────────────────
// 3-layer context loading: Always → Conditional → On-demand (via tools)
// Keeps token usage minimal by loading only what's relevant.

import { createClient } from '@supabase/supabase-js'
import type { ItineraryItem } from './database.types'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Layer 1: Always loaded (cheap, essential) ───────────────

export function buildTripSummary(items: ItineraryItem[]): string {
  const real = items.filter(i => i.category !== 'day' && i.category !== 'transfer')
  if (!real.length) return ''

  const categories = real.reduce((acc, i) => {
    acc[i.category] = acc[i.category] || []
    acc[i.category].push(i)
    return acc
  }, {} as Record<string, ItineraryItem[]>)

  const lines: string[] = ['Current itinerary:']

  for (const [cat, catItems] of Object.entries(categories)) {
    const names = catItems.map(i => {
      const price = i.price ? ` (${i.price})` : ''
      const status = i.status !== 'none' ? ` [${i.status}]` : ''
      return `${i.name}${price}${status} [id:${i.id}]`
    })
    lines.push(`  ${cat}: ${names.join(', ')}`)
  }

  const totalStr = real
    .map(i => parseFloat((i.price || '0').replace(/[^0-9.]/g, '')))
    .reduce((a, b) => a + b, 0)
  lines.push(`  Total estimated: $${Math.round(totalStr)}`)

  // Preference signals from pick/skip behavior
  lines.push(buildPreferenceSignals(real))

  return lines.join('\n').trim()
}

// ─── Preference Signals (Issue 6) ────────────────────────────

function parsePrice(price: string | null): number {
  return parseFloat((price || '0').replace(/[^0-9.]/g, ''))
}

function buildPreferenceSignals(items: ItineraryItem[]): string {
  const picked = items.filter(i => i.status === 'picked')
  const skipped = items.filter(i => i.status === 'skipped')
  if (!picked.length && !skipped.length) return ''

  const lines = ['\nUser behavior signals:']

  if (picked.length) {
    const pickedPrices = picked.map(i => parsePrice(i.price))
    const avgPickedPrice = pickedPrices.reduce((a, b) => a + b, 0) / pickedPrices.length
    lines.push(`  Picked ${picked.length} items (avg $${Math.round(avgPickedPrice)}): ${picked.map(i => i.name).join(', ')}`)
  }

  if (skipped.length) {
    lines.push(`  Skipped ${skipped.length} items: ${skipped.map(i => i.name).join(', ')}`)
  }

  const pickedBudget = picked.filter(i => parsePrice(i.price) < 50).length
  const pickedLuxury = picked.filter(i => parsePrice(i.price) > 150).length
  if (pickedBudget > pickedLuxury) lines.push('  Signal: price-sensitive — prefer budget options')
  if (pickedLuxury > pickedBudget) lines.push('  Signal: comfort-focused — prefer premium options')

  return lines.join('\n')
}

// ─── Layer 2: Conditional (loaded when relevant) ─────────────

export function buildItemContext(item: ItineraryItem): string {
  const meta = (item.metadata || {}) as Record<string, unknown>
  const parts: string[] = [
    `${item.name} (${item.category}, ${item.price}) [id:${item.id}]`,
    item.detail ? `Detail: ${item.detail}` : '',
    item.description ? `Description: ${item.description}` : '',
  ]

  if (meta.honest_take) parts.push(`Honest take: ${meta.honest_take}`)
  if (meta.practical_tips) parts.push(`Tips: ${(meta.practical_tips as string[]).join('; ')}`)
  if (meta.best_for) parts.push(`Best for: ${(meta.best_for as string[]).join(', ')}`)
  if (meta.pairs_with) parts.push(`Pairs with: ${(meta.pairs_with as string[]).join(', ')}`)

  if (meta.review_synthesis) {
    const rs = meta.review_synthesis as Record<string, string[]>
    if (rs.loved?.length) parts.push(`People love: ${rs.loved.join(', ')}`)
    if (rs.complaints?.length) parts.push(`Common complaints: ${rs.complaints.join(', ')}`)
  }

  if (meta.info) {
    const info = meta.info as { l: string; v: string }[]
    parts.push(`Details: ${info.map(i => `${i.l}: ${i.v}`).join(', ')}`)
  }

  if (meta.alts) {
    const alts = meta.alts as { name: string; detail: string; price: string }[]
    if (alts.length) {
      parts.push(`Alternatives: ${alts.map(a => `${a.name} (${a.price})`).join(', ')}`)
    }
  }

  return parts.filter(Boolean).join('\n')
}

// ─── Layer 3: On-demand catalog (loaded by tools or for context) ─

export async function loadCatalogContext(
  destination: string,
  options?: { category?: string; vibeFilter?: string; priceFilter?: string }
): Promise<string> {
  const db = getDb()

  // Find destination
  const { data: dest } = await db
    .from('catalog_destinations')
    .select('id, city, country')
    .ilike('city', `%${destination.split(',')[0].trim()}%`)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!dest) return ''

  const parts: string[] = [`\nCATALOG DATA FOR ${dest.city.toUpperCase()}, ${dest.country.toUpperCase()}:`]

  // Conditionally load only relevant category if specified
  const loadHotels = !options?.category || options.category === 'hotel'
  const loadActivities = !options?.category || options.category === 'activity'
  const loadRestaurants = !options?.category || options.category === 'food' || options.category === 'restaurant'

  // Load each category separately for proper typing
  if (loadHotels) {
    const { data: hotels } = await db.from('catalog_hotels').select('name, detail, price_per_night, price_level, rating, amenities, location, metadata').eq('destination_id', dest.id)
    if (hotels?.length) {
      parts.push('\nHOTELS:')
      for (const h of hotels) {
        const meta = (h.metadata as Record<string, unknown>) || {}
        parts.push(`- ${h.name} (${h.price_per_night}/night, ${h.price_level}, ${h.rating}★) — ${h.detail}`)
        if (meta.honest_take) parts.push(`  Honest take: ${meta.honest_take}`)
        if (meta.practical_tips) parts.push(`  Tips: ${(meta.practical_tips as string[]).join('; ')}`)
        if (meta.best_for) parts.push(`  Best for: ${(meta.best_for as string[]).join(', ')}`)
        if (h.amenities?.length) parts.push(`  Amenities: ${(h.amenities as string[]).join(', ')}`)
      }
    }
  }

  if (loadActivities) {
    const { data: activities } = await db.from('catalog_activities').select('name, detail, price, duration, best_time, location, metadata').eq('destination_id', dest.id)
    if (activities?.length) {
      parts.push('\nACTIVITIES:')
      for (const a of activities) {
        const meta = (a.metadata as Record<string, unknown>) || {}
        parts.push(`- ${a.name} (${a.price}, ${a.duration}, best: ${a.best_time}) — ${a.detail}`)
        if (meta.honest_take) parts.push(`  Honest take: ${meta.honest_take}`)
        if (meta.practical_tips) parts.push(`  Tips: ${(meta.practical_tips as string[]).join('; ')}`)
        if (meta.best_for) parts.push(`  Best for: ${(meta.best_for as string[]).join(', ')}`)
      }
    }
  }

  if (loadRestaurants) {
    const { data: restaurants } = await db.from('catalog_restaurants').select('name, detail, cuisine, avg_cost, price_level, must_try, location, metadata').eq('destination_id', dest.id)
    if (restaurants?.length) {
      parts.push('\nRESTAURANTS:')
      for (const r of restaurants) {
        const meta = (r.metadata as Record<string, unknown>) || {}
        parts.push(`- ${r.name} (${r.cuisine}, ${r.avg_cost}, ${r.price_level}) — ${r.detail}`)
        if (meta.honest_take) parts.push(`  Honest take: ${meta.honest_take}`)
        if (r.must_try?.length) parts.push(`  Must-try: ${(r.must_try as string[]).join(', ')}`)
        if (meta.practical_tips) parts.push(`  Tips: ${(meta.practical_tips as string[]).join('; ')}`)
        if (meta.best_for) parts.push(`  Best for: ${(meta.best_for as string[]).join(', ')}`)
      }
    }
  }

  return parts.join('\n')
}

// ─── Search catalog (used by tools) ──────────────────────────

export async function searchCatalog(
  destination: string,
  category: 'hotel' | 'activity' | 'food',
  filters?: { vibe?: string; priceLevel?: string; query?: string }
): Promise<Array<{
  name: string; detail: string; price: string; priceLevel: string;
  rating: number; location: string; vibes: string[];
  honestTake: string; bestFor: string[]; imageUrl: string | null
}>> {
  const db = getDb()

  const { data: dest } = await db
    .from('catalog_destinations')
    .select('id')
    .ilike('city', `%${destination.split(',')[0].trim()}%`)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!dest) return []

  const table = category === 'hotel' ? 'catalog_hotels'
    : category === 'activity' ? 'catalog_activities'
    : 'catalog_restaurants'

  let query = db.from(table).select('*').eq('destination_id', dest.id)

  if (filters?.priceLevel) {
    query = query.eq('price_level', filters.priceLevel)
  }

  const { data: items } = await query

  if (!items) return []

  // Client-side vibe/query filtering
  let filtered = items
  if (filters?.vibe) {
    const vibe = filters.vibe.toLowerCase()
    filtered = filtered.filter(i =>
      (i.vibes as string[] || []).some((v: string) => v.toLowerCase().includes(vibe))
    )
    // Fallback: if vibe filter is too strict, return all
    if (filtered.length === 0) filtered = items
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase()
    filtered = filtered.filter(i =>
      (i.name as string).toLowerCase().includes(q) ||
      (i.detail as string || '').toLowerCase().includes(q) ||
      (i.description as string || '').toLowerCase().includes(q)
    )
    if (filtered.length === 0) filtered = items
  }

  return filtered.map(i => {
    const meta = (i.metadata as Record<string, unknown>) || {}
    return {
      name: i.name,
      detail: i.detail || '',
      price: i.price_per_night || i.price || i.avg_cost || '',
      priceLevel: i.price_level || 'mid',
      rating: i.rating || (meta.rating as number) || 0,
      location: i.location || '',
      vibes: (i.vibes as string[]) || [],
      honestTake: (meta.honest_take as string) || '',
      bestFor: (meta.best_for as string[]) || [],
      imageUrl: i.image_url || null,
    }
  })
}

// ─── Slim Catalog Summary (Issue 2 — token-efficient) ────────

export async function loadCatalogSummary(destination: string): Promise<string> {
  const db = getDb()

  const { data: dest } = await db
    .from('catalog_destinations')
    .select('id, city, country')
    .ilike('city', `%${destination.split(',')[0].trim()}%`)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!dest) return ''

  const [{ data: hotels }, { data: activities }, { data: restaurants }] = await Promise.all([
    db.from('catalog_hotels').select('name, price_per_night, price_level').eq('destination_id', dest.id),
    db.from('catalog_activities').select('name, price').eq('destination_id', dest.id),
    db.from('catalog_restaurants').select('name, avg_cost, price_level').eq('destination_id', dest.id),
  ])

  const parts: string[] = [`\nCATALOG SUMMARY FOR ${dest.city.toUpperCase()}, ${dest.country.toUpperCase()}:`]

  if (hotels?.length) {
    const prices = hotels.map(h => parseFloat((h.price_per_night || '0').replace(/[^0-9.]/g, ''))).filter(p => p > 0)
    const min = Math.min(...prices), max = Math.max(...prices)
    parts.push(`Hotels (${hotels.length}, $${min}-${max}/night): ${hotels.map(h => `${h.name} (${h.price_per_night}, ${h.price_level})`).join(', ')}`)
  }

  if (activities?.length) {
    parts.push(`Activities (${activities.length}): ${activities.map(a => `${a.name} (${a.price})`).join(', ')}`)
  }

  if (restaurants?.length) {
    parts.push(`Restaurants (${restaurants.length}): ${restaurants.map(r => `${r.name} (${r.avg_cost}, ${r.price_level})`).join(', ')}`)
  }

  parts.push('[Use search_catalog tool for full details, reviews, and honest takes]')

  return parts.join('\n')
}

// ─── Get destination ID helper ───────────────────────────────

export async function getDestinationId(destination: string): Promise<string | null> {
  const db = getDb()
  const { data } = await db
    .from('catalog_destinations')
    .select('id')
    .ilike('city', `%${destination.split(',')[0].trim()}%`)
    .eq('status', 'active')
    .limit(1)
    .single()
  return data?.id || null
}
