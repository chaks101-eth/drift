'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import NavBar from '@/app/NavBar'

const steps = [
  { text: 'Searching flights & checking weather', duration: 5000 },
  { text: 'Locking in must-see experiences', duration: 8000 },
  { text: 'Planning your day-by-day itinerary', duration: 18000 },
  { text: 'Filling in restaurants, transit & local tips', duration: 22000 },
  { text: 'Fetching photos & ratings', duration: 20000 },
  { text: 'Personalizing the finishing touches', duration: 10000 },
]

export default function DesktopLoadingPage() {
  return (
    <DesktopAuthProvider>
      <LoadingContent />
    </DesktopAuthProvider>
  )
}

function LoadingContent() {
  const router = useRouter()
  const { token, onboarding } = useTripStore()
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [generationDone, setGenerationDone] = useState(false)
  const started = useRef(false)
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Step progression
  useEffect(() => {
    let elapsed = 0
    for (let i = 0; i < steps.length; i++) {
      elapsed += steps[i].duration
      const timer = setTimeout(() => {
        if (!generationDone) setActiveStep(i)
      }, elapsed)
      stepTimers.current.push(timer)
    }
    return () => stepTimers.current.forEach(clearTimeout)
  }, [generationDone])

  // Generate trip
  useEffect(() => {
    if (started.current || !token || !onboarding.destination) return
    started.current = true

    const dest = onboarding.destination

    async function generate() {
      // Check for URL-extracted highlights
      let urlHighlights: unknown[] | undefined
      let urlSummary: string | undefined
      try {
        const saved = sessionStorage.getItem('drift-url-highlights')
        if (saved) {
          const parsed = JSON.parse(saved)
          urlHighlights = parsed.highlights
          urlSummary = parsed.summary
          sessionStorage.removeItem('drift-url-highlights')
        }
      } catch { /* ignore */ }

      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: 'itinerary',
            destination: dest.city,
            country: dest.country || '',
            vibes: onboarding.pickedVibes,
            start_date: onboarding.startDate,
            end_date: onboarding.endDate,
            travelers: onboarding.travelers,
            budget: onboarding.budgetLevel,
            budgetAmount: onboarding.budgetAmount,
            origin: onboarding.origin || 'Delhi',
            ...(urlHighlights ? { urlHighlights, urlSummary } : {}),
          }),
        })

        if (!res.ok) throw new Error(`generation_failed_${res.status}`)
        const data = await res.json()
        if (!data.trip) throw new Error('no_trip')

        setGenerationDone(true)

        // Fast-forward steps
        for (let s = activeStep + 1; s < steps.length; s++) {
          await new Promise(r => setTimeout(r, 300))
          setActiveStep(s)
        }

        setTimeout(() => router.replace(`/trip/${data.trip.id}`), 800)
      } catch (err) {
        const code = err instanceof Error ? err.message : 'unknown'
        const messages: Record<string, string> = {
          'generation_failed_429': 'Too many requests. Wait a minute and try again.',
          'generation_failed_401': 'Session expired. Please refresh.',
          'generation_failed_502': 'AI is taking too long. Try again.',
          no_trip: 'Trip generation failed. Try a different destination.',
        }
        setError(messages[code] || 'Something went wrong. Try again.')
      }
    }

    generate()
  }, [token, onboarding, router, activeStep])

  const dest = onboarding.destination
  const destImage = dest?.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=80'

  // Compute progress percentage
  const progressPct = Math.min(100, Math.round(((activeStep + 1) / steps.length) * 100))

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text relative overflow-hidden">
      <NavBar />

      {/* Destination photo background */}
      {dest && (
        <div className="fixed inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${destImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-drift-bg via-drift-bg/80 to-drift-bg" />
          <div className="absolute inset-0 bg-drift-bg/60 backdrop-blur-md" />
        </div>
      )}

      <div className="relative z-10 flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-full max-w-[560px] text-center px-8">
          {/* Destination */}
          {dest && (
            <div className="mb-10 animate-[fadeUp_0.8s_ease]">
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-drift-gold opacity-60" />
                <span className="text-[10px] font-semibold tracking-[4px] uppercase text-drift-gold">Composing your trip</span>
                <div className="h-px w-8 bg-drift-gold opacity-60" />
              </div>
              <h1 className="font-serif text-[48px] font-light text-drift-text">{dest.city}</h1>
              {dest.country && <p className="text-[13px] text-drift-text3 mt-1 tracking-wide">{dest.country}</p>}
            </div>
          )}

          {/* Orbital spinner */}
          <div className="relative mx-auto mb-10 h-28 w-28">
            <div className="absolute inset-0 rounded-full border border-drift-gold/25 animate-spin" style={{ animationDuration: '8s' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-drift-gold shadow-[0_0_12px_rgba(200,164,78,0.8)]" />
            </div>
            <div className="absolute inset-4 rounded-full border border-drift-gold/15 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-drift-gold/70" />
            </div>
            <div className="absolute inset-8 rounded-full border border-drift-gold/10 animate-spin" style={{ animationDuration: '16s' }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-drift-gold/50" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-[28px] text-drift-gold">D</span>
            </div>
          </div>

          {/* Progress bar */}
          {!error && (
            <div className="mb-6">
              <div className="h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-drift-gold/50 via-drift-gold to-drift-gold/80 transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-drift-text3 uppercase tracking-wider">
                <span>{progressPct}%</span>
                <span>{steps.length - activeStep - 1} steps remaining</span>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2 mb-8">
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${
                i === activeStep ? 'opacity-100' : i < activeStep ? 'opacity-40' : 'opacity-15'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all ${
                  i === activeStep ? 'bg-drift-gold scale-150 shadow-[0_0_8px_rgba(200,164,78,0.8)]' : i < activeStep ? 'bg-drift-ok' : 'bg-drift-text3'
                }`} />
                <span className={`text-[13px] text-left ${i === activeStep ? 'text-drift-gold font-medium' : 'text-drift-text3'}`}>
                  {step.text}
                </span>
                {i < activeStep && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2" className="ml-auto shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-drift-err/20 bg-drift-err/5 px-6 py-5 text-center animate-[fadeUp_0.3s_ease]">
              <p className="text-[13px] text-drift-err mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setError(null); started.current = false; window.location.reload() }}
                  className="rounded-full bg-drift-gold px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-drift-bg hover:-translate-y-0.5 transition-all"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/destinations')}
                  className="rounded-full border border-[rgba(255,255,255,0.12)] px-6 py-2.5 text-[11px] font-medium text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-all"
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
