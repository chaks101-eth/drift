#!/usr/bin/env node
// Backfill photos for catalog items using SerpAPI place details
// For items with dataId: fetches up to 6 photos from Google Maps
// For items without: uses Unsplash as fallback (if key available)
// Usage: node scripts/backfill-photos.js [--dry-run]

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
const SERPAPI_KEY = env.SERPAPI_KEY
const UNSPLASH_KEY = env.UNSPLASH_ACCESS_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase creds'); process.exit(1) }
if (!SERPAPI_KEY) { console.error('Missing SERPAPI_KEY'); process.exit(1) }

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

// ─── Supabase helpers ───
async function supabaseGet(table, filter) {
  const res = await fetch(`${API}/${table}?${filter}`, { headers })
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`)
  return res.json()
}

async function supabasePatch(table, filter, data) {
  const res = await fetch(`${API}/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`PATCH ${table} failed: ${res.status} ${txt}`)
  }
  return res.json()
}

// ─── SerpAPI place detail → photos ───
function upsizeGoogleUrl(url) {
  if (!url) return url
  return url.replace(/=w\d+-h\d+/, '=w800-h600').replace(/-k-no$/, '-k-no')
}

async function fetchPhotosFromSerpAPI(dataId, name) {
  const params = new URLSearchParams({
    engine: 'google_maps',
    data_id: dataId,
    q: name || 'place',
    api_key: SERPAPI_KEY,
  })
  const res = await fetch(`https://serpapi.com/search.json?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  const p = data.place_results
  if (!p) return []

  const photos = []
  if (p.images) {
    const imgs = p.images
      .filter(i => i.thumbnail && !['Videos', 'Street View & 360°'].includes(i.title || ''))
      .map(i => i.thumbnail)
      .filter(u => u.includes('googleusercontent.com'))
      .map(u => upsizeGoogleUrl(u))
      .slice(0, 6)
    photos.push(...imgs)
  }
  if (photos.length === 0 && p.thumbnail) {
    photos.push(upsizeGoogleUrl(p.thumbnail))
  }
  return photos
}

// ─── Unsplash fallback ───
async function fetchPhotosFromUnsplash(name, city, category, count) {
  if (!UNSPLASH_KEY) return []
  const catHint = category === 'hotel' ? 'hotel resort' : category === 'food' ? 'restaurant food' : 'travel landmark'
  const query = `${name} ${city}`
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
  if (!res.ok) {
    // Try broader query
    const url2 = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${catHint} ${city}`)}&per_page=${count}&orientation=landscape`
    const res2 = await fetch(url2, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
    if (!res2.ok) return []
    const data2 = await res2.json()
    return (data2.results || []).map(p => `${p.urls.raw}&w=800&h=600&fit=crop&auto=format&q=80`)
  }
  const data = await res.json()
  return (data.results || []).map(p => `${p.urls.raw}&w=800&h=600&fit=crop&auto=format&q=80`)
}

// ─── Rate limiter ───
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Main ───
async function main() {
  const tables = ['catalog_hotels', 'catalog_activities', 'catalog_restaurants']
  const catMap = { catalog_hotels: 'hotel', catalog_activities: 'activity', catalog_restaurants: 'food' }

  // Get all destinations for city names
  const dests = await supabaseGet('catalog_destinations', 'select=id,city')
  const destCity = {}
  dests.forEach(d => { destCity[d.id] = d.city })

  let totalUpdated = 0
  let serpCalls = 0
  let unsplashCalls = 0
  let skipped = 0

  for (const table of tables) {
    console.log(`\n=== ${table} ===`)
    const items = await supabaseGet(table, 'select=id,name,image_url,metadata,destination_id&limit=500')
    console.log(`  ${items.length} items total`)

    for (const item of items) {
      const meta = item.metadata || {}
      const existingPhotos = (meta.photos || []).filter(p => p && typeof p === 'string')

      // Skip if already has 2+ photos
      if (existingPhotos.length >= 2) {
        skipped++
        continue
      }

      const dataId = meta.dataId
      const city = destCity[item.destination_id] || ''
      let photos = []

      // Strategy 1: SerpAPI with dataId
      if (dataId) {
        if (DRY_RUN) {
          console.log(`  [DRY] Would fetch SerpAPI for "${item.name}" (dataId: ${dataId})`)
          continue
        }
        photos = await fetchPhotosFromSerpAPI(dataId, item.name)
        serpCalls++
        // Rate limit: SerpAPI free = 100 per hour, so ~1 per 36s to be safe
        // But we have 201 left for the month, so go a bit faster
        await sleep(1500)
      }

      // Strategy 2: Unsplash fallback
      if (photos.length < 2 && UNSPLASH_KEY) {
        const extra = await fetchPhotosFromUnsplash(item.name, city, catMap[table], 4)
        unsplashCalls++
        // Merge: SerpAPI photos first, then Unsplash
        photos = [...photos, ...extra.filter(u => !photos.includes(u))].slice(0, 6)
        await sleep(500)
      }

      if (photos.length === 0) {
        // At minimum, ensure the main image_url is in photos
        if (item.image_url) {
          photos = [upsizeGoogleUrl(item.image_url)]
        } else {
          skipped++
          continue
        }
      }

      // Update
      const newImageUrl = item.image_url || photos[0]
      const newMeta = { ...meta, photos }

      await supabasePatch(table, `id=eq.${item.id}`, {
        image_url: upsizeGoogleUrl(newImageUrl),
        metadata: newMeta
      })
      totalUpdated++
      console.log(`  ✓ ${item.name} — ${photos.length} photos`)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Done! Updated: ${totalUpdated}, Skipped: ${skipped}`)
  console.log(`SerpAPI calls: ${serpCalls}, Unsplash calls: ${unsplashCalls}`)
}

main().catch(err => { console.error(err); process.exit(1) })
