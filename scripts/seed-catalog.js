#!/usr/bin/env node
// Seed catalog data into Supabase — reads SerpAPI JSON + enriches with curated data
// Usage: node scripts/seed-catalog.js [city] or node scripts/seed-catalog.js --all

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
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase credentials'); process.exit(1) }

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function supabasePost(table, rows) {
  const res = await fetch(`${API}/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`${table} insert failed: ${res.status} ${txt}`)
  }
  return res.json()
}

async function supabaseGet(table, filter) {
  const res = await fetch(`${API}/${table}?${filter}`, { headers })
  if (!res.ok) throw new Error(`${table} get failed: ${res.status}`)
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
    throw new Error(`${table} patch failed: ${res.status} ${txt}`)
  }
  return res.json()
}

async function supabaseDelete(table, filter) {
  const res = await fetch(`${API}/${table}?${filter}`, {
    method: 'DELETE',
    headers
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`${table} delete failed: ${res.status} ${txt}`)
  }
}

// Upsizes Google thumbnail URLs to larger images
function upsizeThumb(url) {
  if (!url) return null
  return url.replace(/=w\d+-h\d+/, '=w800-h600').replace(/-k-no$/, '-k-no')
}

// ============================================================
// DESTINATION DATA — each file exports enrichment for one city
// ============================================================

const DESTINATIONS = {
  dubai: require('./data/dubai'),
  singapore: require('./data/singapore'),
  maldives: require('./data/maldives'),
  tokyo: require('./data/tokyo'),
  paris: require('./data/paris'),
  jaipur: require('./data/jaipur'),
  manali: require('./data/manali'),
}

async function seedDestination(cityKey) {
  const data = DESTINATIONS[cityKey]
  if (!data) { console.error(`Unknown city: ${cityKey}`); return }

  // Read SerpAPI raw data
  const serpFile = `scripts/serp-${cityKey}.json`
  let serp = { hotels: [], attractions: [], restaurants: [] }
  if (fs.existsSync(serpFile)) {
    serp = JSON.parse(fs.readFileSync(serpFile, 'utf8'))
  }

  console.log(`\n=== Seeding ${data.dest.city}, ${data.dest.country} ===`)

  // 1. Upsert destination (check if exists first due to unique constraint)
  console.log('  → destination...')
  const destData = {
    vibes: data.dest.vibes,
    description: data.dest.description,
    cover_image: data.dest.cover_image,
    best_months: data.dest.best_months,
    avg_budget_per_day: data.dest.avg_budget_per_day,
    currency: data.dest.currency,
    language: data.dest.language,
    timezone: data.dest.timezone,
    status: 'active',
    pipeline_run_at: new Date().toISOString()
  }
  const existing = await supabaseGet('catalog_destinations', `city=ilike.${encodeURIComponent(data.dest.city)}&country=ilike.${encodeURIComponent(data.dest.country)}`)
  let destId
  if (existing.length > 0) {
    const [updated] = await supabasePatch('catalog_destinations', `id=eq.${existing[0].id}`, destData)
    destId = updated.id
    console.log(`    updated existing: ${destId}`)
  } else {
    const [created] = await supabasePost('catalog_destinations', [{ city: data.dest.city, country: data.dest.country, ...destData }])
    destId = created.id
    console.log(`    created: ${destId}`)
  }

  // 2. Clear existing catalog items for this destination
  console.log('  → clearing old data...')
  await supabaseDelete('catalog_templates', `destination_id=eq.${destId}`)
  await supabaseDelete('catalog_hotels', `destination_id=eq.${destId}`)
  await supabaseDelete('catalog_activities', `destination_id=eq.${destId}`)
  await supabaseDelete('catalog_restaurants', `destination_id=eq.${destId}`)

  // 3. Insert hotels
  console.log(`  → ${data.hotels.length} hotels...`)
  const hotelRows = data.hotels.map(h => {
    const serpMatch = serp.hotels.find(s => s.name && h.name && (
      s.name.toLowerCase().includes(h.name.toLowerCase().split(' ').slice(0,2).join(' ')) ||
      h.name.toLowerCase().includes(s.name.toLowerCase().split(' ').slice(0,2).join(' '))
    ))
    return {
      destination_id: destId,
      name: h.name,
      description: h.description,
      detail: h.detail,
      category: h.category || 'hotel',
      price_per_night: h.price_per_night,
      price_level: h.price_level,
      rating: h.rating,
      vibes: h.vibes,
      amenities: h.amenities,
      image_url: upsizeThumb(serpMatch?.thumbnail) || h.image_url || null,
      location: serpMatch?.address || h.location,
      source: serpMatch ? 'serpapi+ai' : 'ai',
      metadata: {
        reviewCount: serpMatch?.reviews || h.reviewCount || 0,
        photos: [upsizeThumb(serpMatch?.thumbnail)].filter(Boolean),
        review_synthesis: h.review_synthesis || {},
        practical_tips: h.practical_tips || [],
        honest_take: h.honest_take || '',
        best_for: h.best_for || [],
        pairs_with: h.pairs_with || [],
        features: h.features || [],
        info: h.info || []
      }
    }
  })
  await supabasePost('catalog_hotels', hotelRows)

  // 4. Insert activities
  console.log(`  → ${data.activities.length} activities...`)
  const actRows = data.activities.map(a => {
    const serpMatch = serp.attractions.find(s => s.name && a.name && (
      s.name.toLowerCase().includes(a.name.toLowerCase().split(' ').slice(0,2).join(' ')) ||
      a.name.toLowerCase().includes(s.name.toLowerCase().split(' ').slice(0,2).join(' '))
    ))
    return {
      destination_id: destId,
      name: a.name,
      description: a.description,
      detail: a.detail,
      category: a.category,
      price: a.price,
      duration: a.duration,
      vibes: a.vibes,
      best_time: a.best_time,
      image_url: upsizeThumb(serpMatch?.thumbnail) || a.image_url || null,
      location: serpMatch?.address || a.location,
      source: serpMatch ? 'serpapi+ai' : 'ai',
      metadata: {
        reviewCount: serpMatch?.reviews || a.reviewCount || 0,
        photos: [upsizeThumb(serpMatch?.thumbnail)].filter(Boolean),
        review_synthesis: a.review_synthesis || {},
        practical_tips: a.practical_tips || [],
        honest_take: a.honest_take || '',
        best_for: a.best_for || [],
        pairs_with: a.pairs_with || [],
        features: a.features || [],
        info: a.info || []
      }
    }
  })
  await supabasePost('catalog_activities', actRows)

  // 5. Insert restaurants
  console.log(`  → ${data.restaurants.length} restaurants...`)
  const restRows = data.restaurants.map(r => {
    const serpMatch = serp.restaurants.find(s => s.name && r.name && (
      s.name.toLowerCase().includes(r.name.toLowerCase().split(' ').slice(0,2).join(' ')) ||
      r.name.toLowerCase().includes(s.name.toLowerCase().split(' ').slice(0,2).join(' '))
    ))
    return {
      destination_id: destId,
      name: r.name,
      description: r.description,
      detail: r.detail,
      cuisine: r.cuisine,
      price_level: r.price_level,
      avg_cost: r.avg_cost,
      vibes: r.vibes,
      must_try: r.must_try,
      image_url: upsizeThumb(serpMatch?.thumbnail) || r.image_url || null,
      location: serpMatch?.address || r.location,
      source: serpMatch ? 'serpapi+ai' : 'ai',
      metadata: {
        rating: serpMatch?.rating || r.rating || 0,
        reviewCount: serpMatch?.reviews || r.reviewCount || 0,
        photos: [upsizeThumb(serpMatch?.thumbnail)].filter(Boolean),
        review_synthesis: r.review_synthesis || {},
        practical_tips: r.practical_tips || [],
        honest_take: r.honest_take || '',
        best_for: r.best_for || [],
        pairs_with: r.pairs_with || [],
        dietary: r.dietary || [],
        features: r.features || [],
        info: r.info || []
      }
    }
  })
  await supabasePost('catalog_restaurants', restRows)

  // 6. Insert templates (3 budget levels)
  console.log(`  → ${data.templates.length} templates...`)
  const tplRows = data.templates.map(t => ({
    destination_id: destId,
    name: t.name,
    vibes: t.vibes,
    budget_level: t.budget_level,
    duration_days: t.duration_days || 5,
    items: t.items
  }))
  await supabasePost('catalog_templates', tplRows)

  console.log(`  ✓ ${data.dest.city} seeded!`)
}

async function main() {
  const arg = process.argv[2]
  if (arg === '--all') {
    for (const key of Object.keys(DESTINATIONS)) {
      await seedDestination(key)
    }
  } else if (arg) {
    await seedDestination(arg.toLowerCase())
  } else {
    console.log('Usage: node scripts/seed-catalog.js [dubai|singapore|...] or --all')
    console.log('Available:', Object.keys(DESTINATIONS).join(', '))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
