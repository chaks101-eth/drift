// ─── Remotion Renderer ───────────────────────────────────────
// Renders a DriftReel composition to MP4 from trip data.
// Usage: npx tsx src/remotion/render.ts --destination "Colombo & Galle"

import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { ReelProps, ReelSlide } from './types'

async function main() {
  const args = process.argv.slice(2)
  const destArg = args.find(a => a.startsWith('--destination'))
  const destination = args[args.indexOf('--destination') + 1] || 'Colombo & Galle'
  const tripIdArg = args[args.indexOf('--tripId') + 1]
  const outputPath = args[args.indexOf('--output') + 1] || `growth/videos/${destination.toLowerCase().replace(/\s+/g, '_')}_reel.mp4`

  console.log(`🎬 Rendering reel for: ${destination}`)

  // Load trip data
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  let tripId = tripIdArg
  if (!tripId) {
    const { data: trips } = await db
      .from('trips')
      .select('id, destination, country, vibes')
      .ilike('destination', `%${destination}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!trips?.length) { console.error('Trip not found'); process.exit(1) }
    tripId = trips[0].id
  }

  const { data: trip } = await db.from('trips').select('*').eq('id', tripId).single()
  if (!trip) { console.error('Trip not found'); process.exit(1) }

  const { data: items } = await db
    .from('itinerary_items')
    .select('name, category, price, image_url, description, metadata')
    .eq('trip_id', tripId)
    .not('image_url', 'is', null)
    .neq('category', 'day')
    .neq('category', 'hotel')
    .order('position')
    .limit(5)

  if (!items?.length) { console.error('No items with images'); process.exit(1) }

  // Resolve Google Places photo URLs to public URLs
  const placesKey = process.env.GOOGLE_PLACES_API_KEY
  const slides: ReelSlide[] = []

  for (const item of items) {
    let imageUrl = item.image_url || ''

    if (imageUrl.includes('googleapis.com') && placesKey) {
      try {
        const res = await fetch(`${imageUrl}&key=${placesKey}`, { redirect: 'manual' })
        const location = res.headers.get('location')
        if (location) imageUrl = location
      } catch {
        // keep original
      }
    }

    slides.push({
      name: item.name,
      category: item.category,
      price: item.price || '',
      rating: (item.metadata as Record<string, unknown>)?.rating as number | undefined,
      imageUrl,
      description: item.description?.slice(0, 60) || '',
    })
  }

  // Get eval score
  const { data: evalResult } = await db
    .from('eval_results')
    .select('overall_score')
    .eq('destination', trip.destination)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const inputProps: ReelProps = {
    destination: trip.destination,
    country: trip.country || '',
    vibes: trip.vibes || [],
    evalScore: evalResult?.overall_score || undefined,
    slides,
    ctaUrl: 'https://driftntravel.com',
  }

  console.log(`📊 ${slides.length} slides, eval: ${inputProps.evalScore || 'N/A'}`)
  console.log(`📐 Rendering 1080x1920 @ 30fps...`)

  // Bundle the Remotion project
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, 'index.ts'),
    webpackOverride: (config) => config,
  })

  const fps = 30
  const totalDuration = (3 + slides.length * 3 + 3) * fps

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'DriftReel',
    inputProps: inputProps as unknown as Record<string, unknown>,
  })

  // Override duration based on actual slides
  composition.durationInFrames = totalDuration
  composition.props = inputProps as unknown as Record<string, unknown>

  // Ensure output directory exists
  const fs = await import('fs')
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // Render
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: inputProps as unknown as Record<string, unknown>,
  })

  console.log(`✅ Rendered: ${outputPath}`)
  console.log(`📱 Duration: ${totalDuration / fps}s`)
  console.log(`🎯 Upload to Instagram/TikTok or use /api/growth/post`)
}

main().catch(err => {
  console.error('Render failed:', err)
  process.exit(1)
})
