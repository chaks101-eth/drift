// ─── Price Parser ────────────────────────────────────────────
// Single utility for parsing price strings across the entire app.
// Handles: "$80", "$80-$150" (→ 80), "₹5,000/night" (→ 5000),
// "Free" (→ 0), "€120" (→ 120), "" (→ 0)

export function parsePrice(price: string | null | undefined): number {
  if (!price) return 0
  if (price.toLowerCase() === 'free') return 0
  const cleaned = price.replace(/,/g, '') // strip thousands separators (₹5,000 → ₹5000)
  const match = cleaned.match(/[\d.]+/)   // take first number only ($80-$150 → 80)
  return match ? parseFloat(match[0]) || 0 : 0
}

/**
 * Check if a price string indicates per-night pricing.
 */
export function isPerNight(price: string | null | undefined): boolean {
  if (!price) return false
  const lower = price.toLowerCase()
  return lower.includes('/night') || lower.includes('per night')
}
