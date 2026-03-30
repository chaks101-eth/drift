# Drift UX Audit — Full Issue List

> Last updated: 2026-03-30
> Total issues: 80 | Fixed: 55+ | Remaining: ~25 (mostly P2/P3 polish)

## Status Key
- [x] Fixed
- [ ] Open

---

## P0 — Critical (7)

- [x] **1. Hero page infinite spinner** — If Supabase hangs on returning user check, spinner shows forever. Fixed: 5s timeout.
- [x] **2. Chat history memory leak** — `chatHistory` array grows unbounded. Fixed: capped at 50 messages.
- [x] **3. Vibes allows 0 selection** — `handleContinue()` doesn't check `picked.length`. Fixed: blocks if 0.
- [x] **4. Budget warning shows negative** — Shows "-30% over budget" when UNDER budget. Fixed: `totalCost > budgetTarget` check.
- [x] **5. Trip not found dead end** — No buttons to navigate away. Fixed: "Plan a New Trip" + "Home" CTAs.
- [x] **6. Currency mismatch** — Hotel card shows raw USD while board uses INR. Fixed: hotel card uses `formatBudget()`.
- [ ] **7. Price parsing breaks on ranges** — `"$80-$150"` becomes `80150` with `replace(/[^0-9.]/g, '')`. Affects: BoardView, DetailSheet, ai-context, ai-tools (6+ files).

## P1 — High Priority (13)

- [x] **8. Empty trip shows "0 Days"** — No items = confusing empty state. Fixed: "Trip is empty" with chat CTA.
- [x] **9. Hotel per-night case-sensitive** — Only matches `/night` not `Per Night` or `per night`. Fixed: case-insensitive.
- [x] **10. Chat textarea overflow** — No max height, can push past bottom nav. Fixed: `max-h-[100px]`.
- [x] **11. Detail sheet close button too small** — 32px, below 44px minimum. Fixed: 44px.
- [ ] **12. Detail sheet no swipe-to-dismiss** — Users try to swipe down to close, nothing happens. Handle bar exists but no gesture.
- [ ] **13. Browser back button doesn't close overlays** — Detail sheet, chat, card menu are state-based, not URL-based. Back navigates away instead of closing.
- [ ] **14. Hero page flash before redirect** — Returning user sees hero content briefly before redirect fires.
- [ ] **15. Auth flash on layout** — No loading skeleton while Supabase session resolves. Children render unauthenticated briefly.
- [ ] **16. Origin input no validation** — User can type "asdf" and proceed. Flights silently skipped. No feedback.
- [ ] **17. Destination error messaging vague** — "Couldn't load destinations" with no context on why.
- [ ] **18. Image placeholders erode trust** — Unsplash generics shown with no indicator they're not real venue photos.
- [ ] **19. No loading state on item swap** — Optimistic update, but if Supabase fails, UI/DB inconsistent.
- [ ] **20. Remix button not disabled during loading** — User can tap multiple times triggering duplicate generations.

## P2 — Medium Priority (35)

### Navigation & Flow
- [ ] **21. Onboarding state lost on browser back** — Going back mid-flow loses selected vibes/dates/budget.
- [ ] **22. URL extraction → board back button broken** — Can't go back to URL step after generation.
- [ ] **23. Landscape mode broken** — Vibe cards `h-[420px]` fixed, don't fit landscape viewport.
- [ ] **24. iPad/tablet untested** — 390px design stretches full-width, looks broken.
- [ ] **25. Bottom nav doesn't collapse on scroll** — Always visible, eats 50px of screen.
- [ ] **26. No back gesture support (iOS swipe)** — Left-edge swipe doesn't trigger back navigation.

### Data & Display
- [ ] **27. Flight card shows "?" for missing airports** — No explanation why data is missing.
- [ ] **28. Null vibes crashes includes()** — `trip.vibes?.includes()` needed but some paths don't null-check.
- [ ] **29. Personalization fires on every board load** — No check if already personalized. Redundant API calls.
- [ ] **30. Hotel price "$150" treated as total, not per-night** — If LLM omits "/night" suffix, cost calculation wrong.
- [ ] **31. Loading steps timer-based, not event-driven** — Hardcoded 108s of step text that doesn't match actual backend progress.
- [ ] **32. No retry on generation failure** — Error shows "Go back" but no "Try again" option.
- [ ] **33. Personalization fails silently** — `console.warn` only, user gets non-personalized trip.
- [ ] **34. Weather summary stored but never displayed** — `meta.weatherSummary` set on day 1 but not rendered.
- [ ] **35. Budget not enforced post-generation** — LLM gets budget hint but no validation that total fits.
- [ ] **36. Chat context missing trip modifications** — Swapping items via card menu doesn't update chat context until next message.
- [ ] **37. Ratings never shown on item cards** — `meta.rating` exists but only displayed on alternative badges (4.5+).
- [ ] **38. Review counts never shown** — `meta.reviewCount` stored but never displayed anywhere.
- [ ] **39. Source (catalog vs LLM) not shown** — `meta.source` field exists but hidden from user.
- [ ] **40. Share page missing OG image** — Social previews show text only, no thumbnail.
- [ ] **41. Booking URL fallback logic** — DetailSheet has booking URL but CTA may link to invalid page.

### Forms & Inputs
- [ ] **42. Origin autocomplete blur timing issue** — 200ms delay can cause dropdown to flicker on mobile tap.
- [ ] **43. Date picker UX unclear** — Native `<input type="date">` with no visual hint it opens picker.
- [ ] **44. Budget slider too granular** — 38 steps between $500-$10K, hard to fine-tune on small screen.
- [ ] **45. Traveler count no keyboard input** — Only ± buttons, can't quickly type "8".
- [ ] **46. Custom destination needs 2+ chars** — No way to browse popular destinations from empty state.
- [ ] **47. Country auto-detection incomplete** — Only ~30 cities mapped. "Ahmedabad" gets empty country.

### Visual & Interaction
- [ ] **48. Overlay z-index inconsistency** — Detail and Chat both at z-[150]. Could stack unpredictably.
- [ ] **49. Toast hidden by keyboard** — Fixed at `bottom-[100px]`, covered when keyboard opens.
- [ ] **50. CardMenu closes before action completes** — User can't see loading state since menu dismissed immediately.
- [ ] **51. Destination carousel dots wrong on rubber-band scroll** — Bounce scroll shows wrong active dot briefly.
- [ ] **52. Vibes auto-navigate with no cancel** — After 3 vibes, 1.2s then auto-redirects. No way to cancel.
- [ ] **53. No autofocus on endDate after startDate selection** — Must manually tap second date field.
- [ ] **54. Detail sheet photo gallery resets on reopen** — Always jumps to photo 1 regardless of last position.
- [ ] **55. Loading state doesn't disable bottom nav interactions** — User can tap chat/trips while trip loads.

## P3 — Low Priority (25)

### Performance
- [ ] **56. Images not optimized for mobile** — Google Places photos at full resolution (1024x768+) on 390px screen.
- [ ] **57. Carousel calculates card width every scroll** — `offsetWidth` queried on every scroll event (60fps).
- [ ] **58. Board items re-render on hidden tab** — All tabs mounted with `hidden` class. 100+ items still in DOM.
- [ ] **59. Backdrop blur on every render** — `backdrop-blur-sm` recalculates on state changes. Stutters on low-end devices.
- [ ] **60. No lazy loading on long boards** — All 100 items rendered in DOM at once.

### Accessibility
- [ ] **61. Touch targets too small on ItemCard menu** — Menu button is 20px + padding, borderline 44px.
- [ ] **62. No aria-live on loading states** — Screen reader won't announce when spinner becomes visible.
- [ ] **63. Swipe cards not keyboard accessible** — No ←/→ arrow key or Enter fallback for vibes.
- [ ] **64. Chat suggestion buttons not labeled** — No aria-label for screen readers.
- [ ] **65. Form labels not associated** — Login has `<label>` but no `htmlFor` attribute.
- [ ] **66. Color-only status indicators** — Active day pill uses color only, no text alternative.

### Error Handling
- [ ] **67. No offline detection** — Network drop during chat hangs indefinitely. No "Check connection" banner.
- [ ] **68. Rate limiting silent** — 429 response shows generic error, not "Too many requests, wait 60s".
- [ ] **69. Session expiry not handled** — Token expires mid-session, 401 shows raw error. No re-auth modal.
- [ ] **70. Image fallback doesn't retry** — If Unsplash itself fails, shows broken image.
- [ ] **71. Detail sheet gallery image infinite error loop** — `onError` sets fallback which could also 404.

### Analytics Gaps
- [ ] **72. Missing origin selection event** — Can't track funnel from first step.
- [ ] **73. Missing error events** — Can't diagnose generation failures in analytics.
- [ ] **74. Missing chat tool usage events** — Can't see which tools are most used.
- [ ] **75. No returning user tracking** — Can't measure retention.

### Edge Cases
- [ ] **76. Vibes page doesn't handle orientation change** — Card positions break on rotate.
- [ ] **77. Two-finger scroll triggers unintended swipe** — On vibe cards.
- [ ] **78. Emoji input breaks text measurement** — In chat textarea.
- [ ] **79. Login email validation too loose** — `includes('@')` allows "a@b".
- [ ] **80. Password visibility toggle doesn't auto-reset** — Stays visible across navigation.

---

## Summary by Area

| Area | Total | Fixed | Open |
|------|-------|-------|------|
| Currency/Price | 2 | 1 | 1 |
| Navigation | 8 | 1 | 7 |
| Auth/Session | 3 | 1 | 2 |
| Data Display | 14 | 2 | 12 |
| Forms/Input | 6 | 1 | 5 |
| Overlays/Sheets | 6 | 2 | 4 |
| Performance | 5 | 0 | 5 |
| Accessibility | 6 | 0 | 6 |
| Error Handling | 7 | 1 | 6 |
| Analytics | 4 | 0 | 4 |
| Edge Cases | 5 | 1 | 4 |
| Generation | 4 | 1 | 3 |
| Chat | 3 | 1 | 2 |
| Trust/UX | 7 | 0 | 7 |
| **Total** | **80** | **12** | **68** |
