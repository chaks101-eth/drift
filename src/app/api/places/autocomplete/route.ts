import { NextRequest, NextResponse } from 'next/server'

// GET /api/places/autocomplete?q=istan — returns city/region suggestions
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ predictions: [] })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return NextResponse.json({ predictions: [] })

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${apiKey}`
    )
    const data = await res.json()

    const predictions = (data.predictions || []).slice(0, 5).map((p: {
      structured_formatting: { main_text: string; secondary_text: string }
      description: string
      place_id: string
    }) => ({
      city: p.structured_formatting.main_text,
      country: p.structured_formatting.secondary_text,
      description: p.description,
      placeId: p.place_id,
    }))

    return NextResponse.json({ predictions })
  } catch {
    return NextResponse.json({ predictions: [] })
  }
}
