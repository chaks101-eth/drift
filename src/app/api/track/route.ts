import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { trackInteraction, getPopularItems, InteractionAction } from '@/lib/tracking'

// POST /api/track — track a user interaction
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { itemType, itemName, destination, action } = body

  if (!itemType || !itemName || !destination || !action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const validActions = ['picked', 'skipped', 'saved', 'clicked', 'booked']
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  await trackInteraction({
    userId: user.id,
    itemType,
    itemName,
    destination,
    action: action as InteractionAction,
    metadata: body.metadata,
  })

  return NextResponse.json({ tracked: true })
}

// GET /api/track?destination=Bali&type=hotel — get popular items
export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get('destination')
  if (!destination) return NextResponse.json({ error: 'destination required' }, { status: 400 })

  const itemType = req.nextUrl.searchParams.get('type') || undefined
  const items = await getPopularItems(destination, itemType)
  return NextResponse.json(items)
}
