#!/usr/bin/env node
// Backfill missing images using Unsplash Source (free, no API key needed)
// Uses the Unsplash search API to find relevant high-quality photos
//
// Usage: node scripts/backfill-images-unsplash.js [--dry-run] [--dest=Dubai]

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
const DRY_RUN = process.argv.includes('--dry-run')
const DEST_FILTER = (process.argv.find(a => a.startsWith('--dest=')) || '').replace('--dest=', '')

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function supabaseGet(table, filter) {
  const res = await fetch(`${API}/${table}?${filter}`, { headers })
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`)
  return res.json()
}

async function supabasePatch(table, filter, data, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${API}/${table}?${filter}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    })
    if (res.ok) return res.json()
    if (res.status >= 500 && attempt < retries - 1) {
      await sleep(3000 * (attempt + 1))
      continue
    }
    throw new Error(`PATCH ${table} failed: ${res.status}`)
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Unsplash search (no API key needed for source URLs) ───

// Build a relevant search query for an item
function buildSearchQuery(name, city, type) {
  // Clean the name: remove common suffixes/prefixes
  let clean = name
    .replace(/\b(admission|ticket|tour|pass|class|experience|day trip|packages?|half.?day|full.?day)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // For hotels, search hotel + city for fallback
  const typeHint = type === 'hotel' ? 'hotel luxury' : type === 'restaurant' ? 'restaurant food' : ''

  return { primary: `${clean} ${city}`, fallback: `${typeHint} ${city}` }
}

// Use Unsplash source URL (redirects to actual image, free)
function unsplashSourceUrl(query, w = 1200, h = 800) {
  return `https://source.unsplash.com/${w}x${h}/?${encodeURIComponent(query)}`
}

// Actually resolve the Unsplash source URL to get a stable direct URL
async function resolveUnsplashUrl(query, w = 1200, h = 800) {
  const url = `https://source.unsplash.com/${w}x${h}/?${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (res.ok && res.url && res.url.includes('images.unsplash.com')) {
      return res.url
    }
    return null
  } catch {
    return null
  }
}

// Generate 3 Unsplash images with different queries for variety
async function getUnsplashPhotos(name, city, type) {
  const { primary, fallback } = buildSearchQuery(name, city, type)
  const photos = []

  // Try primary query
  const url1 = await resolveUnsplashUrl(primary)
  if (url1) photos.push(url1)
  await sleep(500)

  // Try with type hint for variety
  if (type !== 'activity') {
    const url2 = await resolveUnsplashUrl(`${name} ${type}`)
    if (url2 && url2 !== url1) photos.push(url2)
    await sleep(500)
  }

  // Try city + type as fallback for more variety
  const url3 = await resolveUnsplashUrl(fallback)
  if (url3 && !photos.includes(url3)) photos.push(url3)

  return photos
}

// ─── Curated image hints for famous places ───
// For well-known landmarks, provide specific search terms for better results
const CURATED_HINTS = {
  // Hotels
  'burj al arab': 'burj al arab dubai hotel luxury',
  'atlantis the palm': 'atlantis palm dubai hotel',
  'marina bay sands': 'marina bay sands singapore hotel',
  'park hyatt tokyo': 'park hyatt tokyo hotel luxury',
  'the ritz paris': 'ritz paris hotel luxury',
  'le bristol paris': 'le bristol paris hotel',
  'soneva fushi': 'soneva fushi maldives overwater villa',
  'hoshinoya tokyo': 'hoshinoya tokyo ryokan luxury',
  // Activities
  'eiffel tower': 'eiffel tower paris night',
  'louvre museum': 'louvre museum pyramid paris',
  'senso-ji temple': 'sensoji temple tokyo asakusa',
  'shibuya crossing': 'shibuya crossing tokyo night',
  'teamlab borderless': 'teamlab borderless digital art tokyo',
  'burj khalifa': 'burj khalifa dubai skyline',
  'dubai miracle garden': 'dubai miracle garden flowers',
  'dubai frame': 'dubai frame building',
  'desert safari': 'desert safari dubai dunes',
  'ski dubai': 'ski dubai mall snow',
  'aquaventure waterpark': 'aquaventure waterpark atlantis dubai',
  'gardens by the bay': 'gardens bay singapore supertrees',
  'singapore zoo': 'singapore zoo animals',
  'sentosa island': 'sentosa island singapore beach',
  'snorkeling manta': 'maldives snorkeling manta ray',
  'overwater spa': 'maldives overwater spa luxury',
  'bioluminescent': 'bioluminescent beach maldives night',
  'submarine ride': 'submarine maldives underwater',
  'amber fort': 'amber fort jaipur rajasthan',
  'hawa mahal': 'hawa mahal jaipur pink',
  'city palace': 'city palace jaipur rajasthan',
  'rohtang pass': 'rohtang pass manali snow mountains',
  'solang valley': 'solang valley manali snow adventure',
  'hadimba temple': 'hadimba temple manali',
  'jogini waterfall': 'jogini waterfall manali trek',
  // Restaurants
  'ichiran ramen': 'ichiran ramen tokyo bowl',
  'sukiyabashi jiro': 'sushi jiro tokyo omakase',
  'narisawa': 'narisawa tokyo fine dining',
  'cafe de flore': 'cafe de flore paris terrace',
  'ithaa undersea': 'ithaa undersea restaurant maldives',
}

function getCuratedHint(name) {
  const lower = name.toLowerCase()
  for (const [key, hint] of Object.entries(CURATED_HINTS)) {
    if (lower.includes(key)) return hint
  }
  return null
}

// ─── Main ───

async function main() {
  console.log(`Image Backfill via Unsplash ${DRY_RUN ? '(DRY RUN)' : ''}`)
  console.log('='.repeat(60))

  const dests = await supabaseGet('catalog_destinations', 'select=id,city,country&status=eq.active')
  const tables = [
    { table: 'catalog_hotels', type: 'hotel' },
    { table: 'catalog_activities', type: 'activity' },
    { table: 'catalog_restaurants', type: 'restaurant' },
  ]

  let updated = 0
  let skipped = 0

  for (const dest of dests) {
    if (DEST_FILTER && !dest.city.toLowerCase().includes(DEST_FILTER.toLowerCase())) continue
    console.log(`\n${'='.repeat(50)}`)
    console.log(`${dest.city}, ${dest.country}`)

    for (const { table, type } of tables) {
      const items = await supabaseGet(table, `select=id,name,image_url,metadata,destination_id&destination_id=eq.${dest.id}&limit=500`)

      // Find items with no images
      const needImages = items.filter(i => {
        const hasImage = i.image_url && i.image_url.length > 10
        const hasPhotos = i.metadata && i.metadata.photos && i.metadata.photos.length > 0
        return !hasImage && !hasPhotos
      })

      if (needImages.length === 0) continue
      console.log(`  ${type}s: ${needImages.length} need images`)

      for (const item of needImages) {
        const hint = getCuratedHint(item.name)
        const searchName = hint || item.name

        if (DRY_RUN) {
          console.log(`    [DRY] ${item.name} → search: "${searchName}"`)
          continue
        }

        const photos = await getUnsplashPhotos(searchName, dest.city, type)
        await sleep(300)

        if (photos.length === 0) {
          console.log(`    ✗ ${item.name}`)
          skipped++
          continue
        }

        const meta = item.metadata || {}
        await supabasePatch(table, `id=eq.${item.id}`, {
          image_url: photos[0],
          metadata: { ...meta, photos, imageSource: 'unsplash' }
        })
        updated++
        console.log(`    ✓ ${item.name} — ${photos.length} photos`)
        await sleep(200)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`DONE! Updated: ${updated}, Skipped: ${skipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })
