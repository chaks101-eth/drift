# Reddit Posts — Ready to Post

---

## Post 1: r/travel — Istanbul Trip Report

**Title:** Just did 3 days in Istanbul — here's what actually worked (and what didn't)

**Body:**
Just got back from a culture + foodie trip to Istanbul. Sharing because the advice I found online was either from 2019 or totally generic. Here's what actually worked:

**Day 1 — Sultanahmet**
- **Hagia Sophia** (free now, go at 8:30am to avoid crowds)
- **Blue Mosque** — stunning but skip on Fridays (prayer time)
- **Sultanahmet Koftecisi** for lunch (the original one, not the copycat next door). $8 for the best kofte you'll ever have
- **Basilica Cistern** — recently renovated, worth it. $15

**Day 2 — Grand Bazaar to Bosphorus**
- **Grand Bazaar** at 9am (empty, shopkeepers are friendly when not stressed)
- **Spice Bazaar** is smaller but better for actual spices/tea
- **Karakoy Lokantasi** for lunch — 4.7★ on Google, lived up to the hype
- **Bosphorus ferry** from Eminonu — $2 public ferry is better than the $40 "cruise"

**Day 3 — Asian Side**
- **Kadikoy Market** — THIS is where locals eat. Skip the Sultanahmet tourist restaurants
- **Ciya Sofrasi** — looks like a cafeteria, cooks like a Michelin kitchen. $12 for a feast
- Wandered Moda neighborhood — best sunset view of the city and no tourists

**What didn't work:**
- Istiklal Street at night — overhyped, crowded, mostly chain stores now
- Hotel breakfast buffets — save your money, go to a simit cart instead

I actually planned this using an AI tool called Drift that pulled real Google data for each place (ratings, photos, GPS). It even checked the weather and moved my outdoor stuff to the sunny days. Way better than the ChatGPT itinerary I tried first which hallucinated half the restaurant names.

Link if curious: driftntravel.com/?utm_source=reddit&utm_medium=post&utm_campaign=istanbul_trip_report

---

## Post 2: r/solotravel — Paste a travel reel, get a trip

**Title:** Found an app that watches travel reels and builds actual trips from them

**Body:**
Ok this might be a game-changer for how I plan trips. I kept saving Instagram reels of places I wanted to visit but never actually going because "planning is too much work."

Found this AI tool (Drift) where you literally paste a YouTube or Instagram reel URL and it:
1. Watches the video frame by frame
2. Identifies every specific place shown (restaurants, hotels, landmarks)
3. Builds a full day-by-day itinerary with real Google ratings and photos
4. Shows weather for your dates and schedules outdoor stuff on sunny days

I tested it with a Phuket reel and it caught places I didn't even notice — it identified a restaurant from a SIGN in the background of one shot. The itinerary it built had 17 specific places, all real and verified on Google Maps.

It's not perfect — takes about 30-40 seconds for the reel analysis and a couple minutes for the full trip. But the output quality is legit. Every place has a real photo, real rating, and a Google Maps link.

Has anyone else tried this or something similar? The reel-to-trip thing feels like what I always wanted TripAdvisor to do.

driftntravel.com/?utm_source=reddit&utm_medium=post&utm_campaign=reel_to_trip

---

## Post 3: r/digitalnomad — Tech deep-dive

**Title:** I built an AI travel planner that uses 8 Google Cloud APIs — here's what each one does

**Body:**
I've been building a travel planning tool (Drift) and wanted to share the tech stack since this sub appreciates the nerdy details.

**The APIs powering each trip:**
1. **Gemini 2.5 Flash** — watches your travel reels frame-by-frame, plans the itinerary
2. **Google Places API** — real venue photos, ratings, GPS for every item
3. **Google Weather API** — real forecast for your dates, schedules outdoor vs indoor
4. **Google Maps Static API** — dark-themed day maps with numbered pins
5. **Google Routes API** — real travel times between stops ("18 min drive, 4.2km")
6. **Google Search Grounding** — finds real places worldwide (not just pre-loaded cities)
7. **Amadeus** — real flight data with Skyscanner booking links
8. **Cobalt** — downloads Instagram/TikTok reels for video analysis

**The result:** paste a travel reel → AI watches it → builds a trip with real photos, real ratings, real weather, real travel times. Every place is verified to exist on Google Maps.

The hardest part wasn't the AI — it was making the data layer reliable. LLMs hallucinate hotel names and invent booking URLs. We had to build a post-generation enrichment step that verifies every place via Google Places API.

Happy to answer technical questions if anyone's curious about the architecture.

driftntravel.com/?utm_source=reddit&utm_medium=post&utm_campaign=tech_deepdive
