'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/stores/trip-store'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import NavBar from '@/app/NavBar'

// ─── Step definitions ─────────────────────────────────────────
const STEPS = [
  { text: 'Searching flights & weather', duration: 6000 },
  { text: 'Locking in must-see spots', duration: 9000 },
  { text: 'Planning each day', duration: 18000 },
  { text: 'Adding restaurants & local tips', duration: 20000 },
  { text: 'Fetching real photos & ratings', duration: 18000 },
  { text: 'Personalizing', duration: 8000 },
]

// ─── Destination photo pools — real Unsplash photos per destination ───
const DEST_PHOTOS: Record<string, string[]> = {
  bali: [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=85',
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1600&q=85',
    'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?w=1600&q=85',
    'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1600&q=85',
    'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1600&q=85',
  ],
  tokyo: [
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=85',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&q=85',
    'https://images.unsplash.com/photo-1554797589-7241bb691973?w=1600&q=85',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1600&q=85',
  ],
  dubai: [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&q=85',
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1600&q=85',
    'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=1600&q=85',
  ],
  paris: [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1600&q=85',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1600&q=85',
    'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=1600&q=85',
  ],
  maldives: [
    'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1600&q=85',
    'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=1600&q=85',
    'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=1600&q=85',
  ],
  phuket: [
    'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1600&q=85',
    'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=1600&q=85',
  ],
  singapore: [
    'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&q=85',
    'https://images.unsplash.com/photo-1508964942454-1461b938cc78?w=1600&q=85',
  ],
  bangkok: [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1600&q=85',
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1600&q=85',
  ],
}

// Generic fallback photos for unknown destinations
const GENERIC_PHOTOS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=85',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=85',
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&q=85',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=85',
]

// ─── Fun facts shown during loading ───────────────────────────
const FACTS: Record<string, string[]> = {
  bali: ['Bali has over 20,000 temples', 'The average Bali meal costs ₹300', 'Ubud\'s rice terraces are UNESCO-listed'],
  tokyo: ['Tokyo has more Michelin stars than any city', 'The busiest crossing: 3,000 people per light', 'Vending machines outnumber people in some areas'],
  dubai: ['The Burj Khalifa took 6 years to build', 'Dubai has no income tax', 'Gold ATMs exist in Dubai malls'],
  paris: ['The Eiffel Tower was meant to be temporary', 'Paris has 450+ parks and gardens', 'The Louvre would take 100 days to see everything'],
  maldives: ['1,192 coral islands, only 200 inhabited', 'Highest point: 2.4 meters above sea level', 'Underwater cabinet meetings have been held here'],
  default: ['Drift uses real flight prices, not estimates', 'Every place is verified on Google Maps', 'Your trip has zero invented venues'],
}

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

  // Photo slideshow
  const [photoIdx, setPhotoIdx] = useState(0)
  const [factIdx, setFactIdx] = useState(0)

  const dest = onboarding.destination
  const destKey = dest?.city?.toLowerCase() || ''
  const photos = DEST_PHOTOS[destKey] || (dest?.image_url ? [dest.image_url, ...GENERIC_PHOTOS] : GENERIC_PHOTOS)
  const facts = FACTS[destKey] || FACTS.default

  // Step progression
  useEffect(() => {
    let elapsed = 0
    for (let i = 0; i < STEPS.length; i++) {
      elapsed += STEPS[i].duration
      const timer = setTimeout(() => {
        if (!generationDone) setActiveStep(i)
      }, elapsed)
      stepTimers.current.push(timer)
    }
    return () => stepTimers.current.forEach(clearTimeout)
  }, [generationDone])

  // Photo rotation — every 5s
  useEffect(() => {
    if (photos.length <= 1) return
    const t = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), 5000)
    return () => clearInterval(t)
  }, [photos.length])

  // Fact rotation — every 7s
  useEffect(() => {
    if (facts.length <= 1) return
    const t = setInterval(() => setFactIdx(i => (i + 1) % facts.length), 7000)
    return () => clearInterval(t)
  }, [facts.length])

  // Warn before leaving during generation
  useEffect(() => {
    if (generationDone || error) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generationDone, error])

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

  const progressPct = Math.min(100, Math.round(((activeStep + 1) / STEPS.length) * 100))

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text relative overflow-hidden">
      <NavBar />

      {/* ═══ Full-bleed photo slideshow background ═══ */}
      <div className="fixed inset-0 z-0">
        {photos.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
            style={{ opacity: i === photoIdx ? 1 : 0 }}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized
              priority={i === 0}
            />
          </div>
        ))}
        {/* Dark overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-drift-bg/70 via-drift-bg/80 to-drift-bg/95" />
        <div className="absolute inset-0 bg-drift-bg/40 backdrop-blur-[2px]" />
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10 flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-full max-w-[520px] text-center px-8">
          {/* Destination header */}
          {dest && (
            <div className="mb-10 animate-[fadeUp_0.8s_ease]">
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-drift-gold/60" />
                <span className="text-[10px] font-semibold tracking-[3px] uppercase text-drift-gold">Composing</span>
                <div className="h-px w-8 bg-drift-gold/60" />
              </div>
              <h1 className="font-serif text-[clamp(40px,5vw,56px)] font-light text-drift-text">{dest.city}</h1>
              {dest.country && <p className="text-[13px] text-drift-text3 mt-1 tracking-wide">{dest.country}</p>}
            </div>
          )}

          {/* Orbital spinner — smaller, elegant */}
          <div className="relative mx-auto mb-8 h-20 w-20">
            <div className="absolute inset-0 rounded-full border border-drift-gold/25 animate-spin" style={{ animationDuration: '7s' }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-drift-gold shadow-[0_0_10px_rgba(200,164,78,0.8)]" />
            </div>
            <div className="absolute inset-3 rounded-full border border-drift-gold/15 animate-spin" style={{ animationDuration: '11s', animationDirection: 'reverse' }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-drift-gold/60" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-[22px] italic text-drift-gold">D</span>
            </div>
          </div>

          {/* Progress bar */}
          {!error && (
            <div className="mb-8">
              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-drift-gold/60 via-drift-gold to-drift-gold/80 transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2.5 flex justify-between text-[9px] text-drift-text3 uppercase tracking-wider">
                <span className="tabular-nums">{progressPct}%</span>
                <span>{STEPS.length - activeStep - 1} steps left</span>
              </div>
            </div>
          )}

          {/* Current step — just the active one, not the whole list */}
          {!error && (
            <div className="mb-10">
              <div key={activeStep} className="flex items-center justify-center gap-2.5 animate-[fadeUp_0.4s_ease]">
                <div className="h-1.5 w-1.5 rounded-full bg-drift-gold shadow-[0_0_8px_rgba(200,164,78,0.8)] animate-pulse" />
                <span className="text-[13px] text-drift-gold font-medium">{STEPS[activeStep].text}</span>
              </div>
            </div>
          )}

          {/* Fun fact — rotates */}
          {!error && (
            <div className="mb-6">
              <div key={factIdx} className="animate-[fadeIn_0.8s_ease]">
                <p className="text-[12px] text-drift-text2/70 italic leading-relaxed">
                  &ldquo;{facts[factIdx]}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Photo indicator dots */}
          {!error && photos.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {photos.map((_, i) => (
                <div key={i} className={`h-[2px] rounded-full transition-all duration-700 ${i === photoIdx ? 'w-6 bg-drift-gold/70' : 'w-2 bg-white/20'}`} />
              ))}
            </div>
          )}

          {/* Don't leave warning */}
          {!error && !generationDone && (
            <p className="text-[10px] text-drift-text3/50">Please don&apos;t close this tab while composing</p>
          )}

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
                  className="rounded-full border border-white/[0.12] px-6 py-2.5 text-[11px] font-medium text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-all"
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
