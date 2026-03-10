# Drift — User Personas, Journey Mapping & Gap Analysis

> Maps real traveler types to our product flow, identifies every gap and broken moment.
> Cross-referenced with Reddit research for real pain points.
> Last updated: 2026-03-10

---

## The 6 Personas

### 1. Priya — The Hustling Professional (Solo/Couple, Mid-Budget)
**Who:** 26, works at a startup in Bangalore. Gets 2 weeks PTO. Travels 2-3 times/year.
**How she plans today:**
- Opens 15 Chrome tabs: Google Flights, Booking.com, TripAdvisor, Instagram, Reddit
- Makes a Google Sheet with dates, costs, options
- Spends 2-3 weekends researching before booking
- Gets overwhelmed by choices, ends up booking whatever her friend recommended
- Total planning time: **15-20 hours** across 2-3 weeks

**What she actually wants:**
- "Just tell me where to go and what to do — I trust you if you show me WHY"
- Wants opinionated picks, not 200 options
- Budget-conscious but will splurge on experiences (foodie dinners, unique stays)
- Hates tourist traps, wants "local" feel
- Plans alone but travels with partner

**Her journey through Drift:**
```
/login → /vibes → selects [foodie, city, romance] → budget slider $3000 → /destinations
→ sees 4 options with match % → clicks Bangkok (92% match)
→ loading... → /trip/[id] board
→ scrolls through items → picks some, skips some
→ opens chat: "is this hotel actually good or tourist trap?"
→ AI responds with honest_take from catalog
→ "show me something more local" → AI suggests alternative
→ shares trip with partner via /share link
```

**Where Drift breaks for Priya:**

| Step | Gap | Severity |
|------|-----|----------|
| Vibes → Destinations | She selected "romance" but destinations don't score romance-weight. Bangkok and Bali score same. | Medium |
| Destination cards | No "why this matches you" explanation. Just match %. She wants to know WHY 92%. | High |
| Budget slider | $3000 total budget slider → mapped to "mid". But she's $3000 for 7 days for 2 people = $215/day/person. That's actually budget in Bangkok. Mapping is wrong. | High |
| Board generation | Template is same for all mid-budget Bangkok users. Her "foodie + romance" combo gets same board as "foodie + party" person. | High |
| Hotel selection | No romance-vibe hotels prioritized. She sees generic mid-range hotels. | Medium |
| Restaurant picks | Not prioritized by "romantic dinner" vibe. Same restaurants for everyone. | Medium |
| Chat: "is this good?" | Works — catalog has honest_take. But response is slow (Groq latency + rate limits). | Low (fixing with Gemini) |
| Chat: "more local" | Tools don't execute. AI describes alternatives but can't swap them. | Critical |
| Share flow | /share page exists but is basic. Partner can't comment, suggest, or co-plan. | Medium |
| After booking | Trip is done. No follow-up. No "how was it?" No learning for next trip. | Low (post-fundraise) |

---

### 2. Arjun & Squad — The Group Trip Planners (4-6 Friends, Mixed Budget)
**Who:** Late 20s friend group. One person (Arjun) does all the planning. Others just show up.
**How they plan today:**
- WhatsApp group: 200 messages, 15 screenshot forwards, zero decisions
- Google Doc that nobody reads
- One person (Arjun) spends 30+ hours planning while others say "anything works"
- Budget fights: 2 people want budget, 2 want luxury, everyone says "mid" to avoid conflict
- The plan changes 5 times. Arjun is exhausted. Trip happens. Nobody thanks him.

**What they actually want:**
- ONE person plans, others react (pick/skip/vote)
- Budget split visibility: "your share is $X"
- Democratic picks: "3 of 4 liked this hotel"
- Easy sharing: "here's the board, vote on stuff"
- No more 200-message WhatsApp threads

**Their journey through Drift:**
```
Arjun: /login → /vibes → selects vibes → /destinations → picks Goa
→ board generates → scrolls, picks favorites
→ shares link to WhatsApp group: "check this out"

Friends: open /share/[slug] → see the board
→ ... can't interact. Can't pick/skip. Can't vote. Can only look.
→ back to WhatsApp: "looks good but can we change the hotel?"
→ Arjun: manually opens chat, asks AI to swap
```

**Where Drift breaks for Arjun & Squad:**

| Step | Gap | Severity |
|------|-----|----------|
| Group creation | No concept of "group trip." Only single-user trips. | Critical |
| Budget input | No per-person budget. $3000 slider = total? Per person? Unclear. | High |
| Share page | View-only. Can't pick/skip/vote. Dead end. | Critical |
| Co-planning | No way for friends to suggest changes, add items, vote. | Critical |
| Budget split | No per-person cost breakdown. "Your share" doesn't exist. | High |
| Notifications | No "Arjun updated the trip" alerts. | Medium |
| Conflict resolution | When 2 want luxury hotel, 2 want budget — no voting mechanism. | Medium |
| Trip coordination | No "who's booking what" assignment. | Low (post-launch) |

**Verdict:** Drift is currently **single-player only**. Group trips = our biggest expansion opportunity but requires significant product work. **Defer to post-fundraise**, but the share page can be upgraded to allow voting/reactions as a lightweight step.

---

### 3. Deepak & Meera — The Honeymoon Couple (Luxury-Aspirational, First Big Trip)
**Who:** Late 20s, just married. Saved up for a dream honeymoon. Budget: $5000-8000.
**How they plan today:**
- Instagram: saved 200 posts of Maldives/Santorini/Bali
- Wedding planner or travel agent (if they can afford one): $200-500 fee
- Or DIY: 40+ hours of research across multiple sites
- Analysis paralysis: too many "once in a lifetime" decisions
- Anxiety: "what if we pick wrong and waste our honeymoon?"

**What they actually want:**
- "Make it perfect. We only get one honeymoon."
- Curated, not crowded. Private, not party.
- Surprise elements: "Drift arranged a sunset dinner we didn't even know about"
- Romance-optimized: not just "nice hotel" but "the hotel with the overwater bungalow where they put rose petals"
- Confidence: knowing they're making the RIGHT choices, not just good ones

**Their journey through Drift:**
```
/login → /vibes → [romance, beach, foodie] → budget slider maxed → "luxury"
→ /destinations → Maldives (98%), Santorini (95%), Bali (91%)
→ clicks Maldives → board generates

→ Meera: "is this the BEST resort? Like THE one?"
→ Chat: "what makes this better than the other options?"
→ AI: responds with honest_take, review_synthesis, comparison
→ "Can we add a private dinner on the beach?"
→ Chat: ... can't add custom experiences not in catalog
```

**Where Drift breaks for Deepak & Meera:**

| Step | Gap | Severity |
|------|-----|----------|
| Vibe: "romance" | No romance-specific logic. Same as any other vibe tag. No candle-lit dinner prioritization. | High |
| Luxury expectation | "Luxury" budget tier exists but hotels aren't romance-sorted. A luxury business hotel scores same as overwater bungalow. | High |
| "Is this THE BEST?" | AI can compare from catalog but doesn't express confidence level. "This is the #1 rated honeymoon resort in Maldives based on 4,800 reviews" is what they need. | Medium |
| Custom experiences | "Private beach dinner" isn't in catalog. AI can't add custom items. | Medium |
| Occasion awareness | Drift doesn't know this is a honeymoon. No special occasion logic. | High |
| Surprise/delight | No "hidden gem" or "surprise recommendation" that makes them feel the AI really knows them. | Medium |
| Booking confidence | No "book now, prices going up" or "this resort sells out 3 months ahead" urgency signals. | Low |
| Photography spots | "Best spots for honeymoon photos" — not in our data model. | Low |

**Key insight:** Honeymoon couples need **confidence**, not just options. They want to feel like they made the PERFECT choice. Our AI tone should shift from "here are options" to "here's THE pick, and here's why it's perfect for you."

---

### 4. Rahul — The Budget Backpacker (Solo, $30-50/day)
**Who:** 22, college student or early career. Travels to explore, not relax. Hostel beds, street food, overnight buses.
**How he plans today:**
- Hostelworld for accommodation
- Rome2Rio for transport
- Google Maps saved places from Reddit/YouTube recommendations
- Budget spreadsheet tracking every rupee
- Asks in r/solotravel and r/backpacking for route advice
- Plans change daily based on who he meets at hostels

**What he actually wants:**
- "Show me the cheapest way to do this without missing the highlights"
- Flexible itinerary — not locked into rigid schedule
- Real costs, not tourist prices
- Hidden gems that aren't on TripAdvisor
- "If I only have 3 days in Bangkok, what are the non-negotiables?"
- Transport between cities (overnight bus saves a hotel night)

**His journey through Drift:**
```
/login → /vibes → [adventure, solo, culture] → budget slider minimum → "budget"
→ /destinations → Bangkok (but he already knows where he's going)
→ board generates... with hotels, restaurants he can't afford

→ "I'm staying at a hostel, not a hotel. Where do I eat for $3?"
→ Chat: catalog has mid-range restaurants. No hostels. No $3 street food.
→ "What about overnight train to Chiang Mai?"
→ Chat: no inter-city transport. Only flights.
```

**Where Drift breaks for Rahul:**

| Step | Gap | Severity |
|------|-----|----------|
| Budget tier | "Budget" = cheapest hotels in catalog ($25-65/night). His budget is $5-15 hostels. | Critical |
| Accommodation | No hostels in catalog. Pipeline searches hotels only. | Critical |
| Food | Catalog restaurants are sit-down places ($10-30). He eats $1-3 street food. | High |
| Transport | Only flights. No buses, trains, ferries, tuk-tuks between cities. | High |
| Flexibility | Board is rigid 5-day structure. He wants "if I have 3 days" or "if I have 7 days" flexibility. | Medium |
| Multi-city | Going Bangkok → Chiang Mai → Pai. Drift does single-city only. | High |
| Social | "Where do backpackers hang out?" — no hostel bar/social scene data. | Low |
| Already knows destination | Forced through vibes → destinations flow even if he knows exactly where he's going. | Medium |
| Real-time prices | "Is $5 reasonable for a tuk-tuk?" — no local price context. | Medium |

**Verdict:** Drift is currently **not built for backpackers**. Our catalog is mid-to-luxury focused. Backpacker support requires: hostels in pipeline, street food data, inter-city transport, flexible duration. **This is a different product segment** — consider whether to pursue it or focus on mid-luxury travelers.

**Decision:** Focus on Personas 1, 3, 5 for launch. Backpackers are high volume but low monetization. Come back post-revenue.

---

### 5. The Sharma Family — Multi-Gen Family Trip (Parents + Kids + Grandparents)
**Who:** Dad (45), Mom (42), Kids (12, 8), Grandma (68). Annual family vacation.
**How they plan today:**
- Dad does research, Mom vetoes
- Kids want waterpark, grandma wants temples, parents want relaxation
- MakeMyTrip or a travel agent for the package deal
- Priority: everyone is comfortable, no one walks too much, kids are entertained
- Budget: generous but value-conscious ($200-400/day total)

**What they actually want:**
- "Something for everyone" — can't be only temples OR only beaches
- Kid-friendly filters: pool, activities for children
- Accessibility: grandma can't climb 200 stairs to a viewpoint
- Meal planning that works for picky kids + dietary restrictions
- Not too much walking between activities
- "We need a break after lunch — kids nap, grandma rests"

**Their journey through Drift:**
```
/login → /vibes → Dad selects [beach, culture, foodie] → travelers: 5
→ no way to indicate ages, kids, elderly, accessibility needs
→ /destinations → Bangkok suggested
→ board generates... activities include nightlife clubs, rooftop bars
→ "This doesn't work for my 8-year-old"
```

**Where Drift breaks for the Sharmas:**

| Step | Gap | Severity |
|------|-----|----------|
| Traveler profiles | Just a number. No ages, no kid/elderly indicators. | High |
| Accessibility | No wheelchair/elderly/limited mobility filtering. | Medium |
| Kid-friendly | No family/kid vibe. No "is this suitable for children?" metadata. | High |
| Pacing | Board is packed. No concept of "rest periods" or "naptime." | Medium |
| Mixed interests | Can't serve grandma temples AND kids waterpark in same trip. | High |
| Meal preferences | No dietary restrictions, no "kid menu available" data. | Medium |
| Vibes mismatch | Available vibes don't include "family" — forced to pick from solo/couple-oriented options. | High |
| Safety | "Is this area safe for kids at night?" — no safety data. | Low |
| Logistics | "Hotel needs connecting rooms" or "family suite" — not in our hotel data model. | Medium |

**Key insight:** Family trips need a **"family" vibe** and **traveler profiles** (not just count). Adding `family` to the vibe list + basic age/accessibility inputs would unlock this entire segment with minimal product change.

**Quick win:** Add "family" to VIBES list. Tag existing catalog items with `family_friendly: boolean`. Filter board by family-safe items when family vibe is selected.

---

### 6. Vikram — The Spontaneous Weekender (Impulsive, 2-3 Day Trips)
**Who:** 30, good income, travels almost every long weekend. Decides Thursday, leaves Friday.
**How he plans today:**
- Skyscanner "Explore" for cheap flights from his city this weekend
- Books flight first, plans later
- Google "best things to do in X in 2 days"
- Doesn't plan much — walks around, finds stuff
- Budget: doesn't track closely, mid-range

**What he actually wants:**
- "I'm free this weekend. Where should I go?"
- Speed: don't make me fill forms. Give me a trip in 30 seconds.
- Short trips: 2-3 day itineraries, not 7-day deep dives
- Flight-first: show me where I can fly cheap this weekend, THEN build the trip
- No research: just show up and follow the plan

**His journey through Drift:**
```
→ opens Drift on Thursday evening
→ /vibes → ugh, I have to pick vibes? And dates? And budget?
→ just wants to click "Surprise Me" and get a trip
→ ... "Surprise Me" button on landing page exists but goes to /vibes?surprise=random
→ still has to fill dates, origin, budget
→ friction. Leaves. Opens Skyscanner instead.
```

**Where Drift breaks for Vikram:**

| Step | Gap | Severity |
|------|-----|----------|
| Entry point | Too much upfront input required. Vibes + budget + dates + origin before seeing anything. | Critical |
| Surprise Me | Button exists but still requires all inputs. Not actually "surprise." | High |
| Short trips | Templates are 5-day. No 2-day or weekend templates. | High |
| Flight-first | Can't say "show me cheap flights from Delhi this weekend, then build a trip." | High |
| Speed | Vibes → Destinations → Loading → Board is 4 screens + wait. Vikram wants 1 screen. | High |
| Spontaneity | No "tonight" or "tomorrow" options. Date picker assumes advance planning. | Medium |
| Re-use | Doesn't save preferences. Every visit starts from scratch. | Medium |

**Key insight:** Vikram's flow should be: **Landing → "Surprise Me" → One screen with destination + 2-day board. Under 10 seconds.** This requires:
1. Default vibes from past behavior (or popular picks)
2. Real-time flight search for cheapest weekend destinations from user's city
3. Pre-built 2-3 day mini-templates
4. Skip the vibes/destinations screens entirely

---

## Cross-Persona Gap Summary

### Critical Gaps (blocks core experience)

| Gap | Personas Affected | Fix Complexity |
|-----|-------------------|----------------|
| **Chat tools don't execute** | All 6 | Medium — Phase 3 of AI architecture |
| **Same board for all users at same budget** | 1, 3, 5 | Medium — Vibe-filtered item selection |
| **Budget slider mapping is wrong** | 1, 4, 5 | Easy — Per-person per-day calculation |
| **No "why this matches you" on destinations** | 1, 3, 6 | Easy — Show vibe overlap breakdown |
| **Share page is view-only** | 2, 3 | Medium — Add reactions/voting |

### High-Impact Quick Wins (< 1 day each)

| Fix | Impact |
|-----|--------|
| Add "family" and "wellness" to VIBES list | Unlocks Persona 5 |
| Show vibe match breakdown on destination cards | Builds trust for Persona 1, 3 |
| Fix budget: per-person per-day math, show in UI | Fixes budget mismatch for all |
| Vibe-rank alternatives in templateToItineraryItems | Personalization for all |
| Add occasion field (honeymoon, birthday, anniversary) | Unlocks Persona 3 tone shift |
| "I already know where I'm going" skip button on destinations | Fixes Persona 4, 6 frustration |
| 2-3 day short trip template option | Unlocks Persona 6 |

### Deferred (Post-Fundraise)

| Feature | Persona |
|---------|---------|
| Group trips (multi-user, voting, split) | 2 |
| Hostel + street food tier | 4 |
| Multi-city routing | 4, 6 |
| Traveler profiles (ages, accessibility) | 5 |
| "Surprise Me" one-click flow | 6 |
| Cross-trip preference learning | All |

---

## Pain Points from Community Research

*Sources: Reddit (via Google), Quora, Medium, Rick Steves Forums, AFAR, Travellerspoint, HN, travel blogs*

### The Numbers

- Average traveler visits **28 websites across 76 sessions over 53 days** to plan one trip ([Medium/XOKind](https://medium.com/xokind/the-opportunities-and-pain-points-in-travel-d2c5cc06ae1a))
- **44% worry about overspending**, 51% pick destinations based on price ([Go City Survey](https://gocity.com/en/blog/trip-planning-consumer-habits-usa))
- OpenAI's most advanced model achieves only **10% success rate** on complex travel planning benchmarks ([AFAR](https://www.afar.com/magazine/the-most-common-mistakes-ai-makes-when-planning-travel))
- AI-generated itineraries look polished but are **frequently incomplete or not tailored to real-world logistics** ([TravelPulse](https://www.travelpulse.com/news/agents/what-travel-advisors-should-be-prepared-for-in-2026))

### Pain Point 1: "Paradox of Choice" / Decision Fatigue

- Too many options on Booking.com, TripAdvisor — "tab explosion" across 28+ sites
- "I spend more time planning than enjoying"
- Want curated, opinionated recommendations — not 500 hotels
- Even organized travelers creating shared docs still need to gather + synthesize from disparate sources
- **Drift's answer:** Curated 4 destinations, opinionated picks with "why this matches you"

### Pain Point 2: "The Google Sheets Phase"

- Everyone makes a spreadsheet — it's the universal planning tool
- Spreadsheets don't sync, don't have images, don't update prices
- "I wish my spreadsheet could just book everything"
- Booking management and planning are separate — TripIt for bookings, Wanderlog for itinerary, Splitwise for costs
- **Drift's answer:** Board UI with real images, prices, drag/swap — replaces the spreadsheet

### Pain Point 3: "My Friend's Itinerary But For Me"

- Most common planning method: copy a friend's trip or a blog itinerary
- Problem: friend's budget/vibes/dates don't match yours
- "I want someone else's itinerary but customized for me" ← **THIS IS DRIFT**
- English-language sources give generic itineraries; local blogs (often in other languages) have the real gems
- **Drift's answer:** Catalog templates (curated like a friend's trip) + vibe/budget personalization

### Pain Point 4: "Shows Me Everything, Helps Me Pick Nothing"

- Aggregators show results, not recommendations
- No "this is the best hotel FOR YOU" — just cheapest/highest-rated
- Rating inflation: everything is 8.5+ on Booking
- Misleading descriptions: "beachfront" hotels miles from water, "small group tours" with 30 people
- **Drift's answer:** Opinionated AI with honest_take — "THIS hotel, because..." with real review synthesis

### Pain Point 5: "Group Chat Planning Hell"

- #1 complaint for group trips — "endless email chains, conflicting opinions, and 'who owes what?'"
- 200 messages, no decisions. Analysis paralysis when 8 friends pick between 15 destinations
- One person does all the work, others just veto
- Mismatched budgets tear plans apart; different vacation styles cause friction
- Planning apps "don't fix personality conflicts, diverging energy levels, or the fundamental challenge of coordinating people with different vacation styles"
- **Drift's answer (future):** Share page + voting + budget-per-person visibility. One person builds, others react.

### Pain Point 6: "AI Told Me to Visit a Closed Museum"

This is the #1 complaint about AI travel planners specifically:

- **Logistics blindness:** AI sends travelers across opposite sides of cities, suggests "short walks" to restaurants miles away ([Rick Steves Forum](https://community.ricksteves.com/travel-forum/tech-tips/the-perils-of-using-ai-for-travel-planning))
- **Outdated info:** Recommends Wednesday at The Met (closed), Greek island-hopping in November (ferries don't run) ([AFAR](https://www.afar.com/magazine/the-most-common-mistakes-ai-makes-when-planning-travel))
- **Unrealistic pacing:** 3 museums in 4 hours, no time for meals/rest/transit
- **Hallucinations:** Invents restaurants/sites that don't exist. One couple couldn't board their flight due to wrong visa info from ChatGPT ([HuffPost](https://www.huffpost.com/entry/chatgpt-travel-plans-itinerary-trip_l_687107c9e4b00de383c0cf1f))
- **No personalization:** Defaults to "top-rated" not "right for you" — "travel is so personal, and AI falls short" ([Substack/MindHoliday](https://mindholiday.substack.com/p/why-ai-cant-plan-your-dream-trip))
- **Drift's answer:** Catalog-first architecture is our **core differentiator**. Real places, real prices, real photos, real reviews — pre-verified by pipeline. AI reasons about catalog data, doesn't hallucinate it.

### Pain Point 7: "Everything Changes After I Book"

- Restaurant closes, activity cancelled, flight delayed
- No dynamic updating of itinerary
- "I wish my plan updated itself"
- No app handles the gap between "plan made" and "trip happening"
- **Drift's answer (future):** Re-run pipeline periodically, flag stale data, push notifications for changes

### Pain Point 8: "Booking Management vs. Planning Are Two Different Apps"

- Reddit community consensus: planning apps ≠ booking tools
- You need TripIt for flight alerts + email import, Wanderlog for itinerary, Splitwise for costs
- No single app does plan → book → manage
- Users want automatic email import of bookings + real-time flight alerts alongside the plan
- **Drift's answer (partial):** Booking deep links bridge the gap. Full booking management is post-fundraise.

---

## How Each Pain Point Maps to Drift

| Pain Point | Our Answer | Status | Competitive Edge |
|-----------|-----------|--------|-----------------|
| 1. Decision fatigue / tab explosion | Curated 4 destinations, opinionated picks with "why" | Working (needs vibe-weighted scoring) | Strong — most apps still show 500 results |
| 2. Google Sheets phase | Board UI with real images, prices, drag/swap | Working | Strong — visual > spreadsheet |
| 3. "Friend's itinerary for me" | Catalog templates + vibe/budget personalization | Partial (vibes don't filter items yet) | **Core value prop** — this IS Drift |
| 4. Shows everything, picks nothing | Opinionated AI: "THIS hotel, because..." | Working (needs tool execution) | Strong — no aggregator does this |
| 5. Group planning hell | Share page + voting | View-only (needs voting) | Weak — deferred to post-fundraise |
| 6. AI hallucination / trust deficit | Catalog-first: real data, source badges | **Core strength** — needs "verified" UI | **Moat** — 90% of AI planners fail here |
| 7. Post-booking changes | Not addressed yet | Future | Weak — everyone struggles here |
| 8. Plan ≠ Book ≠ Manage | Booking deep links bridge the gap | Partial (Amadeus + Skyscanner links) | Medium — deep links > no links |

### What This Tells Us for Fundraising

**Our strongest story is Pain Points 3 + 6:** "Everyone wants a friend's curated trip customized for them, but AI planners hallucinate 90% of the time. Drift solves both — pre-verified catalog data (no hallucinations) personalized by your vibes (not generic top-10 lists)."

**The 53-days-across-28-websites stat** is our opening line: "Planning a trip takes 53 days across 28 websites. Drift does it in 30 seconds."

**Pain Point 5 (group trips)** is the biggest unaddressed market but also the hardest to build. Smart to defer — but mention it as roadmap to show TAM expansion.

---

## The Ideal End-to-End Flow (No Gaps)

### For Priya (primary persona):

```
1. ENTRY
   Landing page → "Plan a Trip" button → /vibes

2. VIBES (30 seconds)
   Pick 2-3 vibes from visual cards
   Budget: per-person per-day slider with city-specific context
     "$80/day in Bangkok = great mid-range experience"
   Travelers: 2 (couple)
   Dates: April 10-17
   Origin: Bangalore
   Optional: occasion? [none, honeymoon, birthday, anniversary, friends trip]
   Optional: "I already know where — skip to destination" → direct to board

3. DESTINATIONS (10 seconds)
   4 cards with:
   - City, country, cover image
   - Match breakdown: "92% match — foodie ●●●, romance ●●○, city ●●●"
   - Price: "$110/day for 2 people"
   - 3 highlight tags
   - "Why Drift picked this" — 1 sentence (from AI or catalog description)
   Source badge: "Verified ✓ — real prices, 2,400 reviews analyzed"

4. BOARD GENERATION (3-5 seconds for catalog, 10-15 for LLM)
   Loading: progressive messages ("Finding the best stays...", "Matching restaurants to your foodie vibe...")

   Board loads with:
   - Items SORTED by vibe match (foodie restaurants first for foodie user)
   - Alternatives RANKED by vibe match
   - AI reason on each card: "Perfect for your foodie vibe — 4.8★, must-try pad thai"
   - Trust badges: "Based on 1,200 reviews" / "Verified price"
   - Cost bar: per-person breakdown

5. INTERACT (ongoing)
   Pick/skip/save items → preferences tracked silently

   Chat: "Is this hotel actually good?"
   → AI: Uses search_catalog tool → returns honest_take with real review data
   → "4.8★ across 2,300 reviews. People love the rooftop pool and river views.
      Common complaint: breakfast buffet is average. → Skip hotel breakfast,
      grab pad thai at Thipsamai (5 min walk, already on your Day 2)."

   Chat: "Show me something more romantic"
   → AI: Uses search_catalog with vibe filter → returns romance-tagged alternatives
   → Shows 3 hotels inline with images, prices, swap buttons
   → User clicks "Swap" → board updates instantly

   Chat: "This is too expensive"
   → AI: Calculates total, shows breakdown
   → "Your trip is $2,400 total ($170/day). Want me to find budget swaps?
      I can save ~$500 by switching hotel + 2 dinners."
   → Uses adjust_budget tool → shows before/after comparison

6. FINALIZE
   All items picked → "Your trip is ready"
   → Booking deep links for each item (hotel → Booking.com, flight → Skyscanner)
   → Share link → partner can view + react
   → Export to Google Calendar / Apple Calendar
   → "Trip starts in 14 days" reminder

7. POST-TRIP (future)
   → "How was Bangkok?" → rate items
   → Preferences updated for next trip
   → "Based on your Bangkok trip, you might love Chiang Mai next"
```

### Gap Closure Checklist

| Step | Current Status | Needed Change | Phase |
|------|---------------|---------------|-------|
| Budget per-person per-day | Missing | Fix vibes page slider + generate route | Phase 1 |
| Vibe match breakdown on cards | Missing | Add to destinations page | Phase 1 |
| "Why Drift picked this" | Missing | Add description/reason to destination cards | Phase 1 |
| Source/trust badge | Missing | Add "Verified" badge when from_catalog=true | Phase 1 |
| Vibe-sorted board items | Missing | Score items by vibe in templateToItineraryItems | Phase 1 |
| Vibe-ranked alternatives | Missing | Sort alts by vibe overlap | Phase 1 |
| Chat tool execution | Broken | AI architecture Phase 3 | Phase 3 |
| Inline swap from chat | Broken | AI architecture Phase 4 | Phase 4 |
| Occasion awareness | Missing | Add occasion field, adjust system prompt | Phase 2 |
| Share page voting | Missing | Add pick/skip for shared viewers | Phase 2 |
| Budget comparison tool | Missing | AI tool: adjust_budget | Phase 5 |
| Booking deep links | Partial | Amadeus links exist, need Booking.com/Google Maps | Phase 2 |
| Calendar export | Missing | Generate .ics file from trip data | Phase 2 |
