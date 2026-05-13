#!/usr/bin/env npx tsx
// Backfill place_ids for existing catalog items:
// 1. Copy metadata.placeId to place_id column (from prior SerpAPI runs)
// 2. Search Google Places API for items still missing place_id
// 3. Update place_id if name similarity > 80%
//
// Usage:
//   npx tsx scripts/backfill-place-ids.ts              # full run
//   npx tsx scripts/backfill-place-ids.ts --dry-run    # preview only

import { createClient } from '@supabase/supabase-js'
import { searchPlaces } from '../src/lib/google-places'
import { withRetry } from '../src/lib/discovery'
import * as fs from 'fs'

// ─── Load .env.local ──────────────────────────────────────────
const envFile = fs.readFileSync('.env.local', 'utf8')
envFile.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=')
  if (eqIdx > 0 && !line.startsWith('#')) {
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
})

// ─── Name similarity (Levenshtein-based, returns 0-1) ─────────

function nameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (la === lb) return 1
  const maxLen = Math.max(la.length, lb.length)
  if (maxLen === 0) return 1
  // Levenshtein distance
  const matrix: number[][] = []
  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i]
    for (let j = 1; j <= lb.length; j++) {
      if (i === 0) { matrix[i][j] = j; continue }
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (la[i - 1] === lb[j - 1] ? 0 : 1)
      )
    }
  }
  return 1 - matrix[la.length][lb.length] / maxLen
}

// ─── Constants ────────────────────────────────────────────────

const TABLES = ['catalog_hotels', 'catalog_activities', 'catalog_restaurants'] as const
const MAX_GOOGLE_PLACES_CALLS = 800 // Stay under daily limit
const BATCH_SIZE = 3 // Concurrent requests per batch
const BATCH_DELAY_MS = 500 // Delay between batches
const SIMILARITY_THRESHOLD = 0.8
const DRY_RUN = process.argv.includes('--dry-run')

// ─── Backfill a single table ──────────────────────────────────

async function backfillTable(tableName: string, db: ReturnType<typeof createClient>) {
  let googleCallsUsed = 0
  let metadataExtracted = 0
  let googleMatched = 0
  let noMatch = 0

  // Step 1: Copy metadata.placeId to place_id for items that have it
  const { data: withMeta } = await db.from(tableName)
    .select('id, metadata')
    .is('place_id', null)

  for (const item of withMeta || []) {
    const meta = item.metadata as Record<string, unknown> | null
    const existingPlaceId = meta?.placeId as string | undefined
    if (existingPlaceId) {
      if (!DRY_RUN) {
        await db.from(tableName).update({ place_id: existingPlaceId }).eq('id', item.id)
      }
      metadataExtracted++
      console.log(`[Backfill] ${tableName}: ${item.id} <- metadata.placeId = ${existingPlaceId}`)
    }
  }
  console.log(`[Backfill] ${tableName}: ${metadataExtracted} items got place_id from metadata.placeId`)

  // Step 2: Google Places lookup for remaining items
  const { data: remaining } = await db.from(tableName)
    .select('id, name, destination_id')
    .is('place_id', null)

  if (!remaining || remaining.length === 0) {
    console.log(`[Backfill] ${tableName}: no items remaining without place_id`)
    return { metadataExtracted, googleMatched, noMatch, googleCallsUsed }
  }

  // Get destination cities for search context
  const destIds = [...new Set(remaining.map(r => r.destination_id))]
  const { data: dests } = await db.from('catalog_destinations')
    .select('id, city')
    .in('id', destIds)
  const destCityMap = new Map((dests || []).map(d => [d.id, d.city]))

  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    if (googleCallsUsed >= MAX_GOOGLE_PLACES_CALLS) {
      console.warn(`[Backfill] ${tableName}: Google Places call limit reached (${googleCallsUsed}), stopping`)
      break
    }

    const batch = remaining.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (item) => {
      if (googleCallsUsed >= MAX_GOOGLE_PLACES_CALLS) return

      const city = destCityMap.get(item.destination_id) || ''
      const query = `${item.name} ${city}`

      try {
        googleCallsUsed++
        const results = await withRetry(
          () => searchPlaces(query, 1),
          `Backfill:${item.name.slice(0, 30)}`,
        )

        if (results.length > 0) {
          const sim = nameSimilarity(item.name, results[0].name)
          if (sim >= SIMILARITY_THRESHOLD) {
            if (!DRY_RUN) {
              await db.from(tableName).update({ place_id: results[0].placeId }).eq('id', item.id)
            }
            googleMatched++
            console.log(`[Backfill] ${tableName}: "${item.name}" -> ${results[0].placeId} (similarity: ${sim.toFixed(2)})`)
          } else {
            noMatch++
            console.log(`[Backfill] ${tableName}: "${item.name}" -- low similarity ${sim.toFixed(2)} with "${results[0].name}", skipping`)
          }
        } else {
          noMatch++
          console.log(`[Backfill] ${tableName}: "${item.name}" -- no Google Places results`)
        }
      } catch (err) {
        noMatch++
        console.warn(`[Backfill] ${tableName}: "${item.name}" -- search failed: ${err}`)
      }
    }))

    // Rate limit delay between batches
    if (i + BATCH_SIZE < remaining.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  return { metadataExtracted, googleMatched, noMatch, googleCallsUsed }
}

// ─── Main entry ───────────────────────────────────────────────

async function main() {
  console.log(`[Backfill] Starting place_id backfill${DRY_RUN ? ' (DRY RUN)' : ''}`)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const totals = { metadataExtracted: 0, googleMatched: 0, noMatch: 0, googleCallsUsed: 0 }

  for (const table of TABLES) {
    console.log(`\n--- [Backfill] Processing ${table} ---`)
    const stats = await backfillTable(table, db)
    totals.metadataExtracted += stats.metadataExtracted
    totals.googleMatched += stats.googleMatched
    totals.noMatch += stats.noMatch
    totals.googleCallsUsed += stats.googleCallsUsed
  }

  console.log(`\n[Backfill] COMPLETE`)
  console.log(`[Backfill] From metadata: ${totals.metadataExtracted}`)
  console.log(`[Backfill] From Google Places: ${totals.googleMatched}`)
  console.log(`[Backfill] No match: ${totals.noMatch}`)
  console.log(`[Backfill] Google Places API calls: ${totals.googleCallsUsed}`)
}

main().catch(err => {
  console.error(`[Backfill] FATAL: ${err}`)
  process.exit(1)
})
