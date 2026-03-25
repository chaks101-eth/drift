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

// ─── Platform Posters ────────────────────────────────────────

async function postToReddit(content: Record<string, unknown>, subreddit: string): Promise<{ url: string; id: string }> {
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

  const postRes = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Drift/1.0' },
    body: `kind=self&sr=${subreddit.replace('r/', '')}&title=${encodeURIComponent(String(content.title || ''))}&text=${encodeURIComponent(String(content.body || ''))}`,
  })
  const result = await postRes.json()
  return { url: result?.json?.data?.url || '', id: result?.json?.data?.name || '' }
}

async function postToTwitter(content: Record<string, unknown>): Promise<{ url: string; id: string }> {
  // Twitter API v2 with OAuth 1.0a
  const crypto = await import('crypto')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const params: Record<string, string> = {
    oauth_consumer_key: process.env.TWITTER_API_KEY!,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: process.env.TWITTER_ACCESS_TOKEN!,
    oauth_version: '1.0',
  }

  // For threads, split by --- and post sequentially
  const body = String(content.body || '')
  const tweets = body.includes('---') ? body.split('---').map(t => t.trim()).filter(Boolean) : [body]

  let firstTweetUrl = ''
  let firstTweetId = ''
  let replyToId = ''

  for (const tweetText of tweets) {
    const text = tweetText.slice(0, 280)
    const postBody: Record<string, unknown> = { text }
    if (replyToId) postBody.reply = { in_reply_to_tweet_id: replyToId }

    // Build OAuth signature
    const signatureBase = `POST&${encodeURIComponent('https://api.twitter.com/2/tweets')}&${encodeURIComponent(Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('&'))}`
    const signingKey = `${encodeURIComponent(process.env.TWITTER_API_SECRET!)}&${encodeURIComponent(process.env.TWITTER_ACCESS_SECRET!)}`
    const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64')

    const authHeader = `OAuth ${Object.entries({ ...params, oauth_signature: signature }).map(([k, v]) => `${k}="${encodeURIComponent(v)}"`).join(', ')}`

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody),
    })
    const result = await res.json()
    const tweetId = result?.data?.id || ''

    if (!firstTweetId) {
      firstTweetId = tweetId
      firstTweetUrl = `https://twitter.com/i/status/${tweetId}`
    }
    replyToId = tweetId
  }

  return { url: firstTweetUrl, id: firstTweetId }
}

async function postToDevto(content: Record<string, unknown>): Promise<{ url: string; id: string }> {
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.DEVTO_API_KEY! },
    body: JSON.stringify({
      article: {
        title: content.title,
        body_markdown: content.body,
        published: true,
        tags: (content.hashtags as string[])?.slice(0, 4) || ['travel', 'ai', 'webdev', 'nextjs'],
      },
    }),
  })
  const article = await res.json()
  return { url: article.url || '', id: String(article.id || '') }
}

async function postToInstagram(content: Record<string, unknown>): Promise<{ url: string; id: string }> {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID!
  const token = process.env.META_ACCESS_TOKEN!
  const mediaUrls = (content.media_urls as string[]) || []
  const videoUrl = content.video_url as string
  const caption = `${content.title || ''}\n\n${String(content.body || '').slice(0, 2000)}`

  if (videoUrl) {
    // Reel upload
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: token,
      }),
    })
    const container = await createRes.json()

    // Wait for processing
    await new Promise(r => setTimeout(r, 10000))

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    })
    const published = await publishRes.json()
    return { url: `https://www.instagram.com/p/${published.id}/`, id: published.id || '' }
  }

  if (mediaUrls.length > 1) {
    // Carousel
    const childIds: string[] = []
    for (const url of mediaUrls.slice(0, 10)) {
      const res = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: token }),
      })
      const child = await res.json()
      if (child.id) childIds.push(child.id)
    }

    const carouselRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'CAROUSEL', children: childIds, caption, access_token: token }),
    })
    const carousel = await carouselRes.json()

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: carousel.id, access_token: token }),
    })
    const published = await publishRes.json()
    return { url: `https://www.instagram.com/p/${published.id}/`, id: published.id || '' }
  }

  // Single image
  if (mediaUrls.length === 1) {
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: mediaUrls[0], caption, access_token: token }),
    })
    const container = await createRes.json()

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: token }),
    })
    const published = await publishRes.json()
    return { url: `https://www.instagram.com/p/${published.id}/`, id: published.id || '' }
  }

  throw new Error('Instagram requires media_urls or video_url')
}

async function postToTiktok(content: Record<string, unknown>): Promise<{ url: string; id: string }> {
  const videoUrl = content.video_url as string
  if (!videoUrl) throw new Error('TikTok requires a video_url')

  // TikTok Content Posting API — init upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: String(content.title || '').slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }),
  })
  const initData = await initRes.json()
  const publishId = initData?.data?.publish_id || ''

  return { url: `https://www.tiktok.com/@drift/video/${publishId}`, id: publishId }
}

// ─── Platform availability check ─────────────────────────────

function getAvailablePlatforms(): Record<string, boolean> {
  return {
    reddit: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
    twitter: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
    devto: !!process.env.DEVTO_API_KEY,
    instagram: !!(process.env.META_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID),
    tiktok: !!process.env.TIKTOK_ACCESS_TOKEN,
  }
}

// ─── Main Route ──────────────────────────────────────────────

// POST /api/growth/post — publish content to a platform
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentId, platform, subreddit, manualUrl } = await req.json() as {
    contentId: string; platform: string; subreddit?: string; manualUrl?: string
  }

  if (!contentId) return NextResponse.json({ error: 'Missing contentId' }, { status: 400 })

  const db = getDb()
  const { data: content } = await db.from('growth_content').select('*').eq('id', contentId).single()
  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  if (content.status !== 'approved' && content.status !== 'scheduled') {
    return NextResponse.json({ error: `Content status is "${content.status}", must be approved or scheduled` }, { status: 400 })
  }

  let postUrl = manualUrl || ''
  let platformPostId = ''
  let postedBy = 'manual'
  let error = ''

  const platforms = getAvailablePlatforms()

  if (platforms[platform]) {
    try {
      const posters: Record<string, (c: Record<string, unknown>, s?: string) => Promise<{ url: string; id: string }>> = {
        reddit: (c) => postToReddit(c, subreddit || 'travel'),
        twitter: postToTwitter,
        devto: postToDevto,
        instagram: postToInstagram,
        tiktok: postToTiktok,
      }

      const result = await posters[platform](content as Record<string, unknown>)
      postUrl = result.url
      platformPostId = result.id
      postedBy = 'system'
    } catch (err) {
      error = err instanceof Error ? err.message : 'Post failed'
    }
  }

  // Record the post
  const { data: post } = await db.from('growth_posts').insert({
    content_id: contentId,
    platform,
    platform_post_id: platformPostId,
    post_url: postUrl,
    subreddit: subreddit || null,
    posted_by: postedBy,
  }).select('id').single()

  // Update content status
  const newStatus = error ? 'failed' : 'posted'
  await db.from('growth_content').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', contentId)

  return NextResponse.json({
    postId: post?.id,
    platform,
    postUrl,
    postedBy,
    automated: postedBy === 'system',
    error: error || undefined,
    platformsAvailable: platforms,
    instructions: postedBy === 'manual'
      ? `${platform} API not configured. Copy content and post manually. Required env vars: ${getPlatformEnvVars(platform)}`
      : undefined,
  })
}

// GET /api/growth/post — list all posts + available platforms
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { data: posts } = await db
    .from('growth_posts')
    .select('*, growth_content(title, destination, platform, eval_score)')
    .order('posted_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    posts: posts || [],
    platformsAvailable: getAvailablePlatforms(),
  })
}

function getPlatformEnvVars(platform: string): string {
  const vars: Record<string, string> = {
    reddit: 'REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD',
    twitter: 'TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET',
    devto: 'DEVTO_API_KEY',
    instagram: 'META_ACCESS_TOKEN, INSTAGRAM_ACCOUNT_ID',
    tiktok: 'TIKTOK_ACCESS_TOKEN',
  }
  return vars[platform] || 'unknown'
}
