import { NextRequest, NextResponse } from 'next/server'
import { chatWithAgent } from '@/lib/ai-agent'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, tripId, contextItemId } = await req.json()

  // Load trip context
  let itinerary = null
  let contextItem = null
  let trip: { destination: string; country: string; vibes: string[]; budget: string; travelers: number } | null = null

  if (tripId) {
    const [{ data: items }, { data: tripData }] = await Promise.all([
      supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('position'),
      supabase.from('trips').select('destination, country, vibes, budget, travelers').eq('id', tripId).single(),
    ])
    itinerary = items
    trip = tripData
  }

  if (contextItemId) {
    const { data } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('id', contextItemId)
      .single()
    contextItem = data
  }

  // Load chat history for session continuity (Issue 5)
  let fullMessages = messages
  if (tripId) {
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (history?.length) {
      // Deduplicate: history from DB + current messages from frontend
      const historySet = new Set(history.map((m: { role: string; content: string }) => `${m.role}:${m.content}`))
      const newMessages = messages.filter((m: { role: string; content: string }) => !historySet.has(`${m.role}:${m.content}`))
      fullMessages = [
        ...history.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ...newMessages,
      ]
    }
  }

  try {
    const response = await chatWithAgent(fullMessages, {
      tripId: tripId || '',
      destination: trip?.destination || '',
      country: trip?.country || '',
      vibes: trip?.vibes || [],
      budget: trip?.budget || 'mid',
      travelers: trip?.travelers || 2,
      itinerary: itinerary ?? undefined,
      contextItem,
    })

    // Save messages to DB
    if (tripId && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1]
      await supabase.from('chat_messages').insert({
        trip_id: tripId,
        user_id: user.id,
        role: 'user',
        content: lastUserMsg.content,
        context_item_id: contextItemId || null,
      })

      if (response.text) {
        await supabase.from('chat_messages').insert({
          trip_id: tripId,
          user_id: user.id,
          role: 'assistant',
          content: response.text,
          context_item_id: contextItemId || null,
        })
      }
    }

    return NextResponse.json({
      text: response.text,
      actions: response.actions,
      toolsUsed: response.toolsUsed,
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'AI service error' }, { status: 500 })
  }
}
