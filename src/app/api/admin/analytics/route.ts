import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_SECRET = process.env.ADMIN_SECRET

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret')
  return auth === ADMIN_SECRET
}

// GET /api/admin/analytics — comprehensive metrics from Supabase
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const prevWeek = new Date(now.getTime() - 14 * 86400000).toISOString()

  // Get all users with anonymous flag via auth admin API
  const authRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
  })
  const authData = await authRes.json()
  const allAuthUsers: Array<{ id: string; email: string; is_anonymous: boolean; created_at: string }> = authData.users || []
  const anonUserIds = new Set(allAuthUsers.filter(u => u.is_anonymous).map(u => u.id))
  const realUserIds = new Set(allAuthUsers.filter(u => !u.is_anonymous).map(u => u.id))

  // Run all queries in parallel
  const [
    tripsTotal,
    tripsThisWeek,
    tripsPrevWeek,
    tripsThisMonth,
    tripsDaily,
    tripsByDest,
    tripsByBudget,
    tripsByVibes,
    itemsTotal,
    itemsByCategory,
    chatTotal,
    tripsWithChat,
    evalResults,
    evalByDest,
    usersTotal,
    usersThisWeek,
    recentTrips,
    popularItems,
    growthPosts,
    growthMetrics,
  ] = await Promise.all([
    // Total trips
    db.from('trips').select('id', { count: 'exact', head: true }),
    // Trips this week
    db.from('trips').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    // Trips previous week (for comparison)
    db.from('trips').select('id', { count: 'exact', head: true }).gte('created_at', prevWeek).lt('created_at', weekAgo),
    // Trips this month
    db.from('trips').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
    // Trips per day (last 30 days)
    db.from('trips').select('created_at').gte('created_at', monthAgo).order('created_at'),
    // Trips by destination (top 15)
    db.from('trips').select('destination').order('created_at', { ascending: false }).limit(500),
    // Trips by budget tier
    db.from('trips').select('budget').limit(500),
    // Trips by vibes
    db.from('trips').select('vibes').limit(500),
    // Total items
    db.from('itinerary_items').select('id', { count: 'exact', head: true }),
    // Items by category
    db.from('itinerary_items').select('category').limit(2000),
    // Chat messages
    db.from('chat_messages').select('id', { count: 'exact', head: true }),
    // Trips with chat activity
    db.from('chat_messages').select('trip_id').limit(1000),
    // Eval results
    db.from('eval_results').select('overall_score, destination, dimension_scores, created_at').order('created_at', { ascending: false }).limit(100),
    // Eval avg by destination
    db.from('eval_results').select('destination, overall_score').limit(200),
    // Distinct users
    db.from('trips').select('user_id').limit(1000),
    // Users this week
    db.from('trips').select('user_id, created_at').gte('created_at', weekAgo).limit(500),
    // Recent trips (for activity feed)
    db.from('trips').select('id, destination, country, vibes, budget, travelers, created_at').order('created_at', { ascending: false }).limit(20),
    // Popular items
    db.from('popularity_scores').select('item_name, destination, item_type, score, pick_count, skip_count').order('score', { ascending: false }).limit(20),
    // Growth posts
    db.from('growth_posts').select('id, platform, posted_at').order('posted_at', { ascending: false }).limit(50),
    // Growth metrics totals
    db.from('growth_metrics').select('impressions, clicks, likes, comments, shares, signups, trips_created'),
  ])

  // ─── Compute Metrics ──────────────────────────────────

  // Users — split by real vs anonymous
  const allTripUserIds = new Set((usersTotal.data || []).map(t => t.user_id))
  const uniqueUsers = allTripUserIds.size
  const realUsers = [...allTripUserIds].filter(id => realUserIds.has(id)).length
  const anonUsers = [...allTripUserIds].filter(id => anonUserIds.has(id)).length
  const weeklyUserIds = new Set((usersThisWeek.data || []).map(t => t.user_id))
  const weeklyNewUsers = weeklyUserIds.size
  const weeklyRealUsers = [...weeklyUserIds].filter(id => realUserIds.has(id)).length

  // Trips — split by real vs anonymous
  const allTripData = (usersTotal.data || []) as Array<{ user_id: string }>
  const realTrips = allTripData.filter(t => realUserIds.has(t.user_id)).length
  const anonTrips = allTripData.filter(t => anonUserIds.has(t.user_id)).length

  // Conversion: anonymous → signed up (users who were anon but later linked Google/email)
  const convertedUsers = allAuthUsers.filter(u => !u.is_anonymous && u.email).length
  const conversionRate = allAuthUsers.length > 0 ? Math.round((convertedUsers / allAuthUsers.length) * 100) : 0

  // Daily trip counts (last 30 days)
  const dailyCounts: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)
    dailyCounts[d] = 0
  }
  for (const trip of tripsDaily.data || []) {
    const d = trip.created_at.slice(0, 10)
    if (dailyCounts[d] !== undefined) dailyCounts[d]++
  }

  // Destination breakdown
  const destCounts: Record<string, number> = {}
  for (const t of tripsByDest.data || []) {
    destCounts[t.destination] = (destCounts[t.destination] || 0) + 1
  }
  const topDestinations = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([dest, count]) => ({ destination: dest, trips: count }))

  // Budget breakdown
  const budgetCounts: Record<string, number> = { budget: 0, mid: 0, luxury: 0 }
  for (const t of tripsByBudget.data || []) {
    if (t.budget && budgetCounts[t.budget] !== undefined) budgetCounts[t.budget]++
  }

  // Vibes breakdown
  const vibeCounts: Record<string, number> = {}
  for (const t of tripsByVibes.data || []) {
    for (const v of t.vibes || []) {
      vibeCounts[v] = (vibeCounts[v] || 0) + 1
    }
  }
  const topVibes = Object.entries(vibeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([vibe, count]) => ({ vibe, count }))

  // Category breakdown
  const catCounts: Record<string, number> = {}
  for (const i of itemsByCategory.data || []) {
    catCounts[i.category] = (catCounts[i.category] || 0) + 1
  }

  // Chat engagement
  const uniqueTripsWithChat = new Set((tripsWithChat.data || []).map(m => m.trip_id)).size
  const chatEngagementRate = tripsTotal.count ? Math.round((uniqueTripsWithChat / tripsTotal.count) * 100) : 0

  // Eval quality
  const evalScores = (evalResults.data || []).map(e => e.overall_score)
  const avgEvalScore = evalScores.length ? Math.round(evalScores.reduce((s, v) => s + v, 0) / evalScores.length) : 0

  // Eval by destination
  const evalDestScores: Record<string, { total: number; count: number }> = {}
  for (const e of evalByDest.data || []) {
    if (!evalDestScores[e.destination]) evalDestScores[e.destination] = { total: 0, count: 0 }
    evalDestScores[e.destination].total += e.overall_score
    evalDestScores[e.destination].count++
  }
  const qualityByDestination = Object.entries(evalDestScores)
    .map(([dest, { total, count }]) => ({ destination: dest, avgScore: Math.round(total / count), evalCount: count }))
    .sort((a, b) => a.avgScore - b.avgScore)

  // Week-over-week growth
  const tripsWoW = tripsPrevWeek.count && tripsThisWeek.count
    ? Math.round(((tripsThisWeek.count - tripsPrevWeek.count) / Math.max(tripsPrevWeek.count, 1)) * 100)
    : 0

  // Growth marketing totals
  const gmTotals = { impressions: 0, clicks: 0, likes: 0, comments: 0, shares: 0, signups: 0, tripsCreated: 0 }
  for (const m of growthMetrics.data || []) {
    gmTotals.impressions += m.impressions || 0
    gmTotals.clicks += m.clicks || 0
    gmTotals.likes += m.likes || 0
    gmTotals.comments += m.comments || 0
    gmTotals.shares += m.shares || 0
    gmTotals.signups += m.signups || 0
    gmTotals.tripsCreated += m.trips_created || 0
  }

  // Posts by platform
  const postsByPlatform: Record<string, number> = {}
  for (const p of growthPosts.data || []) {
    postsByPlatform[p.platform] = (postsByPlatform[p.platform] || 0) + 1
  }

  return NextResponse.json({
    asOf: today,

    // ─── Key Numbers ───────────────────────────
    summary: {
      totalUsers: uniqueUsers,
      realUsers,
      anonUsers,
      convertedUsers,
      conversionRate, // % of all users who signed up (anon → real)
      totalTrips: tripsTotal.count || 0,
      realTrips,
      anonTrips,
      totalItems: itemsTotal.count || 0,
      totalChats: chatTotal.count || 0,
      avgEvalScore,
      weeklyNewUsers,
      weeklyRealUsers,
      weeklyTrips: tripsThisWeek.count || 0,
      monthlyTrips: tripsThisMonth.count || 0,
      tripsWoW,
      chatEngagementRate,
      avgItemsPerTrip: tripsTotal.count ? Math.round((itemsTotal.count || 0) / tripsTotal.count) : 0,
    },

    // ─── Daily Trend (30 days) ─────────────────
    dailyTrips: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),

    // ─── Breakdowns ────────────────────────────
    topDestinations,
    topVibes,
    budgetBreakdown: budgetCounts,
    categoryBreakdown: catCounts,

    // ─── Quality ───────────────────────────────
    qualityByDestination,
    evalCount: evalScores.length,

    // ─── Growth Marketing ──────────────────────
    growth: {
      totalPosts: growthPosts.data?.length || 0,
      postsByPlatform,
      metrics: gmTotals,
    },

    // ─── Activity Feed ─────────────────────────
    recentTrips: (recentTrips.data || []).map(t => ({
      id: t.id,
      destination: t.destination,
      country: t.country,
      vibes: t.vibes,
      budget: t.budget,
      travelers: t.travelers,
      createdAt: t.created_at,
    })),

    // ─── Top Items ─────────────────────────────
    popularItems: (popularItems.data || []).map(i => ({
      name: i.item_name,
      destination: i.destination,
      type: i.item_type,
      score: i.score,
      picks: i.pick_count,
      skips: i.skip_count,
    })),
  })
}
