// ─── Currency Detection & Formatting ─────────────────────────
// Detects user currency from origin city or locale.
// Server-side: infer from origin city country.
// Client-side (mobile.html): uses navigator.language (already implemented).

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'THB' | 'MYR' | 'IDR' | 'PHP' | 'KRW' | 'NZD' | 'ZAR'

// Approximate rates vs USD — updated periodically, good enough for display
const RATES: Record<CurrencyCode, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, JPY: 149, AUD: 1.53,
  CAD: 1.36, SGD: 1.34, AED: 3.67, THB: 35.5, MYR: 4.7, IDR: 15800,
  PHP: 56, KRW: 1330, NZD: 1.67, ZAR: 18.5,
}

const SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$',
  CAD: 'C$', SGD: 'S$', AED: 'AED ', THB: '฿', MYR: 'RM',
  IDR: 'Rp', PHP: '₱', KRW: '₩', NZD: 'NZ$', ZAR: 'R',
}

// Map origin city → currency (covers common origins)
const CITY_CURRENCY: Record<string, CurrencyCode> = {
  // India
  delhi: 'INR', mumbai: 'INR', bangalore: 'INR', bengaluru: 'INR',
  chennai: 'INR', hyderabad: 'INR', kolkata: 'INR', pune: 'INR',
  ahmedabad: 'INR', jaipur: 'INR', kochi: 'INR', goa: 'INR',
  // UK
  london: 'GBP', manchester: 'GBP', edinburgh: 'GBP', birmingham: 'GBP',
  // US
  'new york': 'USD', 'los angeles': 'USD', chicago: 'USD', miami: 'USD',
  'san francisco': 'USD', seattle: 'USD', boston: 'USD', houston: 'USD',
  // Europe
  paris: 'EUR', berlin: 'EUR', amsterdam: 'EUR', rome: 'EUR',
  barcelona: 'EUR', madrid: 'EUR', munich: 'EUR', vienna: 'EUR',
  // UAE
  dubai: 'AED', 'abu dhabi': 'AED',
  // Southeast Asia
  singapore: 'SGD', bangkok: 'THB', 'kuala lumpur': 'MYR',
  jakarta: 'IDR', manila: 'PHP',
  // East Asia
  tokyo: 'JPY', osaka: 'JPY', seoul: 'KRW',
  // Oceania
  sydney: 'AUD', melbourne: 'AUD', auckland: 'NZD',
  // Canada
  toronto: 'CAD', vancouver: 'CAD',
  // Africa
  'cape town': 'ZAR', johannesburg: 'ZAR',
}

export function detectCurrencyFromOrigin(origin: string): CurrencyCode {
  const key = origin.toLowerCase().trim()
  return CITY_CURRENCY[key] || 'USD'
}

export function formatPrice(usdAmount: number, currency: CurrencyCode): string {
  const rate = RATES[currency] || 1
  const local = Math.round(usdAmount * rate)
  const symbol = SYMBOLS[currency] || '$'

  // Use locale-appropriate formatting for large numbers
  if (currency === 'INR') return `${symbol}${local.toLocaleString('en-IN')}`
  if (currency === 'JPY' || currency === 'KRW' || currency === 'IDR') return `${symbol}${local.toLocaleString()}`
  return `${symbol}${local.toLocaleString()}`
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return SYMBOLS[currency] || '$'
}

export function getRate(currency: CurrencyCode): number {
  return RATES[currency] || 1
}
