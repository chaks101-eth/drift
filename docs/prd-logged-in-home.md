# PRD: Drift Logged-In Home (`/trips`)

## Status
In progress. Current version is functional but needs design polish and mobile parity.

## What Exists Right Now (as of Apr 16, 2026)

### Code State
- `/trips` page rewritten with floating orbital design
- Active trip as "sun" with orbital rings
- Recent trips as floating planet orbs with colored glows
- Two launch paths (Compose + Build from reel) as breathing orbs
- Trending section with public trips as distant galaxies
- Starfield + aurora + noise grain + cursor parallax
- rAF-driven floating animations (sine wave per element)
- Typecheck passes, not deployed

### What's NOT done
- Mobile version (no floating orbs on mobile — needs a different layout)
- "View all trips" page (`/trips/all`) for users with 50+ trips — referenced but doesn't exist
- Search/filter for all trips
- Delete trip from this page (removed during rewrite)
- Trip status indicators (planning vs booked vs completed)
- Creator names on trending trips (API returns user_id but not name)

---

## Design Intent

The logged-in home should feel like opening a **personal universe**. Not a dashboard, not a list. A space where your trips exist as celestial bodies and you're floating through them.

### Design Language (consistent with landing page)
- Dark space: `#050509` background
- Gold accents: `#c8a44e` for active elements
- Starfield + aurora blobs + noise grain
- Cursor parallax (whole page shifts ±8px following mouse)
- Floating elements (sine wave bob, different frequencies per element)
- Orbital rings + planet-style circular images
- Colored glow halos per trip (gold, teal, purple, pink, blue cycle)
- Font: Playfair Display serif headlines, Inter body

### Key Sections

#### 1. Welcome
- "Welcome back, {name}" in small text
- "Where will you *drift* next?" serif headline
- Both float gently (sine wave, ~4s cycle)

#### 2. Active Trip (The Sun)
- Most recent trip, center of the page
- Large card (480px) with destination photo, "Continue drifting" badge
- Orbital rings rotating around it (compass-ring CSS animation)
- Gold glow halo that intensifies on hover
- Shows: destination, country, days, dates, travelers, vibes
- Click → trip board

#### 3. Recent Trips (Your Orbits)
- Next 6 trips after the active one
- Circular planet-style photos (110px → 62px, gradually smaller)
- Each floats at different sine wave phase (offset by index × 1200ms)
- Colored glow halos cycling through GLOW_COLORS
- Hover → scale 1.1, glow intensifies, label brightens
- Below each: destination name + days + date
- "View all X trips →" link if more than 7 total

#### 4. Launch Pads
- Two orbs side by side: "Compose / From vibes" and "Build / From a reel"
- 100px circles with gold gradient border
- Core pulse animation (breathing, 6s cycle, offset per orb)
- Gold glow on hover
- SVG icons inside (spark for compose, link for build)

#### 5. Trending (Distant Galaxies)
- Public trips from other users (fetched via `/api/trips/public?limit=6`)
- Smaller orbs (60px) with colored borders
- Slower bob cycle (5000ms vs 3500ms — they're "further away")
- Heart count badge below
- Click → share page
- "Explore all →" link to `/explore`

#### 6. Empty State
- "Your universe is empty"
- "Compose your first trip. It takes 30 seconds."

---

## What Still Needs Work

### Must Fix
1. **Delete trip** — removed during rewrite, needs to come back (long-press or context menu on orbs)
2. **Mobile layout** — floating orbs don't work on small screens. Mobile should be a vertical scroll with the same sections but as cards, not floating elements. Keep the atmosphere (starfield, aurora) but use static cards.
3. **"View all trips" page** — `/trips/all` doesn't exist. Needs a searchable, filterable table for power users with many trips.
4. **Creator names on trending** — the public trips API returns `user_id` but not the creator's display name. Need to join or cache names.

### Should Fix
5. **Trip status** — differentiate "planning" (no dates set, still building) vs "upcoming" (dates in future) vs "past" (dates passed) vs "booked" (user marked as booked). Currently all trips look the same.
6. **Notification badges** — show a gold dot on trips that have new collaborator activity (new votes, notes, hearts since last visit).
7. **Performance** — rAF loop runs constantly even when the page isn't visible. Should pause on `visibilitychange`.
8. **Accessibility** — floating elements need proper focus states for keyboard nav.

### Nice to Have
9. **Constellation lines** — like the landing page orbital system, draw faint lines between trips that share vibes (e.g., all "beach" trips connected).
10. **Sound design** — subtle hover/click sounds. Premium feel.
11. **Onboarding animation** — first-time user sees their universe "form" — starts empty, then the launch pads appear with a reveal animation.

---

## API Dependencies

| Endpoint | Status | Used For |
|---|---|---|
| Supabase `trips` table | ✅ Exists | My trips (direct query) |
| `GET /api/trips/public` | ✅ Exists | Trending section |
| `GET /api/trips/all` | ❌ Needs creation | Full searchable trip list |
| Creator name lookup | ❌ Needs work | Show "by {name}" on trending |

---

## Database

### Columns needed (already added)
- `trips.is_public` BOOLEAN — toggles trip visibility on explore/trending
- `trips.trip_brief` TEXT — extracted from first day metadata for card display
- `trips.metadata` JSONB — stores group notes, ready check state

### Columns that may help
- `trips.last_viewed_at` TIMESTAMPTZ — for "new activity" badges
- `trips.status` already exists but values aren't standardized

---

## Files to Modify

| File | What |
|---|---|
| `src/app/trips/page.tsx` | Main home page (current rewrite) |
| `src/app/trips/all/page.tsx` | **NEW** — full trip list with search/filter |
| `src/app/api/trips/public/route.ts` | Add creator name to response |
| `src/components/mobile/tabs/TripsTab.tsx` | Mobile equivalent (if keeping tab-based) |
| `src/app/m/page.tsx` | Mobile home — may need similar treatment |

---

## Testing Checklist

- [ ] Active trip card renders with photo, destination, dates, vibes
- [ ] Click active trip → opens trip board
- [ ] Recent trips render as floating orbs with correct photos
- [ ] Each orb bobs independently (different sine phases)
- [ ] Hover orb → scales, glow intensifies
- [ ] Launch pads pulse and respond to hover
- [ ] Trending loads from public API
- [ ] Empty state shows when no trips exist
- [ ] Cursor parallax works (page shifts with mouse)
- [ ] Starfield + aurora visible
- [ ] "View all" link works when 7+ trips
- [ ] Page doesn't crash with 0, 1, 5, 50 trips
- [ ] Mobile: doesn't break (even if not fully designed)

---

## Current Code State

The `/trips` page has been rewritten with the orbital floating design. It typechecks but has **NOT been deployed**. The explore page, publish toggle, and login fix are also local-only.

### Uncommitted changes (ready to deploy when approved):
- `src/app/trips/page.tsx` — orbital home redesign
- `src/app/explore/page.tsx` — public trip feed
- `src/app/api/trips/public/route.ts` — public trips API
- `src/app/api/trips/[id]/publish/route.ts` — publish toggle API
- `src/app/login/page.tsx` — auth listener fix
- `src/app/NavBar.tsx` — Explore link added
- `src/components/desktop/BoardView.tsx` — Publish toggle in top bar
- `supabase/migrations/20260416_public_trips.sql` — is_public + trip_brief columns (already run)
