# Drift AI Architecture — v2

> Design doc for the intelligence layer. Finalize before writing code.
> Last updated: 2026-03-09

---

## 1. Philosophy

**"The AI is the product, not a feature bolted on."**

Three principles:
1. **Catalog-first** — Real data beats hallucination. LLM enriches, never invents.
2. **Act, don't just talk** — Chat should DO things (swap hotels, adjust budget, add stops), not just answer questions.
3. **Context is intelligence** — A cheap model with great context > expensive model with no context. Load exactly what's needed, not everything.

---

## 2. Current State (What Exists)

### What Works
- Groq (Llama 3.3 70B) for chat + generation
- Catalog context loaded into system prompt (hotels, restaurants, activities with real reviews)
- Tool schemas defined: `suggest_alternatives`, `modify_itinerary`
- Chat saves to `chat_messages` table
- Regeneration (4 modes: full/budget/vibes/day) — catalog-only, no LLM

### What's Broken
- **Tools never execute** — Groq generates tool calls, frontend ignores them
- **Chat is stateless** — dumps entire catalog every message, no memory
- **No agentic loop** — AI can't reason → act → observe → reason again
- **Context is brute-force** — loads ALL catalog data regardless of question
- **Single model** — Groq for everything, rate-limited at 100K tokens/day

---

## 3. Target Architecture

### Model Strategy

| Role | Model | Why |
|------|-------|-----|
| **Chat + Tool Calling** | Gemini 2.5 Flash | Free tier (1500 req/day), good tool calling, thinking mode |
| **Itinerary Generation** | Gemini 2.5 Flash | Structured JSON, fast, cheap |
| **Pipeline Enrichment** | Gemini 2.5 Flash | Batch, cost-sensitive |
| **Fallback** | Groq Llama 3.3 | Free, for when Gemini is down |

Single model for now (Gemini 2.5 Flash). Upgrade chat to Sonnet/Pro post-fundraise when we need deeper reasoning.

### LLM Client Design

```
src/lib/llm.ts — Single LLM abstraction

Responsibilities:
- Model selection (Gemini primary, Groq fallback)
- Unified interface: chat(), generate(), toolCall()
- Token counting + logging
- Retry with fallback on rate limit
- Gemini-native API (not OpenAI compat — use Google's SDK for tool calling)
```

**Why not OpenAI compatibility layer?**
Gemini's native API handles tool calling + thinking + structured output better than the OpenAI-compat shim. We get:
- Native function calling with `functionDeclarations`
- Thinking tokens (Gemini 2.5 Flash's chain-of-thought)
- Grounding (optional: cite sources)
- JSON schema enforcement via `responseSchema`

---

## 4. Tool System

### Philosophy
Tools are the bridge between "AI that talks" and "AI that does things."

Each tool:
- Has a clear **single responsibility**
- Returns **structured data** (not prose)
- Is **idempotent** (safe to retry)
- Logs execution for debugging

### Tool Registry

#### `search_catalog` — Find items in our catalog
```
Input:  { category: hotel|food|activity, destination: string, filters?: { budget?, vibes?, rating_min? } }
Output: { items: [{ name, price, rating, image_url, honest_take, detail }], count: number }
```
When to call: User asks "show me cheaper hotels", "what restaurants are near my hotel", "any beach activities?"

#### `swap_item` — Replace an item on the board
```
Input:  { item_id: string, new_item: { name, detail, price, image_url?, category } }
Output: { success: boolean, old_item: string, new_item: string }
Side effect: Updates itinerary_items in Supabase
```
When to call: User confirms a swap ("yes, swap to Mandarin Oriental")

#### `adjust_budget` — Re-score items for different budget tier
```
Input:  { trip_id: string, new_budget: budget|mid|luxury, locked_items: string[] }
Output: { changed: [{ old: string, new: string, savings: string }], total_change: string }
Side effect: Calls regenerate API internally
```
When to call: User says "make this trip cheaper" or "upgrade to luxury"

#### `get_trip_insights` — Analyze current trip for smart observations
```
Input:  { trip_id: string }
Output: { insights: [{ type: tip|warning|suggestion, text: string, related_items?: string[] }] }
```
When to call: User asks "anything I should know?", "optimize my trip", or proactively after board loads.
Examples:
- "Your hotel is 5 min walk from 3 of your Day 2 activities"
- "Day 3 looks packed — 7 hours of activities with only 30 min gaps"
- "You could save $120 by switching lunch on Day 2 to a street food spot"

#### `search_flights` — Search real flights via Amadeus
```
Input:  { origin: string, destination: string, date: string, adults: number }
Output: { flights: [{ airline, price, duration, stops, departure, arrival, bookingUrl }] }
```
When to call: User asks "find me earlier flights" or "any direct flights?"

#### `add_item` — Add a new stop to the itinerary
```
Input:  { trip_id: string, item: { category, name, detail, price, time }, after_item_id: string }
Output: { success: boolean, item_id: string }
Side effect: Inserts into itinerary_items, reindexes positions
```
When to call: User says "add a spa on Day 2" or clicks "+" between items

### Tool Execution Loop

```
User message
    ↓
┌─────────────────────────────────────────┐
│  Build context (selective, not all)     │
│  + System prompt with persona           │
│  + Relevant catalog slice               │
│  + Current item (if focused)            │
│  + Trip summary (not full item dump)    │
└─────────────────────────────────────────┘
    ↓
Send to Gemini 2.5 Flash (with tool declarations)
    ↓
Response has tool call? ──── No ──→ Return text to user
    │
    Yes
    ↓
Execute tool server-side
    ↓
Feed tool result back to Gemini
    ↓
Gemini generates final response with tool result context
    ↓
Return text + any UI actions (swap buttons, flight cards, etc.)
```

**Max tool rounds: 3** — Prevents infinite loops. If AI needs >3 tool calls, something is wrong.

**Tool result format** — Always structured JSON so Gemini can reason over it:
```json
{
  "tool": "search_catalog",
  "result": {
    "items": [...],
    "count": 3,
    "note": "Filtered to budget hotels within 2km of beach"
  }
}
```

---

## 5. Context Management

### Problem
Current approach dumps ~3000 tokens of catalog data into every chat message. This is wasteful and noisy.

### Solution: Layered Context

```
Layer 1: ALWAYS loaded (every message)
├── System prompt (persona, rules)              ~300 tokens
├── Trip summary (destination, dates, budget)   ~100 tokens
└── Conversation history (last 6 messages)      ~600 tokens
                                          Total: ~1000 tokens

Layer 2: CONDITIONALLY loaded
├── Current item detail (if user clicked card)  ~200 tokens
├── Relevant catalog slice (category-matched)   ~500 tokens
└── Item alternatives (if discussing swaps)     ~300 tokens
                                          Total: ~1000 tokens max

Layer 3: TOOL-FETCHED (on demand)
├── Full catalog search results                 via search_catalog
├── Flight search results                       via search_flights
└── Trip insights/analysis                      via get_trip_insights
                                          Total: loaded only when needed
```

### Context Selection Logic

```
function selectContext(message, contextItem, trip):
  context = [systemPrompt, tripSummary(trip)]

  // Always: last 6 messages (not full history)
  context.push(recentMessages(6))

  // If user is focused on a specific item
  if contextItem:
    context.push(itemDetail(contextItem))
    context.push(itemAlternatives(contextItem))

  // Smart category detection from message
  if mentions(message, ['hotel', 'stay', 'room', 'accommodation']):
    context.push(catalogSlice('hotels', trip.destination))
  elif mentions(message, ['food', 'restaurant', 'eat', 'dinner', 'lunch']):
    context.push(catalogSlice('restaurants', trip.destination))
  elif mentions(message, ['activity', 'do', 'visit', 'see', 'tour']):
    context.push(catalogSlice('activities', trip.destination))
  elif mentions(message, ['flight', 'fly', 'airport']):
    context.push(flightContext(trip))
  // else: no catalog slice (general question, let tools fetch if needed)

  return context
```

### Conversation Memory

**Short-term** (within session):
- Keep last 6 messages in full
- Older messages: compress to 1-line summaries
- Track "active topic" (hotel discussion, budget planning, etc.)

**Long-term** (across sessions):
- Store in `chat_messages` table (already exists)
- On session start: load last 3 messages as "Previously discussed:"
- Track user preferences from pick/skip patterns:
  - "User tends to pick budget options"
  - "User skipped all temples — prefers food/nature"

---

## 6. System Prompt Design

### Base Prompt (always loaded)

```
You are Drift — a sharp, opinionated travel agent who actually knows their stuff.

Philosophy: "moj kara do" — maximize delight. Every recommendation should make
the traveler's trip genuinely better, not just fill a slot.

Rules:
1. USE YOUR TOOLS. Don't guess prices, availability, or details — search the catalog.
   If the user wants to change something, use swap_item. Don't just describe what
   they could do.
2. Be honest about trade-offs. "This hotel has amazing views but the breakfast is
   mediocre" is more useful than "Great hotel!"
3. Cite real data. Say "4.8★ with 2,300 reviews" not "highly rated."
4. Keep responses short. 2-3 sentences for simple questions. Use tools to show data
   instead of explaining it in words.
5. When suggesting alternatives, always include WHY — price diff, rating, distance,
   vibe match.
6. Never make up data. If you don't know, say so. If catalog doesn't have it, say
   "I don't have verified data on this."

Response style:
- Conversational, not formal
- Short paragraphs, not walls of text
- Use "→" for action suggestions
- Bold key names and prices
```

### Context Item Prompt (when user is focused on a card)

```
User is looking at: {item.name} ({item.category}, {item.price})
{item.description}
{item.metadata.honest_take}
Tips: {item.metadata.practical_tips}
Best for: {item.metadata.best_for}
Alternatives on board: {item.metadata.alts[].name}

Help them decide: is this the right pick? Should they swap? What pairs well with it?
```

### Trip Summary Prompt

```
Trip: {destination}, {country}
Dates: {start_date} → {end_date} ({days} days)
Travelers: {travelers} | Budget: {budget}
Vibes: {vibes.join(', ')}

Current board: {items.length} items
- {flights} flights, {hotels} hotels, {activities} activities, {meals} meals
- Picked: {picked_count} | Skipped: {skipped_count}
- Estimated total: ${total}
```

---

## 7. The Vibe-to-Itinerary Pipeline (End-to-End Data Flow)

### Current Flow — What Actually Happens

```
┌──────────────────────────────────────────────────────────────────────┐
│ /vibes page                                                          │
│ User selects: [beach, foodie, nightlife]                            │
│ Budget slider: $3000 → mapped to "mid"                              │
│ Travelers: 2, Dates: Apr 10-17, Origin: Delhi                      │
│                                                                      │
│ Stored in sessionStorage as:                                         │
│ { vibes: ['beach','foodie','nightlife'], budget: 'mid',            │
│   travelers: 2, startDate: '2026-04-10', endDate: '2026-04-17' }  │
└──────────────────────────┬───────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────────┐
│ /destinations page → POST /api/ai/generate { type: 'destinations' } │
│                                                                      │
│ Step 1: Query catalog_destinations WHERE status='active'            │
│ Step 2: Score each destination by vibe overlap:                     │
│         overlap = dest.vibes ∩ user.vibes                           │
│         matchPct = (overlap / userVibes.length) × 100 + 15 boost   │
│ Step 3: If 3+ destinations score > 20 → return catalog only        │
│         Else → call LLM suggestDestinations(vibes, budget, origin)  │
│         Merge catalog + LLM, return top 4                           │
│                                                                      │
│ THE GAP: Vibe overlap is just set intersection counting.            │
│ "beach" = 1 point. No weighting, no semantic understanding.        │
│ A "beach + foodie" user scores Bali (beach,spiritual,foodie) = 2/3 │
│ same as Bangkok (foodie,city,nightlife) = 1/3... wait, that works. │
│ But Phuket (beach,nightlife,party) = 2/3 same as Bali.            │
│ No way to say "Bali is MORE beach-foodie than Phuket."            │
└──────────────────────────┬───────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────────┐
│ User clicks "Bangkok" → POST /api/ai/generate { type: 'itinerary' }│
│                                                                      │
│ Step 1: findCatalogDestination('Bangkok') → found (active)          │
│ Step 2: getCatalogData(destId, vibes=['beach','foodie','nightlife'],│
│         budget='mid')                                                │
│                                                                      │
│   Template selection:                                                │
│   - Score templates: +10 if budget_level matches, +2 per vibe hit  │
│   - Pick highest scoring template                                    │
│                                                                      │
│   Hotel filtering:                                                   │
│   - Filter to price_level='mid' if 2+ hotels match                  │
│                                                                      │
│   THE GAP: Activities and restaurants are NOT filtered by vibes.    │
│   ALL activities returned. ALL restaurants returned.                 │
│   The template determines which ones appear — but template was      │
│   generated by pipeline LLM, which may or may not have prioritized │
│   beach/foodie/nightlife items.                                     │
│                                                                      │
│ Step 3: templateToItineraryItems() — maps template → items          │
│   Enriches with images, booking URLs, metadata from catalog         │
│   Adds alternatives from other catalog items                         │
│                                                                      │
│   THE GAP: No vibe-based sorting of alternatives. A beach lover    │
│   sees the same 3 alts as a culture lover.                          │
│                                                                      │
│ Step 4: Merge real Amadeus flights                                   │
│ Step 5: Insert trip + items into DB                                  │
│ Step 6: Return { trip, itemCount, dataSource }                       │
└──────────────────────────┬───────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────────┐
│ /trip/[id] board page                                                │
│                                                                      │
│ Vibes are stored in trips.vibes but NEVER used again.               │
│ The board renders whatever items were inserted.                      │
│ Chat has vibes in trip context but doesn't use them for ranking.    │
│ Regeneration passes vibes to getCatalogData but same template      │
│ selection logic (budget-weighted, light vibe scoring).              │
│                                                                      │
│ THE GAP: After initial generation, vibes are decorative.            │
│ No ongoing personalization based on vibes.                           │
└──────────────────────────────────────────────────────────────────────┘
```

### Where Vibes Actually Matter vs Where They're Ignored

| Step | Uses Vibes? | How | Gap |
|------|------------|-----|-----|
| Destination matching | Yes | Set intersection: `dest.vibes ∩ user.vibes` | No semantic weighting. "beach" counts same as any other. |
| Template selection | Weakly | +2 per vibe overlap (vs +10 for budget match) | Budget dominates. A budget match with 0 vibe overlap beats 0 budget with 3 vibe overlap. |
| Hotel filtering | No | Filtered by `price_level` only | A "romance" user sees same hotels as "party" user at same budget. |
| Activity selection | No | Template determines which appear | No per-user activity filtering. Template is one-size-fits-all per destination. |
| Restaurant selection | No | Template determines which appear | Same issue. |
| Alternative ranking | No | First 3 non-current items shown | Beach lover sees same alts as culture lover. |
| Chat context | Stored | In `trips.vibes`, passed to system prompt | AI knows vibes but doesn't use them to weight recommendations. |
| Regeneration | Weakly | Passed to `getCatalogData()` | Same template selection logic. |

### What Needs to Change

#### 1. Vibe-Weighted Scoring (not just overlap count)

Current: `overlap = dest.vibes ∩ user.vibes → count`
Problem: All vibes are equal. "Beach" and "foodie" get same weight.

Better: Weight by how strongly a destination embodies each vibe.

```typescript
// In catalog_destinations, store vibe_weights (set during pipeline enrichment)
type VibeWeights = Record<string, number> // 0-1 scale

// Example: Bangkok
{ foodie: 0.95, nightlife: 0.9, city: 0.85, culture: 0.7, spiritual: 0.5, beach: 0.2 }

// Example: Bali
{ spiritual: 0.95, beach: 0.9, foodie: 0.7, romance: 0.8, adventure: 0.6, party: 0.3 }

// Scoring: sum of (user_vibe × dest_weight) / user_vibes.length
// User [beach, foodie]: Bangkok = (0.2 + 0.95) / 2 = 0.575
//                       Bali = (0.9 + 0.7) / 2 = 0.80 ← better match
```

This can be set by the pipeline LLM during enrichment step, or computed from
the catalog items' vibe tags (how many beach-tagged items does this destination have?).

#### 2. Vibe-Filtered Items (not just template-determined)

Current: Template has fixed items. All users for "Bangkok mid-budget" get identical board.

Better: Score catalog items by vibe match, compose the template dynamically.

```
User [beach, foodie] in Bangkok:
- Activities: Score each by vibe overlap
  - Chatuchak Market (shopping, culture) → 0 overlap → lower priority
  - Asiatique Riverfront (nightlife, foodie) → 1 overlap → medium
  - Bang Saen Beach Day Trip (beach, adventure) → 1 overlap → medium

- Restaurants: Score by cuisine + vibe match
  - Thipsamai Pad Thai (foodie, local) → 1 overlap → high
  - SEEN Rooftop Bar (nightlife, city) → 0 overlap → lower

- Hotels: Already filtered by budget. Add vibe bonus:
  - Anantara Riverside (romantic, luxury) → 0 overlap → neutral
  - Beach-adjacent hostel (beach, budget) → 1 overlap → slight boost
```

This is Phase 2 work — requires either:
a) Multiple templates per destination (per vibe combination) — expensive pipeline
b) Dynamic template composition from scored items — smarter, no pipeline change

Option (b) is better: keep one template as the "default day structure" but SWAP items
within it based on vibe scoring. The template gives structure (Day 1: hotel + dinner + explore,
Day 2: activity + lunch + activity), the vibes determine WHICH hotel/dinner/activity.

#### 3. Vibe-Ranked Alternatives

Current: `catalog.hotels.filter(h => h.name !== current).slice(0, 3)`
Problem: First 3 items regardless of user preference.

Better:
```typescript
// Sort alternatives by vibe overlap before slicing
const sortedAlts = catalog.hotels
  .filter(h => h.name !== current)
  .sort((a, b) => {
    const aScore = (a.vibes || []).filter(v => userVibes.includes(v)).length
    const bScore = (b.vibes || []).filter(v => userVibes.includes(v)).length
    return bScore - aScore
  })
  .slice(0, 3)
```

Small change, big impact. Beach lover sees beach-vibe hotels as alternatives,
not random luxury hotels that happened to be first in the array.

#### 4. Vibe Evolution (vibes as living preference, not static input)

Vibes shouldn't be frozen at onboarding. The system should notice when
behavior contradicts declared vibes (see Section 8: User Intent & Persona).

```
Flow:
1. User declares: [beach, spiritual, foodie]
2. Board generated with those vibes
3. User picks: all food items, skips temple
4. System notices: foodie=strong, spiritual=weak
5. On regeneration or chat: "I noticed you're really into the food scene.
   Want me to add more restaurant options and swap the temple visit?"
6. If user says yes → vibes effectively become [beach, foodie] going forward
```

This connects Section 8 (persona inference) back to the generation pipeline.
The vibes array becomes a living document, not a frozen input.

### The Ideal Vibe Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Declared     │     │ Catalog      │     │ Revealed         │
│ Vibes        │────→│ Item Scoring │←────│ Preferences      │
│ [beach,food] │     │              │     │ (picks/skips)    │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
                    Scored items per category
                    (weighted by vibe match)
                           │
                    ┌──────┴───────┐
                    │ Template     │
                    │ Composer     │
                    │              │
                    │ Slots:       │
                    │ Day 1: H,D,A │
                    │ Day 2: A,L,A │
                    │ Day 3: A,D,A │
                    │              │
                    │ Fill each    │
                    │ slot with    │
                    │ highest-     │
                    │ scored item  │
                    └──────┬───────┘
                           │
                    Personalized itinerary
                    (same structure, different items per user)
```

### Implementation Plan

**Phase 1 (now, no new infra):**
- Vibe-rank alternatives in `templateToItineraryItems()` — 5 lines of code
- Pass vibes into AI chat context more prominently
- Log vibe match scores in generation route

**Phase 2 (post-tool-execution):**
- Add `vibe_weights` to `catalog_destinations` (compute from item vibe distribution)
- Vibe-filtered activity/restaurant selection in `getCatalogData()`
- Dynamic template composition (slot-based, scored items)

**Phase 3 (post-fundraise):**
- Multiple templates per destination-vibe combination
- Vibe evolution from behavior (Section 8 integration)
- Cross-trip vibe learning ("You always pick foodie items — starting with food-forward boards")

---

## 8. Constraint Validation & Edge Cases

### The Problem
The doc above assumes clean inputs. Real users say:
- "5-star beachfront resort for $30/night" (impossible)
- "Make the whole trip under $500" (5 days in Dubai, mid-budget)
- "I want luxury but keep it budget" (contradicts itself)
- "Add 10 activities to Day 2" (already 8 hours packed)
- "Find direct flights at 3am" (doesn't exist)
- "I want to spend $200 total for 7 days in Switzerland" (delusional)

The AI must NOT just blindly execute tools with bad inputs. It needs to push back intelligently.

### Approach: Validate Before Execute

Tools don't validate themselves — the AI reasons about feasibility BEFORE calling tools.
This is why we use a thinking model (Gemini 2.5 Flash has chain-of-thought). The system
prompt tells it to check constraints first.

Add to system prompt:
```
CONSTRAINT RULES:
Before using any tool, think through:
1. Is this physically possible? (Budget floors exist. $30/night luxury doesn't.)
2. Is this logically consistent? (Can't be luxury AND budget. Pick one, or clarify.)
3. Does the board have room? (Max ~4 activities per day. If packed, suggest replacing, not adding.)
4. Does this exist in our catalog? (If not, be honest: "We don't have verified data for that.")

When the user's request is unrealistic:
- Don't refuse. REFRAME. "A 5-star for $30 isn't possible in Bangkok, but here's
  what $80/night gets you — and it's actually great."
- Give them the closest realistic option + explain the gap.
- If budget is the hard constraint, show what that budget CAN get.
- If quality is the hard constraint, show what that quality COSTS.
```

### Constraint Types & Handling

#### Budget Constraints
```
User: "I want the whole trip under $500" (trip is 5 days in Dubai)

AI thinks: Current trip estimate is $2,400. $500 for 5 days = $100/day in Dubai.
  - Cheapest catalog hotel: $65/night (Dubai hostel-tier)
  - Cheapest food: $15/day (street food only)
  - Activities: mostly free (beach, mall walking)
  - Flights: $280 roundtrip minimum
  That leaves $44/day for everything else. Possible but very tight.

AI responds: "$500 for 5 days in Dubai is tight but doable if you're flexible.
  Here's what that looks like:
  - Hostel/budget hotel (~$65/night) instead of the Atlantis
  - Street food + local spots (~$15/day)
  - Free activities: JBR beach, Dubai Mall, creek walk
  - Your flights alone are ~$280
  → Want me to rebuild the board for a $500 budget? Some items will change significantly."
```

The key: **reframe, don't refuse**. Show what the budget actually gets.

#### Contradiction Handling
```
User: "Luxury hotel but budget trip"

AI responds: "Gotcha — splurge on the hotel, save everywhere else? I can find you
  a luxury stay and balance it with budget food and free activities.
  → Or did you mean something else by 'budget trip'?"
```

Don't assume. Clarify the ambiguity, but offer the most likely interpretation.

#### Physical Constraints
```
User: "Add a sunrise temple visit, rooftop dinner, night market, and cooking class all on Day 2"

AI thinks: That's sunrise (5am) + cooking class (3h) + dinner (2h) + market (2h) =
  already a 12-hour day, and Day 2 already has 3 items.

AI responds: "Day 2 is already pretty full with [existing items]. Adding all 4 would
  make it a 14-hour day with no downtime.
  → I'd suggest the temple sunrise + rooftop dinner (they pair beautifully).
  Move the cooking class to Day 3 which is lighter.
  → Or want me to clear Day 2 and rebuild around these 4?"
```

#### Catalog Gaps
```
User: "Show me Michelin-star restaurants"

AI thinks: Our catalog has 9 restaurants for Bangkok.
  Let me check if any have Michelin data... 2 do (from SerpAPI enrichment).

AI responds: "I have verified data on 2 Michelin-recognized restaurants in Bangkok:
  **Sra Bua by Kiin Kiin** (1 star, $$$) and **KHAAN** (Bib Gourmand).
  For more Michelin options, I'd recommend checking the Michelin Guide directly —
  I don't have verified data on others yet."
```

### Budget Reality Model

We need price floors per destination so the AI can reality-check:

```typescript
// Built into catalog_destinations or a separate lookup
type BudgetFloors = {
  hotel_per_night: { budget: number; mid: number; luxury: number }
  food_per_day: { budget: number; mid: number; luxury: number }
  activities_per_day: { budget: number; mid: number; luxury: number }
}

// Example: Bangkok
{
  hotel_per_night: { budget: 25, mid: 80, luxury: 250 },
  food_per_day: { budget: 10, mid: 30, luxury: 80 },
  activities_per_day: { budget: 5, mid: 20, luxury: 50 }
}
```

This is already partially in `catalog_destinations.avg_budget_per_day`. We extend it to
per-category floors so the AI can do math: "5 days × $25/night = $125 minimum for hotels."

### Day Capacity Model

```
Max reasonable items per day:
- Activities: 3-4 (accounting for travel time)
- Meals: 2-3 (breakfast often at hotel, so lunch + dinner)
- Hotel: 1 (check-in/check-out days may have 0)
- Total: 5-7 items per day

If a day has >7 items → AI warns "this day is packed"
If a day has <3 items → AI can suggest "Day 3 is light, want to add something?"
```

### Tool-Level Validation

Each tool also validates its own inputs before executing:

```
search_catalog:
  - budget filter: clamp to realistic range (min $10, max $2000/night)
  - category: must be hotel|food|activity (reject "spaceship")
  - destination: must exist in catalog (return "no data" if not)

swap_item:
  - item_id must exist in trip
  - new item must have name + category at minimum
  - can't swap a flight (flights are real Amadeus data)

adjust_budget:
  - new_budget must be budget|mid|luxury (not "$37.50")
  - if user gives a number, AI maps it: <$100/day = budget, $100-300 = mid, >$300 = luxury

add_item:
  - check day capacity before inserting
  - after_item_id must exist
  - can't add >3 items in single request (prevent spam)
```

---

## 9. User Intent & Persona Inference

### The Problem
We capture vibes at onboarding (beach, spiritual, foodie, etc.) but this is:
- One-time, static, declared preference
- Not necessarily what they ACTUALLY prefer
- Missing implicit preferences (budget sensitivity, pace preference, food-first vs sight-first)

Real persona understanding comes from **behavior, not declarations**.

### Two Layers of Preference

#### Layer 1: Declared (explicit, from onboarding)
```
Source: /vibes page selection
Data: { vibes: ['beach', 'foodie', 'nightlife'], budget: 'mid', travelers: 2 }
Stored: sessionStorage → trips table
```

This tells us what they THINK they want. It's a starting point, not ground truth.

#### Layer 2: Revealed (implicit, from behavior)
```
Source: Pick/skip/save actions on the board, chat questions, time spent
Data: Patterns inferred over the session

Signals:
- Picks: What they actively chose → strong positive signal
- Skips: What they rejected → negative signal
- Saves: What they're interested in but not committed → weak positive
- Chat topics: What they ask about → interest signal
- Swap requests: What they want to change → dissatisfaction signal
```

### Preference Tracker

Track these per trip (stored in trip metadata or a separate `user_preferences` accumulator):

```typescript
type RevealedPreferences = {
  // Budget behavior (overrides declared budget)
  budget_actions: {
    picked_avg_price: number       // avg price of picked items
    skipped_avg_price: number      // avg price of skipped items
    asked_for_cheaper: number      // count of "cheaper" requests in chat
    asked_for_upgrade: number      // count of "luxury/better" requests
  }

  // Category priority (what they engage with most)
  category_engagement: {
    [category: string]: {
      picks: number
      skips: number
      chat_mentions: number
      time_on_detail: number       // future: track with frontend events
    }
  }

  // Vibe accuracy (do their actions match declared vibes?)
  vibe_alignment: {
    [vibe: string]: {
      declared: boolean            // they picked this vibe
      acted_on: number             // items matching this vibe they picked
      rejected: number             // items matching this vibe they skipped
    }
  }

  // Pace preference
  pace: {
    items_per_day_preference: number  // inferred from skips on packed days
    added_free_time: boolean          // ever asked for lighter days
    packed_schedule: boolean          // ever asked for more activities
  }
}
```

### How It Flows Into Context

The preference tracker feeds a compact summary into the system prompt:

```
USER PROFILE (inferred from behavior):
- Budget: Declared "mid" but picks avg $45 items, skipped both $200+ hotels → likely budget-leaning
- Priority: Food (4 picks, 0 skips) > Activities (2 picks, 1 skip) > Hotels (0 picks, 1 skip)
- Vibes: Declared [beach, spiritual, foodie] — acts on foodie (strong), beach (moderate), skipped all temples (spiritual mismatch)
- Pace: Skipped 2 items on packed Day 2, asked "is this too much?" → prefers relaxed pace
```

This is ~100 tokens. Massive signal-to-noise improvement over dumping raw catalog data.

### When to Update Preferences

```
On every pick/skip/save → update category_engagement + budget_actions
On every chat message → update chat_mentions + check for budget/pace signals
On swap → strong signal: what they rejected AND what they wanted instead
On regeneration → note which mode (budget change = strong budget signal)
```

### Building It Incrementally

**Phase 1 (now):** Don't track anything new. Use what's already available:
- Pick/skip counts from `itinerary_items.status`
- Budget from `trips.budget`
- Vibes from `trips.vibes`
- Build the preference summary from existing DB data at chat time

**Phase 2 (post-launch):** Add lightweight tracking:
- Count chat topic categories
- Track "asked for cheaper" vs "asked for upgrade" keywords
- Store inferred preferences in `trips.metadata`

**Phase 3 (post-fundraise):** Full behavioral analytics:
- Frontend events (time on detail sheet, scroll depth)
- Cross-trip learning (user who took 3 trips → build persistent profile)
- Store in `user_preferences` table, load on new trip creation

### Vibe-to-Catalog Mapping

The vibes picker uses IDs like `beach`, `foodie`, `spiritual`, `adventure`, `nightlife`, `cultural`, `luxury`, `wellness`.

Each catalog item has a `vibes` array. The mapping is direct:
```
User vibes: [beach, foodie]
Hotel vibes: [beach, romantic, luxury] → overlap: 1 (beach)
Restaurant vibes: [foodie, local, date-night] → overlap: 1 (foodie)
Activity vibes: [spiritual, cultural] → overlap: 0 (no match)
```

But the REVEALED preference might be:
```
User PICKS the spiritual temple activity they declared they don't want
User SKIPS the beach resort they declared they do want
→ Revealed: spiritual > beach (contradicts declared)
```

The AI should weight revealed > declared:
```
System prompt context:
"Note: User selected 'beach' as a vibe but has skipped 2 beach activities
and picked a temple visit. They may be more interested in cultural experiences
than their vibe selection suggests. Lean toward cultural recommendations."
```

### Intent Classification

Not every message needs tool calling. The AI should classify intent first:

```
Intent categories:
1. QUESTION     → "What's special about this hotel?" → answer from context, no tool
2. SEARCH       → "Show me cheaper hotels" → search_catalog tool
3. ACTION       → "Swap to Anantara" → swap_item tool
4. PREFERENCE   → "I prefer local food over fancy restaurants" → update preferences, acknowledge
5. PLANNING     → "What should I do on Day 3?" → get_trip_insights + search_catalog
6. COMPLAINT    → "This itinerary is too expensive" → adjust_budget tool
7. IMPOSSIBLE   → "Get me a $10 hotel in Manhattan" → reframe with constraint validation
8. CHITCHAT     → "Thanks!" → respond naturally, no tool
9. OUT_OF_SCOPE → "What's the weather in Bangkok?" → answer if known, else redirect gracefully
```

The thinking model handles this naturally — Gemini 2.5 Flash's chain-of-thought
classifies intent before deciding whether to call tools. We don't need a separate
classifier; it's part of the system prompt:

```
Before responding, think through:
1. What does the user actually want? (intent)
2. Do I need a tool, or can I answer from context? (tool decision)
3. Is the request realistic? (constraint check)
4. What does their behavior tell me? (preference signal)
Then respond.
```

---

## 10. Frontend Integration

### Chat Panel Changes

Current: Chat returns `{text, toolUse}` — toolUse is ignored.

New: Chat returns `{text, actions[]}` — actions rendered as UI elements.

```typescript
type ChatResponse = {
  text: string
  actions?: ChatAction[]
}

type ChatAction =
  | { type: 'swap_suggestion'; item_id: string; alternatives: Alt[] }
  | { type: 'flight_results'; flights: Flight[] }
  | { type: 'insight'; insights: Insight[] }
  | { type: 'budget_change'; changes: BudgetChange[] }
  | { type: 'item_added'; item: ItineraryItem }
```

### Rendering Actions

```
[AI text response]

[If actions present:]
┌─────────────────────────────────────┐
│ 🔄 Swap Options                     │
│ ┌─────┐ ┌─────┐ ┌─────┐           │
│ │Hotel│ │Hotel│ │Hotel│           │
│ │ $180│ │ $220│ │ $150│           │
│ └──┬──┘ └──┬──┘ └──┬──┘           │
│    [Swap]  [Swap]  [Swap]          │
└─────────────────────────────────────┘
```

Actions are rendered inline in the chat panel. User clicks "Swap" → `swap_item` tool executes → board updates.

---

## 11. File Structure

```
src/lib/
├── llm.ts              NEW — Unified LLM client (Gemini primary, Groq fallback)
├── ai-tools.ts         NEW — Tool definitions + execution handlers + validation
├── ai-context.ts       NEW — Context selection + preference tracker + memory
├── ai-agent.ts         REFACTOR — Use llm.ts, wire tools, better prompts
├── catalog.ts          KEEP — Catalog lookup (already good)
├── pipeline.ts         UPDATE — Use llm.ts instead of direct Groq/OpenAI
├── amadeus.ts          KEEP — Flight search
├── serpapi.ts           KEEP — Google Maps data
└── images.ts           KEEP — Image management

src/app/api/ai/
├── chat/route.ts       REFACTOR — Tool execution loop, context selection
├── generate/route.ts   UPDATE — Use llm.ts
└── regenerate/route.ts KEEP — Already catalog-only, no LLM needed
```

---

## 12. API Contracts

### POST /api/ai/chat (updated)

**Request:**
```json
{
  "messages": [{ "role": "user", "content": "show me cheaper hotels" }],
  "tripId": "uuid",
  "contextItemId": "uuid | null"
}
```

**Response:**
```json
{
  "text": "Here are 3 hotels under $200/night in Bangkok:",
  "actions": [
    {
      "type": "swap_suggestion",
      "item_id": "current-hotel-uuid",
      "alternatives": [
        { "name": "Anantara Riverside", "price": "$180/night", "rating": 4.6, "image_url": "...", "detail": "..." },
        { "name": "Chatrium Riverside", "price": "$120/night", "rating": 4.4, "image_url": "...", "detail": "..." }
      ]
    }
  ]
}
```

### POST /api/ai/chat/swap (new endpoint)

**Request:**
```json
{
  "tripId": "uuid",
  "itemId": "uuid",
  "newItem": { "name": "Anantara Riverside", "detail": "...", "price": "$180/night", "image_url": "..." }
}
```

**Response:**
```json
{
  "success": true,
  "item": { /* updated itinerary_item */ }
}
```

---

## 13. Implementation Order

### Phase 1: LLM Abstraction (Day 1)
- [ ] Create `src/lib/llm.ts` — Gemini 2.5 Flash client with Groq fallback
- [ ] Unified interface: `chat()`, `generateJSON()`, `chatWithTools()`
- [ ] Token logging + error handling
- [ ] Swap `ai-agent.ts` to use `llm.ts`
- [ ] Test: chat works, generation works, pipeline works

### Phase 2: Context + Preferences (Day 2)
- [ ] Create `src/lib/ai-context.ts` — Context selection + preference tracker
- [ ] Build `tripSummary()` — compact trip state for system prompt
- [ ] Build `userPreferences()` — infer from pick/skip/save patterns (from existing DB data)
- [ ] Build `selectCatalogSlice()` — category detection from message keywords
- [ ] Conversation memory: last 6 full, older messages summarized
- [ ] Updated system prompt with constraint rules + preference context
- [ ] Test: context is smaller, preference summary is accurate

### Phase 3: Tool Execution (Day 3)
- [ ] Create `src/lib/ai-tools.ts` — Tool registry + handlers + input validation
- [ ] Implement `search_catalog` tool with budget/category validation
- [ ] Implement `swap_item` tool with flight-protection + capacity check
- [ ] Build tool execution loop in chat route (call → validate → execute → feed back → respond)
- [ ] Constraint validation: budget floors, day capacity, contradiction detection
- [ ] Test: "show me cheaper hotels" → real catalog results
- [ ] Test: "$10 hotel in Dubai" → reframes with realistic options
- [ ] Test: "luxury but budget" → clarifies contradiction

### Phase 4: Frontend Integration (Day 4)
- [ ] Update chat panel to render `actions[]` from tool results
- [ ] Swap suggestion cards (inline in chat, with images + prices)
- [ ] One-click swap button → calls /api/ai/chat/swap → board updates
- [ ] Loading states for tool execution ("Searching catalog...")
- [ ] Preference signals: on pick/skip, send event for preference tracking
- [ ] Test: full flow — ask → tool → result → swap → board updates

### Phase 5: Advanced Tools + Intelligence (Day 5)
- [ ] Implement `get_trip_insights` tool (day capacity, budget gaps, proximity)
- [ ] Implement `adjust_budget` tool (with constraint validation)
- [ ] Implement `add_item` tool (with day capacity check)
- [ ] Implement `search_flights` tool (Amadeus integration)
- [ ] Revealed preference → declared vibe conflict detection
- [ ] Proactive insights on board load (light, non-intrusive)
- [ ] Test: "optimize my budget" → savings suggestions with trade-offs
- [ ] Test: user who skips all temples → AI stops suggesting temples

---

## 14. Token Budget

### Per Chat Message (target)

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | ~300 | Persona + rules |
| Trip summary | ~100 | Compact format |
| Recent messages (6) | ~600 | Kept in full |
| Context item | ~200 | Only if focused |
| Catalog slice | ~500 | One category max |
| **Input total** | **~1,700** | Down from ~3,000 |
| Output | ~300 | Short responses |
| Tool call + result | ~400 | If tool used |
| **Total per exchange** | **~2,400** | With tool round |

### Daily Budget (50 beta users, Gemini free tier)

| Metric | Estimate |
|--------|----------|
| Chat messages/day | ~150 (3 per user × 50) |
| Generation calls/day | ~15 (30% non-catalog) |
| Requests/day | ~165 |
| Free tier limit | 1,500 req/day |
| **Headroom** | **~9x** |

---

## 15. Observability

Every LLM call logs:
```
[LLM] model=gemini-2.5-flash type=chat tokens_in=1700 tokens_out=300 tools=search_catalog time=1.2s
[Tool] search_catalog → 3 results (hotels, budget, Bangkok) time=0.3s
[LLM] model=gemini-2.5-flash type=tool_response tokens_in=2100 tokens_out=250 time=0.9s
```

Every tool execution logs:
```
[Tool:search_catalog] input={category:hotel, budget:budget} → 3 results, 0.3s
[Tool:swap_item] item=uuid old="Four Seasons" new="Anantara" → success, 0.1s
```

---

## Open Questions

1. **Thinking tokens** — Gemini 2.5 Flash uses thinking tokens (chain-of-thought). Free but add ~200ms latency. Keep enabled always (helps constraint reasoning) or toggle per request?

2. **Streaming** — Defer to post-Phase 4. Get tool loop working with full responses first. Streaming + tool calls is complex (need to stream text, pause for tool, stream again).

3. **Swap confirmation** — Current plan: AI suggests, shows cards with "Swap" button. User clicks = confirmed. No double-confirmation. Can always undo via "swap back" in chat. Keeps flow fast.

4. **Proactive insights** — Yes, but gentle. On board load, run `get_trip_insights` once. Show as a dismissible banner, not a chat message. Don't interrupt the user mid-flow.

5. **Preference persistence** — Phase 1: per-trip only (inferred from picks/skips). Phase 2: cross-trip (store in user profile). Phase 3: proactive persona ("You're a foodie who prefers budget stays — here's a trip designed for that").

6. **Hallucination guard for uncataloged destinations** — If user picks a destination not in our catalog, the AI has no real data. Current: LLM generates everything (hallucination risk). Future: be transparent ("I don't have verified data for Luang Prabang yet. This itinerary is AI-generated — prices and details are estimates, not confirmed.") Add a `source: 'ai-estimated'` badge on items.

7. **Multi-destination trips** — Not supported yet. User asks "add a 2-day side trip to Chiang Mai from Bangkok." This requires cross-destination planning. Defer to post-fundraise.

---

## Decision Log

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Primary model | Gemini 2.5 Flash | Free tier, good tool calling, fast, thinking mode |
| API style | Native Gemini (not OpenAI compat) | Better tool calling + thinking support |
| Tool execution | Server-side in chat route | Security (DB writes), reliability |
| Context strategy | Selective + layered | Reduce tokens, improve relevance |
| Max tool rounds | 3 per message | Prevent infinite loops, keep UX fast |
| Regeneration | Keep catalog-only (no LLM) | Already works, instant, reliable |
| Streaming | Defer to Phase 5+ | Get tool loop working first |
| Constraint handling | AI reasons pre-tool (thinking) | Reframe, don't refuse. System prompt rules. |
| Preferences | Infer from behavior, Phase 1 = existing DB data | Revealed > declared. No new tracking infra yet. |
| Swap UX | Suggest + one-click, no double confirm | Speed > safety (undo is easy via chat) |
| Impossible requests | Reframe to closest realistic option | Never say "I can't." Say "here's what's possible." |
