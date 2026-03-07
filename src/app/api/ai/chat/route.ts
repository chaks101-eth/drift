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

  let itinerary = null
  let contextItem = null
  let tripDestination: string | null = null

  if (tripId) {
    const [{ data: items }, { data: trip }] = await Promise.all([
      supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('position'),
      supabase.from('trips').select('destination, country').eq('id', tripId).single(),
    ])
    itinerary = items
    if (trip) tripDestination = `${trip.destination}, ${trip.country}`
  }

  if (contextItemId) {
    const { data } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('id', contextItemId)
      .single()
    contextItem = data
  }

  try {
    const response = await chatWithAgent(messages, itinerary ?? undefined, contextItem, tripDestination ?? undefined)

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

    const toolCall = response.toolCalls[0] as { function: { name: string; arguments: string } } | undefined

    return NextResponse.json({
      text: response.text,
      toolUse: toolCall ? {
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      } : null,
      finishReason: response.finishReason,
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'AI service error' }, { status: 500 })
  }
}
