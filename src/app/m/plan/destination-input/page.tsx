'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import BackButton from '@/components/mobile/BackButton'
import { useTripStore } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

const popularDestinations = [
  'Bali', 'Bangkok', 'Dubai', 'Paris', 'Tokyo',
  'Istanbul', 'Phuket', 'Singapore', 'Maldives', 'Goa',
  'London', 'Rome', 'Santorini', 'New York',
]

export default function DestinationInputPage() {
  const router = useRouter()
  const { onboarding, setDestination, setVibes, token } = useTripStore()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  const isReady = value.trim().length > 1

  // Vibes already picked from the vibes step
  const existingVibes = onboarding.pickedVibes

  const handleConfirm = () => {
    if (!isReady) return
    // Use vibes already picked in the vibes step — don't override
    // Only set if somehow empty (shouldn't happen in normal flow)
    if (!existingVibes.length) {
      const v = value.toLowerCase()
      const autoVibes: string[] = []
      if (['bali', 'maldives', 'phuket', 'goa', 'santorini'].some(d => v.includes(d))) autoVibes.push('beach')
      if (['paris', 'rome', 'istanbul'].some(d => v.includes(d))) autoVibes.push('culture')
      if (['bangkok', 'tokyo', 'singapore', 'dubai', 'new york', 'london'].some(d => v.includes(d))) autoVibes.push('city')
      if (autoVibes.length === 0) autoVibes.push('culture', 'foodie', 'adventure')
      setVibes(autoVibes.slice(0, 3))
    }

    // Build a Destination object for the store
    const parts = value.trim().split(',').map(s => s.trim())
    const city = parts[0]
    // Auto-detect country for popular destinations
    const countryMap: Record<string, string> = {
      bali: 'Indonesia', bangkok: 'Thailand', dubai: 'UAE', paris: 'France', tokyo: 'Japan',
      istanbul: 'Turkey', phuket: 'Thailand', singapore: 'Singapore', maldives: 'Maldives',
      goa: 'India', london: 'UK', rome: 'Italy', santorini: 'Greece', 'new york': 'USA',
      barcelona: 'Spain', lisbon: 'Portugal', amsterdam: 'Netherlands', prague: 'Czech Republic',
      vienna: 'Austria', berlin: 'Germany', seoul: 'South Korea', sydney: 'Australia',
      'cape town': 'South Africa', marrakech: 'Morocco', cairo: 'Egypt', jaipur: 'India',
      manali: 'India', delhi: 'India', mumbai: 'India', colombo: 'Sri Lanka', hanoi: 'Vietnam',
      'chiang mai': 'Thailand', krabi: 'Thailand', pattaya: 'Thailand', uluwatu: 'Indonesia',
    }
    const country = parts[1] || countryMap[city.toLowerCase()] || ''
    setDestination({ city, country, tagline: `Your ${city} adventure`, match: 100, vibes: existingVibes.length ? existingVibes : ['culture', 'foodie', 'adventure'] })
    trackEvent('plan_direct_destination', 'funnel', city)
    router.push('/m/loading')
  }

  if (!token) return null // wait for anonymous session

  return (
    <div className="flex h-full flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <div className="mb-6">
        <BackButton href="/m/plan/destinations" />
      </div>

      <h1 className="mb-2 font-serif text-4xl font-light leading-tight">
        Where do you<br />
        <em className="font-normal italic text-drift-gold">want to go</em>?
      </h1>
      <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">Type any destination</p>
      {existingVibes.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <span className="text-[9px] text-drift-text3 self-center mr-1">Your vibes:</span>
          {existingVibes.map(v => (
            <span key={v} className="rounded-full border border-drift-gold/15 bg-drift-gold-bg px-2.5 py-1 text-[9px] font-medium text-drift-gold">{v}</span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative mb-7">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          placeholder="Bali, Istanbul, Tokyo..."
          className="w-full border-b border-drift-border2 bg-transparent pb-3 text-2xl font-light text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />
      </div>

      {/* Popular destinations */}
      <div className="mb-8">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">Popular</p>
        <div className="flex flex-wrap gap-2">
          {popularDestinations.map((dest) => (
            <button
              key={dest}
              onClick={() => setValue(dest)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
                value === dest
                  ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                  : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
              }`}
            >
              {dest}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton ready={isReady} onClick={handleConfirm}>
          Plan My Trip
        </GoldButton>
      </div>
    </div>
  )
}
