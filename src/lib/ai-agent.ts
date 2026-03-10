// ─── Drift AI Agent ───────────────────────────────────────────
// Full agentic loop: Reason → Act (tool) → Observe → Respond
// Max 3 tool rounds per conversation turn.
// Gemini 2.5 Flash primary, Groq fallback.

import OpenAI from 'openai'
import type { ItineraryItem } from './database.types'
import { buildChatSystemPrompt, GENERATION_SYSTEM_PROMPT, DESTINATION_SYSTEM_PROMPT } from './ai-prompts'
import { buildTripSummary, buildItemContext, loadCatalogSummary } from './ai-context'
import { TOOL_DEFINITIONS, executeTool, type ChatAction, type ToolResult } from './ai-tools'

// ─── JSON Repair (handles truncated LLM output) ─────────────

function repairTruncatedJson(text: string): string {
  // Find the last complete object by tracking brace/bracket depth
  let lastValidEnd = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '[' || ch === '{') depth++
    if (ch === ']' || ch === '}') {
      depth--
      if (depth === 1 && ch === '}') {
        // Just closed a top-level object inside the array
        lastValidEnd = i + 1
      }
    }
  }

  if (lastValidEnd > 0) {
    // Slice to last complete object, close the array
    return text.slice(0, lastValidEnd) + ']'
  }

  // Fallback: return empty array
  return '[]'
}

// ─── LLM Client ──────────────────────────────────────────────

let _llm: OpenAI | null = null
function getLlm() {
  if (!_llm) {
    if (process.env.GEMINI_API_KEY) {
      _llm = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      })
    } else {
      _llm = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      })
    }
  }
  return _llm
}

function getModel() {
  if (process.env.GEMINI_API_KEY) return 'gemini-2.5-flash'
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
}

// ─── Response Types ──────────────────────────────────────────

export interface AgentResponse {
  text: string
  actions: ChatAction[]
  toolsUsed: string[]
  tokenUsage?: { prompt: number; completion: number; total: number }
}

// ─── Chat Agent (Agentic Loop) ───────────────────────────────

const MAX_TOOL_ROUNDS = 3

export async function chatWithAgent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: {
    tripId: string
    destination: string
    country?: string
    vibes: string[]
    budget: string
    travelers: number
    itinerary?: ItineraryItem[]
    contextItem?: ItineraryItem | null
  },
): Promise<AgentResponse> {
  const llm = getLlm()
  const model = getModel()
  const startTime = Date.now()

  // ─── Build context layers ────────────────────────────────
  const tripSummary = context.itinerary ? buildTripSummary(context.itinerary) : ''
  const itemContext = context.contextItem ? buildItemContext(context.contextItem) : ''

  // Load slim catalog summary (names + prices only — full detail via tools)
  let catalogContext = ''
  if (context.destination) {
    try {
      catalogContext = await loadCatalogSummary(context.destination)
    } catch {
      // Best-effort
    }
  }

  // Build system prompt using Genia pattern
  const systemPrompt = buildChatSystemPrompt({
    destination: `${context.destination}${context.country ? `, ${context.country}` : ''}`,
    vibes: context.vibes,
    budget: context.budget,
    travelers: context.travelers,
    catalogContext,
    itemContext,
    tripSummary,
  })

  // ─── Agentic loop ────────────────────────────────────────
  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const allActions: ChatAction[] = []
  const toolsUsed: string[] = []
  let totalUsage = { prompt: 0, completion: 0, total: 0 }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS} — ${model}`)

    const response = await llm.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: conversationMessages,
      tools: TOOL_DEFINITIONS,
    })

    // Track usage
    if (response.usage) {
      totalUsage.prompt += response.usage.prompt_tokens || 0
      totalUsage.completion += response.usage.completion_tokens || 0
      totalUsage.total += response.usage.total_tokens || 0
    }

    const choice = response.choices[0]
    const message = choice.message

    // If no tool calls, we're done — return the text response
    if (!message.tool_calls?.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[Agent] Done in ${elapsed}s — ${toolsUsed.length} tools used, ${totalUsage.total} tokens`)
      return {
        text: message.content || '',
        actions: allActions,
        toolsUsed,
        tokenUsage: totalUsage,
      }
    }

    // ─── Execute tool calls ──────────────────────────────
    // Add the assistant's message (with tool calls) to conversation
    conversationMessages.push({
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.tool_calls,
    } as OpenAI.ChatCompletionMessageParam)

    for (const toolCall of message.tool_calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tc = toolCall as any
      const toolName = tc.function.name as string
      let args: Record<string, unknown>
      try {
        args = JSON.parse(tc.function.arguments)
      } catch {
        args = {}
      }

      console.log(`[Agent] Tool: ${toolName}(${JSON.stringify(args).slice(0, 100)})`)
      toolsUsed.push(toolName)

      // Build tool execution context
      const execContext = {
        tripId: context.tripId,
        destination: context.destination,
        items: (context.itinerary || []).map(i => ({
          id: i.id,
          category: i.category,
          name: i.name,
          price: i.price,
          position: i.position,
          status: i.status,
          metadata: i.metadata as Record<string, unknown> | null,
        })),
      }

      let result: ToolResult
      try {
        result = await executeTool(toolName, args, execContext)
      } catch (e) {
        result = { success: false, data: { error: e instanceof Error ? e.message : String(e) } }
      }

      console.log(`[Agent] Tool ${toolName}: ${result.success ? 'OK' : 'FAILED'}`)

      // Collect actions for frontend
      if (result.actions) {
        allActions.push(...result.actions)
      }

      // Feed result back to LLM as tool response
      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.data),
      } as OpenAI.ChatCompletionMessageParam)
    }
  }

  // Max rounds exhausted — do one final call without tools to get a response
  console.log(`[Agent] Max rounds reached — generating final response`)
  const finalResponse = await llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: conversationMessages,
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Agent] Done in ${elapsed}s — ${toolsUsed.length} tools used (max rounds hit)`)

  return {
    text: finalResponse.choices[0].message.content || '',
    actions: allActions,
    toolsUsed,
    tokenUsage: totalUsage,
  }
}

// ─── Itinerary Generation (non-agentic, single LLM call) ────

export async function generateItinerary(params: {
  destination: string
  country: string
  vibes: string[]
  startDate: string
  endDate: string
  travelers: number
  budget: string
  budgetAmount?: number
  originCity: string
  occasion?: string
}) {
  const llm = getLlm()
  const model = getModel()

  // Calculate trip duration for short-trip awareness
  const start = new Date(params.startDate)
  const end = new Date(params.endDate)
  const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  const budgetLine = params.budgetAmount
    ? `Budget: $${params.budgetAmount} total per person ($${Math.round(params.budgetAmount / numDays)}/person/day) — level: ${params.budget}`
    : `Budget: ${params.budget}`
  const durationNote = numDays <= 3 ? `\nThis is a SHORT trip (${numDays} days) — pack only highlights, skip filler.` : ''
  const occasionNote = params.occasion && params.occasion !== 'Just exploring'
    ? `\nOccasion: ${params.occasion} — tailor activities, restaurants, and hotel style to this occasion.`
    : ''

  const userContent = `Generate a complete day-by-day itinerary for a trip to ${params.destination}, ${params.country}.

Vibes: ${params.vibes.join(', ')}
Dates: ${params.startDate} to ${params.endDate} (${numDays} days)
Travelers: ${params.travelers}
${budgetLine}
Flying from: ${params.originCity}${durationNote}${occasionNote}

Start with outbound flight, then hotel check-in, then day-by-day activities/food, end with return flight.
Use "day" items as separators. Use "transfer" for travel between locations.
Include 2-3 alternatives in metadata.alts for flights, hotels, and major activities.
Keep descriptions short (1 sentence max) to stay within token limits.
Return ONLY the JSON array.`

  const response = await llm.chat.completions.create({
    model,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  })

  const text = response.choices[0].message.content || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  // Try to parse; if truncated JSON, attempt repair
  try {
    return JSON.parse(cleaned) as Array<{
      category: string; name: string; detail: string; description: string;
      price: string; image_url: string; time: string; position: number;
      metadata: Record<string, unknown>
    }>
  } catch {
    console.warn('[Generate] JSON truncated, attempting repair...')
    const repaired = repairTruncatedJson(cleaned)
    return JSON.parse(repaired) as Array<{
      category: string; name: string; detail: string; description: string;
      price: string; image_url: string; time: string; position: number;
      metadata: Record<string, unknown>
    }>
  }
}

// ─── Destination Suggestions (non-agentic, single LLM call) ─

export async function suggestDestinations(vibes: string[], budget: string, origin: string) {
  const llm = getLlm()
  const model = getModel()

  const response = await llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: DESTINATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Suggest 4 destinations that match these vibes: ${vibes.join(', ')}.
Budget level: ${budget || 'mid'}
Flying from: ${origin || 'Delhi'}

Be opinionated — rank by match percentage.
Return ONLY the JSON array.`,
      },
    ],
  })

  const text = response.choices[0].message.content || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}
