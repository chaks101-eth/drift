// ─── Amadeus Flight Search ─────────────────────────────────────
// Uses Amadeus Self-Service API (test environment)
// Docs: https://developers.amadeus.com/self-service/category/flights

const BASE_URL = 'https://test.api.amadeus.com'

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }

  const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY!,
      client_secret: process.env.AMADEUS_API_SECRET!,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Amadeus auth failed: ${err}`)
  }

  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  }
  return cachedToken.access_token
}

// ─── Types ────────────────────────────────────────────────────

export interface FlightOffer {
  airline: string
  airlineName: string
  flightNumber: string
  departure: {
    airport: string
    time: string // ISO datetime
    terminal?: string
  }
  arrival: {
    airport: string
    time: string
    terminal?: string
  }
  duration: string // e.g. "PT10H30M"
  stops: number
  price: string // e.g. "$420"
  currency: string
  cabin: string
  bookingUrl: string | null
}

// ─── City → IATA mapping ─────────────────────────────────────
// Common cities. Amadeus also has an airport search API but this
// avoids an extra call for the most common origins/destinations.
const CITY_IATA: Record<string, string> = {
  // India — major cities
  'delhi': 'DEL', 'new delhi': 'DEL', 'mumbai': 'BOM', 'bangalore': 'BLR',
  'bengaluru': 'BLR', 'chennai': 'MAA', 'kolkata': 'CCU', 'hyderabad': 'HYD',
  'goa': 'GOI', 'jaipur': 'JAI', 'ahmedabad': 'AMD', 'pune': 'PNQ',
  'kochi': 'COK', 'cochin': 'COK', 'lucknow': 'LKO', 'varanasi': 'VNS',
  'benaras': 'VNS', 'amritsar': 'ATQ', 'indore': 'IDR', 'nagpur': 'NAG',
  'chandigarh': 'IXC', 'thiruvananthapuram': 'TRV', 'trivandrum': 'TRV',
  'coimbatore': 'CJB', 'patna': 'PAT', 'bhopal': 'BHO', 'ranchi': 'IXR',
  'bhubaneswar': 'BBI', 'mangalore': 'IXE', 'visakhapatnam': 'VTZ',
  'vizag': 'VTZ', 'madurai': 'IXM', 'surat': 'STV',
  // India — tourist destinations (nearest airport)
  'udaipur': 'UDR', 'jodhpur': 'JDH', 'agra': 'AGR',
  'srinagar': 'SXR', 'leh': 'IXL', 'ladakh': 'IXL',
  'rishikesh': 'DED', 'dehradun': 'DED', 'haridwar': 'DED',
  'shimla': 'SLV', 'manali': 'KUU', 'kullu': 'KUU',
  'darjeeling': 'IXB', 'siliguri': 'IXB', 'bagdogra': 'IXB',
  'gangtok': 'IXB', 'port blair': 'IXZ', 'andaman': 'IXZ',
  'munnar': 'COK', 'ooty': 'CJB', 'coorg': 'IXE',
  'kodaikanal': 'IXM', 'mysore': 'MYQ', 'mysuru': 'MYQ',
  'guwahati': 'GAU', 'shillong': 'SHL', 'imphal': 'IMF',
  'dibrugarh': 'DIB', 'raipur': 'RPR', 'jammu': 'IXJ',
  // Southeast Asia
  'bali': 'DPS', 'denpasar': 'DPS', 'bangkok': 'BKK', 'tokyo': 'NRT',
  'singapore': 'SIN', 'hanoi': 'HAN', 'seoul': 'ICN', 'dubai': 'DXB',
  'abu dhabi': 'AUH', 'doha': 'DOH', 'muscat': 'MCT',
  'maldives': 'MLE', 'male': 'MLE', 'colombo': 'CMB', 'sri lanka': 'CMB',
  'hong kong': 'HKG', 'phuket': 'HKT', 'kuala lumpur': 'KUL',
  'ho chi minh': 'SGN', 'saigon': 'SGN', 'kathmandu': 'KTM',
  'chiang mai': 'CNX', 'siem reap': 'REP', 'phnom penh': 'PNH',
  'jakarta': 'CGK', 'manila': 'MNL', 'cebu': 'CEB',
  'taipei': 'TPE', 'shanghai': 'PVG', 'beijing': 'PEK',
  'guangzhou': 'CAN', 'shenzhen': 'SZX',
  // Europe
  'london': 'LHR', 'paris': 'CDG', 'rome': 'FCO', 'barcelona': 'BCN',
  'amsterdam': 'AMS', 'berlin': 'BER', 'madrid': 'MAD', 'lisbon': 'LIS',
  'athens': 'ATH', 'istanbul': 'IST', 'prague': 'PRG', 'vienna': 'VIE',
  'zurich': 'ZRH', 'santorini': 'JTR', 'mykonos': 'JMK',
  'florence': 'FLR', 'milan': 'MXP', 'venice': 'VCE', 'naples': 'NAP',
  'munich': 'MUC', 'frankfurt': 'FRA', 'dublin': 'DUB', 'edinburgh': 'EDI',
  'budapest': 'BUD', 'warsaw': 'WAW', 'copenhagen': 'CPH',
  'stockholm': 'ARN', 'oslo': 'OSL', 'helsinki': 'HEL',
  'brussels': 'BRU', 'geneva': 'GVA', 'nice': 'NCE',
  'dubrovnik': 'DBV', 'split': 'SPU', 'reykjavik': 'KEF',
  // Americas
  'new york': 'JFK', 'los angeles': 'LAX', 'san francisco': 'SFO',
  'miami': 'MIA', 'chicago': 'ORD', 'seattle': 'SEA', 'boston': 'BOS',
  'las vegas': 'LAS', 'washington': 'IAD', 'dallas': 'DFW',
  'houston': 'IAH', 'denver': 'DEN', 'atlanta': 'ATL',
  'rio de janeiro': 'GIG', 'sao paulo': 'GRU', 'buenos aires': 'EZE',
  'mexico city': 'MEX', 'cancun': 'CUN', 'toronto': 'YYZ',
  'vancouver': 'YVR', 'montreal': 'YUL', 'lima': 'LIM',
  'bogota': 'BOG', 'medellin': 'MDE', 'havana': 'HAV',
  // East Asia
  'kyoto': 'KIX', 'osaka': 'KIX', 'fukuoka': 'FUK',
  // Africa & Middle East
  'marrakech': 'RAK', 'zanzibar': 'ZNZ', 'mauritius': 'MRU',
  'cape town': 'CPT', 'nairobi': 'NBO', 'cairo': 'CAI',
  'johannesburg': 'JNB', 'casablanca': 'CMN', 'tunis': 'TUN',
  'addis ababa': 'ADD', 'dar es salaam': 'DAR', 'accra': 'ACC',
  'lagos': 'LOS', 'seychelles': 'SEZ',
  // Southeast Asia (expanded)
  'krabi': 'KBV', 'pattaya': 'UTP', 'koh samui': 'USM', 'ko samui': 'USM',
  'langkawi': 'LGK', 'penang': 'PEN', 'luang prabang': 'LPQ',
  'yogyakarta': 'JOG', 'lombok': 'LOP', 'da nang': 'DAD',
  'nha trang': 'CXR', 'phu quoc': 'PQC', 'yangon': 'RGN',
  'vientiane': 'VTE', 'brunei': 'BWN',
  // South Asia (expanded)
  'pondicherry': 'PNY', 'jaisalmer': 'JSA',
  'tirupati': 'TIR', 'aurangabad': 'IXU', 'dharamshala': 'DHM',
  'diu': 'DIU',
  // Central Asia / Caucasus
  'tbilisi': 'TBS', 'batumi': 'BUS', 'yerevan': 'EVN', 'baku': 'GYD',
  'tashkent': 'TAS', 'almaty': 'ALA', 'bishkek': 'FRU',
  // South America (expanded)
  'cusco': 'CUZ', 'cartagena': 'CTG', 'santiago': 'SCL',
  'montevideo': 'MVD', 'quito': 'UIO', 'la paz': 'LPB',
  // Turkey (expanded)
  'antalya': 'AYT', 'cappadocia': 'ASR', 'nevsehir': 'NAV',
  'bodrum': 'BJV', 'izmir': 'ADB',
  // Africa (expanded)
  'victoria falls': 'VFA', 'kilimanjaro': 'JRO', 'arusha': 'JRO',
  'windhoek': 'WDH', 'livingstone': 'LVI', 'kigali': 'KGL',
  'entebbe': 'EBB', 'kampala': 'EBB', 'maputo': 'MPM',
  // Nepal / Bhutan
  'pokhara': 'PKR', 'paro': 'PBH', 'bhutan': 'PBH',
  // Oceania
  'sydney': 'SYD', 'melbourne': 'MEL', 'auckland': 'AKL',
  'perth': 'PER', 'brisbane': 'BNE', 'fiji': 'NAN',
  'queenstown': 'ZQN', 'christchurch': 'CHC', 'cairns': 'CNS',
  'gold coast': 'OOL', 'tahiti': 'PPT', 'bora bora': 'BOB',
}

export function cityToIATA(city: string): string | null {
  const key = city.toLowerCase().trim()
  return CITY_IATA[key] || null
}

// ─── Dynamic IATA Lookup via Gemini Grounding ──────────────────
// For cities not in our static map, ask Gemini to find the nearest airport.
// Results are cached in the static map for future lookups.

const pendingLookups = new Map<string, Promise<string | null>>()

/**
 * Get IATA code for any city worldwide.
 * Uses static map first, then Gemini grounding as fallback.
 * Caches results in memory for the process lifetime.
 */
export async function resolveIATA(city: string): Promise<string | null> {
  const key = city.toLowerCase().trim()

  // Check static map first
  const cached = CITY_IATA[key]
  if (cached) return cached

  // Deduplicate concurrent lookups for same city
  if (pendingLookups.has(key)) return pendingLookups.get(key)!

  const promise = lookupIATAViaGrounding(city).then(code => {
    pendingLookups.delete(key)
    if (code) {
      CITY_IATA[key] = code // Cache for future use
      console.log(`[IATA] Resolved ${city} → ${code} (via Gemini grounding)`)
    }
    return code
  })

  pendingLookups.set(key, promise)
  return promise
}

async function lookupIATAViaGrounding(city: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `What is the nearest major airport IATA code for ${city}? Reply with ONLY the 3-letter IATA code, nothing else.` }] }],
          tools: [{ google_search: {} }],
        }),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
    // Extract 3-letter code
    const match = text.match(/\b([A-Z]{3})\b/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ─── Format helpers ───────────────────────────────────────────

function formatDuration(iso: string): string {
  // PT10H30M → "10h 30m"
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return iso
  const h = match[1] ? `${match[1]}h` : ''
  const m = match[2] ? `${match[2]}m` : ''
  return [h, m].filter(Boolean).join(' ')
}

function formatTime(isoDatetime: string): string {
  // 2026-04-10T06:30:00 → "06:30"
  const match = isoDatetime.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : isoDatetime
}

// ─── Airline names (common) ───────────────────────────────────
const AIRLINES: Record<string, string> = {
  '6E': 'IndiGo', 'AI': 'Air India', 'UK': 'Vistara', 'SG': 'SpiceJet',
  'G8': 'Go First', 'QP': 'Akasa Air', 'IX': 'Air India Express',
  'EK': 'Emirates', 'QR': 'Qatar Airways', 'SQ': 'Singapore Airlines',
  'TG': 'Thai Airways', 'CX': 'Cathay Pacific', 'BA': 'British Airways',
  'LH': 'Lufthansa', 'AF': 'Air France', 'KL': 'KLM', 'TK': 'Turkish Airlines',
  'EY': 'Etihad', 'GA': 'Garuda Indonesia', 'MH': 'Malaysia Airlines',
  'JL': 'Japan Airlines', 'NH': 'ANA', 'OZ': 'Asiana', 'KE': 'Korean Air',
  'AA': 'American Airlines', 'UA': 'United Airlines', 'DL': 'Delta',
  'WN': 'Southwest', 'QF': 'Qantas', 'NZ': 'Air New Zealand',
  'SA': 'South African', 'ET': 'Ethiopian Airlines', 'MS': 'EgyptAir',
  'FR': 'Ryanair', 'U2': 'easyJet', 'W6': 'Wizz Air',
}

// ─── Search Flights ───────────────────────────────────────────

export async function searchFlights(params: {
  origin: string      // city name or IATA
  destination: string // city name or IATA
  departureDate: string // YYYY-MM-DD
  returnDate?: string
  adults?: number
  maxResults?: number
}): Promise<FlightOffer[]> {
  const originCode = params.origin.length === 3 ? params.origin : cityToIATA(params.origin)
  const destCode = params.destination.length === 3 ? params.destination : cityToIATA(params.destination)

  if (!originCode || !destCode) {
    throw new Error(`Unknown airport: ${!originCode ? params.origin : params.destination}. Use IATA code directly.`)
  }

  const token = await getToken()

  const query = new URLSearchParams({
    originLocationCode: originCode,
    destinationLocationCode: destCode,
    departureDate: params.departureDate,
    adults: String(params.adults || 1),
    max: String(params.maxResults || 5),
    currencyCode: 'USD',
  })
  if (params.returnDate) {
    query.set('returnDate', params.returnDate)
  }

  const res = await fetch(`${BASE_URL}/v2/shopping/flight-offers?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Amadeus flight search failed: ${err}`)
  }

  const data = await res.json()
  const dictionaries = data.dictionaries || {}
  const carriers = dictionaries.carriers || {}

  return (data.data || []).map((offer: Record<string, unknown>): FlightOffer => {
    const itineraries = offer.itineraries as Array<{
      duration: string
      segments: Array<{
        carrierCode: string
        number: string
        departure: { iataCode: string; at: string; terminal?: string }
        arrival: { iataCode: string; at: string; terminal?: string }
      }>
    }>
    const price = offer.price as { total: string; currency: string }
    const firstSeg = itineraries[0].segments[0]
    const lastSeg = itineraries[0].segments[itineraries[0].segments.length - 1]
    const stops = itineraries[0].segments.length - 1
    const airlineCode = firstSeg.carrierCode

    return {
      airline: airlineCode,
      airlineName: carriers[airlineCode] || AIRLINES[airlineCode] || airlineCode,
      flightNumber: `${airlineCode}${firstSeg.number}`,
      departure: {
        airport: firstSeg.departure.iataCode,
        time: firstSeg.departure.at,
        terminal: firstSeg.departure.terminal,
      },
      arrival: {
        airport: lastSeg.arrival.iataCode,
        time: lastSeg.arrival.at,
        terminal: lastSeg.arrival.terminal,
      },
      duration: formatDuration(itineraries[0].duration),
      stops,
      price: `$${Math.round(parseFloat(price.total))}`,
      currency: price.currency,
      cabin: 'economy',
      bookingUrl: buildSkyscannerLink(
        firstSeg.departure.iataCode,
        lastSeg.arrival.iataCode,
        params.departureDate,
        params.adults || 1,
      ),
    }
  })
}

// ─── Grounded Flight Search (Fallback) ──────────────────────
// When Amadeus test env returns no results, use Gemini + Google Search
// to find real flight options with prices.

export async function searchFlightsGrounded(params: {
  origin: string
  destination: string
  departureDate: string
  adults: number
}): Promise<FlightOffer[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  const originCode = params.origin.length === 3 ? params.origin : (cityToIATA(params.origin) || params.origin)
  const destCode = params.destination.length === 3 ? params.destination : (cityToIATA(params.destination) || params.destination)

  try {
    console.log(`[Flights] Amadeus empty — trying grounded search: ${originCode} → ${destCode}`)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Find 3 real flights from ${params.origin} (${originCode}) to ${params.destination} (${destCode}) on ${params.departureDate} for ${params.adults} adults.

Return ONLY a JSON array: [{"airline":"Airline Name","flightNumber":"XX123","departureAirport":"${originCode}","arrivalAirport":"${destCode}","departureTime":"HH:MM","duration":"Xh Ym","stops":0,"priceUSD":123}]
JSON only, no markdown.` }] }],
          tools: [{ google_search: {} }],
        }),
      },
    )
    if (!res.ok) return []
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []

    const flights = JSON.parse(match[0]) as Array<{
      airline: string; flightNumber: string; departureAirport: string; arrivalAirport: string;
      departureTime: string; duration: string; stops: number; priceUSD: number
    }>

    console.log(`[Flights] Grounded search found ${flights.length} flights`)

    return flights.map(f => ({
      airline: f.flightNumber?.slice(0, 2) || '',
      airlineName: f.airline,
      flightNumber: f.flightNumber || '',
      departure: { airport: f.departureAirport || originCode, time: `${params.departureDate}T${f.departureTime || '08:00'}:00` },
      arrival: { airport: f.arrivalAirport || destCode, time: '' },
      duration: f.duration || '',
      stops: f.stops || 0,
      price: `$${Math.round(f.priceUSD || 0)}`,
      currency: 'USD',
      cabin: 'economy' as const,
      bookingUrl: buildSkyscannerLink(
        f.departureAirport || originCode,
        f.arrivalAirport || destCode,
        params.departureDate,
        params.adults,
      ),
    }))
  } catch (e) {
    console.warn(`[Flights] Grounded search failed: ${e}`)
    return []
  }
}

// ─── Booking deep links ─────────────────────────────────────
// Skyscanner redirect link (works without affiliate ID, add later for revenue)

function buildSkyscannerLink(origin: string, dest: string, date: string, adults: number): string {
  // Skyscanner URL format: /transport/flights/{from}/{to}/{date}/
  const dateFormatted = date.replace(/-/g, '').slice(2) // 2026-04-10 → 260410
  return `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${dateFormatted}/?adults=${adults}&preferdirects=false`
}

// ─── Convert FlightOffer → Itinerary Item shape ──────────────

export function flightToItineraryItem(flight: FlightOffer, position: number) {
  // Build reason and whyFactors from flight attributes
  const whyFactors: string[] = []
  if (flight.stops === 0) whyFactors.push('Direct flight — no layovers')
  else whyFactors.push(`${flight.stops} stop${flight.stops > 1 ? 's' : ''} — ${flight.duration} total`)

  whyFactors.push(`${flight.airlineName} — reliable carrier`)

  const depHour = parseInt(flight.departure.time.match(/T(\d{2})/)?.[1] || '12')
  if (depHour >= 6 && depHour <= 10) whyFactors.push('Morning departure — arrive with time to spare')
  else if (depHour >= 10 && depHour <= 14) whyFactors.push('Midday departure — no early alarm')
  else if (depHour >= 20 || depHour < 6) whyFactors.push('Red-eye — saves a day of travel')

  const reason = flight.stops === 0
    ? `Best direct option on ${flight.airlineName}`
    : `Best price-to-comfort on this route`

  return {
    category: 'flight' as const,
    name: `${flight.departure.airport} → ${flight.arrival.airport}`,
    detail: `${flight.airlineName} ${flight.flightNumber}`,
    description: `${flight.airlineName} flight from ${flight.departure.airport} to ${flight.arrival.airport}. ${flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}, ${flight.duration}.`,
    price: flight.price,
    time: formatTime(flight.departure.time),
    position,
    metadata: {
      reason,
      whyFactors,
      info: [
        { l: 'Airline', v: flight.airlineName },
        { l: 'Flight', v: flight.flightNumber },
        { l: 'Duration', v: flight.duration },
        { l: 'Stops', v: flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}` },
      ],
      features: [
        flight.departure.terminal ? `Terminal ${flight.departure.terminal}` : null,
        flight.cabin.charAt(0).toUpperCase() + flight.cabin.slice(1),
      ].filter(Boolean),
      departure: flight.departure,
      arrival: flight.arrival,
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      bookingUrl: flight.bookingUrl,
      skyscannerUrl: flight.bookingUrl,
      alts: [] as Array<{ name: string; detail: string; price: string; trust?: Array<{ type: string; text: string }> }>,
    },
  }
}

// ─── Grounded Transport Search (Trains/Buses for Domestic) ─────

export interface TransportOption {
  mode: 'train' | 'bus'
  operatorName: string
  serviceNumber?: string
  departureStation: string
  arrivalStation: string
  duration: string
  price: string
  class?: string
  bookingUrl: string
}

export async function searchGroundedTransport(params: {
  origin: string
  destination: string
  departureDate: string
  adults?: number
}): Promise<TransportOption[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  const { origin, destination, departureDate } = params

  try {
    console.log(`[Transport] Searching trains/buses: ${origin} → ${destination}`)
    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Find 3-4 real train and bus options from ${origin} to ${destination} in India for travel on ${departureDate}.

Include:
- Indian Railways trains (Rajdhani, Shatabdi, Duronto, Garib Rath, Vande Bharat, superfast, express)
- Major bus operators (state transport like KSRTC/RSRTC/UPSRTC, private Volvo AC sleeper/seater)

Return ONLY a JSON array, no other text:
[{
  "mode": "train" or "bus",
  "operatorName": "Indian Railways" or bus operator name,
  "serviceNumber": "train number or empty",
  "serviceName": "Rajdhani Express" etc,
  "departureStation": "station name",
  "arrivalStation": "station name",
  "duration": "5h 30m",
  "priceUSD": 15,
  "class": "AC 3-Tier" or "Volvo AC Sleeper" etc
}]

Use real train names, real stations, realistic durations and prices. Prices in USD.` }] }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.warn(`[Transport] Gemini returned ${res.status}`)
      return []
    }

    const data = await res.json()
    const rawText = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
    // Strip markdown code fences
    const text = rawText.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

    console.log(`[Transport] Got ${text.length} chars response`)

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn(`[Transport] No JSON array found in response: ${text.slice(0, 200)}`)
      return []
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      mode: string; operatorName: string; serviceNumber?: string; serviceName?: string
      departureStation: string; arrivalStation: string; duration: string; priceUSD: number; class?: string
    }>

    const originSlug = origin.toLowerCase().replace(/\s+/g, '-')
    const destSlug = destination.toLowerCase().replace(/\s+/g, '-')

    return parsed.slice(0, 4).map(t => ({
      mode: (t.mode === 'bus' ? 'bus' : 'train') as 'train' | 'bus',
      operatorName: t.serviceName || t.operatorName || (t.mode === 'train' ? 'Indian Railways' : 'Bus'),
      serviceNumber: t.serviceNumber,
      departureStation: t.departureStation,
      arrivalStation: t.arrivalStation,
      duration: t.duration,
      price: `$${t.priceUSD || 10}`,
      class: t.class,
      bookingUrl: t.mode === 'train'
        ? 'https://www.irctc.co.in/nget/train-search'
        : `https://www.redbus.in/bus-tickets/${originSlug}-to-${destSlug}`,
    }))
  } catch (e) {
    console.warn(`[Transport] Grounded search failed: ${e}`)
    return []
  }
}

export function transportToItineraryItem(transport: TransportOption, position: number) {
  const modeLabel = transport.mode === 'train' ? 'Train' : 'Bus'
  const whyFactors: string[] = [
    `${transport.operatorName}${transport.serviceNumber ? ` (${transport.serviceNumber})` : ''}`,
    `${transport.duration} travel time`,
    transport.class || (transport.mode === 'train' ? 'AC class' : 'AC bus'),
  ]

  return {
    category: 'flight' as const,
    image_url: '',
    name: `${transport.departureStation} → ${transport.arrivalStation}`,
    detail: `${transport.operatorName}${transport.serviceNumber ? ` ${transport.serviceNumber}` : ''}`,
    description: `${modeLabel} from ${transport.departureStation} to ${transport.arrivalStation}. ${transport.duration}, ${transport.class || ''}.`,
    price: transport.price,
    time: '',
    position,
    metadata: {
      transport_mode: transport.mode,
      reason: `Best ${modeLabel.toLowerCase()} option on this route`,
      whyFactors,
      info: [
        { l: modeLabel, v: transport.operatorName },
        ...(transport.serviceNumber ? [{ l: 'Number', v: transport.serviceNumber }] : []),
        { l: 'Duration', v: transport.duration },
        { l: 'Class', v: transport.class || 'Standard' },
      ],
      features: [transport.class].filter(Boolean),
      bookingUrl: transport.bookingUrl,
      alts: [] as Array<{ name: string; detail: string; price: string }>,
    },
  }
}
