// ─── Curated Image Library ─────────────────────────────────────
// All URLs verified working on Unsplash CDN (images.unsplash.com)
// source.unsplash.com is DEAD — only use direct CDN links

const u = (id: string, w = 1200, h = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=90`

// ─── Destination Covers ────────────────────────────────────────
// Used on the destinations page when LLM suggests a city
const DESTINATION_COVERS: Record<string, string> = {
  // Asia
  'bali': u('photo-1537996194471-e657df975ab4'),
  'bangkok': u('photo-1508009603885-50cf7c579365'),
  'tokyo': u('photo-1540959733332-eab4deabeeaf'),
  'kyoto': u('photo-1493976040374-85c8e12f0c0e'),
  'singapore': u('photo-1525625293386-3f8f99389edd'),
  'hanoi': u('photo-1509030450996-dd1a26dda07a'),
  'seoul': u('photo-1534274988757-a28bf1a57c17'),
  'dubai': u('photo-1512453979798-5ea266f8880c'),
  'maldives': u('photo-1514282401047-d79a71a590e8'),
  'goa': u('photo-1512343879784-a960bf40e7f2'),
  'jaipur': u('photo-1477587458883-47145ed94245'),
  'mumbai': u('photo-1529253355930-ddbe423a2ac7'),
  'delhi': u('photo-1587474260584-136574528ed5'),
  'sri lanka': u('photo-1550754706-432b118ee3d7'),
  'vietnam': u('photo-1528127269322-539801943592'),
  'hong kong': u('photo-1536599018102-9f803c140fc1'),
  'phuket': u('photo-1589394815804-964ed0be2eb5'),

  // Europe
  'santorini': u('photo-1613395877344-13d4a8e0d49e'),
  'paris': u('photo-1502602898657-3e91760cbb34'),
  'rome': u('photo-1552832230-c0197dd311b5'),
  'barcelona': u('photo-1583422409516-2895a77efded'),
  'london': u('photo-1513635269975-59663e0ac1ad'),
  'amsterdam': u('photo-1534351590666-13e3e96b5017'),
  'prague': u('photo-1519677100203-a0e668c92439'),
  'istanbul': u('photo-1524231757912-21f4fe3a7200'),
  'lisbon': u('photo-1585208798174-6cedd86e019a'),
  'vienna': u('photo-1516550893923-42d28e5677af'),
  'amalfi': u('photo-1533104816931-20fa691ff6ca'),
  'swiss': u('photo-1530122037265-a5f1f91d3b99'),
  'switzerland': u('photo-1530122037265-a5f1f91d3b99'),
  'greece': u('photo-1613395877344-13d4a8e0d49e'),

  // Americas
  'new york': u('photo-1496442226666-8d4d0e62e6e9'),
  'cancun': u('photo-1510097467424-192d713fd8b2'),
  'rio': u('photo-1483729558449-99ef09a8c325'),
  'miami': u('photo-1533106497176-45ae19e68ba2'),
  'havana': u('photo-1500759285222-a95626b934cb'),
  'buenos aires': u('photo-1589909202802-8f4aadce1849'),
  'costa rica': u('photo-1519999482648-25049ddd37b1'),

  // Africa & Middle East
  'cape town': u('photo-1580060839134-75a5edca2e99'),
  'marrakech': u('photo-1702211374779-792e3df71b59'),
  'cairo': u('photo-1692986172150-ec32dccfa5f0'),
  'zanzibar': u('photo-1547471080-7cc2caa01a7e'),
  'nairobi': u('photo-1611348524140-53c9a25263d6'),

  // Oceania
  'sydney': u('photo-1506973035872-a4ec16b8e8d9'),
  'queenstown': u('photo-1630850790886-2af9c3b1d6af'),
  'fiji': u('photo-1518548419970-58e3b4079ab2'),
  'melbourne': u('photo-1514395462725-fb4566210144'),

  // Southeast Asia (expanded)
  'ho chi minh': u('photo-1583417319070-4a69db38a482'),
  'ho chi minh city': u('photo-1583417319070-4a69db38a482'),
  'chiang mai': u('photo-1719886369730-bfa59fad5f39'),
  'siem reap': u('photo-1569242840510-9fe6f0112cee'),
  'luang prabang': u('photo-1583417267826-aebc4d1542e1'),
  'koh samui': u('photo-1537956965359-7573183d1f57'),
  'langkawi': u('photo-1703855433576-bc21410b1582'),

  // South Asia
  'kathmandu': u('photo-1558799401-1dcba79834c2'),
  'pokhara': u('photo-1544735716-392fe2489ffa'),
  'colombo': u('photo-1578165219176-ece04edbd053'),

  // Central Asia / Caucasus
  'tbilisi': u('photo-1565008576549-57569a49371d'),
  'bishkek': u('photo-1530841377377-3ff06c0ca713'),
  'tashkent': u('photo-1596484552834-6a58f850e0a1'),
  'yerevan': u('photo-1640218576855-48345acf073b'),
  'baku': u('photo-1689188930114-6a6824a21390'),

  // More Europe
  'dubrovnik': u('photo-1655560585033-67e928edd1f7'),
  'edinburgh': u('photo-1506377585622-bedcbb027afc'),
  'florence': u('photo-1541370976299-4d24ebbc9077'),
  'budapest': u('photo-1549923746-c502d488b3ea'),
  'copenhagen': u('photo-1513622470522-26c3c8a854bc'),
  'reykjavik': u('photo-1504829857797-ddff29c27927'),
  'sarajevo': u('photo-1690323027535-d5fc4dc4f72f'),

  // South America
  'bogota': u('photo-1706417391330-f35673bb0b27'),
  'cartagena': u('photo-1678422151003-4a920e7a3de8'),
  'cusco': u('photo-1526392060635-9d6019884377'),
  'santiago': u('photo-1528759081949-f736c5d4aa8b'),
  'medellin': u('photo-1599493758267-c6c884c7071f'),

  // Winter destinations — each unique
  'gudauri': u('photo-1516426122078-c23e76319801'), // snowy mountains Georgia
  'karakol': u('photo-1486870591958-9b9d0d1dda99'), // Kyrgyz mountains
  'niseko': u('photo-1551524559-8af4e6624178'),      // snowy Japan
  'chamonix': u('photo-1509960321709-862b62e45d69'), // Mont Blanc
  'zermatt': u('photo-1520531158340-44015069e78e'),   // Matterhorn

  // Caribbean / Islands
  'mauritius': u('photo-1687049417784-f5ea5659f2d6'),
  'belle mare': u('photo-1544550581-1bcabf842b77'), // Mauritius beach
  'paro': u('photo-1553856622-d1b352e9a211'),
  'bhutan': u('photo-1665731235408-130bf915c424'), // Tiger's Nest

  // India — expanded (popular with Drift users)
  'manali': u('photo-1626621341517-bbf3d9990a23'),
  'rishikesh': u('photo-1683318528842-bd5f1fd0ff9a'),
  'udaipur': u('photo-1675772120474-b9d7811220f9'),
  'varanasi': u('photo-1570168007204-dfb528c6958f'),
  'leh': u('photo-1653112122775-855a525a5846'),
  'ladakh': u('photo-1653112122775-855a525a5846'),
  'port blair': u('photo-1507525428034-b723cf961d3e'),
  'andaman': u('photo-1544551763-46a013bb70d5'),
  'kochi': u('photo-1602216056096-3b40cc0c9944'),
  'kerala': u('photo-1602216056096-3b40cc0c9944'),
  'shimla': u('photo-1655884569008-97ee67cd6e72'),
  'darjeeling': u('photo-1776271377434-f549e3e19881'),
  'pondicherry': u('photo-1582510003544-4d00b7f74220'),
  'agra': u('photo-1564507592333-c60657eea523'),

  // Thailand — expanded
  'pattaya': u('photo-1652346637723-83799b99ea87'),
  'krabi': u('photo-1552465011-b4e21bf6e79a'),
  'koh phi phi': u('photo-1673627114942-88d7a578e295'),
  'chiang rai': u('photo-1523059623039-a9ed027e7fad'),

  // More destinations users plan
  'galle': u('photo-1704797390682-76479a29dc9a'),
  'zurich': u('photo-1515488764276-beab7607c1e6'),
}

// ─── Category Fallback Pools ───────────────────────────────────
// Multiple images per category so board doesn't look repetitive
const FLIGHT_IMAGES = [
  u('photo-1436491865332-7a61a109db05'),
  u('photo-1569154941061-e231b4725ef1'),
  u('photo-1556388158-158ea5ccacbd'),
]

const HOTEL_IMAGES = [
  u('photo-1520250497591-112f2f40a3f4'),
  u('photo-1566073771259-6a8506099945'),
  u('photo-1582719508461-905c673771fd'),
  u('photo-1571896349842-33c89424de2d'),
  u('photo-1551882547-ff40c63fe5fa'),
]

const ACTIVITY_IMAGES = [
  u('photo-1506929562872-bb421503ef21'),
  u('photo-1533105079780-92b9be482077'),
  u('photo-1501785888041-af3ef285b470'),
  u('photo-1476514525535-07fb3b4ae5f1'),
  u('photo-1504280390367-361c6d9f38f4'),
  u('photo-1528543606781-2f6e6857f318'),
  u('photo-1518709268805-4e9042af9f23'),
]

const FOOD_IMAGES = [
  u('photo-1414235077428-338989a2e8c0'),
  u('photo-1504674900247-0877df9cc836'),
  u('photo-1540189549336-e6e99c3679fe'),
  u('photo-1565299624946-b28f40a0ae38'),
  u('photo-1555939594-58d7cb561ad1'),
  u('photo-1476224203421-9ac39bcb3327'),
]

// ─── Destination-Specific Pools ──────────────────────────────
// Curated photos per destination so boards feel place-specific
// Each pool has hotels, food, activities — all verified Unsplash IDs
const DEST_POOLS: Record<string, { hotel: string[]; food: string[]; activity: string[] }> = {
  'bali': {
    hotel: [u('photo-1537996194471-e657df975ab4'), u('photo-1570213489059-0aac6626cade'), u('photo-1544005313-94ddf0286df2'), u('photo-1582610116397-edb318620f90')],
    food: [u('photo-1552611052-33e04de81118'), u('photo-1517248135467-4c7edcad34c4'), u('photo-1562436260-f30ae5e37168'), u('photo-1559339352-11d035aa65de')],
    activity: [u('photo-1537996194471-e657df975ab4'), u('photo-1555400038-63f5ba517a47'), u('photo-1604665515809-2087aa2b0110'), u('photo-1573790387438-4da905039392')],
  },
  'tokyo': {
    hotel: [u('photo-1535083783855-76ae62b2914e'), u('photo-1503899036084-c55cdd92da26'), u('photo-1480796927426-f609979314bd'), u('photo-1542051841857-5f90071e7989')],
    food: [u('photo-1553621042-f6e147245754'), u('photo-1579871494447-9811cf80d66c'), u('photo-1617196034183-421b4917c92d'), u('photo-1580442151529-343f2f6e0e27')],
    activity: [u('photo-1540959733332-eab4deabeeaf'), u('photo-1528164344705-47542687000d'), u('photo-1493976040374-85c8e12f0c0e'), u('photo-1545569341-9eb8b30979d9')],
  },
  'paris': {
    hotel: [u('photo-1551882547-ff40c63fe5fa'), u('photo-1520250497591-112f2f40a3f4'), u('photo-1566073771259-6a8506099945'), u('photo-1578683010236-d716f9a3f461')],
    food: [u('photo-1414235077428-338989a2e8c0'), u('photo-1555396273-367ea4eb4db5'), u('photo-1550507992-eb63ffee0571'), u('photo-1498654896293-37aacf113fd9')],
    activity: [u('photo-1502602898657-3e91760cbb34'), u('photo-1499856871958-5b9627545d1a'), u('photo-1431274172761-fca41d930114'), u('photo-1550340499-a6c60fc8287c')],
  },
  'bangkok': {
    hotel: [u('photo-1520250497591-112f2f40a3f4'), u('photo-1582719508461-905c673771fd'), u('photo-1571896349842-33c89424de2d'), u('photo-1551882547-ff40c63fe5fa')],
    food: [u('photo-1504674900247-0877df9cc836'), u('photo-1562565652-a0d8f0c59eb4'), u('photo-1559339352-11d035aa65de'), u('photo-1555939594-58d7cb561ad1')],
    activity: [u('photo-1508009603885-50cf7c579365'), u('photo-1563492065599-3520f775eeed'), u('photo-1528181304800-259b08848526'), u('photo-1552465011-b4e21bf6e79a')],
  },
  'dubai': {
    hotel: [u('photo-1582719508461-905c673771fd'), u('photo-1566073771259-6a8506099945'), u('photo-1551882547-ff40c63fe5fa'), u('photo-1571896349842-33c89424de2d')],
    food: [u('photo-1504674900247-0877df9cc836'), u('photo-1414235077428-338989a2e8c0'), u('photo-1540189549336-e6e99c3679fe'), u('photo-1565299624946-b28f40a0ae38')],
    activity: [u('photo-1512453979798-5ea266f8880c'), u('photo-1518684079-3c830dcef090'), u('photo-1526495124232-a04e1849168c'), u('photo-1547979946-e025bde2ec87')],
  },
  'santorini': {
    hotel: [u('photo-1570213489059-0aac6626cade'), u('photo-1602002418082-a4443e081dd1'), u('photo-1570077188670-e3a8d69ac5ff'), u('photo-1571003123894-1f0594d2b5d9')],
    food: [u('photo-1504674900247-0877df9cc836'), u('photo-1555396273-367ea4eb4db5'), u('photo-1414235077428-338989a2e8c0'), u('photo-1540189549336-e6e99c3679fe')],
    activity: [u('photo-1613395877344-13d4a8e0d49e'), u('photo-1570077188670-e3a8d69ac5ff'), u('photo-1601581875309-fafbf2d3ed3a'), u('photo-1533105079780-92b9be482077')],
  },
}

// Resolve destination key from city name
function getDestKey(dest: string): string | null {
  const d = dest.toLowerCase().trim()
  for (const key of Object.keys(DEST_POOLS)) {
    if (d.includes(key) || key.includes(d)) return key
  }
  return null
}

// ─── Public API ────────────────────────────────────────────────

let _counter = 0

/** Get a destination cover image by city name */
export function getDestinationImage(cityName: string): string {
  const key = cityName.toLowerCase().trim()

  // Direct match
  if (DESTINATION_COVERS[key]) return DESTINATION_COVERS[key]

  // Partial match (e.g. "Bali, Indonesia" matches "bali")
  for (const [k, v] of Object.entries(DESTINATION_COVERS)) {
    if (key.includes(k) || k.includes(key)) return v
  }

  // Fallback: pick from activity images (scenic travel photos)
  return ACTIVITY_IMAGES[Math.abs(hashCode(key)) % ACTIVITY_IMAGES.length]
}

/** Get an image for an itinerary item by category + destination */
export function getItemImage(category: string, name: string, destination: string): string | null {
  if (category === 'day' || category === 'transfer') return null

  const idx = _counter++ + Math.abs(hashCode(name))

  // Try destination-specific pool first
  const destKey = getDestKey(destination)
  if (destKey) {
    const pool = DEST_POOLS[destKey]
    const catPool = category === 'hotel' ? pool.hotel
      : category === 'food' ? pool.food
      : pool.activity
    return catPool[idx % catPool.length]
  }

  // Generic fallback
  switch (category) {
    case 'flight':
      return FLIGHT_IMAGES[idx % FLIGHT_IMAGES.length]
    case 'hotel':
      return HOTEL_IMAGES[idx % HOTEL_IMAGES.length]
    case 'food':
      return FOOD_IMAGES[idx % FOOD_IMAGES.length]
    case 'activity':
    default:
      return ACTIVITY_IMAGES[idx % ACTIVITY_IMAGES.length]
  }
}

/** Reset counter between itinerary generations */
export function resetImageCounter() {
  _counter = 0
}

function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i)
    hash |= 0
  }
  return hash
}

/** Upsize Google Maps thumbnail URLs to usable resolution */
export function upsizeGoogleImage(url: string, w = 1200, h = 800): string {
  if (!url || !url.includes('googleusercontent.com')) return url
  // Handle both old (=wNNN-hNNN-k-no) and new (gps-cs-s) URL formats
  if (url.match(/=w\d+-h\d+/)) {
    return url.replace(/=w\d+-h\d+-k-no/, `=w${w}-h${h}-k-no`)
  }
  // If no size params, append them
  if (!url.includes('=w') && !url.includes('=s')) {
    return url + `=w${w}-h${h}-k-no`
  }
  return url
}
