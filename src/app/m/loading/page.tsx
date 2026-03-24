'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

const steps = [
  { text: 'Searching real-time flights', key: 'flights' },
  { text: 'Comparing hotels that match your vibes', key: 'hotels' },
  { text: 'Curating experiences locals recommend', key: 'experiences' },
  { text: 'Sequencing your days for best flow', key: 'sequence' },
  { text: 'Adding the finishing touches', key: 'finish' },
]

export default function LoadingPage() {
  const router = useRouter()
  const { token, onboarding, setCurrentTrip, setCurrentItems } = useTripStore()
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  // Step progression timer
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  // Generate trip on mount
  useEffect(() => {
    if (started.current || !token || !onboarding.destination) return
    started.current = true

    const dest = onboarding.destination

    async function generate() {
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: 'itinerary',
            destination: dest.city,
            country: dest.country,
            vibes: onboarding.pickedVibes,
            start_date: onboarding.startDate,
            end_date: onboarding.endDate,
            travelers: onboarding.travelers,
            budget: onboarding.budgetLevel,
            budgetAmount: onboarding.budgetAmount,
            origin: onboarding.origin,
            occasion: onboarding.occasion,
          }),
        })

        if (!res.ok) throw new Error(`Generation failed (${res.status})`)
        const data = await res.json()
        if (!data.trip) throw new Error('No trip returned')

        setCurrentTrip(data.trip)

        const itemsRes = await supabase
          .from('itinerary_items')
          .select('*')
          .eq('trip_id', data.trip.id)
          .order('position')

        if (itemsRes.data) setCurrentItems(itemsRes.data)

        trackEvent('trip_generated', 'conversion', dest.city)
        setActiveStep(steps.length - 2) // "Sequencing your days"

        // Run personalization while user watches loading screen
        try {
          const persRes = await fetch('/api/ai/personalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tripId: data.trip.id }),
          })
          const persData = await persRes.json()

          if (persData.status === 'personalized' && persData.updated > 0) {
            // Reload items with personalized metadata
            const freshItems = await supabase
              .from('itinerary_items')
              .select('*')
              .eq('trip_id', data.trip.id)
              .order('position')
            if (freshItems.data) setCurrentItems(freshItems.data)
          }
        } catch {
          // Personalization failed — trip still works, just without insights
          console.warn('[Loading] Personalization failed, continuing with base trip')
        }

        // Done — navigate to board
        setActiveStep(steps.length - 1)
        setTimeout(() => router.replace(`/m/board/${data.trip.id}`), 800)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Trip generation failed')
      }
    }

    generate()
  }, [token, onboarding, setCurrentTrip, setCurrentItems, router])

  const destName = onboarding.destination?.city || ''

  return (
    <>
      <style>{`
        @keyframes orb { to { transform: rotate(360deg); } }
        @keyframes orb-rev { to { transform: rotate(-360deg); } }
        @keyframes core-p { 0%,100% { opacity:.4; transform:translate(-50%,-50%) scale(.85); } 50% { opacity:1; transform:translate(-50%,-50%) scale(1.15); } }
        @keyframes glow-p { 0%,100% { opacity:.15; transform:translate(-50%,-50%) scale(.9); } 50% { opacity:.35; transform:translate(-50%,-50%) scale(1.1); } }
      `}</style>

      <div className="flex h-full flex-col items-center justify-center px-9">
        {/* Destination name */}
        {destName && (
          <div className="mb-1.5 font-serif text-[28px] font-light tracking-tight text-drift-text opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.2s_forwards]">
            {destName}
          </div>
        )}
        <div className="mb-9 text-[10px] uppercase tracking-[0.16em] text-drift-text3 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.5s_forwards]">
          Building your trip
        </div>

        {/* Orbital animation */}
        <div className="relative mb-11 h-[120px] w-[120px]">
          <div className="absolute left-1/2 top-1/2 h-[140px] w-[140px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.12), transparent 70%)', animation: 'glow-p 2.5s ease-in-out infinite', transform: 'translate(-50%, -50%)' }} />
          <div className="absolute inset-0 rounded-full" style={{ border: '1px solid transparent', borderTopColor: '#c8a44e', animation: 'orb 3s linear infinite' }} />
          <div className="absolute rounded-full" style={{ inset: 14, border: '1px solid transparent', borderRightColor: 'rgba(200,164,78,0.35)', animation: 'orb-rev 2s linear infinite' }} />
          <div className="absolute rounded-full" style={{ inset: 28, border: '1px solid transparent', borderBottomColor: 'rgba(200,164,78,0.15)', animation: 'orb 1.4s linear infinite' }} />
          <div className="absolute left-1/2 top-1/2 h-[44px] w-[44px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.1), transparent)', animation: 'core-p 2s ease-in-out infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center font-serif text-2xl font-light text-drift-gold">D</div>
        </div>

        {/* Steps */}
        <div className="w-full max-w-[260px]">
          {steps.map((step, i) => {
            const isActive = i === activeStep
            const isDone = i < activeStep
            const isVisible = i <= activeStep

            return (
              <div key={step.key} className="flex items-center gap-2.5 py-2 transition-all duration-500" style={{ opacity: isVisible ? (isDone ? 0.25 : 1) : 0, transform: isVisible ? 'translateY(0)' : 'translateY(6px)' }}>
                <div className="h-2 w-2 shrink-0 rounded-full transition-all duration-400" style={{ background: isActive ? '#c8a44e' : isDone ? '#c8a44e' : '#4a4a55', boxShadow: isActive ? '0 0 10px rgba(200,164,78,0.5)' : 'none' }} />
                <div className="text-[13px] leading-snug" style={{ color: isActive ? '#c8a44e' : '#7a7a88' }}>
                  {step.text}
                </div>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <button onClick={() => router.back()} className="mt-2 text-xs font-semibold text-drift-gold">Go back</button>
          </div>
        )}

        {/* Cancel */}
        {!error && (
          <div className="mt-8 text-[12px] text-drift-text3">
            Taking longer than usual?{' '}
            <button onClick={() => router.push('/m/plan/destinations')} className="font-semibold text-drift-gold">Cancel</button>
          </div>
        )}
      </div>
    </>
  )
}
