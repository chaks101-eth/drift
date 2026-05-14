#!/usr/bin/env node
// One-shot cleanup after the partial populate run:
// 1. Reset destinations that are stuck in 'processing' but have full data → 'active'
// 2. Reset Chennai (no items, killed mid-flight) → 'draft' so it can be re-populated
// 3. Backfill price_level for items from the partial run that have wrong tier labels.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('/Users/mac/Desktop/drift/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Mirror of deriveTier logic from populate-destinations.mjs
const HOTEL_THRESHOLDS_PER_NIGHT = {
  INR: [4000, 15000],   USD: [100, 300],     EUR: [100, 300],     THB: [2500, 7000],
  IDR: [1500000, 4500000], LKR: [15000, 40000], VND: [2000000, 6000000], AED: [400, 1200],
  JPY: [12000, 35000],  SGD: [180, 500],     CHF: [220, 600],     LAK: [800000, 2500000],
  MYR: [300, 900],      PHP: [5000, 15000],  MMK: [50000, 150000],
};
const RESTAURANT_THRESHOLDS_PER_PERSON = {
  INR: [400, 1500],     USD: [15, 50],       EUR: [15, 50],       THB: [200, 800],
  IDR: [80000, 400000], LKR: [1500, 5000],   VND: [150000, 600000], AED: [50, 200],
  JPY: [1500, 6000],    SGD: [20, 80],       CHF: [25, 90],       LAK: [50000, 200000],
  MYR: [25, 100],       PHP: [400, 1500],    MMK: [5000, 20000],
};
const LUXURY_BRAND_RE = /(ritz[- ]?carlton|aman|four seasons|st\.?\s*regis|park hyatt|bvlgari|raffles|mandarin oriental|peninsula|burj al arab|atlantis|the leela|taj exotica|oberoi|umaid bhawan|rambagh palace|six senses|alila|conrad|edition|capella|rosewood|chedi|cheval blanc|soneva|anantara|kempinski|w hotel| trump | aman[a-z]+|jumeirah|raj palace|raj vilas|chanakya|the imperial|the lalit|itc grand|leela palace)/i;
const BUDGET_NAME_RE = /(hostel|hosteller|backpackers?|guest\s*house|guesthouse|dorm|inn\b|lodge\b|homestay|home stay|paying guest|pg\b|airbnb)/i;
const LUXURY_NAME_RE = /(palace\b|resort & spa|grand hyatt|grand hotel|7\s*star|seven star|villa\b.*private|penthouse|royal suite)/i;

function parsePrice(s) {
  if (!s) return null;
  const m = String(s).replace(/[, ]/g, '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function deriveTier(item, category, currency) {
  if (category === 'hotel') {
    if (LUXURY_BRAND_RE.test(item.name)) return 'luxury';
    if (BUDGET_NAME_RE.test(item.name)) return 'budget';
    if (LUXURY_NAME_RE.test(item.name)) return 'luxury';
  }
  const t = category === 'hotel' ? HOTEL_THRESHOLDS_PER_NIGHT[currency]
          : category === 'restaurant' ? RESTAURANT_THRESHOLDS_PER_PERSON[currency]
          : null;
  const priceField = category === 'hotel' ? item.price_per_night : item.avg_cost;
  const price = parsePrice(priceField);
  if (t && price && price > 0) {
    if (price < t[0]) return 'budget';
    if (price > t[1]) return 'luxury';
    return 'mid';
  }
  return item.price_level || 'mid';
}

// ─── 1. Cleanup destinations ─────────────────────────────────────
console.log('═══ STEP 1: Cleanup destination statuses ═══');
const { data: dests } = await sb.from('catalog_destinations').select('id,city,country,status,currency').order('city');

const processingDests = dests.filter(d => d.status === 'processing');
let resetActive = 0, resetDraft = 0;
for (const d of processingDests) {
  const { count } = await sb.from('catalog_hotels').select('*', { count: 'exact', head: true })
    .eq('destination_id', d.id).eq('status', 'active');
  if (count >= 8) {
    await sb.from('catalog_destinations').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', d.id);
    console.log(`  ✓ ${d.city} → active (${count} hotels)`);
    resetActive++;
  } else {
    await sb.from('catalog_destinations').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', d.id);
    console.log(`  ⟳ ${d.city} → draft (only ${count} hotels — needs re-populate)`);
    resetDraft++;
  }
}
console.log(`Reset: ${resetActive} → active, ${resetDraft} → draft\n`);

// ─── 2. Backfill price_level for recent new destinations ─────────
console.log('═══ STEP 2: Retier hotels + restaurants for partial-run destinations ═══');
// Find destinations populated from this script — their items have wrong tier labels
const { data: gpDests } = await sb.from('catalog_destinations').select('id,city,currency').eq('status', 'active');
let hotelsUpdated = 0, restosUpdated = 0;
for (const d of gpDests) {
  // Only retier items from the new google-places+gemini source
  const { data: hotels } = await sb.from('catalog_hotels').select('id,name,price_per_night,price_level,metadata')
    .eq('destination_id', d.id).eq('status', 'active').eq('source', 'google-places+gemini');
  let hUpdated = 0;
  for (const h of (hotels || [])) {
    const newTier = deriveTier(h, 'hotel', d.currency);
    if (newTier && newTier !== h.price_level) {
      await sb.from('catalog_hotels').update({ price_level: newTier }).eq('id', h.id);
      hUpdated++;
    }
  }
  const { data: restos } = await sb.from('catalog_restaurants').select('id,name,avg_cost,price_level,metadata')
    .eq('destination_id', d.id).eq('status', 'active').eq('source', 'google-places+gemini');
  let rUpdated = 0;
  for (const r of (restos || [])) {
    const newTier = deriveTier(r, 'restaurant', d.currency);
    if (newTier && newTier !== r.price_level) {
      await sb.from('catalog_restaurants').update({ price_level: newTier }).eq('id', r.id);
      rUpdated++;
    }
  }
  if (hUpdated + rUpdated > 0) {
    console.log(`  ✓ ${d.city.padEnd(20)} retiered ${hUpdated}H + ${rUpdated}R`);
  }
  hotelsUpdated += hUpdated;
  restosUpdated += rUpdated;
}
console.log(`Total retiered: ${hotelsUpdated} hotels, ${restosUpdated} restaurants\n`);

// ─── 3. Summary ─────────────────────────────────────────────────
console.log('═══ FINAL STATE ═══');
const { data: final } = await sb.from('catalog_destinations').select('city,status').order('city');
const byStatus = final.reduce((m, d) => { (m[d.status] || (m[d.status] = [])).push(d.city); return m; }, {});
for (const s of Object.keys(byStatus).sort()) {
  console.log(`  ${s}: ${byStatus[s].length}`);
}
