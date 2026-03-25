// ─── Google Places Verification Cache ─────────────────────────
// Caches place existence checks to avoid redundant API calls during evals.
// 30-day TTL. Follows the price-cache.ts pattern.

import { createClient } from '@supabase/supabase-js'
import { getPlaceData, type PlaceData } from '../google-places-photos'

const TTL_DAYS = 30

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface CachedPlaceResult {
  exists: boolean
  placeData: PlaceData | null
  fromCache: boolean
}

/**
 * Check if a place exists, using cache first.
 */
export async function verifyPlace(
  placeName: string,
  destination: string,
  country: string,
): Promise<CachedPlaceResult> {
  const db = getAdminClient()

  // Check cache
  const { data: cached } = await db
    .from('eval_place_cache')
    .select('*')
    .ilike('place_name', placeName)
    .ilike('destination', destination)
    .single()

  if (cached && new Date(cached.expires_at) > new Date()) {
    return {
      exists: cached.exists_on_google,
      placeData: cached.place_data as PlaceData | null,
      fromCache: true,
    }
  }

  // Cache miss or expired — call Google Places
  try {
    const data = await getPlaceData(placeName, destination, country)
    const exists = !!data
    const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Upsert into cache
    if (cached) {
      await db.from('eval_place_cache').update({
        exists_on_google: exists,
        place_data: (data || {}) as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      }).eq('id', cached.id)
    } else {
      await db.from('eval_place_cache').insert({
        place_name: placeName,
        destination,
        country,
        exists_on_google: exists,
        place_data: (data || {}) as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
    }

    return { exists, placeData: data, fromCache: false }
  } catch {
    return { exists: false, placeData: null, fromCache: false }
  }
}

/**
 * Batch verify places with concurrency limit.
 */
export async function batchVerifyPlaces(
  items: Array<{ name: string }>,
  destination: string,
  country: string,
  maxConcurrency = 5,
): Promise<Map<string, CachedPlaceResult>> {
  const results = new Map<string, CachedPlaceResult>()
  const queue = [...items]

  while (queue.length > 0) {
    const batch = queue.splice(0, maxConcurrency)
    const batchResults = await Promise.all(
      batch.map(item =>
        verifyPlace(item.name, destination, country)
          .then(r => ({ name: item.name, result: r }))
      )
    )
    for (const { name, result } of batchResults) {
      results.set(name, result)
    }
  }

  return results
}
