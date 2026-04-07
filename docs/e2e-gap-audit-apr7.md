# End-to-End Product Gap Audit

**Date:** April 7, 2026  
**Method:** Full codebase review of every user-facing flow, API endpoint, and component  
**Total issues found:** 48  
**Breakdown:** 7 critical, 16 high, 18 medium, 7 low

---

## How to read this document

Each issue has:
- **ID** for cross-referencing (GAP-01 through GAP-48)
- **Severity** — CRITICAL (blocks users or corrupts data), HIGH (significant UX/security gap), MEDIUM (noticeable but workaroundable), LOW (polish)
- **File** — exact source location
- **Description** — what's wrong
- **Impact** — what users experience
- **Fix direction** — how to resolve it

---

## 1. Onboarding Flow (Landing > Plan > Generation)

### GAP-01 | CRITICAL — Vibes page stuck at 2 picks

**File:** `src/app/m/plan/vibes/page.tsx:84-88`

**Description:** If a user picks only 2 vibes and runs out of mood cards, the page resets `currentIdx` to 0 and loops. There is no skip button, no "confirm with 2" option, and no indication that the deck is cycling.

**Impact:** User is trapped in an infinite loop and cannot advance to destination selection.

**Fix direction:** Add a "Continue with N vibes" button that appears once the user has picked at least 1 vibe. Alternatively, expand the mood pool so running out before 3 picks is impossible.

---

### GAP-02 | CRITICAL — Early return before hooks (origin + dates pages)

**File:** `src/app/m/plan/origin/page.tsx:82`, `src/app/m/plan/dates/page.tsx:115`

**Description:** Both pages have `if (!token) return null` before `useRef` and other hook declarations. This violates React's Rules of Hooks — hooks must be called in the same order on every render.

**Impact:** If `token` is null on any re-render, React throws "Rendered fewer hooks than expected" and the page crashes. This is the known React hooks error #300 from the memory file.

**Fix direction:** Move all hook declarations above the early return. Replace `return null` with a loading spinner rendered after all hooks.

---

### GAP-03 | HIGH — Custom destination proceeds with empty country

**File:** `src/app/m/plan/destinations/page.tsx:226-237`

**Description:** When a user types a custom destination and no country is found in `countryMap`, a toast warns "Pick a city from suggestions" but navigation to `/m/loading` is NOT blocked. The trip generates with `{ city: "CustomCity", country: "" }`.

**Impact:** Generation API receives empty country, likely producing a broken or hallucinated itinerary. User waits on loading page then hits an error.

**Fix direction:** Add `return` after the toast to block navigation when country is empty.

---

### GAP-04 | HIGH — Destinations fetch has no request cancellation

**File:** `src/app/m/plan/destinations/page.tsx:108-164`

**Description:** The `useEffect` fetching destination recommendations has no `AbortController`. If `token`, `pickedVibes`, `budgetLevel`, or `origin` change in quick succession, multiple simultaneous requests fire. A stale response arriving after a fresh one overwrites the UI.

**Impact:** User sees destination recommendations that don't match their current selections.

**Fix direction:** Add `AbortController` with cleanup in the effect's return function. Abort the previous request before starting a new one.

---

### GAP-05 | HIGH — Loading page has no hard timeout

**File:** `src/app/m/loading/page.tsx:273-289`

**Description:** If trip generation hangs (server error, network issue), the loading page waits indefinitely. At 60 seconds it shows a soft message ("This is taking longer than expected") but the request keeps running. The "Pick a different destination" button navigates away but doesn't cancel the in-flight request.

**Impact:** User waits minutes with no resolution. Orphaned generation request may eventually create a partial trip in the background.

**Fix direction:** Add a hard timeout at 120s that sets an error state and aborts the fetch. Provide clear retry and "start over" options.

---

### GAP-06 | MEDIUM — Dates validation bypassed when startDate is empty

**File:** `src/app/m/plan/dates/page.tsx:94-104`

**Description:** `handleEndChange` validates `v < startDate`, but if `startDate` is an empty string, `v < ''` is always `false` in JavaScript. An invalid date pair (end before start, or start empty) can be submitted.

**Impact:** Trip generated with impossible date range. Itinerary days may be 0 or negative.

**Fix direction:** Add `if (!startDate || v < startDate)` check.

---

### GAP-07 | MEDIUM — Vibes auto-navigates with no confirmation

**File:** `src/app/m/plan/vibes/page.tsx:76-81`

**Description:** After the 3rd vibe is picked, `setTimeout(() => router.push(...), 1200)` fires automatically. There's a brief "done" state showing the picked vibes but the user may swipe again during the 1.2s window thinking nothing happened.

**Impact:** User feels they lost control. No chance to review or change vibes before proceeding.

**Fix direction:** Show a confirmation card with the 3 picked vibes and a "Continue" button instead of auto-navigating.

---

### GAP-08 | LOW — Saved vibes not cleared on back navigation

**File:** `src/app/m/plan/vibes/page.tsx:40-50`

**Description:** If a user picks 3 vibes, navigates forward, then presses back to re-choose, the page initializes with old vibes from the store. The card index jumps to where they left off instead of resetting.

**Impact:** Confusing re-entry. User must mentally track which vibes are already picked.

**Fix direction:** Reset vibes state when entering the page (or provide a "Clear and start over" option).

---

### GAP-09 | MEDIUM — Onboarding state lost on tab close

**File:** `src/stores/trip-store.ts:264-279`

**Description:** Onboarding state is persisted to `sessionStorage`, which is cleared when the tab closes. A user who fills origin, dates, budget, and vibes then accidentally closes the tab loses everything.

**Impact:** User must restart the entire 5-step flow from scratch.

**Fix direction:** Persist onboarding progress to Supabase (keyed by anonymous user ID) or use `localStorage` instead of `sessionStorage`.

---

### GAP-10 | LOW — Destination match percentage has no explanation

**File:** `src/app/m/plan/destinations/page.tsx`

**Description:** Each destination card shows "85% match" (or similar) with no tooltip or explanation. The value defaults to 85 if the API doesn't return one.

**Impact:** Users don't understand what it matches (vibes? budget? distance?) and can't use it to make informed choices.

**Fix direction:** Add a brief label like "Matches your vibes" or remove the percentage entirely if it can't be explained.

---

## 2. Authentication & Identity

### GAP-11 | HIGH — Anonymous-to-Google link fails, orphans trips

**File:** `src/app/m/login/page.tsx:100-126`

**Description:** When an anonymous user signs in with Google, `linkIdentity()` is attempted first. If it fails (common with certain Supabase configurations), the code falls back to `signInWithOAuth()` which creates a NEW account. The anonymous session's trips are orphaned.

**Impact:** User loses all planning progress (origin, dates, budget, vibes, and any generated trip) when signing up.

**Fix direction:** If `linkIdentity` fails, show a confirmation dialog explaining data may be lost before falling back to `signInWithOAuth`. Better: implement server-side trip migration from anonymous user ID to new user ID.

---

### GAP-12 | MEDIUM — Mobile hero redirect race condition

**File:** `src/app/m/page.tsx:25-49`

**Description:** The hero page checks for existing trips to redirect returning users. The `checked` flag prevents re-checks, but if `userId` changes (e.g., identity link completes), the effect returns early because `checked` is already `true`.

**Impact:** Returning user may see the hero page instead of being redirected to their last trip.

**Fix direction:** Reset `checked` when `userId` changes, or remove the flag and use a proper loading state.

---

### GAP-13 | MEDIUM — Auth callback doesn't validate nonce

**File:** `src/app/api/auth/callback/route.ts`

**Description:** The OAuth callback exchanges any `code` parameter for a session without additional nonce or state validation. While Supabase may handle this server-side, explicit validation is a defense-in-depth best practice.

**Impact:** Potential OAuth code interception attack vector (low probability with HTTPS, but worth hardening).

**Fix direction:** Pass and validate a `state` parameter through the OAuth flow.

---

### GAP-14 | MEDIUM — No CSRF protection on state-changing endpoints

**File:** All POST/PUT/DELETE API routes

**Description:** No CSRF tokens are validated on any endpoint. The Supabase auth token provides some protection (it's sent as a header, not a cookie), but if the token is stored in a cookie in any configuration, CSRF attacks become possible.

**Impact:** A malicious website could trigger state changes (delete trips, modify itineraries) if the user is logged in.

**Fix direction:** Verify `Origin` header matches expected domain on all mutation endpoints.

---

## 3. Trip Board & Item Interactions

### GAP-15 | CRITICAL — Optimistic updates with no rollback

**File:** `src/components/mobile/cards/ItemCard.tsx`, `src/components/mobile/CardMenu.tsx`

**Description:** Swap and delete operations update local state immediately (optimistic UI) then make an async Supabase call. If the database call fails, the local state is already changed. There is no rollback logic. Success toasts fire regardless of the actual outcome.

**Impact:** User sees "Swapped!" or "Removed!" but the change never persisted. On page refresh, old data reappears. Repeated failures silently corrupt the user's mental model of their trip.

**Fix direction:** Store the previous state before optimistic update. If the DB call fails, revert state and show an error toast. Disable the action button during the async operation.

---

### GAP-16 | HIGH — Delete item has no confirmation or undo

**File:** `src/components/mobile/CardMenu.tsx`

**Description:** Tapping "Remove" in the card menu immediately deletes the item from local state and sends a Supabase delete. No confirmation dialog. No undo mechanism.

**Impact:** Accidental deletion is permanent and instant. User has no way to recover a deleted item.

**Fix direction:** Show a brief "Undo" toast (5 seconds) before committing the delete to the database. Or add a confirm step.

---

### GAP-17 | HIGH — DetailSheet swap targets wrong item during async

**File:** `src/components/mobile/DetailSheet.tsx`

**Description:** The swap handler captures `item` from the closure at render time. If the user opens item A's detail sheet, starts a swap, then quickly switches to item B's detail sheet, the in-flight swap completes against the stale `item` reference (item A).

**Impact:** Wrong item gets swapped. User sees unexpected changes to a different day/item.

**Fix direction:** Capture `item.id` at click time and verify it still matches the current detail item before committing the swap.

---

### GAP-18 | HIGH — Trip with only flights/hotels shows "empty" state

**File:** `src/components/mobile/BoardView.tsx`

**Description:** The empty-trip check counts all items including flights and hotels. But the display logic filters those into separate sections. A trip with 1 flight + 1 hotel but 0 activities/restaurants shows the "Trip is empty — start chatting to add items" message.

**Impact:** User who just generated a trip sees "empty" despite having a valid flight and hotel booked.

**Fix direction:** Check for items excluding `flight`, `hotel`, `transfer`, and `day` categories when determining if the trip content is empty.

---

### GAP-19 | MEDIUM — Day scroll pills don't track manual scrolling

**File:** `src/components/mobile/BoardView.tsx`

**Description:** The sticky day pills at the top highlight the "active" day, but this is only updated when a pill is tapped. If the user manually scrolls through days, the pills stay on the last tapped day.

**Impact:** Navigation indicator is misleading. User can't tell which day they're viewing.

**Fix direction:** Add an Intersection Observer on day section headers to update `activeDay` as the user scrolls.

---

### GAP-20 | MEDIUM — Photo carousel dots desync during momentum scroll

**File:** `src/components/mobile/DetailSheet.tsx`

**Description:** The `handleScroll` function updates `activePhoto` based on scroll position, but it fires continuously during momentum scrolling. The dot indicator may show a different photo than what's actually centered.

**Impact:** Minor trust issue — dots suggest photo 2 but photo 3 is visible.

**Fix direction:** Debounce the scroll handler or use `scrollend` event (supported in modern browsers).

---

### GAP-21 | MEDIUM — Personalization completes after user reaches board

**File:** `src/app/m/loading/page.tsx`

**Description:** Trip generation navigates to the board page while personalization (`/api/ai/personalize`) is still running in the background. If personalization updates items after the board mounts, the board doesn't re-fetch.

**Impact:** User sees an un-personalized trip (no "why this?" reasons, no day insights). They never know the trip would have been better if they waited.

**Fix direction:** Either wait for personalization before navigating, or have the board poll/subscribe for personalization completion and refresh items.

---

### GAP-22 | MEDIUM — Personalization won't re-run after adding items via chat

**File:** `src/app/api/ai/personalize/route.ts:29-36`

**Description:** The endpoint checks `items.some(i => i.metadata?.whyFactors)` — if ANY item has `whyFactors`, it returns `already_personalized`. Items added later via chat never get personalized.

**Impact:** New items added through the AI chat lack personalization data (reasons, insights) while original items have it. Inconsistent experience.

**Fix direction:** Check `items.every(...)` instead of `items.some(...)`, or only check non-flight/non-day items that are missing whyFactors.

---

## 4. AI Chat

### GAP-23 | CRITICAL — Assistant messages not persisted server-side

**File:** `src/app/api/ai/chat/route.ts:148-152`

**Description:** During streaming, the server cannot capture the full assistant response. It relies entirely on the frontend calling `/api/ai/chat/save` after the stream completes. If the client crashes, loses network, or has a bug, the message is never saved.

**Impact:** Chat history becomes incomplete. User refreshes and loses the AI's response. Conversation context breaks on the next message.

**Fix direction:** Accumulate the streamed response server-side and save it in the `streamPromise.then()` callback. The frontend save can serve as a backup/confirmation.

---

### GAP-24 | HIGH — SSE parsing splits on wrong delimiter

**File:** `src/components/mobile/ChatOverlay.tsx`

**Description:** The streaming response parser splits the buffer on `\n`, but the SSE spec uses `\r\n` as the line separator. If the server sends `\r\n` (which it may depending on the HTTP library), the parser leaves `\r` characters in the data, potentially breaking JSON parsing silently (caught by empty `catch {}`).

**Impact:** Chat messages may be silently dropped or corrupted during streaming.

**Fix direction:** Split on `/\r?\n/` to handle both line endings.

---

### GAP-25 | MEDIUM — Empty assistant bubble appears before stream content

**File:** `src/components/mobile/ChatOverlay.tsx`

**Description:** When a streaming response starts, an assistant message with `content: ''` is added immediately, and the loading indicator is hidden. The user sees an empty chat bubble for a moment before text starts appearing.

**Impact:** Jarring visual — looks like the AI sent a blank message.

**Fix direction:** Keep the loading indicator until the first text chunk arrives, then add the message.

---

### GAP-26 | MEDIUM — Chat history silently truncated at 50 messages

**File:** `src/stores/trip-store.ts`

**Description:** `addChatMessage` slices to the last 50 messages: `.slice(-50)`. There's no UI indication that older messages were removed and no way to load them.

**Impact:** In long conversations, early context disappears. User can't scroll back to see what they discussed.

**Fix direction:** Add a "Load earlier messages" button that fetches from the `chat_messages` table, or increase the cap with pagination.

---

### GAP-27 | MEDIUM — Chat save is fire-and-forget

**File:** `src/components/mobile/ChatOverlay.tsx`

**Description:** After streaming completes, the frontend calls `fetch('/api/ai/chat/save', ...).catch(() => {})`. The catch is empty — if the save fails, no retry is attempted and the user isn't notified.

**Impact:** Messages appear in the UI but aren't in the database. On refresh, they vanish.

**Fix direction:** Retry once on failure. If still failing, show a subtle "message not saved" indicator.

---

### GAP-28 | LOW — Chat markdown only supports bold, italic, bullets

**File:** `src/components/mobile/ChatOverlay.tsx`

**Description:** The `formatInline()` renderer handles `**bold**`, `*italic*`, and bullet points but not links, headers, code blocks, or other common markdown features.

**Impact:** If the LLM responds with links or code formatting, users see raw markdown syntax.

**Fix direction:** Use a lightweight markdown renderer (e.g., `react-markdown` with minimal plugins) or extend `formatInline` to handle links and code.

---

## 5. API & Security

### GAP-29 | CRITICAL — AI tools don't verify trip ownership

**File:** `src/lib/ai-tools.ts` (all tool executors)

**Description:** Tools like `executeSwapItem`, `executeAddItem`, `executeUpdateTrip`, and `executeAdjustBudget` receive `tripId` in context but never verify the trip belongs to the authenticated user. They operate using the Supabase service role client, which bypasses Row Level Security.

**Impact:** A malicious client could pass another user's `tripId` in the chat request and modify their trip through the AI tools.

**Fix direction:** Pass `userId` into the tool execution context and add `.eq('user_id', context.userId)` to all database queries in tools. Or use the user's auth token instead of the service role key.

---

### GAP-30 | CRITICAL — No schema validation on API request bodies

**File:** All API routes (`/api/ai/generate`, `/api/ai/chat`, `/api/ai/personalize`, `/api/ai/regenerate`, `/api/trips`)

**Description:** Every endpoint parses `req.json()` directly with zero validation. No type checking, no bounds checking on numbers (travelers, budget), no date format enforcement, no string sanitization.

**Impact:** Invalid data reaches the LLM prompts (causing hallucinations), gets stored in the database (causing downstream errors), or crashes the server (unhandled type errors).

**Fix direction:** Add Zod schemas for each endpoint's request body. Return 400 with specific field errors on validation failure.

---

### GAP-31 | HIGH — Race conditions in concurrent AI tool execution

**File:** `src/lib/ai-agent.ts`

**Description:** The agentic loop executes tools sequentially within one request, but two concurrent chat requests can modify the same trip simultaneously. Each reads the current state, modifies it, and saves — classic read-modify-write race condition.

**Impact:** If a user sends two chat messages quickly (e.g., "swap the hotel" and "change the restaurant"), the second request may overwrite the first's changes.

**Fix direction:** Implement optimistic locking (version column on itinerary_items) or serialize requests per trip using a queue.

---

### GAP-32 | HIGH — Non-atomic cascade deletes

**File:** `src/app/api/trips/[id]/route.ts`

**Description:** Trip deletion runs three sequential queries: delete items, delete messages, delete trip. If the process crashes between any of these, orphaned data remains.

**Impact:** Database accumulates orphaned itinerary items and chat messages that reference non-existent trips.

**Fix direction:** Use a Supabase RPC function with a transaction, or add ON DELETE CASCADE to the foreign keys.

---

### GAP-33 | HIGH — Auth token exposed in calendar export URL

**File:** `src/components/mobile/BoardView.tsx`

**Description:** Calendar export opens a new tab with `window.open('/api/trips/${id}/calendar?token=${token}')`. The token is visible in browser history, server logs, and potentially shared if the user copies the URL.

**Impact:** Auth token leakage. Anyone with access to browser history can impersonate the user.

**Fix direction:** Use a POST request with the Authorization header and return the ICS file as a blob download.

---

### GAP-34 | HIGH — No timeout on external API calls

**File:** `src/lib/amadeus.ts`, `src/lib/google-places-photos.ts`, `src/lib/grounded-search.ts`

**Description:** Fetch calls to Amadeus, Google Places, and grounded search APIs have no `AbortController` or timeout. If any external service hangs, the entire request hangs until the platform timeout (120s on Railway).

**Impact:** Single slow external API blocks the entire generation pipeline. User waits 2 minutes then gets a timeout error.

**Fix direction:** Add `AbortController` with 5-10 second timeouts per external call. Return cached/fallback data if the call times out.

---

### GAP-35 | MEDIUM — Rate limiter is per-process only

**File:** `src/lib/rate-limit.ts`

**Description:** Rate limiting uses an in-memory `Map`. On multi-instance deployments (Railway scales, Vercel functions), each process has its own map. A user can make N * instances requests before being limited.

**Impact:** Rate limiting is ineffective at preventing abuse on scaled deployments.

**Fix direction:** Use Redis-backed rate limiting (Upstash is a good fit for serverless) or rely on Railway/Vercel platform-level rate limits.

---

### GAP-36 | MEDIUM — Generic 500 errors with no error codes

**File:** All API routes

**Description:** All error responses are `{ error: "something failed" }` with status 500. No error codes, no distinction between client errors (400) and server errors (500), no `Retry-After` header on rate limits.

**Impact:** Frontend can't implement smart retry logic or show specific guidance. User always sees generic "Something went wrong."

**Fix direction:** Return structured errors: `{ error: "message", code: "DESTINATION_NOT_FOUND" }` with appropriate HTTP status codes (400, 404, 429, 500).

---

## 6. Secondary Pages & Navigation

### GAP-37 | HIGH — No custom 404 or error pages

**File:** App root (missing `not-found.tsx`, `error.tsx`)

**Description:** No custom error or 404 pages exist. Invalid URLs show Next.js default error pages, which break the dark luxury design system. Invalid trip IDs (`/m/board/fake-id`) attempt to load indefinitely.

**Impact:** Users who hit a broken link or expired share see an unstyled, confusing page with no way to navigate back.

**Fix direction:** Add `not-found.tsx` and `error.tsx` at the app root with Drift branding and a "Go home" button.

---

### GAP-38 | HIGH — Sitemap only lists 2 pages

**File:** `sitemap.xml` (or `sitemap.ts`)

**Description:** The sitemap only includes `/` and `/login`. Missing: `/about`, `/faq`, `/privacy`, `/terms`, `/destinations`, and all public share pages.

**Impact:** Search engines don't index most of the site. SEO for informational and legal pages is effectively zero.

**Fix direction:** Generate a complete sitemap including all static pages and dynamically generated share slugs.

---

### GAP-39 | MEDIUM — Mobile pages have no SEO metadata

**File:** All `src/app/m/*` pages

**Description:** No `generateMetadata()` export on any mobile page. Titles, descriptions, and Open Graph tags all fall back to the root layout defaults.

**Impact:** If a mobile URL is shared (via copy-paste, not the share feature), the link preview shows generic "Drift" text with no trip or page context.

**Fix direction:** Add `generateMetadata()` to at least the board page and share-related pages.

---

### GAP-40 | MEDIUM — Share page missing Open Graph image

**File:** `src/app/share/[slug]/`

**Description:** The share page sets `twitter:card` to `summary_large_image` but provides no `og:image`. Link previews on social media show a blank or default image.

**Impact:** Shared trips look unprofessional on social media and messaging apps. Reduced click-through.

**Fix direction:** Generate or select a destination hero image for the OG tag. Could use the first item's photo or a destination-specific Unsplash image.

---

### GAP-41 | MEDIUM — Trip deletion uses browser confirm()

**File:** Trips page/tab

**Description:** Deleting a trip triggers the native browser `confirm()` dialog, which is unstyled and inconsistent with the dark luxury design system.

**Impact:** Breaks visual consistency. On mobile browsers, the dialog looks particularly out of place.

**Fix direction:** Replace with a styled modal component matching the Drift design system.

---

### GAP-42 | MEDIUM — Desktop/mobile redirect loops possible

**File:** Multiple pages

**Description:** `/destinations` redirects unauthenticated users to `/login`. `/login` redirects authenticated users to `/vibes`. If the session state is ambiguous (e.g., expired token that still exists in storage), a redirect loop can occur.

**Impact:** User gets stuck in a redirect loop and must clear browser data to recover.

**Fix direction:** Add loop detection (e.g., a `redirectCount` query param) and break out to the landing page after 2 redirects.

---

### GAP-43 | LOW — No offline fallback

**File:** App-wide

**Description:** No service worker or offline shell. If the user loses network while viewing their trip board, the page shows a browser error.

**Impact:** Travelers often have spotty internet. Losing access to their itinerary at the destination is the worst possible time.

**Fix direction:** Add a basic service worker that caches the last viewed trip board for offline access. This is a significant feature but high-impact for the travel use case.

---

### GAP-44 | LOW — Orphaned destination-input page

**File:** `src/app/m/plan/destination-input/page.tsx`

**Description:** This page exists in the codebase but is not linked from the main plan flow. It can be accessed directly via URL but doesn't validate prerequisites (vibes, budget).

**Impact:** Maintenance debt. Could confuse developers or produce a broken experience if someone finds the URL.

**Fix direction:** Either integrate into the flow or delete it.

---

## 7. Accessibility

### GAP-45 | MEDIUM — No keyboard navigation in carousels

**File:** Multiple components (ItemCard alternatives, DetailSheet photos, RemixOverlay vibes)

**Description:** All carousel/horizontal-scroll elements are mouse/touch only. No arrow key navigation, no focus management between items.

**Impact:** Keyboard-only users and screen reader users cannot interact with alternatives or photos.

**Fix direction:** Add `onKeyDown` handlers for arrow keys and `tabIndex` on carousel items.

---

### GAP-46 | MEDIUM — No focus trapping in modals

**File:** `src/components/mobile/DetailSheet.tsx`, `ChatOverlay.tsx`, `RemixOverlay.tsx`

**Description:** When a modal/overlay opens, focus is not trapped inside it. Tab key cycles through background elements. No focus return to trigger element on close.

**Impact:** Screen reader users lose context when modals open. Keyboard users can interact with hidden background elements.

**Fix direction:** Implement focus trapping (e.g., `focus-trap-react` or manual implementation) and return focus on close.

---

### GAP-47 | MEDIUM — Missing ARIA labels on icon buttons

**File:** Multiple components

**Description:** Icon-only buttons (delete, back arrow, 3-dot menu, share) have no `aria-label`. Screen readers announce them as "button" with no context.

**Impact:** Screen reader users cannot identify what each button does.

**Fix direction:** Add `aria-label` to all icon-only buttons (e.g., `aria-label="Delete item"`, `aria-label="Open menu"`).

---

### GAP-48 | LOW — Gold-only interactive elements lack non-color indicators

**File:** App-wide

**Description:** Interactive elements are distinguished primarily by gold color (#c8a44e). No additional indicators (underline, icon, border) for colorblind users.

**Impact:** Users with red-green color blindness may have difficulty distinguishing interactive from non-interactive elements.

**Fix direction:** Add secondary visual indicators (underlines on links, borders on buttons) alongside color.

---

## Summary by Severity

### CRITICAL (7) — Must fix before production

| ID | Issue |
|----|-------|
| GAP-01 | Vibes page stuck at 2 picks |
| GAP-02 | Early return before hooks crashes React |
| GAP-15 | Optimistic updates with no rollback |
| GAP-23 | Assistant chat messages not persisted server-side |
| GAP-29 | AI tools don't verify trip ownership |
| GAP-30 | No schema validation on API request bodies |

### HIGH (16) — Should fix before scaling

| ID | Issue |
|----|-------|
| GAP-03 | Custom destination proceeds with empty country |
| GAP-04 | Destinations fetch race condition |
| GAP-05 | Loading page has no hard timeout |
| GAP-11 | Anonymous-to-Google link orphans trips |
| GAP-16 | Delete item has no confirmation |
| GAP-17 | DetailSheet swap targets wrong item |
| GAP-18 | Trip with flights/hotels shows "empty" |
| GAP-24 | SSE parsing uses wrong delimiter |
| GAP-31 | Race conditions in concurrent tool execution |
| GAP-32 | Non-atomic cascade deletes |
| GAP-33 | Auth token exposed in calendar URL |
| GAP-34 | No timeout on external API calls |
| GAP-37 | No custom 404/error pages |
| GAP-38 | Sitemap only lists 2 pages |

### MEDIUM (18)

| ID | Issue |
|----|-------|
| GAP-06 | Dates validation bypassed with empty start |
| GAP-07 | Vibes auto-navigates with no confirmation |
| GAP-09 | Onboarding state lost on tab close |
| GAP-12 | Mobile hero redirect race condition |
| GAP-13 | Auth callback no nonce validation |
| GAP-14 | No CSRF protection |
| GAP-19 | Day pills don't track scroll position |
| GAP-20 | Photo carousel dots desync |
| GAP-21 | Personalization completes after board loads |
| GAP-22 | Personalization won't re-run for new items |
| GAP-25 | Empty chat bubble before stream |
| GAP-26 | Chat truncated at 50 messages |
| GAP-27 | Chat save is fire-and-forget |
| GAP-35 | Rate limiter per-process only |
| GAP-36 | Generic 500 errors |
| GAP-39 | Mobile pages no SEO metadata |
| GAP-40 | Share page missing OG image |
| GAP-41 | Trip delete uses browser confirm() |
| GAP-42 | Redirect loops possible |
| GAP-45 | No keyboard nav in carousels |
| GAP-46 | No focus trapping in modals |
| GAP-47 | Missing ARIA labels |

### LOW (7)

| ID | Issue |
|----|-------|
| GAP-08 | Saved vibes not cleared on back |
| GAP-10 | Match % unexplained |
| GAP-28 | Chat markdown limited |
| GAP-43 | No offline fallback |
| GAP-44 | Orphaned destination-input page |
| GAP-48 | Gold-only color indicators |

---

## Recommended Fix Order

**Phase 1 — Critical blockers (this week)**
1. GAP-29: Add user ownership check to AI tools
2. GAP-15: Add rollback logic to optimistic updates
3. GAP-23: Persist assistant messages server-side
4. GAP-30: Add Zod validation to all API endpoints
5. GAP-01: Fix vibes page stuck loop
6. GAP-02: Fix hooks ordering in origin + dates pages

**Phase 2 — High-impact UX + security (next week)**
7. GAP-11: Fix anonymous identity linking
8. GAP-37: Add 404 and error pages
9. GAP-34: Add timeouts to external API calls
10. GAP-16: Add delete confirmation with undo
11. GAP-33: Fix token exposure in calendar export
12. GAP-05: Add hard timeout to loading page
13. GAP-38: Expand sitemap

**Phase 3 — Polish + reliability (ongoing)**
14. Remaining HIGH issues
15. MEDIUM issues by impact
16. Accessibility pass (GAP-45 through GAP-48)
17. LOW issues as time permits
