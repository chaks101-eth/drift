// ─── Drift AI Agent ───────────────────────────────────────────
// Full agentic loop: Reason → Act (tool) → Observe → Respond
// Max 3 tool rounds per conversation turn.
// Gemini 2.5 Flash primary, Groq fallback.

import OpenAI from 'openai'
import type { ItineraryItem } from './database.types'
import { buildChatSystemPrompt, GENERATION_SYSTEM_PROMPT, DESTINATION_SYSTEM_PROMPT } from './ai-prompts'
import { buildTripSummary, buildItemContext, loadCatalogSummary } from './ai-context'
import { TOOL_DEFINITIONS, executeTool, type ChatAction, type ToolResult } from './ai-tools'
import { analyzeTrip, formatAnalysisForLLM } from './ai-intelligence'

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
export function getLlm() {
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

export function getModel() {
  if (process.env.GEMINI_API_KEY) return 'gemini-2.5-flash'
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
}

// ─── Retry & Throttle (rate limit handling) ──────────────────

let lastLlmCall = 0

/** Enforce minimum gap between LLM calls (Gemini Tier 1: 2000 RPM) */
export async function throttleLlm(): Promise<void> {
  const gap = 500 // 0.5s — safe for paid tier (2000 RPM)
  const elapsed = Date.now() - lastLlmCall
  if (elapsed < gap) {
    await new Promise(r => setTimeout(r, gap - elapsed))
  }
  lastLlmCall = Date.now()
}

/** Retry with exponential backoff on 429 rate limits */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const delays = [8000, 15000, 25000]
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status
      const isRateLimit = status === 429 || (e instanceof Error && e.message.includes('429'))
      if (!isRateLimit || attempt >= maxRetries) throw e
      const delay = delays[attempt] || 25000
      console.log(`[AI] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('withRetry: exhausted retries')
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
    startDate?: string
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

  // Run trip intelligence analysis (spatial, temporal, pacing)
  let tripAnalysis = ''
  if (context.itinerary?.length) {
    try {
      const analysis = analyzeTrip(context.itinerary, { vibes: context.vibes })
      tripAnalysis = formatAnalysisForLLM(analysis)
    } catch {
      // Best-effort
    }
  }

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
    tripAnalysis,
  })

  // ─── Agentic loop ────────────────────────────────────────
  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-12).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const allActions: ChatAction[] = []
  const toolsUsed: string[] = []
  let totalUsage = { prompt: 0, completion: 0, total: 0 }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[Agent] Round ${round + 1}/${MAX_TOOL_ROUNDS} — ${model}`)

    await throttleLlm()
    const response = await withRetry(() => llm.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: conversationMessages,
      tools: TOOL_DEFINITIONS,
    }))

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
        vibes: context.vibes,
        startDate: context.startDate,
        items: (context.itinerary || []).map(i => ({
          id: i.id,
          category: i.category,
          name: i.name,
          price: i.price,
          position: i.position,
          status: i.status,
          metadata: i.metadata as Record<string, unknown> | null,
        })),
        fullItems: context.itinerary,
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
  await throttleLlm()
  const finalResponse = await withRetry(() => llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: conversationMessages,
  }))

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Agent] Done in ${elapsed}s — ${toolsUsed.length} tools used (max rounds hit)`)

  return {
    text: finalResponse.choices[0].message.content || '',
    actions: allActions,
    toolsUsed,
    tokenUsage: totalUsage,
  }
}

// ─── Streaming Chat Agent ─────────────────────────────────────
// Same agentic loop but streams SSE events: tool progress, text tokens, actions

export async function chatWithAgentStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  context: {
    tripId: string
    destination: string
    country?: string
    vibes: string[]
    budget: string
    travelers: number
    startDate?: string
    itinerary?: ItineraryItem[]
    contextItem?: ItineraryItem | null
  },
  writer: WritableStreamDefaultWriter<Uint8Array>,
): Promise<void> {
  const encoder = new TextEncoder()
  const send = (event: string, data: unknown) => {
    writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  const llm = getLlm()
  const model = getModel()

  // Build context (same as non-streaming)
  const tripSummary = context.itinerary ? buildTripSummary(context.itinerary) : ''
  const itemContext = context.contextItem ? buildItemContext(context.contextItem) : ''

  let tripAnalysis = ''
  if (context.itinerary?.length) {
    try {
      const analysis = analyzeTrip(context.itinerary, { vibes: context.vibes })
      tripAnalysis = formatAnalysisForLLM(analysis)
    } catch { /* best-effort */ }
  }

  let catalogContext = ''
  if (context.destination) {
    try {
      catalogContext = await loadCatalogSummary(context.destination)
    } catch { /* best-effort */ }
  }

  const systemPrompt = buildChatSystemPrompt({
    destination: `${context.destination}${context.country ? `, ${context.country}` : ''}`,
    vibes: context.vibes,
    budget: context.budget,
    travelers: context.travelers,
    catalogContext,
    itemContext,
    tripSummary,
    tripAnalysis,
  })

  const conversationMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-12).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  const allActions: ChatAction[] = []
  const toolsUsed: string[] = []

  // Tool label map for user-friendly progress messages
  const toolLabels: Record<string, string> = {
    search_catalog: 'Searching catalog...',
    swap_item: 'Swapping item...',
    adjust_budget: 'Analyzing budget...',
    get_trip_insights: 'Analyzing your trip...',
    search_flights: 'Searching flights...',
    add_item: 'Adding to your trip...',
    validate_trip: 'Validating itinerary...',
    update_trip: 'Updating trip...',
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    await throttleLlm()
    const response = await withRetry(() => llm.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: conversationMessages,
      tools: TOOL_DEFINITIONS,
    }))

    const choice = response.choices[0]
    const message = choice.message

    // No tool calls → stream the final text
    if (!message.tool_calls?.length) {
      const text = message.content || ''
      // Stream text in chunks for smooth appearance
      const words = text.split(/(\s+)/)
      let streamed = ''
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join('')
        streamed += chunk
        send('text', { content: streamed })
        // Small delay for visual streaming effect
        await new Promise(r => setTimeout(r, 30))
      }
      send('actions', { actions: allActions, toolsUsed })
      send('done', {})
      await writer.close()
      return
    }

    // Execute tool calls
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
      try { args = JSON.parse(tc.function.arguments) } catch { args = {} }

      toolsUsed.push(toolName)
      send('tool', { name: toolName, label: toolLabels[toolName] || `Using ${toolName}...` })

      const execContext = {
        tripId: context.tripId,
        destination: context.destination,
        vibes: context.vibes,
        startDate: context.startDate,
        items: (context.itinerary || []).map(i => ({
          id: i.id, category: i.category, name: i.name, price: i.price,
          position: i.position, status: i.status,
          metadata: i.metadata as Record<string, unknown> | null,
        })),
        fullItems: context.itinerary,
      }

      let result: ToolResult
      try {
        result = await executeTool(toolName, args, execContext)
      } catch (e) {
        result = { success: false, data: { error: e instanceof Error ? e.message : String(e) } }
      }

      if (result.actions) allActions.push(...result.actions)

      conversationMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result.data),
      } as OpenAI.ChatCompletionMessageParam)
    }
  }

  // Max rounds exhausted — final call without tools, stream result
  await throttleLlm()
  const finalResponse = await withRetry(() => llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: conversationMessages,
  }))

  const text = finalResponse.choices[0].message.content || ''
  const words = text.split(/(\s+)/)
  let streamed = ''
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join('')
    streamed += chunk
    send('text', { content: streamed })
    await new Promise(r => setTimeout(r, 30))
  }
  send('actions', { actions: allActions, toolsUsed })
  send('done', {})
  await writer.close()
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
  urlHighlights?: Array<{ name: string; category: string; detail: string; estimatedPrice?: string }>
  urlSummary?: string
  planningNotes?: string
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

  // URL highlights from content-to-trip extraction
  let urlSection = ''
  if (params.urlHighlights?.length) {
    const mentioned = params.urlHighlights.filter(h => !h.estimatedPrice?.includes('inferred'))
    urlSection = `\n\nIMPORTANT — This trip is based on content the user shared. You MUST include these places:
${mentioned.map(h => `- ${h.name} (${h.category}): ${h.detail}`).join('\n')}
${params.urlSummary ? `\nContent summary: ${params.urlSummary}` : ''}
Tag each included highlight with metadata.source: "url_import". Any additional items you add should have metadata.source: "ai".`
  }

  // Build date labels for each day
  const dayDates: string[] = []
  for (let d = 0; d < numDays; d++) {
    const date = new Date(start)
    date.setDate(date.getDate() + d)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dayDates.push(`${dayName}, ${monthDay}`)
  }

  const userContent = `Generate a complete day-by-day itinerary for a trip to ${params.destination}, ${params.country}.

Vibes: ${params.vibes.join(', ')}
Dates: ${params.startDate} to ${params.endDate} (${numDays} days)
Travelers: ${params.travelers}
${budgetLine}
Flying from: ${params.originCity}${durationNote}${occasionNote}${urlSection}${params.planningNotes || ''}

CRITICAL: You MUST generate EXACTLY ${numDays} day separators — one for each day:
${dayDates.map((d, i) => `  Day ${i + 1} (${d})`).join('\n')}

Start with outbound flight, then hotel check-in, then day-by-day activities/food, end with return flight.
Use "day" items as separators with name: "Day 1 — Theme · ${dayDates[0]}", "Day 2 — Theme · ${dayDates[1] || ''}", etc. Include the actual date in the name.
Each day must have 2-4 activities + 1-2 meals. Do NOT leave any day empty.
Include 2-3 alternatives in metadata.alts for hotels and major activities.
Keep descriptions short (1 sentence max) to stay within token limits.
IMPORTANT: Each day separator must have metadata.day_insight (opinionated 1-2 sentence comment about that day). The first day must also have metadata.trip_brief (2-3 sentence overall trip strategy).
IMPORTANT: If planning intelligence or weather data is provided above, USE IT. Group nearby places on the same day. Respect best times. Schedule outdoor activities on sunny days and indoor on rainy days. This is real data, not guesswork.
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

  type GeneratedItem = {
    category: string; name: string; detail: string; description: string;
    price: string; image_url: string; time: string; position: number;
    metadata: Record<string, unknown>
  }

  // Try to parse; if truncated JSON, attempt repair
  let items: GeneratedItem[]
  try {
    items = JSON.parse(cleaned) as GeneratedItem[]
  } catch {
    console.warn('[Generate] JSON truncated, attempting repair...')
    const repaired = repairTruncatedJson(cleaned)
    items = JSON.parse(repaired) as GeneratedItem[]
  }

  // Validate: check for empty days and missing days
  const daySeparators = items.filter(i => i.category === 'day')
  const lastDayIdx = items.findLastIndex(i => i.category === 'day')
  const itemsAfterLastDay = lastDayIdx >= 0 ? items.slice(lastDayIdx + 1).filter(i => i.category !== 'flight' && i.category !== 'transfer') : []

  if (daySeparators.length < numDays || (lastDayIdx >= 0 && itemsAfterLastDay.length === 0)) {
    console.warn(`[Generate] Incomplete: ${daySeparators.length}/${numDays} days generated, last day has ${itemsAfterLastDay.length} items. Removing empty trailing day.`)
    // Remove the empty trailing day separator
    if (lastDayIdx >= 0 && itemsAfterLastDay.length === 0) {
      items.splice(lastDayIdx, 1)
    }
  }

  return items
}

// ─── Personalization Pass (catalog trips → feels hand-crafted) ──

export async function personalizeItinerary(
  items: Array<{
    category: string; name: string; detail: string; description: string;
    price: string; image_url: string; time: string; position: number;
    metadata: Record<string, unknown>
  }>,
  context: {
    destination: string
    country: string
    vibes: string[]
    budget: string
    budgetAmount?: number
    travelers: number
    occasion?: string
    startDate: string
  }
): Promise<Array<{
  category: string; name: string; detail: string; description: string;
  price: string; image_url: string; time: string; position: number;
  metadata: Record<string, unknown>
}>> {
  const llm = getLlm()
  const model = getModel()

  // Build a slim representation for the LLM — just what it needs to personalize
  const itemSummaries = items.map((item, idx) => {
    const meta = item.metadata || {}
    const parts: string[] = [`[${idx}] ${item.category}: ${item.name}`]
    if (item.price) parts[0] += ` (${item.price})`
    if (item.time) parts[0] += ` at ${item.time}`
    if (meta.honest_take) parts.push(`  Honest take: ${meta.honest_take}`)
    if (meta.best_for) parts.push(`  Best for: ${(meta.best_for as string[]).join(', ')}`)
    if (meta.review_synthesis) {
      const rs = meta.review_synthesis as Record<string, string[]>
      if (rs.loved?.length) parts.push(`  People love: ${rs.loved.join(', ')}`)
      if (rs.complaints?.length) parts.push(`  Complaints: ${rs.complaints.join(', ')}`)
    }
    if (meta.pairs_with) parts.push(`  Pairs with: ${(meta.pairs_with as string[]).join(', ')}`)
    if (meta.features) parts.push(`  Features: ${(meta.features as string[]).slice(0, 5).join(', ')}`)
    return parts.join('\n')
  }).join('\n\n')

  const numDays = items.filter(i => i.category === 'day').length
  const occasionNote = context.occasion && context.occasion !== 'Just exploring'
    ? `\nOccasion: ${context.occasion}` : ''

  const prompt = `You are Drift's travel personality engine. You take a pre-built itinerary with real data and make it feel hand-crafted for THIS specific traveler.

The traveler wants: ${context.vibes.join(', ')} vibes
Destination: ${context.destination}, ${context.country}
Budget: ${context.budgetAmount ? `$${context.budgetAmount} total (${context.budget})` : context.budget}
Travelers: ${context.travelers}${occasionNote}
Duration: ${numDays} days starting ${context.startDate}

Here's their itinerary (real catalog data — don't change names, prices, or times):

${itemSummaries}

Generate a JSON object with personalization for each item. Return ONLY this JSON:
{
  "trip_brief": "2-3 sentence strategy for this specific trip — mention their vibes, why this destination matches, what makes this plan different from a generic tourist itinerary",
  "items": {
    "0": { "day_insight": "..." },
    "1": { "reason": "...", "whyFactors": ["...", "...", "..."] },
    ...
  }
}

Rules:
1. For "day" items: Generate "day_insight" — an opinionated 1-2 sentence comment about that day. Speak directly to the traveler. Reference actual places by name. Be specific, not generic.
2. For hotel/activity/food items: Generate "reason" (one-line opinionated tagline why THIS item for THIS traveler's vibes) and "whyFactors" (3-4 bullet points connecting item features to their specific vibes/budget/occasion). Reference real data like ratings, reviews, and features when available.
3. Make every reason feel personal — "Perfect for your romance vibe — couples-only pool" not "Good hotel with pool".
4. Be honest. If something has tradeoffs, mention them in whyFactors — "Room sizes are small, but the rooftop sunset views make up for it".
5. "trip_brief" goes on the FIRST day separator only.
6. Skip flights and transfers — don't generate reasons for those.

Return ONLY the JSON object. First character must be {, last must be }.`

  try {
    console.log(`[Personalize] Running for ${items.length} items — ${context.vibes.join(',')} vibes`)
    await throttleLlm()
    const response = await withRetry(() => llm.chat.completions.create({
      model,
      max_tokens: 8192,
      messages: [
        { role: 'user', content: prompt },
      ],
    }))

    const text = response.choices[0].message.content || '{}'
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const personalization = JSON.parse(cleaned) as {
      trip_brief?: string
      items: Record<string, { day_insight?: string; reason?: string; whyFactors?: string[] }>
    }

    console.log(`[Personalize] Got ${Object.keys(personalization.items || {}).length} item personalizations`)

    // Merge personalization back into items
    let firstDay = true
    return items.map((item, idx) => {
      const p = personalization.items?.[String(idx)]
      if (!p) return item

      const meta = { ...item.metadata }

      if (item.category === 'day') {
        if (p.day_insight) meta.day_insight = p.day_insight
        if (firstDay && personalization.trip_brief) {
          meta.trip_brief = personalization.trip_brief
          firstDay = false
        }
      } else if (item.category !== 'flight' && item.category !== 'transfer') {
        if (p.reason) meta.reason = p.reason
        if (p.whyFactors?.length) meta.whyFactors = p.whyFactors
      }

      return { ...item, metadata: meta }
    })
  } catch (e) {
    console.warn(`[Personalize] Failed, returning items as-is: ${e}`)
    return items // Graceful fallback — trip still works, just without personality
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
