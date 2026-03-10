# AI Layer Audit — Context Management & Conversation Design

> Audit date: 2026-03-10
> Status: 7 issues identified, fixes prioritized

---

## What's Solid

### Prompt Structure
Follows Genia XML pattern: `<role>`, `<constraints>`, `<tools_guidance>`, `<output_format>`, `<examples>`. Constraints numbered and specific. 5 few-shot examples covering key scenarios (simple question, tool use, swap, reframe, insights).

### Tool Design
Gemini-optimized: descriptive names (`search_catalog` not `search`), enums for fixed options (`budget|mid|luxury`), detailed "when to use" in descriptions. Tested and verified — Gemini correctly selects tools with right params.

### Agentic Loop
Clean cycle: reason → tool call → observe result → respond. Max 3 rounds prevents runaway costs. Final call without tools if rounds exhausted. Error handling wraps each tool execution.

### Context Layering (Architecture)
3-layer design is sound:
- Layer 1 (always): trip summary — cheap, essential
- Layer 2 (conditional): focused item detail when user asks about specific item
- Layer 3 (on-demand): catalog data

---

## Issue 1: Item IDs Invisible to AI (CRITICAL)

**Where:** `ai-context.ts:buildTripSummary()` → `ai-tools.ts:swap_item`

**Problem:** The `swap_item` tool requires `item_id` (a UUID) but the AI never sees item IDs. Trip summary shows:
```
hotel: Mandarin Oriental ($250) [picked]
```
When user says "swap my hotel", Gemini has to call `swap_item` with an `item_id` it doesn't have. Tool will fail or hallucinate an ID.

**Impact:** swap_item and add_item are effectively broken in practice.

**Fix:**
```typescript
// ai-context.ts:buildTripSummary()
// Change from:
`${i.name}${price}${status}`
// To:
`${i.name}${price}${status} [id:${i.id}]`
```

Also update the `contextItem` to include its ID prominently so the AI can reference it for swaps.

**Effort:** 5 min

---

## Issue 2: Full Catalog Loaded Every Message (TOKEN WASTE)

**Where:** `ai-agent.ts:75` → `ai-context.ts:loadCatalogContext()`

**Problem:** Every chat message loads ALL catalog data into the system prompt:
- 8-10 hotels with metadata, honest_take, tips, amenities
- 12-15 activities with metadata
- 8-10 restaurants with metadata

That's ~3,000-4,000 tokens per message even when user says "what should I pack?" or "thanks!"

**Impact:** Wastes ~60% of input tokens. On Gemini free tier (1500 req/day), this burns through quota faster. Also pushes older conversation messages out of context window.

**Fix — Option A (Quick):** Only load catalog when message likely needs it:
```typescript
const needsCatalog = detectCatalogIntent(messages[messages.length - 1].content)
// Heuristic: mentions hotel, food, restaurant, activity, cheaper, swap,
// alternative, budget, price, add, recommend, suggest

if (needsCatalog || context.contextItem) {
  catalogContext = await loadCatalogContext(context.destination)
}
```

**Fix — Option B (Better, do this):** Load slim summary always, full detail only via tools:
```
System prompt gets:
  CATALOG SUMMARY: 8 hotels ($45-350/night), 12 activities ($0-120), 9 restaurants ($5-80/person)
  Hotels: Mandarin Oriental ($250, luxury), Lub d ($69, budget), Ibis ($52, budget), ...
  [Use search_catalog tool for full details, reviews, and honest takes]

Tool search_catalog returns:
  Full detail including honest_take, reviews, tips, amenities
```

This cuts system prompt catalog from ~3,500 tokens to ~500 tokens while keeping the AI aware of what's available.

**Effort:** 20 min

---

## Issue 3: Few-Shot Examples Show Fake Tool Syntax

**Where:** `ai-prompts.ts:66-89`

**Problem:** Examples contain descriptions of tool calls rather than showing what the model should actually output:
```
Assistant: [calls search_catalog with category="hotel", price_filter="budget"]
After tool result: "Found 3 budget options..."
```

Gemini doesn't need instruction on HOW to call tools — the tool definitions handle that. These pseudo-code descriptions:
1. Don't match any real output format
2. May confuse the model about what to generate
3. Mix tool-calling (handled by function calling API) with text output (what we want to control)

**Impact:** Model might generate text like "[calls search_catalog...]" instead of actually using the tool. Or it might try to describe what it would do instead of doing it.

**Fix:** Show only the final human-readable response for tool examples. Add a note that tools are called automatically:
```
### Example 2: User wants alternatives
User: "Show me cheaper hotels"
[You call search_catalog → results returned automatically]
Assistant: "Found 3 budget options. Best match for your vibes: Lub d Bangkok Siam ($69/night, 4.5★) — modern hostel-hotel hybrid, rooftop bar. Trade-off: smaller rooms, no pool. Want me to swap it in?"
```

**Effort:** 10 min

---

## Issue 4: No Error Handling in Prompt

**Where:** `ai-prompts.ts` — `<constraints>` section

**Problem:** No guidance for when tools fail or return empty results. Scenarios:
- `search_catalog` returns 0 results (no budget hotels in catalog)
- `swap_item` fails (item already deleted, concurrent edit)
- `search_flights` returns error (Amadeus rate limit, unknown airport)
- `adjust_budget` can't find cheaper alternatives

The AI will receive `{ success: false, data: { error: "..." } }` and has no instructions on what to do.

**Impact:** AI might hallucinate a response, repeat the failed tool call, or give a vague "something went wrong."

**Fix:** Add constraint #9:
```
9. **Handle failures gracefully.** If a tool returns an error or no results:
   - Explain what happened honestly ("I couldn't find budget hotels in our catalog for this destination")
   - Suggest an alternative approach ("I can show you mid-range options instead, or check if there are deals")
   - Never pretend the tool succeeded or make up results
```

**Effort:** 2 min

---

## Issue 5: No Conversation Memory Between Sessions

**Where:** `api/ai/chat/route.ts` → `ai-agent.ts:95`

**Problem:** Chat messages are saved to `chat_messages` table but never loaded back. If user closes tab and returns:
- Frontend starts with empty `chatMessages` state
- API receives empty messages array
- AI has zero context of prior conversation

User said "I prefer budget hotels" yesterday → AI doesn't know today.

**Impact:** Every session starts from scratch. User has to re-explain preferences. Breaks continuity of the "assistant" experience.

**Fix:** In the chat API route, before calling chatWithAgent, load recent messages:
```typescript
// Load recent chat history for this trip
const { data: history } = await supabase
  .from('chat_messages')
  .select('role, content')
  .eq('trip_id', tripId)
  .order('created_at', { ascending: true })
  .limit(20) // Last 20 messages

// Merge: history (DB) + current messages (frontend)
// Deduplicate by content to avoid repeats
const fullMessages = deduplicateMessages(history || [], messages)
```

Also update frontend to load chat history on mount:
```typescript
// In trip/[id]/page.tsx useEffect
const { data: history } = await supabase
  .from('chat_messages')
  .select('role, content')
  .eq('trip_id', id)
  .order('created_at')
setChatMessages(history || [])
```

**Effort:** 10 min (API) + 5 min (frontend)

---

## Issue 6: No User Preference Tracking

**Where:** `ai-context.ts:buildTripSummary()`

**Problem:** Our architecture doc says "Declared (vibes) vs Revealed (pick/skip). Revealed > Declared." But we only show item status minimally: `[picked]` or `[skipped]` next to item names. The AI doesn't get a synthesized preference signal.

If user has picked 3 budget items and skipped 2 luxury ones, the AI should know "this user is price-sensitive" — but it has to infer this from raw item names, which it can't reliably do.

**Impact:** AI treats every user the same regardless of their behavior. The "intelligence" layer is blind to behavioral signals.

**Fix:** Add a preferences synthesis section to trip summary:
```typescript
function buildPreferenceSignals(items: ItineraryItem[]): string {
  const picked = items.filter(i => i.status === 'picked')
  const skipped = items.filter(i => i.status === 'skipped')
  if (!picked.length && !skipped.length) return ''

  const lines = ['\nUser behavior signals:']

  if (picked.length) {
    const pickedPrices = picked.map(i => parsePrice(i.price))
    const avgPickedPrice = pickedPrices.reduce((a,b) => a+b, 0) / pickedPrices.length
    lines.push(`  Picked ${picked.length} items (avg $${Math.round(avgPickedPrice)}): ${picked.map(i => i.name).join(', ')}`)
  }

  if (skipped.length) {
    lines.push(`  Skipped ${skipped.length} items: ${skipped.map(i => i.name).join(', ')}`)
  }

  // Infer budget sensitivity
  const pickedBudget = picked.filter(i => parsePrice(i.price) < 50).length
  const pickedLuxury = picked.filter(i => parsePrice(i.price) > 150).length
  if (pickedBudget > pickedLuxury) lines.push('  Signal: price-sensitive — prefer budget options')
  if (pickedLuxury > pickedBudget) lines.push('  Signal: comfort-focused — prefer premium options')

  return lines.join('\n')
}
```

**Effort:** 15 min

---

## Issue 7: Catalog Loaded in System Prompt AND Available via Tools (REDUNDANCY)

**Where:** `ai-agent.ts:75` (loads into prompt) + `ai-tools.ts:search_catalog` (queries same data)

**Problem:** Same data is available two ways:
1. Full catalog dumped into system prompt (the AI can answer from context)
2. `search_catalog` tool queries the same Supabase tables

This creates confusion:
- AI might answer "The cheapest hotel is Ibis at $52" from the system prompt context when it should use the tool (which would return richer data + trigger a `show_alternatives` frontend action)
- Or it might call `search_catalog` when the answer is already in its context, wasting a tool round

**Impact:** Inconsistent behavior. Sometimes AI answers from memory (no frontend action), sometimes via tool (frontend action). User experience is unpredictable.

**Fix:** This is solved by Issue 2's fix (slim catalog summary in prompt, full detail via tools). The prompt gets awareness ("we have 8 hotels, cheapest is $52"), tools get the rich data. Then add to `<tools_guidance>`:
```
IMPORTANT: The catalog summary in your context shows what's available (names + prices).
To get full details (reviews, honest takes, tips) or to trigger a visual update for the user,
ALWAYS use search_catalog. Don't just recite catalog data from your context — use the tool
so the user sees formatted alternatives they can act on.
```

**Effort:** Bundled with Issue 2

---

## Priority Order

| # | Issue | Severity | Effort | Dependencies |
|---|-------|----------|--------|-------------|
| 1 | Item IDs invisible to AI | **Critical** | 5 min | None — swap tool is broken without it |
| 2 | Full catalog every message + redundancy (#7) | **High** | 20 min | None |
| 3 | Few-shot examples show fake tool syntax | **Medium** | 10 min | None |
| 4 | No error handling in prompt | **Medium** | 2 min | None |
| 5 | No conversation memory | **Medium** | 15 min | None |
| 6 | No preference tracking | **Low** | 15 min | Needs pick/skip data to be meaningful |

Issues 1-4 can be fixed in one pass (~40 min). Issues 5-6 are independent and can follow.

---

## Token Budget After Fixes

### Current (wasteful)
```
System prompt:     ~800 tokens (role, constraints, examples)
Catalog data:      ~3,500 tokens (full dump every message)
Trip summary:      ~200 tokens
Item context:      ~150 tokens (when applicable)
Conversation:      ~600 tokens (last 6 messages)
─────────────────────────────
Total input:       ~5,250 tokens/message
```

### After fixes
```
System prompt:     ~900 tokens (improved constraints + error handling)
Catalog SUMMARY:   ~500 tokens (names + prices only)
Trip summary:      ~250 tokens (with IDs + preference signals)
Item context:      ~150 tokens (when applicable)
Conversation:      ~800 tokens (last 6 messages + history)
─────────────────────────────
Total input:       ~2,600 tokens/message (50% reduction)
```

At Gemini free tier pricing, this means ~2x more conversations per day.
