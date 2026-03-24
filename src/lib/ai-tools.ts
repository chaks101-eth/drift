// ─── Drift AI Tools ───────────────────────────────────────────
// Gemini-optimized tool definitions (descriptive names, enums, detailed descriptions).
// Server-side execution — AI calls tool, server runs it, feeds result back.

import type OpenAI from 'openai'
import { searchCatalog } from './ai-context'
import { createClient } from '@supabase/supabase-js'
import { upsizeGoogleImage } from './images'
import { analyzeTrip, type TripAnalysis } from './ai-intelligence'
import type { ItineraryItem } from './database.types'

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
  {
    type: 'function',
    function: {
      name: 'validate_trip',
      description: 'Run a smart analysis of the trip using real GPS, timing, and pacing data. Use when user asks "is my trip good?", "any issues?", "optimize my trip", or proactively after making changes. Returns specific spatial/temporal issues with fix suggestions.',
      parameters: {
        type: 'object',
        properties: {
          fix_type: {
            type: 'string',
            enum: ['analyze', 'proximity', 'timing', 'pacing'],
            description: '"analyze" for full trip scan, or focus on a specific area',
          },
        },
        required: ['fix_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_trip',
      description: 'Update trip details like dates, travelers count. Use when user says "change dates to...", "we are now 4 people", "extend trip by 2 days", etc.',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'New start date in YYYY-MM-DD format (optional)',
          },
          end_date: {
            type: 'string',
            description: 'New end date in YYYY-MM-DD format (optional)',
          },
          travelers: {
            type: 'number',
            description: 'New number of travelers (optional)',
          },
        },
        required: [],
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
    vibes?: string[]
    startDate?: string
    items: Array<{ id: string; category: string; name: string; price: string; position: number; status: string; metadata: Record<string, unknown> | null }>
    fullItems?: ItineraryItem[]
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
    case 'validate_trip':
      return executeValidateTrip(args, context)
    case 'update_trip':
      return executeUpdateTrip(args, context)
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
  context: {
    items: Array<{ id: string; category: string; name: string; price: string; position: number; metadata: Record<string, unknown> | null }>
    vibes?: string[]
    startDate?: string
    fullItems?: ItineraryItem[]
  },
): Promise<ToolResult> {
  const focus = args.focus as string
  const real = context.items.filter(i => i.category !== 'day' && i.category !== 'transfer')

  // Budget analysis
  let totalSpend = 0
  const byCategory: Record<string, number> = {}
  for (const item of real) {
    const price = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''))
    totalSpend += price
    byCategory[item.category] = (byCategory[item.category] || 0) + price
  }

  // Run real trip intelligence analysis if we have full items
  let analysis: TripAnalysis | null = null
  if (context.fullItems?.length) {
    analysis = analyzeTrip(context.fullItems, {
      vibes: context.vibes,
      startDate: context.startDate,
    })
  }

  const insights: string[] = []

  if (analysis) {
    // Use real intelligence data
    if (focus === 'overall' || focus === 'pacing') {
      for (const day of analysis.dayBreakdown) {
        if (day.pacing === 'exhausting') {
          insights.push(`${day.theme} is exhausting (${day.itemCount} activities, ~${day.totalHours}h). Move 1-2 items to a lighter day.`)
        } else if (day.pacing === 'light') {
          insights.push(`${day.theme} is light (${day.itemCount} items). Room for a spontaneous activity or rest.`)
        }
        if (day.totalDistance > 20) {
          insights.push(`${day.theme} covers ${day.totalDistance}km — you'll spend a lot of time in transit.`)
        }
      }
    }

    // Surface specific issues
    const errors = analysis.issues.filter(i => i.severity === 'error')
    const warns = analysis.issues.filter(i => i.severity === 'warn')
    const infos = analysis.issues.filter(i => i.severity === 'info')

    if (focus === 'overall') {
      for (const e of errors) insights.push(`⚠ ${e.message}${e.suggestion ? ` ${e.suggestion}` : ''}`)
      for (const w of warns.slice(0, 3)) insights.push(`${w.message}${w.suggestion ? ` ${w.suggestion}` : ''}`)
      for (const i of infos.slice(0, 2)) insights.push(`${i.message}${i.suggestion ? ` ${i.suggestion}` : ''}`)
    } else {
      // Focus-specific issues
      const relevant = analysis.issues.filter(i =>
        focus === 'pacing' ? (i.type === 'pacing' || i.type === 'gap') :
        focus === 'vibes' ? i.type === 'vibe' :
        true
      )
      for (const r of relevant.slice(0, 5)) insights.push(`${r.message}${r.suggestion ? ` ${r.suggestion}` : ''}`)
    }

    insights.push(`Trip quality score: ${analysis.score}/100`)
  } else {
    // Fallback: basic counting (no full items available)
    const days: Record<number, number> = {}
    let currentDay = 0
    for (const item of context.items) {
      if (item.category === 'day') { currentDay++; continue }
      if (item.category === 'transfer') continue
      days[currentDay] = (days[currentDay] || 0) + 1
    }
    const packedDays = Object.entries(days).filter(([, count]) => count > 5).map(([day]) => parseInt(day))
    const lightDays = Object.entries(days).filter(([, count]) => count < 3).map(([day]) => parseInt(day))
    if (packedDays.length) insights.push(`Days ${packedDays.join(', ')} are packed. Consider redistributing.`)
    if (lightDays.length) insights.push(`Days ${lightDays.join(', ')} have room for more.`)
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
      score: analysis?.score ?? null,
      dayBreakdown: analysis?.dayBreakdown.map(d => ({
        day: d.day, theme: d.theme, pacing: d.pacing,
        items: d.itemCount, hours: d.totalHours, distance: d.totalDistance,
      })) ?? null,
      issues: analysis?.issues.length ?? 0,
      insights,
    },
    actions: [{ type: 'show_insight', payload: { insights, score: analysis?.score } }],
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
  context: { tripId: string; destination: string; items: Array<{ position: number; category: string }> },
): Promise<ToolResult> {
  const name = args.name as string
  const category = args.category as 'hotel' | 'activity' | 'food'
  const targetDay = args.day as number | undefined

  // Look up in catalog
  const catalogResults = await searchCatalog(context.destination, category, { query: name })
  const match = catalogResults.find(r =>
    r.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]) ||
    name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
  )

  if (!match) {
    return { success: false, data: { error: `"${name}" not found in the catalog for this destination.` } }
  }

  // Calculate insert position — after the last item of the target day, or at end
  let insertPos: number
  const sorted = [...context.items].sort((a, b) => a.position - b.position)
  const maxPos = Math.max(...context.items.map(i => i.position), 0)

  if (targetDay && targetDay > 0) {
    // Find the last item position in the target day
    let dayCount = 0
    let lastPosInDay = -1
    let nextDayPos = -1
    for (const item of sorted) {
      if (item.category === 'day') {
        dayCount++
        if (dayCount > targetDay && nextDayPos < 0) {
          nextDayPos = item.position
          break
        }
      }
      if (dayCount === targetDay) {
        lastPosInDay = item.position
      }
    }
    if (lastPosInDay >= 0 && nextDayPos > 0) {
      // Insert between last item and next day marker using fractional position
      insertPos = lastPosInDay + 0.5
    } else if (lastPosInDay >= 0) {
      // Last day — insert after last item
      insertPos = maxPos + 1
    } else {
      insertPos = maxPos + 1
    }
  } else {
    insertPos = maxPos + 1
  }

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
    position: insertPos,
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

// ─── validate_trip ──────────────────────────────────────────

function executeValidateTrip(
  args: Record<string, unknown>,
  context: {
    vibes?: string[]
    startDate?: string
    fullItems?: ItineraryItem[]
  },
): ToolResult {
  if (!context.fullItems?.length) {
    return { success: false, data: { error: 'No itinerary items to validate' } }
  }

  const analysis = analyzeTrip(context.fullItems, {
    vibes: context.vibes,
    startDate: context.startDate,
  })

  const fixType = args.fix_type as string

  // Filter issues by focus area
  let relevantIssues = analysis.issues
  if (fixType !== 'analyze') {
    relevantIssues = analysis.issues.filter(i => {
      if (fixType === 'proximity') return i.type === 'proximity'
      if (fixType === 'timing') return i.type === 'timing' || i.type === 'scheduling'
      if (fixType === 'pacing') return i.type === 'pacing' || i.type === 'gap'
      return true
    })
  }

  return {
    success: true,
    data: {
      score: analysis.score,
      summary: analysis.summary,
      issueCount: relevantIssues.length,
      issues: relevantIssues.map(i => ({
        type: i.type,
        severity: i.severity,
        day: i.day,
        message: i.message,
        suggestion: i.suggestion,
      })),
      dayBreakdown: analysis.dayBreakdown.map(d => ({
        day: d.day,
        theme: d.theme,
        pacing: d.pacing,
        items: d.itemCount,
        hours: d.totalHours,
        distanceKm: d.totalDistance,
      })),
    },
    actions: [{
      type: 'show_insight',
      payload: {
        insights: relevantIssues.map(i => i.message),
        score: analysis.score,
      },
    }],
  }
}

// ─── update_trip ────────────────────────────────────────────

async function executeUpdateTrip(
  args: Record<string, unknown>,
  context: { tripId: string },
): Promise<ToolResult> {
  const db = getDb()

  const updates: Record<string, unknown> = {}
  if (args.start_date) updates.start_date = args.start_date as string
  if (args.end_date) updates.end_date = args.end_date as string
  if (args.travelers) updates.travelers = args.travelers as number

  if (Object.keys(updates).length === 0) {
    return { success: false, data: { error: 'No updates provided' } }
  }

  const { error } = await db
    .from('trips')
    .update(updates)
    .eq('id', context.tripId)

  if (error) {
    return { success: false, data: { error: `Update failed: ${error.message}` } }
  }

  return {
    success: true,
    data: { updated: updates },
  }
}
