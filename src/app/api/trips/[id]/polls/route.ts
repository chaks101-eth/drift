import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { token: null, supabase: null }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  return { token, supabase }
}

// GET /api/trips/[id]/polls — get all polls for a trip
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params

  const { data } = await db()
    .from('itinerary_items')
    .select('id, name, metadata')
    .eq('trip_id', tripId)

  const polls = (data || [])
    .filter(item => (item.metadata as Record<string, unknown>)?.poll)
    .map(item => {
      const poll = (item.metadata as Record<string, unknown>).poll as {
        options: Array<{ name: string; detail: string; price: string; votes: string[] }>
        createdBy: string
        status: 'open' | 'closed'
      }
      return { itemId: item.id, itemName: item.name, ...poll }
    })

  return NextResponse.json({ polls })
}

// POST /api/trips/[id]/polls — create a poll on an item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const { supabase: authClient } = getAuthUser(req)
  if (!authClient) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const { data: item } = await db()
    .from('itinerary_items')
    .select('name, detail, price, category, metadata')
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const meta = (item.metadata || {}) as Record<string, unknown>

  // Guard: one active poll per item
  if (meta.poll && (meta.poll as { status: string }).status === 'open') {
    return NextResponse.json({ error: 'A poll is already active on this item' }, { status: 409 })
  }

  let alts = (meta.alts || []) as Array<{ name: string; detail?: string; price?: string }>

  // If no alternatives exist, generate them via AI
  if (alts.length === 0) {
    try {
      // Get trip destination for context
      const { data: trip } = await db().from('trips').select('destination, country, vibes, budget').eq('id', tripId).single()

      const llm = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY!,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      })

      const res = await llm.chat.completions.create({
        model: 'gemini-2.5-flash',
        max_tokens: 512,
        messages: [
          { role: 'system', content: 'Output ONLY a JSON array. No markdown.' },
          { role: 'user', content: `Suggest 2 alternatives to "${item.name}" (${item.category}) in ${trip?.destination || 'this destination'}.
Budget: ${trip?.budget || 'mid'} | Vibes: ${(trip?.vibes || []).join(', ')}
Each alternative should be a real place, similar category but different style/price.
Format: [{"name": "Place Name", "detail": "One line why", "price": "$XX"}]
JSON array only.` },
        ],
      })

      const text = (res.choices[0].message.content || '[]').replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        alts = JSON.parse(match[0])
        // Save generated alts to the item for future use
        await db().from('itinerary_items').update({ metadata: { ...meta, alts } }).eq('id', itemId)
      }
    } catch (e) {
      console.warn('[Polls] AI alternative generation failed:', e)
      // Continue with empty alts — poll will just have the current item
    }
  }

  // Build poll: current item + up to 2 alternatives
  const options = [
    { name: item.name, detail: item.detail || '', price: item.price || '', votes: [] as string[] },
    ...alts.slice(0, 2).map(a => ({
      name: a.name, detail: a.detail || '', price: a.price || '', votes: [] as string[],
    })),
  ]

  const userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Someone'
  const poll = { options, createdBy: userName, status: 'open' as const }

  await db().from('itinerary_items').update({
    metadata: { ...meta, poll, alts },
  }).eq('id', itemId)

  return NextResponse.json({ poll: { itemId, itemName: item.name, ...poll } })
}

// PATCH /api/trips/[id]/polls — vote OR apply result OR close
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params
  const { supabase: authClient } = getAuthUser(req)
  if (!authClient) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { itemId, action } = body // action: 'vote' | 'apply' | 'close'

  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })

  const { data: item } = await db()
    .from('itinerary_items')
    .select('name, detail, price, image_url, metadata')
    .eq('id', itemId)
    .eq('trip_id', tripId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const meta = (item.metadata || {}) as Record<string, unknown>
  const poll = meta.poll as { options: Array<{ name: string; detail: string; price: string; votes: string[] }>; status: string } | undefined

  if (!poll) return NextResponse.json({ error: 'No poll on this item' }, { status: 400 })

  // ─── Vote ───
  if (action === 'vote' || !action) {
    const optionIndex = body.optionIndex
    if (optionIndex === undefined || poll.status !== 'open') {
      return NextResponse.json({ error: 'Invalid vote' }, { status: 400 })
    }

    // Remove user's vote from all, add to selected
    for (const opt of poll.options) {
      opt.votes = opt.votes.filter(v => v !== user.id)
    }
    if (poll.options[optionIndex]) {
      poll.options[optionIndex].votes.push(user.id)
    }

    await db().from('itinerary_items').update({ metadata: { ...meta, poll } }).eq('id', itemId)
    return NextResponse.json({ voted: true, poll })
  }

  // ─── Apply result (swap to winner) ───
  if (action === 'apply') {
    // Verify trip ownership
    const { data: trip } = await db().from('trips').select('user_id').eq('id', tripId).single()
    if (!trip || trip.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the trip owner can apply poll results' }, { status: 403 })
    }

    // Find the winner (most votes)
    const winner = poll.options.reduce((a, b) => a.votes.length >= b.votes.length ? a : b)

    // If winner is the current item, just close the poll
    if (winner.name === item.name) {
      poll.status = 'closed'
      await db().from('itinerary_items').update({ metadata: { ...meta, poll } }).eq('id', itemId)
      return NextResponse.json({ applied: true, swapped: false, winner: winner.name })
    }

    // Swap the item to the winner
    poll.status = 'closed'
    await db().from('itinerary_items').update({
      name: winner.name,
      detail: winner.detail || item.detail,
      price: winner.price || item.price,
      metadata: { ...meta, poll, swappedFrom: item.name },
    }).eq('id', itemId)

    return NextResponse.json({ applied: true, swapped: true, winner: winner.name })
  }

  // ─── Close (dismiss poll without applying) ───
  if (action === 'close') {
    poll.status = 'closed'
    await db().from('itinerary_items').update({ metadata: { ...meta, poll } }).eq('id', itemId)
    return NextResponse.json({ closed: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
