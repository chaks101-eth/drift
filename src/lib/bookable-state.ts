import type { ItineraryItem } from '@/stores/trip-store'
import { parsePrice } from './parse-price'

/**
 * Bookable state classification — the foundation of Drift's booking bridge.
 *
 * Every itinerary item falls into one of four states based on what action is
 * actually possible. This prevents the UI from promising "Book now" on a beach
 * or a free evening, and lets users trust the CTAs they see.
 *
 *   A — Bookable    Strong external booking flow (flights, hotels, paid tours)
 *   B — Reservable  Soft-bookable (restaurants with reservations, event pages)
 *   C — Explore     View-only (free attractions, markets, scenic spots, food)
 *   D — Context     Not a booking object (placeholders, free time, transfers)
 */
export type BookableState = 'A' | 'B' | 'C' | 'D'

export function getBookableState(item: ItineraryItem): BookableState {
  const meta = (item.metadata || {}) as Record<string, unknown>
  const bookingUrl = (meta.bookingUrl || meta.booking_url) as string | undefined
  const price = parsePrice(item.price || '')
  const name = (item.name || '').toLowerCase()

  // ── State D: structural / placeholder items ────────────────
  if (item.category === 'day' || item.category === 'transfer') return 'D'

  const placeholderPatterns = [
    'check-in', 'check in', 'hotel check',
    'arrival day', 'departure day',
    'free time', 'free evening', 'free morning', 'free afternoon',
    'leisure time', 'rest day', 'relax at hotel',
  ]
  if (placeholderPatterns.some((p) => name.includes(p))) return 'D'

  // ── State A: flights + hotels always route to a booking flow ──
  if (item.category === 'flight') return 'A'
  if (item.category === 'hotel') return 'A'

  // ── Activities ───────────────────────────────────────────────
  if (item.category === 'activity') {
    // Free attractions (beaches, parks, markets) → view-only
    if (price === 0) return 'C'
    // Real transactional booking URL → bookable
    if (bookingUrl && isTransactionalUrl(bookingUrl)) return 'A'
    // Priced but no strong link → soft-bookable (can find tickets externally)
    if (price > 0) return 'B'
    return 'C'
  }

  // ── Food ─────────────────────────────────────────────────────
  if (item.category === 'food') {
    // Restaurants with a reservation URL → soft-bookable
    if (bookingUrl && isTransactionalUrl(bookingUrl)) return 'B'
    // Otherwise → view-only (just find it on the map)
    return 'C'
  }

  return 'C'
}

/**
 * A URL is "transactional" if it points to a real booking/reservation surface,
 * not just a map or search result.
 */
function isTransactionalUrl(url: string): boolean {
  const nonTransactional = [
    'google.com/maps',
    'maps.google.com',
    'goo.gl/maps',
    'maps.app.goo.gl',
  ]
  const lower = url.toLowerCase()
  return !nonTransactional.some((p) => lower.includes(p))
}

// ─── CTA Variants ─────────────────────────────────────────────

export interface BookableCTA {
  label: string
  variant: 'primary' | 'secondary' | 'tertiary' | 'none'
  trackLabel: string
}

/**
 * Get the correct CTA label and visual variant for an item's state + category.
 * Labels are chosen to match what the user can ACTUALLY do — never misleading.
 */
export function getBookableCTA(state: BookableState, category: string): BookableCTA {
  if (state === 'A') {
    if (category === 'flight') return { label: 'Search flights', variant: 'primary', trackLabel: 'book_flight' }
    if (category === 'hotel') return { label: 'Book this stay', variant: 'primary', trackLabel: 'book_hotel' }
    if (category === 'activity') return { label: 'Get tickets', variant: 'primary', trackLabel: 'book_activity' }
    return { label: 'Book now', variant: 'primary', trackLabel: 'book_other' }
  }

  if (state === 'B') {
    if (category === 'food') return { label: 'Reserve a table', variant: 'secondary', trackLabel: 'reserve_food' }
    if (category === 'activity') return { label: 'Find tickets', variant: 'secondary', trackLabel: 'find_activity' }
    return { label: 'Visit official site', variant: 'secondary', trackLabel: 'visit_site' }
  }

  if (state === 'C') {
    return { label: 'View on map', variant: 'tertiary', trackLabel: 'view_map' }
  }

  // State D — no CTA
  return { label: '', variant: 'none', trackLabel: '' }
}

/**
 * Short human-readable label for state badges/tooltips.
 */
export function getBookableStateLabel(state: BookableState): string {
  switch (state) {
    case 'A':
      return 'Bookable'
    case 'B':
      return 'Reservable'
    case 'C':
      return 'Explore'
    case 'D':
      return ''
  }
}

/**
 * Resolve the actual outbound URL for an item, with sensible fallbacks.
 * Returns null for State D items (no booking action).
 */
export function getOutboundUrl(
  item: ItineraryItem,
  state: BookableState,
  destination: string,
): string | null {
  const meta = (item.metadata || {}) as Record<string, unknown>
  const bookingUrl = (meta.bookingUrl || meta.booking_url) as string | undefined
  const mapsUrl = meta.mapsUrl as string | undefined
  const q = encodeURIComponent(`${item.name} ${destination}`.trim())

  if (state === 'D') return null

  // Use a real transactional URL when we have one
  if (bookingUrl && isTransactionalUrl(bookingUrl)) return bookingUrl

  // State A fallbacks (category-specific search surfaces)
  if (state === 'A') {
    if (item.category === 'hotel') return `https://www.booking.com/search.html?ss=${q}`
    if (item.category === 'activity') return `https://www.viator.com/searchResults/all?text=${q}`
    if (item.category === 'flight') return bookingUrl || `https://www.google.com/travel/flights?q=${q}`
  }

  // State B fallbacks (search for the official venue)
  if (state === 'B') {
    if (item.category === 'food') return `https://www.google.com/search?q=${q}+reservation`
    if (item.category === 'activity') return `https://www.viator.com/searchResults/all?text=${q}`
    return `https://www.google.com/search?q=${q}`
  }

  // State C — map lookup
  return mapsUrl || `https://www.google.com/maps/search/${q}`
}
