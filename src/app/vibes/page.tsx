'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/NavBar'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import { useTripStore } from '@/stores/trip-store'

const VIBES = [
  { id: 'beach', name: 'Beach Chill', desc: 'Sun, sand, zero stress', img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=400&h=300&fit=crop&q=80' },
  { id: 'adventure', name: 'Adventure', desc: 'Hikes, thrills, adrenaline', img: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400&h=300&fit=crop&q=80' },
  { id: 'city', name: 'City Nights', desc: 'Rooftops, lights, energy', img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&h=300&fit=crop&q=80' },
  { id: 'romance', name: 'Romance', desc: 'Sunsets, wine, intimacy', img: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=400&h=300&fit=crop&q=80' },
  { id: 'luxury', name: 'Luxury', desc: 'Five stars, private pools, VIP', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=300&fit=crop&q=80' },
  { id: 'wellness', name: 'Wellness & Spa', desc: 'Detox, yoga, massages', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop&q=80' },
  { id: 'spiritual', name: 'Spiritual', desc: 'Peace, temples, mindfulness', img: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=400&h=300&fit=crop&q=80' },
  { id: 'foodie', name: 'Foodie Trail', desc: 'Street food & fine dining', img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&q=80' },
  { id: 'party', name: 'Party Mode', desc: 'Clubs, festivals, all night', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&q=80' },
  { id: 'nature', name: 'Nature Escape', desc: 'Mountains, lakes, wildlife', img: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=300&fit=crop&q=80' },
  { id: 'family', name: 'Family Fun', desc: 'Kid-friendly, safe, memorable', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop&q=80' },
  { id: 'backpacker', name: 'Backpacker', desc: 'Hostels, budget, freedom', img: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=400&h=300&fit=crop&q=80' },
  { id: 'culture', name: 'Culture Deep Dive', desc: 'Art, history, local life', img: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&h=300&fit=crop&q=80' },
  { id: 'shopping', name: 'Shop Till You Drop', desc: 'Markets, malls, souvenirs', img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop&q=80' },
  { id: 'hidden', name: 'Hidden Gems', desc: 'Off-the-beaten-path spots', img: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&h=300&fit=crop&q=80' },
]

const BUDGETS = [
  { id: 'budget', label: 'Budget', amount: 1500, desc: 'Hostels, street food, walking tours' },
  { id: 'mid', label: 'Comfort', amount: 3000, desc: '3-4 star hotels, local restaurants' },
  { id: 'luxury', label: 'Luxury', amount: 7000, desc: '5-star resorts, premium experiences' },
]

export default function VibesPage() {
  return (
    <DesktopAuthProvider>
      <VibesContent />
    </DesktopAuthProvider>
  )
}

function VibesContent() {
  const router = useRouter()
  const { setVibes, setOrigin, setDates, setBudget, setTravelers, setOccasion, onboarding } = useTripStore()

  const [selected, setSelected] = useState<string[]>(onboarding.pickedVibes || [])
  const [origin, setOriginLocal] = useState(onboarding.origin || '')
  const [startDate, setStartDate] = useState(onboarding.startDate || '')
  const [endDate, setEndDate] = useState(onboarding.endDate || '')
  const [budget, setBudgetLocal] = useState<'budget' | 'mid' | 'luxury'>(onboarding.budgetLevel || 'mid')
  const [travelers, setTravelersLocal] = useState(onboarding.travelers || 2)
  const [occasion, setOccasionLocal] = useState('')
  const [navigating, setNavigating] = useState(false)

  function toggleVibe(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : prev.length < 3 ? [...prev, id] : prev)
  }

  function handleContinue() {
    if (selected.length === 0 || navigating) return
    setNavigating(true)

    // Save to trip store
    setVibes(selected)
    if (origin) setOrigin(origin)
    if (startDate && endDate) setDates(startDate, endDate)
    const budgetDef = BUDGETS.find(b => b.id === budget)
    setBudget(budget, budgetDef?.amount || 3000)
    setTravelers(travelers)
    if (occasion) setOccasion(occasion)

    router.push('/destinations')
  }

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text">
      <NavBar />
      <div className="mx-auto max-w-[1100px] px-8 pt-20 pb-16">
        {/* Header */}
        <p className="text-[11px] tracking-[4px] uppercase text-drift-gold font-semibold mb-2">Set the mood</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-normal mb-2">
          What&apos;s your <em className="text-drift-gold italic">vibe</em>?
        </h1>
        <p className="text-[15px] text-drift-text2 mb-8">Pick up to 3 vibes. We&apos;ll find destinations that match your energy.</p>

        {/* Vibe grid */}
        <div className="grid grid-cols-5 gap-3 mb-10 max-lg:grid-cols-3 max-md:grid-cols-2">
          {VIBES.map(v => {
            const isSelected = selected.includes(v.id)
            return (
              <div
                key={v.id}
                onClick={() => toggleVibe(v.id)}
                className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                  isSelected
                    ? 'border-drift-gold shadow-[0_0_24px_rgba(200,164,78,0.2)] scale-[1.02]'
                    : 'border-transparent hover:border-[rgba(255,255,255,0.1)] hover:-translate-y-1'
                }`}
              >
                <div className="relative h-[140px]">
                  <Image src={v.img} alt={v.name} fill className="object-cover" sizes="220px" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.9)] via-[rgba(8,8,12,0.3)] to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-[13px] font-semibold">{v.name}</div>
                  <div className="text-[10px] text-drift-text3">{v.desc}</div>
                </div>
                {/* Check */}
                <div className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected ? 'border-drift-gold bg-drift-gold' : 'border-white/25'
                }`}>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Trip details */}
        <div className="grid grid-cols-3 gap-6 mb-8 max-md:grid-cols-1">
          {/* Origin */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-drift-text3 mb-2 block">Flying from</label>
            <input
              value={origin}
              onChange={e => setOriginLocal(e.target.value)}
              placeholder="Delhi, Mumbai, London..."
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Dates */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-drift-text3 mb-2 block">Travel dates</label>
            <div className="flex gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="flex-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="flex-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm text-drift-text focus:border-drift-gold/30 focus:outline-none" />
            </div>
          </div>

          {/* Travelers */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-drift-text3 mb-2 block">Travelers</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setTravelersLocal(Math.max(1, travelers - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-colors">−</button>
              <span className="text-lg font-semibold w-8 text-center">{travelers}</span>
              <button onClick={() => setTravelersLocal(Math.min(12, travelers + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] text-drift-text3 hover:border-drift-gold/20 hover:text-drift-gold transition-colors">+</button>
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="mb-10">
          <label className="text-[10px] font-bold uppercase tracking-wider text-drift-text3 mb-3 block">Budget per person</label>
          <div className="flex gap-3">
            {BUDGETS.map(b => (
              <button
                key={b.id}
                onClick={() => setBudgetLocal(b.id as 'budget' | 'mid' | 'luxury')}
                className={`flex-1 rounded-xl border px-4 py-4 text-left transition-all ${
                  budget === b.id
                    ? 'border-drift-gold bg-drift-gold/10'
                    : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
              >
                <div className={`text-sm font-semibold ${budget === b.id ? 'text-drift-gold' : 'text-drift-text'}`}>{b.label}</div>
                <div className="text-[11px] text-drift-text3 mt-0.5">${b.amount.toLocaleString()}/person</div>
                <div className="text-[10px] text-drift-text3/60 mt-0.5">{b.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={selected.length === 0 || navigating}
          className={`w-full max-w-[400px] mx-auto block rounded-full py-4 text-sm font-bold uppercase tracking-widest transition-all ${
            selected.length > 0 && !navigating
              ? 'bg-gradient-to-r from-drift-gold to-[#a88a3e] text-drift-bg shadow-[0_12px_40px_rgba(200,164,78,0.25)] hover:-translate-y-0.5'
              : 'bg-drift-gold/20 text-drift-text3 cursor-not-allowed'
          }`}
        >
          {navigating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
            </span>
          ) : (
            `Continue with ${selected.length} vibe${selected.length !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  )
}
