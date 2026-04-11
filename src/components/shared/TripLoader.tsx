'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

// ─── Step definitions ─────────────────────────────────────────
const STEPS = [
  'Searching flights & weather',
  'Locking in must-see spots',
  'Planning each day',
  'Adding restaurants & local tips',
  'Fetching real photos & ratings',
  'Personalizing',
]

const STEP_DURATIONS = [6000, 9000, 18000, 20000, 18000, 8000]

// ─── Contextual tips based on vibes + destination ─────────────
function generateTips(city: string, vibes: string[], budget: string): string[] {
  const tips: string[] = []

  // Destination-specific
  const destTips: Record<string, string[]> = {
    bali: ['Bali has over 20,000 temples', 'Ubud\'s rice terraces are UNESCO-listed', 'Nasi goreng costs about ₹150 at a local warung'],
    tokyo: ['Tokyo has more Michelin stars than any other city', 'The JR Pass saves 40-60% on bullet trains', 'Convenience store onigiri is a legit meal'],
    dubai: ['The Burj Khalifa took 6 years to build', 'Friday brunch is a Dubai institution', 'The metro is driverless and spotless'],
    paris: ['The Louvre would take 100 days to see fully', 'Parisians actually eat dinner after 8pm', 'The metro has 303 stations — walk when you can'],
    maldives: ['Only 200 of 1,192 islands are inhabited', 'Best visibility for snorkeling: Jan to Apr', 'Resorts are one per island — you get the whole thing'],
    bangkok: ['Street food in Bangkok averages ₹100-200 per dish', 'The BTS Skytrain beats taxis in rush hour', 'Temples close at 5pm — go early'],
    phuket: ['The Andaman side has calmer water Nov-Apr', 'Patong is for parties, Kata is for families', 'Longtail boats are cheaper than speedboats'],
    singapore: ['Hawker centres are Michelin-rated and cost ₹200', 'Gardens by the Bay is free to walk around', 'The MRT runs till midnight'],
    jaipur: ['The Pink City was painted pink in 1876 for a royal visit', 'Amer Fort is best visited before 10am', 'Lassi at Lassiwala is a must'],
    manali: ['Old Manali has the best cafés', 'Rohtang Pass needs a permit — book ahead', 'The Hadimba Temple is 500 years old'],
    istanbul: ['The Grand Bazaar has 4,000+ shops', 'A Bosphorus ferry costs ₹30', 'Turkish breakfast can last 2 hours'],
  }

  const key = city.toLowerCase()
  if (destTips[key]) tips.push(...destTips[key])

  // Vibe-specific
  if (vibes.includes('foodie')) tips.push('Drift prioritizes places with 4.5+ food ratings')
  if (vibes.includes('beach')) tips.push('Beach spots are timed for golden hour when possible')
  if (vibes.includes('adventure')) tips.push('Outdoor activities are scheduled for cooler morning hours')
  if (vibes.includes('romance')) tips.push('Romantic dinners are placed at sunset-facing venues')
  if (vibes.includes('spiritual')) tips.push('Temple visits are timed to avoid tour groups')
  if (vibes.includes('party')) tips.push('Nightlife spots are ordered by locals-to-tourists ratio')
  if (vibes.includes('luxury')) tips.push('Luxury picks are filtered by recent renovations')
  if (vibes.includes('culture')) tips.push('Cultural stops include lesser-known galleries and workshops')

  // Budget-specific
  if (budget === 'budget') tips.push('Budget trips use 3-star hotels with 4.0+ ratings — no compromising on clean')
  if (budget === 'luxury') tips.push('Luxury picks are cross-referenced with Condé Nast Traveler lists')

  // Drift-specific (always have some)
  tips.push('Every price in your trip is pulled live — not estimated')
  tips.push('Zero invented places. Every venue is verified on Google Maps')
  tips.push('Your trip has real review counts, not made-up ratings')

  return tips
}

// ─── Fallback photos ──────────────────────────────────────────
const FALLBACK_PHOTOS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=85',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=85',
  'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1600&q=85',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=85',
]

// ─── Props ────────────────────────────────────────────────────
interface Props {
  city: string
  country?: string
  vibes?: string[]
  budget?: string
  imageUrl?: string
  error?: string | null
  generationDone?: boolean
  activeStep: number
  onRetry?: () => void
  onGoBack?: () => void
}

export default function TripLoader({
  city, country, vibes = [], budget = 'mid', imageUrl,
  error, generationDone, activeStep, onRetry, onGoBack,
}: Props) {
  const [photos, setPhotos] = useState<string[]>(imageUrl ? [imageUrl] : [FALLBACK_PHOTOS[0]])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [tipIdx, setTipIdx] = useState(0)
  const fetchedRef = useRef(false)

  const tips = generateTips(city, vibes, budget)
  const progressPct = Math.min(100, Math.round(((activeStep + 1) / STEPS.length) * 100))

  // Fetch real destination photos
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const query = `${city}${country ? `, ${country}` : ''}`
    fetch(`/api/places/photos?q=${encodeURIComponent(query)}&count=6`)
      .then(r => r.json())
      .then(data => {
        if (data.photos?.length) {
          setPhotos(prev => [...new Set([...prev, ...data.photos])].slice(0, 8))
        } else if (photos.length <= 1) {
          // No Google photos — use fallbacks
          setPhotos(imageUrl ? [imageUrl, ...FALLBACK_PHOTOS] : FALLBACK_PHOTOS)
        }
      })
      .catch(() => {
        if (photos.length <= 1) setPhotos(imageUrl ? [imageUrl, ...FALLBACK_PHOTOS] : FALLBACK_PHOTOS)
      })
  }, [city, country]) // eslint-disable-line react-hooks/exhaustive-deps

  // Photo rotation
  useEffect(() => {
    if (photos.length <= 1) return
    const t = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), 5000)
    return () => clearInterval(t)
  }, [photos.length])

  // Tip rotation
  useEffect(() => {
    if (tips.length <= 1) return
    const t = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 6000)
    return () => clearInterval(t)
  }, [tips.length])

  // Warn before leaving
  useEffect(() => {
    if (generationDone || error) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generationDone, error])

  return (
    <div className="relative min-h-[calc(100vh-56px)] overflow-hidden">
      {/* ═══ Photo slideshow background ═══ */}
      <div className="fixed inset-0 z-0">
        {photos.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
            style={{ opacity: i === photoIdx ? 1 : 0 }}
          >
            <Image src={src} alt="" fill className="object-cover" sizes="100vw" unoptimized priority={i === 0} />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-[#08080c]/70 via-[#08080c]/80 to-[#08080c]/95" />
        <div className="absolute inset-0 bg-[#08080c]/40 backdrop-blur-[2px]" />
      </div>

      {/* ═══ Content ═══ */}
      <div className="relative z-10 flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-full max-w-[520px] text-center px-8">
          {/* Destination */}
          <div className="mb-10 animate-[fadeUp_0.8s_ease]">
            <div className="mb-3 flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-[#c8a44e]/60" />
              <span className="text-[10px] font-semibold tracking-[3px] uppercase text-[#c8a44e]">Composing</span>
              <div className="h-px w-8 bg-[#c8a44e]/60" />
            </div>
            <h1 className="font-serif text-[clamp(36px,8vw,56px)] font-light text-[#f0efe8]">{city}</h1>
            {country && <p className="text-[13px] text-[#7a7a85] mt-1 tracking-wide">{country}</p>}
          </div>

          {/* Orbital spinner */}
          <div className="relative mx-auto mb-8 h-20 w-20">
            <div className="absolute inset-0 rounded-full border border-[#c8a44e]/25 animate-spin" style={{ animationDuration: '7s' }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#c8a44e] shadow-[0_0_10px_rgba(200,164,78,0.8)]" />
            </div>
            <div className="absolute inset-3 rounded-full border border-[#c8a44e]/15 animate-spin" style={{ animationDuration: '11s', animationDirection: 'reverse' }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#c8a44e]/60" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-serif text-[22px] italic text-[#c8a44e]">D</span>
            </div>
          </div>

          {/* Progress bar */}
          {!error && (
            <div className="mb-8">
              <div className="h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#c8a44e]/60 via-[#c8a44e] to-[#c8a44e]/80 transition-all duration-700 ease-out rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2.5 flex justify-between text-[9px] text-[#7a7a85] uppercase tracking-wider">
                <span className="tabular-nums">{progressPct}%</span>
                <span>{STEPS.length - activeStep - 1} steps left</span>
              </div>
            </div>
          )}

          {/* Current step */}
          {!error && (
            <div className="mb-10">
              <div key={activeStep} className="flex items-center justify-center gap-2.5 animate-[fadeUp_0.4s_ease]">
                <div className="h-1.5 w-1.5 rounded-full bg-[#c8a44e] shadow-[0_0_8px_rgba(200,164,78,0.8)] animate-pulse" />
                <span className="text-[13px] text-[#c8a44e] font-medium">{STEPS[activeStep]}</span>
              </div>
            </div>
          )}

          {/* Contextual tip */}
          {!error && (
            <div className="mb-6">
              <div key={tipIdx} className="animate-[fadeIn_0.8s_ease]">
                <p className="text-[12px] text-[#f0efe8]/50 italic leading-relaxed">
                  &ldquo;{tips[tipIdx]}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Photo dots */}
          {!error && photos.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-6">
              {photos.map((_, i) => (
                <div key={i} className={`h-[2px] rounded-full transition-all duration-700 ${i === photoIdx ? 'w-6 bg-[#c8a44e]/70' : 'w-2 bg-white/20'}`} />
              ))}
            </div>
          )}

          {/* Don't leave */}
          {!error && !generationDone && (
            <p className="text-[10px] text-[#4a4a55]">Please don&apos;t close this tab while composing</p>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-[#e74c3c]/20 bg-[#e74c3c]/5 px-6 py-5 text-center animate-[fadeUp_0.3s_ease]">
              <p className="text-[13px] text-[#e74c3c] mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                {onRetry && (
                  <button onClick={onRetry} className="rounded-full bg-[#c8a44e] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#08080c] hover:-translate-y-0.5 transition-all">
                    Retry
                  </button>
                )}
                {onGoBack && (
                  <button onClick={onGoBack} className="rounded-full border border-white/[0.12] px-6 py-2.5 text-[11px] font-medium text-[#7a7a85] hover:border-[#c8a44e]/20 hover:text-[#c8a44e] transition-all">
                    Go back
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Export step definitions for parent pages
export { STEPS, STEP_DURATIONS }
