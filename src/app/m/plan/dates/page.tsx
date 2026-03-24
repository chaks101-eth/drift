'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StepHeader from '@/components/mobile/StepHeader'
import GoldButton from '@/components/mobile/GoldButton'
import { useTripStore } from '@/stores/trip-store'

function getQuickDates(type: string): { start: string; end: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (type === 'weekend') {
    const day = now.getDay()
    const fri = new Date(now)
    fri.setDate(now.getDate() + ((5 - day + 7) % 7 || 7))
    const sun = new Date(fri)
    sun.setDate(fri.getDate() + 2)
    return { start: fmt(fri), end: fmt(sun) }
  }
  if (type === 'nextweek') {
    const mon = new Date(now)
    mon.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    return { start: fmt(mon), end: fmt(fri) }
  }
  if (type === '2weeks') {
    const start = new Date(now)
    start.setDate(now.getDate() + 14)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: fmt(start), end: fmt(end) }
  }
  // month
  const start = new Date(now)
  start.setMonth(now.getMonth() + 1, 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: fmt(start), end: fmt(end) }
}

const quickOptions = [
  { label: 'This Weekend', key: 'weekend' },
  { label: 'Next Week', key: 'nextweek' },
  { label: 'In 2 Weeks', key: '2weeks' },
  { label: 'Next Month', key: 'month' },
]

export default function DatesPage() {
  const router = useRouter()
  const { onboarding, setDates, token } = useTripStore()

  useEffect(() => { if (token === null) router.replace('/m/login') }, [token, router])

  const [startDate, setStartDate] = useState(onboarding.startDate)
  const [endDate, setEndDate] = useState(onboarding.endDate)
  const [error, setError] = useState('')
  const [activeQuick, setActiveQuick] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const isReady = startDate && endDate && endDate >= startDate

  const handleStartChange = (v: string) => {
    setStartDate(v)
    setActiveQuick(null)
    if (endDate && v > endDate) {
      setEndDate(v)
      setDates(v, v)
      setError('End date adjusted to match')
    } else {
      setDates(v, endDate)
      setError('')
    }
  }

  const handleEndChange = (v: string) => {
    if (v < startDate) {
      setError('Return must be after departure')
      return
    }
    setEndDate(v)
    setActiveQuick(null)
    setDates(startDate, v)
    setError('')
  }

  const handleQuick = (key: string) => {
    const { start, end } = getQuickDates(key)
    setStartDate(start)
    setEndDate(end)
    setActiveQuick(key)
    setDates(start, end)
    setError('')
  }

  return (
    <div className="flex h-full flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <StepHeader step={2} backHref="/m/plan/origin" />

      <h1 className="mb-2 font-serif text-4xl font-light leading-tight">
        When do you <em className="font-normal italic text-drift-gold">go?</em>
      </h1>
      <p className="mb-7 text-xs text-drift-text3">Pick your travel dates</p>

      {/* Date row */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
            Departure
          </label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-full rounded-[14px] border border-drift-border2 bg-transparent px-3.5 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-drift-text3">
            Return
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate || today}
            onChange={(e) => handleEndChange(e.target.value)}
            className="w-full rounded-[14px] border border-drift-border2 bg-transparent px-3.5 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {error && (
        <p className="mb-3 text-[10px] text-drift-err">{error}</p>
      )}

      {/* Quick picks */}
      <div className="mb-8">
        <div className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-drift-text3">
          Quick pick
        </div>
        <div className="flex flex-wrap gap-2">
          {quickOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleQuick(opt.key)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
                activeQuick === opt.key
                  ? 'border-drift-gold/30 bg-drift-gold-bg text-drift-gold'
                  : 'border-drift-border2 bg-transparent text-drift-text2 active:bg-drift-surface2'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <GoldButton ready={!!isReady} onClick={() => router.push('/m/plan/budget')}>
          Continue
        </GoldButton>
      </div>
    </div>
  )
}
