// ─── Analytics — GA4 Event Tracking ──────────────────────────
// Tracks the full user funnel + engagement events.
// Events feed into the growth analytics reporter agent.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gtag = () => typeof window !== 'undefined' ? (window as any).gtag : null

export function trackEvent(action: string, category: string, label?: string, value?: number) {
  const g = gtag()
  if (g) g('event', action, { event_category: category, event_label: label, value })
}

// ─── Funnel Events ────────────────────────────────────────────
// These track the critical user journey steps

export const funnel = {
  /** User landed on the app */
  landed: (source?: string) => trackEvent('funnel_landed', 'funnel', source),

  /** User signed up */
  signedUp: () => trackEvent('funnel_signed_up', 'conversion'),

  /** User picked vibes */
  vibesPicked: (vibes: string[]) => trackEvent('funnel_vibes', 'funnel', vibes.join(',')),

  /** User selected a destination */
  destinationPicked: (dest: string) => trackEvent('funnel_destination', 'funnel', dest),

  /** Trip generation started */
  generationStarted: (dest: string) => trackEvent('funnel_generate_start', 'funnel', dest),

  /** Trip generation completed */
  generationCompleted: (dest: string, itemCount: number) => trackEvent('funnel_generate_done', 'conversion', dest, itemCount),

  /** User viewed the trip board */
  boardViewed: (dest: string) => trackEvent('funnel_board_view', 'funnel', dest),

  /** User clicked a booking link */
  bookingClicked: (itemName: string, dest: string) => trackEvent('funnel_booking_click', 'conversion', `${itemName}|${dest}`),

  /** User shared a trip */
  tripShared: (dest: string) => trackEvent('funnel_trip_shared', 'conversion', dest),

  /** User opened chat */
  chatOpened: () => trackEvent('funnel_chat_opened', 'engagement'),

  /** User used URL-to-trip */
  urlExtracted: (source: string, dest: string) => trackEvent('funnel_url_extracted', 'conversion', `${source}|${dest}`),

  /** Step-by-step funnel tracking */
  originSelected: (city: string) => trackEvent('funnel_origin', 'funnel', city),
  datesSelected: (start: string, end: string) => trackEvent('funnel_dates', 'funnel', `${start}|${end}`),
  budgetSelected: (level: string, amount?: number) => trackEvent('funnel_budget', 'funnel', level, amount),

  /** Error tracking */
  generationFailed: (dest: string, error: string) => trackEvent('funnel_generate_fail', 'error', `${dest}|${error}`),
}

// ─── Engagement Events ────────────────────────────────────────

export const engage = {
  chatMessage: () => trackEvent('chat_message', 'engagement'),
  itemSwapped: (dest: string) => trackEvent('item_swapped', 'engagement', dest),
  itemDetailViewed: (name: string) => trackEvent('item_detail', 'engagement', name),
  tripRegenerated: (dest: string) => trackEvent('trip_regenerated', 'engagement', dest),
  chatToolUsed: (tool: string) => trackEvent('chat_tool_used', 'engagement', tool),
}
