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

// POST /api/growth/post — publish content to a platform
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentId, platform, subreddit, manualUrl } = await req.json() as {
    contentId: string; platform: string; subreddit?: string; manualUrl?: string
  }

  if (!contentId) return NextResponse.json({ error: 'Missing contentId' }, { status: 400 })

  const db = getDb()

  // Load content
  const { data: content } = await db.from('growth_content').select('*').eq('id', contentId).single()
  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  if (content.status !== 'approved' && content.status !== 'scheduled') {
    return NextResponse.json({ error: `Content status is "${content.status}", must be approved or scheduled` }, { status: 400 })
  }

  let postUrl = manualUrl || ''
  let platformPostId = ''
  let postedBy = 'manual'

  // Try automated posting if API keys exist
  if (platform === 'reddit' && process.env.REDDIT_CLIENT_ID) {
    // Reddit OAuth + post
    try {
      const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=password&username=${process.env.REDDIT_USERNAME}&password=${process.env.REDDIT_PASSWORD}`,
      })
      const { access_token } = await tokenRes.json()

      const postRes = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `kind=self&sr=${(subreddit || 'travel').replace('r/', '')}&title=${encodeURIComponent(content.title || '')}&text=${encodeURIComponent(content.body)}`,
      })
      const result = await postRes.json()
      postUrl = result?.json?.data?.url || ''
      platformPostId = result?.json?.data?.name || ''
      postedBy = 'system'
    } catch {
      // Fall through to manual
    }
  }

  if (platform === 'devto' && process.env.DEVTO_API_KEY) {
    try {
      const res = await fetch('https://dev.to/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.DEVTO_API_KEY,
        },
        body: JSON.stringify({
          article: {
            title: content.title,
            body_markdown: content.body,
            published: true,
            tags: ['travel', 'ai', 'webdev', 'nextjs'],
          },
        }),
      })
      const article = await res.json()
      postUrl = article.url || ''
      platformPostId = String(article.id || '')
      postedBy = 'system'
    } catch {
      // Fall through to manual
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
  await db.from('growth_content').update({ status: 'posted', updated_at: new Date().toISOString() }).eq('id', contentId)

  return NextResponse.json({
    postId: post?.id,
    platform,
    postUrl,
    postedBy,
    automated: postedBy === 'system',
    instructions: postedBy === 'manual' ? `Copy the content and post manually to ${platform}. Then update the post URL.` : undefined,
  })
}
