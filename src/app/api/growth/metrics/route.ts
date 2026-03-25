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

// ─── Platform Metric Fetchers ────────────────────────────────

async function fetchRedditMetrics(postId: string, platformPostId: string): Promise<Record<string, number>> {
  if (!process.env.REDDIT_CLIENT_ID || !platformPostId) return {}
  try {
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Drift/1.0',
      },
      body: `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`,
    })
    const { access_token } = await tokenRes.json()

    const res = await fetch(`https://oauth.reddit.com/api/info?id=${platformPostId}`, {
      headers: { 'Authorization': `Bearer ${access_token}`, 'User-Agent': 'Drift/1.0' },
    })
    const data = await res.json()
    const post = data?.data?.children?.[0]?.data
    if (!post) return {}

    return {
      likes: post.ups || 0,
      comments: post.num_comments || 0,
      impressions: post.ups * 10, // Reddit doesn't expose impressions, estimate
      shares: post.num_crossposts || 0,
    }
  } catch { return {} }
}

async function fetchTwitterMetrics(platformPostId: string): Promise<Record<string, number>> {
  if (!process.env.TWITTER_BEARER_TOKEN || !platformPostId) return {}
  try {
    const res = await fetch(`https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics`, {
      headers: { 'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
    })
    const data = await res.json()
    const m = data?.data?.public_metrics
    if (!m) return {}

    return {
      likes: m.like_count || 0,
      comments: m.reply_count || 0,
      impressions: m.impression_count || 0,
      shares: m.retweet_count + (m.quote_count || 0),
    }
  } catch { return {} }
}

async function fetchInstagramMetrics(platformPostId: string): Promise<Record<string, number>> {
  if (!process.env.META_ACCESS_TOKEN || !platformPostId) return {}
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${platformPostId}/insights?metric=impressions,reach,likes,comments,shares,saved&access_token=${process.env.META_ACCESS_TOKEN}`
    )
    const data = await res.json()
    const metrics: Record<string, number> = {}
    for (const m of data?.data || []) {
      metrics[m.name] = m.values?.[0]?.value || 0
    }
    return {
      impressions: metrics.impressions || metrics.reach || 0,
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      saves: metrics.saved || 0,
    }
  } catch { return {} }
}

async function fetchDevtoMetrics(platformPostId: string): Promise<Record<string, number>> {
  if (!process.env.DEVTO_API_KEY || !platformPostId) return {}
  try {
    const res = await fetch(`https://dev.to/api/articles/${platformPostId}`, {
      headers: { 'api-key': process.env.DEVTO_API_KEY },
    })
    const article = await res.json()
    return {
      impressions: article.page_views_count || 0,
      likes: article.public_reactions_count || 0,
      comments: article.comments_count || 0,
    }
  } catch { return {} }
}

// ─── Main Routes ─────────────────────────────────────────────

// GET /api/growth/metrics — get aggregated engagement metrics
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const platform = req.nextUrl.searchParams.get('platform')
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let postsQuery = db
    .from('growth_posts')
    .select('*, growth_content(title, destination, platform, eval_score), growth_metrics(*)')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })

  if (platform) postsQuery = postsQuery.eq('platform', platform)

  const { data: posts } = await postsQuery

  const totals = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, saves: 0, signups: 0, posts: 0 }
  const byPlatform: Record<string, typeof totals> = {}
  const byDestination: Record<string, typeof totals> = {}

  for (const post of posts || []) {
    totals.posts++
    const content = post.growth_content as Record<string, unknown> | null
    const plat = post.platform
    const dest = (content?.destination as string) || 'unknown'

    if (!byPlatform[plat]) byPlatform[plat] = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, saves: 0, signups: 0, posts: 0 }
    if (!byDestination[dest]) byDestination[dest] = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, saves: 0, signups: 0, posts: 0 }

    byPlatform[plat].posts++
    byDestination[dest].posts++

    const metrics = (post.growth_metrics as Array<Record<string, number>>) || []
    for (const m of metrics) {
      for (const key of ['impressions', 'clicks', 'likes', 'comments', 'shares', 'saves', 'signups'] as const) {
        const val = m[key] || 0
        totals[key] += val
        byPlatform[plat][key] += val
        byDestination[dest][key] += val
      }
    }
  }

  // Content queue stats
  const { data: contentStats } = await db.from('growth_content').select('status')
  const queueStats: Record<string, number> = {}
  for (const c of contentStats || []) {
    queueStats[c.status] = (queueStats[c.status] || 0) + 1
  }

  // Growth runs
  const { data: runs } = await db.from('growth_runs').select('*').order('started_at', { ascending: false }).limit(5)

  return NextResponse.json({ totals, byPlatform, byDestination, queueStats, recentRuns: runs || [], days, postCount: posts?.length || 0 })
}

// POST /api/growth/metrics — fetch fresh metrics from platform APIs + save
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId, manual } = await req.json().catch(() => ({ postId: undefined, manual: undefined })) as {
    postId?: string; manual?: Record<string, number>
  }

  const db = getDb()

  // Manual metric entry
  if (postId && manual) {
    const { data } = await db.from('growth_metrics').insert({
      post_id: postId,
      impressions: manual.impressions || 0,
      clicks: manual.clicks || 0,
      likes: manual.likes || 0,
      comments: manual.comments || 0,
      shares: manual.shares || 0,
      saves: manual.saves || 0,
      site_visits: manual.siteVisits || 0,
      signups: manual.signups || 0,
    }).select('id').single()
    return NextResponse.json({ recorded: true, metricId: data?.id })
  }

  // Auto-fetch from all platforms
  const { data: posts } = await db
    .from('growth_posts')
    .select('id, platform, platform_post_id')
    .not('platform_post_id', 'is', null)
    .not('platform_post_id', 'eq', '')

  let fetched = 0
  let failed = 0

  const fetchers: Record<string, (id: string) => Promise<Record<string, number>>> = {
    reddit: (id) => fetchRedditMetrics('', id),
    twitter: fetchTwitterMetrics,
    instagram: fetchInstagramMetrics,
    devto: fetchDevtoMetrics,
  }

  for (const post of posts || []) {
    const fetcher = fetchers[post.platform]
    if (!fetcher || !post.platform_post_id) continue

    try {
      const metrics = await fetcher(post.platform_post_id)
      if (Object.keys(metrics).length > 0) {
        await db.from('growth_metrics').insert({
          post_id: post.id,
          impressions: metrics.impressions || 0,
          clicks: metrics.clicks || 0,
          likes: metrics.likes || 0,
          comments: metrics.comments || 0,
          shares: metrics.shares || 0,
          saves: metrics.saves || 0,
        })
        fetched++
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({ fetched, failed, total: posts?.length || 0 })
}
