'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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

const genericTips = [
  'Drift picks restaurants based on local reviews, not tourist rankings',
  'Every item in your trip has a reason — tap any card to see why',
  'Don\'t like something? Tap the 3-dot menu to swap or remove it',
  'Your trip is personalized to your vibes, not a copy-paste template',
  'Ask the AI chat to adjust anything — budget, pace, or specific days',
]

function getAllTips(dest: string): string[] {
  const key = dest.toLowerCase()
  for (const [k, tips] of Object.entries(destTips)) {
    if (key.includes(k) || k.includes(key)) {
      return [...tips, ...genericTips]
    }
  }
  return genericTips
}

export default function LoadingPage() {
  const router = useRouter()
  const { token, userId, onboarding, setCurrentTrip, setCurrentItems } = useTripStore()
  const [activeStep, setActiveStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [generationDone, setGenerationDone] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(false)
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const generatedTripId = useRef<string | null>(null)

  // ─── Screen Wake Lock: prevent phone from sleeping during generation ───
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        console.log('[Loading] Wake lock acquired — screen will stay on')
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Loading] Wake lock released')
          wakeLockRef.current = null
        })
      }
    } catch {
      // Wake lock not supported or failed — non-fatal
      console.log('[Loading] Wake lock not available')
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }, [])

  // Acquire wake lock on mount, release on unmount or completion
  useEffect(() => {
    acquireWakeLock()
    return () => releaseWakeLock()
  }, [acquireWakeLock, releaseWakeLock])

  // Re-acquire wake lock when page becomes visible again (browser releases it on hide)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !generationDone && !error) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [generationDone, error, acquireWakeLock])

  // ─── Recovery: check if trip was created while screen was off ───
  useEffect(() => {
    const handleVisibilityRecovery = async () => {
      if (document.visibilityState !== 'visible') return
      if (generationDone || !started.current) return

      // If we already have a trip ID from the fetch, just redirect
      if (generatedTripId.current) {
        router.replace(`/m/board/${generatedTripId.current}`)
        return
      }

      // Check if the server created the trip while we were suspended
      if (token && userId && onboarding.destination) {
        console.log('[Loading] Screen resumed — checking if trip was created...')
        try {
          const { data } = await supabase
            .from('trips')
            .select('id')
            .eq('user_id', userId)
            .eq('destination', onboarding.destination.city)
            .order('created_at', { ascending: false })
            .limit(1)

          if (data?.length) {
            console.log('[Loading] Trip found after screen resume:', data[0].id)
            generatedTripId.current = data[0].id
            setGenerationDone(true)
            setError(null)

            // Load the trip data
            const itemsRes = await supabase
              .from('itinerary_items')
              .select('*')
              .eq('trip_id', data[0].id)
              .order('position')

            const tripRes = await supabase
              .from('trips')
              .select('*')
              .eq('id', data[0].id)
              .single()

            if (tripRes.data) setCurrentTrip(tripRes.data)
            if (itemsRes.data) setCurrentItems(itemsRes.data)

            releaseWakeLock()
            setTimeout(() => router.replace(`/m/board/${data[0].id}`), 600)
          }
        } catch (e) {
          console.warn('[Loading] Recovery check failed:', e)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityRecovery)
    return () => document.removeEventListener('visibilitychange', handleVisibilityRecovery)
  }, [token, userId, onboarding.destination, generationDone, router, setCurrentTrip, setCurrentItems, releaseWakeLock])

  // Track elapsed time for timeout warnings
  useEffect(() => {
    if (generationDone || error) return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [generationDone, error])

  // Rotate tips every 8 seconds
  useEffect(() => {
    const destName = onboarding.destination?.city || ''
    const tips = getAllTips(destName)
    let idx = 0
    const show = () => { setTip(tips[idx % tips.length]); idx++ }
    const delay = setTimeout(show, 3000)
    const interval = setInterval(show, 8000)
    return () => { clearTimeout(delay); clearInterval(interval) }
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

        generatedTripId.current = data.trip.id
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

        // Release wake lock and navigate to board
        releaseWakeLock()
        setTimeout(() => router.replace(`/m/board/${data.trip.id}`), 600)
      } catch (err) {
        const code = err instanceof Error ? err.message : 'unknown'

        // Before showing error, check if trip was actually created (fetch failed after server responded)
        if (token && userId && code !== 'rate_limit' && code !== 'auth_expired') {
          try {
            const { data } = await supabase
              .from('trips')
              .select('id')
              .eq('user_id', userId)
              .eq('destination', dest.city)
              .order('created_at', { ascending: false })
              .limit(1)

            if (data?.length) {
              // Trip exists! The fetch failed but the server succeeded
              console.log('[Loading] Trip found despite fetch error:', data[0].id)
              generatedTripId.current = data[0].id
              setGenerationDone(true)

              const [tripRes, itemsRes] = await Promise.all([
                supabase.from('trips').select('*').eq('id', data[0].id).single(),
                supabase.from('itinerary_items').select('*').eq('trip_id', data[0].id).order('position'),
              ])

              if (tripRes.data) setCurrentTrip(tripRes.data)
              if (itemsRes.data) setCurrentItems(itemsRes.data)

              trackEvent('trip_generated', 'conversion', dest.city)
              releaseWakeLock()
              setTimeout(() => router.replace(`/m/board/${data[0].id}`), 600)
              return
            }
          } catch {
            // Recovery check failed — show the original error
          }
        }

        const messages: Record<string, string> = {
          rate_limit: 'Too many trips generated. Please wait a minute and try again.',
          auth_expired: 'Your session expired. Please log in again.',
          server_error: 'Our AI is temporarily busy. Please try again in a moment.',
          generation_failed: 'Trip generation failed. Try a different destination or vibes.',
          'No trip returned': 'Trip generation produced no results. Try different vibes.',
          unknown: 'Something went wrong. Please try again.',
        }
        setError(messages[code] || messages.unknown)
        releaseWakeLock()
        trackEvent('generation_failed', 'error', code)
      }
    }

    generate()
  }, [token, onboarding, setCurrentTrip, setCurrentItems, router, userId, releaseWakeLock])

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
                onClick={() => { setError(null); started.current = false; setActiveStep(0); setGenerationDone(false); setElapsed(0) }}
                className="rounded-xl border border-drift-gold/20 bg-drift-gold-bg px-4 py-2 text-xs font-semibold text-drift-gold"
              >
                Retry
              </button>
              <button onClick={() => router.push('/m/plan/destinations')} className="rounded-xl border border-drift-border2 px-4 py-2 text-xs font-semibold text-drift-text3">
                Go back
              </button>
            </div>
          </div>
        )}

        {/* Timeout info */}
        {!error && elapsed >= 30 && elapsed < 60 && (
          <div className="mt-6 text-center text-[11px] text-drift-text3">
            Taking a moment — your trip is almost ready
          </div>
        )}
        {!error && elapsed >= 60 && (
          <div className="mt-6 text-center text-[11px] text-drift-text3">
            This is taking longer than expected ({elapsed}s).
            <br />
            <span className="text-drift-text3/60">Your trip will keep generating — you can wait or come back.</span>
            <br />
            <button onClick={() => router.push('/m/plan/destinations')} className="mt-2 font-semibold text-drift-gold">
              Pick a different destination
            </button>
          </div>
        )}

        {/* Keep screen on hint */}
        {!error && !generationDone && elapsed < 10 && (
          <div className="mt-6 text-center text-[10px] text-drift-text3/50 opacity-0 animate-[fadeUp_0.5s_var(--ease-smooth)_2s_forwards]">
            Keep this screen open — your trip is being built
          </div>
        )}
      </div>
    </>
  )
}
