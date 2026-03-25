import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

function getDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/growth/metrics — engagement data across platforms
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const platform = req.nextUrl.searchParams.get('platform')
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get posts with their metrics
  let postsQuery = db
    .from('growth_posts')
    .select('*, growth_content(title, destination, platform, eval_score), growth_metrics(*)')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })

  if (platform) postsQuery = postsQuery.eq('platform', platform)

  const { data: posts } = await postsQuery

  // Aggregate metrics
  const totals = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, signups: 0, posts: 0 }
  const byPlatform: Record<string, typeof totals> = {}
  const byDestination: Record<string, typeof totals> = {}

  for (const post of posts || []) {
    totals.posts++
    const content = post.growth_content as Record<string, unknown> | null
    const plat = post.platform
    const dest = (content?.destination as string) || 'unknown'

    if (!byPlatform[plat]) byPlatform[plat] = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, signups: 0, posts: 0 }
    if (!byDestination[dest]) byDestination[dest] = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, signups: 0, posts: 0 }

    byPlatform[plat].posts++
    byDestination[dest].posts++

    const metrics = (post.growth_metrics as Array<Record<string, number>>) || []
    for (const m of metrics) {
      for (const key of ['impressions', 'clicks', 'likes', 'comments', 'shares', 'signups'] as const) {
        const val = m[key] || 0
        totals[key] += val
        byPlatform[plat][key] += val
        byDestination[dest][key] += val
      }
    }
  }

  // Also get content queue stats
  const { data: contentStats } = await db.from('growth_content').select('status')
  const queueStats: Record<string, number> = {}
  for (const c of contentStats || []) {
    queueStats[c.status] = (queueStats[c.status] || 0) + 1
  }

  return NextResponse.json({ totals, byPlatform, byDestination, queueStats, days, postCount: posts?.length || 0 })
}

// POST /api/growth/metrics — manually record metrics for a post
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId, impressions, clicks, likes, comments, shares, signups, siteVisits } = await req.json()
  if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 })

  const db = getDb()
  const { data, error } = await db.from('growth_metrics').insert({
    post_id: postId,
    impressions: impressions || 0,
    clicks: clicks || 0,
    likes: likes || 0,
    comments: comments || 0,
    shares: shares || 0,
    site_visits: siteVisits || 0,
    signups: signups || 0,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ metricId: data?.id, recorded: true })
}
