import { NextRequest, NextResponse } from 'next/server'
import { chatWithAgent } from '@/lib/ai-agent'
import { createServerClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

// Vercel Hobby = 10s default, Pro = 60s. Extend for agentic loop.
export const maxDuration = 60

/** Strip JSON fragments, markdown fences, and tool artifacts from LLM response */
function sanitizeResponse(text: string): string {
  if (!text) return ''

  let clean = text

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  clean = clean.replace(/```(?:json)?\s*\n[\s\S]*?\n```/g, '').trim()

  // If the entire response looks like JSON (starts with { or [), replace with a fallback
  const trimmed = clean.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed) // If it parses, it's raw JSON leak
      return "I've updated your trip. Let me know if you'd like any other changes!"
    } catch {
      // Not valid JSON, probably fine
    }
  }

  // Strip inline JSON blobs that appear mid-text
  const jsonBlobRegex = /\{(?:\s*"[^"]+"\s*:[^}]+)+\}/g
  clean = clean.replace(jsonBlobRegex, '').trim()

  // Remove leftover empty lines
  clean = clean.replace(/\n{3,}/g, '\n\n').trim()

  // If nothing left after sanitization, return a generic acknowledgment
  if (!clean) return "Done! Let me know what else you'd like to change."

  return clean
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { allowed } = rateLimit(ip, { limit: 30, windowMs: 60_000 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Support both formats: { message: "text" } (frontend) and { messages: [...] } (legacy)
  const tripId = body.tripId
  const contextItemId = body.contextItemId
  const userMessage: string = body.message || (body.messages?.length ? body.messages[body.messages.length - 1].content : '')

  if (!userMessage) return NextResponse.json({ error: 'No message provided' }, { status: 400 })

  // Load trip context
  let itinerary = null
  let contextItem = null
  let trip: { destination: string; country: string; vibes: string[]; budget: string; travelers: number; start_date: string } | null = null

  if (tripId) {
    const [{ data: items }, { data: tripData }] = await Promise.all([
      supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('position'),
      supabase.from('trips').select('destination, country, vibes, budget, travelers, start_date').eq('id', tripId).single(),
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

  // Build message history from DB + current message
  let fullMessages: { role: 'user' | 'assistant'; content: string }[] = []
  if (tripId) {
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (history?.length) {
      fullMessages = history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
    }
  }

  // Add the current user message
  fullMessages.push({ role: 'user', content: userMessage })

  try {
    const response = await chatWithAgent(fullMessages, {
      tripId: tripId || '',
      destination: trip?.destination || '',
      country: trip?.country || '',
      vibes: trip?.vibes || [],
      budget: trip?.budget || 'mid',
      travelers: trip?.travelers || 2,
      startDate: trip?.start_date || undefined,
      itinerary: itinerary ?? undefined,
      contextItem,
    })

    // Sanitize the response — strip JSON leaks, markdown fences, tool artifacts
    const cleanText = sanitizeResponse(response.text)

    // Save messages to DB
    if (tripId) {
      await supabase.from('chat_messages').insert({
        trip_id: tripId,
        user_id: user.id,
        role: 'user',
        content: userMessage,
        context_item_id: contextItemId || null,
      })

      if (cleanText) {
        await supabase.from('chat_messages').insert({
          trip_id: tripId,
          user_id: user.id,
          role: 'assistant',
          content: cleanText,
          context_item_id: contextItemId || null,
        })
      }
    }

    return NextResponse.json({
      text: cleanText,
      actions: response.actions,
      toolsUsed: response.toolsUsed,
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'AI service error' }, { status: 500 })
  }
}
