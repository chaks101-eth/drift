import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/growth/video — generate video from trip photos
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { destination, tripId, style = 'slideshow', duration = 15 } = await req.json() as {
    destination?: string; tripId?: string; style?: string; duration?: number
  }

  const db = getDb()

  // Find trip
  let trip
  if (tripId) {
    const { data } = await db.from('trips').select('id, destination, country, vibes').eq('id', tripId).single()
    trip = data
  } else if (destination) {
    const { data } = await db.from('trips').select('id, destination, country, vibes').ilike('destination', destination).order('created_at', { ascending: false }).limit(1).single()
    trip = data
  }

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // Get items with photos
  const { data: items } = await db
    .from('itinerary_items')
    .select('name, category, price, image_url, metadata')
    .eq('trip_id', trip.id)
    .not('image_url', 'is', null)
    .neq('category', 'day')
    .order('position')
    .limit(8)

  if (!items?.length) return NextResponse.json({ error: 'No items with photos' }, { status: 404 })

  const slides = items.map(item => ({
    name: item.name,
    category: item.category,
    price: item.price,
    imageUrl: item.image_url,
    rating: (item.metadata as Record<string, unknown>)?.rating,
  }))

  // Check for video API
  const shotstackKey = process.env.SHOTSTACK_API_KEY
  const creatomateKey = process.env.CREATOMATE_API_KEY

  if (creatomateKey) {
    // Creatomate rendering
    try {
      const res = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creatomateKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: process.env.CREATOMATE_TEMPLATE_ID,
          modifications: slides.map((s, i) => ({
            [`image_${i + 1}`]: s.imageUrl,
            [`text_${i + 1}`]: `${s.name} — ${s.price}${s.rating ? ` ★${s.rating}` : ''}`,
          })).reduce((a, b) => ({ ...a, ...b }), {}),
        }),
      })
      const render = await res.json()
      const videoUrl = render[0]?.url || ''

      // Save as content
      await db.from('growth_content').insert({
        platform: 'instagram',
        content_type: 'reel',
        title: `${trip.destination} in ${duration}s`,
        body: `${slides.length} slides from a real ${trip.destination} trip`,
        media_urls: slides.map(s => s.imageUrl),
        video_url: videoUrl,
        destination: trip.destination,
        trip_id: trip.id,
        status: 'draft',
      })

      return NextResponse.json({ videoUrl, slides: slides.length, duration, style, rendered: true })
    } catch (err) {
      return NextResponse.json({ error: `Creatomate failed: ${err}` }, { status: 500 })
    }
  }

  if (shotstackKey) {
    // Similar Shotstack integration would go here
    return NextResponse.json({ error: 'Shotstack integration not yet implemented', slides }, { status: 501 })
  }

  // No video API — return slide data for manual creation
  await db.from('growth_content').insert({
    platform: 'instagram',
    content_type: 'reel',
    title: `${trip.destination} in ${duration}s`,
    body: `Slides:\n${slides.map((s, i) => `${i + 1}. ${s.name} — ${s.price}${s.rating ? ` ★${s.rating}` : ''}`).join('\n')}`,
    media_urls: slides.map(s => s.imageUrl).filter(Boolean) as string[],
    destination: trip.destination,
    trip_id: trip.id,
    status: 'draft',
  })

  return NextResponse.json({
    videoUrl: null,
    slides,
    duration,
    style,
    rendered: false,
    instructions: 'No video API configured (CREATOMATE_API_KEY or SHOTSTACK_API_KEY). Slide data saved to content queue for manual video creation.',
  })
}
