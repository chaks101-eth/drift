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

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text">
      <NavBar />
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-full max-w-[480px] text-center px-8">
          {/* Destination */}
          {dest && (
            <div className="mb-8">
              <h1 className="font-serif text-3xl text-drift-text">{dest.city}</h1>
              {dest.country && <p className="text-sm text-drift-text3 mt-1">{dest.country}</p>}
            </div>
          )}

          {/* Orbital spinner */}
          <div className="relative mx-auto mb-8 h-24 w-24">
            <div className="absolute inset-0 rounded-full border border-drift-gold/20 animate-spin" style={{ animationDuration: '8s' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-drift-gold" />
            </div>
            <div className="absolute inset-3 rounded-full border border-drift-gold/10 animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-drift-gold/60" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-2xl text-drift-gold">D</span>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2 mb-8">
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${
                i === activeStep ? 'opacity-100' : i < activeStep ? 'opacity-30' : 'opacity-0'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === activeStep ? 'bg-drift-gold scale-125' : i < activeStep ? 'bg-drift-ok' : 'bg-drift-text3'
                }`} />
                <span className={`text-[13px] ${i === activeStep ? 'text-drift-gold font-medium' : 'text-drift-text3'}`}>
                  {step.text}
                </span>
                {i < activeStep && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2" className="ml-auto"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-drift-err/20 bg-drift-err/5 px-5 py-4 text-center">
              <p className="text-[13px] text-drift-err mb-3">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => { setError(null); started.current = false }}
                  className="rounded-lg bg-drift-gold px-5 py-2 text-[12px] font-semibold text-drift-bg"
                >
                  Retry
                </button>
                <button
                  onClick={() => router.push('/destinations')}
                  className="rounded-lg border border-drift-border px-5 py-2 text-[12px] text-drift-text3"
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
