// Quick test of Foursquare v2 API with client credentials
const https = require('https');

const params = new URLSearchParams({
  client_id: 'D4XNJZV1P3PT2FZQ1KOZDUYFNQFFSYRQQVHJ55YIYOQL2ZLC',
  client_secret: 'QRFWZAYZVM2UC0TKPXQP4I24W2KTMPYJS100FMLXFXQOEKST',
  v: '20240101',
  near: 'Bali',
  query: 'hotel',
  limit: '2',
});

const url = `https://api.foursquare.com/v2/venues/search?${params}`;
console.log('Testing:', url.substring(0, 80) + '...');

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('Status:', res.statusCode);
    console.log('Response code:', json.meta?.code);
    if (json.meta?.code === 200) {
      const venues = json.response?.venues || [];
      console.log('Venues found:', venues.length);
      venues.forEach(v => {
        console.log(`  - ${v.name} (${v.categories?.[0]?.name || 'no category'})`);
        console.log(`    ID: ${v.id}`);
      });
      // Now test getting photos for the first venue
      if (venues[0]) {
        const photoUrl = `https://api.foursquare.com/v2/venues/${venues[0].id}/photos?${new URLSearchParams({
          client_id: 'D4XNJZV1P3PT2FZQ1KOZDUYFNQFFSYRQQVHJ55YIYOQL2ZLC',
          client_secret: 'QRFWZAYZVM2UC0TKPXQP4I24W2KTMPYJS100FMLXFXQOEKST',
          v: '20240101',
          limit: '1',
        })}`;
        https.get(photoUrl, (res2) => {
          let d2 = '';
          res2.on('data', (c) => d2 += c);
          res2.on('end', () => {
            const pj = JSON.parse(d2);
            console.log('\nPhoto API status:', pj.meta?.code);
            const photos = pj.response?.photos?.items || [];
            if (photos.length) {
              const p = photos[0];
              console.log('Photo URL:', `${p.prefix}300x300${p.suffix}`);
            } else {
              console.log('No photos found for this venue');
            }
          });
        });
      }
    } else {
      console.log('Error:', json.meta?.errorType, json.meta?.errorDetail);
    }
  });
}).on('error', (e) => console.error('Request error:', e.message));
