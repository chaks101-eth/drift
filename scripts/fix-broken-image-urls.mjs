#!/usr/bin/env node
// ─── Backfill bad image_urls in itinerary_items ────────────────────────────
//
// Targets THREE patterns that all need a fresh Google Places lookup:
//
//   1. maps.googleapis.com/maps/api/place/photo (legacy redirect URLs that
//      embed our API key — Google rejects them from client referrers and the
//      browser onError handler used to fall back to identical stock photos)
//   2. places.googleapis.com/v1/places/.../photos/.../media (new Places API v1
//      URLs whose photo references go stale — Google returns INVALID_ARGUMENT
//      when hit again, so they 404 in the browser)
//   3. images.unsplash.com (stock fallbacks injected by the now-removed
//      getItemImage() server-side fallback — not broken, but not real photos
//      of the place — and the user wants real photos only)
//
// For each: re-do a Find Place lookup by `name, destination` → resolve photo
// redirect → store the stable googleusercontent.com URL. If recovery fails,
// store '' so the editorial PlaceholderImage renders instead of a stock photo
// or broken loader.
//
// Usage:
//   node scripts/fix-broken-image-urls.mjs            (dry run — shows counts)
//   node scripts/fix-broken-image-urls.mjs --write    (actually applies changes)
//   node scripts/fix-broken-image-urls.mjs --write --limit 50  (test on a subset)
//
// Cost (Google Places):
//   Find Place: $17 / 1000 requests
//   Photo:      $7 / 1000 (returns a redirect; CDN delivery is free)
//   ~2,200 items at ~$0.024 each = ~$53 worst case.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? parseInt(args[LIMIT_IDX + 1], 10) : Infinity;

const env = Object.fromEntries(
  readFileSync('/Users/mac/Desktop/drift/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const PLACES_KEY = env.GOOGLE_PLACES_API_KEY;

if (!PLACES_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY in .env.local');
  process.exit(1);
}

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (msg) => console.log(`[${stamp()}] ${msg}`);

// ─── Find items that need fixing (paginated — Supabase caps at 1000 per query) ───
log(`Mode: ${WRITE ? 'WRITE (will modify DB)' : 'DRY RUN (no writes)'}`);
log('Querying itinerary_items with bad image_url…');

// Three patterns covered:
//   1. maps.googleapis.com (legacy, embeds API key)
//   2. places.googleapis.com/v1 (new API format, photo refs go stale)
//   3. images.unsplash.com (stock placeholder, not a real photo of the place)
// Supabase `or()` filter handles the union in one paginated query.
const BAD_FILTER = 'image_url.like.*maps.googleapis.com/maps/api/place/photo*,image_url.like.*places.googleapis.com/v1*,image_url.like.*images.unsplash.com*';
const PAGE_SIZE = 1000;
const brokenItems = [];
let offset = 0;
while (true) {
  const { data, error } = await sb
    .from('itinerary_items')
    .select('id, name, category, image_url, trip_id')
    .in('category', ['hotel', 'activity', 'food'])
    .or(BAD_FILTER)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  if (!data?.length) break;
  brokenItems.push(...data);
  if (data.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}

if (!brokenItems?.length) {
  log('No broken image_urls found. Nothing to do.');
  process.exit(0);
}

log(`Found ${brokenItems.length} items needing fix.`);

// Group by category + URL kind for the report
const byCategory = brokenItems.reduce((acc, it) => {
  acc[it.category] = (acc[it.category] || 0) + 1;
  return acc;
}, {});
log('By category: ' + Object.entries(byCategory).map(([k, v]) => `${k}=${v}`).join(', '));

const urlKind = (url) => {
  if (!url) return 'empty';
  if (url.includes('maps.googleapis.com')) return 'legacy maps';
  if (url.includes('places.googleapis.com/v1')) return 'places v1';
  if (url.includes('images.unsplash.com')) return 'unsplash stock';
  return 'other';
};
const byKind = brokenItems.reduce((acc, it) => {
  const k = urlKind(it.image_url);
  acc[k] = (acc[k] || 0) + 1;
  return acc;
}, {});
log('By URL kind:  ' + Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(', '));

// ─── Pull trip destinations (needed for Google Places lookup) ───────────
const tripIds = [...new Set(brokenItems.map(i => i.trip_id))];
log(`Spans ${tripIds.length} trips. Loading destinations…`);

const { data: trips, error: tripErr } = await sb
  .from('trips')
  .select('id, destination, country')
  .in('id', tripIds);

if (tripErr) {
  console.error('Trip query failed:', tripErr.message);
  process.exit(1);
}

const tripMeta = new Map(trips.map(t => [t.id, { destination: t.destination, country: t.country }]));

// ─── Re-fetch logic ─────────────────────────────────────────────────────
async function fetchRealPhoto(placeName, city, country) {
  try {
    const q = encodeURIComponent(`${placeName}, ${city}${country ? ', ' + country : ''}`);
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=photos&key=${PLACES_KEY}`;
    const findRes = await fetch(findUrl);
    if (!findRes.ok) return null;
    const findData = await findRes.json();
    if (findData.status !== 'OK' || !findData.candidates?.[0]?.photos?.length) return null;

    const photoRef = findData.candidates[0].photos[0].photo_reference;
    const apiPhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${PLACES_KEY}`;
    const photoRes = await fetch(apiPhotoUrl, { redirect: 'manual' });
    const location = photoRes.headers.get('location');
    // Only accept stable googleusercontent CDN URLs — never the raw API URL.
    return (location && location.includes('googleusercontent.com')) ? location : null;
  } catch {
    return null;
  }
}

// ─── Process in parallel batches ────────────────────────────────────────
const limited = brokenItems.slice(0, LIMIT);
const BATCH_SIZE = 8;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let recovered = 0;     // items that got a fresh real photo
let nulled = 0;        // items where we gave up and cleared image_url
let skipped = 0;       // items with no destination context
let updateErrors = 0;

log(`Processing ${limited.length} item(s) in batches of ${BATCH_SIZE}…`);
const startTs = Date.now();

for (let i = 0; i < limited.length; i += BATCH_SIZE) {
  const batch = limited.slice(i, i + BATCH_SIZE);

  const results = await Promise.all(batch.map(async (item) => {
    const trip = tripMeta.get(item.trip_id);
    if (!trip?.destination) {
      return { item, action: 'skip', newUrl: null, reason: 'no destination' };
    }
    // Only re-fetch for categories where a real photo is meaningful.
    // Flights / transfers / day separators don't need photos.
    const photoCategories = new Set(['hotel', 'activity', 'food']);
    if (!photoCategories.has(item.category)) {
      return { item, action: 'null', newUrl: '', reason: `category ${item.category}` };
    }
    const real = await fetchRealPhoto(item.name, trip.destination, trip.country);
    if (real) return { item, action: 'recover', newUrl: real };
    return { item, action: 'null', newUrl: '', reason: 'fetch returned no photo' };
  }));

  if (WRITE) {
    await Promise.all(results.map(async (r) => {
      const { error } = await sb
        .from('itinerary_items')
        .update({ image_url: r.newUrl })
        .eq('id', r.item.id);
      if (error) {
        updateErrors++;
        console.error(`  UPDATE FAIL id=${r.item.id} (${r.item.name}): ${error.message}`);
      }
    }));
  }

  for (const r of results) {
    if (r.action === 'recover') recovered++;
    else if (r.action === 'null') nulled++;
    else if (r.action === 'skip') skipped++;
  }

  const done = Math.min(i + BATCH_SIZE, limited.length);
  log(`  ${done}/${limited.length}  (recovered=${recovered}  nulled=${nulled}  skipped=${skipped})`);

  // Be polite to Google
  if (i + BATCH_SIZE < limited.length) await sleep(120);
}

const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

console.log('');
console.log('─────────────────────────────────────────────');
console.log(` Done in ${elapsed}s${WRITE ? '' : ' (DRY RUN — no writes)'}`);
console.log('─────────────────────────────────────────────');
console.log(`  Real photos recovered:  ${recovered}`);
console.log(`  Cleared (→ placeholder): ${nulled}`);
console.log(`  Skipped (no dest):       ${skipped}`);
if (updateErrors > 0) console.log(`  Update errors:           ${updateErrors}`);
console.log('');
if (!WRITE) {
  console.log(' Re-run with --write to apply changes.');
  console.log('');
}
