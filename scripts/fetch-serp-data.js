#!/usr/bin/env node
// Fetch SerpAPI data for a destination and dump it as JSON
// Usage: node scripts/fetch-serp-data.js "Dubai" "UAE"

const fs = require('fs')
const envFile = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && !k.startsWith('#')) envVars[k.trim()] = v.join('=').trim()
})

const SERPAPI_KEY = envVars.SERPAPI_KEY || process.env.SERPAPI_KEY
if (!SERPAPI_KEY) { console.error('No SERPAPI_KEY'); process.exit(1) }

const city = process.argv[2] || 'Dubai'
const country = process.argv[3] || 'UAE'

async function searchGoogle(query, engine = 'google_maps') {
  const params = new URLSearchParams({
    api_key: SERPAPI_KEY,
    engine,
    q: query,
    type: 'search',
    ll: '@0,0,14z', // Will be overridden by query
  })

  if (engine === 'google_maps') {
    params.set('q', query)
    params.delete('ll')
  }

  const url = `https://serpapi.com/search?${params}`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`SerpAPI error: ${res.status} ${res.statusText}`)
    return null
  }
  return res.json()
}

async function main() {
  console.log(`\n=== Fetching data for ${city}, ${country} ===\n`)

  // Hotels
  console.log('--- Hotels ---')
  const hotelData = await searchGoogle(`best hotels in ${city} ${country}`)
  const hotels = (hotelData?.local_results || []).map(r => ({
    name: r.title,
    rating: r.rating,
    reviews: r.reviews,
    price: r.price,
    type: r.type,
    address: r.address,
    thumbnail: r.thumbnail,
  }))
  console.log(`Found ${hotels.length} hotels`)
  hotels.forEach(h => console.log(`  ${h.name} — ${h.rating}★ (${h.reviews} reviews) ${h.price || ''}`))

  // Attractions
  console.log('\n--- Attractions ---')
  const attrData = await searchGoogle(`top attractions in ${city} ${country}`)
  const attractions = (attrData?.local_results || []).map(r => ({
    name: r.title,
    rating: r.rating,
    reviews: r.reviews,
    type: r.type,
    address: r.address,
    thumbnail: r.thumbnail,
  }))
  console.log(`Found ${attractions.length} attractions`)
  attractions.forEach(a => console.log(`  ${a.name} — ${a.rating}★ (${a.reviews} reviews) [${a.type}]`))

  // Restaurants
  console.log('\n--- Restaurants ---')
  const restData = await searchGoogle(`best restaurants in ${city} ${country}`)
  const restaurants = (restData?.local_results || []).map(r => ({
    name: r.title,
    rating: r.rating,
    reviews: r.reviews,
    price: r.price,
    type: r.type,
    address: r.address,
    thumbnail: r.thumbnail,
  }))
  console.log(`Found ${restaurants.length} restaurants`)
  restaurants.forEach(r => console.log(`  ${r.name} — ${r.rating}★ (${r.reviews} reviews) ${r.price || ''} [${r.type}]`))

  // Save full dump
  const dump = { city, country, hotels, attractions, restaurants }
  const fs = require('fs')
  const outFile = `scripts/serp-${city.toLowerCase()}.json`
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2))
  console.log(`\nSaved to ${outFile}`)

  // SerpAPI credits check
  console.log(`\nUsed 3 SerpAPI searches. Check remaining at serpapi.com/dashboard`)
}

main().catch(console.error)
