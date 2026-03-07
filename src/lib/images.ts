// ─── Curated Image Library ─────────────────────────────────────
// All URLs verified working on Unsplash CDN (images.unsplash.com)
// source.unsplash.com is DEAD — only use direct CDN links

const u = (id: string, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`

// ─── Destination Covers ────────────────────────────────────────
// Used on the destinations page when LLM suggests a city
const DESTINATION_COVERS: Record<string, string> = {
  // Asia
  'bali': u('photo-1537996194471-e657df975ab4', 600, 400),
  'bangkok': u('photo-1508009603885-50cf7c579365', 600, 400),
  'tokyo': u('photo-1540959733332-eab4deabeeaf', 600, 400),
  'kyoto': u('photo-1493976040374-85c8e12f0c0e', 600, 400),
  'singapore': u('photo-1525625293386-3f8f99389edd', 600, 400),
  'hanoi': u('photo-1509030450996-dd1a26dda07a', 600, 400),
  'seoul': u('photo-1534274988757-a28bf1a57c17', 600, 400),
  'dubai': u('photo-1512453979798-5ea266f8880c', 600, 400),
  'maldives': u('photo-1514282401047-d79a71a590e8', 600, 400),
  'goa': u('photo-1512343879784-a960bf40e7f2', 600, 400),
  'jaipur': u('photo-1477587458883-47145ed94245', 600, 400),
  'mumbai': u('photo-1529253355930-ddbe423a2ac7', 600, 400),
  'delhi': u('photo-1587474260584-136574528ed5', 600, 400),
  'sri lanka': u('photo-1586613835032-26f28d5d9b60', 600, 400),
  'vietnam': u('photo-1528127269322-539801943592', 600, 400),
  'hong kong': u('photo-1536599018102-9f803c140fc1', 600, 400),
  'phuket': u('photo-1589394815804-964ed0be2eb5', 600, 400),

  // Europe
  'santorini': u('photo-1613395877344-13d4a8e0d49e', 600, 400),
  'paris': u('photo-1502602898657-3e91760cbb34', 600, 400),
  'rome': u('photo-1552832230-c0197dd311b5', 600, 400),
  'barcelona': u('photo-1583422409516-2895a77efded', 600, 400),
  'london': u('photo-1513635269975-59663e0ac1ad', 600, 400),
  'amsterdam': u('photo-1534351590666-13e3e96b5017', 600, 400),
  'prague': u('photo-1519677100203-a0e668c92439', 600, 400),
  'istanbul': u('photo-1524231757912-21f4fe3a7200', 600, 400),
  'lisbon': u('photo-1585208798174-6cedd86e019a', 600, 400),
  'vienna': u('photo-1516550893923-42d28e5677af', 600, 400),
  'amalfi': u('photo-1533104816931-20fa691ff6ca', 600, 400),
  'swiss': u('photo-1530122037265-a5f1f91d3b99', 600, 400),
  'switzerland': u('photo-1530122037265-a5f1f91d3b99', 600, 400),
  'greece': u('photo-1613395877344-13d4a8e0d49e', 600, 400),

  // Americas
  'new york': u('photo-1496442226666-8d4d0e62e6e9', 600, 400),
  'cancun': u('photo-1510097467424-192d713fd8b2', 600, 400),
  'rio': u('photo-1483729558449-99ef09a8c325', 600, 400),
  'miami': u('photo-1533106497176-45ae19e68ba2', 600, 400),
  'havana': u('photo-1500759285222-a95626b934cb', 600, 400),
  'buenos aires': u('photo-1589909202802-8f4aadce1849', 600, 400),
  'costa rica': u('photo-1519999482648-25049ddd37b1', 600, 400),

  // Africa & Middle East
  'cape town': u('photo-1580060839134-75a5edca2e99', 600, 400),
  'marrakech': u('photo-1509003652919-9d7cc6d2f8f5', 600, 400),
  'cairo': u('photo-1539768942893-daf53e736b68', 600, 400),

  // Oceania
  'sydney': u('photo-1506973035872-a4ec16b8e8d9', 600, 400),
  'queenstown': u('photo-1589871973318-9ca1258faa7d', 600, 400),
  'fiji': u('photo-1518548419970-58e3b4079ab2', 600, 400),
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

/** Get an image for an itinerary item by category */
export function getItemImage(category: string, name: string, _destination: string): string | null {
  if (category === 'day' || category === 'transfer') return null

  // Use a counter + name hash so each card gets a different image
  const idx = _counter++ + Math.abs(hashCode(name))

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
