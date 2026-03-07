import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import type { ItineraryItem } from './database.types'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You are Drift, an AI travel assistant that creates delightful trip experiences. Your motto is "moj kara do" — maximize joy and delight.

Your personality:
- Warm, knowledgeable, slightly playful
- You know destinations deeply — local secrets, best times, hidden gems
- You give opinionated recommendations, not generic lists
- You care about the vibe and flow of a trip, not just logistics

When answering about places:
- Use the CATALOG DATA provided below — it has real ratings, reviews, hours, tips
- Reference what real reviewers say, not generic descriptions
- Share practical tips (best time, what to wear, what to skip)
- Be honest about trade-offs and who a place is best for
- Suggest "pairs with" combinations when relevant

When suggesting alternatives:
- Always explain WHY this alternative is better for the user's stated preference
- Include price comparison
- Mention trade-offs honestly
- Pull alternatives from the catalog data

Output structured JSON when using tools. Be concise in chat responses.`

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'suggest_alternatives',
      description: 'Suggest alternative options for a specific itinerary item (different hotel, flight, activity).',
      parameters: {
        type: 'object',
        properties: {
          item_category: { type: 'string', description: 'Category: flight, hotel, activity, food' },
          current_item: { type: 'string', description: 'Current item name and details' },
          preference: { type: 'string', description: 'What the user wants: cheaper, luxury, different style, etc.' },
          destination: { type: 'string', description: 'Trip destination' },
        },
        required: ['item_category', 'current_item', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_itinerary',
      description: 'Add, remove, or reorder items in the itinerary.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'swap'], description: 'What to do' },
          item_id: { type: 'string', description: 'ID of item to modify (for remove/swap)' },
          new_item: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              name: { type: 'string' },
              detail: { type: 'string' },
              price: { type: 'string' },
              image_url: { type: 'string' },
              time: { type: 'string' },
            },
            description: 'New item data (for add/swap)',
          },
          position: { type: 'number', description: 'Position to insert at (for add)' },
        },
        required: ['action'],
      },
    },
  },
]

// ─── Catalog context loader ──────────────────────────────────

async function loadCatalogContext(destination: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return ''

  const db = createClient(url, key)

  // Find the destination in catalog
  const { data: dest } = await db
    .from('catalog_destinations')
    .select('id, city, country')
    .ilike('city', `%${destination.split(',')[0].trim()}%`)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!dest) return ''

  // Load catalog items
  const [{ data: hotels }, { data: restaurants }, { data: activities }] = await Promise.all([
    db.from('catalog_hotels').select('name, detail, price_per_night, price_level, rating, amenities, location, metadata').eq('destination_id', dest.id),
    db.from('catalog_restaurants').select('name, detail, cuisine, avg_cost, price_level, must_try, location, metadata').eq('destination_id', dest.id),
    db.from('catalog_activities').select('name, detail, price, duration, best_time, location, metadata').eq('destination_id', dest.id),
  ])

  const parts: string[] = [`\n\nCATALOG DATA FOR ${dest.city.toUpperCase()}, ${dest.country.toUpperCase()}:`]

  if (hotels?.length) {
    parts.push('\nHOTELS:')
    for (const h of hotels) {
      const meta = h.metadata as Record<string, unknown> || {}
      const tips = (meta.practical_tips as string[])?.join('; ') || ''
      const bestFor = (meta.best_for as string[])?.join(', ') || ''
      const honestTake = (meta.honest_take as string) || ''
      parts.push(`- ${h.name} (${h.price_per_night}/night, ${h.price_level}, ${h.rating}★) — ${h.detail}`)
      if (honestTake) parts.push(`  Honest take: ${honestTake}`)
      if (tips) parts.push(`  Tips: ${tips}`)
      if (bestFor) parts.push(`  Best for: ${bestFor}`)
      if (h.amenities?.length) parts.push(`  Amenities: ${(h.amenities as string[]).join(', ')}`)
    }
  }

  if (restaurants?.length) {
    parts.push('\nRESTAURANTS:')
    for (const r of restaurants) {
      const meta = r.metadata as Record<string, unknown> || {}
      const tips = (meta.practical_tips as string[])?.join('; ') || ''
      const bestFor = (meta.best_for as string[])?.join(', ') || ''
      const honestTake = (meta.honest_take as string) || ''
      const dietary = (meta.dietary as string[])?.join(', ') || ''
      parts.push(`- ${r.name} (${r.cuisine}, ${r.avg_cost}, ${r.price_level}) — ${r.detail}`)
      if (honestTake) parts.push(`  Honest take: ${honestTake}`)
      if (r.must_try?.length) parts.push(`  Must-try: ${(r.must_try as string[]).join(', ')}`)
      if (tips) parts.push(`  Tips: ${tips}`)
      if (bestFor) parts.push(`  Best for: ${bestFor}`)
      if (dietary) parts.push(`  Dietary: ${dietary}`)
    }
  }

  if (activities?.length) {
    parts.push('\nACTIVITIES:')
    for (const a of activities) {
      const meta = a.metadata as Record<string, unknown> || {}
      const tips = (meta.practical_tips as string[])?.join('; ') || ''
      const bestFor = (meta.best_for as string[])?.join(', ') || ''
      const honestTake = (meta.honest_take as string) || ''
      parts.push(`- ${a.name} (${a.price}, ${a.duration}, best: ${a.best_time}) — ${a.detail}`)
      if (honestTake) parts.push(`  Honest take: ${honestTake}`)
      if (tips) parts.push(`  Tips: ${tips}`)
      if (bestFor) parts.push(`  Best for: ${bestFor}`)
    }
  }

  return parts.join('\n')
}

// ─── Chat agent ──────────────────────────────────────────────

export async function chatWithAgent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  currentItinerary?: ItineraryItem[],
  contextItem?: ItineraryItem | null,
  tripDestination?: string,
) {
  const contextParts: string[] = []

  if (currentItinerary?.length) {
    contextParts.push(
      `Current itinerary has ${currentItinerary.length} items: ${currentItinerary
        .filter(i => i.category !== 'transfer' && i.category !== 'day')
        .map(i => `${i.name} (${i.category}, ${i.price})`)
        .join(', ')}`
    )
  }

  if (contextItem) {
    const meta = contextItem.metadata as Record<string, unknown> || {}
    const parts = [`User is asking about: ${contextItem.name} (${contextItem.category}, ${contextItem.price}, ${contextItem.detail})`]
    if (contextItem.description) parts.push(`Description: ${contextItem.description}`)
    if (meta.honest_take) parts.push(`Honest take: ${meta.honest_take}`)
    if (meta.practical_tips) parts.push(`Tips: ${(meta.practical_tips as string[]).join('; ')}`)
    if (meta.best_for) parts.push(`Best for: ${(meta.best_for as string[]).join(', ')}`)
    if (meta.pairs_with) parts.push(`Pairs with: ${(meta.pairs_with as string[]).join(', ')}`)
    if (meta.review_synthesis) {
      const rs = meta.review_synthesis as Record<string, string[]>
      if (rs.loved?.length) parts.push(`People love: ${rs.loved.join(', ')}`)
      if (rs.complaints?.length) parts.push(`Common complaints: ${rs.complaints.join(', ')}`)
    }
    if (meta.info) {
      const info = meta.info as { l: string; v: string }[]
      parts.push(`Details: ${info.map(i => `${i.l}: ${i.v}`).join(', ')}`)
    }
    contextParts.push(parts.join('\n'))
  }

  // Load catalog data for the destination
  let catalogContext = ''
  if (tripDestination) {
    try {
      catalogContext = await loadCatalogContext(tripDestination)
    } catch {
      // Catalog load is best-effort
    }
  }

  const systemWithContext = [
    SYSTEM_PROMPT,
    catalogContext,
    contextParts.length ? `\nCurrent context:\n${contextParts.join('\n')}` : '',
  ].filter(Boolean).join('\n')

  const useTools = contextItem ? { tools } : {}

  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemWithContext },
      ...messages,
    ],
    ...useTools,
  })

  const choice = response.choices[0]
  return {
    text: choice.message.content || '',
    toolCalls: choice.message.tool_calls || [],
    finishReason: choice.finish_reason,
  }
}

export async function generateItinerary(params: {
  destination: string
  country: string
  vibes: string[]
  startDate: string
  endDate: string
  travelers: number
  budget: string
  originCity: string
}) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate a complete day-by-day itinerary for a trip to ${params.destination}, ${params.country}.

Vibes: ${params.vibes.join(', ')}
Dates: ${params.startDate} to ${params.endDate}
Travelers: ${params.travelers}
Budget: ${params.budget}
Flying from: ${params.originCity}

Return a JSON array of itinerary items. Each item should have:
- category: "flight" | "hotel" | "activity" | "food" | "transfer" | "day"
- name: string
- detail: string (airline/rating/description)
- description: string (longer description)
- price: string (e.g. "$420")
- time: string (e.g. "06:30")
- position: number (order in itinerary)
- metadata: object with:
  - reason: string — one-line opinionated tagline for why Drift picked this (e.g. "Best sunset views under $100/night")
  - whyFactors: string[] — 2-4 bullet reasons (e.g. ["Matches your beach + culture vibes", "15 min from airport", "Rated 4.8 by 2K travelers"])
  - info: [{l:"Duration", v:"10h"}]
  - features: ["Pool","Spa"]
  - alts: [{name:"...",detail:"...",price:"..."}]

IMPORTANT: Every non-day, non-transfer item MUST have metadata.reason and metadata.whyFactors.
Do NOT include image_url — images are handled separately.

Start with the outbound flight, then hotel check-in, then day-by-day activities/food, and end with return flight.
Use "day" category items as day separators (e.g. {category:"day", name:"Day 1", detail:"Friday, April 10"}).
Use "transfer" category for travel between locations (e.g. {category:"transfer", name:"Drive to Ubud", detail:"Scenic drive through rice paddies", metadata:{travel:"1h 30m"}}).

Include 2-3 alternatives in metadata.alts for flights, hotels, and major activities.

Return ONLY the JSON array, no markdown.`,
      },
    ],
  })

  const text = response.choices[0].message.content || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as Array<{
    category: string
    name: string
    detail: string
    description: string
    price: string
    image_url: string
    time: string
    position: number
    metadata: Record<string, unknown>
  }>
}

export async function suggestDestinations(vibes: string[], budget: string, origin: string) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Suggest 4 destinations that match these vibes: ${vibes.join(', ')}.
Budget level: ${budget || 'mid'}
Flying from: ${origin || 'Delhi'}

Return a JSON array. Each destination:
{
  "name": "Bali",
  "country": "Indonesia",
  "match": 97,
  "price": "$2,200",
  "tags": ["Temples", "Rice Terraces", "Surf"],
  "description": "Brief 1-2 sentence pitch",
  "best_for": "Which vibes this matches best"
}

Do NOT include image_url — images are handled separately.
Be opinionated — rank by match percentage.
Return ONLY the JSON array.`,
      },
    ],
  })

  const text = response.choices[0].message.content || '[]'
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}
