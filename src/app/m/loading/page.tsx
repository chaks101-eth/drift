'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'

const steps = [
  { text: 'Searching flights & checking weather', duration: 5000 },
  { text: 'Locking in must-see experiences', duration: 8000 },
  { text: 'Planning your day-by-day itinerary', duration: 18000 },
  { text: 'Filling in restaurants, transit & local tips', duration: 22000 },
  { text: 'Fetching photos & ratings', duration: 20000 },
  { text: 'Personalizing the finishing touches', duration: 10000 },
]

// Destination-specific tips shown during loading
const destTips: Record<string, string[]> = {
  bangkok: ['Pro tip: street food stalls with long local queues are always the best', 'The BTS Skytrain is faster than taxis during rush hour'],
  tokyo: ['Suica card works on all trains, buses, and even vending machines', 'Most restaurants in Tokyo are incredible — even the random ones'],
  bali: ['Sunrise at Mount Batur is worth the 2am wake-up call', 'Negotiate prices at markets — start at 50% of the asking price'],
  paris: ['Skip the Eiffel Tower restaurant — eat at Le Bouillon Chartier instead', 'The Marais on Sunday morning is pure magic'],
  dubai: ['Friday brunch is a Dubai institution — book ahead', 'The old souks in Deira are more authentic than the malls'],
  istanbul: ['Get a Museum Pass — it covers Topkapi, Hagia Sophia, and more', 'Take the ferry, not a taxi, to cross the Bosphorus'],
  lisbon: ['Tram 28 is iconic but try Tram 12 for fewer crowds', 'Pastéis de Belém is worth the queue — the secret is in the cinnamon'],
  singapore: ['Hawker centres are Michelin-quality food for $3', 'Gardens by the Bay light show at 7:45pm is free'],
}

function getRandomTip(dest: string): string | null {
  const key = dest.toLowerCase()
  for (const [k, tips] of Object.entries(destTips)) {
    if (key.includes(k) || k.includes(key)) {
      return tips[Math.floor(Math.random() * tips.length)]
    }
  }
  return null
}

export default function LoadingPage() {
  const router = useRouter()
  const { token, onboarding, setCurrentTrip, setCurrentItems } = useTripStore()
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [generationDone, setGenerationDone] = useState(false)
  const started = useRef(false)
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Show tip after a delay
  useEffect(() => {
    const destName = onboarding.destination?.city || ''
    const t = setTimeout(() => setTip(getRandomTip(destName)), 3000)
    return () => clearTimeout(t)
  }, [onboarding.destination?.city])

  // Step progression — follows real timing of backend steps
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

        if (!res.ok) {
          if (res.status === 429) throw new Error('rate_limit')
          if (res.status === 401) throw new Error('auth_expired')
          if (res.status >= 500) throw new Error('server_error')
          throw new Error('generation_failed')
        }
        const data = await res.json()
        if (!data.trip) throw new Error('No trip returned')

        setCurrentTrip(data.trip)
        setGenerationDone(true)

        const itemsRes = await supabase
          .from('itinerary_items')
          .select('*')
          .eq('trip_id', data.trip.id)
          .order('position')

        if (itemsRes.data) setCurrentItems(itemsRes.data)

        trackEvent('trip_generated', 'conversion', dest.city)

        // Fast-forward through remaining steps smoothly
        setGenerationDone(true)
        for (let s = activeStep + 1; s < steps.length; s++) {
          await new Promise(r => setTimeout(r, 400))
          setActiveStep(s)
        }

        // Run personalization while showing "finishing touches"
        try {
          const persRes = await fetch('/api/ai/personalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tripId: data.trip.id }),
          })
          const persData = await persRes.json()

          if (persData.status === 'personalized' && persData.updated > 0) {
            const freshItems = await supabase
              .from('itinerary_items')
              .select('*')
              .eq('trip_id', data.trip.id)
              .order('position')
            if (freshItems.data) setCurrentItems(freshItems.data)
          }
        } catch {
          console.warn('[Loading] Personalization failed, continuing with base trip')
        }

        // Navigate to board
        setTimeout(() => router.replace(`/m/board/${data.trip.id}`), 600)
      } catch (err) {
        const code = err instanceof Error ? err.message : 'unknown'
        const messages: Record<string, string> = {
          rate_limit: 'Too many trips generated. Please wait a minute and try again.',
          auth_expired: 'Your session expired. Please log in again.',
          server_error: 'Our AI is temporarily busy. Please try again in a moment.',
          generation_failed: 'Trip generation failed. Try a different destination or vibes.',
          'No trip returned': 'Trip generation produced no results. Try different vibes.',
          unknown: 'Something went wrong. Please try again.',
        }
        setError(messages[code] || messages.unknown)
        trackEvent('generation_failed', 'error', code)
      }
    }

    generate()
  }, [token, onboarding, setCurrentTrip, setCurrentItems, router])

  const destName = onboarding.destination?.city || ''
  const vibes = onboarding.pickedVibes || []

  return (
    <>
      <style>{`
        @keyframes orb { to { transform: rotate(360deg); } }
        @keyframes orb-rev { to { transform: rotate(-360deg); } }
        @keyframes core-p { 0%,100% { opacity:.4; transform:translate(-50%,-50%) scale(.85); } 50% { opacity:1; transform:translate(-50%,-50%) scale(1.15); } }
        @keyframes glow-p { 0%,100% { opacity:.15; transform:translate(-50%,-50%) scale(.9); } 50% { opacity:.35; transform:translate(-50%,-50%) scale(1.1); } }
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
      `}</style>

      <div className="flex h-full flex-col items-center justify-center px-9">
        {/* Destination name + vibes */}
        {destName && (
          <div className="mb-1 font-serif text-[28px] font-light tracking-tight text-drift-text opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.2s_forwards]">
            {destName}
          </div>
        )}
        {vibes.length > 0 && (
          <div className="mb-2 flex gap-1.5 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.4s_forwards]">
            {vibes.map(v => (
              <span key={v} className="rounded-full border border-drift-gold/20 bg-drift-gold-bg px-2 py-0.5 text-[8px] font-medium uppercase tracking-wider text-drift-gold">{v}</span>
            ))}
          </div>
        )}
        <div className="mb-9 text-[10px] uppercase tracking-[0.16em] text-drift-text3 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.5s_forwards]">
          Building your perfect trip
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

        {/* Steps with progress */}
        <div className="w-full max-w-[280px]">
          {steps.map((step, i) => {
            const isActive = i === activeStep
            const isDone = i < activeStep

            return (
              <div key={i} className="flex items-center gap-3 py-2 transition-all duration-500" style={{ opacity: isDone ? 0.3 : isActive ? 1 : 0.08, transform: isActive ? 'translateX(0)' : isDone ? 'translateX(0)' : 'translateX(4px)' }}>
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isDone ? 'bg-drift-gold/20 text-drift-gold' : isActive ? 'bg-drift-gold text-drift-bg' : 'bg-drift-surface2 text-drift-text3'}`}>
                  {isDone ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (i + 1)}
                </div>
                <div className="flex-1">
                  <div className="text-[12px] leading-snug" style={{ color: isActive ? '#c8a44e' : isDone ? '#7a7a85' : '#4a4a55' }}>
                    {step.text}
                  </div>
                  {isActive && (
                    <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-drift-border2">
                      <div className="h-full rounded-full bg-drift-gold" style={{ animation: `progress ${step.duration}ms linear forwards` }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Destination tip */}
        {tip && !error && (
          <div className="mt-8 max-w-[260px] rounded-xl border border-drift-gold/10 bg-drift-gold-bg px-4 py-3 opacity-0 animate-[fadeUp_0.5s_var(--ease-smooth)_forwards]">
            <div className="mb-1 text-[8px] font-bold uppercase tracking-wider text-drift-gold/60">Local tip</div>
            <p className="text-[11px] leading-relaxed text-drift-text2">{tip}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <div className="mt-3 flex gap-2 justify-center">
              <button
                onClick={() => { setError(null); started.current = false; setActiveStep(0); setGenerationDone(false) }}
                className="rounded-xl border border-drift-gold/20 bg-drift-gold-bg px-4 py-2 text-xs font-semibold text-drift-gold"
              >
                Retry
              </button>
              <button onClick={() => router.back()} className="rounded-xl border border-drift-border2 px-4 py-2 text-xs font-semibold text-drift-text3">
                Go back
              </button>
            </div>
          </div>
        )}

        {/* Cancel */}
        {!error && (
          <div className="mt-6 text-[11px] text-drift-text3">
            Taking longer than usual?{' '}
            <button onClick={() => router.push('/m/plan/destinations')} className="font-semibold text-drift-gold">Cancel</button>
          </div>
        )}
      </div>
    </>
  )
}
