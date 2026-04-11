'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/stores/trip-store'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import NavBar from '@/app/NavBar'
import TripLoader, { STEPS, STEP_DURATIONS } from '@/components/shared/TripLoader'

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

  // Step progression
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0
    for (let i = 0; i < STEPS.length; i++) {
      elapsed += STEP_DURATIONS[i]
      timers.push(setTimeout(() => { if (!generationDone) setActiveStep(i) }, elapsed))
    }
    return () => timers.forEach(clearTimeout)
  }, [generationDone])

  // Generate trip
  useEffect(() => {
    if (started.current || !token || !onboarding.destination) return
    started.current = true

    const dest = onboarding.destination

    async function generate() {
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
        for (let s = activeStep + 1; s < STEPS.length; s++) {
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
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      <NavBar />
      <TripLoader
        city={dest?.city || 'Your destination'}
        country={dest?.country}
        vibes={onboarding.pickedVibes}
        budget={onboarding.budgetLevel}
        imageUrl={dest?.image_url || undefined}
        error={error}
        generationDone={generationDone}
        activeStep={activeStep}
        onRetry={() => { setError(null); started.current = false; window.location.reload() }}
        onGoBack={() => router.push('/destinations')}
      />
    </div>
  )
}
