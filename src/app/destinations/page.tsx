'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ITINERARY_MESSAGES } from '@/lib/loading-messages'
import NavBar from '@/app/NavBar'

type Destination = {
  name: string
  country: string
  match: number
  price: string
  tags: string[]
  image_url: string
  description: string
}

export default function DestinationsPage() {
  const router = useRouter()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [loadMsg, setLoadMsg] = useState(0)
  const [loadProgress, setLoadProgress] = useState(0)
  const [vibeData, setVibeData] = useState<{
    vibes: string[]; budget: string; travelers: number; startDate: string; endDate: string; origin?: string
  } | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('drift_vibes')
    if (!stored) { router.push('/vibes'); return }

    const data = JSON.parse(stored)
    setVibeData(data)
    fetchDestinations(data)
  }, [router])

  // Progressive loading messages during generation
  useEffect(() => {
    if (!generating) return
    const interval = setInterval(() => {
      setLoadMsg(prev => (prev + 1) % ITINERARY_MESSAGES.length)
      setLoadProgress(prev => Math.min(prev + 22, 95))
    }, 2200)
    return () => clearInterval(interval)
  }, [generating])

  async function fetchDestinations(data: { vibes: string[]; budget: string; origin?: string }) {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'destinations',
          vibes: data.vibes,
          budget: data.budget,
          origin: data.origin || 'Delhi',
        }),
      })
      const result = await res.json()
      setDestinations(result.destinations || [])
    } catch {
      setDestinations([
        { name: 'Bali', country: 'Indonesia', match: 97, price: '$2,200', tags: ['Temples', 'Rice Terraces', 'Surf'], image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&h=400&fit=crop', description: 'Spiritual island paradise with world-class surfing and ancient temples.' },
        { name: 'Santorini', country: 'Greece', match: 93, price: '$2,800', tags: ['Sunsets', 'Wine', 'Blue Domes'], image_url: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=600&h=400&fit=crop', description: 'Iconic white-washed villages perched on volcanic cliffs.' },
        { name: 'Tokyo', country: 'Japan', match: 89, price: '$3,100', tags: ['Ramen', 'Shibuya', 'Shrines'], image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop', description: 'Where ancient tradition meets neon-lit futurism.' },
      ])
    }
    setLoading(false)
  }

  async function selectDestination(dest: Destination) {
    if (!vibeData) return
    setGenerating(true)
    setLoadMsg(0)
    setLoadProgress(5)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'itinerary',
          destination: dest.name,
          country: dest.country,
          vibes: vibeData.vibes,
          start_date: vibeData.startDate || '2026-04-10',
          end_date: vibeData.endDate || '2026-04-17',
          travelers: vibeData.travelers || 2,
          budget: vibeData.budget || 'mid',
          origin: vibeData.origin || 'Delhi',
        }),
      })
      const result = await res.json()
      if (result.trip) {
        setLoadProgress(100)
        setTimeout(() => router.push(`/trip/${result.trip.id}`), 400)
      } else {
        console.error('Generation failed:', result.error || result)
        setGenerating(false)
      }
    } catch (err) {
      console.error('Itinerary generation error:', err)
      setGenerating(false)
    }
  }

  // ─── Loading Overlay (philosophy: loading states build anticipation) ───
  if (generating) {
    const msg = ITINERARY_MESSAGES[loadMsg]
    return (
      <div className="fixed inset-0 z-[300] bg-[#08080c] flex items-center justify-center flex-col gap-6">
        {/* Glowing spinner */}
        <div className="w-16 h-16 rounded-full flex items-center justify-center animate-[load-breathe_2s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.2), transparent 70%)' }}>
          <div className="w-8 h-8 rounded-full border-[1.5px] border-[#c8a44e] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
        </div>
        {/* Message */}
        <div className="font-serif text-[22px] text-center leading-snug transition-opacity duration-400"
          dangerouslySetInnerHTML={{ __html: msg.text.replace(/<em>/g, '<em class="text-[#c8a44e] italic">') }}
        />
        {/* Step */}
        <div className="text-xs text-[#4a4a55] tracking-[1px] uppercase transition-opacity duration-400">{msg.step}</div>
        {/* Progress bar */}
        <div className="w-[200px] h-0.5 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
          <div
            className="h-full rounded-sm transition-[width] duration-600 ease-out"
            style={{ width: `${loadProgress}%`, background: 'linear-gradient(90deg, #c8a44e, #e8cc6e)' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080c]">
      <NavBar showBack />
      <div className="max-w-[1200px] mx-auto px-8 pt-[76px] pb-16 max-md:px-4 max-md:pt-[60px] max-md:pb-24">
        <p className="text-[11px] tracking-[4px] uppercase text-[#c8a44e] mb-2">Step 2</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-normal mb-2 text-[#f0efe8] max-md:text-[clamp(22px,6vw,32px)]">
          Your <em className="text-[#c8a44e] italic">destinations</em>
        </h1>
        <p className="text-[15px] text-[#7a7a85] mb-9 max-md:text-[13px] max-md:mb-6">AI-curated places that match your energy. Tap to build your trip.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20 flex-col gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center animate-[load-breathe_2s_ease-in-out_infinite]"
              style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.2), transparent 70%)' }}>
              <div className="w-6 h-6 rounded-full border-[1.5px] border-[#c8a44e] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
            </div>
            <div className="font-serif text-xl text-[#c8a44e]">Finding perfect matches...</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 dest-grid-responsive">
            {destinations.map((d, i) => (
              <div
                key={i}
                onClick={() => selectDestination(d)}
                className="rounded-2xl overflow-hidden cursor-pointer border border-[rgba(255,255,255,0.05)] bg-[#0e0e14] transition-all duration-[450ms] ease-[cubic-bezier(0.4,0,0.15,1)] hover:-translate-y-1.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.5),0_0_0_1px_rgba(200,164,78,0.1)] hover:border-[rgba(200,164,78,0.15)] active:-translate-y-0.5 active:scale-[0.99]"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <img src={d.image_url} alt={d.name} className="w-full h-[200px] object-cover block max-md:h-[180px]" />
                <div className="p-[18px] max-md:p-3.5">
                  <div className="font-serif text-[22px] mb-0.5 text-[#f0efe8] max-md:text-xl">{d.name}</div>
                  <div className="text-xs text-[#7a7a85] mb-2.5">{d.country}</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {d.tags.map(t => (
                      <span key={t} className="px-2.5 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-full text-[10px] text-[#7a7a85]">{t}</span>
                    ))}
                  </div>
                  <div className="flex justify-between items-baseline">
                    <div className="text-xl font-light text-[#c8a44e] max-md:text-lg">
                      {d.price} <span className="text-[11px] text-[#4a4a55]">/ person</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-[rgba(200,164,78,0.15)] border border-[rgba(200,164,78,0.2)] rounded-full text-[11px] font-semibold text-[#c8a44e]">
                      {d.match}% Match
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push('/vibes')}
          className="mt-8 text-[#7a7a85] text-sm hover:text-[#f0efe8] transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to vibes
        </button>
      </div>
    </div>
  )
}
