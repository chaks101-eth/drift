'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080c]" />}>
      <DestinationsContent />
    </Suspense>
  )
}

function DestinationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [loadMsg, setLoadMsg] = useState(0)
  const [loadProgress, setLoadProgress] = useState(0)
  const [vibeData, setVibeData] = useState<{
    vibes: string[]; budget: string; budgetAmount?: number; travelers: number; startDate: string; endDate: string; origin?: string; occasion?: string
  } | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('drift_vibes')
    if (!stored) { router.push('/vibes'); return }

    const data = JSON.parse(stored)
    setVibeData(data)

    // Direct destination — skip selection, generate immediately
    const direct = searchParams.get('direct')
    if (direct) {
      selectDestinationDirect(data, direct)
      return
    }

    fetchDestinations(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams])

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
      setDestinations([])
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
          budgetAmount: vibeData.budgetAmount || undefined,
          origin: vibeData.origin || 'Delhi',
          occasion: vibeData.occasion || undefined,
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

  // Direct destination — skips destination picker entirely
  async function selectDestinationDirect(data: typeof vibeData, destName: string) {
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
          destination: destName,
          country: '',
          vibes: data?.vibes || [],
          start_date: data?.startDate || '2026-04-10',
          end_date: data?.endDate || '2026-04-17',
          travelers: data?.travelers || 2,
          budget: data?.budget || 'mid',
          budgetAmount: data?.budgetAmount || undefined,
          origin: data?.origin || 'Delhi',
        }),
      })
      const result = await res.json()
      if (result.trip) {
        setLoadProgress(100)
        setTimeout(() => router.push(`/trip/${result.trip.id}`), 400)
      } else {
        console.error('Generation failed:', result.error || result)
        setGenerating(false)
        // Fall back to showing destinations
        if (data) fetchDestinations(data)
      }
    } catch (err) {
      console.error('Direct generation error:', err)
      setGenerating(false)
      if (data) fetchDestinations(data)
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
        ) : destinations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 0 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
            </div>
            <h2 className="font-serif text-xl text-[#f0efe8] mb-2">No destinations available yet</h2>
            <p className="text-sm text-[#7a7a85] max-w-[320px] mx-auto mb-6">Our catalog is being built. Use the &quot;Already know your destination?&quot; field on the vibes page to go directly to any city.</p>
            <button
              onClick={() => router.push('/vibes')}
              className="px-6 py-2.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 transition-all"
            >
              Back to Vibes
            </button>
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
                  <div className="text-xs text-[#7a7a85] mb-2">{d.country}</div>
                  {d.description && (
                    <p className="text-[11px] text-[#4a4a55] leading-relaxed mb-2.5 line-clamp-2">{d.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {d.tags.map(t => (
                      <span key={t} className="px-2.5 py-0.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-full text-[10px] text-[#7a7a85]">{t}</span>
                    ))}
                  </div>
                  {/* Match bar */}
                  <div className="mb-3">
                    <div className="h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${d.match}%`,
                          background: d.match >= 90 ? 'linear-gradient(90deg, #4ecdc4, #c8a44e)' : d.match >= 75 ? '#c8a44e' : '#f0a500',
                        }}
                      />
                    </div>
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
