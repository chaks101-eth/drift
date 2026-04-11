import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

// GET /api/places/photos?q=Bali,Indonesia&count=6
// Returns array of photo URLs for a destination
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  const count = Math.min(10, parseInt(req.nextUrl.searchParams.get('count') || '6'))

  if (!q || !API_KEY) {
    return NextResponse.json({ photos: [] })
  }

  try {
    // Find the place
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(q)}&inputtype=textquery&fields=place_id&key=${API_KEY}`
    const findRes = await fetch(findUrl)
    const findData = await findRes.json()

    if (findData.status !== 'OK' || !findData.candidates?.[0]?.place_id) {
      return NextResponse.json({ photos: [] })
    }

    // Get place details with photos
    const placeId = findData.candidates[0].place_id
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${API_KEY}`
    const detailRes = await fetch(detailUrl)
    const detailData = await detailRes.json()

    if (detailData.status !== 'OK' || !detailData.result?.photos?.length) {
      return NextResponse.json({ photos: [] })
    }

    // Convert photo references to URLs
    const photos = detailData.result.photos
      .slice(0, count)
      .map((p: { photo_reference: string }) =>
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${API_KEY}`
      )

    return NextResponse.json({ photos }, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' }, // cache 24h
    })
  } catch {
    return NextResponse.json({ photos: [] })
  }
}
