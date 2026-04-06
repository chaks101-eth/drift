// Country detection from city name — derived from CITY_IATA regions in amadeus.ts

const CITY_COUNTRY: Record<string, string> = {
  // India — major cities
  'delhi': 'India', 'new delhi': 'India', 'mumbai': 'India', 'bangalore': 'India',
  'bengaluru': 'India', 'chennai': 'India', 'kolkata': 'India', 'hyderabad': 'India',
  'goa': 'India', 'jaipur': 'India', 'ahmedabad': 'India', 'pune': 'India',
  'kochi': 'India', 'cochin': 'India', 'lucknow': 'India', 'varanasi': 'India',
  'benaras': 'India', 'amritsar': 'India', 'indore': 'India', 'nagpur': 'India',
  'chandigarh': 'India', 'thiruvananthapuram': 'India', 'trivandrum': 'India',
  'coimbatore': 'India', 'patna': 'India', 'bhopal': 'India', 'ranchi': 'India',
  'bhubaneswar': 'India', 'mangalore': 'India', 'visakhapatnam': 'India',
  'vizag': 'India', 'madurai': 'India', 'surat': 'India',
  // India — tourist destinations
  'udaipur': 'India', 'jodhpur': 'India', 'agra': 'India',
  'srinagar': 'India', 'leh': 'India', 'ladakh': 'India',
  'rishikesh': 'India', 'dehradun': 'India', 'haridwar': 'India',
  'shimla': 'India', 'manali': 'India', 'kullu': 'India',
  'darjeeling': 'India', 'siliguri': 'India', 'bagdogra': 'India',
  'gangtok': 'India', 'port blair': 'India', 'andaman': 'India',
  'munnar': 'India', 'ooty': 'India', 'coorg': 'India',
  'kodaikanal': 'India', 'mysore': 'India', 'mysuru': 'India',
  'guwahati': 'India', 'shillong': 'India', 'imphal': 'India',
  'dibrugarh': 'India', 'raipur': 'India', 'jammu': 'India',
  'pondicherry': 'India', 'jaisalmer': 'India', 'tirupati': 'India',
  'aurangabad': 'India', 'dharamshala': 'India', 'diu': 'India',
  'gokarna': 'India', 'varkala': 'India', 'alleppey': 'India',
  'hampi': 'India', 'pushkar': 'India', 'mcleodganj': 'India',
  'kasol': 'India', 'nainital': 'India', 'mussoorie': 'India',
  'lonavala': 'India', 'mahabaleshwar': 'India', 'udupi': 'India',
  // Thailand
  'bangkok': 'Thailand', 'phuket': 'Thailand', 'chiang mai': 'Thailand',
  'krabi': 'Thailand', 'pattaya': 'Thailand', 'koh samui': 'Thailand', 'ko samui': 'Thailand',
  // Indonesia
  'bali': 'Indonesia', 'denpasar': 'Indonesia', 'jakarta': 'Indonesia',
  'yogyakarta': 'Indonesia', 'lombok': 'Indonesia',
  // Singapore
  'singapore': 'Singapore',
  // Vietnam
  'hanoi': 'Vietnam', 'ho chi minh': 'Vietnam', 'saigon': 'Vietnam',
  'da nang': 'Vietnam', 'nha trang': 'Vietnam', 'phu quoc': 'Vietnam',
  // Malaysia
  'kuala lumpur': 'Malaysia', 'langkawi': 'Malaysia', 'penang': 'Malaysia',
  // Philippines
  'manila': 'Philippines', 'cebu': 'Philippines', 'boracay': 'Philippines',
  // Cambodia
  'siem reap': 'Cambodia', 'phnom penh': 'Cambodia',
  // Laos
  'luang prabang': 'Laos', 'vientiane': 'Laos',
  // Myanmar
  'yangon': 'Myanmar',
  // Japan
  'tokyo': 'Japan', 'kyoto': 'Japan', 'osaka': 'Japan', 'fukuoka': 'Japan',
  // South Korea
  'seoul': 'South Korea',
  // China
  'shanghai': 'China', 'beijing': 'China', 'guangzhou': 'China',
  'shenzhen': 'China', 'hong kong': 'China',
  // Taiwan
  'taipei': 'Taiwan',
  // UAE
  'dubai': 'UAE', 'abu dhabi': 'UAE',
  // Qatar
  'doha': 'Qatar',
  // Oman
  'muscat': 'Oman',
  // Maldives
  'maldives': 'Maldives', 'male': 'Maldives',
  // Sri Lanka
  'colombo': 'Sri Lanka', 'sri lanka': 'Sri Lanka',
  'galle': 'Sri Lanka', 'kandy': 'Sri Lanka', 'ella': 'Sri Lanka',
  // Nepal
  'kathmandu': 'Nepal', 'pokhara': 'Nepal',
  // Bhutan
  'paro': 'Bhutan', 'bhutan': 'Bhutan',
  // UK
  'london': 'UK', 'edinburgh': 'UK',
  // France
  'paris': 'France', 'nice': 'France',
  // Italy
  'rome': 'Italy', 'florence': 'Italy', 'milan': 'Italy', 'venice': 'Italy', 'naples': 'Italy',
  // Spain
  'barcelona': 'Spain', 'madrid': 'Spain',
  // Netherlands
  'amsterdam': 'Netherlands',
  // Germany
  'berlin': 'Germany', 'munich': 'Germany', 'frankfurt': 'Germany',
  // Portugal
  'lisbon': 'Portugal',
  // Greece
  'athens': 'Greece', 'santorini': 'Greece', 'mykonos': 'Greece',
  // Turkey
  'istanbul': 'Turkey', 'antalya': 'Turkey', 'cappadocia': 'Turkey',
  'bodrum': 'Turkey', 'izmir': 'Turkey',
  // Czech Republic
  'prague': 'Czech Republic',
  // Austria
  'vienna': 'Austria',
  // Switzerland
  'zurich': 'Switzerland', 'geneva': 'Switzerland', 'interlaken': 'Switzerland',
  // Ireland
  'dublin': 'Ireland',
  // Hungary
  'budapest': 'Hungary',
  // Croatia
  'dubrovnik': 'Croatia', 'split': 'Croatia',
  // Iceland
  'reykjavik': 'Iceland',
  // Scandinavia
  'copenhagen': 'Denmark', 'stockholm': 'Sweden', 'oslo': 'Norway', 'helsinki': 'Finland',
  // Belgium
  'brussels': 'Belgium',
  // Poland
  'warsaw': 'Poland',
  // USA
  'new york': 'USA', 'los angeles': 'USA', 'san francisco': 'USA',
  'miami': 'USA', 'chicago': 'USA', 'seattle': 'USA', 'boston': 'USA',
  'las vegas': 'USA', 'washington': 'USA', 'dallas': 'USA',
  'houston': 'USA', 'denver': 'USA', 'atlanta': 'USA',
  // Canada
  'toronto': 'Canada', 'vancouver': 'Canada', 'montreal': 'Canada',
  // Mexico
  'mexico city': 'Mexico', 'cancun': 'Mexico',
  // Brazil
  'rio de janeiro': 'Brazil', 'sao paulo': 'Brazil',
  // Argentina
  'buenos aires': 'Argentina',
  // Peru
  'lima': 'Peru', 'cusco': 'Peru',
  // Colombia
  'bogota': 'Colombia', 'medellin': 'Colombia', 'cartagena': 'Colombia',
  // Cuba
  'havana': 'Cuba',
  // Chile
  'santiago': 'Chile',
  // Uruguay
  'montevideo': 'Uruguay',
  // Ecuador
  'quito': 'Ecuador',
  // Bolivia
  'la paz': 'Bolivia',
  // Georgia
  'tbilisi': 'Georgia', 'batumi': 'Georgia',
  // Armenia
  'yerevan': 'Armenia',
  // Azerbaijan
  'baku': 'Azerbaijan',
  // Central Asia
  'tashkent': 'Uzbekistan', 'almaty': 'Kazakhstan', 'bishkek': 'Kyrgyzstan',
  // Egypt
  'cairo': 'Egypt',
  // Morocco
  'marrakech': 'Morocco', 'casablanca': 'Morocco',
  // Tanzania
  'zanzibar': 'Tanzania', 'dar es salaam': 'Tanzania', 'kilimanjaro': 'Tanzania', 'arusha': 'Tanzania',
  // Kenya
  'nairobi': 'Kenya',
  // South Africa
  'cape town': 'South Africa', 'johannesburg': 'South Africa',
  // Mauritius
  'mauritius': 'Mauritius',
  // Seychelles
  'seychelles': 'Seychelles',
  // Rwanda
  'kigali': 'Rwanda',
  // Uganda
  'entebbe': 'Uganda', 'kampala': 'Uganda',
  // Other Africa
  'tunis': 'Tunisia', 'addis ababa': 'Ethiopia', 'accra': 'Ghana',
  'lagos': 'Nigeria', 'windhoek': 'Namibia', 'livingstone': 'Zambia',
  'victoria falls': 'Zimbabwe', 'maputo': 'Mozambique',
  // Australia
  'sydney': 'Australia', 'melbourne': 'Australia', 'perth': 'Australia',
  'brisbane': 'Australia', 'cairns': 'Australia', 'gold coast': 'Australia',
  // New Zealand
  'auckland': 'New Zealand', 'queenstown': 'New Zealand', 'christchurch': 'New Zealand',
  // Pacific
  'fiji': 'Fiji', 'tahiti': 'French Polynesia', 'bora bora': 'French Polynesia',
}

/**
 * Detect country from a city name. Returns null if unknown.
 */
export function detectCountry(city: string): string | null {
  if (!city) return null
  return CITY_COUNTRY[city.toLowerCase().trim()] || null
}

/**
 * Check if origin and destination are in the same country.
 * Uses destCountry shortcut if available (from API/catalog data).
 */
export function isDomesticTrip(originCity: string, destCity: string, destCountry?: string): boolean {
  const originCountry = detectCountry(originCity)
  if (!originCountry) return false

  // Shortcut: if destination country is provided, compare directly
  if (destCountry) {
    const dc = destCountry.toLowerCase().trim()
    const oc = originCountry.toLowerCase()
    // Handle common aliases
    if (oc === dc) return true
    if (oc === 'india' && dc === 'india') return true
    if (oc === 'usa' && (dc === 'usa' || dc === 'united states' || dc === 'us')) return true
    if (oc === 'uk' && (dc === 'uk' || dc === 'united kingdom' || dc === 'england' || dc === 'scotland')) return true
    return oc === dc
  }

  // Fallback: look up destination city
  const destDetected = detectCountry(destCity)
  if (!destDetected) return false
  return originCountry.toLowerCase() === destDetected.toLowerCase()
}
