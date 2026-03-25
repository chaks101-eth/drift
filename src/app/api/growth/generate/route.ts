import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const ADMIN_SECRET = process.env.ADMIN_SECRET
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/growth/generate — generate content from trip data + eval scores
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, contentType, destination, count = 1, customPrompt } = await req.json() as {
    platform: string; contentType?: string; destination?: string; count?: number; customPrompt?: string
  }

  if (!platform) return NextResponse.json({ error: 'Missing platform' }, { status: 400 })

  const db = getDb()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key' }, { status: 500 })

  // 1. Pick destination — use provided or find highest-scoring
  let targetDest = destination
  if (!targetDest) {
    const { data: evalResults } = await db
      .from('eval_results')
      .select('destination, overall_score')
      .order('overall_score', { ascending: false })
      .limit(5)

    if (evalResults?.length) {
      targetDest = evalResults[0].destination
    }
  }

  // 2. Load trip data for destination
  const { data: trips } = await db
    .from('trips')
    .select('id, destination, country, vibes, start_date, end_date')
    .ilike('destination', targetDest || '%')
    .order('created_at', { ascending: false })
    .limit(3)

  if (!trips?.length) return NextResponse.json({ error: 'No trips found' }, { status: 404 })

  const trip = trips[0]
  const { data: items } = await db
    .from('itinerary_items')
    .select('name, category, price, description, metadata')
    .eq('trip_id', trip.id)
    .neq('category', 'day')
    .order('position')

  // 3. Load active learnings
  const { data: learnings } = await db
    .from('growth_learnings')
    .select('insight, action')
    .eq('is_active', true)
    .limit(5)

  // 4. Load eval score for this destination
  const { data: evalData } = await db
    .from('eval_results')
    .select('overall_score, dimension_scores')
    .eq('destination', trip.destination)
    .order('created_at', { ascending: false })
    .limit(1)

  const evalScore = evalData?.[0]?.overall_score || null

  // 5. Build platform-specific prompt
  const itemList = (items || []).slice(0, 10).map(i => {
    const rating = (i.metadata as Record<string, unknown>)?.rating || ''
    const reason = (i.metadata as Record<string, unknown>)?.reason || ''
    return `- ${i.name} (${i.category}) — ${i.price}${rating ? ` ★${rating}` : ''}${reason ? ` — "${reason}"` : ''}`
  }).join('\n')

  const learningContext = learnings?.length
    ? `\nLearnings from past content:\n${learnings.map(l => `- ${l.insight}`).join('\n')}`
    : ''

  const platformPrompts: Record<string, string> = {
    reddit: `Write a Reddit trip report for r/travel about ${trip.destination}, ${trip.country}.
Tone: Casual, first-person, helpful traveler sharing real tips.
Structure: Day-by-day breakdown with specific places, prices, and insider tips.
End with a subtle mention: "I used Drift (driftntravel.com) to plan this — it pulls real Google data for every recommendation."
Do NOT be promotional. Provide genuine value.`,
    twitter: `Write a Twitter/X thread (5-7 tweets) about ${trip.destination}.
Tweet 1: Strong hook that makes people stop scrolling.
Tweets 2-5: One specific place per tweet with name, what makes it special, and a concrete tip.
Tweet 6: How the trip was planned (mention Drift naturally).
Tweet 7: CTA with link to driftntravel.com.
Each tweet must be under 280 characters.`,
    blog: `Write a technical blog post (1500-2000 words) for dev.to about how Drift generates AI travel itineraries.
Include: How we use Gemini, Google Places verification, the eval system scoring 7 dimensions.
Use the ${trip.destination} trip as a concrete example with real data.
Include code-like examples and architecture insights.
Tags: #travel #ai #webdev #nextjs`,
    instagram: `Write an Instagram caption for a ${trip.destination} trip post.
First line: Attention-grabbing hook.
Body: 2-3 specific places with one-line descriptions.
End: "Plan this trip in 30 seconds → link in bio"
Include 5-8 relevant hashtags.`,
    email: `Write an email for Drift users about ${trip.destination}.
Subject line: Under 50 chars, curiosity-driven.
Body: Short (3-4 sentences), personal tone, one clear CTA.
CTA: "View your ${trip.destination} trip" or "Plan a trip like this".`,
  }

  const results: Array<{ id: string; platform: string; title: string; status: string; destination: string; evalScore: number | null }> = []

  for (let i = 0; i < Math.min(count, 5); i++) {
    const prompt = customPrompt || platformPrompts[platform] || platformPrompts.reddit

    const fullPrompt = `${prompt}

REAL TRIP DATA (${trip.destination}, ${trip.country}):
Vibes: ${(trip.vibes || []).join(', ')}
Dates: ${trip.start_date} to ${trip.end_date}
${evalScore ? `Quality Score: ${evalScore}/100` : ''}

REAL PLACES (all verified on Google Maps):
${itemList}
${learningContext}

Return ONLY the content, no meta-commentary. For Twitter, separate tweets with "---".`

    try {
      const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
      })

      if (!res.ok) continue
      const data = await res.json()
      const body = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!body) continue

      // Extract title from first line
      const lines = body.split('\n').filter((l: string) => l.trim())
      const title = lines[0]?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '').slice(0, 200) || `${trip.destination} — ${platform}`

      const utm = `utm_source=${platform}&utm_medium=${contentType || 'post'}&utm_campaign=${trip.destination.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

      // Save to growth_content
      const { data: saved } = await db.from('growth_content').insert({
        platform,
        content_type: contentType || 'post',
        title,
        body,
        destination: trip.destination,
        trip_id: trip.id,
        eval_score: evalScore,
        status: 'draft',
        utm_campaign: utm,
        generation_prompt: prompt.slice(0, 500),
      }).select('id').single()

      results.push({
        id: saved?.id || '',
        platform,
        title,
        status: 'draft',
        destination: trip.destination,
        evalScore,
      })
    } catch {
      // continue to next generation
    }
  }

  return NextResponse.json({
    generated: results.length,
    destination: targetDest,
    items: results,
  })
}
