import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../discovery'

describe('withRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns value on first successful call', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await withRetry(fn, 'test-label')
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 error and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'test-429', 3, 100)
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on rate limit error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'test-rate', 3, 100)
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on ECONNRESET error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'test-conn', 3, 100)
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on fetch failed error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'test-fetch', 3, 100)
    await vi.advanceTimersByTimeAsync(100)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws immediately on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('not found'))
    await expect(withRetry(fn, 'test-noretry')).rejects.toThrow('not found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('exhausts maxRetries and throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = vi.fn().mockRejectedValue(new Error('429 overloaded'))
    const promise = withRetry(fn, 'test-exhaust', 2, 100)

    // Attach rejection handler immediately to avoid unhandled rejection
    const resultPromise = promise.catch((e: Error) => e)

    // Advance through all retry delays: 100ms (attempt 0), 200ms (attempt 1)
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)

    const error = await resultPromise
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('429 overloaded')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
    warnSpy.mockRestore()
  })

  it('uses exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'test-backoff', 3, 100)

    // First retry after 100ms (100 * 2^0)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)

    // Second retry after 200ms (100 * 2^1)
    await vi.advanceTimersByTimeAsync(200)
    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('logs console.warn on each retry attempt with label', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValue('ok')

    const promise = withRetry(fn, 'my-label', 3, 100)
    await vi.advanceTimersByTimeAsync(100)
    await promise

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('my-label')
    expect(warnSpy.mock.calls[0][0]).toContain('[Retry]')
  })
})
