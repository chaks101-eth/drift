import { NextRequest, NextResponse } from 'next/server'
import { searchFlights, cityToIATA } from '@/lib/amadeus'
import { createServerClient } from '@/lib/supabase'

// POST /api/flights — search real flights via Amadeus
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { origin, destination, departureDate, returnDate, adults } = body

  if (!origin || !destination || !departureDate) {
    return NextResponse.json(
      { error: 'Missing required fields: origin, destination, departureDate' },
      { status: 400 }
    )
  }

  try {
    const flights = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate,
      adults: adults || 1,
      maxResults: 5,
    })

    return NextResponse.json({ flights })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Flight search error:', msg)

    // If it's an unknown city, tell the client
    if (msg.includes('Unknown airport')) {
      return NextResponse.json({ error: msg, flights: [] }, { status: 400 })
    }

    return NextResponse.json({ error: `Flight search failed: ${msg}`, flights: [] }, { status: 500 })
  }
}

// GET /api/flights/iata?city=bali — helper to resolve city → IATA
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city')
  if (!city) return NextResponse.json({ error: 'Missing city param' }, { status: 400 })

  const code = cityToIATA(city)
  return NextResponse.json({ city, iata: code })
}
