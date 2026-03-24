const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) env[k.trim()] = v.join('=').trim();
});

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
  const { data: dests } = await sb.from('catalog_destinations').select('id, city, country, status');
  console.log('=== DESTINATIONS ===');
  for (const d of dests || []) console.log(d.status, '-', d.city + ', ' + d.country);

  for (const d of (dests || []).filter(x => x.status === 'active')) {
    console.log('\n========== ' + d.city.toUpperCase() + ' ==========');

    for (const table of ['catalog_hotels', 'catalog_activities', 'catalog_restaurants']) {
      const { data: items } = await sb.from(table).select('id, name, image_url, booking_url, source, metadata').eq('destination_id', d.id);
      const type = table.replace('catalog_', '');
      const total = (items || []).length;
      const withImg = (items || []).filter(i => i.image_url && i.image_url.indexOf('placeholder') === -1).length;
      const withPhotos = (items || []).filter(i => i.metadata && i.metadata.photos && i.metadata.photos.length > 1).length;
      const withBooking = (items || []).filter(i => i.booking_url).length;
      const withWebsite = (items || []).filter(i => i.metadata && i.metadata.website).length;
      const withDataId = (items || []).filter(i => i.metadata && i.metadata.dataId).length;
      const sources = {};
      (items || []).forEach(i => { sources[i.source || 'unknown'] = (sources[i.source || 'unknown'] || 0) + 1; });

      console.log(`  ${type}: ${total} items | img:${withImg}/${total} photos:${withPhotos}/${total} booking:${withBooking}/${total} website:${withWebsite}/${total} dataId:${withDataId}/${total} | sources: ${JSON.stringify(sources)}`);

      // Show items without booking that have a website
      const canFix = (items || []).filter(i => {
        return (i.booking_url === null || i.booking_url === '') && i.metadata && i.metadata.website;
      });
      if (canFix.length > 0) {
        console.log(`    -> ${canFix.length} items have website but no booking_url (easy fix)`);
      }

      // Show items with no images at all
      const noImg = (items || []).filter(i => {
        return (i.image_url === null || i.image_url === '') && (!i.metadata || !i.metadata.photos || i.metadata.photos.length === 0);
      });
      if (noImg.length > 0) {
        console.log(`    -> ${noImg.length} items have NO images at all`);
        noImg.forEach(i => console.log(`       - ${i.name}`));
      }

      // Show duplicate images
      const imgCounts = {};
      (items || []).forEach(i => {
        if (i.image_url) {
          const key = i.image_url.split('?')[0]; // strip params
          imgCounts[key] = (imgCounts[key] || 0) + 1;
        }
      });
      const dupes = Object.entries(imgCounts).filter(([_, c]) => c > 1);
      if (dupes.length > 0) {
        console.log(`    -> ${dupes.length} duplicate image URLs found (${dupes.reduce((s, [_, c]) => s + c, 0)} items sharing)`);
      }
    }

    const { data: tmpl } = await sb.from('catalog_templates').select('id, name').eq('destination_id', d.id);
    console.log(`  templates: ${(tmpl || []).length}`);
  }
}
audit().catch(console.error);
