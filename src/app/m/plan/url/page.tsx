'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/mobile/BackButton'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

interface Highlight {
  name: string
  category: string
  detail: string
  estimatedPrice?: string
  inferredFromDestination?: boolean
}

interface ExtractedData {
  destinations: string[]
  primaryDestination: string
  country: string
  vibes: string[]
  suggestedDays: number
  highlights: Highlight[]
  budgetHint: string
  sourceTitle: string
  summary: string
  sourceType: string
}

type Step = 'paste' | 'extracting' | 'review' | 'generating'

const extractSteps = [
  'Reading the content...',
  'Identifying destinations...',
  'Extracting places & activities...',
]

export default function UrlPage() {
  const router = useRouter()
  const {
    token,
    setOrigin,
    setDates,
    setBudget,
    setVibes,
    setCurrentTrip,
    setCurrentItems,
    onboarding,
    formatBudget,
  } = useTripStore()

  // Don't redirect — if user reached this page, they're either logged in
  // or the layout auth listener will set the token shortly.
  // Only redirect if we're sure there's no session after checking.
  // ALL hooks must be declared before any conditional return
  const [authResolved, setAuthResolved] = useState(false)
  const [step, setStep] = useState<Step>('paste')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [extractStep, setExtractStep] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/m/login')
      setAuthResolved(true)
    })
  }, [router])

  useEffect(() => {
    if (!authResolved) return
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [authResolved])

  // Extraction step animation
  useEffect(() => {
    if (step !== 'extracting') return
    const interval = setInterval(() => {
      setExtractStep((prev) => Math.min(prev + 1, extractSteps.length - 1))
    }, 2000)
    return () => clearInterval(interval)
  }, [step])

  const isValidUrl = (s: string) => {
    try {
      new URL(s)
      return true
    } catch {
      return false
    }
  }

  const handleExtract = async () => {
    if (!isValidUrl(url)) {
      setError('Enter a valid URL')
      return
    }
    setError('')
    setStep('extracting')
    setExtractStep(0)

    try {
      const res = await fetch('/api/ai/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Failed to extract travel data')
        setStep('paste')
        return
      }

      setExtracted(data.extracted as ExtractedData)
      setStep('review')
    } catch {
      setError('Network error. Check your connection.')
      setStep('paste')
    }
  }

  const handleGenerate = async () => {
    if (!extracted || !token) return
    setStep('generating')

    // Map budgetHint to our tier + amount
    const budgetMap = { budget: 1500, mid: 3000, luxury: 7000 } as const
    const budgetLevel = (extracted.budgetHint || 'mid') as 'budget' | 'mid' | 'luxury'
    const budgetAmount = budgetMap[budgetLevel] || 3000

    // Calculate dates if not already set
    const today = new Date()
    const startDate = onboarding.startDate || new Date(today.setDate(today.getDate() + 14)).toISOString().split('T')[0]
    const endDate = onboarding.endDate || new Date(new Date(startDate).setDate(new Date(startDate).getDate() + (extracted.suggestedDays || 5) - 1)).toISOString().split('T')[0]

    // Update store with extracted data
    setVibes(extracted.vibes.slice(0, 3))
    setBudget(budgetLevel, budgetAmount)
    if (!onboarding.startDate) setDates(startDate, endDate)

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'itinerary',
          destination: extracted.primaryDestination,
          country: extracted.country,
          vibes: extracted.vibes.slice(0, 3),
          start_date: startDate,
          end_date: endDate,
          travelers: onboarding.travelers || 2,
          budget: budgetLevel,
          budgetAmount,
          origin: onboarding.origin || 'Delhi',
          urlHighlights: extracted.highlights.map((h) => ({
            name: h.name,
            category: h.category,
            detail: h.detail,
            estimatedPrice: h.estimatedPrice,
            inferredFromDestination: h.inferredFromDestination,
          })),
          urlSummary: extracted.summary,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error || !data.trip) {
        setError(data.error || 'Trip generation failed')
        setStep('review')
        return
      }

      setCurrentTrip(data.trip)

      const itemsRes = await supabase
        .from('itinerary_items')
        .select('*')
        .eq('trip_id', data.trip.id)
        .order('position')

      if (itemsRes.data) setCurrentItems(itemsRes.data)

      router.push(`/m/board/${data.trip.id}`)
    } catch {
      setError('Generation failed. Check your connection.')
      setStep('review')
    }
  }

  const categoryIcon: Record<string, string> = {
    activity: '🏄',
    food: '🍜',
    hotel: '🏨',
    sightseeing: '📸',
    nature: '🌿',
    nightlife: '🌙',
    shopping: '🛍',
    cultural: '🏛',
  }

  if (!authResolved) return (
    <div className="flex h-full items-center justify-center bg-drift-bg">
      <div className="text-drift-text3 text-sm animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="mb-3">
          <BackButton href="/m/plan/origin" />
        </div>
        <h1 className="mb-1 font-serif text-3xl font-light">
          Paste a <em className="font-normal italic text-drift-gold">link</em>
        </h1>
        <p className="mb-5 text-xs text-drift-text3">
          YouTube, Instagram reel, blog post — we&apos;ll build a trip from it
        </p>
      </div>

      {/* ── Paste Step ── */}
      {step === 'paste' && (
        <div className="flex flex-1 flex-col px-6">
          <div className="relative mb-4">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full rounded-[14px] border border-drift-border2 bg-transparent px-4 py-3.5 pr-12 text-sm text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
            />
            {url && (
              <button
                onClick={() => setUrl('')}
                aria-label="Clear URL"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-drift-text3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-drift-err/20 bg-drift-err/5 px-3 py-2.5 text-[11px] text-drift-err">
              {error}
            </div>
          )}

          {/* Supported sources */}
          <div className="mb-6 flex flex-wrap gap-2">
            {['YouTube', 'Instagram Reels', 'Blog Posts', 'TripAdvisor'].map((s) => (
              <span key={s} className="rounded-full border border-drift-border2 bg-drift-surface px-3 py-1.5 text-[10px] text-drift-text3">
                {s}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <button
              onClick={handleExtract}
              disabled={!url.trim()}
              className={`w-full rounded-[14px] py-4 text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${
                url.trim()
                  ? 'bg-drift-gold text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)]'
                  : 'bg-drift-gold/30 text-drift-text3 cursor-not-allowed'
              }`}
            >
              Extract Trip
            </button>
            <button
              onClick={() => router.push('/m/plan/origin')}
              className="mt-3 w-full text-center text-[11px] text-drift-text3"
            >
              or plan manually instead
            </button>
          </div>
        </div>
      )}

      {/* ── Extracting Step ── */}
      {step === 'extracting' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
          <div className="w-full max-w-[220px]">
            {extractSteps.map((text, i) => (
              <div
                key={text}
                className="flex items-center gap-2.5 py-2 transition-all duration-500"
                style={{
                  opacity: i <= extractStep ? (i < extractStep ? 0.3 : 1) : 0,
                  transform: i <= extractStep ? 'translateY(0)' : 'translateY(6px)',
                }}
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full transition-all"
                  style={{
                    background: i === extractStep ? '#c8a44e' : '#4a4a55',
                    boxShadow: i === extractStep ? '0 0 10px rgba(200,164,78,0.5)' : 'none',
                  }}
                />
                <span className="text-xs" style={{ color: i === extractStep ? '#c8a44e' : '#7a7a88' }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Review Step ── */}
      {step === 'review' && extracted && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {/* Source badge */}
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full border border-drift-gold/15 bg-drift-gold-bg px-2.5 py-1 text-[9px] font-medium text-drift-gold">
                {extracted.sourceType === 'youtube' ? 'YouTube' : extracted.sourceType === 'instagram' ? 'Instagram' : 'Article'}
              </span>
              <span className="text-[10px] text-drift-text3 line-clamp-1">{extracted.sourceTitle}</span>
            </div>

            {/* Destination card */}
            <div className="mb-4 rounded-2xl border border-drift-border bg-drift-card p-4">
              <div className="font-serif text-xl font-semibold text-drift-text">
                {extracted.primaryDestination}
                {extracted.country && (
                  <span className="font-normal italic text-drift-text2">, {extracted.country}</span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-drift-text2">{extracted.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extracted.vibes.map((v) => (
                  <span key={v} className="rounded-full border border-drift-gold/15 bg-drift-gold-bg px-2.5 py-1 text-[9px] font-medium text-drift-gold">
                    {v}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-3 border-t border-drift-border2 pt-3">
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold text-drift-text">{extracted.suggestedDays}</div>
                  <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Days</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold text-drift-text">{extracted.highlights.length}</div>
                  <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Places</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold capitalize text-drift-text">{extracted.budgetHint}</div>
                  <div className="text-[8px] font-semibold uppercase tracking-wider text-drift-text3">Budget</div>
                </div>
              </div>
            </div>

            {/* Highlights list */}
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-drift-text3">
              Extracted places ({extracted.highlights.length})
            </div>
            <div className="space-y-2">
              {extracted.highlights.map((h, i) => (
                <div key={`${h.name}-${i}`} className="flex items-start gap-3 rounded-xl border border-drift-border2 bg-drift-surface p-3">
                  <span className="mt-0.5 text-base">{categoryIcon[h.category] || '📍'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-drift-text line-clamp-1">{h.name}</span>
                      {h.inferredFromDestination && (
                        <span className="shrink-0 rounded bg-drift-surface2 px-1.5 py-0.5 text-[7px] font-medium text-drift-text3">AI added</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-drift-text3 line-clamp-2">{h.detail}</div>
                    {h.estimatedPrice && (
                      <div className="mt-1 text-[10px] font-semibold text-drift-gold">{h.estimatedPrice}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-drift-err/20 bg-drift-err/5 px-3 py-2.5 text-[11px] text-drift-err">
                {error}
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="shrink-0 border-t border-drift-border2 px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
            <button
              onClick={handleGenerate}
              className="w-full rounded-[14px] bg-drift-gold py-4 text-xs font-extrabold uppercase tracking-widest text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)] transition-transform active:scale-[0.97]"
            >
              Build My Trip
            </button>
            <button
              onClick={() => { setStep('paste'); setExtracted(null); setError('') }}
              className="mt-2 w-full text-center text-[11px] text-drift-text3"
            >
              Try a different link
            </button>
          </div>
        </div>
      )}

      {/* ── Generating Step ── */}
      {step === 'generating' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
          <div className="text-sm text-drift-text2">Building your trip from the link...</div>
          <div className="text-[10px] text-drift-text3">Real flights + enriched with local data</div>
        </div>
      )}
    </div>
  )
}
