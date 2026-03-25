// ─── AI Video Pipeline ───────────────────────────────────────
// Turns trip photos into high-quality reels:
// 1. Resolve Google Places photos → public URLs
// 2. Generate AI video clips from photos (Kling/Runway)
// 3. Generate AI voiceover narration (ElevenLabs)
// 4. Generate script from trip data via Gemini
// 5. Download royalty-free background music
// 6. Output everything for Remotion composition

import { createClient } from '@supabase/supabase-js'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ─── Types ───────────────────────────────────────────────────

export interface VideoSlide {
  name: string
  category: string
  price: string
  rating?: number
  description: string
  imageUrl: string        // original photo
  videoClipUrl?: string   // AI-generated video from photo
  voiceoverText: string   // narration for this slide
}

export interface VideoPipelineResult {
  destination: string
  country: string
  vibes: string[]
  evalScore?: number
  slides: VideoSlide[]
  voiceoverUrl?: string   // full narration audio
  musicUrl?: string       // background music
  script: string          // full narration script
  totalDuration: number   // estimated seconds
}

// ─── Step 1: Load Trip Data + Resolve Photos ─────────────────

export async function loadTripData(destination: string, tripId?: string): Promise<{
  trip: Record<string, unknown>
  slides: VideoSlide[]
  evalScore?: number
}> {
  const db = getDb()

  let trip: Record<string, unknown> | null = null
  if (tripId) {
    const { data } = await db.from('trips').select('*').eq('id', tripId).single()
    trip = data
  } else {
    const { data } = await db.from('trips').select('*').ilike('destination', `%${destination}%`).order('created_at', { ascending: false }).limit(1).single()
    trip = data
  }
  if (!trip) throw new Error(`Trip not found: ${destination}`)

  const { data: items } = await db
    .from('itinerary_items')
    .select('name, category, price, image_url, description, metadata')
    .eq('trip_id', trip.id as string)
    .not('image_url', 'is', null)
    .neq('category', 'day')
    .neq('category', 'hotel')
    .order('position')
    .limit(5)

  if (!items?.length) throw new Error('No items with images')

  // Resolve Google Places URLs
  const placesKey = process.env.GOOGLE_PLACES_API_KEY
  const slides: VideoSlide[] = []

  for (const item of items) {
    let imageUrl = item.image_url || ''
    if (imageUrl.includes('googleapis.com') && placesKey) {
      try {
        const res = await fetch(`${imageUrl}&key=${placesKey}`, { redirect: 'manual' })
        const location = res.headers.get('location')
        if (location) imageUrl = location
      } catch { /* keep original */ }
    }

    slides.push({
      name: item.name,
      category: item.category,
      price: item.price || '',
      rating: (item.metadata as Record<string, unknown>)?.rating as number | undefined,
      description: item.description?.slice(0, 80) || '',
      imageUrl,
      voiceoverText: '',
    })
  }

  // Get eval score
  const { data: evalResult } = await db
    .from('eval_results')
    .select('overall_score')
    .eq('destination', trip.destination as string)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return { trip, slides, evalScore: evalResult?.overall_score }
}

// ─── Step 2: Generate Narration Script via Gemini ────────────

export async function generateScript(
  destination: string, country: string, vibes: string[], slides: VideoSlide[], evalScore?: number,
): Promise<{ script: string; slideTexts: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No GEMINI_API_KEY')

  const slideList = slides.map((s, i) => `${i + 1}. ${s.name} (${s.category}) — ${s.price}${s.rating ? ` ★${s.rating}` : ''}`).join('\n')

  const prompt = `Write a voiceover script for a 15-20 second Instagram Reel about ${destination}, ${country}.
Vibes: ${vibes.join(', ')}
${evalScore ? `Quality score: ${evalScore}/100` : ''}

Places featured:
${slideList}

Rules:
- Write exactly ${slides.length + 2} lines (1 intro, ${slides.length} for each place, 1 outro)
- Each line should be 3-5 seconds when spoken (10-20 words max)
- Intro: Hook that stops scrolling. Don't say "hey guys" or "welcome"
- Each place line: mention the name, one vivid detail, why it's special
- Outro: "Plan this trip at driftntravel.com" or similar CTA
- Tone: confident, slightly poetic, like a luxury travel narrator
- NO emojis, NO hashtags, NO "link in bio"

Return ONLY the script lines, one per line. No numbering, no labels.`

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  // Assign to slides
  const introText = lines[0] || `${destination}. Where every moment is a discovery.`
  const slideTexts = slides.map((_, i) => lines[i + 1] || `${slides[i].name}. An unforgettable experience.`)
  const outroText = lines[lines.length - 1] || 'Plan this exact trip at driftntravel.com'

  // Update slides with voiceover text
  slides.forEach((s, i) => { s.voiceoverText = slideTexts[i] })

  const fullScript = [introText, ...slideTexts, outroText].join('\n')
  return { script: fullScript, slideTexts: [introText, ...slideTexts, outroText] }
}

// ─── Step 3: Generate Voiceover via ElevenLabs ───────────────

export async function generateVoiceover(script: string, outputPath: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.log('[Video] No ELEVENLABS_API_KEY — skipping voiceover')
    return null
  }

  // Use a natural, warm voice. "Rachel" is good for travel content.
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    console.error(`[Video] ElevenLabs failed: ${res.status}`)
    return null
  }

  const fs = await import('fs')
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)
  console.log(`[Video] Voiceover saved: ${outputPath} (${buffer.length} bytes)`)
  return outputPath
}

// ─── Step 4: Generate Video Clips from Photos (Kling) ────────

export async function generateVideoClips(slides: VideoSlide[], outputDir: string): Promise<void> {
  const klingKey = process.env.KLING_API_KEY
  const runwayKey = process.env.RUNWAY_API_KEY

  if (klingKey) {
    console.log('[Video] Using Kling AI for photo→video')
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      try {
        // Kling image-to-video API
        const res = await fetch('https://api.klingai.com/v1/videos/image2video', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${klingKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model_name: 'kling-v1',
            image: slide.imageUrl,
            prompt: `Smooth cinematic movement, slowly panning across ${slide.name} in ${slide.category === 'food' ? 'a restaurant' : 'a scenic location'}. Travel video style, warm lighting.`,
            duration: '3',
            aspect_ratio: '9:16',
          }),
        })

        const data = await res.json()
        const taskId = data?.data?.task_id

        if (taskId) {
          // Poll for completion
          for (let j = 0; j < 30; j++) {
            await new Promise(r => setTimeout(r, 5000))
            const statusRes = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
              headers: { 'Authorization': `Bearer ${klingKey}` },
            })
            const statusData = await statusRes.json()
            if (statusData?.data?.task_status === 'succeed') {
              const videoUrl = statusData.data.task_result?.videos?.[0]?.url
              if (videoUrl) {
                // Download video
                const videoRes = await fetch(videoUrl)
                const fs = await import('fs')
                const buffer = Buffer.from(await videoRes.arrayBuffer())
                const clipPath = `${outputDir}/clip_${i}.mp4`
                fs.writeFileSync(clipPath, buffer)
                slide.videoClipUrl = clipPath
                console.log(`[Video] Clip ${i + 1}/${slides.length}: ${slide.name} → ${clipPath}`)
              }
              break
            }
            if (statusData?.data?.task_status === 'failed') {
              console.error(`[Video] Kling failed for ${slide.name}`)
              break
            }
          }
        }
      } catch (err) {
        console.error(`[Video] Kling error for ${slide.name}:`, err)
      }
    }
    return
  }

  if (runwayKey) {
    console.log('[Video] Using Runway ML for photo→video')
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      try {
        const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${runwayKey}`,
            'Content-Type': 'application/json',
            'X-Runway-Version': '2024-11-06',
          },
          body: JSON.stringify({
            model: 'gen3a_turbo',
            promptImage: slide.imageUrl,
            promptText: `Smooth cinematic camera movement. Travel video of ${slide.name}. Warm, inviting lighting.`,
            duration: 5,
            ratio: '768:1344', // 9:16
          }),
        })

        const data = await res.json()
        const taskId = data?.id

        if (taskId) {
          for (let j = 0; j < 30; j++) {
            await new Promise(r => setTimeout(r, 5000))
            const statusRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
              headers: { 'Authorization': `Bearer ${runwayKey}`, 'X-Runway-Version': '2024-11-06' },
            })
            const statusData = await statusRes.json()
            if (statusData?.status === 'SUCCEEDED') {
              const videoUrl = statusData.output?.[0]
              if (videoUrl) {
                const videoRes = await fetch(videoUrl)
                const fs = await import('fs')
                const buffer = Buffer.from(await videoRes.arrayBuffer())
                const clipPath = `${outputDir}/clip_${i}.mp4`
                fs.writeFileSync(clipPath, buffer)
                slide.videoClipUrl = clipPath
                console.log(`[Video] Clip ${i + 1}/${slides.length}: ${slide.name} → ${clipPath}`)
              }
              break
            }
            if (statusData?.status === 'FAILED') break
          }
        }
      } catch (err) {
        console.error(`[Video] Runway error for ${slide.name}:`, err)
      }
    }
    return
  }

  console.log('[Video] No KLING_API_KEY or RUNWAY_API_KEY — using photos as stills')
}

// ─── Step 5: Full Pipeline ───────────────────────────────────

export async function runVideoPipeline(
  destination: string,
  tripId?: string,
): Promise<VideoPipelineResult> {
  const outputDir = `growth/videos/${destination.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  const fs = await import('fs')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  console.log(`\n🎬 Starting video pipeline for: ${destination}`)

  // Step 1: Load data
  console.log('📦 Loading trip data...')
  const { trip, slides, evalScore } = await loadTripData(destination, tripId)
  console.log(`   ${slides.length} slides, eval: ${evalScore || 'N/A'}`)

  // Step 2: Generate script
  console.log('📝 Generating narration script...')
  const { script, slideTexts } = await generateScript(
    trip.destination as string,
    trip.country as string || '',
    trip.vibes as string[] || [],
    slides,
    evalScore,
  )
  console.log(`   Script: ${script.split('\n').length} lines`)

  // Step 3: Generate voiceover
  console.log('🎙️ Generating voiceover...')
  const voiceoverPath = `${outputDir}/voiceover.mp3`
  const voiceoverUrl = await generateVoiceover(script, voiceoverPath)

  // Step 4: Generate video clips from photos
  console.log('🎥 Generating video clips from photos...')
  await generateVideoClips(slides, outputDir)
  const clipCount = slides.filter(s => s.videoClipUrl).length
  console.log(`   ${clipCount}/${slides.length} clips generated`)

  // Step 5: Save pipeline result
  const result: VideoPipelineResult = {
    destination: trip.destination as string,
    country: trip.country as string || '',
    vibes: trip.vibes as string[] || [],
    evalScore,
    slides,
    voiceoverUrl: voiceoverUrl || undefined,
    script,
    totalDuration: 3 + slides.length * 3 + 3, // intro + slides + cta
  }

  // Save result JSON for Remotion to consume
  fs.writeFileSync(`${outputDir}/pipeline-result.json`, JSON.stringify(result, null, 2))
  console.log(`\n✅ Pipeline complete: ${outputDir}/`)
  console.log(`   Script: ${outputDir}/pipeline-result.json`)
  console.log(`   Voiceover: ${voiceoverUrl || 'skipped (no API key)'}`)
  console.log(`   Video clips: ${clipCount}/${slides.length}`)
  console.log(`\n🎬 Next: npx remotion render DriftReel ${outputDir}/final.mp4`)

  return result
}
