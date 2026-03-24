#!/usr/bin/env node
// QA validation for catalog data files before seeding to Supabase
// Usage: node scripts/test-catalog-data.js

const fs = require('fs')

const VALID_HOTEL_CAT = ['hotel', 'resort', 'hostel', 'villa', 'boutique']
const VALID_ACTIVITY_CAT = ['sightseeing', 'adventure', 'cultural', 'nightlife', 'wellness', 'nature', 'food_tour', 'water_sport', 'shopping', 'event']
const VALID_PRICE_LEVEL = ['budget', 'mid', 'luxury']
const VALID_TEMPLATE_CAT = ['day', 'hotel', 'activity', 'food', 'flight']

const path = require('path')
const CITIES = ['dubai', 'singapore', 'tokyo', 'paris', 'maldives', 'jaipur', 'manali']

let totalTests = 0
let passed = 0
let failed = 0
const failures = []

function assert(test, msg) {
  totalTests++
  if (test) { passed++ }
  else { failed++; failures.push(msg) }
}

function assertType(val, type, msg) {
  assert(typeof val === type, `${msg} — expected ${type}, got ${typeof val}`)
}

function assertArray(val, msg) {
  assert(Array.isArray(val), `${msg} — expected array, got ${typeof val}`)
}

function assertNonEmpty(val, msg) {
  assert(val && (typeof val === 'string' ? val.trim().length > 0 : true), `${msg} — empty or missing`)
}

function assertIncludes(arr, val, msg) {
  assert(arr.includes(val), `${msg} — "${val}" not in [${arr.join(', ')}]`)
}

// ============ DESTINATION TESTS ============
function testDest(city, d) {
  const prefix = `[${city}] dest`
  assertNonEmpty(d.city, `${prefix}.city`)
  assertNonEmpty(d.country, `${prefix}.country`)
  assertNonEmpty(d.description, `${prefix}.description`)
  assert(d.description.length >= 50, `${prefix}.description too short (${d.description.length} chars, need 50+)`)
  assertArray(d.vibes, `${prefix}.vibes`)
  assert(d.vibes.length >= 3, `${prefix}.vibes needs 3+ (got ${d.vibes.length})`)
  assertArray(d.best_months, `${prefix}.best_months`)
  assert(d.best_months.length >= 2, `${prefix}.best_months needs 2+ (got ${d.best_months.length})`)
  assert(d.avg_budget_per_day && d.avg_budget_per_day.budget, `${prefix}.avg_budget_per_day.budget missing`)
  assert(d.avg_budget_per_day && d.avg_budget_per_day.mid, `${prefix}.avg_budget_per_day.mid missing`)
  assert(d.avg_budget_per_day && d.avg_budget_per_day.luxury, `${prefix}.avg_budget_per_day.luxury missing`)
  assert(d.avg_budget_per_day.budget < d.avg_budget_per_day.mid, `${prefix} budget should be < mid`)
  assert(d.avg_budget_per_day.mid < d.avg_budget_per_day.luxury, `${prefix} mid should be < luxury`)
  assertNonEmpty(d.currency, `${prefix}.currency`)
  assertNonEmpty(d.language, `${prefix}.language`)
  assertNonEmpty(d.timezone, `${prefix}.timezone`)
}

// ============ HOTEL TESTS ============
function testHotels(city, hotels) {
  const prefix = `[${city}] hotels`
  assert(hotels.length >= 8, `${prefix} count: need 8+, got ${hotels.length}`)

  // Check budget diversity
  const priceLevels = new Set(hotels.map(h => h.price_level))
  assert(priceLevels.has('budget'), `${prefix} missing budget tier`)
  assert(priceLevels.has('mid'), `${prefix} missing mid tier`)
  assert(priceLevels.has('luxury'), `${prefix} missing luxury tier`)

  // Check for duplicates
  const names = hotels.map(h => h.name.toLowerCase())
  const uniqueNames = new Set(names)
  assert(uniqueNames.size === names.length, `${prefix} has duplicate names`)

  hotels.forEach((h, i) => {
    const hp = `${prefix}[${i}] "${h.name}"`
    assertNonEmpty(h.name, `${hp}.name`)
    assertNonEmpty(h.description, `${hp}.description`)
    assert(h.description.length >= 20, `${hp}.description too short`)
    assertNonEmpty(h.detail, `${hp}.detail`)
    assert(h.detail.length >= 30, `${hp}.detail too short`)
    assertIncludes(VALID_HOTEL_CAT, h.category, `${hp}.category`)
    assertNonEmpty(h.price_per_night, `${hp}.price_per_night`)
    assertIncludes(VALID_PRICE_LEVEL, h.price_level, `${hp}.price_level`)
    assert(typeof h.rating === 'number' && h.rating >= 1 && h.rating <= 5, `${hp}.rating invalid (${h.rating})`)
    assertArray(h.vibes, `${hp}.vibes`)
    assert(h.vibes.length >= 2, `${hp}.vibes needs 2+ (got ${h.vibes.length})`)
    assertArray(h.amenities, `${hp}.amenities`)
    assert(h.amenities.length >= 3, `${hp}.amenities needs 3+`)
    assertArray(h.best_for, `${hp}.best_for`)
    assertArray(h.features, `${hp}.features`)
    assertArray(h.practical_tips, `${hp}.practical_tips`)
    assert(h.practical_tips.length >= 1, `${hp}.practical_tips needs 1+`)
    assertNonEmpty(h.honest_take, `${hp}.honest_take`)
    assert(h.honest_take.length >= 30, `${hp}.honest_take too short`)
    assert(h.review_synthesis && h.review_synthesis.positive, `${hp}.review_synthesis.positive missing`)
    assert(h.review_synthesis && h.review_synthesis.negative, `${hp}.review_synthesis.negative missing`)
    assert(h.review_synthesis && h.review_synthesis.summary, `${hp}.review_synthesis.summary missing`)
    assertArray(h.info, `${hp}.info`)
    assertNonEmpty(h.location, `${hp}.location`)
  })
}

// ============ ACTIVITY TESTS ============
function testActivities(city, activities) {
  const prefix = `[${city}] activities`
  assert(activities.length >= 10, `${prefix} count: need 10+, got ${activities.length}`)

  // Check category diversity (at least 3 different categories)
  const cats = new Set(activities.map(a => a.category))
  assert(cats.size >= 3, `${prefix} needs 3+ categories, got ${cats.size}: ${[...cats].join(', ')}`)

  // Check for free activities
  const hasFree = activities.some(a => a.price && a.price.toLowerCase().includes('free'))
  assert(hasFree, `${prefix} should have at least one free activity`)

  // Check for duplicates
  const names = activities.map(a => a.name.toLowerCase())
  const uniqueNames = new Set(names)
  assert(uniqueNames.size === names.length, `${prefix} has duplicate names`)

  activities.forEach((a, i) => {
    const ap = `${prefix}[${i}] "${a.name}"`
    assertNonEmpty(a.name, `${ap}.name`)
    assertNonEmpty(a.description, `${ap}.description`)
    assert(a.description.length >= 20, `${ap}.description too short`)
    assertNonEmpty(a.detail, `${ap}.detail`)
    assert(a.detail.length >= 30, `${ap}.detail too short`)
    assertIncludes(VALID_ACTIVITY_CAT, a.category, `${ap}.category`)
    assertNonEmpty(a.price, `${ap}.price`)
    assertNonEmpty(a.duration, `${ap}.duration`)
    assertArray(a.vibes, `${ap}.vibes`)
    assert(a.vibes.length >= 2, `${ap}.vibes needs 2+`)
    assertNonEmpty(a.best_time, `${ap}.best_time`)
    assertArray(a.best_for, `${ap}.best_for`)
    assertArray(a.features, `${ap}.features`)
    assertArray(a.practical_tips, `${ap}.practical_tips`)
    assert(a.practical_tips.length >= 1, `${ap}.practical_tips needs 1+`)
    assertNonEmpty(a.honest_take, `${ap}.honest_take`)
    assert(a.honest_take.length >= 30, `${ap}.honest_take too short`)
    assert(a.review_synthesis && a.review_synthesis.positive, `${ap}.review_synthesis.positive missing`)
    assert(a.review_synthesis && a.review_synthesis.negative, `${ap}.review_synthesis.negative missing`)
    assertNonEmpty(a.location, `${ap}.location`)
  })
}

// ============ RESTAURANT TESTS ============
function testRestaurants(city, restaurants) {
  const prefix = `[${city}] restaurants`
  assert(restaurants.length >= 6, `${prefix} count: need 6+, got ${restaurants.length}`)

  // Check price diversity
  const priceLevels = new Set(restaurants.map(r => r.price_level))
  assert(priceLevels.has('budget'), `${prefix} missing budget tier`)
  assert(priceLevels.has('mid') || priceLevels.has('luxury'), `${prefix} needs mid or luxury tier`)

  // Check cuisine diversity (at least 3 different cuisines)
  const cuisines = new Set(restaurants.map(r => (r.cuisine || '').toLowerCase()))
  assert(cuisines.size >= 3, `${prefix} needs 3+ cuisines, got ${cuisines.size}`)

  // Check for duplicates
  const names = restaurants.map(r => r.name.toLowerCase())
  const uniqueNames = new Set(names)
  assert(uniqueNames.size === names.length, `${prefix} has duplicate names`)

  restaurants.forEach((r, i) => {
    const rp = `${prefix}[${i}] "${r.name}"`
    assertNonEmpty(r.name, `${rp}.name`)
    assertNonEmpty(r.description, `${rp}.description`)
    assert(r.description.length >= 20, `${rp}.description too short`)
    assertNonEmpty(r.detail, `${rp}.detail`)
    assertNonEmpty(r.cuisine, `${rp}.cuisine`)
    assertIncludes(VALID_PRICE_LEVEL, r.price_level, `${rp}.price_level`)
    assertNonEmpty(r.avg_cost, `${rp}.avg_cost`)
    assertArray(r.vibes, `${rp}.vibes`)
    assert(r.vibes.length >= 2, `${rp}.vibes needs 2+`)
    assertArray(r.must_try, `${rp}.must_try`)
    assert(r.must_try.length >= 2, `${rp}.must_try needs 2+`)
    assertArray(r.best_for, `${rp}.best_for`)
    assertArray(r.practical_tips, `${rp}.practical_tips`)
    assertNonEmpty(r.honest_take, `${rp}.honest_take`)
    assert(r.review_synthesis && r.review_synthesis.positive, `${rp}.review_synthesis.positive missing`)
    assertNonEmpty(r.location, `${rp}.location`)
    assertArray(r.dietary, `${rp}.dietary`)
  })
}

// ============ TEMPLATE TESTS ============
function testTemplates(city, templates) {
  const prefix = `[${city}] templates`
  assert(templates.length === 3, `${prefix} need exactly 3 templates, got ${templates.length}`)

  const budgetLevels = new Set(templates.map(t => t.budget_level))
  assert(budgetLevels.has('budget'), `${prefix} missing budget template`)
  assert(budgetLevels.has('mid'), `${prefix} missing mid template`)
  assert(budgetLevels.has('luxury'), `${prefix} missing luxury template`)

  templates.forEach((t, ti) => {
    const tp = `${prefix}[${ti}] "${t.name}"`
    assertNonEmpty(t.name, `${tp}.name`)
    assertArray(t.vibes, `${tp}.vibes`)
    assert(t.vibes.length >= 2, `${tp}.vibes needs 2+`)
    assertIncludes(VALID_PRICE_LEVEL, t.budget_level, `${tp}.budget_level`)
    assert(t.duration_days === 5, `${tp}.duration_days should be 5, got ${t.duration_days}`)
    assertArray(t.items, `${tp}.items`)
    assert(t.items.length >= 10, `${tp}.items needs 10+ items, got ${t.items.length}`)

    // Check items structure
    let dayCount = 0
    let hasHotel = false
    let hasFood = false
    let hasActivity = false

    t.items.forEach((item, ii) => {
      const ip = `${tp}.items[${ii}]`
      assertIncludes(VALID_TEMPLATE_CAT, item.category, `${ip}.category`)
      assertNonEmpty(item.name, `${ip}.name`)

      if (item.category === 'day') {
        dayCount++
        assert(item.day >= 1 && item.day <= 5, `${ip}.day out of range: ${item.day}`)
      } else {
        assertNonEmpty(item.detail, `${ip}.detail`)
        assertNonEmpty(item.description, `${ip}.description`)
        if (item.category !== 'day') {
          assertNonEmpty(item.price, `${ip}.price`)
          assertNonEmpty(item.time, `${ip}.time`)
        }
        if (item.metadata) {
          assertNonEmpty(item.metadata.reason, `${ip}.metadata.reason`)
          assertArray(item.metadata.whyFactors, `${ip}.metadata.whyFactors`)
          assert(item.metadata.whyFactors.length >= 2, `${ip}.metadata.whyFactors needs 2+`)
        }
      }

      if (item.category === 'hotel') hasHotel = true
      if (item.category === 'food') hasFood = true
      if (item.category === 'activity') hasActivity = true
    })

    assert(dayCount === 5, `${tp} needs 5 day markers, got ${dayCount}`)
    assert(hasHotel, `${tp} missing hotel item`)
    assert(hasFood, `${tp} missing food item`)
    assert(hasActivity, `${tp} missing activity item`)
  })
}

// ============ CROSS-REFERENCE TESTS ============
// Template items must reference names that exist in the catalog for enrichment to work
function testCrossRef(city, data) {
  const prefix = `[${city}] xref`
  const hotelNames = new Set(data.hotels.map(h => h.name.toLowerCase()))
  const activityNames = new Set(data.activities.map(a => a.name.toLowerCase()))
  const restaurantNames = new Set(data.restaurants.map(r => r.name.toLowerCase()))

  data.templates.forEach((t, ti) => {
    t.items.forEach((item, ii) => {
      if (item.category === 'day' || item.category === 'flight') return
      const itemName = item.name.toLowerCase()
      const tp = `${prefix} template[${ti}].items[${ii}] "${item.name}"`

      if (item.category === 'hotel') {
        assert(hotelNames.has(itemName), `${tp} — hotel not in catalog`)
      } else if (item.category === 'activity') {
        assert(activityNames.has(itemName), `${tp} — activity not in catalog`)
      } else if (item.category === 'food') {
        assert(restaurantNames.has(itemName), `${tp} — restaurant not in catalog`)
      }
    })
  })
}

// ============ RUN ALL TESTS ============
console.log('🧪 Catalog Data QA Tests\n')

for (const city of CITIES) {
  const filePath = path.join(__dirname, 'data', `${city}.js`)
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP ${city} — file missing`)
    continue
  }

  console.log(`  Testing ${city}...`)
  try {
    // Clear require cache for re-runs
    delete require.cache[require.resolve(filePath)]
    const data = require(filePath)

    assert(data.dest, `[${city}] dest missing`)
    assert(data.hotels, `[${city}] hotels missing`)
    assert(data.activities, `[${city}] activities missing`)
    assert(data.restaurants, `[${city}] restaurants missing`)
    assert(data.templates, `[${city}] templates missing`)

    if (data.dest) testDest(city, data.dest)
    if (data.hotels) testHotels(city, data.hotels)
    if (data.activities) testActivities(city, data.activities)
    if (data.restaurants) testRestaurants(city, data.restaurants)
    if (data.templates) testTemplates(city, data.templates)
    if (data.templates && data.hotels && data.activities && data.restaurants) testCrossRef(city, data)
  } catch (e) {
    failed++
    failures.push(`[${city}] LOAD ERROR: ${e.message}`)
  }
}

// ============ REPORT ============
console.log(`\n${'='.repeat(50)}`)
console.log(`Tests: ${totalTests} total, ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(50)}`)

if (failures.length > 0) {
  console.log('\nFailures:')
  failures.forEach(f => console.log(`  ✗ ${f}`))
  process.exit(1)
} else {
  console.log('\n  All tests passed!')
  process.exit(0)
}
