#!/usr/bin/env node
// Comprehensive catalog data backfill:
// 1. Generate booking URLs programmatically (no API calls)
// 2. Search SerpAPI to find items on Google Maps (get dataId, website, photos)
// 3. Update image_url + metadata.photos for items missing images
//
// Usage:
//   node scripts/backfill-data.js                  # full run
//   node scripts/backfill-data.js --dry-run        # preview only
//   node scripts/backfill-data.js --booking-only   # just fix booking URLs
//   node scripts/backfill-data.js --dest=Dubai      # single destination

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
const DRY_RUN = process.argv.includes('--dry-run')
const BOOKING_ONLY = process.argv.includes('--booking-only')
const DEST_FILTER = (process.argv.find(a => a.startsWith('--dest=')) || '').replace('--dest=', '')

// SerpAPI budget: 250/month, already used ~73. Cap individual searches.
const MAX_SERP_SEARCHES = 80 // batch searches (~33) + individual item searches
const MAX_SERP_DETAILS = 100 // place detail calls for photos

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase creds'); process.exit(1) }

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

async function supabasePatch(table, filter, data, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${API}/${table}?${filter}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    })
    if (res.ok) return res.json()
    if (res.status >= 500 && attempt < retries - 1) {
      console.log(`      retry ${attempt + 1}/${retries} after ${res.status}...`)
      await sleep(3000 * (attempt + 1))
      continue
    }
    const txt = await res.text().catch(() => `status ${res.status}`)
    throw new Error(`PATCH ${table} failed: ${res.status} ${txt.substring(0, 200)}`)
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Booking URL generators (zero API calls) ───

function generateBookingComUrl(hotelName, city, country) {
  const q = encodeURIComponent(`${hotelName} ${city} ${country}`)
  return `https://www.booking.com/searchresults.html?ss=${q}&lang=en-us`
}

function generateGoogleMapsUrl(name, city) {
  const q = encodeURIComponent(`${name} ${city}`)
  return `https://www.google.com/maps/search/${q}`
}

function generateTripadvisorUrl(name, city) {
  const q = encodeURIComponent(`${name} ${city}`)
  return `https://www.tripadvisor.com/Search?q=${q}`
}

// ─── SerpAPI search to find items on Google Maps ───

async function searchSerpAPI(query) {
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    type: 'search',
    api_key: SERPAPI_KEY,
  })
  const res = await fetch(`https://serpapi.com/search.json?${params}`)
  if (!res.ok) {
    console.log(`    SerpAPI search failed: ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.local_results || []).map(p => ({
    name: p.title || '',
    dataId: p.data_id || '',
    placeId: p.place_id || '',
    rating: p.rating || 0,
    reviewCount: p.reviews || 0,
    address: p.address || '',
    thumbnail: p.thumbnail || '',
    website: (p.links || {}).website || '',
    mapsUrl: (p.links || {}).directions || '',
    lat: (p.gps_coordinates || {}).latitude || 0,
    lng: (p.gps_coordinates || {}).longitude || 0,
  }))
}

// ─── SerpAPI place details → photos + website + booking ───

function upsizeGoogleUrl(url) {
  if (!url) return url
  return url.replace(/=w\d+-h\d+/, '=w1200-h800').replace(/-k-no$/, '-k-no')
}

async function fetchPlaceDetails(dataId, name) {
  const params = new URLSearchParams({
    engine: 'google_maps',
    data_id: dataId,
    q: name || 'place',
    api_key: SERPAPI_KEY,
  })
  const res = await fetch(`https://serpapi.com/search.json?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  const p = data.place_results
  if (!p) return null

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
  // Fallback: try photos array directly
  if (photos.length === 0 && p.photos) {
    const directPhotos = (Array.isArray(p.photos) ? p.photos : [])
      .map(ph => ph.image || ph.thumbnail || ph)
      .filter(u => typeof u === 'string' && u.length > 10)
      .map(u => upsizeGoogleUrl(u))
      .slice(0, 6)
    photos.push(...directPhotos)
  }
  if (photos.length === 0 && p.thumbnail) {
    photos.push(upsizeGoogleUrl(p.thumbnail))
  }

  return {
    photos,
    website: p.website || null,
    phone: p.phone || null,
    bookingUrl: p.reservation_link || p.order_online_link || p.website || null,
    rating: p.rating || 0,
    reviewCount: p.reviews || 0,
    address: p.address || '',
    hours: p.operating_hours || null,
    highlights: p.highlights || [],
    amenities: p.amenities || [],
  }
}

// ─── Name matching (strict) ───

function normalizeForMatch(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract significant words (skip stop words, short words)
const STOP_WORDS = new Set(['the', 'a', 'an', 'in', 'at', 'of', 'and', 'to', 'for', 'with', 'by', 'from', 'on', 'tour', 'ticket', 'admission', 'class', 'experience', 'day', 'trip', 'pass'])

function getKeyWords(name) {
  return normalizeForMatch(name).split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function findBestMatch(itemName, searchResults) {
  const itemKeys = getKeyWords(itemName)
  if (itemKeys.length === 0) return null

  let bestMatch = null
  let bestScore = 0

  for (const result of searchResults) {
    const rNorm = normalizeForMatch(result.name)
    const iNorm = normalizeForMatch(itemName)

    // Exact normalized match
    if (rNorm === iNorm) return result

    // Check if the result name contains the core item name or vice versa
    const rKeys = getKeyWords(result.name)

    // Count how many of the item's key words appear in the result
    let forwardMatch = 0
    for (const w of itemKeys) {
      if (rKeys.some(rw => rw === w || (w.length > 4 && rw.includes(w)) || (rw.length > 4 && w.includes(rw)))) forwardMatch++
    }

    // Count how many of the result's key words appear in the item
    let reverseMatch = 0
    for (const rw of rKeys) {
      if (itemKeys.some(w => w === rw || (rw.length > 4 && w.includes(rw)) || (w.length > 4 && rw.includes(w)))) reverseMatch++
    }

    // Require at least 60% of item key words match AND at least 40% of result key words match
    // This prevents "Hotel X" matching "Hotel Y" just because "hotel" matches
    const forwardPct = forwardMatch / itemKeys.length
    const reversePct = rKeys.length > 0 ? reverseMatch / rKeys.length : 0
    const score = (forwardPct * 0.7) + (reversePct * 0.3)

    if (forwardPct >= 0.6 && score > bestScore && score >= 0.55) {
      bestScore = score
      bestMatch = result
    }
  }
  return bestMatch
}

// ─── Main ───

async function main() {
  console.log(`Catalog Data Backfill ${DRY_RUN ? '(DRY RUN)' : ''} ${BOOKING_ONLY ? '(booking only)' : ''}`)
  console.log('='.repeat(60))

  const dests = await supabaseGet('catalog_destinations', 'select=id,city,country&status=eq.active')
  const tables = [
    { table: 'catalog_hotels', type: 'hotel', searchSuffix: 'hotels' },
    { table: 'catalog_activities', type: 'activity', searchSuffix: 'things to do attractions' },
    { table: 'catalog_restaurants', type: 'restaurant', searchSuffix: 'restaurants' },
  ]

  let stats = { bookingFixed: 0, imagesFixed: 0, serpSearches: 0, serpDetails: 0, matched: 0 }

  for (const dest of dests) {
    if (DEST_FILTER && !dest.city.toLowerCase().includes(DEST_FILTER.toLowerCase())) continue
    console.log(`\n${'='.repeat(60)}`)
    console.log(`${dest.city}, ${dest.country}`)
    console.log('='.repeat(60))

    for (const { table, type, searchSuffix } of tables) {
      const items = await supabaseGet(table, `select=id,name,image_url,booking_url,source,metadata,destination_id&destination_id=eq.${dest.id}&limit=500`)
      console.log(`\n  ${type}s: ${items.length} items`)

      // ── Step 1: Fix booking URLs ──
      const noBooking = items.filter(i => !i.booking_url)
      if (noBooking.length > 0) {
        console.log(`  Fixing ${noBooking.length} missing booking URLs...`)
        for (const item of noBooking) {
          let url
          if (type === 'hotel') {
            url = generateBookingComUrl(item.name, dest.city, dest.country)
          } else {
            // Use website from metadata if available, else Google Maps search
            const meta = item.metadata || {}
            url = meta.website || meta.mapsUrl || generateGoogleMapsUrl(item.name, dest.city)
          }

          if (DRY_RUN) {
            console.log(`    [DRY] booking: ${item.name} → ${url.substring(0, 60)}...`)
          } else {
            await supabasePatch(table, `id=eq.${item.id}`, { booking_url: url })
            console.log(`    ✓ booking: ${item.name}`)
            await sleep(200) // avoid hammering Supabase
          }
          stats.bookingFixed++
        }
      }

      if (BOOKING_ONLY) continue

      // ── Step 2: Find items without dataId on Google Maps ──
      const noDataId = items.filter(i => !(i.metadata || {}).dataId)
      const noImages = items.filter(i => !i.image_url && (!(i.metadata || {}).photos || (i.metadata || {}).photos.length === 0))

      if (noDataId.length > 0 && SERPAPI_KEY) {
        console.log(`  Searching Google Maps for ${noDataId.length} items without dataId...`)

        // Batch search: one search per destination+type
        const searchQuery = `${searchSuffix} in ${dest.city} ${dest.country}`
        const searchResults = await searchSerpAPI(searchQuery)
        stats.serpSearches++
        console.log(`    Found ${searchResults.length} Google Maps results (batch)`)
        await sleep(4000)

        // Match each item to a search result
        for (const item of noDataId) {
          let match = findBestMatch(item.name, searchResults)

          // Individual item searches disabled to conserve SerpAPI credits
          // Batch search is usually sufficient for well-known places

          if (match) {
            stats.matched++
            const meta = item.metadata || {}

            if (DRY_RUN) {
              console.log(`    [DRY] matched: "${item.name}" → "${match.name}" (dataId: ${match.dataId})`)
              continue
            }

            // Update metadata with Google Maps data
            const updatedMeta = {
              ...meta,
              dataId: match.dataId,
              placeId: match.placeId,
              mapsUrl: match.mapsUrl || meta.mapsUrl,
              lat: match.lat || meta.lat,
              lng: match.lng || meta.lng,
            }

            // If item has no image, use the thumbnail
            const updates = { metadata: updatedMeta }
            if (!item.image_url && match.thumbnail) {
              updates.image_url = upsizeGoogleUrl(match.thumbnail)
            }

            // If no booking_url was set and match has website
            if (!item.booking_url && match.website) {
              updates.booking_url = match.website
            }

            await supabasePatch(table, `id=eq.${item.id}`, updates)
            console.log(`    ✓ matched: "${item.name}" → "${match.name}"`)
          } else {
            console.log(`    ✗ no match: "${item.name}"`)
          }
        }
      }

      // ── Step 3: Fetch detailed photos for items that now have dataId but no photos ──
      if (SERPAPI_KEY) {
        // Re-fetch items to get updated metadata
        const updatedItems = await supabaseGet(table, `select=id,name,image_url,metadata,destination_id&destination_id=eq.${dest.id}&limit=500`)
        const needPhotos = updatedItems.filter(i => {
          const meta = i.metadata || {}
          const hasPhotos = meta.photos && meta.photos.length >= 2
          return meta.dataId && !hasPhotos
        })

        if (needPhotos.length > 0) {
          console.log(`  Fetching photos for ${needPhotos.length} items with dataId...`)
          for (const item of needPhotos) {
            if (stats.serpDetails >= MAX_SERP_DETAILS) {
              console.log(`    ⚠ SerpAPI detail budget exhausted (${MAX_SERP_DETAILS} calls)`)
              break
            }
            const meta = item.metadata || {}

            if (DRY_RUN) {
              console.log(`    [DRY] photos: ${item.name} (dataId: ${meta.dataId})`)
              continue
            }

            const details = await fetchPlaceDetails(meta.dataId, item.name)
            stats.serpDetails++
            await sleep(3000)

            if (!details) {
              console.log(`    ✗ no details: ${item.name}`)
              continue
            }
            if (details.photos.length === 0) {
              console.log(`    ✗ no photos: ${item.name} (got: website=${details.website}, rating=${details.rating})`)
              continue
            }

            const updatedMeta = {
              ...meta,
              photos: details.photos,
              website: details.website || meta.website,
              phone: details.phone || meta.phone,
              highlights: details.highlights.length > 0 ? details.highlights : meta.highlights,
              amenities: details.amenities.length > 0 ? details.amenities : meta.amenities,
            }

            const updates = { metadata: updatedMeta }
            if (!item.image_url && details.photos.length > 0) {
              updates.image_url = details.photos[0]
            }

            // Update booking_url if we found a real one
            if (details.bookingUrl) {
              updates.booking_url = details.bookingUrl
            }

            await supabasePatch(table, `id=eq.${item.id}`, updates)
            stats.imagesFixed++
            console.log(`    ✓ photos: ${item.name} — ${details.photos.length} photos`)
          }
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('DONE!')
  console.log(`  Booking URLs fixed: ${stats.bookingFixed}`)
  console.log(`  Images fixed: ${stats.imagesFixed}`)
  console.log(`  SerpAPI searches: ${stats.serpSearches}`)
  console.log(`  SerpAPI detail calls: ${stats.serpDetails}`)
  console.log(`  Items matched to Google Maps: ${stats.matched}`)
}

main().catch(err => { console.error(err); process.exit(1) })
