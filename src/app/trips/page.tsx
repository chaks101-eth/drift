'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TripSummary = {
  id: string
  destination: string
  country: string
  vibes: string[]
  start_date: string
  end_date: string
  travelers: number
  budget: string
  status: string
  created_at: string
}

export default function MyTripsPage() {
  const router = useRouter()
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data } = await supabase
        .from('trips')
        .select('id, destination, country, vibes, start_date, end_date, travelers, budget, status, created_at')
        .order('created_at', { ascending: false })

      setTrips((data || []) as TripSummary[])
      setLoading(false)
    }
    load()
  }, [router])

  const budgetLabel = (b: string) => b === 'luxury' ? '$$$' : b === 'mid' ? '$$' : '$'

  async function deleteTrip(e: React.MouseEvent, tripId: string) {
    e.stopPropagation()
    if (!confirm('Delete this trip? This cannot be undone.')) return
    await supabase.from('itinerary_items').delete().eq('trip_id', tripId)
    await supabase.from('trips').delete().eq('id', tripId)
    setTrips(prev => prev.filter(t => t.id !== tripId))
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Nav */}
      <div className="sticky top-0 z-30 bg-[#08080c]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-[900px] mx-auto flex items-center justify-between px-8 py-3 max-md:px-4">
          <button onClick={() => router.push('/')} className="font-serif text-xl text-[#c8a44e] hover:opacity-80 transition-opacity">Drift</button>
          <button
            onClick={() => router.push('/vibes')}
            className="px-5 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] hover:-translate-y-0.5 transition-all"
          >
            New Trip
          </button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 pt-10 pb-16 max-md:px-4 max-md:pt-6">
        <p className="text-[11px] tracking-[4px] uppercase text-[#c8a44e] mb-2">Your journeys</p>
        <h1 className="font-serif text-[clamp(28px,4vw,40px)] font-normal mb-2">
          My <em className="text-[#c8a44e] italic">Trips</em>
        </h1>
        <p className="text-[15px] text-[#7a7a85] mb-8">Every trip you&apos;ve planned. Tap to revisit and refine.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20 flex-col gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center animate-[load-breathe_2s_ease-in-out_infinite]"
              style={{ background: 'radial-gradient(circle, rgba(200,164,78,0.2), transparent 70%)' }}>
              <div className="w-6 h-6 rounded-full border-[1.5px] border-[#c8a44e] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
            </div>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 0 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
            </div>
            <h2 className="font-serif text-xl mb-2">No trips yet</h2>
            <p className="text-sm text-[#7a7a85] max-w-[320px] mx-auto mb-6">Your planned trips will appear here. Start by picking your vibes.</p>
            <button
              onClick={() => router.push('/vibes')}
              className="px-8 py-3 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 transition-all"
            >
              Plan Your First Trip
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip, i) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/trip/${trip.id}`)}
                className="group/trip flex items-center gap-5 p-4 rounded-2xl bg-[#0e0e14] border border-[rgba(255,255,255,0.05)] cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.15,1)] hover:-translate-y-0.5 hover:border-[rgba(200,164,78,0.15)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-md:flex-col max-md:items-start max-md:gap-3"
                style={{ animationDelay: `${i * 0.05}s`, animation: 'fadeUp 0.5s ease forwards', opacity: 0 }}
              >
                {/* Destination icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgba(200,164,78,0.12)] to-[rgba(200,164,78,0.04)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 0 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-lg text-[#f0efe8] truncate">{trip.destination}{trip.country ? `, ${trip.country}` : ''}</div>
                  <div className="text-xs text-[#7a7a85] mt-0.5">
                    {trip.start_date && trip.end_date ? `${trip.start_date} — ${trip.end_date}` : 'No dates set'}
                    {' · '}{trip.travelers} traveler{trip.travelers !== 1 ? 's' : ''}
                    {' · '}{budgetLabel(trip.budget)}
                  </div>
                  {trip.vibes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {trip.vibes.slice(0, 4).map(v => (
                        <span key={v} className="px-2 py-0.5 rounded-full text-[9px] text-[#c8a44e] border border-[rgba(200,164,78,0.2)] bg-[rgba(200,164,78,0.06)]">{v}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Delete + Arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => deleteTrip(e, trip.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4a4a55] hover:text-[#e74c3c] hover:bg-[rgba(231,76,60,0.08)] transition-all opacity-0 group-hover/trip:opacity-100 max-md:opacity-100"
                    title="Delete trip"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4a55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
