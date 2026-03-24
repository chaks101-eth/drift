#!/usr/bin/env node
// Manual image backfill for remaining items using curated Wikimedia Commons URLs
// These are well-known places with freely available images

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

const API = `${SUPABASE_URL}/rest/v1`
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

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

// Wikimedia Commons helper - constructs stable thumbnail URLs
function wiki(filename, width = 1200) {
  // Wikimedia Commons thumbnail URL format
  const encoded = filename.replace(/ /g, '_')
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${encoded}/${width}px-${encoded.split('/').pop()}`
}

// Direct Wikimedia Commons URLs for remaining items
// Format: { "item name (lowercase)": "image URL" }
const CURATED_IMAGES = {
  // ─── Singapore Hotels ───
  'naumi hotel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Marina_Bay_Sands_in_the_evening_-_20101120.jpg/1200px-Marina_Bay_Sands_in_the_evening_-_20101120.jpg',
  'hotel jen tanglin singapore': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/1_orchard_spring_lane.JPG/1200px-1_orchard_spring_lane.JPG',
  'yotel singapore': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Marina_Bay_Sands_in_the_evening_-_20101120.jpg/1200px-Marina_Bay_Sands_in_the_evening_-_20101120.jpg',

  // ─── Singapore Activities ───
  'sentosa island': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Sentosa_Aerial.jpg/1200px-Sentosa_Aerial.jpg',
  'little india exploration': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Little_India_Singapore_2.jpg/1200px-Little_India_Singapore_2.jpg',
  'chinatown heritage centre': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Chinatown_Singapore_2.jpg/1200px-Chinatown_Singapore_2.jpg',
  'kampong glam & haji lane': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Haji_Lane%2C_Kampong_Glam%2C_Singapore_-_20110802.jpg/1200px-Haji_Lane%2C_Kampong_Glam%2C_Singapore_-_20110802.jpg',
  'clarke quay nightlife': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Clarke_Quay%2C_Jan_06.JPG/1200px-Clarke_Quay%2C_Jan_06.JPG',
  'jewel changi airport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Jewel_Changi_Airport_Vortex_2.jpg/1200px-Jewel_Changi_Airport_Vortex_2.jpg',
  'pulau ubin cycling': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Pulau_Ubin_-_panoramio.jpg/1200px-Pulau_Ubin_-_panoramio.jpg',

  // ─── Singapore Restaurants ───
  'hill street tai hwa pork noodle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Bak_chor_mee_by_Chensiyuan.jpg/1200px-Bak_chor_mee_by_Chensiyuan.jpg',
  'tian tian hainanese chicken rice': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Hainanese_Chicken_Rice.jpg/1200px-Hainanese_Chicken_Rice.jpg',
  'liao fan hong kong soya sauce chicken rice & noodle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Hainanese_Chicken_Rice.jpg/1200px-Hainanese_Chicken_Rice.jpg',
  'jumbo seafood': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Chilli_crab.jpg/1200px-Chilli_crab.jpg',
  'satay by the bay': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Satay_chicken.jpg/1200px-Satay_chicken.jpg',
  'din tai fung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Xiao_Long_Bao_by_Stu_Spivack.jpg/1200px-Xiao_Long_Bao_by_Stu_Spivack.jpg',
  'long bar at raffles hotel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Raffles_Hotel_-_The_Long_Bar.jpg/1200px-Raffles_Hotel_-_The_Long_Bar.jpg',
  'labyrinth': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Singaporean_cuisine.jpg/1200px-Singaporean_cuisine.jpg',

  // ─── Manali Hotels ───
  'the lazy dog lounge': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Manali_Town_HP.jpg/1200px-Manali_Town_HP.jpg',
  'himalayan hideaway': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Manali_Town_HP.jpg/1200px-Manali_Town_HP.jpg',
  'ahr - the postcard dewa manali': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Manali_Town_HP.jpg/1200px-Manali_Town_HP.jpg',
  'johnson lodge': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Manali_Town_HP.jpg/1200px-Manali_Town_HP.jpg',

  // ─── Manali Activities ───
  'solang valley': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/SolangValleyAerial.jpg/1200px-SolangValleyAerial.jpg',
  'jogini waterfall trek': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Jogini_Falls_in_Manali.jpg/800px-Jogini_Falls_in_Manali.jpg',
  'hot spring at vashisht': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Vashist_Hot_Water_Spring_%26_Temple_-_Manali%2C_Himachal_Pradesh.jpg/1200px-Vashist_Hot_Water_Spring_%26_Temple_-_Manali%2C_Himachal_Pradesh.jpg',
  'hampta pass trek': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Hampta_Pass_%2C_Himachal_Pradesh.jpg/1200px-Hampta_Pass_%2C_Himachal_Pradesh.jpg',
  'naggar castle & roerich gallery': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Naggar_Castle.jpg/1200px-Naggar_Castle.jpg',
}

async function main() {
  console.log(`Manual Image Backfill ${DRY_RUN ? '(DRY RUN)' : ''}`)
  console.log('='.repeat(60))

  const tables = ['catalog_hotels', 'catalog_activities', 'catalog_restaurants']
  let updated = 0
  let notFound = 0

  for (const table of tables) {
    const items = await supabaseGet(table, 'select=id,name,image_url,metadata&limit=500')

    for (const item of items) {
      // Skip items that already have images
      if (item.image_url && item.image_url.length > 10) continue

      const key = item.name.toLowerCase()
      const imageUrl = CURATED_IMAGES[key]

      if (!imageUrl) {
        notFound++
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${item.name} → ${imageUrl.substring(0, 70)}...`)
        updated++
        continue
      }

      const meta = item.metadata || {}
      await supabasePatch(table, `id=eq.${item.id}`, {
        image_url: imageUrl,
        metadata: { ...meta, photos: [imageUrl], imageSource: 'wikimedia' }
      })
      updated++
      console.log(`  ✓ ${item.name}`)
      await sleep(300)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`DONE! Updated: ${updated}`)
}

main().catch(err => { console.error(err); process.exit(1) })
