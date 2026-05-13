import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuotaTracker } from '../quota-tracker'

describe('QuotaTracker', () => {
  let tracker: QuotaTracker

  beforeEach(() => {
    vi.restoreAllMocks()
    tracker = new QuotaTracker({ serpapi: 100, google_places: 1000, llm: 500 })
  })

  it('increment increases count to 1, then 2 on second call', () => {
    tracker.increment('serpapi')
    expect(tracker.getSummary().serpapi).toBe(1)
    tracker.increment('serpapi')
    expect(tracker.getSummary().serpapi).toBe(2)
  })

  it('increment with count increases by that amount', () => {
    tracker.increment('serpapi', 5)
    expect(tracker.getSummary().serpapi).toBe(5)
  })

  it('getSummary returns object with all tracked service counts', () => {
    tracker.increment('serpapi', 3)
    tracker.increment('google_places', 7)
    const summary = tracker.getSummary()
    expect(summary).toEqual({ serpapi: 3, google_places: 7 })
  })

  it('shouldStop returns false when count is below 90% of limit', () => {
    tracker.increment('serpapi', 89)
    expect(tracker.shouldStop('serpapi')).toBe(false)
  })

  it('shouldStop returns true when count is at or above 90% of limit', () => {
    tracker.increment('serpapi', 90)
    expect(tracker.shouldStop('serpapi')).toBe(true)
  })

  it('shouldStop returns false for unknown service (no limit defined)', () => {
    tracker.increment('unknown_service', 999)
    expect(tracker.shouldStop('unknown_service')).toBe(false)
  })

  it('increment logs console.warn when usage hits 90% threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tracker.increment('serpapi', 90)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('[Quota]')
    expect(warnSpy.mock.calls[0][0]).toContain('serpapi')
    expect(warnSpy.mock.calls[0][0]).toContain('90%')
  })

  it('reset clears all counts back to 0', () => {
    tracker.increment('serpapi', 50)
    tracker.increment('google_places', 30)
    tracker.reset()
    const summary = tracker.getSummary()
    expect(summary).toEqual({})
    expect(tracker.shouldStop('serpapi')).toBe(false)
  })
})
