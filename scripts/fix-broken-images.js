#!/usr/bin/env node
// Fix broken/missing catalog images:
// 1. Resolves googleapis URLs (Street View thumbnails, Places API URLs) to real venue photos
// 2. Fills NULL image_url using Google Places photo lookup
// 3. All photo URLs resolved to direct googleusercontent.com CDN URLs (no API key in URL)
//
// Usage: node scripts/fix-broken-images.js [--dry-run]

const fs = require('fs')

// Parse .env.local
const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim()
})

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = env.GOOGLE_PLACES_API_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase creds'); process.exit(1) }
if (!GOOGLE_KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1) }

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

// Get destination city name for a destination_id
async function getDestCity(destId) {
  const res = await fetch(`${API}/catalog_destinations?select=city,country&id=eq.${destId}`, { headers })
  const data = await res.json()
  return data[0] || { city: '', country: '' }
}

// Find a place on Google and resolve its photo to a direct CDN URL
async function getResolvedPhoto(name, city, country) {
  const query = encodeURIComponent(`${name}, ${city}, ${country}`)
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos&key=${GOOGLE_KEY}`

  const findRes = await fetch(findUrl)
  if (!findRes.ok) return null

  const findData = await findRes.json()
  if (findData.status !== 'OK' || !findData.candidates?.[0]?.photos?.length) return null

  const photoRef = findData.candidates[0].photos[0].photo_reference
  const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_KEY}`

  // Resolve redirect to direct CDN URL
  const photoRes = await fetch(photoApiUrl, { redirect: 'manual' })
  const location = photoRes.headers.get('location')
  if (location && location.includes('googleusercontent.com')) {
    return location
  }
  return null
}

async function fixTable(tableName) {
  // Fetch items with broken or missing images
  const res = await fetch(
    `${API}/${tableName}?select=id,name,image_url,destination_id,metadata&or=(image_url.is.null,image_url.like.*streetviewpixels*,image_url.like.*places.googleapis.com*)`,
    { headers }
  )
  const items = await res.json()
  if (!items.length) {
    console.log(`  ${tableName}: no broken items`)
    return 0
  }

  console.log(`  ${tableName}: ${items.length} items to fix`)

  // Cache destination lookups
  const destCache = new Map()
  let fixed = 0

  for (const item of items) {
    if (!destCache.has(item.destination_id)) {
      destCache.set(item.destination_id, await getDestCity(item.destination_id))
    }
    const dest = destCache.get(item.destination_id)

    console.log(`    "${item.name}" (${dest.city}) — current: ${item.image_url ? 'broken URL' : 'NULL'}`)

    const newUrl = await getResolvedPhoto(item.name, dest.city, dest.country)
    if (newUrl) {
      console.log(`    ✓ resolved → ${newUrl.substring(0, 80)}...`)

      if (!DRY_RUN) {
        // Update image_url and also add to metadata.photos
        const meta = item.metadata || {}
        const photos = meta.photos || []
        if (!photos.includes(newUrl)) photos.unshift(newUrl)

        await fetch(`${API}/${tableName}?id=eq.${item.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ image_url: newUrl, metadata: { ...meta, photos } }),
        })
      }
      fixed++
    } else {
      console.log(`    ✗ no Google Places photo found`)
    }
  }

  return fixed
}

async function main() {
  console.log(`\nFix Broken Catalog Images${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  let total = 0
  for (const table of ['catalog_hotels', 'catalog_activities', 'catalog_restaurants']) {
    total += await fixTable(table)
  }

  console.log(`\nDone: ${total} items fixed${DRY_RUN ? ' (dry run — no changes written)' : ''}`)
}

main().catch(e => { console.error(e); process.exit(1) })
