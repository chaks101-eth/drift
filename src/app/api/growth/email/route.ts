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

// POST /api/growth/email — send email campaigns via Resend
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, customTo, customSubject, customBody } = await req.json() as {
    type: 'waitlist' | 'follow_up' | 'reactivation' | 'share' | 'digest' | 'custom'
    customTo?: string; customSubject?: string; customBody?: string
  }

  const resendKey = process.env.RESEND_API_KEY
  const db = getDb()
  const results: Array<{ to: string; subject: string; status: string; error?: string }> = []

  // Build email list based on type
  let emails: Array<{ to: string; subject: string; html: string }> = []

  if (type === 'custom' && customTo && customSubject && customBody) {
    emails = [{ to: customTo, subject: customSubject, html: wrapHtml(customBody) }]
  } else if (type === 'digest') {
    // Get recent high-quality trips for the digest
    const { data: evalResults } = await db
      .from('eval_results')
      .select('destination, overall_score')
      .order('overall_score', { ascending: false })
      .limit(3)

    const topDests = evalResults?.map(r => `${r.destination} (${r.overall_score}/100)`).join(', ') || 'amazing destinations'

    // Get all user emails (via trips — we don't have direct auth.users access via REST)
    const { data: trips } = await db.from('trips').select('user_id').limit(100)
    const userIds = [...new Set((trips || []).map(t => t.user_id))]

    // For now, just create the digest content — actual sending requires user emails
    emails = [{
      to: 'digest-list',
      subject: 'This week on Drift — top AI-planned trips',
      html: wrapHtml(`
        <h2 style="color:#c8a44e;">This Week's Best Trips</h2>
        <p>Our AI planner just scored its best itineraries yet:</p>
        <p><strong>${topDests}</strong></p>
        <p>Every place is verified on Google Maps. Zero hallucinations.</p>
        <a href="https://driftntravel.com?utm_source=email&utm_medium=digest&utm_campaign=weekly_${new Date().toISOString().slice(0, 10)}"
           style="display:inline-block;padding:14px 28px;background:#c8a44e;color:#08080c;border-radius:12px;text-decoration:none;font-weight:600;">
          Plan Your Trip →
        </a>
      `),
    }]
  } else if (type === 'follow_up') {
    // Trips created in last 24-48h that haven't been revisited
    const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: recentTrips } = await db
      .from('trips')
      .select('id, destination, user_id, vibes, created_at')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const trip of recentTrips || []) {
      emails.push({
        to: trip.user_id, // Would need user email lookup
        subject: `Your ${trip.destination} trip is waiting`,
        html: wrapHtml(`
          <h2 style="color:#c8a44e;">Your ${trip.destination} Trip</h2>
          <p>You started planning a ${(trip.vibes || []).join(', ')} trip to ${trip.destination}. It's ready for you!</p>
          <a href="https://driftntravel.com/trip/${trip.id}?utm_source=email&utm_medium=follow_up&utm_campaign=${trip.destination.toLowerCase().replace(/\s+/g, '_')}"
             style="display:inline-block;padding:14px 28px;background:#c8a44e;color:#08080c;border-radius:12px;text-decoration:none;font-weight:600;">
            View Your Trip →
          </a>
        `),
      })
    }
  } else if (type === 'reactivation') {
    // Users who haven't created trips in 7+ days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: oldTrips } = await db
      .from('trips')
      .select('user_id, destination, vibes')
      .lt('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const trip of oldTrips || []) {
      emails.push({
        to: trip.user_id,
        subject: `We found a ${(trip.vibes || [])[0] || 'perfect'} trip you'd love`,
        html: wrapHtml(`
          <h2 style="color:#c8a44e;">Ready for another adventure?</h2>
          <p>Based on your ${trip.destination} trip, we think you'd love our newest destinations.</p>
          <a href="https://driftntravel.com/m/plan?utm_source=email&utm_medium=reactivation&utm_campaign=winback"
             style="display:inline-block;padding:14px 28px;background:#c8a44e;color:#08080c;border-radius:12px;text-decoration:none;font-weight:600;">
            Plan a New Trip →
          </a>
        `),
      })
    }
  }

  // Send via Resend or save drafts
  for (const email of emails) {
    if (resendKey && email.to !== 'digest-list' && email.to.includes('@')) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Drift <hello@driftntravel.com>',
            to: email.to,
            subject: email.subject,
            html: email.html,
          }),
        })
        const data = await res.json()
        results.push({ to: email.to, subject: email.subject, status: data.id ? 'sent' : 'failed', error: data.message })
      } catch (err) {
        results.push({ to: email.to, subject: email.subject, status: 'failed', error: String(err) })
      }
    } else {
      // Save as content draft for manual sending
      await db.from('growth_content').insert({
        platform: 'email',
        content_type: type,
        title: email.subject,
        body: email.html,
        status: 'draft',
        utm_campaign: `email_${type}_${new Date().toISOString().slice(0, 10)}`,
      })
      results.push({ to: email.to, subject: email.subject, status: 'drafted' })
    }
  }

  return NextResponse.json({
    type,
    total: results.length,
    sent: results.filter(r => r.status === 'sent').length,
    drafted: results.filter(r => r.status === 'drafted').length,
    failed: results.filter(r => r.status === 'failed').length,
    resendConfigured: !!resendKey,
    results,
  })
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#08080c;font-family:Inter,system-ui,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-family:Georgia,serif;font-size:24px;color:#c8a44e;">Drift</span>
    </div>
    <div style="color:#f0efe8;font-size:15px;line-height:1.6;">
      ${content}
    </div>
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #ffffff14;text-align:center;">
      <p style="color:#4a4a55;font-size:11px;">
        <a href="https://driftntravel.com" style="color:#7a7a85;">driftntravel.com</a> ·
        <a href="https://driftntravel.com/unsubscribe" style="color:#7a7a85;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body></html>`
}
