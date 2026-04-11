'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import NavBar from '@/app/NavBar'

// ─── Types ────────────────────────────────────────────────────
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

const EXTRACT_STEPS = [
  'Reading the content…',
  'Identifying destinations…',
  'Extracting places & activities…',
  'Building your preview…',
]

const CATEGORY_ICONS: Record<string, string> = {
  activity: '🏄', food: '🍜', hotel: '🏨', sightseeing: '📸',
  nature: '🌿', nightlife: '🌙', shopping: '🛍', cultural: '🏛',
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok',
}

// ─── Page ─────────────────────────────────────────────────────
export default function BuildFromLinkPage() {
  const router = useRouter()
  const {
    setOrigin, setDates, setBudget, setVibes,
    setCurrentTrip, setCurrentItems, onboarding,
  } = useTripStore()
  const isAnonymous = useTripStore((s) => s.isAnonymous)
  const userEmail = useTripStore((s) => s.userEmail)

  const [step, setStep] = useState<Step>('paste')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [extractStepIdx, setExtractStepIdx] = useState(0)

  // Trip details — pre-filled from extraction, user can adjust
  const [inputOrigin, setInputOrigin] = useState(onboarding.origin || '')
  const [inputTravelers, setInputTravelers] = useState(onboarding.travelers || 2)
  const [inputStartDate, setInputStartDate] = useState('')
  const [inputEndDate, setInputEndDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep] = useState(0)

  // Auth gate
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Mobile redirect
  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = '/m/plan/url'
    }
  }, [])

  // Ensure session exists
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        const { data } = await supabase.auth.signInAnonymously()
        if (data.session) {
          useTripStore.getState().setAuth(data.session.access_token, data.session.user.id, null)
        }
      } else {
        useTripStore.getState().setAuth(session.access_token, session.user.id, session.user.email || null)
      }
    })
  }, [])

  // Autofocus
  useEffect(() => {
    if (step === 'paste') setTimeout(() => inputRef.current?.focus(), 300)
  }, [step])

  // Extraction step animation
  useEffect(() => {
    if (step !== 'extracting') return
    setExtractStepIdx(0)
    const t = setInterval(() => setExtractStepIdx(prev => Math.min(prev + 1, EXTRACT_STEPS.length - 1)), 2200)
    return () => clearInterval(t)
  }, [step])

  // Generation step animation
  useEffect(() => {
    if (step !== 'generating') return
    setGenStep(0)
    const steps = ['Searching flights…', 'Composing days…', 'Fetching photos & ratings…', 'Personalizing…']
    let i = 0
    const t = setInterval(() => { i++; setGenStep(Math.min(i, steps.length - 1)) }, 5000)
    return () => clearInterval(t)
  }, [step])

  // Post-OAuth auto-generate
  useEffect(() => {
    if (!isAnonymous && userEmail && extracted) {
      const action = sessionStorage.getItem('drift-post-auth-action')
      if (action === 'generate-url') {
        sessionStorage.removeItem('drift-post-auth-action')
        handleGenerate()
      }
    }
  }, [isAnonymous, userEmail]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Extract ────────────────────────────────────────────────
  async function handleExtract() {
    if (!url.trim()) return
    try { new URL(url) } catch { setError('Paste a valid URL'); return }
    setError('')
    setStep('extracting')

    try {
      const t = useTripStore.getState().token
      const res = await fetch('/api/ai/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Could not extract travel data from this link')
        setStep('paste')
        return
      }
      const ext = data.extracted as ExtractedData
      setExtracted(ext)

      // Pre-fill dates
      if (ext.suggestedDays) {
        const start = new Date(Date.now() + 14 * 86400000)
        const end = new Date(start.getTime() + (ext.suggestedDays - 1) * 86400000)
        setInputStartDate(start.toISOString().slice(0, 10))
        setInputEndDate(end.toISOString().slice(0, 10))
      }

      setStep('review')
    } catch {
      setError('Network error. Check your connection.')
      setStep('paste')
    }
  }

  // ─── Generate ───────────────────────────────────────────────
  async function handleGenerate() {
    if (!extracted || generating) return

    // Auth gate
    if (isAnonymous) {
      setShowAuthGate(true)
      return
    }

    const t = useTripStore.getState().token
    if (!t) return

    setGenerating(true)
    setStep('generating')

    const budgetMap = { budget: 1500, mid: 3000, luxury: 7000 } as const
    const budgetLevel = (extracted.budgetHint || 'mid') as 'budget' | 'mid' | 'luxury'
    const budgetAmount = budgetMap[budgetLevel] || 3000

    setVibes(extracted.vibes.slice(0, 5))
    setBudget(budgetLevel, budgetAmount)
    setDates(inputStartDate, inputEndDate)
    if (inputOrigin) setOrigin(inputOrigin)

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          type: 'itinerary',
          destination: extracted.primaryDestination,
          country: extracted.country,
          vibes: extracted.vibes.slice(0, 5),
          start_date: inputStartDate,
          end_date: inputEndDate,
          travelers: inputTravelers,
          budget: budgetLevel,
          budgetAmount,
          origin: inputOrigin || 'Delhi',
          urlHighlights: extracted.highlights.map(h => ({
            name: h.name, category: h.category, detail: h.detail,
            estimatedPrice: h.estimatedPrice, inferredFromDestination: h.inferredFromDestination,
          })),
          urlSummary: extracted.summary,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error || !data.trip) {
        setError(data.error || 'Generation failed')
        setStep('review')
        setGenerating(false)
        return
      }

      setCurrentTrip(data.trip)
      const items = await supabase.from('itinerary_items').select('*').eq('trip_id', data.trip.id).order('position')
      if (items.data) setCurrentItems(items.data)

      router.push(`/trip/${data.trip.id}`)
    } catch {
      setError('Generation failed. Check your connection.')
      setStep('review')
      setGenerating(false)
    }
  }

  // ─── Google auth ────────────────────────────────────────────
  async function handleGoogleAuth() {
    setAuthLoading(true)
    try {
      sessionStorage.setItem('drift-login-return', '/build')
      sessionStorage.setItem('drift-post-auth-action', 'generate-url')
      const { error: err } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (err) {
        const { error: err2 } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/api/auth/callback` },
        })
        if (err2) setAuthLoading(false)
      }
    } catch { setAuthLoading(false) }
  }

  const fromContent = extracted?.highlights.filter(h => !h.inferredFromDestination) || []
  const aiSuggested = extracted?.highlights.filter(h => h.inferredFromDestination) || []
  const canGenerate = inputOrigin.trim().length > 0 && inputStartDate && inputEndDate && inputEndDate > inputStartDate
  const genSteps = ['Searching flights…', 'Composing days…', 'Fetching photos & ratings…', 'Personalizing…']

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text">
      <NavBar showBack />

      <div className="mx-auto max-w-[1200px] px-8 pt-20 pb-16">
        {/* ═══ PASTE STEP ═══ */}
        {step === 'paste' && (
          <div className="mx-auto max-w-[720px] pt-12 animate-[fadeUp_0.5s_ease]">
            <div className="mb-6 flex items-center gap-3">
              <div className="h-px w-6 bg-drift-gold/60" />
              <span className="font-mono text-[9px] tracking-[2px] uppercase text-drift-gold/80">Build from a link</span>
            </div>
            <h1 className="font-serif text-[clamp(32px,4vw,48px)] font-light leading-[1.05] tracking-[-0.02em] mb-4">
              Paste a reel, get a <em className="italic text-drift-gold">trip</em>.
            </h1>
            <p className="text-[14px] text-drift-text2 leading-relaxed mb-10 max-w-[520px]">
              YouTube, Instagram, TikTok, or any travel blog. Drift reads the content, extracts every place mentioned, and composes a bookable itinerary.
            </p>

            {/* URL input — big, prominent */}
            <div className="mb-4">
              <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 focus-within:border-drift-gold/30 transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-drift-text3 shrink-0">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <input
                    ref={inputRef}
                    value={url}
                    onChange={e => { setUrl(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleExtract()}
                    placeholder="https://youtube.com/watch?v=... or instagram.com/reel/..."
                    className="flex-1 bg-transparent text-[15px] text-drift-text placeholder:text-drift-text3/60 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleExtract}
                  disabled={!url.trim()}
                  className="shrink-0 rounded-2xl bg-drift-gold px-8 py-4 text-[11px] font-bold uppercase tracking-[2px] text-drift-bg transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] disabled:opacity-30 disabled:hover:translate-y-0"
                >
                  Extract
                </button>
              </div>
              {error && <div className="mt-3 text-[12px] text-drift-err">{error}</div>}
            </div>

            {/* Supported sources */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-drift-text3/60">Works with:</span>
              {['YouTube', 'Instagram Reels', 'TikTok', 'Travel blogs'].map(s => (
                <span key={s} className="rounded-md bg-white/[0.03] border border-white/[0.05] px-2.5 py-1 text-[9px] text-drift-text3">{s}</span>
              ))}
            </div>

            {/* Or plan manually */}
            <div className="mt-12 pt-8 border-t border-white/[0.05] text-center">
              <button onClick={() => router.push('/vibes')} className="text-[11px] text-drift-text3 hover:text-drift-gold transition-colors">
                Or plan manually with vibes →
              </button>
            </div>
          </div>
        )}

        {/* ═══ EXTRACTING STEP ═══ */}
        {step === 'extracting' && (
          <div className="mx-auto max-w-[480px] pt-24 text-center animate-[fadeUp_0.5s_ease]">
            {/* Orbital spinner */}
            <div className="relative mx-auto mb-10 h-24 w-24">
              <div className="absolute inset-0 rounded-full border border-drift-gold/25 animate-spin" style={{ animationDuration: '6s' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-drift-gold shadow-[0_0_12px_rgba(200,164,78,0.8)]" />
              </div>
              <div className="absolute inset-4 rounded-full border border-drift-gold/15 animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-drift-gold/70" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-serif text-[28px] italic text-drift-gold">D</span>
              </div>
            </div>

            <div className="font-serif text-[22px] font-light text-drift-text mb-6">Reading the link…</div>

            <div className="space-y-3 text-left max-w-[280px] mx-auto">
              {EXTRACT_STEPS.map((text, i) => (
                <div key={text} className={`flex items-center gap-3 transition-all duration-500 ${i <= extractStepIdx ? 'opacity-100' : 'opacity-0 translate-y-1'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all ${
                    i === extractStepIdx ? 'bg-drift-gold scale-150 shadow-[0_0_8px_rgba(200,164,78,0.8)]'
                    : i < extractStepIdx ? 'bg-drift-ok' : 'bg-drift-text3'
                  }`} />
                  <span className={`text-[12px] ${i === extractStepIdx ? 'text-drift-gold' : 'text-drift-text3'}`}>{text}</span>
                  {i < extractStepIdx && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2.5" className="ml-auto shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 text-[10px] text-drift-text3 font-mono tracking-wider truncate px-4">
              {url}
            </div>
          </div>
        )}

        {/* ═══ REVIEW STEP — Split layout ═══ */}
        {step === 'review' && extracted && (
          <div className="grid grid-cols-12 gap-10 pt-8 animate-[fadeUp_0.5s_ease]">
            {/* ─── LEFT: Extracted content ─── */}
            <div className="col-span-12 lg:col-span-7">
              {/* Source badge + destination */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-full border border-drift-gold/20 bg-drift-gold/[0.06] px-3 py-1 text-[9px] font-semibold text-drift-gold uppercase tracking-wider">
                    {SOURCE_LABELS[extracted.sourceType] || 'Link'}
                  </span>
                  <span className="text-[10px] text-drift-text3 truncate max-w-[400px]">{extracted.sourceTitle}</span>
                </div>
                <h1 className="font-serif text-[clamp(28px,3.5vw,44px)] font-light leading-[1.05] tracking-[-0.02em] mb-2">
                  {extracted.primaryDestination}
                  {extracted.country && <span className="text-drift-text3 italic font-light">, {extracted.country}</span>}
                </h1>
                <p className="text-[13px] text-drift-text2 leading-relaxed max-w-[520px]">{extracted.summary}</p>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-6 mb-8 pb-6 border-b border-white/[0.05]">
                {[
                  { v: String(extracted.highlights.length), l: 'Places' },
                  { v: `${extracted.suggestedDays}d`, l: 'Suggested' },
                  { v: extracted.budgetHint, l: 'Budget' },
                  { v: String(extracted.vibes.length), l: 'Vibes' },
                ].map((s, i) => (
                  <div key={i} className={i > 0 ? 'pl-6 border-l border-white/[0.05]' : ''}>
                    <div className="text-[16px] font-medium text-drift-text capitalize tabular-nums">{s.v}</div>
                    <div className="text-[9px] uppercase tracking-[1.5px] text-drift-text3 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Vibes */}
              <div className="mb-6 flex flex-wrap gap-1.5">
                {extracted.vibes.map(v => (
                  <span key={v} className="rounded-full bg-drift-gold/[0.08] border border-drift-gold/15 px-3 py-1 text-[10px] text-drift-gold font-medium">{v}</span>
                ))}
              </div>

              {/* From the content */}
              {fromContent.length > 0 && (
                <div className="mb-8">
                  <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-gold/80 mb-3">
                    From the {SOURCE_LABELS[extracted.sourceType]?.toLowerCase() || 'link'} · {fromContent.length}
                  </div>
                  <div className="space-y-2">
                    {fromContent.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-drift-gold/10 bg-drift-gold/[0.03] p-3.5">
                        <span className="mt-0.5 text-[14px]">{CATEGORY_ICONS[h.category] || '📍'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-semibold text-drift-text">{h.name}</div>
                          <div className="mt-0.5 text-[10px] text-drift-text3 leading-snug line-clamp-2">{h.detail}</div>
                          {h.estimatedPrice && <div className="mt-1 text-[10px] font-semibold text-drift-gold">{h.estimatedPrice}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI suggested */}
              {aiSuggested.length > 0 && (
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">
                    Drift also suggests · {aiSuggested.length}
                  </div>
                  <div className="space-y-2">
                    {aiSuggested.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3.5">
                        <span className="mt-0.5 text-[14px]">{CATEGORY_ICONS[h.category] || '📍'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-drift-text">{h.name}</span>
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-drift-text3">AI pick</span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-drift-text3 leading-snug line-clamp-2">{h.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Try different link */}
              <button
                onClick={() => { setStep('paste'); setExtracted(null); setError(''); setUrl('') }}
                className="mt-6 text-[11px] text-drift-text3 hover:text-drift-gold transition-colors"
              >
                ← Try a different link
              </button>
            </div>

            {/* ─── RIGHT: Trip details form + CTA ─── */}
            <div className="col-span-12 lg:col-span-5">
              <div className="sticky top-20">
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-8">
                  <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-5">Your details</div>

                  {/* Origin */}
                  <div className="mb-4">
                    <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3">Flying from</label>
                    <input
                      value={inputOrigin}
                      onChange={e => setInputOrigin(e.target.value)}
                      placeholder="Delhi, Mumbai, London…"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Dates */}
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3">Start</label>
                      <input type="date" value={inputStartDate} onChange={e => setInputStartDate(e.target.value)}
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[13px] text-drift-text focus:border-drift-gold/30 focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3">End</label>
                      <input type="date" value={inputEndDate} onChange={e => setInputEndDate(e.target.value)}
                        className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-[13px] text-drift-text focus:border-drift-gold/30 focus:outline-none [color-scheme:dark]" />
                    </div>
                  </div>

                  {/* Travelers */}
                  <div className="mb-6">
                    <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3">Travelers</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setInputTravelers(Math.max(1, inputTravelers - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] text-drift-text2 hover:border-drift-gold/20 hover:text-drift-gold transition-colors">−</button>
                      <span className="text-[16px] font-semibold text-drift-text w-6 text-center tabular-nums">{inputTravelers}</span>
                      <button onClick={() => setInputTravelers(Math.min(10, inputTravelers + 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] text-drift-text2 hover:border-drift-gold/20 hover:text-drift-gold transition-colors">+</button>
                    </div>
                  </div>

                  {error && <div className="mb-4 text-[11px] text-drift-err">{error}</div>}

                  {/* Generate CTA */}
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate || generating}
                    className={`w-full rounded-full py-4 text-[11px] font-bold uppercase tracking-[2px] transition-all ${
                      canGenerate && !generating
                        ? 'bg-drift-gold text-drift-bg hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)]'
                        : 'bg-drift-gold/20 text-drift-text3 cursor-not-allowed'
                    }`}
                  >
                    Build my {extracted.primaryDestination} trip
                  </button>

                  <div className="mt-3 text-center text-[9px] text-drift-text3">
                    {extracted.highlights.length} places from the link + Drift&apos;s own picks
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ GENERATING STEP ═══ */}
        {step === 'generating' && (
          <div className="mx-auto max-w-[480px] pt-24 text-center animate-[fadeUp_0.5s_ease]">
            <div className="relative mx-auto mb-10 h-24 w-24">
              <div className="absolute inset-0 rounded-full border border-drift-gold/25 animate-spin" style={{ animationDuration: '6s' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-drift-gold shadow-[0_0_12px_rgba(200,164,78,0.8)]" />
              </div>
              <div className="absolute inset-4 rounded-full border border-drift-gold/15 animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-serif text-[28px] italic text-drift-gold">D</span>
              </div>
            </div>

            <div className="font-serif text-[22px] font-light text-drift-text mb-2">
              Composing your {extracted?.primaryDestination} trip…
            </div>
            <p className="text-[12px] text-drift-text3 mb-8">
              Real flights, real hotels, {extracted?.highlights.length} places from the link.
            </p>

            <div className="space-y-2.5 text-left max-w-[280px] mx-auto">
              {genSteps.map((text, i) => (
                <div key={text} className={`flex items-center gap-3 transition-all duration-500 ${i <= genStep ? 'opacity-100' : 'opacity-0'}`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    i === genStep ? 'bg-drift-gold scale-150 shadow-[0_0_8px_rgba(200,164,78,0.8)]'
                    : i < genStep ? 'bg-drift-ok' : 'bg-drift-text3'
                  }`} />
                  <span className={`text-[12px] ${i === genStep ? 'text-drift-gold' : 'text-drift-text3'}`}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Auth gate modal */}
      {showAuthGate && (
        <>
          <div className="fixed inset-0 z-[240] bg-black/75 backdrop-blur-lg animate-[fadeIn_0.3s_ease]" onClick={() => !authLoading && setShowAuthGate(false)} />
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-8 pointer-events-none">
            <div className="relative w-full max-w-[420px] rounded-3xl border border-white/[0.06] bg-[#0c0c12] p-10 shadow-[0_60px_140px_rgba(0,0,0,0.85)] pointer-events-auto animate-[fadeUp_0.4s_ease]">
              <button onClick={() => setShowAuthGate(false)} disabled={authLoading}
                className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-drift-text3 hover:bg-white/[0.06] transition-colors disabled:opacity-30">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <div className="font-serif text-[28px] font-light text-drift-text mb-2">
                Save your trip with <em className="italic text-drift-gold">Google</em>
              </div>
              <p className="text-[13px] text-drift-text3 leading-relaxed mb-8">
                Sign in so your {extracted?.primaryDestination} trip is saved. Takes 2 seconds.
              </p>
              <button onClick={handleGoogleAuth} disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 rounded-full bg-white py-3.5 text-[13px] font-semibold text-[#1a1a1a] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60">
                {authLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" /> : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continue with Google
                  </>
                )}
              </button>
              <p className="mt-4 text-center text-[10px] text-drift-text3">We need an account to save your trip</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
