'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NavBar from '@/app/NavBar'

const VIBES = [
  { id: 'beach', name: 'Beach Chill', desc: 'Sun, sand, zero stress', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop' },
  { id: 'adventure', name: 'Adventure', desc: 'Hikes, thrills, adrenaline', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop' },
  { id: 'city', name: 'City Nights', desc: 'Rooftops, lights, energy', img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&h=300&fit=crop' },
  { id: 'romance', name: 'Romance', desc: 'Sunsets, wine, intimacy', img: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&h=300&fit=crop' },
  { id: 'spiritual', name: 'Spiritual', desc: 'Peace, temples, mindfulness', img: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=400&h=300&fit=crop' },
  { id: 'foodie', name: 'Foodie Trail', desc: 'Street food & fine dining', img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop' },
  { id: 'party', name: 'Party Mode', desc: 'Clubs, festivals, all night', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=300&fit=crop' },
  { id: 'solo', name: 'Solo Reset', desc: 'Find yourself, explore', img: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=300&fit=crop' },
  { id: 'winter', name: 'Winter Magic', desc: 'Snow, cozy, northern lights', img: 'https://images.unsplash.com/photo-1477601263568-180e2c6d046e?w=400&h=300&fit=crop' },
  { id: 'culture', name: 'Culture Deep Dive', desc: 'Art, history, local life', img: 'https://images.unsplash.com/photo-1533669955142-6a73332af4db?w=400&h=300&fit=crop' },
]

export default function VibesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080c]" />}>
      <VibesContent />
    </Suspense>
  )
}

function VibesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])
  const [budget, setBudget] = useState(3000)
  const [travelers, setTravelers] = useState(2)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [origin, setOrigin] = useState('')
  const [occasion, setOccasion] = useState('')
  const [directDest, setDirectDest] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    const surprise = searchParams.get('surprise')
    if (surprise) {
      const vibes = surprise.split(',').filter(v => VIBES.some(vb => vb.id === v))
      if (vibes.length > 0) setSelected(vibes)
    }
  }, [router, searchParams])

  function toggleVibe(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  async function handleContinue() {
    if (selected.length === 0) return
    setLoading(true)

    sessionStorage.setItem('drift_vibes', JSON.stringify({
      vibes: selected,
      budget: budget <= 2000 ? 'budget' : budget <= 4000 ? 'mid' : 'luxury',
      budgetAmount: budget,
      travelers,
      startDate,
      endDate,
      origin: origin || 'Delhi',
      occasion: occasion || undefined,
      directDestination: directDest || undefined,
    }))

    if (directDest) {
      // Skip destination selection — go straight to generation
      router.push(`/destinations?direct=${encodeURIComponent(directDest)}`)
    } else {
      router.push('/destinations')
    }
  }

  return (
    <div className="min-h-screen bg-[#08080c]">
      <NavBar />
      <div className="max-w-[1100px] mx-auto px-8 pt-[76px] pb-16 max-md:px-4 max-md:pt-[60px] max-md:pb-24">
        <p className="text-[11px] tracking-[4px] uppercase text-[#c8a44e] mb-2">Set the mood</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-normal mb-2 text-[#f0efe8] max-md:text-[clamp(22px,6vw,32px)] max-md:mb-1.5">
          What&apos;s your <em className="text-[#c8a44e] italic">vibe</em>?
        </h1>
        <p className="text-[15px] text-[#7a7a85] mb-9 max-md:text-[13px] max-md:mb-6">Pick as many as you feel. We&apos;ll curate destinations that match your energy.</p>

        {/* Vibe Grid — 5 cols desktop, 3 tablet, 2 mobile */}
        <div className="grid grid-cols-5 gap-3 mb-9 vibe-grid-responsive">
          {VIBES.map(v => (
            <div
              key={v.id}
              onClick={() => toggleVibe(v.id)}
              className={`relative h-[150px] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.2,0.64,1)] active:scale-[0.97] vibe-card-responsive ${
                selected.includes(v.id)
                  ? 'border-[#c8a44e] shadow-[0_0_24px_rgba(200,164,78,0.15)] scale-[1.02]'
                  : 'border-transparent scale-100'
              }`}
            >
              <img src={v.img} alt={v.name} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.15,1)] ${selected.includes(v.id) ? 'scale-[1.06]' : ''}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10 z-[1]" />
              {selected.includes(v.id) && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c8a44e] z-[3] flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              )}
              <div className="relative z-[2] h-full flex flex-col justify-end p-3.5">
                <div className="text-sm font-semibold text-white max-md:text-[13px]">{v.name}</div>
                <div className="text-[10px] text-white/65 mt-0.5 max-md:text-[9px]">{v.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Flying From */}
        <div className="mb-8">
          <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase">Flying from</h3>
          <input
            type="text"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            placeholder="e.g. Delhi, Mumbai, London"
            className="w-full max-w-[360px] px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all placeholder-[#4a4a55]"
          />
        </div>

        {/* Config Row — side by side desktop, stacked mobile */}
        <div className="flex gap-8 mb-8 config-row-responsive">
          <div className="flex-1">
            <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase">Budget per person</h3>
            <div className="text-2xl font-light text-[#c8a44e] font-serif mb-2.5 max-md:text-xl">${budget.toLocaleString()}</div>
            <input
              type="range"
              min={500}
              max={10000}
              step={100}
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-[#4a4a55]">
              <span>$500</span><span>$10,000</span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase">Travel Dates</h3>
            <div className="flex gap-2.5">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all"
              />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all"
              />
            </div>
            <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase mt-4">Travelers</h3>
            <div className="flex items-center gap-3.5">
              <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="w-[34px] h-[34px] rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#f0efe8] text-[15px] flex items-center justify-center hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all max-md:w-10 max-md:h-10 max-md:text-base">-</button>
              <span className="text-lg font-light min-w-[28px] text-center">{travelers}</span>
              <button onClick={() => setTravelers(travelers + 1)} className="w-[34px] h-[34px] rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[#f0efe8] text-[15px] flex items-center justify-center hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all max-md:w-10 max-md:h-10 max-md:text-base">+</button>
            </div>
          </div>
        </div>

        {/* Occasion */}
        <div className="mb-8">
          <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase">What&apos;s the occasion?</h3>
          <div className="flex flex-wrap gap-2">
            {['Just exploring', 'Honeymoon', 'Anniversary', 'Birthday', 'Girls/Guys Trip', 'Family', 'Weekend Getaway'].map(o => (
              <button
                key={o}
                onClick={() => setOccasion(occasion === o ? '' : o)}
                className={`px-3.5 py-1.5 rounded-full text-xs border transition-all ${
                  occasion === o
                    ? 'bg-[rgba(200,164,78,0.15)] border-[rgba(200,164,78,0.3)] text-[#c8a44e]'
                    : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)] text-[#7a7a85] hover:border-[rgba(255,255,255,0.12)]'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* I know where I'm going */}
        <div className="mb-8">
          <h3 className="text-[11px] font-medium text-[#7a7a85] mb-2.5 tracking-[1px] uppercase">Already know your destination?</h3>
          <input
            type="text"
            value={directDest}
            onChange={e => setDirectDest(e.target.value)}
            placeholder="e.g. Bali, Dubai, Goa — leave empty to get suggestions"
            className="w-full max-w-[360px] px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all placeholder-[#4a4a55]"
          />
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={selected.length === 0 || loading}
          className="px-11 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(200,164,78,0.3),0_4px_12px_rgba(200,164,78,0.15)] transition-all active:translate-y-0 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2.5"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-[1.5px] border-[#0a0a0f] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
              Finding your destinations...
            </>
          ) : (
            <>
              Plan My Trip
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
