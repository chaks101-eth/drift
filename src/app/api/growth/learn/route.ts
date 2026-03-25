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

// POST /api/growth/learn — run learning cycle, generate insights from metrics
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'No Gemini API key' }, { status: 500 })

  const db = getDb()

  // Load all posts with metrics
  const { data: posts } = await db
    .from('growth_posts')
    .select('*, growth_content(title, destination, platform, content_type, eval_score, created_at), growth_metrics(*)')
    .order('posted_at', { ascending: false })
    .limit(100)

  if (!posts?.length) return NextResponse.json({ error: 'No posts to analyze' }, { status: 404 })

  // Build analysis data
  const postSummaries = posts.map(p => {
    const content = p.growth_content as Record<string, unknown> | null
    const metrics = (p.growth_metrics as Array<Record<string, number>>) || []
    const latestMetrics = metrics[metrics.length - 1] || {}
    return {
      platform: p.platform,
      subreddit: p.subreddit,
      destination: content?.destination,
      contentType: content?.content_type,
      evalScore: content?.eval_score,
      clicks: latestMetrics.clicks || 0,
      likes: latestMetrics.likes || 0,
      comments: latestMetrics.comments || 0,
      signups: latestMetrics.signups || 0,
    }
  })

  // Ask Gemini for insights
  const prompt = `Analyze this social media performance data for Drift, an AI travel planner, and generate actionable insights.

DATA (${postSummaries.length} posts):
${JSON.stringify(postSummaries, null, 2)}

Generate 3-5 specific, actionable insights. For each insight, return:
- category: content | timing | platform | format | topic
- insight: What pattern you found
- action: What to do about it
- confidence: 0-1 based on sample size and clarity of pattern

Return JSON array only:
[{"category":"...", "insight":"...", "action":"...", "confidence":0.0}]`

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    const insights = JSON.parse(match ? match[0] : '[]') as Array<{
      category: string; insight: string; action: string; confidence: number
    }>

    // Save insights
    let saved = 0
    for (const insight of insights) {
      await db.from('growth_learnings').insert({
        category: insight.category,
        insight: insight.insight,
        action: insight.action,
        confidence: insight.confidence,
        based_on_posts: postSummaries.length,
      })
      saved++
    }

    // Deactivate old low-confidence learnings
    const { data: deactivated } = await db
      .from('growth_learnings')
      .update({ is_active: false })
      .lt('confidence', 0.3)
      .lt('based_on_posts', 3)
      .eq('is_active', true)
      .select('id')

    return NextResponse.json({
      newLearnings: saved,
      deactivated: deactivated?.length || 0,
      insights,
      analyzedPosts: postSummaries.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
