import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/growth/video — generate reel/tiktok video from trip photos
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { destination, tripId, style = 'slideshow', duration = 15, aspectRatio = '9:16' } = await req.json() as {
    destination?: string; tripId?: string; style?: string; duration?: number; aspectRatio?: string
  }

  const db = getDb()

  // Find trip
  let trip: Record<string, unknown> | null = null
  if (tripId) {
    const { data } = await db.from('trips').select('id, destination, country, vibes').eq('id', tripId).single()
    trip = data
  } else if (destination) {
    const { data } = await db.from('trips').select('id, destination, country, vibes').ilike('destination', destination).order('created_at', { ascending: false }).limit(1).single()
    trip = data
  }

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // Get items with photos + ratings
  const { data: items } = await db
    .from('itinerary_items')
    .select('name, category, price, image_url, description, metadata')
    .eq('trip_id', trip.id as string)
    .not('image_url', 'is', null)
    .neq('category', 'day')
    .order('position')
    .limit(8)

  if (!items?.length) return NextResponse.json({ error: 'No items with photos found' }, { status: 404 })

  const slides = items.map((item, i) => ({
    index: i + 1,
    name: item.name,
    category: item.category,
    price: item.price,
    imageUrl: item.image_url,
    rating: (item.metadata as Record<string, unknown>)?.rating as number | undefined,
    description: item.description?.slice(0, 60) || '',
    overlay: `${item.name}${item.price ? ` — ${item.price}` : ''}${(item.metadata as Record<string, unknown>)?.rating ? ` ★${(item.metadata as Record<string, unknown>)?.rating}` : ''}`,
  }))

  const dest = trip.destination as string
  const vibes = (trip.vibes as string[]) || []

  // ─── Try Kling + ElevenLabs + Remotion pipeline ────

  if (process.env.KLING_ACCESS_KEY || process.env.KLING_API_KEY) {
    try {
      const { runVideoPipeline } = await import('@/lib/video-pipeline')
      const pipelineResult = await runVideoPipeline(dest, trip.id as string)

      const videoSlides = pipelineResult.slides.map((s, i) => ({
        index: i + 1,
        name: s.name,
        category: s.category,
        price: s.price,
        imageUrl: s.imageUrl,
        videoClipUrl: s.videoClipUrl,
        rating: s.rating,
        description: s.description,
        overlay: `${s.name}${s.price ? ` — ${s.price}` : ''}${s.rating ? ` ★${s.rating}` : ''}`,
      }))

      await saveVideoContent(db, dest, trip.id as string, videoSlides, null, 'kling+elevenlabs')

      return NextResponse.json({
        slides: videoSlides,
        script: pipelineResult.script,
        voiceoverUrl: pipelineResult.voiceoverUrl || null,
        clipCount: pipelineResult.slides.filter(s => s.videoClipUrl).length,
        totalDuration: pipelineResult.totalDuration,
        rendered: true,
        renderer: 'kling+elevenlabs',
        instructions: pipelineResult.voiceoverUrl
          ? 'Video clips + voiceover generated. Run Remotion to compose: npx remotion render DriftReel'
          : 'Video clips generated. Add ELEVENLABS_API_KEY for voiceover.',
      })
    } catch (err) {
      console.error('[Video] Kling pipeline failed:', err)
      // Fall through to next renderer
    }
  }

  // ─── Try Creatomate ────────────────────────────────

  if (process.env.CREATOMATE_API_KEY) {
    try {
      // Build Creatomate render request
      const elements = slides.flatMap((slide, i) => [
        {
          type: 'image',
          source: slide.imageUrl,
          duration: duration / slides.length,
          time: i * (duration / slides.length),
          animations: [{ type: 'scale', scope: 'element', start_scale: '100%', end_scale: '120%' }],
        },
        {
          type: 'text',
          text: slide.overlay,
          time: i * (duration / slides.length),
          duration: duration / slides.length,
          y: '80%',
          width: '90%',
          x_alignment: '50%',
          font_family: 'Inter',
          font_weight: '600',
          font_size: '32px',
          fill_color: '#ffffff',
          background_color: 'rgba(0,0,0,0.6)',
          background_x_padding: '16px',
          background_y_padding: '8px',
          background_border_radius: '8px',
        },
      ])

      // Add intro slide
      elements.unshift({
        type: 'text' as const,
        text: `${dest}\n${vibes.join(' · ')}`,
        time: 0,
        duration: 2,
        y: '45%',
        width: '80%',
        x_alignment: '50%',
        font_family: 'Playfair Display',
        font_weight: '600',
        font_size: '48px',
        fill_color: '#c8a44e',
        background_color: 'rgba(8,8,12,0.8)',
        background_x_padding: '24px',
        background_y_padding: '16px',
        background_border_radius: '12px',
      } as unknown as typeof elements[0])

      const res = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_format: 'mp4',
          width: aspectRatio === '9:16' ? 1080 : 1920,
          height: aspectRatio === '9:16' ? 1920 : 1080,
          duration,
          elements,
        }),
      })
      const renders = await res.json()
      const videoUrl = renders[0]?.url || ''

      if (videoUrl) {
        await saveVideoContent(db, dest, trip.id as string, slides, videoUrl, 'creatomate')
        return NextResponse.json({ videoUrl, slides: slides.length, duration, style, aspectRatio, rendered: true, renderer: 'creatomate' })
      }
    } catch (err) {
      // Fall through to next renderer
      console.error('[Video] Creatomate failed:', err)
    }
  }

  // ─── Try Shotstack ─────────────────────────────────

  if (process.env.SHOTSTACK_API_KEY) {
    try {
      const clips = slides.map((slide, i) => ({
        asset: { type: 'image', src: slide.imageUrl },
        start: i * (duration / slides.length),
        length: duration / slides.length,
        effect: 'zoomIn',
      }))

      const textClips = slides.map((slide, i) => ({
        asset: {
          type: 'html',
          html: `<div style="font-family:Inter;font-size:28px;color:white;background:rgba(0,0,0,0.6);padding:8px 16px;border-radius:8px;">${slide.overlay}</div>`,
          width: 400,
          height: 80,
        },
        start: i * (duration / slides.length),
        length: duration / slides.length,
        position: 'bottom',
        offset: { y: -0.1 },
      }))

      const res = await fetch('https://api.shotstack.io/edit/v1/render', {
        method: 'POST',
        headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeline: {
            tracks: [
              { clips: textClips },
              { clips },
            ],
          },
          output: {
            format: 'mp4',
            resolution: aspectRatio === '9:16' ? 'mobile' : 'hd',
            aspectRatio: aspectRatio,
          },
        }),
      })
      const result = await res.json()

      // Shotstack is async — poll for result
      const renderId = result?.response?.id
      if (renderId) {
        // Poll up to 60s
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 5000))
          const statusRes = await fetch(`https://api.shotstack.io/edit/v1/render/${renderId}`, {
            headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY! },
          })
          const statusData = await statusRes.json()
          if (statusData?.response?.status === 'done') {
            const videoUrl = statusData.response.url
            await saveVideoContent(db, dest, trip.id as string, slides, videoUrl, 'shotstack')
            return NextResponse.json({ videoUrl, slides: slides.length, duration, style, aspectRatio, rendered: true, renderer: 'shotstack' })
          }
          if (statusData?.response?.status === 'failed') break
        }
      }
    } catch (err) {
      console.error('[Video] Shotstack failed:', err)
    }
  }

  // ─── No video API — return slide data ──────────────

  await saveVideoContent(db, dest, trip.id as string, slides, null, 'manual')

  return NextResponse.json({
    videoUrl: null,
    slides,
    duration,
    style,
    aspectRatio,
    rendered: false,
    renderer: 'none',
    instructions: 'No video API configured. Add CREATOMATE_API_KEY ($12/mo) or SHOTSTACK_API_KEY ($25/mo) to .env.local. Slide data saved to content queue.',
    envVarsNeeded: {
      creatomate: 'CREATOMATE_API_KEY',
      shotstack: 'SHOTSTACK_API_KEY',
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveVideoContent(
  db: any,
  destination: string,
  tripId: string,
  slides: Array<{ name: string; imageUrl: string | null; overlay: string }>,
  videoUrl: string | null,
  renderer: string,
) {
  await db.from('growth_content').insert({
    platform: 'instagram',
    content_type: 'reel',
    title: `${destination} — ${slides.length} must-visit spots`,
    body: `Slides:\n${slides.map((s, i) => `${i + 1}. ${s.overlay}`).join('\n')}\n\nRenderer: ${renderer}`,
    media_urls: slides.map(s => s.imageUrl).filter(Boolean) as string[],
    video_url: videoUrl,
    destination,
    trip_id: tripId,
    status: 'draft',
    utm_campaign: `video_${destination.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
  })
}
