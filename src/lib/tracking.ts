// ─── User Interaction Tracking ────────────────────────────────
// Tracks picks, skips, saves, clicks for popularity scoring

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type InteractionAction = 'picked' | 'skipped' | 'saved' | 'clicked' | 'booked'

export async function trackInteraction(params: {
  userId: string
  itemType: string
  itemName: string
  destination: string
  action: InteractionAction
  metadata?: Record<string, unknown>
}) {
  const db = getAdminClient()

  // Insert interaction
  await db.from('user_interactions').insert({
    user_id: params.userId,
    item_type: params.itemType,
    item_name: params.itemName,
    destination: params.destination,
    action: params.action,
    metadata: params.metadata || {},
  })

  // Update popularity score
  const actionCol = `${params.action.replace('ed', '')}_count`
  const validCols = ['pick_count', 'skip_count', 'save_count', 'click_count', 'book_count']
  const col = validCols.includes(actionCol) ? actionCol : `${params.action}_count`

  // Upsert popularity
  const { data: existing } = await db
    .from('popularity_scores')
    .select('id, pick_count, skip_count, save_count, click_count, book_count')
    .eq('item_type', params.itemType)
    .ilike('item_name', params.itemName)
    .ilike('destination', params.destination)
    .single()

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (col in existing) {
      updates[col] = ((existing as Record<string, number>)[col] || 0) + 1
    }
    // Recalculate score: picks*3 + saves*2 + clicks*1 - skips*1 + books*5
    const picks = (col === 'pick_count' ? (existing.pick_count || 0) + 1 : existing.pick_count || 0)
    const saves = (col === 'save_count' ? (existing.save_count || 0) + 1 : existing.save_count || 0)
    const clicks = (col === 'click_count' ? (existing.click_count || 0) + 1 : existing.click_count || 0)
    const skips = (col === 'skip_count' ? (existing.skip_count || 0) + 1 : existing.skip_count || 0)
    const books = (col === 'book_count' ? (existing.book_count || 0) + 1 : existing.book_count || 0)
    updates.score = picks * 3 + saves * 2 + clicks * 1 - skips * 1 + books * 5

    await db.from('popularity_scores').update(updates).eq('id', existing.id)
  } else {
    const base = { pick_count: 0, skip_count: 0, save_count: 0, click_count: 0, book_count: 0 }
    if (col in base) (base as Record<string, number>)[col] = 1
    const score = base.pick_count * 3 + base.save_count * 2 + base.click_count - base.skip_count + base.book_count * 5

    await db.from('popularity_scores').insert({
      item_type: params.itemType,
      item_name: params.itemName,
      destination: params.destination,
      ...base,
      score,
    })
  }
}

export async function getPopularItems(destination: string, itemType?: string, limit = 10) {
  const db = getAdminClient()
  let query = db
    .from('popularity_scores')
    .select('*')
    .ilike('destination', destination)
    .order('score', { ascending: false })
    .limit(limit)

  if (itemType) query = query.eq('item_type', itemType)

  const { data } = await query
  return data || []
}
