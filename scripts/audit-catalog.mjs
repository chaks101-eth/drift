#!/usr/bin/env node
// Catalog audit: count items per destination + flag gaps.
// Reads SUPABASE creds from .env.local. No writes.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// load .env.local
const env = Object.fromEntries(
  readFileSync('/Users/mac/Desktop/drift/.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')]; })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('missing supabase creds'); process.exit(1); }
const sb = createClient(url, key);

// Pull everything in parallel
const [{ data: dests }, { data: hotels }, { data: acts }, { data: rests }, { data: templates }, { data: runs }] = await Promise.all([
  sb.from('catalog_destinations').select('id,city,country,status,vibes,description,cover_image,best_months,avg_budget_per_day,currency,pipeline_run_at,created_at,updated_at').order('city'),
  sb.from('catalog_hotels').select('id,destination_id,name,image_url,rating,metadata'),
  sb.from('catalog_activities').select('id,destination_id,name,image_url,metadata'),
  sb.from('catalog_restaurants').select('id,destination_id,name,image_url,metadata'),
  sb.from('catalog_templates').select('id,destination_id,name,duration_days'),
  sb.from('pipeline_runs').select('id,destination_id,status,steps_completed,error,started_at,completed_at').order('started_at', { ascending: false }).limit(100),
]);

if (!dests) { console.error('no destinations'); process.exit(1); }

// Group items by destination_id
const groupBy = (arr, k) => arr.reduce((m, x) => { (m[x[k]] ||= []).push(x); return m; }, {});
const hByDest = groupBy(hotels || [], 'destination_id');
const aByDest = groupBy(acts || [], 'destination_id');
const rByDest = groupBy(rests || [], 'destination_id');
const tByDest = groupBy(templates || [], 'destination_id');
const runsByDest = groupBy(runs || [], 'destination_id');

// Quality criteria
const THIN = { hotels: 8, acts: 12, rests: 8 };

const rows = dests.map(d => {
  const h = hByDest[d.id]?.length || 0;
  const a = aByDest[d.id]?.length || 0;
  const r = rByDest[d.id]?.length || 0;
  const tmpls = tByDest[d.id]?.length || 0;
  const total = h + a + r;
  const fields = ['description', 'cover_image', 'vibes', 'avg_budget_per_day'].filter(f => {
    const v = d[f];
    return v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && v != null && Object.keys(v).length === 0);
  });
  // Recent runs for this dest
  const lastRun = runsByDest[d.id]?.[0];
  // % of items with images
  const allItems = [...(hByDest[d.id]||[]), ...(aByDest[d.id]||[]), ...(rByDest[d.id]||[])];
  const withImg = allItems.filter(i => i.image_url && !i.image_url.includes('placeholder')).length;
  const imgPct = allItems.length > 0 ? Math.round(100 * withImg / allItems.length) : 0;
  // % with honest_take
  const withTake = allItems.filter(i => i.metadata?.honest_take).length;
  const takePct = allItems.length > 0 ? Math.round(100 * withTake / allItems.length) : 0;
  // Status flags
  const flags = [];
  if (h < THIN.hotels) flags.push(`hotels:${h}/${THIN.hotels}`);
  if (a < THIN.acts)   flags.push(`acts:${a}/${THIN.acts}`);
  if (r < THIN.rests)  flags.push(`rests:${r}/${THIN.rests}`);
  if (tmpls === 0)     flags.push('no-template');
  if (fields.length)   flags.push(`miss:${fields.join(',')}`);
  if (d.status === 'processing') {
    const ageH = (Date.now() - new Date(d.updated_at).getTime()) / 3600000;
    if (ageH > 1) flags.push(`STUCK:${ageH.toFixed(1)}h`);
  }
  return { dest: `${d.city}, ${d.country}`, status: d.status, h, a, r, total, tmpls, imgPct, takePct, flags, lastRunStatus: lastRun?.status || '—', vibes: (d.vibes||[]).length };
});

// Sort: active first by total desc, then drafts, then processing
const order = { active: 0, processing: 1, draft: 2, archived: 3 };
rows.sort((x, y) => (order[x.status] - order[y.status]) || (y.total - x.total));

// Report
console.log('═══ CATALOG AUDIT ═══\n');
console.log(`Destinations: ${dests.length}   |   Hotels: ${(hotels||[]).length}   Activities: ${(acts||[]).length}   Restaurants: ${(rests||[]).length}   Templates: ${(templates||[]).length}   Total items: ${(hotels||[]).length + (acts||[]).length + (rests||[]).length}\n`);
console.log('STATUS  DESTINATION                       H   A   R   TMP  IMG%  TAKE%  FLAGS');
console.log('─'.repeat(110));
for (const r of rows) {
  const status = (r.status || '?').padEnd(6);
  const dest = r.dest.padEnd(34);
  const num = (n, w=3) => String(n).padStart(w);
  const flagsStr = r.flags.length ? r.flags.join(' ') : 'OK';
  console.log(`${status}  ${dest}  ${num(r.h)}  ${num(r.a)}  ${num(r.r)}  ${num(r.tmpls,3)}  ${num(r.imgPct,4)}  ${num(r.takePct,5)}  ${flagsStr}`);
}

// Status summary
console.log('\n─── SUMMARY ───');
const byStatus = rows.reduce((m, r) => { m[r.status] = (m[r.status]||0)+1; return m; }, {});
for (const [s, n] of Object.entries(byStatus)) console.log(`  ${s}: ${n}`);
const flagged = rows.filter(r => r.flags.length && r.flags[0] !== 'OK').length;
console.log(`  flagged: ${flagged} / ${rows.length}`);

// Stuck pipelines
const stuck = rows.filter(r => r.flags.some(f => f.startsWith('STUCK')));
if (stuck.length) {
  console.log('\n─── STUCK IN PROCESSING ───');
  for (const r of stuck) console.log(`  ${r.dest} — ${r.flags.find(f => f.startsWith('STUCK'))}`);
}

// Recent failed pipeline runs
const failed = (runs||[]).filter(r => r.status === 'failed').slice(0, 10);
if (failed.length) {
  console.log('\n─── RECENT FAILED RUNS ───');
  for (const f of failed) {
    const dest = dests.find(d => d.id === f.destination_id);
    console.log(`  ${dest?.city || '?'} — ${f.error?.slice(0, 80) || 'no error msg'} (${new Date(f.started_at).toISOString().slice(0,16)})`);
  }
}
