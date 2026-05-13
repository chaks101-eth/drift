// ─── Quota Tracker ──────────────────────────────────────────
// Tracks API call counts per service during pipeline execution.
// Warns when approaching configured limits. Persisted to pipeline_runs.stats.quota.

export interface QuotaLimits {
  [service: string]: number
}

export class QuotaTracker {
  private counts: Record<string, number> = {}
  private limits: QuotaLimits

  constructor(limits?: QuotaLimits) {
    this.limits = limits ?? {
      serpapi: 100,
      google_places: 1000,
      llm: 500,
    }
  }

  increment(service: string, count: number = 1): void {
    this.counts[service] = (this.counts[service] || 0) + count
    const limit = this.limits[service]
    if (limit) {
      const usage = this.counts[service] / limit
      if (usage >= 0.9) {
        console.warn(`[Quota] WARNING: ${service} at ${(usage * 100).toFixed(0)}% (${this.counts[service]}/${limit})`)
      }
    }
  }

  shouldStop(service: string): boolean {
    const limit = this.limits[service]
    if (!limit) return false
    return (this.counts[service] || 0) >= limit * 0.9
  }

  getSummary(): Record<string, number> {
    return { ...this.counts }
  }

  reset(): void {
    this.counts = {}
  }
}
