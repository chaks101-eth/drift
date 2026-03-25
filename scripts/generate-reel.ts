#!/usr/bin/env npx tsx
// ─── Generate High-Quality Reel ──────────────────────────────
// Full pipeline: trip data → script → voiceover → video clips → compose → MP4
//
// Usage:
//   npx tsx scripts/generate-reel.ts "Colombo & Galle"
//   npx tsx scripts/generate-reel.ts "Istanbul" --skip-clips  (photos only, no AI video)
//   npx tsx scripts/generate-reel.ts "Bali" --skip-voice     (no voiceover)

import { runVideoPipeline } from '../src/lib/video-pipeline'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'

async function main() {
  const destination = process.argv[2]
  if (!destination) {
    console.error('Usage: npx tsx scripts/generate-reel.ts "Destination Name"')
    process.exit(1)
  }

  const skipClips = process.argv.includes('--skip-clips')
  const skipVoice = process.argv.includes('--skip-voice')

  console.log(`\n🎬 DRIFT REEL GENERATOR`)
  console.log(`   Destination: ${destination}`)
  console.log(`   Video clips: ${skipClips ? 'SKIP (photos only)' : 'AI generation'}`)
  console.log(`   Voiceover: ${skipVoice ? 'SKIP' : 'ElevenLabs AI'}`)
  console.log('')

  // Step 1-4: Run the video pipeline
  const result = await runVideoPipeline(destination)

  const outputDir = `growth/videos/${destination.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const outputPath = `${outputDir}/reel.mp4`

  // Step 5: Copy audio assets to public/ for Remotion to serve
  if (result.voiceoverUrl && fs.existsSync(result.voiceoverUrl)) {
    const publicAudioDir = path.resolve('public/audio')
    if (!fs.existsSync(publicAudioDir)) fs.mkdirSync(publicAudioDir, { recursive: true })
    fs.copyFileSync(result.voiceoverUrl, path.join(publicAudioDir, 'voiceover.mp3'))
    console.log('🔊 Voiceover copied to public/audio/voiceover.mp3')
  }

  // Step 6: Render with Remotion
  console.log('\n🎞️ Composing final video with Remotion...')

  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, '../src/remotion/index.ts'),
    webpackOverride: (config) => config,
  })

  const fps = 30
  const totalDuration = (3 + result.slides.length * 3 + 3) * fps

  const inputProps = {
    destination: result.destination,
    country: result.country,
    vibes: result.vibes,
    evalScore: result.evalScore,
    slides: result.slides.map(s => ({
      name: s.name,
      category: s.category,
      price: s.price,
      rating: s.rating,
      imageUrl: s.imageUrl,
      videoClipUrl: s.videoClipUrl ? path.resolve(s.videoClipUrl) : undefined,
    })),
    voiceoverUrl: result.voiceoverUrl ? '/audio/voiceover.mp3' : undefined,
    captions: result.script.split('\n'),
    ctaUrl: 'https://driftntravel.com',
  }

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'DriftReel',
    inputProps,
  })

  composition.durationInFrames = totalDuration
  composition.props = inputProps

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  })

  const stats = fs.statSync(outputPath)
  console.log(`\n✅ REEL COMPLETE: ${outputPath}`)
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
  console.log(`   Duration: ${totalDuration / fps}s`)
  console.log(`   Resolution: 1080x1920 (9:16)`)
  console.log(`\n📱 Ready for Instagram/TikTok!`)
  console.log(`   Post via: /admin/growth → Queue → Approve → Post to Instagram`)
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message)
  process.exit(1)
})
