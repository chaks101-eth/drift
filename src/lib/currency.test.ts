import { describe, it, expect } from 'vitest'
import { detectCurrencyFromOrigin, formatPrice, getCurrencySymbol, getRate } from './currency'

describe('detectCurrencyFromOrigin', () => {
  it('detects INR for Indian cities', () => {
    expect(detectCurrencyFromOrigin('Delhi')).toBe('INR')
    expect(detectCurrencyFromOrigin('mumbai')).toBe('INR')
    expect(detectCurrencyFromOrigin('Bangalore')).toBe('INR')
    expect(detectCurrencyFromOrigin('  Jaipur  ')).toBe('INR')
  })

  it('detects USD for US cities', () => {
    expect(detectCurrencyFromOrigin('New York')).toBe('USD')
    expect(detectCurrencyFromOrigin('los angeles')).toBe('USD')
  })

  it('detects GBP for UK cities', () => {
    expect(detectCurrencyFromOrigin('London')).toBe('GBP')
  })

  it('detects AED for Dubai', () => {
    expect(detectCurrencyFromOrigin('Dubai')).toBe('AED')
  })

  it('defaults to USD for unknown cities', () => {
    expect(detectCurrencyFromOrigin('Atlantis')).toBe('USD')
    expect(detectCurrencyFromOrigin('')).toBe('USD')
  })
})

describe('formatPrice', () => {
  it('formats USD correctly', () => {
    expect(formatPrice(100, 'USD')).toBe('$100')
    expect(formatPrice(1500, 'USD')).toBe('$1,500')
  })

  it('formats INR with Indian locale', () => {
    const result = formatPrice(100, 'INR')
    expect(result).toContain('₹')
    expect(result).toContain('8,350') // 100 * 83.5
  })

  it('formats JPY without decimals', () => {
    const result = formatPrice(100, 'JPY')
    expect(result).toContain('¥')
    expect(result).toContain('14,900') // 100 * 149
  })

  it('formats AED', () => {
    const result = formatPrice(100, 'AED')
    expect(result).toContain('AED')
    expect(result).toContain('367') // 100 * 3.67
  })
})

describe('getCurrencySymbol', () => {
  it('returns correct symbols', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
    expect(getCurrencySymbol('INR')).toBe('₹')
    expect(getCurrencySymbol('EUR')).toBe('€')
    expect(getCurrencySymbol('GBP')).toBe('£')
  })
})

describe('getRate', () => {
  it('returns 1 for USD', () => {
    expect(getRate('USD')).toBe(1)
  })

  it('returns positive rates for all currencies', () => {
    const currencies = ['EUR', 'GBP', 'INR', 'JPY', 'AUD', 'SGD', 'AED', 'THB'] as const
    for (const c of currencies) {
      expect(getRate(c)).toBeGreaterThan(0)
    }
  })
})
