'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import { useTripStore } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

const quickCities = ['Delhi', 'Mumbai', 'Bangalore', 'London', 'New York', 'Dubai']

export default function OriginPage() {
  const router = useRouter()
  const { onboarding, setOrigin, token } = useTripStore()
  const [value, setValue] = useState(onboarding.origin)
  const [selectedChip, setSelectedChip] = useState<string | null>(onboarding.origin || null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) router.replace('/m/login')
  }, [token, router])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  const handleChip = (city: string) => {
    setValue(city)
    setSelectedChip(city)
    setOrigin(city)
  }

  const handleInput = (v: string) => {
    setValue(v)
    setSelectedChip(null)
    setOrigin(v)
  }

  const isReady = value.trim().length > 1

  return (
    <div className="flex h-full flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <StepHeader step={1} totalSteps={5} backHref="/m" />

      <h1 className="mb-2 font-serif text-4xl font-light leading-tight">
        Where are you<br />
        <em className="font-normal italic text-drift-gold">flying</em> from?
      </h1>
      <p className="mb-7 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">Your home city</p>

      {/* Input */}
      <div className="relative mb-7">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && isReady && router.push('/m/plan/dates')}
          placeholder="Delhi"
          className="w-full border-b border-drift-border2 bg-transparent pb-3 text-2xl font-light text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-drift-gold/50 via-drift-gold/20 to-transparent opacity-0 transition-opacity focus-within:opacity-100" />
      </div>

      {/* Quick chips */}
      <div className="mb-8 flex flex-wrap gap-2">
        {quickCities.map((city) => (
          <button
            key={city}
            onClick={() => handleChip(city)}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
              selectedChip === city
                ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton ready={isReady} onClick={() => router.push('/m/plan/dates')}>
          Continue
        </GoldButton>
        {/* Reel shortcut */}
        <button
          onClick={() => {
            if (!isReady) { inputRef.current?.focus(); return }
            trackEvent('plan_reel_shortcut', 'funnel')
            router.push('/m/plan/url')
          }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-drift-gold/20 bg-drift-gold/5 py-3 text-[12px] font-semibold text-drift-gold transition-all active:scale-[0.98]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
          </svg>
          Paste a reel or travel link instead
        </button>
      </div>
    </div>
  )
}
