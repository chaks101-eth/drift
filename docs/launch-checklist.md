# Drift — Launch Checklist

## Tech Infrastructure (Done)

### SEO
- [x] `public/robots.txt` — blocks `/admin`, `/api/`, exposes sitemap URL
- [x] `public/sitemap.xml` — landing + login pages indexed
- [x] OG meta tags in `src/app/layout.tsx` — Open Graph (title, description, image, site name), Twitter card (summary_large_image)
- [x] `metadataBase` set to `https://drift.travel`

### PWA
- [x] `public/manifest.json` — app name, dark theme (#08080c), standalone display, icon refs
- [x] Manifest + apple-touch-icon links in `public/mobile.html` head
- [x] `theme-color` meta tag via Next.js `viewport` export

### Analytics
- [x] `src/app/analytics.tsx` — Google Analytics component, loads only when `NEXT_PUBLIC_GA_ID` env var is set
- [x] GA script in `public/mobile.html` (same env-var pattern)
- [x] Event tracking on key funnel actions:
  - `login_attempt` (auth / signin or signup)
  - `vibes_selected` (onboarding / comma-separated vibe names)
  - `trip_generate` (conversion / destination name)
  - `url_extract` (conversion / URL)
  - `url_trip_generate` (conversion / destination)
  - `trip_created` (conversion / destination)
  - `chat_opened` (engagement / destination)

### Error Monitoring
- [x] Global `window.onerror` + `unhandledrejection` handlers in `mobile.html`
- [x] `POST /api/log-error` endpoint — logs client errors server-side (message, source, line, col, stack trace, user agent, timestamp)
- [ ] Forward to Sentry/Datadog in production (currently logs to stdout)

### Auth
- [x] Email/password (Supabase Auth)
- [x] Google OAuth (callback at `/api/auth/callback`)
- [x] Password reset — `doForgotPassword()` sends Supabase reset email
- [x] Password reset callback — `PASSWORD_RECOVERY` event handler shows `s-reset` screen, `doResetPassword()` calls `updateUser()`
- [x] Loading states on all auth buttons (login, reset)

### Rate Limiting
- [x] In-memory rate limiter (`src/lib/rate-limit.ts`) — 60 req/min default, 20 req/min for `/api/ai/generate`
- [ ] Move to Redis/Upstash when scaling beyond single instance

---

## Assets Needed Before Deploy

| Asset | Spec | Location |
|-------|------|----------|
| OG image | 1200×630px, dark bg, "Drift" branding + tagline | `public/og-image.png` |
| PWA icon (small) | 192×192px, transparent PNG, Drift logo | `public/icon-192.png` |
| PWA icon (large) | 512×512px, transparent PNG, Drift logo | `public/icon-512.png` |
| Favicon | 32×32 or multi-size ICO | `public/favicon.ico` |

---

## Env Vars to Set

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (admin ops) | Yes |
| `GEMINI_API_KEY` | Gemini 2.5 Flash (primary LLM) | Yes |
| `GROQ_API_KEY` | Groq Llama 3.3 (fallback LLM) | Yes |
| `AMADEUS_API_KEY` | Amadeus flight search | Yes |
| `AMADEUS_API_SECRET` | Amadeus secret | Yes |
| `SERPAPI_KEY` | SerpAPI (Google Maps data) | Yes |
| `ADMIN_SECRET` | Password for `/admin` dashboard | Yes |
| `NEXT_PUBLIC_GA_ID` | Google Analytics (e.g. `G-XXXXXXXXXX`) | No — analytics disabled if blank |

---

## API Quota Limits

| Service | Free Tier | Ceiling | Upgrade Trigger |
|---------|-----------|---------|----------------|
| Gemini 2.5 Flash | 1,500 req/day | ~150 trip generations/day | 100+ daily users |
| Groq (Llama 3.3) | 100K tokens/day | Fallback only | N/A |
| SerpAPI | 250 searches/month | ~50 full pipeline runs | Catalog growth |
| Amadeus (test) | Unlimited (test data) | Capped flights | Move to production keys |

---

## UX Fixes Completed (Pre-Launch Polish)

1. Board date formatting (ISO → human readable)
2. Currency detection (hardcoded $ → locale-aware via `formatBudgetCurrency()`)
3. Board header trailing comma fix (null country)
4. Auth state change race condition (operator precedence)
5. Error toast red border (was gold for all toasts)
6. `font-display:swap` on Google Fonts
7. Password show/hide toggle on login
8. Budget selector in URL extract flow
9. Chat input → textarea (multiline support)
10. Detail sheet stat label size (6px → 8px)
11. Origin back button (hardcoded login → hero)
12. Origin chip selected state persistence
13. Chat suggestion chips hide after first message
14. Trips list force-refresh on revisit
15. Vibes auto-advance → "Find destinations" confirmation button
16. Button loading states (extract, generate, vibes continue)
17. Empty day label fallback (Day 1 with no theme → uses detail or "Day N")
18. Dead code removal (checkUrlInput, pasteFromClipboard)

---

## Remaining Work (Post-Launch)

### Growth
- [ ] Email collection on landing page (waitlist/newsletter)
- [ ] Email onboarding sequence (Day 0/2/5/14)
- [ ] Auto-generated destination SEO pages (`/explore/bali`)
- [ ] Blog / content strategy
- [ ] Social sharing OG images (per-trip generated cards)
- [ ] Referral incentives

### Product
- [ ] Drag-to-reorder on board
- [ ] Group coordination / multi-traveler
- [ ] Booking integration (affiliate links)
- [ ] Offline / export PDF
- [ ] Demo mode (guest trip without login)

### Infrastructure
- [ ] Sentry integration (replace stdout error logging)
- [ ] Redis rate limiting (for multi-instance)
- [ ] Image proxy / CDN (avoid hotlinking at scale)
- [ ] Stripe / payment setup
