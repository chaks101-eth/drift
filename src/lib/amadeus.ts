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
  'delhi': 'DEL', 'new delhi': 'DEL', 'mumbai': 'BOM', 'bangalore': 'BLR',
  'chennai': 'MAA', 'kolkata': 'CCU', 'hyderabad': 'HYD', 'goa': 'GOI',
  'jaipur': 'JAI', 'ahmedabad': 'AMD', 'pune': 'PNQ', 'kochi': 'COK',
  'bali': 'DPS', 'denpasar': 'DPS', 'bangkok': 'BKK', 'tokyo': 'NRT',
  'singapore': 'SIN', 'hanoi': 'HAN', 'seoul': 'ICN', 'dubai': 'DXB',
  'maldives': 'MLE', 'male': 'MLE', 'colombo': 'CMB', 'sri lanka': 'CMB',
  'hong kong': 'HKG', 'phuket': 'HKT', 'kuala lumpur': 'KUL',
  'ho chi minh': 'SGN', 'saigon': 'SGN', 'kathmandu': 'KTM',
  'london': 'LHR', 'paris': 'CDG', 'rome': 'FCO', 'barcelona': 'BCN',
  'amsterdam': 'AMS', 'berlin': 'BER', 'madrid': 'MAD', 'lisbon': 'LIS',
  'athens': 'ATH', 'istanbul': 'IST', 'prague': 'PRG', 'vienna': 'VIE',
  'zurich': 'ZRH', 'santorini': 'JTR', 'mykonos': 'JMK',
  'new york': 'JFK', 'los angeles': 'LAX', 'san francisco': 'SFO',
  'miami': 'MIA', 'chicago': 'ORD', 'seattle': 'SEA', 'boston': 'BOS',
  'sydney': 'SYD', 'melbourne': 'MEL', 'auckland': 'AKL',
  'cape town': 'CPT', 'nairobi': 'NBO', 'cairo': 'CAI',
  'rio de janeiro': 'GIG', 'sao paulo': 'GRU', 'buenos aires': 'EZE',
  'mexico city': 'MEX', 'cancun': 'CUN', 'toronto': 'YYZ',
  'vancouver': 'YVR', 'kyoto': 'KIX', 'osaka': 'KIX',
  'marrakech': 'RAK', 'zanzibar': 'ZNZ', 'mauritius': 'MRU',
}

export function cityToIATA(city: string): string | null {
  const key = city.toLowerCase().trim()
  return CITY_IATA[key] || null
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
