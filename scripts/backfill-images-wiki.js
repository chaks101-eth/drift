#!/usr/bin/env node
// Backfill missing images using Wikipedia/Wikimedia (free, no API key)
// For well-known places, uses Wikipedia page images (high-res originals)
// For less known places, searches Wikipedia and uses the best match
//
// Usage: node scripts/backfill-images-wiki.js [--dry-run] [--dest=Dubai]

const fs = require('fs')

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

// ─── Wikipedia / Wikimedia image helpers ───

function upsizeWikiImage(url) {
  if (!url) return url
  // Wikimedia thumb URLs: replace /NNNpx- with /1200px- for larger images
  return url.replace(/\/\d+px-/, '/1200px-')
}

// Get the best image URL from a Wikipedia article
async function getWikiImage(searchTerm) {
  try {
    // Step 1: Try direct page lookup
    const directUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`
    const directRes = await fetch(directUrl)

    if (directRes.ok) {
      const data = await directRes.json()
      if (data.originalimage && data.originalimage.source) {
        // Skip logos and icons (small images)
        if (data.originalimage.width > 400 && data.originalimage.height > 300) {
          return { url: data.originalimage.source, title: data.title }
        }
      }
      if (data.thumbnail && data.thumbnail.source) {
        return { url: upsizeWikiImage(data.thumbnail.source), title: data.title }
      }
    }

    // Step 2: Search Wikipedia for the term
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&format=json&srlimit=3`
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const results = (searchData.query || {}).search || []

    for (const result of results) {
      const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.title)}`
      const pageRes = await fetch(pageUrl)
      if (!pageRes.ok) continue
      const pageData = await pageRes.json()

      if (pageData.originalimage && pageData.originalimage.source) {
        if (pageData.originalimage.width > 400 && pageData.originalimage.height > 300) {
          return { url: pageData.originalimage.source, title: pageData.title }
        }
      }
      if (pageData.thumbnail && pageData.thumbnail.source) {
        return { url: upsizeWikiImage(pageData.thumbnail.source), title: pageData.title }
      }
    }

    return null
  } catch {
    return null
  }
}

// ─── Relevance check ───
// Verify the Wikipedia article title is actually related to our search
function isRelevantMatch(itemName, wikiTitle, type) {
  const iWords = itemName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  const tWords = wikiTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)

  // Check if any significant word from the item appears in the wiki title
  const stopWords = new Set(['the', 'and', 'from', 'with', 'for', 'tour', 'ticket', 'hotel', 'restaurant', 'cafe', 'resort', 'day', 'trip', 'pass', 'class', 'admission'])
  const itemKeys = iWords.filter(w => !stopWords.has(w))
  const titleKeys = tWords.filter(w => !stopWords.has(w))

  let matchCount = 0
  for (const w of itemKeys) {
    if (titleKeys.some(tw => tw.includes(w) || w.includes(tw))) matchCount++
  }

  // Require at least one key word match
  return matchCount >= 1
}

// ─── Search term generation ───

// For each item, generate Wikipedia search terms (ordered by specificity)
function getSearchTerms(name, city, type) {
  // Clean the name
  let clean = name
    .replace(/\b(admission|ticket|tour|pass|class|experience|day trip|packages?|half.?day|full.?day|pickup|from \w+)\b/gi, '')
    .replace(/[—–]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const terms = []

  // 1. Direct name (most specific)
  terms.push(clean)

  // 2. Name + city
  if (!clean.toLowerCase().includes(city.toLowerCase())) {
    terms.push(`${clean} ${city}`)
  }

  // 3. For hotels, try without common prefixes
  if (type === 'hotel') {
    terms.push(clean.replace(/^(the|hotel|le|la)\s+/i, ''))
    terms.push(`${clean} hotel`)
  }

  // 4. For restaurants with specific names, try name alone
  if (type === 'restaurant') {
    terms.push(`${clean} restaurant`)
    terms.push(`${clean} restaurant ${city}`)
  }

  return terms
}

// ─── Curated overrides for items that Wikipedia won't match well ───
// Maps item name patterns to good Wikipedia search terms
const OVERRIDES = {
  // Activities with generic names
  'desert safari': 'Desert safari',
  'dhow cruise': 'Dhow',
  'hot air balloon': 'Hot air ballooning',
  'river rafting': 'Rafting',
  'mountain biking': 'Mountain biking',
  'scuba diving': 'Scuba diving',
  'snorkeling': 'Snorkeling',
  'island hopping': 'Island hopping',
  'water villa yoga': 'Overwater bungalow',
  'fishing trip': 'Sport fishing',
  'sandbank picnic': 'Sandbank',
  'coral reef': 'Coral reef',
  'block printing': 'Block printing in India',
  'elephant village': 'Elephant sanctuary',
  'cooking class': 'Cooking school',
  'horse riding': 'Horse riding',
  'muay thai': 'Muay Thai',
  'skydiving': 'Skydiving',
  'night safari': 'Night Safari, Singapore',
  'food tour': 'Street food',
  'hawker centre': 'Hawker centre',
  'vintage shopping': 'Vintage clothing',
  // Hotels with just a type/style
  'zostel': 'Zostel',
  // Maldives specifics
  'dolphin cruise': 'Spinner dolphin',
  'bioluminescent': 'Bioluminescence',
  'submarine': 'Tourist submarine',
  'overwater spa': 'Overwater bungalow',
  'manta rays': 'Manta ray',
  'male city': 'Malé',
}

function getOverride(name) {
  const lower = name.toLowerCase()
  for (const [pattern, term] of Object.entries(OVERRIDES)) {
    if (lower.includes(pattern)) return term
  }
  return null
}

// ─── Main ───

async function main() {
  console.log(`Image Backfill via Wikipedia ${DRY_RUN ? '(DRY RUN)' : ''}`)
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

      // Find items with no images at all
      const needImages = items.filter(i => {
        const hasImage = i.image_url && i.image_url.length > 10
        const hasPhotos = i.metadata && i.metadata.photos && i.metadata.photos.length > 0
        return !hasImage && !hasPhotos
      })

      if (needImages.length === 0) continue
      console.log(`  ${type}s: ${needImages.length} need images`)

      for (const item of needImages) {
        const override = getOverride(item.name)
        const searchTerms = override ? [override] : getSearchTerms(item.name, dest.city, type)

        let result = null
        for (const term of searchTerms) {
          const candidate = await getWikiImage(term)
          await sleep(1000) // rate limit: ~1 req/sec (Wikipedia limits to ~200/min)

          if (candidate) {
            // Check relevance (override terms always pass)
            if (override || isRelevantMatch(item.name, candidate.title, type)) {
              result = candidate
              break
            }
          }
        }

        // Fallback: use a destination-level generic image
        if (!result) {
          const fallbackTerm = type === 'hotel'
            ? `${dest.city} hotel`
            : type === 'restaurant'
              ? `${dest.city} cuisine food`
              : `${dest.city} tourism`
          result = await getWikiImage(fallbackTerm)
          await sleep(300)
          // For fallbacks, mark as generic
          if (result) result.generic = true
        }

        if (DRY_RUN) {
          const tag = result ? (result.generic ? '~' : '✓') : '✗'
          console.log(`    ${tag} ${item.name}${result ? ' → ' + result.title + (result.generic ? ' (generic)' : '') : ''} (search: ${override || searchTerms[0]})`)
          continue
        }

        if (!result) {
          console.log(`    ✗ ${item.name}`)
          skipped++
          continue
        }

        const meta = item.metadata || {}
        await supabasePatch(table, `id=eq.${item.id}`, {
          image_url: result.url,
          metadata: { ...meta, photos: [result.url], imageSource: 'wikipedia', wikiTitle: result.title }
        })
        updated++
        console.log(`    ✓ ${item.name} → ${result.title}`)
        await sleep(200)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`DONE! Updated: ${updated}, Skipped: ${skipped}`)
}

main().catch(err => { console.error(err); process.exit(1) })
