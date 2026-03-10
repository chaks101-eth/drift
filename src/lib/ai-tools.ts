// ─── Drift AI Tools ───────────────────────────────────────────
// Gemini-optimized tool definitions (descriptive names, enums, detailed descriptions).
// Server-side execution — AI calls tool, server runs it, feeds result back.

import type OpenAI from 'openai'
import { searchCatalog } from './ai-context'
import { createClient } from '@supabase/supabase-js'
import { upsizeGoogleImage } from './images'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Tool Definitions (OpenAI function calling format) ───────

export const TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description: 'Search the destination catalog for hotels, activities, or restaurants. Use when user asks for alternatives, options, or "what else is there?" Returns real data with ratings, prices, and reviews.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['hotel', 'activity', 'food'],
            description: 'Type of item to search for',
          },
          vibe: {
            type: 'string',
            description: 'Optional vibe filter (e.g., "romantic", "adventure", "foodie")',
          },
          price_level: {
            type: 'string',
            enum: ['budget', 'mid', 'luxury'],
            description: 'Optional price tier filter',
          },
          query: {
            type: 'string',
            description: 'Optional text search (e.g., "rooftop", "sushi", "spa")',
          },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'swap_item',
      description: 'Replace an item on the user\'s trip board with a different one from the catalog. Use when user explicitly agrees to a swap (e.g., "yes, swap it", "use that one instead"). Requires the current item ID and new item details.',
      parameters: {
        type: 'object',
        properties: {
          item_id: {
            type: 'string',
            description: 'ID of the current itinerary item to replace',
          },
          new_name: {
            type: 'string',
            description: 'Name of the new item (must be from catalog)',
          },
          new_detail: {
            type: 'string',
            description: 'Brief detail/tagline for the new item',
          },
          new_price: {
            type: 'string',
            description: 'Price of the new item (e.g., "$85/night")',
          },
          reason: {
            type: 'string',
            description: 'Why this swap is better for the user',
          },
        },
        required: ['item_id', 'new_name', 'new_price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_budget',
      description: 'Analyze the trip budget and suggest swaps to reach a target. Use when user says "make this cheaper", "upgrade to luxury", or asks about total cost. Returns current breakdown and swap suggestions.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['cheaper', 'luxury', 'analyze'],
            description: '"cheaper" finds savings, "luxury" upgrades, "analyze" just shows breakdown',
          },
          target_savings: {
            type: 'number',
            description: 'Optional target amount to save in USD (for "cheaper" direction)',
          },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trip_insights',
      description: 'Analyze the full itinerary and provide smart observations. Use when user asks "how\'s my trip?", "any tips?", "what am I missing?" Returns pacing analysis, clustering insights, and suggestions.',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['overall', 'pacing', 'budget', 'vibes'],
            description: 'What aspect to focus the analysis on',
          },
        },
        required: ['focus'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_flights',
      description: 'Search for flights. Use when user asks about flight options, cheaper flights, or different times.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: 'Departure city (e.g., "Delhi")',
          },
          destination: {
            type: 'string',
            description: 'Arrival city (e.g., "Bangkok")',
          },
          date: {
            type: 'string',
            description: 'Flight date in YYYY-MM-DD format',
          },
        },
        required: ['origin', 'destination', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_item',
      description: 'Add a new item to the user\'s trip itinerary. Use when user says "add X to my trip" or "I also want to visit X." The item must exist in the catalog.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the item to add (must be from catalog)',
          },
          category: {
            type: 'string',
            enum: ['hotel', 'activity', 'food'],
            description: 'Category of the item',
          },
          day: {
            type: 'number',
            description: 'Which day to add it to (optional, AI picks best if omitted)',
          },
          time: {
            type: 'string',
            description: 'Preferred time slot (e.g., "14:00")',
          },
        },
        required: ['name', 'category'],
      },
    },
  },
]

// ─── Tool Result Types ───────────────────────────────────────

export interface ToolResult {
  success: boolean
  data: unknown
  // Actions the frontend should take
  actions?: ChatAction[]
}

export interface ChatAction {
  type: 'show_alternatives' | 'swap_item' | 'update_budget' | 'show_insight' | 'add_item'
  payload: Record<string, unknown>
}

// ─── Tool Execution ──────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: {
    tripId: string
    destination: string
    items: Array<{ id: string; category: string; name: string; price: string; position: number; status: string; metadata: Record<string, unknown> | null }>
  },
): Promise<ToolResult> {
  switch (toolName) {
    case 'search_catalog':
      return executeSearchCatalog(args, context)
    case 'swap_item':
      return executeSwapItem(args, context)
    case 'adjust_budget':
      return executeAdjustBudget(args, context)
    case 'get_trip_insights':
      return executeGetTripInsights(args, context)
    case 'search_flights':
      return executeSearchFlights(args)
    case 'add_item':
      return executeAddItem(args, context)
    default:
      return { success: false, data: { error: `Unknown tool: ${toolName}` } }
  }
}

// ─── search_catalog ──────────────────────────────────────────

async function executeSearchCatalog(
  args: Record<string, unknown>,
  context: { destination: string },
): Promise<ToolResult> {
  const category = args.category as 'hotel' | 'activity' | 'food'
  const results = await searchCatalog(context.destination, category, {
    vibe: args.vibe as string | undefined,
    priceLevel: args.price_level as string | undefined,
    query: args.query as string | undefined,
  })

  const top = results.slice(0, 5)

  return {
    success: true,
    data: {
      count: results.length,
      items: top.map(r => ({
        name: r.name,
        detail: r.detail,
        price: r.price,
        priceLevel: r.priceLevel,
        rating: r.rating,
        location: r.location,
        honestTake: r.honestTake,
        bestFor: r.bestFor,
      })),
    },
    actions: [{
      type: 'show_alternatives',
      payload: {
        category,
        alternatives: top.map(r => ({
          name: r.name,
          detail: r.detail,
          price: r.price,
          image_url: r.imageUrl ? upsizeGoogleImage(r.imageUrl) : null,
        })),
      },
    }],
  }
}

// ─── swap_item ───────────────────────────────────────────────

async function executeSwapItem(
  args: Record<string, unknown>,
  context: { tripId: string; destination: string; items: Array<{ id: string; category: string; name: string }> },
): Promise<ToolResult> {
  const itemId = args.item_id as string
  const newName = args.new_name as string
  const newDetail = args.new_detail as string || ''
  const newPrice = args.new_price as string

  // Find the current item
  const currentItem = context.items.find(i => i.id === itemId)
  if (!currentItem) {
    return { success: false, data: { error: 'Item not found in itinerary' } }
  }

  // Look up the new item in catalog for image
  const category = currentItem.category as 'hotel' | 'activity' | 'food'
  const catalogResults = await searchCatalog(context.destination, category, { query: newName })
  const catalogMatch = catalogResults.find(r => r.name.toLowerCase().includes(newName.toLowerCase().split(' ')[0]))

  // Update in database
  const db = getDb()
  const { error } = await db
    .from('itinerary_items')
    .update({
      name: newName,
      detail: newDetail,
      price: newPrice,
      description: catalogMatch?.honestTake || args.reason as string || '',
      image_url: catalogMatch?.imageUrl ? upsizeGoogleImage(catalogMatch.imageUrl) : undefined,
    })
    .eq('id', itemId)
    .eq('trip_id', context.tripId)

  if (error) {
    return { success: false, data: { error: `Swap failed: ${error.message}` } }
  }

  return {
    success: true,
    data: {
      swapped: { from: currentItem.name, to: newName, newPrice },
    },
    actions: [{
      type: 'swap_item',
      payload: {
        itemId,
        newData: {
          name: newName,
          detail: newDetail,
          price: newPrice,
          image_url: catalogMatch?.imageUrl ? upsizeGoogleImage(catalogMatch.imageUrl) : null,
        },
      },
    }],
  }
}

// ─── adjust_budget ───────────────────────────────────────────

async function executeAdjustBudget(
  args: Record<string, unknown>,
  context: { destination: string; items: Array<{ id: string; category: string; name: string; price: string; status: string }> },
): Promise<ToolResult> {
  const direction = args.direction as string

  // Calculate current breakdown
  const breakdown: Record<string, { count: number; total: number; items: string[] }> = {}
  let grandTotal = 0

  for (const item of context.items) {
    if (item.category === 'day' || item.category === 'transfer') continue
    const price = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''))
    if (!breakdown[item.category]) breakdown[item.category] = { count: 0, total: 0, items: [] }
    breakdown[item.category].count++
    breakdown[item.category].total += price
    breakdown[item.category].items.push(`${item.name}: $${price}`)
    grandTotal += price
  }

  if (direction === 'analyze') {
    return {
      success: true,
      data: { breakdown, grandTotal },
      actions: [{ type: 'update_budget', payload: { breakdown, total: grandTotal } }],
    }
  }

  // Find swap suggestions
  const suggestions: Array<{ itemId: string; current: string; currentPrice: number; suggested: string; suggestedPrice: number; savings: number }> = []

  const targetLevel = direction === 'cheaper' ? 'budget' : 'luxury'
  const swappableCategories = ['hotel', 'food'] as const

  for (const cat of swappableCategories) {
    const catItems = context.items.filter(i => i.category === cat && i.status !== 'picked')
    if (!catItems.length) continue

    const alts = await searchCatalog(context.destination, cat, { priceLevel: targetLevel })
    if (!alts.length) continue

    for (const item of catItems) {
      const currentPrice = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''))
      const bestAlt = direction === 'cheaper'
        ? alts.reduce((best, a) => {
            const p = parseFloat((a.price || '0').replace(/[^0-9.]/g, ''))
            return p < parseFloat((best.price || '0').replace(/[^0-9.]/g, '')) ? a : best
          })
        : alts.reduce((best, a) => {
            const p = parseFloat((a.price || '0').replace(/[^0-9.]/g, ''))
            return p > parseFloat((best.price || '0').replace(/[^0-9.]/g, '')) ? a : best
          })

      const altPrice = parseFloat((bestAlt.price || '0').replace(/[^0-9.]/g, ''))
      const savings = currentPrice - altPrice

      if ((direction === 'cheaper' && savings > 0) || (direction === 'luxury' && savings < 0)) {
        suggestions.push({
          itemId: item.id,
          current: item.name,
          currentPrice,
          suggested: bestAlt.name,
          suggestedPrice: altPrice,
          savings: Math.abs(savings),
        })
      }
    }
  }

  const totalSavings = suggestions.reduce((a, s) => a + (direction === 'cheaper' ? s.savings : -s.savings), 0)

  return {
    success: true,
    data: {
      direction,
      currentTotal: grandTotal,
      projectedTotal: grandTotal - totalSavings,
      suggestions: suggestions.slice(0, 5),
      breakdown,
    },
    actions: [{ type: 'update_budget', payload: { breakdown, total: grandTotal, suggestions } }],
  }
}

// ─── get_trip_insights ───────────────────────────────────────

async function executeGetTripInsights(
  args: Record<string, unknown>,
  context: { items: Array<{ id: string; category: string; name: string; price: string; position: number; metadata: Record<string, unknown> | null }> },
): Promise<ToolResult> {
  const focus = args.focus as string
  const real = context.items.filter(i => i.category !== 'day' && i.category !== 'transfer')

  // Pacing analysis
  const days: Record<number, number> = {}
  let currentDay = 0
  for (const item of context.items) {
    if (item.category === 'day') { currentDay++; continue }
    if (item.category === 'transfer') continue
    days[currentDay] = (days[currentDay] || 0) + 1
  }

  const packedDays = Object.entries(days).filter(([, count]) => count > 5).map(([day]) => parseInt(day))
  const lightDays = Object.entries(days).filter(([, count]) => count < 3).map(([day]) => parseInt(day))

  // Budget analysis
  let totalSpend = 0
  const byCategory: Record<string, number> = {}
  for (const item of real) {
    const price = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''))
    totalSpend += price
    byCategory[item.category] = (byCategory[item.category] || 0) + price
  }

  // Vibe coverage
  const vibesPresent = new Set<string>()
  for (const item of real) {
    const meta = item.metadata || {}
    const itemVibes = (meta.vibes || meta.features || []) as string[]
    itemVibes.forEach(v => vibesPresent.add(v))
  }

  const insights: string[] = []

  if (focus === 'overall' || focus === 'pacing') {
    if (packedDays.length) insights.push(`Days ${packedDays.join(', ')} are packed (${days[packedDays[0]]}+ items). Consider moving activities to lighter days.`)
    if (lightDays.length) insights.push(`Days ${lightDays.join(', ')} have room for more. Good for spontaneous exploration or rest.`)
    if (!packedDays.length && !lightDays.length) insights.push('Pacing looks balanced across all days.')
  }

  if (focus === 'overall' || focus === 'budget') {
    insights.push(`Total estimated spend: $${Math.round(totalSpend)}`)
    const biggest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
    if (biggest) insights.push(`Biggest spend: ${biggest[0]} ($${Math.round(biggest[1])})`)
  }

  return {
    success: true,
    data: {
      totalItems: real.length,
      totalSpend: Math.round(totalSpend),
      byCategory,
      packedDays,
      lightDays,
      vibesPresent: Array.from(vibesPresent),
      insights,
    },
    actions: [{ type: 'show_insight', payload: { insights } }],
  }
}

// ─── search_flights ──────────────────────────────────────────

async function executeSearchFlights(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { searchFlights, cityToIATA } = await import('./amadeus')
    const origin = args.origin as string
    const destination = args.destination as string
    const date = args.date as string

    if (!cityToIATA(origin) || !cityToIATA(destination)) {
      return { success: false, data: { error: `Can't search flights: unknown airport for ${!cityToIATA(origin) ? origin : destination}` } }
    }

    const flights = await searchFlights({
      origin,
      destination,
      departureDate: date,
      adults: 1,
      maxResults: 5,
    })

    return {
      success: true,
      data: {
        count: flights.length,
        flights: flights.slice(0, 5).map(f => ({
          airline: f.airlineName,
          flightNumber: f.flightNumber,
          departure: f.departure,
          arrival: f.arrival,
          duration: f.duration,
          stops: f.stops,
          price: f.price,
          bookingUrl: f.bookingUrl,
        })),
      },
    }
  } catch (e) {
    return { success: false, data: { error: `Flight search failed: ${e instanceof Error ? e.message : String(e)}` } }
  }
}

// ─── add_item ────────────────────────────────────────────────

async function executeAddItem(
  args: Record<string, unknown>,
  context: { tripId: string; destination: string; items: Array<{ position: number }> },
): Promise<ToolResult> {
  const name = args.name as string
  const category = args.category as 'hotel' | 'activity' | 'food'

  // Look up in catalog
  const catalogResults = await searchCatalog(context.destination, category, { query: name })
  const match = catalogResults.find(r =>
    r.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]) ||
    name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
  )

  if (!match) {
    return { success: false, data: { error: `"${name}" not found in the catalog for this destination.` } }
  }

  // Insert at end
  const maxPos = Math.max(...context.items.map(i => i.position), 0)
  const db = getDb()

  const newItem = {
    trip_id: context.tripId,
    category: category === 'food' ? 'food' as const : category as 'hotel' | 'activity',
    name: match.name,
    detail: match.detail,
    description: match.honestTake,
    price: match.price,
    image_url: match.imageUrl ? upsizeGoogleImage(match.imageUrl) : null,
    time: (args.time as string) || null,
    position: maxPos + 1,
    status: 'none' as const,
    metadata: {
      reason: `Added via chat — matches your ${match.vibes[0] || 'travel'} vibe`,
      bestFor: match.bestFor,
      source: 'catalog+chat',
    },
  }

  const { data: inserted, error } = await db
    .from('itinerary_items')
    .insert(newItem)
    .select()
    .single()

  if (error) {
    return { success: false, data: { error: `Failed to add item: ${error.message}` } }
  }

  return {
    success: true,
    data: { added: match.name, price: match.price, position: maxPos + 1 },
    actions: [{ type: 'add_item', payload: { item: inserted } }],
  }
}
