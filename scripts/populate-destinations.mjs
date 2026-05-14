#!/usr/bin/env node
// Generalized destination populator using:
//   1. Google Places API (New)  — discovery + structured truth
//   2. Gemini 2.5 Flash w/ Google Search grounding — honest_take + practical_tips
//   3. Multi-vendor offer URLs across 6–10 aggregators per item
//
// Soft-deletes existing rows on re-run (status='inactive') so the
// re-populate is reversible. New rows land as status='active'.
//
// Usage:
//   node scripts/populate-destinations.mjs              # populate all targets in TARGETS list
//   node scripts/populate-destinations.mjs --tag drafts # only drafts
//   node scripts/populate-destinations.mjs --tag v1     # only v1 thin destinations
//   node scripts/populate-destinations.mjs colombo      # filter to a single city substring
//   node scripts/populate-destinations.mjs --dry-run    # show plan, do nothing

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// ─── env ──────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('/Users/mac/Desktop/drift/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')]; })
);
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PLACES_KEY = env.GOOGLE_PLACES_API_KEY;
const GEMINI_KEY = env.GEMINI_API_KEY;
if (!SB_URL || !SB_KEY || !PLACES_KEY || !GEMINI_KEY) { console.error('missing env'); process.exit(1); }
const sb = createClient(SB_URL, SB_KEY);

const DRY_RUN = process.argv.includes('--dry-run');
const tagIdx = process.argv.indexOf('--tag');
const TAG = tagIdx > 0 ? process.argv[tagIdx + 1] : null;
const positional = process.argv.slice(2).find(a => !a.startsWith('--') && (tagIdx < 0 || (process.argv.indexOf(a) !== tagIdx + 1)));
const CITY_FILTER = positional?.toLowerCase();

// ─── Destinations ─────────────────────────────────────────────
// Tagged: 'drafts' (empty) or 'v1' (existing thin catalogs)
const TARGETS = [
  // Drafts — empty, need first populate
  { city: 'Colombo',           country: 'Sri Lanka', vibes: ['beach','colonial','culture','food'],          best_months: ['Jan','Feb','Mar','Apr','Nov','Dec'], currency: 'LKR', tag: 'drafts' },
  { city: 'Delhi',             country: 'India',     vibes: ['heritage','food','culture','urban'],          best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'drafts' },
  { city: 'Ho Chi Minh City',  country: 'Vietnam',   vibes: ['food','nightlife','culture','urban'],         best_months: ['Dec','Jan','Feb','Mar','Apr'],       currency: 'VND', tag: 'drafts' },
  { city: 'Kochi',             country: 'India',     vibes: ['backwaters','colonial','food','culture'],     best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'drafts' },
  { city: 'Leh',               country: 'India',     vibes: ['high-altitude','monasteries','adventure','remote'], best_months: ['May','Jun','Jul','Aug','Sep'], currency: 'INR', tag: 'drafts' },
  { city: 'Mumbai',            country: 'India',     vibes: ['urban','food','nightlife','culture'],         best_months: ['Oct','Nov','Dec','Jan','Feb'],        currency: 'INR', tag: 'drafts' },
  { city: 'Port Blair',        country: 'India',     vibes: ['beach','island','snorkeling','remote'],       best_months: ['Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'INR', tag: 'drafts' },
  { city: 'Rishikesh',         country: 'India',     vibes: ['yoga','spiritual','river','adventure'],       best_months: ['Sep','Oct','Nov','Mar','Apr','May'], currency: 'INR', tag: 'drafts' },
  { city: 'Udaipur',           country: 'India',     vibes: ['lakes','romantic','heritage','palaces'],      best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'drafts' },
  { city: 'Varanasi',          country: 'India',     vibes: ['spiritual','river','heritage','culture'],     best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'drafts' },
  { city: 'Zurich',            country: 'Switzerland', vibes: ['mountains','lakes','luxury','urban'],       best_months: ['May','Jun','Jul','Aug','Sep'],        currency: 'CHF', tag: 'drafts' },
  // v1 — thin SerpAPI-era catalogs, re-populate for HP-level depth + multi-vendor
  { city: 'Bali',     country: 'Indonesia', vibes: ['beach','yoga','romantic','culture'],   best_months: ['Apr','May','Jun','Jul','Aug','Sep'], currency: 'IDR', tag: 'v1' },
  { city: 'Bangkok',  country: 'Thailand',  vibes: ['food','nightlife','urban','culture'],   best_months: ['Nov','Dec','Jan','Feb'],            currency: 'THB', tag: 'v1' },
  { city: 'Dubai',    country: 'UAE',       vibes: ['luxury','shopping','beach','urban'],    best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'AED', tag: 'v1' },
  { city: 'Jaipur',   country: 'India',     vibes: ['heritage','palaces','culture','romantic'], best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'v1' },
  { city: 'Manali',   country: 'India',     vibes: ['mountains','adventure','snow','romantic'], best_months: ['Mar','Apr','May','Jun','Oct','Nov'], currency: 'INR', tag: 'v1' },
  { city: 'Maldives', country: 'Maldives',  vibes: ['beach','luxury','romantic','snorkeling'], best_months: ['Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'USD', tag: 'v1' },
  { city: 'Paris',    country: 'France',    vibes: ['romantic','culture','food','luxury'],   best_months: ['Apr','May','Jun','Sep','Oct'],      currency: 'EUR', tag: 'v1' },
  { city: 'Pattaya',  country: 'Thailand',  vibes: ['beach','nightlife','party','budget'],   best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'v1' },
  { city: 'Phuket',   country: 'Thailand',  vibes: ['beach','party','island','snorkeling'],  best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'v1' },
  { city: 'Singapore', country: 'Singapore', vibes: ['urban','food','shopping','culture'],   best_months: ['Feb','Mar','Apr','Jul','Aug'],      currency: 'SGD', tag: 'v1' },
  { city: 'Tokyo',    country: 'Japan',     vibes: ['urban','food','culture','shopping'],    best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'JPY', tag: 'v1' },

  // ─── India: T1+T2+T3 expansion (~40) ─────────────────────────
  { city: 'Agra',         country: 'India', vibes: ['heritage','romantic','culture','iconic'],         best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Goa',          country: 'India', vibes: ['beach','party','portuguese','relaxed'],          best_months: ['Nov','Dec','Jan','Feb','Mar'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Bangalore',    country: 'India', vibes: ['urban','food','nightlife','tech'],               best_months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Hyderabad',    country: 'India', vibes: ['heritage','food','urban','culture'],             best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Chennai',      country: 'India', vibes: ['culture','food','beach','urban'],                best_months: ['Nov','Dec','Jan','Feb'],             currency: 'INR', tag: 'expand-in' },
  { city: 'Kolkata',      country: 'India', vibes: ['culture','food','colonial','arts'],              best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Darjeeling',   country: 'India', vibes: ['mountains','tea','colonial','romantic'],         best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Munnar',       country: 'India', vibes: ['tea','mountains','romantic','nature'],           best_months: ['Sep','Oct','Nov','Dec','Jan','Feb'], currency: 'INR', tag: 'expand-in' },
  { city: 'Alleppey',     country: 'India', vibes: ['backwaters','romantic','boats','nature'],        best_months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Jodhpur',      country: 'India', vibes: ['heritage','desert','palaces','blue-city'],       best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Jaisalmer',    country: 'India', vibes: ['desert','heritage','golden-city','camping'],     best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Pushkar',      country: 'India', vibes: ['spiritual','desert','bohemian','lake'],          best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Bikaner',      country: 'India', vibes: ['desert','heritage','palaces','sweets'],          best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Khajuraho',    country: 'India', vibes: ['heritage','temples','sculpture','unesco'],       best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Amritsar',     country: 'India', vibes: ['spiritual','food','sikh-heritage','culture'],    best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Mussoorie',    country: 'India', vibes: ['mountains','colonial','romantic','cool'],         best_months: ['Mar','Apr','May','Jun','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Nainital',     country: 'India', vibes: ['lakes','mountains','romantic','family'],         best_months: ['Mar','Apr','May','Jun','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Auli',         country: 'India', vibes: ['skiing','mountains','snow','adventure'],         best_months: ['Dec','Jan','Feb','Mar'],             currency: 'INR', tag: 'expand-in' },
  { city: 'Gangtok',      country: 'India', vibes: ['mountains','buddhist','adventure','cuisine'],     best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Pelling',      country: 'India', vibes: ['mountains','buddhist','quiet','views'],          best_months: ['Mar','Apr','May','Oct','Nov'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Shillong',     country: 'India', vibes: ['waterfalls','indie-music','rolling-hills','culture'], best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Hampi',        country: 'India', vibes: ['heritage','ruins','unesco','bohemian'],          best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Mysore',       country: 'India', vibes: ['palaces','heritage','silk','royal'],             best_months: ['Sep','Oct','Nov','Dec','Jan','Feb'], currency: 'INR', tag: 'expand-in' },
  { city: 'Coorg',        country: 'India', vibes: ['coffee','mountains','romantic','nature'],        best_months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Ooty',         country: 'India', vibes: ['mountains','tea','colonial','toy-train'],        best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Pondicherry',  country: 'India', vibes: ['french','beach','spiritual','colonial'],         best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Mahabalipuram', country: 'India', vibes: ['heritage','beach','unesco','sculpture'],         best_months: ['Nov','Dec','Jan','Feb'],             currency: 'INR', tag: 'expand-in' },
  { city: 'Madurai',      country: 'India', vibes: ['temples','culture','spiritual','heritage'],      best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Wayanad',      country: 'India', vibes: ['nature','wildlife','plantations','adventure'],   best_months: ['Sep','Oct','Nov','Dec','Jan','Feb'], currency: 'INR', tag: 'expand-in' },
  { city: 'Gokarna',      country: 'India', vibes: ['beach','spiritual','quiet','backpacker'],        best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Pune',         country: 'India', vibes: ['urban','tech','food','culture'],                 best_months: ['Sep','Oct','Nov','Dec','Jan','Feb'], currency: 'INR', tag: 'expand-in' },
  { city: 'Lonavala',     country: 'India', vibes: ['mountains','monsoon','romantic','weekend'],      best_months: ['Jun','Jul','Aug','Sep','Oct','Nov'], currency: 'INR', tag: 'expand-in' },
  { city: 'Mahabaleshwar', country: 'India', vibes: ['strawberries','mountains','romantic','views'],   best_months: ['Oct','Nov','Dec','Jan','Feb','Mar'], currency: 'INR', tag: 'expand-in' },
  { city: 'Ahmedabad',    country: 'India', vibes: ['heritage','food','textile','unesco'],            best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Ranthambore',  country: 'India', vibes: ['wildlife','tigers','safari','jungle'],           best_months: ['Oct','Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'INR', tag: 'expand-in' },
  { city: 'Jim Corbett',  country: 'India', vibes: ['wildlife','tigers','safari','jungle'],           best_months: ['Nov','Dec','Jan','Feb','Mar','Apr','May'], currency: 'INR', tag: 'expand-in' },
  { city: 'Havelock',     country: 'India', vibes: ['beach','diving','island','snorkeling'],          best_months: ['Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'INR', tag: 'expand-in' },
  { city: 'Lakshadweep',  country: 'India', vibes: ['beach','island','diving','luxury'],              best_months: ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'], currency: 'INR', tag: 'expand-in' },
  { city: 'Bhubaneswar',  country: 'India', vibes: ['temples','heritage','sculpture','culture'],      best_months: ['Oct','Nov','Dec','Jan','Feb'],       currency: 'INR', tag: 'expand-in' },
  { city: 'Pangong Tso',  country: 'India', vibes: ['high-altitude','lake','remote','iconic'],        best_months: ['May','Jun','Jul','Aug','Sep'],       currency: 'INR', tag: 'expand-in' },

  // ─── Southeast Asia: T1+T2+T3 expansion (~45) ─────────────────
  // Thailand
  { city: 'Chiang Mai',   country: 'Thailand', vibes: ['culture','temples','food','digital-nomad'],   best_months: ['Nov','Dec','Jan','Feb'],            currency: 'THB', tag: 'expand-sea' },
  { city: 'Chiang Rai',   country: 'Thailand', vibes: ['temples','quiet','culture','nature'],         best_months: ['Nov','Dec','Jan','Feb'],            currency: 'THB', tag: 'expand-sea' },
  { city: 'Krabi',        country: 'Thailand', vibes: ['beach','climbing','islands','nature'],        best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'expand-sea' },
  { city: 'Koh Samui',    country: 'Thailand', vibes: ['beach','luxury','island','party'],            best_months: ['Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'], currency: 'THB', tag: 'expand-sea' },
  { city: 'Koh Phi Phi',  country: 'Thailand', vibes: ['beach','party','diving','island'],            best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'expand-sea' },
  { city: 'Pai',          country: 'Thailand', vibes: ['bohemian','mountains','hippie','laidback'],   best_months: ['Nov','Dec','Jan','Feb'],            currency: 'THB', tag: 'expand-sea' },
  { city: 'Ko Lanta',     country: 'Thailand', vibes: ['beach','quiet','diving','family'],            best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'expand-sea' },
  { city: 'Hua Hin',      country: 'Thailand', vibes: ['beach','royal','golf','family'],              best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'THB', tag: 'expand-sea' },
  // Vietnam
  { city: 'Hanoi',           country: 'Vietnam', vibes: ['heritage','food','culture','urban'],         best_months: ['Oct','Nov','Dec','Mar','Apr'],      currency: 'VND', tag: 'expand-sea' },
  { city: 'Hoi An',          country: 'Vietnam', vibes: ['lanterns','heritage','romantic','unesco'],   best_months: ['Feb','Mar','Apr','May','Jun','Jul'], currency: 'VND', tag: 'expand-sea' },
  { city: 'Da Nang',         country: 'Vietnam', vibes: ['beach','urban','food','bridges'],            best_months: ['Feb','Mar','Apr','May'],            currency: 'VND', tag: 'expand-sea' },
  { city: 'Ha Long Bay',     country: 'Vietnam', vibes: ['cruise','iconic','karst','romantic'],        best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'VND', tag: 'expand-sea' },
  { city: 'Sapa',            country: 'Vietnam', vibes: ['mountains','trekking','ethnic','terraces'],  best_months: ['Mar','Apr','May','Sep','Oct','Nov'], currency: 'VND', tag: 'expand-sea' },
  { city: 'Phu Quoc',        country: 'Vietnam', vibes: ['beach','luxury','island','snorkeling'],      best_months: ['Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'VND', tag: 'expand-sea' },
  { city: 'Ninh Binh',       country: 'Vietnam', vibes: ['karst','rural','iconic','river'],            best_months: ['Feb','Mar','Apr','May','Sep','Oct'], currency: 'VND', tag: 'expand-sea' },
  { city: 'Dalat',           country: 'Vietnam', vibes: ['mountains','french','flowers','romantic'],   best_months: ['Dec','Jan','Feb','Mar'],            currency: 'VND', tag: 'expand-sea' },
  { city: 'Nha Trang',       country: 'Vietnam', vibes: ['beach','diving','urban','seafood'],          best_months: ['Feb','Mar','Apr','May','Jun','Jul'], currency: 'VND', tag: 'expand-sea' },
  // Cambodia
  { city: 'Siem Reap',  country: 'Cambodia', vibes: ['heritage','temples','unesco','iconic'],          best_months: ['Nov','Dec','Jan','Feb'],            currency: 'USD', tag: 'expand-sea' },
  { city: 'Phnom Penh', country: 'Cambodia', vibes: ['heritage','urban','river','culture'],            best_months: ['Nov','Dec','Jan','Feb'],            currency: 'USD', tag: 'expand-sea' },
  { city: 'Battambang', country: 'Cambodia', vibes: ['rural','art','quiet','bamboo-train'],            best_months: ['Nov','Dec','Jan','Feb'],            currency: 'USD', tag: 'expand-sea' },
  { city: 'Koh Rong',   country: 'Cambodia', vibes: ['beach','island','remote','party'],                best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'USD', tag: 'expand-sea' },
  // Laos
  { city: 'Luang Prabang', country: 'Laos', vibes: ['unesco','temples','river','quiet'],               best_months: ['Nov','Dec','Jan','Feb'],            currency: 'LAK', tag: 'expand-sea' },
  { city: 'Vang Vieng',    country: 'Laos', vibes: ['karst','river','adventure','backpacker'],          best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'LAK', tag: 'expand-sea' },
  { city: 'Vientiane',     country: 'Laos', vibes: ['urban','french','temples','river'],                best_months: ['Nov','Dec','Jan','Feb'],            currency: 'LAK', tag: 'expand-sea' },
  // Malaysia
  { city: 'Kuala Lumpur',     country: 'Malaysia', vibes: ['urban','food','shopping','culture'],        best_months: ['Feb','Mar','Apr','May','Jun','Jul','Aug'], currency: 'MYR', tag: 'expand-sea' },
  { city: 'Penang',           country: 'Malaysia', vibes: ['food','heritage','street-art','unesco'],    best_months: ['Dec','Jan','Feb','Mar'],            currency: 'MYR', tag: 'expand-sea' },
  { city: 'Langkawi',         country: 'Malaysia', vibes: ['beach','island','duty-free','family'],      best_months: ['Nov','Dec','Jan','Feb','Mar'],      currency: 'MYR', tag: 'expand-sea' },
  { city: 'Malacca',          country: 'Malaysia', vibes: ['heritage','unesco','colonial','food'],      best_months: ['Feb','Mar','Apr','May','Jun','Jul'], currency: 'MYR', tag: 'expand-sea' },
  { city: 'Cameron Highlands', country: 'Malaysia', vibes: ['tea','mountains','cool','strawberries'],   best_months: ['Mar','Apr','May','Jun','Jul','Aug','Sep'], currency: 'MYR', tag: 'expand-sea' },
  { city: 'Kota Kinabalu',    country: 'Malaysia', vibes: ['island','diving','mountains','borneo'],     best_months: ['Mar','Apr','May','Jun','Jul','Aug','Sep'], currency: 'MYR', tag: 'expand-sea' },
  // Indonesia
  { city: 'Yogyakarta', country: 'Indonesia', vibes: ['heritage','temples','culture','batik'],          best_months: ['May','Jun','Jul','Aug','Sep'],      currency: 'IDR', tag: 'expand-sea' },
  { city: 'Lombok',     country: 'Indonesia', vibes: ['beach','quiet','surf','volcanoes'],              best_months: ['May','Jun','Jul','Aug','Sep'],      currency: 'IDR', tag: 'expand-sea' },
  { city: 'Ubud',       country: 'Indonesia', vibes: ['yoga','jungle','spiritual','arts'],              best_months: ['Apr','May','Jun','Jul','Aug','Sep'], currency: 'IDR', tag: 'expand-sea' },
  { city: 'Komodo',     country: 'Indonesia', vibes: ['islands','diving','dragons','remote'],           best_months: ['Apr','May','Jun','Jul','Aug','Sep'], currency: 'IDR', tag: 'expand-sea' },
  { city: 'Jakarta',    country: 'Indonesia', vibes: ['urban','food','shopping','nightlife'],           best_months: ['May','Jun','Jul','Aug','Sep'],      currency: 'IDR', tag: 'expand-sea' },
  { city: 'Gili Trawangan', country: 'Indonesia', vibes: ['beach','party','diving','island'],           best_months: ['Apr','May','Jun','Jul','Aug','Sep'], currency: 'IDR', tag: 'expand-sea' },
  // Philippines
  { city: 'Manila',     country: 'Philippines', vibes: ['urban','food','heritage','nightlife'],         best_months: ['Dec','Jan','Feb','Mar','Apr'],      currency: 'PHP', tag: 'expand-sea' },
  { city: 'Cebu',       country: 'Philippines', vibes: ['beach','diving','heritage','whale-sharks'],    best_months: ['Dec','Jan','Feb','Mar','Apr','May'], currency: 'PHP', tag: 'expand-sea' },
  { city: 'Palawan',    country: 'Philippines', vibes: ['island','beach','lagoons','iconic'],           best_months: ['Dec','Jan','Feb','Mar','Apr','May'], currency: 'PHP', tag: 'expand-sea' },
  { city: 'El Nido',    country: 'Philippines', vibes: ['lagoons','beach','island-hopping','iconic'],   best_months: ['Dec','Jan','Feb','Mar','Apr','May'], currency: 'PHP', tag: 'expand-sea' },
  { city: 'Boracay',    country: 'Philippines', vibes: ['beach','party','white-sand','romantic'],       best_months: ['Nov','Dec','Jan','Feb','Mar','Apr'], currency: 'PHP', tag: 'expand-sea' },
  { city: 'Bohol',      country: 'Philippines', vibes: ['nature','beach','chocolate-hills','tarsier'],  best_months: ['Mar','Apr','May'],                  currency: 'PHP', tag: 'expand-sea' },
  { city: 'Siargao',    country: 'Philippines', vibes: ['surf','beach','remote','laidback'],            best_months: ['Mar','Apr','May','Jun','Jul','Aug','Sep'], currency: 'PHP', tag: 'expand-sea' },
  // Myanmar
  { city: 'Bagan',  country: 'Myanmar', vibes: ['heritage','temples','iconic','balloon'],               best_months: ['Nov','Dec','Jan','Feb'],            currency: 'MMK', tag: 'expand-sea' },
  { city: 'Yangon', country: 'Myanmar', vibes: ['heritage','urban','colonial','culture'],               best_months: ['Nov','Dec','Jan','Feb'],            currency: 'MMK', tag: 'expand-sea' },
];

// ─── Google Places API (New) ──────────────────────────────────
const PLACES_URL = 'https://places.googleapis.com/v1';

async function placesSearch(query, maxResults = 10) {
  const res = await fetch(`${PLACES_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.rating', 'places.userRatingCount',
        'places.formattedAddress', 'places.priceLevel', 'places.photos',
        'places.primaryType', 'places.primaryTypeDisplayName',
        'places.editorialSummary', 'places.websiteUri', 'places.googleMapsUri',
        'places.location', 'places.types', 'places.regularOpeningHours',
      ].join(','),
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: maxResults }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.warn(`  [places] ${res.status}: ${errBody.slice(0, 120)}`);
    return [];
  }
  const data = await res.json();
  return (data.places || []).map(normalizePlace);
}

function normalizePlace(p) {
  return {
    placeId: p.id,
    name: p.displayName?.text || '',
    rating: p.rating || 0,
    reviewCount: p.userRatingCount || 0,
    priceLevel: mapPriceLevel(p.priceLevel),
    address: p.formattedAddress || '',
    editorialSummary: p.editorialSummary?.text || '',
    photos: (p.photos || []).slice(0, 5).map(ph => `${PLACES_URL}/${ph.name}/media?maxWidthPx=800&key=${PLACES_KEY}`),
    types: p.types || [],
    type: p.primaryTypeDisplayName?.text || p.primaryType || '',
    website: p.websiteUri || null,
    mapsUrl: p.googleMapsUri || null,
    lat: p.location?.latitude || null,
    lng: p.location?.longitude || null,
    openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
  };
}

function mapPriceLevel(level) {
  if (!level) return null; // unknown — derive later from name + synth price
  if (['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE'].includes(level)) return 'budget';
  if (level === 'PRICE_LEVEL_MODERATE') return 'mid';
  if (['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'].includes(level)) return 'luxury';
  return null;
}

// ─── Tier derivation ──────────────────────────────────────────
// Google Places rarely returns priceLevel for hotels, so combine signals:
// 1. Explicit Google priceLevel (when present and non-mid)
// 2. Brand/name heuristics (luxury chains, hostels, homestays)
// 3. Gemini's extracted local-currency price, compared to currency-specific thresholds
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

function deriveTier(item, synth, dest, category) {
  // Signal 1: explicit non-default Google priceLevel
  if (item.priceLevel === 'budget' || item.priceLevel === 'luxury') return item.priceLevel;

  // Signal 2: name/brand heuristic
  if (category === 'hotel') {
    if (LUXURY_BRAND_RE.test(item.name)) return 'luxury';
    if (BUDGET_NAME_RE.test(item.name)) return 'budget';
    if (LUXURY_NAME_RE.test(item.name)) return 'luxury';
  }

  // Signal 3: Gemini-synthesized local price, compared to currency thresholds
  const t = category === 'hotel' ? HOTEL_THRESHOLDS_PER_NIGHT[dest.currency]
          : category === 'restaurant' ? RESTAURANT_THRESHOLDS_PER_PERSON[dest.currency]
          : null;
  const price = category === 'hotel' ? synth?.price_per_night_local
              : category === 'restaurant' ? synth?.avg_cost_local
              : null;
  if (t && typeof price === 'number' && price > 0) {
    if (price < t[0]) return 'budget';
    if (price > t[1]) return 'luxury';
    return 'mid';
  }

  // Signal 4: activities — use Google priceLevel if mapped, else mid
  return item.priceLevel || 'mid';
}

// ─── Per-category search — TIER-AWARE ─────────────────────────
// Covers ultra-luxury (7-star) down to premium-budget.
async function searchHotels(city, country) {
  const queries = [
    `7 star luxury hotels ${city}`,
    `5 star hotels ${city} ${country}`,
    `boutique hotels ${city}`,
    `best 4 star hotels ${city}`,
    `${city} luxury resorts`,
    `best mid range hotels ${city}`,
    `premium hostels ${city}`,
    `top rated homestays ${city}`,
  ];
  const all = (await Promise.all(queries.map(q => placesSearch(q, 8)))).flat();
  return dedupeByPlaceId(all);
}
async function searchActivities(city, country) {
  const queries = [
    `top attractions ${city} ${country}`,
    `must visit ${city}`,
    `${city} sightseeing`,
    `private tours ${city}`,
    `unique experiences ${city}`,
    `adventure activities ${city}`,
    `nightlife ${city}`,
    `cultural sites ${city}`,
  ];
  const all = (await Promise.all(queries.map(q => placesSearch(q, 8)))).flat();
  return dedupeByPlaceId(all);
}
async function searchRestaurants(city, country) {
  const queries = [
    `fine dining ${city} ${country}`,
    `best restaurants ${city}`,
    `michelin restaurants ${city}`,
    `local food ${city}`,
    `street food ${city}`,
    `rooftop restaurants ${city}`,
    `cafes ${city}`,
    `vegetarian restaurants ${city}`,
  ];
  const all = (await Promise.all(queries.map(q => placesSearch(q, 8)))).flat();
  return dedupeByPlaceId(all);
}

function dedupeByPlaceId(arr) {
  const seen = new Set();
  return arr.filter(p => p.placeId && !seen.has(p.placeId) && seen.add(p.placeId));
}

// Pick top across all price tiers (luxury/mid/budget) so result has full range.
// Drops the minRating bar for smaller destinations and ranks per tier.
function rankAndPick(items, n, { minRating = 3.6, minReviews = 15 } = {}) {
  const qualifying = items.filter(p => p.rating >= minRating && p.reviewCount >= minReviews);
  const score = p => p.rating * Math.log10(p.reviewCount + 1);
  const tiers = { luxury: [], mid: [], budget: [] };
  for (const p of qualifying) (tiers[p.priceLevel || 'mid'] || tiers.mid).push(p);
  for (const t of Object.keys(tiers)) tiers[t].sort((a, b) => score(b) - score(a));
  // Allocate ~40% mid, ~35% luxury, ~25% budget. Backfill if a tier is empty.
  const allocLux = Math.ceil(n * 0.35);
  const allocMid = Math.ceil(n * 0.40);
  const allocBud = Math.max(0, n - allocLux - allocMid);
  const picked = [
    ...tiers.luxury.slice(0, allocLux),
    ...tiers.mid.slice(0, allocMid),
    ...tiers.budget.slice(0, allocBud),
  ];
  // Fill to target n from any remaining qualifying items, ranked globally
  if (picked.length < n) {
    const pickedIds = new Set(picked.map(p => p.placeId));
    const extras = qualifying.filter(p => !pickedIds.has(p.placeId)).sort((a, b) => score(b) - score(a));
    picked.push(...extras.slice(0, n - picked.length));
  }
  return picked.slice(0, n);
}

// ─── Gemini grounded synthesis ────────────────────────────────
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function geminiGrounded(prompt, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 2400 },
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (i === retries) console.warn(`  [gemini] ${res.status}: ${txt.slice(0, 120)}`);
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.map(g => g.web?.uri).filter(Boolean);
      return { text, sources };
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  return null;
}

function parseJSON(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < 0) return null;
  try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); }
  catch { return null; }
}

async function synthesizeItem(item, dest, category) {
  const catNoun = category === 'hotel' ? 'hotel' : category === 'activity' ? 'attraction or activity' : 'restaurant';
  const prompt = `You are writing for a premium travel app. Synthesize a candid take on this ${catNoun} in ${dest.city}, ${dest.country}, based on real recent reviews and travel blogs (search the web).

Place: ${item.name}
Type: ${item.type}
Google rating: ${item.rating}★ from ${item.reviewCount} reviews
Address: ${item.address}
${item.editorialSummary ? `Google's editorial summary: ${item.editorialSummary}` : ''}

Return ONLY valid JSON, no markdown fences:
{
  "honest_take": "2-3 sentences. What's actually like there? What's overrated or underrated? Be specific, no marketing speak.",
  "best_for": ["2-4 traveler types like 'couples', 'solo travelers', 'photography enthusiasts'"],
  "practical_tips": ["3-4 concrete tips: when to go, what to book ahead, what to skip, local etiquette"],
  "pairs_with": ["2-3 nearby places worth combining on the same day"],
  "vibe_score": { "${(dest.vibes || []).join('": 0, "')}": 0 }
}

vibe_score: score 0-10 how well this place matches each vibe. Be ruthless — most places only strongly match 1-2 vibes.
${category === 'activity' ? 'Also include: "duration_hours": typical visit duration (number), "best_time_of_day": "morning|afternoon|evening|night"' : ''}
${category === 'restaurant' ? `Also include: "cuisine": ["specific cuisines"], "must_try": ["2-4 specific dishes worth ordering"], "avg_cost_local": typical per-person spend in ${dest.currency} (number)` : ''}
${category === 'hotel' ? `Also include: "price_per_night_local": typical nightly rate in ${dest.currency} (number), "amenities": ["3-5 standout amenities"]` : ''}`;

  let result = await geminiGrounded(prompt);
  let parsed = parseJSON(result?.text || '');
  if (!parsed) {
    const simplerPrompt = prompt + '\n\nIMPORTANT: Output ONLY the JSON object. Do not add any prose, explanations, or markdown fences. Start with { and end with }.';
    result = await geminiGrounded(simplerPrompt);
    parsed = parseJSON(result?.text || '');
  }
  return parsed ? { ...parsed, _sources: result?.sources || [] } : null;
}

async function synthesizeDestination(dest) {
  const prompt = `Write a candid one-paragraph overview of ${dest.city}, ${dest.country} for a premium travel app. Search the web for current information.

Cover:
- What kind of traveler genuinely loves this place
- The one thing that makes it special, written without cliches
- Best months to visit (and why)
- Typical per-day budget for a comfortable mid-range trip (in ${dest.currency})

Return ONLY valid JSON, no markdown:
{
  "description": "120-180 words. Specific, candid, no marketing fluff.",
  "best_for_traveler": ["3-4 types"],
  "avg_budget_per_day": { "budget": 1500, "mid": 4000, "luxury": 12000 },
  "best_months_reason": "one sentence why those months",
  "skip_if": "one sentence — who should NOT come here"
}`;
  const result = await geminiGrounded(prompt);
  if (!result) return null;
  return parseJSON(result.text);
}

// ─── DB writers ───────────────────────────────────────────────
async function upsertDestination(dest) {
  const { data: existing } = await sb.from('catalog_destinations')
    .select('id, status')
    .ilike('city', dest.city)
    .ilike('country', dest.country)
    .maybeSingle();
  if (existing) {
    await sb.from('catalog_destinations').update({
      status: 'processing',
      vibes: dest.vibes,
      best_months: dest.best_months,
      currency: dest.currency,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    return { id: existing.id, isNew: false };
  }
  const { data, error } = await sb.from('catalog_destinations').insert({
    city: dest.city, country: dest.country,
    vibes: dest.vibes, best_months: dest.best_months,
    currency: dest.currency,
    status: 'processing',
  }).select('id').single();
  if (error) throw error;
  return { id: data.id, isNew: true };
}

// Soft-delete existing items: marks as 'inactive' so they're invisible to read paths
// but reversible if needed. Replaces the prior hard-delete.
async function softDeleteItems(destId) {
  for (const table of ['catalog_hotels', 'catalog_activities', 'catalog_restaurants']) {
    await sb.from(table).update({ status: 'inactive' }).eq('destination_id', destId).eq('status', 'active');
  }
}

// ─── Multi-vendor offer builder (mirrors src/lib/pipeline.ts) ────
function buildVendorOffers(item, category, city, country) {
  const q = encodeURIComponent(`${item.name} ${city}`);
  const qNoCity = encodeURIComponent(item.name);
  const isIN = country.toLowerCase() === 'india';
  const mapsFallback = item.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${q}${item.placeId ? `&query_place_id=${item.placeId}` : ''}`;

  if (category === 'hotel') {
    return [
      { vendor: 'Booking.com', kind: 'aggregator', url: `https://www.booking.com/searchresults.html?ss=${q}` },
      { vendor: 'Agoda', kind: 'aggregator', url: `https://www.agoda.com/search?city=&textToSearch=${q}` },
      ...(isIN ? [
        { vendor: 'MakeMyTrip', kind: 'aggregator-in', url: `https://www.makemytrip.com/hotels/hotel-listing/?checkin=&checkout=&city=${qNoCity}&country=IN` },
        { vendor: 'Goibibo', kind: 'aggregator-in', url: `https://www.goibibo.com/hotels/hotels-in-${encodeURIComponent(city.toLowerCase())}-ct/?q=${qNoCity}` },
      ] : []),
      { vendor: 'Expedia', kind: 'aggregator', url: `https://www.expedia.com/Hotel-Search?destination=${q}` },
      { vendor: 'Hotels.com', kind: 'aggregator', url: `https://www.hotels.com/Hotel-Search?destination=${q}` },
      { vendor: 'Trivago', kind: 'meta', url: `https://www.trivago.com/?query=${q}` },
      { vendor: 'Kayak', kind: 'meta', url: `https://www.kayak.com/hotels/${q}` },
      { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
      { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
      ...(item.website ? [{ vendor: 'Direct', kind: 'direct', url: item.website }] : []),
    ];
  }
  if (category === 'activity') {
    return [
      { vendor: 'GetYourGuide', kind: 'aggregator', url: `https://www.getyourguide.com/s?q=${q}` },
      { vendor: 'Viator', kind: 'aggregator', url: `https://www.viator.com/searchResults/all?text=${q}` },
      { vendor: 'Klook', kind: 'aggregator', url: `https://www.klook.com/search/result/?keyword=${q}` },
      { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
      ...(isIN ? [
        { vendor: 'MakeMyTrip', kind: 'aggregator-in', url: `https://www.makemytrip.com/things-to-do/search?q=${qNoCity}` },
        { vendor: 'Headout', kind: 'aggregator-in', url: `https://www.headout.com/search/?query=${q}` },
      ] : []),
      { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
      ...(item.website ? [{ vendor: 'Official', kind: 'direct', url: item.website }] : []),
    ];
  }
  // restaurant
  return [
    ...(isIN ? [
      { vendor: 'Zomato', kind: 'reviews-in', url: `https://www.zomato.com/search?query=${q}` },
      { vendor: 'Swiggy Dineout', kind: 'reservations-in', url: `https://www.swiggy.com/dineout/search?query=${q}` },
      { vendor: 'EazyDiner', kind: 'reservations-in', url: `https://www.eazydiner.com/search?keyword=${q}` },
    ] : []),
    { vendor: 'Tripadvisor', kind: 'reviews', url: `https://www.tripadvisor.com/Search?q=${q}` },
    { vendor: 'Yelp', kind: 'reviews', url: `https://www.yelp.com/search?find_desc=${q}` },
    { vendor: 'OpenTable', kind: 'reservations', url: `https://www.opentable.com/s?term=${q}` },
    { vendor: 'Google Maps', kind: 'official', url: mapsFallback },
    ...(item.website ? [{ vendor: 'Official', kind: 'direct', url: item.website }] : []),
  ];
}

async function insertHotel(destId, item, synth, dest) {
  const vendors = buildVendorOffers(item, 'hotel', dest.city, dest.country);
  const primary = vendors.find(v => v.vendor === 'Booking.com') || vendors[0];
  return sb.from('catalog_hotels').upsert({
    destination_id: destId,
    place_id: item.placeId,
    name: item.name,
    description: item.editorialSummary || (synth?.honest_take?.split('.')[0] + '.'),
    detail: synth?.honest_take || item.editorialSummary || '',
    category: inferHotelCategory(item),
    price_per_night: synth?.price_per_night_local ? `${dest.currency} ${synth.price_per_night_local}` : null,
    price_level: deriveTier(item, synth, dest, 'hotel'),
    rating: item.rating,
    vibes: synth?.vibe_score ? Object.entries(synth.vibe_score).filter(([, v]) => v >= 6).map(([k]) => k) : [],
    amenities: synth?.amenities || [],
    image_url: item.photos[0] || null,
    location: item.address,
    booking_url: primary.url,
    source: 'google-places+gemini',
    status: 'active',
    metadata: {
      placeId: item.placeId,
      reviewCount: item.reviewCount,
      photos: item.photos,
      type: item.type, types: item.types,
      website: item.website, mapsUrl: item.mapsUrl,
      lat: item.lat, lng: item.lng,
      openingHours: item.openingHours,
      honest_take: synth?.honest_take,
      best_for: synth?.best_for,
      practical_tips: synth?.practical_tips,
      pairs_with: synth?.pairs_with,
      vibe_score: synth?.vibe_score,
      vendors,
      sources: synth?._sources,
    },
  }, { onConflict: "destination_id,place_id" });
}

async function insertActivity(destId, item, synth, dest) {
  const vendors = buildVendorOffers(item, 'activity', dest.city, dest.country);
  const primary = vendors.find(v => v.vendor === 'GetYourGuide') || vendors[0];
  return sb.from('catalog_activities').upsert({
    destination_id: destId,
    place_id: item.placeId,
    name: item.name,
    description: item.editorialSummary || (synth?.honest_take?.split('.')[0] + '.'),
    detail: synth?.honest_take || item.editorialSummary || '',
    category: inferActivityCategory(item),
    price: (() => { const t = deriveTier(item, synth, dest, 'activity'); return t === 'budget' ? 'Low' : t === 'luxury' ? 'High' : 'Mid' })(),
    duration: synth?.duration_hours ? `${synth.duration_hours}h` : '2h',
    vibes: synth?.vibe_score ? Object.entries(synth.vibe_score).filter(([, v]) => v >= 6).map(([k]) => k) : [],
    best_time: synth?.best_time_of_day || 'morning',
    image_url: item.photos[0] || null,
    location: item.address,
    booking_url: primary.url,
    source: 'google-places+gemini',
    status: 'active',
    metadata: {
      placeId: item.placeId,
      rating: item.rating, reviewCount: item.reviewCount,
      photos: item.photos,
      type: item.type, types: item.types,
      website: item.website, mapsUrl: item.mapsUrl,
      lat: item.lat, lng: item.lng,
      openingHours: item.openingHours,
      honest_take: synth?.honest_take,
      best_for: synth?.best_for,
      practical_tips: synth?.practical_tips,
      pairs_with: synth?.pairs_with,
      vibe_score: synth?.vibe_score,
      vendors,
      sources: synth?._sources,
    },
  }, { onConflict: "destination_id,place_id" });
}

async function insertRestaurant(destId, item, synth, dest) {
  const vendors = buildVendorOffers(item, 'restaurant', dest.city, dest.country);
  const isIN = dest.country.toLowerCase() === 'india';
  const primary = (isIN ? vendors.find(v => v.vendor === 'Zomato') : vendors.find(v => v.vendor === 'OpenTable')) || vendors[0];
  return sb.from('catalog_restaurants').upsert({
    destination_id: destId,
    place_id: item.placeId,
    name: item.name,
    description: item.editorialSummary || (synth?.honest_take?.split('.')[0] + '.'),
    detail: synth?.honest_take || item.editorialSummary || '',
    cuisine: synth?.cuisine?.[0] || 'Local',
    price_level: deriveTier(item, synth, dest, 'restaurant'),
    avg_cost: synth?.avg_cost_local ? `${dest.currency} ${synth.avg_cost_local}` : null,
    rating: item.rating,
    vibes: synth?.vibe_score ? Object.entries(synth.vibe_score).filter(([, v]) => v >= 6).map(([k]) => k) : [],
    must_try: synth?.must_try || [],
    image_url: item.photos[0] || null,
    location: item.address,
    booking_url: primary.url,
    source: 'google-places+gemini',
    status: 'active',
    metadata: {
      placeId: item.placeId,
      reviewCount: item.reviewCount,
      photos: item.photos,
      type: item.type, types: item.types,
      website: item.website, mapsUrl: item.mapsUrl,
      lat: item.lat, lng: item.lng,
      openingHours: item.openingHours,
      honest_take: synth?.honest_take,
      best_for: synth?.best_for,
      practical_tips: synth?.practical_tips,
      pairs_with: synth?.pairs_with,
      vibe_score: synth?.vibe_score,
      cuisines: synth?.cuisine,
      vendors,
      sources: synth?._sources,
    },
  }, { onConflict: "destination_id,place_id" });
}

function inferHotelCategory(item) {
  const t = (item.type + ' ' + (item.types || []).join(' ')).toLowerCase();
  if (t.includes('resort')) return 'resort';
  if (t.includes('hostel') || t.includes('guest')) return 'hostel';
  if (t.includes('homestay') || t.includes('boutique')) return 'boutique';
  if (t.includes('villa')) return 'villa';
  return 'hotel';
}
function inferActivityCategory(item) {
  const t = ((item.type || '') + ' ' + (item.types || []).join(' ')).toLowerCase();
  if (t.includes('temple') || t.includes('monastery') || t.includes('church') || t.includes('mosque') || t.includes('gurdwara')) return 'cultural';
  if (t.includes('museum') || t.includes('gallery') || t.includes('palace') || t.includes('castle') || t.includes('fort') || t.includes('historical')) return 'cultural';
  if (t.includes('park') || t.includes('garden') || t.includes('lake') || t.includes('view') || t.includes('forest') || t.includes('valley') || t.includes('waterfall') || t.includes('zoo') || t.includes('national_park') || t.includes('beach')) return 'nature';
  if (t.includes('market') || t.includes('shop') || t.includes('bazaar') || t.includes('mall')) return 'shopping';
  if (t.includes('adventure') || t.includes('paragliding') || t.includes('rafting') || t.includes('trek') || t.includes('camping') || t.includes('ski') || t.includes('amusement')) return 'adventure';
  if (t.includes('spa') || t.includes('yoga') || t.includes('meditation') || t.includes('retreat') || t.includes('wellness')) return 'wellness';
  if (t.includes('bar') || t.includes('club') || t.includes('lounge') || t.includes('night')) return 'nightlife';
  if (t.includes('water') || t.includes('kayak') || t.includes('boat') || t.includes('snorkel') || t.includes('dive')) return 'water_sport';
  return 'sightseeing';
}

// ─── Concurrency helper ───────────────────────────────────────
async function pMap(arr, fn, concurrency = 4) {
  const ret = new Array(arr.length);
  let i = 0;
  const workers = Array(Math.min(concurrency, arr.length)).fill(0).map(async () => {
    while (i < arr.length) {
      const idx = i++;
      try { ret[idx] = await fn(arr[idx], idx); }
      catch (e) { ret[idx] = { _error: e.message }; }
    }
  });
  await Promise.all(workers);
  return ret;
}

// ─── Main flow per destination ────────────────────────────────
const FORCE = process.argv.includes('--force');

async function populateDestination(dest) {
  const t0 = Date.now();
  console.log(`\n━━━ ${dest.city}, ${dest.country} [${dest.tag}] ━━━`);

  // Skip check BEFORE upsertDestination — otherwise status flips to 'processing'
  // and then we return early, leaving the row stuck.
  if (!FORCE) {
    const { data: pre } = await sb.from('catalog_destinations')
      .select('id, status')
      .ilike('city', dest.city)
      .ilike('country', dest.country)
      .maybeSingle();
    if (pre) {
      const { count: existingFromScript } = await sb.from('catalog_hotels')
        .select('*', { count: 'exact', head: true })
        .eq('destination_id', pre.id).eq('status', 'active').eq('source', 'google-places+gemini');
      if ((existingFromScript || 0) >= 8) {
        console.log(`  ⏭ skipping — already has ${existingFromScript} hotels from this script. Use --force to repopulate.`);
        // Defensive: if a prior buggy run left it stuck in processing, restore to active
        if (pre.status !== 'active') {
          await sb.from('catalog_destinations').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', pre.id);
          console.log(`  ✓ status reset from '${pre.status}' to 'active'`);
        }
        return { dest: dest.city, hotels: existingFromScript, activities: 0, restaurants: 0, elapsed: 0, skipped: true };
      }
    }
  }

  const { id: destId, isNew } = await upsertDestination(dest);
  console.log(`  ✓ destination ${isNew ? 'created' : 'reused'} ${destId.slice(0, 8)}`);

  console.log(`  → searching places...`);
  const [rawHotels, rawActs, rawRests] = await Promise.all([
    searchHotels(dest.city, dest.country),
    searchActivities(dest.city, dest.country),
    searchRestaurants(dest.city, dest.country),
  ]);
  console.log(`  ✓ raw: ${rawHotels.length}H / ${rawActs.length}A / ${rawRests.length}R`);

  const topHotels = rankAndPick(rawHotels, 15);
  const topActs   = rankAndPick(rawActs, 22);
  const topRests  = rankAndPick(rawRests, 15);
  console.log(`  ✓ ranked: ${topHotels.length}H / ${topActs.length}A / ${topRests.length}R`);

  if (topHotels.length + topActs.length + topRests.length === 0) {
    console.warn(`  ⚠ no qualifying items — destination skipped`);
    return { dest: dest.city, hotels: 0, activities: 0, restaurants: 0, elapsed: 0 };
  }

  console.log(`  → grounded synthesis for ${topHotels.length + topActs.length + topRests.length} items...`);
  const all = [
    ...topHotels.map(item => ({ item, category: 'hotel' })),
    ...topActs.map(item => ({ item, category: 'activity' })),
    ...topRests.map(item => ({ item, category: 'restaurant' })),
  ];
  const synths = await pMap(all, ({ item, category }) => synthesizeItem(item, dest, category), 4);
  const synthOK = synths.filter(s => s && !s._error).length;
  console.log(`  ✓ synthesized ${synthOK}/${all.length}`);

  console.log(`  → destination overview synthesis...`);
  const destSynth = await synthesizeDestination(dest);

  if (DRY_RUN) {
    console.log(`  [DRY] would soft-delete existing + insert ${topHotels.length}H/${topActs.length}A/${topRests.length}R`);
    return { dest: dest.city, hotels: topHotels.length, activities: topActs.length, restaurants: topRests.length, synthOK, elapsed: (Date.now()-t0)/1000 };
  }

  console.log(`  → soft-deleting existing rows...`);
  await softDeleteItems(destId);

  console.log(`  → upserting...`);
  const counts = { h: 0, a: 0, r: 0 };
  const errs = [];
  for (let i = 0; i < topHotels.length; i++) {
    const { error } = await insertHotel(destId, topHotels[i], synths[i], dest);
    if (error) errs.push(`H "${topHotels[i].name}": ${error.message}`);
    else counts.h++;
  }
  for (let i = 0; i < topActs.length; i++) {
    const { error } = await insertActivity(destId, topActs[i], synths[topHotels.length + i], dest);
    if (error) errs.push(`A "${topActs[i].name}": ${error.message}`);
    else counts.a++;
  }
  for (let i = 0; i < topRests.length; i++) {
    const { error } = await insertRestaurant(destId, topRests[i], synths[topHotels.length + topActs.length + i], dest);
    if (error) errs.push(`R "${topRests[i].name}": ${error.message}`);
    else counts.r++;
  }
  console.log(`  ✓ wrote: ${counts.h}H/${counts.a}A/${counts.r}R`);
  if (errs.length) { console.warn(`  ⚠ ${errs.length} upsert error(s):`); errs.slice(0, 5).forEach(e => console.warn('    ' + e)); }

  await sb.from('catalog_destinations').update({
    description: destSynth?.description || null,
    avg_budget_per_day: destSynth?.avg_budget_per_day || null,
    cover_image: topActs[0]?.photos?.[0] || topHotels[0]?.photos?.[0] || null,
    status: 'active',
    pipeline_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', destId);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ ${dest.city} done in ${elapsed}s → ACTIVE`);
  return { dest: dest.city, hotels: topHotels.length, activities: topActs.length, restaurants: topRests.length, synthOK, elapsed };
}

// ─── Run ──────────────────────────────────────────────────────
let targets = TARGETS;
if (TAG) targets = targets.filter(d => d.tag === TAG);
if (CITY_FILTER) targets = targets.filter(d => d.city.toLowerCase().includes(CITY_FILTER));
if (targets.length === 0) { console.error('no destinations matched filters'); process.exit(1); }

console.log(`\n━━━━━━━━ ${DRY_RUN ? 'DRY-RUN' : 'POPULATING'} ${targets.length} destination(s) ━━━━━━━━`);
console.log(targets.map(d => `  - ${d.city}, ${d.country} [${d.tag}]`).join('\n'));

const results = [];
for (const dest of targets) {
  try { results.push(await populateDestination(dest)); }
  catch (e) { console.error(`✗ ${dest.city} failed:`, e.message); results.push({ dest: dest.city, error: e.message }); }
}

console.log(`\n━━━━━━━━ SUMMARY ━━━━━━━━`);
for (const r of results) {
  if (r.error) console.log(`  ✗ ${r.dest.padEnd(20)} ${r.error.slice(0, 80)}`);
  else        console.log(`  ✓ ${r.dest.padEnd(20)} ${r.hotels}H/${r.activities}A/${r.restaurants}R  synth:${r.synthOK || '?'}  ${r.elapsed}s`);
}
