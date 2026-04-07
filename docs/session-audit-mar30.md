# Drift — Session Audit (Mar 26-30, 2026)

> Full record of everything built, fixed, and configured across sessions.
> Use this as context for the next session.

---

## Systems Built

### 1. Eval System
- **7-dimension scoring**: placeValidity(20%), vibeMatch(15%), landmarkCoverage(15%), vibeMustHaves(20%), priceRealism(10%), dayBalance(10%), ratingQuality(10%)
- **Batch evals**: run 20+ trips at once, persist to `eval_results` DB table
- **Multi-LLM benchmark**: Drift vs raw LLM with delta scoring
- **LLM-as-judge**: qualitative analysis (6 dims)
- **Pattern analyzer**: detects systemic weaknesses
- **Place cache**: Google Places verification cached 30 days in `eval_place_cache`
- **Results**: 24 evals, avg 81/100, placeValidity 100/100 (zero hallucinations)
- **Admin**: `/admin/eval` (4 tabs: Eval, Benchmark, History, Analysis)
- **DB tables**: eval_runs, eval_results, eval_place_cache
- **Files**: `src/lib/eval/` (scorer.ts, judge.ts, analyzer.ts, benchmark.ts, place-cache.ts, types.ts)

### 2. Agent System (22 agents, 5 teams)
| Team | Agents | Files |
|------|--------|-------|
| Chief | chief | `.claude/agents/chief.md` |
| Quality | eval-runner, eval-runner-judge, pattern-analyzer, prompt-tuner, quality-orchestrator, trip-validator | `.claude/agents/quality/agents/` |
| Generation | generation-evaluator, generation-evaluator-judge, generation-orchestrator, must-see-enforcer, rating-enricher | `.claude/agents/generation/agents/` |
| Growth | growth-chief, content-creator, content-judge, social-distributor, email-campaigner, seo-optimizer, analytics-reporter | `.claude/agents/growth/agents/` |
| AI Service | ai-service-chief, gemini-prompt-engineer, prompt-tester | `.claude/agents/ai-service/agents/` |

- **Local execution server**: `agent-server/server.ts` (port 3100, spawns Claude CLI)
- **Start**: `npm run agents`
- **Execution persistence**: stored in Supabase `agent_executions`
- **Admin**: `/admin/agents` (agent browser, execute, live output streaming, history)
- **DB tables**: agent_registry, agent_executions, agent_memory

### 3. Growth Engine
- **DB tables**: growth_content, growth_posts, growth_metrics, growth_learnings, growth_runs
- **API routes**: `/api/growth/` (generate, content, post, video, email, metrics, learn, cron)
- **Instagram**: Meta Graph API wired, first carousel posted
  - Account ID: `17841440645189096`
  - Token expires: ~May 24, 2026
  - App ID: `1440107017854457`
- **Video pipeline**: Kling V2-5-Turbo ($0.21/clip) + ElevenLabs voiceover + Remotion
  - First reel rendered: Colombo & Galle (5 clips, voiceover, 21s)
  - Files: `src/lib/video-pipeline.ts`, `scripts/generate-reel.ts`, `src/remotion/`
- **Reddit**: API application submitted, pending approval
- **Admin**: `/admin/growth` (7 tabs)

### 4. Analytics Dashboard
- **Route**: `/api/admin/analytics` — 20 parallel Supabase queries
- **Page**: `/admin/analytics`
- **Metrics**: real vs anon users, conversion rate, WoW growth, eval scores, chat rate
- **Charts**: 30-day sparkline, destination bars, quality by destination, vibe tags, budget split
- **Splits**: anonymous vs real user tracking (uses Supabase auth admin API `is_anonymous` flag)

### 5. Guest Mode + Google OAuth
- **Anonymous auth**: `signInAnonymously()` in `src/app/m/layout.tsx`
- **Auth walls removed**: all 6 plan pages (origin, dates, budget, vibes, destinations, destination-input)
- **Google OAuth**: `supabase.auth.signInWithOAuth({ provider: 'google' })` on login page
- **Identity linking**: `linkIdentity()` for anon→Google upgrade (preserves trips)
- **Soft auth prompt**: dismissible banner on BoardView
- **Auth callback**: `src/app/api/auth/callback/route.ts` (uses x-forwarded-host for Railway)
- **Bottom nav**: Trips/Profile redirect anon users to login
- **Supabase config**: anonymous sign-ins ON, Google provider ON
- **Google Cloud**: OAuth client `90115604257-up0cdfjfj6mc8pchpqdt2vra0qla2blq.apps.googleusercontent.com`
- **Supabase URL config**: Site URL = `https://www.driftntravel.com`, Redirect URL = `https://www.driftntravel.com/api/auth/callback`

### 6. Generation Prompt (3-step pipeline)
- **Step 0**: Lock must-sees (3-5 non-negotiable experiences via Gemini)
- **Step 1**: Outline with LOCKED items, arrival/departure awareness, mandatory food, geographic clustering
- **Step 2**: Parallel day generation with transit rules, timing, anti-filler
- **maxDuration**: 120s (was 60s)
- **Files**: `src/lib/ai-agent.ts` (generateItinerary function), `src/lib/ai-prompts.ts`

### 7. Calendar Export
- **Route**: `GET /api/trips/[id]/calendar` — returns ICS file
- **Button**: calendar icon in BoardView header
- **Features**: category icons, location from metadata, all-day hotel events

---

## UX Audit — 80 Issues

- **Doc**: `docs/ux-audit-full.md`
- **Fixed**: 55+
- **Remaining**: ~25 (mostly P2/P3 polish)

### Key Fixes Done
| Area | What |
|------|------|
| Currency | Hotel card uses formatBudget() — consistent INR/USD across board |
| Price parsing | `src/lib/parse-price.ts` — handles ranges, commas, Free |
| Origin | Google Places autocomplete with validation warning |
| Loading page | Retry button, user-friendly errors, generation_failed tracking |
| Ratings | ItemCard shows ★4.8 (2.3K), DetailSheet shows rating stat |
| Source badges | "Verified" for catalog/grounded, "AI" for LLM-only |
| Detail sheet | Swipe-to-dismiss, browser back closes overlay, 44px close button |
| Hotel | Same ItemCard as activities, shows nights + total in detail line |
| Day pills | Sticky on scroll (top-0 z-30 backdrop-blur) |
| Travel markers | Gold (#c8a44e) instead of invisible white |
| Chat | Textarea max-h-[100px], history capped at 50 messages |
| Empty trip | Shows "Trip is empty" with chat CTA |
| Budget warning | Only shows when OVER budget |
| Multi-tap | GoldButton auto-disables 3s after click, hero shows spinner |
| Trips tab | Scrollable, click loads trip + switches tab |

---

## API Keys Configured

| Service | Key Location | Status |
|---------|-------------|--------|
| Gemini 2.5 Flash | .env.local GEMINI_API_KEY | Active (Tier 1, 2000 RPM) |
| Groq | .env.local GROQ_API_KEY | Active (fallback) |
| Google Places | .env.local GOOGLE_PLACES_API_KEY | Active |
| SerpAPI | .env.local SERPAPI_KEY | Exhausted (needs $50 plan) |
| Amadeus | .env.local AMADEUS_API_KEY | Active (test env) |
| ElevenLabs | .env.local ELEVENLABS_API_KEY | Active |
| Kling AI | .env.local KLING_ACCESS_KEY + KLING_SECRET_KEY | Active |
| Meta/Instagram | .env.local META_ACCESS_TOKEN + INSTAGRAM_ACCOUNT_ID | Active (token expires May 24) |
| Sentry | .env.local NEXT_PUBLIC_SENTRY_DSN | Active |
| GA4 | .env.local NEXT_PUBLIC_GA_ID (G-PXYBWQ53L9) | Active |
| Google OAuth | Supabase dashboard (not in .env.local) | Active |

---

## Current Numbers (Mar 30)

| Metric | Value |
|--------|-------|
| Real users (signed up) | 24 |
| Anonymous guests | 15 |
| Total trips | 196 |
| Trips last 7 days | 105 |
| Unique destinations | 58 |
| Google OAuth signups | 3 |
| Avg eval score | 81/100 |
| Place validity | 100/100 |

---

## Known Bugs / Open Issues

### CRITICAL — React Hooks Error #300
- **Error**: "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
- **Cause**: `if (!token) return null` placed before hooks in some component
- **Status**: Fixed in 6 plan pages (commit `4c63e35`) and URL page (commit `16b5f95`), but may exist in another file
- **Fix pattern**: Move `return null` AFTER all hooks, BEFORE the JSX return
- **How to find**: Search for `return null` in all components under `src/app/m/` and `src/components/mobile/` — ensure no `return null` appears before any `useState`, `useEffect`, `useMemo`, `useCallback`, or `useRef`

### MEDIUM — Anonymous trip migration
- `linkIdentity()` added but not fully tested
- If it fails, falls back to `signInWithOAuth()` which creates new user (orphans anon trips)
- Trips created by anon user may not transfer to Google account

### LOW — Remaining UX audit items (~25)
- See `docs/ux-audit-full.md` for full list (mostly P2/P3 polish)

---

## File Map (key files)

```
src/
├── app/
│   ├── m/                          # Mobile app
│   │   ├── page.tsx                # Hero page
│   │   ├── layout.tsx              # Auth (anonymous + session listener)
│   │   ├── login/page.tsx          # Login + Google OAuth
│   │   ├── plan/                   # Onboarding flow (6 steps)
│   │   ├── loading/page.tsx        # Generation loading screen
│   │   └── board/[id]/page.tsx     # Trip board wrapper
│   ├── api/
│   │   ├── ai/generate/route.ts    # 3-step itinerary generation
│   │   ├── ai/chat/route.ts        # Agentic chat (8 tools)
│   │   ├── ai/eval/                # Eval system (6 routes)
│   │   ├── growth/                 # Growth engine (8 routes)
│   │   ├── admin/                  # Admin APIs (analytics, trips, agents, migrations)
│   │   ├── auth/callback/route.ts  # Google OAuth callback
│   │   └── trips/[id]/calendar/    # ICS export
│   └── admin/                      # Admin dashboards
│       ├── page.tsx                # Main admin (9 tabs)
│       ├── eval/page.tsx           # Eval dashboard
│       ├── agents/page.tsx         # Agent dashboard
│       ├── growth/page.tsx         # Growth dashboard
│       └── analytics/page.tsx      # Analytics dashboard
├── components/mobile/
│   ├── BoardView.tsx               # Trip board (sticky pills, hotel cards, travel markers)
│   ├── cards/ItemCard.tsx          # Item card (ratings, source badges, alternatives)
│   ├── DetailSheet.tsx             # Item detail (swipe-to-dismiss, back button)
│   ├── ChatOverlay.tsx             # Chat (streaming, max-h textarea)
│   ├── BottomNav.tsx               # Navigation (anon redirect for Trips/Profile)
│   ├── GoldButton.tsx              # CTA button (auto-disable on tap)
│   └── tabs/TripsTab.tsx           # Past trips list (scrollable, card UI)
├── lib/
│   ├── ai-agent.ts                 # Generation engine (3-step pipeline)
│   ├── ai-prompts.ts               # All LLM prompts (chat, generation, destination, URL)
│   ├── parse-price.ts              # Price parser (handles ranges, commas)
│   ├── currency.ts                 # Currency detection + formatting
│   ├── video-pipeline.ts           # Kling + ElevenLabs + Remotion
│   └── eval/                       # Eval system (scorer, judge, analyzer, benchmark)
├── stores/
│   ├── trip-store.ts               # Auth, trip data, chat, onboarding (isAnonymous flag)
│   └── ui-store.ts                 # Overlays, tabs, toast (authPromptDismissed flag)
└── remotion/                       # Video composition templates

agent-server/
└── server.ts                       # Local Claude CLI execution server (port 3100)

.claude/agents/                     # Agent definitions (22 agents, 5 teams)
supabase/migrations/                # DB migrations (001-006)
docs/
├── ux-audit-full.md                # 80-issue audit with checkboxes
├── growth-engine.md                # Growth engine spec
└── session-audit-mar30.md          # THIS FILE
```

---

## Next Priorities

1. **Fix React hooks error #300** — find remaining early returns before hooks
2. **Test Google OAuth end-to-end** on production after hooks fix
3. **Multi-city trips** — biggest feature gap (Bangkok + Chiang Mai + Phuket)
4. **Gemini prompt tuning** — use the gemini-prompt-engineer agent to optimize prompts per Google's best practices
5. **Get to 100 real users** — guest mode + Instagram reels + Reddit (when approved)
6. **Affiliate links** — once at ~500 trips, apply for Booking.com/Viator affiliate programs
