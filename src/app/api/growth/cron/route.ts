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

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:3000'

async function callGrowthApi(path: string, body?: Record<string, unknown>) {
  const url = `${baseUrl()}/api/growth/${path}`
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET! },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return res.json()
}

// POST /api/growth/cron — run daily or weekly growth cycle
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cycle = 'daily' } = await req.json().catch(() => ({ cycle: 'daily' }))
  const db = getDb()

  // Create growth run
  const { data: run } = await db.from('growth_runs').insert({
    cycle_type: cycle,
    status: 'running',
  }).select('id').single()

  const runId = run?.id
  const log: string[] = []

  try {
    if (cycle === 'daily') {
      // ─── Daily Cycle ─────────────────────────────────
      // 1. Check if content queue has approved items
      const queueRes = await callGrowthApi('content?status=approved')
      const approvedCount = queueRes.content?.length || 0
      log.push(`Approved content in queue: ${approvedCount}`)

      // 2. Generate new content if queue is low
      if (approvedCount < 3) {
        const genCount = 3 - approvedCount
        const genRes = await callGrowthApi('generate', {
          platform: ['reddit', 'twitter', 'blog'][Math.floor(Math.random() * 3)],
          count: genCount,
        })
        log.push(`Generated ${genRes.generated || 0} new content pieces for ${genRes.destination}`)
      }

      // 3. Post scheduled content
      const scheduledRes = await callGrowthApi('content?status=scheduled')
      const now = new Date()
      let postsPublished = 0
      for (const item of scheduledRes.content || []) {
        if (item.scheduled_for && new Date(item.scheduled_for) <= now) {
          const postRes = await callGrowthApi('post', { contentId: item.id, platform: item.platform })
          if (postRes.postId) postsPublished++
          log.push(`Posted ${item.platform}: ${postRes.automated ? 'auto' : 'manual'} — ${item.title?.slice(0, 50)}`)
        }
      }

      // 4. Send follow-up emails
      const emailRes = await callGrowthApi('email', { type: 'follow_up' })
      log.push(`Emails: ${emailRes.sent || 0} sent, ${emailRes.drafted || 0} drafted`)

      // Update run
      if (runId) {
        await db.from('growth_runs').update({
          status: 'completed',
          content_generated: 3 - approvedCount,
          posts_published: postsPublished,
          emails_sent: emailRes.sent || 0,
          completed_at: new Date().toISOString(),
        }).eq('id', runId)
      }

    } else if (cycle === 'weekly') {
      // ─── Weekly Cycle ────────────────────────────────
      // 1. Run learning cycle
      const learnRes = await callGrowthApi('learn', {})
      log.push(`Learnings: ${learnRes.newLearnings || 0} new, ${learnRes.deactivated || 0} deactivated`)

      // 2. Generate content for next week (one per platform)
      for (const platform of ['reddit', 'twitter', 'blog']) {
        const genRes = await callGrowthApi('generate', { platform, count: 2 })
        log.push(`Generated ${genRes.generated || 0} ${platform} pieces`)
      }

      // 3. Send weekly digest
      const digestRes = await callGrowthApi('email', { type: 'digest' })
      log.push(`Weekly digest: ${digestRes.sent || 0} sent, ${digestRes.drafted || 0} drafted`)

      // 4. Send reactivation emails
      const reactRes = await callGrowthApi('email', { type: 'reactivation' })
      log.push(`Reactivation: ${reactRes.sent || 0} sent, ${reactRes.drafted || 0} drafted`)

      if (runId) {
        await db.from('growth_runs').update({
          status: 'completed',
          content_generated: 6,
          emails_sent: (digestRes.sent || 0) + (reactRes.sent || 0),
          learnings_generated: learnRes.newLearnings || 0,
          completed_at: new Date().toISOString(),
        }).eq('id', runId)
      }
    }

    return NextResponse.json({ runId, cycle, status: 'completed', log })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Cron failed'
    if (runId) {
      await db.from('growth_runs').update({
        status: 'failed', error: errorMsg, completed_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return NextResponse.json({ runId, cycle, status: 'failed', error: errorMsg, log })
  }
}
