// ─── Price Cache Layer ────────────────────────────────────────
// Stores fetched prices with TTL. Check cache → if fresh, return it.
// If stale, fetch new price and update cache.

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// TTL defaults per provider
const TTL_HOURS: Record<string, number> = {
  'amadeus-flights': 1,    // Flight prices change fast
  'amadeus-hotels': 12,    // Hotel prices refresh twice a day
  'amadeus-activities': 48, // Activity prices are fairly stable
  'google-places': 168,    // Restaurant info barely changes (1 week)
  'default': 24,
}

export interface CachedPrice {
  provider: string
  itemType: string
  itemKey: string
  priceData: Record<string, unknown>
  fetchedAt: string
  expiresAt: string
  isFresh: boolean
}

// Get cached price if fresh
export async function getCachedPrice(
  provider: string,
  itemType: string,
  itemKey: string,
): Promise<CachedPrice | null> {
  const db = getAdminClient()

  const { data } = await db
    .from('price_cache')
    .select('*')
    .eq('provider', provider)
    .eq('item_type', itemType)
    .eq('item_key', itemKey)
    .single()

  if (!data) return null

  const isFresh = new Date(data.expires_at) > new Date()

  return {
    provider: data.provider,
    itemType: data.item_type,
    itemKey: data.item_key,
    priceData: data.price_data,
    fetchedAt: data.fetched_at,
    expiresAt: data.expires_at,
    isFresh,
  }
}

// Set/update cached price
export async function setCachedPrice(
  provider: string,
  itemType: string,
  itemKey: string,
  priceData: Record<string, unknown>,
): Promise<void> {
  const db = getAdminClient()

  const ttlKey = `${provider}-${itemType}`
  const ttlHours = TTL_HOURS[ttlKey] || TTL_HOURS['default']
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

  // Upsert
  const { data: existing } = await db
    .from('price_cache')
    .select('id')
    .eq('provider', provider)
    .eq('item_type', itemType)
    .eq('item_key', itemKey)
    .single()

  if (existing) {
    await db
      .from('price_cache')
      .update({
        price_data: priceData,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', existing.id)
  } else {
    await db.from('price_cache').insert({
      provider,
      item_type: itemType,
      item_key: itemKey,
      price_data: priceData,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
  }
}

// Get price with auto-refresh: check cache, if stale call fetcher, update cache
export async function getPrice(
  provider: string,
  itemType: string,
  itemKey: string,
  fetcher: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const cached = await getCachedPrice(provider, itemType, itemKey)

  if (cached?.isFresh) {
    return cached.priceData
  }

  // Fetch fresh price
  const freshData = await fetcher()
  await setCachedPrice(provider, itemType, itemKey, freshData)
  return freshData
}

// Clean up expired cache entries
export async function cleanExpiredCache(): Promise<number> {
  const db = getAdminClient()
  const { data } = await db
    .from('price_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  return data?.length || 0
}
