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
  const delays = [1000, 2000, 4000] // Gemini paid tier — short backoff
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

  // Load catalog summary, or use trip items as context for non-catalog destinations
  let catalogContext = ''
  if (context.destination) {
    try {
      catalogContext = await loadCatalogSummary(context.destination, context.itinerary)
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
      catalogContext = await loadCatalogSummary(context.destination, context.itinerary)
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

// ─── Multi-Step Itinerary Generation ──────────────────────────
// Step 1: Generate trip outline (day themes, place names) — small, fast
// Step 2: Generate each day's details in PARALLEL — never truncates
// Result: consistent quality regardless of trip length

type GeneratedItem = {
  category: string; name: string; detail: string; description: string;
  price: string; image_url: string; time: string; position: number;
  metadata: Record<string, unknown>
}

interface DayOutline {
  dayNum: number
  date: string
  theme: string
  neighborhood_focus?: string
  places: string[]
  food?: { lunch?: string; dinner?: string }
  locked_today?: string[]
  dayInsight: string
  tripBrief?: string
}

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
  const startTime = Date.now()

  const start = new Date(params.startDate)
  const end = new Date(params.endDate)
  const numDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

  // Build date labels
  const dayDates: string[] = []
  for (let d = 0; d < numDays; d++) {
    const date = new Date(start)
    date.setDate(date.getDate() + d)
    dayDates.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
  }

  const budgetLine = params.budgetAmount
    ? `$${params.budgetAmount} total/person ($${Math.round(params.budgetAmount / numDays)}/day) — ${params.budget}`
    : params.budget
  const occasionNote = params.occasion && params.occasion !== 'Just exploring'
    ? `\nOccasion: ${params.occasion}` : ''

  // URL highlights
  let urlPlaces = ''
  if (params.urlHighlights?.length) {
    const mentioned = params.urlHighlights.filter(h => !h.estimatedPrice?.includes('inferred'))
    urlPlaces = `\nMUST include: ${mentioned.map(h => `${h.name} (${h.category})`).join(', ')}`
  }

  // ─── STEP 0: Lock must-see experiences ────────────────────────
  console.log(`[Generate] Step 0: Locking must-sees for ${params.destination}`)

  let lockedItems: Array<{ name: string; category: string; why_locked: string; half_day: boolean }> = []
  try {
    await throttleLlm()
    const lockRes = await withRetry(() => llm.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: 'You are a local expert. Output ONLY valid JSON arrays. No markdown.' },
        { role: 'user', content: `You have lived in ${params.destination}, ${params.country} for 10 years.

What experiences would a ${vibeStr} traveler deeply regret skipping?

Rules:
- Maximum 5 items
- Only destination-defining experiences (e.g. Grand Palace for Bangkok, Uluwatu Temple for Bali)
- Must align with ${vibeStr} vibes — if they want "foodie", lock a legendary food spot not a museum
- Be ruthless — exclude anything generic or available in any city
- Format: [{"name": "Exact Place Name", "category": "activity|food|sightseeing", "why_locked": "One sentence why it's non-negotiable", "half_day": false}]

JSON array only. First char [, last char ].` },
      ],
    }))
    const lockText = (lockRes.choices[0].message.content || '[]').replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    const lockMatch = lockText.match(/\[[\s\S]*\]/)
    lockedItems = JSON.parse(lockMatch ? lockMatch[0] : lockText)
    console.log(`[Generate] Step 0 done — ${lockedItems.length} items locked: ${lockedItems.map(i => i.name).join(', ')}`)
  } catch (e) {
    console.warn(`[Generate] Step 0 failed (non-fatal): ${e}`)
  }

  const lockedContext = lockedItems.length > 0
    ? `\nLOCKED MUST-HAVES (NON-NEGOTIABLE — build the plan AROUND these):\n${lockedItems.map(i => `- ${i.name} (${i.category}) — ${i.why_locked}${i.half_day ? ' [half-day]' : ''}`).join('\n')}`
    : ''

  // ─── STEP 1: Generate trip outline ────────────────────────────
  console.log(`[Generate] Step 1: Outline for ${numDays}-day ${params.destination} trip`)

  // Extract place names from planning notes for context
  let placeHints = ''
  if (params.planningNotes) {
    const nameMatches = params.planningNotes.match(/^\s*-\s+([^({\n]+)/gm)
    if (nameMatches?.length) {
      placeHints = `\nVerified places from our data: ${nameMatches.map(m => m.replace(/^\s*-\s+/, '').trim()).slice(0, 20).join(', ')}`
    }
  }

  const vibeStr = params.vibes.join(', ')
  const outlinePrompt = `You are planning the perfect ${numDays}-day ${params.destination}, ${params.country} trip for a traveler who wants: ${vibeStr}.
${lockedContext}

ARRIVAL & DEPARTURE AWARENESS:
- Day 1 is arrival day. If flying in, first activity should be late morning/afternoon (account for airport, immigration, hotel check-in — minimum 2h buffer).
- Day ${numDays} is departure day. Last activity must end by early afternoon (account for hotel checkout, airport transfer — minimum 2.5h before flight).
- Day 1 = lighter/settle-in day. Day ${numDays} = wrap-up day. Heavy activities go in the middle days.

PLANNING RULES:
- Budget: ${budgetLine} | Travelers: ${params.travelers}${occasionNote}
- Group geographically proximate places on the same day — minimize cross-city commuting
- Alternate intensity: heavy activity day → lighter/food-focused day → heavy → lighter
- Every day MUST have at minimum: 1 lunch + 1 dinner spot (specific restaurant names)
- Assign each LOCKED must-have to a specific day with enough time allocated${urlPlaces}${placeHints}

HOTEL:
- Pick ONE base hotel in the ${vibeStr}-optimal neighborhood for the full trip
- Adventure vibes → eco-lodges near trails. City vibes → central boutique. Beach → beachfront.

Return a JSON object:
{
  "hotel": { "name": "Specific Hotel Name", "detail": "why it fits ${vibeStr}", "price": "$X/night", "neighborhood": "Area Name" },
  "days": [EXACTLY ${numDays} objects, each with:
    { "dayNum": N, "date": "${dayDates[0]}", "theme": "3-5 word theme", "neighborhood_focus": "Main area for this day",
      "places": ["3-5 SPECIFIC real place names — mix activities + restaurants"],
      "food": { "lunch": "Restaurant Name", "dinner": "Restaurant Name" },
      "locked_today": ["names of any LOCKED items assigned to this day"],
      "dayInsight": "1-2 sentence opinionated Drift comment with a local tip" }
  ],
  "tripBrief": "2-3 sentence strategy explaining why THIS mix for THESE vibes"
}

CRITICAL: Every LOCKED item MUST appear in exactly one day's "places" array. Do NOT skip them.
JSON only. First char {, last char }.`

  const outlineRes = await withRetry(() => llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: 'You are Drift\'s trip planner. Output ONLY valid JSON. No markdown.' },
      { role: 'user', content: outlinePrompt },
    ],
  }))

  const outlineRaw = outlineRes.choices[0].message.content || '{}'
  const outlineCleaned = outlineRaw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
  const outlineMatch = outlineCleaned.match(/\{[\s\S]*\}/)

  let outline: { hotel: { name: string; detail: string; price: string }; days: DayOutline[]; tripBrief: string }
  try {
    outline = JSON.parse(outlineMatch ? outlineMatch[0] : outlineCleaned)
  } catch {
    console.error('[Generate] Outline parse failed, falling back to single-call')
    // Fallback: generate everything in one call (old behavior)
    return generateItinerarySingleCall(params, numDays, dayDates)
  }

  const outlineElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Generate] Step 1 done in ${outlineElapsed}s — ${outline.days?.length || 0} days outlined, hotel: ${outline.hotel?.name}`)

  // ─── STEP 2: Generate each day's items IN PARALLEL ────────────
  console.log(`[Generate] Step 2: Generating ${outline.days.length} days in parallel`)

  // Generate days in batches of 3 to stay within Gemini rate limits
  const dayResults: GeneratedItem[][] = []
  const BATCH = 3
  for (let i = 0; i < outline.days.length; i += BATCH) {
    const batch = outline.days.slice(i, i + BATCH)
    const batchResults = await Promise.all(
      batch.map((day) => generateDayItems(llm, model, params, day, outline.hotel)
        .catch(e => {
          console.warn(`[Generate] Day ${day.dayNum} failed: ${e}`)
          return [] as GeneratedItem[]
        })
      )
    )
    dayResults.push(...batchResults)
  }

  // Retry any empty days (rate limit may have caused failures)
  for (let i = 0; i < dayResults.length; i++) {
    if (!dayResults[i] || dayResults[i].length === 0) {
      console.warn(`[Generate] Day ${i + 1} is empty, retrying...`)
      try {
        await throttleLlm()
        dayResults[i] = await generateDayItems(llm, model, params, outline.days[i], outline.hotel)
      } catch {
        // Generate a minimal fallback day
        dayResults[i] = [{
          category: 'activity', name: `Explore ${params.destination}`, detail: 'Free day to explore at your own pace',
          description: '', price: 'Free', image_url: '', time: '10:00', position: 0,
          metadata: { reason: 'A relaxed day to discover hidden gems on your own', whyFactors: ['Flexible schedule', 'Local exploration'] },
        }]
      }
    }
  }

  // ─── STEP 3: Merge into final item array ──────────────────────
  const allItems: GeneratedItem[] = []

  // Hotel check-in (position 0)
  allItems.push({
    category: 'hotel',
    name: outline.hotel.name,
    detail: outline.hotel.detail || '',
    description: '',
    price: outline.hotel.price || '',
    image_url: '',
    time: '14:00',
    position: 0,
    metadata: {
      reason: `Your base in ${params.destination}`,
      whyFactors: [`Matches your ${params.vibes[0] || 'travel'} vibe`, `${params.budget} budget range`],
    },
  })

  // Day items
  for (let i = 0; i < dayResults.length; i++) {
    const dayItems = dayResults[i]
    const day = outline.days[i]

    // Day separator
    allItems.push({
      category: 'day',
      name: `Day ${day.dayNum} — ${day.theme} · ${day.date}`,
      detail: day.theme,
      description: '',
      price: '',
      image_url: '',
      time: '',
      position: allItems.length,
      metadata: {
        day_insight: day.dayInsight,
        ...(i === 0 && outline.tripBrief ? { trip_brief: outline.tripBrief } : {}),
      },
    })

    // Day's items
    for (const item of dayItems) {
      allItems.push({ ...item, position: allItems.length })
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`[Generate] All steps done in ${totalElapsed}s — ${allItems.length} items total`)

  return allItems
}

/** Generate detailed items for a single day */
async function generateDayItems(
  llm: OpenAI,
  model: string,
  params: { destination: string; country: string; vibes: string[]; budget: string; budgetAmount?: number; planningNotes?: string },
  day: DayOutline,
  hotel: { name: string },
): Promise<GeneratedItem[]> {
  const lockedToday = (day as DayOutline & { locked_today?: string[] }).locked_today || []
  const lockedNote = lockedToday.length > 0 ? `\nLOCKED items today (MUST appear, do not drop): ${lockedToday.join(', ')}` : ''
  const foodPlan = (day as DayOutline & { food?: { lunch?: string; dinner?: string } }).food
  const foodNote = foodPlan ? `\nFood plan: Lunch at ${foodPlan.lunch || 'TBD'}, Dinner at ${foodPlan.dinner || 'TBD'}` : ''

  const prompt = `Generate detailed itinerary items for Day ${day.dayNum} (${day.date}) in ${params.destination}, ${params.country}.
Theme: ${day.theme}
Places to include: ${day.places.join(', ')}
Vibes: ${params.vibes.join(', ')} | Budget: ${params.budget}
Based at: ${hotel.name} (do NOT add hotel as an item — it's already shown on Day 1)${lockedNote}${foodNote}

FOOD RULES — MANDATORY:
- Lunch: required. Must be a specific named restaurant near the day's activities.
- Dinner: required. Can be a special spot worth traveling to.
- Food items get dedicated time slots — never overlap with activity times.

TRANSIT RULES — MANDATORY:
- Between activity clusters in different areas, add a transit note in metadata.transport_to_next:
  { "mode": "walk|metro|cab|tuk-tuk", "duration": "15 min", "cost": "$3", "tip": "Use Grab app" }
- Walking if ≤15 min. Metro/MRT if same zone. Cab/Grab if cross-district.

TIMING RULES:
- Morning: 09:00-12:00. Lunch: 12:00-13:30. Afternoon: 14:00-17:00. Dinner: 19:00-21:00.
- Each activity needs realistic duration — museums 1.5-2h, temples 45min, markets 1h, theme parks 4-6h.
- Day 1 (arrival): first activity after 11:00. Last day (departure): nothing after 14:00.

Return a JSON array of 5-8 items (activities + food). Each item:
{
  "category": "activity|food",
  "name": "Exact Place Name (Google Maps searchable)",
  "detail": "Brief tagline (under 60 chars)",
  "description": "2 sentences: what makes it special + a local tip",
  "price": "$XX",
  "time": "HH:MM",
  "metadata": {
    "reason": "Why Drift picked this — opinionated, connect to ${params.vibes.join('/')} vibes",
    "whyFactors": ["Specific reason 1", "Connects to ${params.vibes[0] || 'your'} vibe", "Near today's other spots"],
    "alts": [{"name": "Alt Name", "detail": "Why it's a good swap", "price": "$XX"}],
    "transport_to_next": { "mode": "walk|metro|cab", "duration": "X min", "cost": "$X" }
  }
}

NEVER use filler: "relax at hotel", "free time", "explore on your own". Every slot = a specific named place.
Return ONLY the JSON array. First char [, last char ].`

  // No throttle here — parallel calls are rate-safe on Gemini Tier 1 (2000 RPM)
  const res = await withRetry(() => llm.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: 'You are Drift\'s itinerary engine. Output ONLY valid JSON arrays. No markdown.' },
      { role: 'user', content: prompt },
    ],
  }))

  const text = res.choices[0].message.content || '[]'
  const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned) as GeneratedItem[]
  } catch {
    const repaired = repairTruncatedJson(cleaned)
    return JSON.parse(repaired) as GeneratedItem[]
  }
}

/** Fallback: single-call generation (if outline parsing fails) */
async function generateItinerarySingleCall(
  params: Parameters<typeof generateItinerary>[0],
  numDays: number,
  dayDates: string[],
): Promise<GeneratedItem[]> {
  const llm = getLlm()
  const model = getModel()

  const budgetLine = params.budgetAmount
    ? `Budget: $${params.budgetAmount} total per person — level: ${params.budget}`
    : `Budget: ${params.budget}`

  const userContent = `Generate a complete day-by-day itinerary for ${numDays} days in ${params.destination}, ${params.country}.
Vibes: ${params.vibes.join(', ')} | ${budgetLine} | ${params.travelers} travelers
Flying from: ${params.originCity}
${params.planningNotes || ''}

Generate EXACTLY ${numDays} days: ${dayDates.join(', ')}.
Start with hotel, then day-by-day activities/food. Each day: 2-4 activities + 1-2 meals.
Every item needs metadata.reason and metadata.whyFactors.
Day separators: "Day N — Theme · Date" with metadata.day_insight. Day 1 also needs metadata.trip_brief.
Return ONLY the JSON array.`

  await throttleLlm()
  const response = await withRetry(() => llm.chat.completions.create({
    model,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }))

  const text = response.choices[0].message.content || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned) as GeneratedItem[]
  } catch {
    const repaired = repairTruncatedJson(cleaned)
    return JSON.parse(repaired) as GeneratedItem[]
  }
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
