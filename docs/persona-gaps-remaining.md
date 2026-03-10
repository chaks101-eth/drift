# Drift — Persona Gap Analysis

Cross-referenced against `docs/personas-and-gaps.md` (6 personas, 517 lines of community research).
Ordered by severity. Each gap includes where in the code to fix it.

---

## Gap 1: Same Board for Everyone (no vibe-ranking)
**Severity:** Critical
**Personas affected:** All 6 — but especially Persona 1 (Aarav, adventure) vs Persona 3 (Priya, romance)
**Where:** `src/lib/catalog.ts` → `templateToItineraryItems()`, `src/app/api/ai/generate/route.ts`

**Problem:** When two users pick different vibes but the same destination, they get identical itineraries. `templateToItineraryItems()` converts catalog templates to items in fixed order — it never checks `trip.vibes` to reorder, filter, or weight items.

**Impact:** The core promise ("curated to your vibe") is broken. An adventure traveler sees the same Bali board as a romance traveler.

**Fix:**
1. In `templateToItineraryItems()`, accept `vibes: string[]` parameter
2. Score each catalog item against vibes using `metadata.best_for` / `metadata.features`
3. Sort items within each day by vibe match score (highest first)
4. For activities: if catalog has >3 options per day, pick top 3 by vibe match, put rest in `metadata.alts`
5. For hotels: lead with the best vibe-matched option, others become alternatives
6. For restaurants: prioritize cuisine types that match vibes (foodie → street food first, romance → fine dining first)

**Effort:** Medium (2-3 hours). Core logic is a scoring function + sort.

---

## Gap 2: No Source/Trust Badges on Board Items
**Severity:** Critical
**Personas affected:** Persona 2 (Meera, anxious planner), Persona 4 (Raj, luxury)
**Where:** `src/app/trip/[id]/page.tsx` (flow node rendering), `src/lib/catalog.ts`, `src/app/api/ai/generate/route.ts`

**Problem:** Users can't distinguish real catalog data (Amadeus flights, SerpAPI-verified hotels) from LLM-generated items. The `source` field exists in `database.types.ts` but is never displayed. Meera (anxious planner) needs to know "is this a real hotel?" before she trusts the itinerary.

**Impact:** Trust collapse. Community research (Gap doc lines 380-420) shows "can I actually book this?" is the #1 concern.

**Fix:**
1. In flow node rendering (trip page), show a small badge:
   - `catalog` → "Verified" (teal dot)
   - `amadeus` → "Live Price" (green dot)
   - `ai` → "AI Suggested" (gold dot, subtle)
2. Pipeline already sets `source` field — just surface it in UI
3. For items with `metadata.booking_url`, show a subtle "Bookable" indicator

**Effort:** Small (1 hour). Data already exists, just needs UI.

---

## Gap 3: Alternatives Not Vibe-Ranked
**Severity:** High
**Personas affected:** Persona 1, 3, 4 (anyone using swap/alternatives)
**Where:** `src/lib/ai-tools.ts` → `swap_item` tool, `src/lib/catalog.ts`

**Problem:** When AI suggests alternatives (via `metadata.alts`) or the swap panel shows options, they're in arbitrary order — not ranked by how well they match the user's vibes. A romance traveler swapping hotels sees budget hostels alongside boutique villas.

**Fix:**
1. In `swap_item` tool execution, score alternatives against trip vibes before returning
2. In `templateToItineraryItems()`, when building `metadata.alts`, sort by vibe match
3. In the swap panel UI, show vibe match % next to each alternative

**Effort:** Small-Medium (1-2 hours). Reuse scoring function from Gap 1.

---

## Gap 4: No Occasion/Trip Type Field
**Severity:** High
**Personas affected:** Persona 3 (Priya, honeymoon), Persona 5 (Ananya, girls trip), Persona 6 (Vikram, weekend)
**Where:** `src/app/vibes/page.tsx`, `src/lib/ai-prompts.ts`, `src/app/api/ai/generate/route.ts`

**Problem:** "Romance" vibe ≠ honeymoon. "Party" vibe ≠ bachelorette. The occasion/trip type changes everything — a honeymoon needs couple-only activities, a girls trip needs group-friendly spots, a weekend trip needs compressed scheduling. Currently no way to express this.

**Fix:**
1. Add occasion selector to vibes page (after vibe grid, before config):
   - Options: "Just exploring", "Honeymoon", "Anniversary", "Birthday", "Girls/Guys Trip", "Family", "Solo Reset", "Weekend Getaway"
2. Store in `sessionStorage` alongside vibes, pass through to generation
3. Add to system prompts: `<occasion>{occasion}</occasion>` in context
4. LLM uses occasion to adjust: activity group sizes, restaurant ambiance, hotel room types, scheduling density

**Effort:** Medium (2 hours). UI is simple, prompt changes are small, but generation quality depends on LLM following occasion cues.

---

## Gap 5: No "I Know Where I'm Going" Skip
**Severity:** High
**Personas affected:** Persona 4 (Raj, repeat luxury traveler), Persona 6 (Vikram, weekend to Goa)
**Where:** `src/app/vibes/page.tsx`, `src/app/destinations/page.tsx`

**Problem:** Users who already know their destination are forced through vibe picker → destination suggestions → pick destination. Raj knows he's going to Maldives. Vikram knows he's going to Goa. The current flow wastes their time and feels patronizing.

**Fix:**
1. Add "I already know where I'm going" link on vibes page (below CTA button)
2. Clicking it shows a destination search input (autocomplete from `catalog_destinations`)
3. On selection, skip destinations page entirely → go straight to generation with selected destination + vibes
4. Alternative: Add search bar to destinations page header that lets users type a destination directly

**Effort:** Small-Medium (1-2 hours). Mainly UI + a direct route to generation.

---

## Gap 6: Budget Mapping Too Crude
**Severity:** High
**Personas affected:** Persona 2 (Meera, strict budget), Persona 4 (Raj, luxury)
**Where:** `src/app/vibes/page.tsx` → `handleContinue()`, `src/lib/ai-prompts.ts`

**Problem:** Budget slider maps to just 3 tiers: `≤2000 → "budget"`, `≤4000 → "mid"`, `>4000 → "luxury"`. $2,100 and $3,900 are both "mid" but represent very different trips. Meera with $1,800 gets the same tier as someone with $500.

**Fix:**
1. Pass actual dollar amount to generation, not just tier string
2. In system prompt, include: `Budget: $${amount} total ($${perPersonPerDay}/person/day)`
3. LLM can then calibrate item prices to actual budget, not just tier
4. Keep tier as a secondary signal for catalog filtering (price_level queries)

**Effort:** Small (30 min). Change `handleContinue()` to pass amount, update prompt template.

---

## Gap 7: No Short Trip Templates (2-3 days)
**Severity:** High
**Personas affected:** Persona 6 (Vikram, weekend warrior)
**Where:** `src/lib/ai-prompts.ts` → `GENERATION_SYSTEM_PROMPT`, catalog pipeline

**Problem:** Generation prompt assumes multi-day trips. A 2-day weekend trip to Goa doesn't need the same structure as a 7-day Bali trip. Currently, short trips get padded with filler activities or awkwardly compressed long-trip templates.

**Fix:**
1. In generation prompt, add date-aware instructions:
   - 1-2 days: "Weekend sprint — pack highlights only, no hotel alternatives needed, suggest 2-3 must-do activities per day max"
   - 3-4 days: "Short trip — focused itinerary, 1 hotel, key highlights"
   - 5+ days: Current full itinerary format
2. In catalog templates, support a `duration_type` field: "weekend" | "short" | "full"
3. When generating for ≤3 days, use compressed template if available

**Effort:** Medium (1-2 hours). Prompt changes + template awareness.

---

## Gap 8: No Group Coordination
**Severity:** Medium
**Personas affected:** Persona 5 (Ananya, group trip planner)
**Where:** New feature — `src/app/trip/[id]/page.tsx`, new API routes

**Problem:** Ananya is planning for 4 friends. She picks everything alone, then has to screenshot and send to WhatsApp. No way for group members to vote, comment, or see the trip. The share page is read-only.

**Fix (MVP):**
1. Add "Invite to plan" button on trip board → generates invite link
2. Invited users see the same board (real-time via Supabase subscriptions)
3. Each user can pick/skip items independently → show vote counts on items
4. Chat becomes group chat (messages tagged with user)

**Effort:** Large (1-2 days). Requires auth-aware board, real-time sync, vote aggregation. **Defer to post-launch.**

---

## Gap 9: No Booking Integration
**Severity:** Medium (for MVP), Critical (for retention)
**Personas affected:** All 6 — especially Persona 2 (Meera needs to actually book)
**Where:** `src/app/trip/[id]/page.tsx` (item detail panel), `src/lib/amadeus.ts`

**Problem:** Users plan a beautiful trip but then have to manually search and book everything on separate sites. The `booking_url` field exists but only for Amadeus flights (Skyscanner deep links). Hotels and activities have no booking path.

**Fix (MVP):**
1. For hotels: Generate affiliate links to Booking.com / Agoda search (destination + dates + hotel name)
2. For activities: Link to Viator / GetYourGuide search
3. For restaurants: Link to Google Maps (already have location data from SerpAPI)
4. Show "Book" button on each item in detail panel when URL is available

**Effort:** Medium (2-3 hours). Affiliate link generation is templated. **Revenue opportunity.**

---

## Gap 10: No Offline/Export
**Severity:** Low-Medium
**Personas affected:** Persona 2 (Meera, wants printable checklist), Persona 6 (Vikram, quick reference)
**Where:** New feature — `src/app/trip/[id]/page.tsx`

**Problem:** No way to take the itinerary offline. Users traveling internationally may not have data. Currently share page requires internet.

**Fix:**
1. "Export as PDF" button on trip board → generates clean itinerary PDF
2. Include: day-by-day schedule, hotel addresses, booking references, map links
3. Use browser-side PDF generation (html2pdf or similar) to keep it simple

**Effort:** Medium (2-3 hours). **Defer to post-MVP.**

---

## Priority Order for Implementation

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| 1 | Gap 1: Vibe-rank board items | Medium | Fixes core personalization promise |
| 2 | Gap 2: Trust badges | Small | Instant trust signal |
| 3 | Gap 6: Budget actual amount | Small | Quick fix, big calibration improvement |
| 4 | Gap 5: Skip to destination | Small-Med | Removes friction for power users |
| 5 | Gap 4: Occasion field | Medium | Unlocks honeymoon/group/weekend personas |
| 6 | Gap 3: Vibe-rank alternatives | Small-Med | Better swap experience |
| 7 | Gap 7: Short trip templates | Medium | Weekend warrior persona |
| 8 | Gap 9: Booking links | Medium | Revenue + completion |
| 9 | Gap 8: Group coordination | Large | Post-launch |
| 10 | Gap 10: Offline/export | Medium | Post-MVP |
