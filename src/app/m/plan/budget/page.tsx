'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import { useTripStore } from '@/stores/trip-store'

const tiers = [
  { id: 'budget' as const, label: 'Budget', desc: 'Hostels & street food', defaultAmount: 1500 },
  { id: 'mid' as const, label: 'Comfort', desc: 'Hotels & dining out', defaultAmount: 3000 },
  { id: 'luxury' as const, label: 'Luxury', desc: '5-star & fine dining', defaultAmount: 7000 },
]

export default function BudgetPage() {
  const router = useRouter()
  const { onboarding, setBudget, setTravelers, formatBudget, token } = useTripStore()

  useEffect(() => { if (token === null) router.replace('/m/login') }, [token, router])
  const [level, setLevel] = useState(onboarding.budgetLevel)
  const [amount, setAmount] = useState(onboarding.budgetAmount)
  const [travelers, setTravelersLocal] = useState(onboarding.travelers)

  const handleTier = (tier: typeof tiers[number]) => {
    setLevel(tier.id)
    setAmount(tier.defaultAmount)
    setBudget(tier.id, tier.defaultAmount)
  }

  const handleSlider = (val: number) => {
    setAmount(val)
    const newLevel = val <= 2000 ? 'budget' : val <= 4500 ? 'mid' : 'luxury'
    setLevel(newLevel as 'budget' | 'mid' | 'luxury')
    setBudget(newLevel as 'budget' | 'mid' | 'luxury', val)
  }

  const adjustTravelers = (delta: number) => {
    const next = Math.max(1, Math.min(12, travelers + delta))
    setTravelersLocal(next)
    setTravelers(next)
  }

  const sliderPct = ((amount - 500) / (10000 - 500)) * 100

  return (
    <div className="flex h-full flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <StepHeader step={3} totalSteps={5} backHref="/m/plan/dates" />

      <h1 className="mb-2 font-serif text-[30px] font-light leading-tight">
        Who&apos;s going &amp; <em className="font-normal italic text-drift-gold">how much?</em>
      </h1>
      <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">We&apos;ll tailor everything to your group</p>

      {/* Traveler count */}
      <div className="mb-6 mt-5">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => adjustTravelers(-1)}
            aria-label="Remove traveler"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-drift-border2 bg-drift-surface text-xl text-drift-text transition-all active:scale-95"
          >
            −
          </button>
          <div className="min-w-[56px] text-center">
            <div className="font-serif text-[40px] font-light leading-none text-drift-text" aria-live="polite">
              {travelers}
            </div>
          </div>
          <button
            onClick={() => adjustTravelers(1)}
            aria-label="Add traveler"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-drift-border2 bg-drift-surface text-xl text-drift-text transition-all active:scale-95"
          >
            +
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-drift-text3">
          {travelers === 1 ? 'person' : 'people'}
        </div>
      </div>

      {/* Budget tiers */}
      <div className="mb-4">
        <div className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-drift-text3">
          Budget per person
        </div>
        <div className="flex gap-2">
          {tiers.map((tier) => (
            <button
              key={tier.id}
              onClick={() => handleTier(tier)}
              className={`flex-1 rounded-[14px] border p-3.5 text-center transition-all duration-300 ${
                level === tier.id
                  ? 'border-drift-gold/30 bg-drift-gold-bg'
                  : 'border-drift-border2 bg-drift-surface'
              }`}
            >
              <div className="text-[13px] font-bold">{tier.label}</div>
              <div className="text-[9px] leading-snug text-drift-text3">{tier.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fine-tune slider */}
      <div className="rounded-2xl border border-drift-border2 bg-drift-surface p-[18px]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-drift-text3">
            Fine-tune budget
          </span>
          <span className="font-serif text-[28px] font-bold tracking-tight text-drift-gold">
            {formatBudget(amount)}
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={10000}
          step={250}
          value={amount}
          onChange={(e) => handleSlider(Number(e.target.value))}
          className="w-full"
          style={{
            background: `linear-gradient(90deg, var(--color-drift-gold) ${sliderPct}%, var(--color-drift-border2) ${sliderPct}%)`,
          }}
        />
        <div className="mt-1.5 flex justify-between">
          <span className="text-[8px] text-drift-text3">{formatBudget(500)}</span>
          <span className="text-[8px] text-drift-text3">{formatBudget(10000)}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-drift-border2 pt-2.5">
          <span className="text-[10px] text-drift-text3">Est. total for group</span>
          <span className="text-sm font-bold text-drift-text">{formatBudget(amount * travelers)}</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton onClick={() => router.push('/m/plan/vibes')}>
          Continue
        </GoldButton>
      </div>
    </div>
  )
}
