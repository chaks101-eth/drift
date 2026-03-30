'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'

interface TripRow {
  id: string
  destination: string
  country: string
  start_date: string | null
  end_date: string | null
  travelers: number | null
  vibes: string[] | null
  created_at: string
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!end) return fmt(start)
  return `${fmt(start)} — ${fmt(end)}`
}

function nightCount(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
}

export default function TripsTab() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const loadTrip = useTripStore((s) => s.loadTrip)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function fetchTrips() {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .order('created_at', { ascending: false })

        if (!cancelled) {
          if (error) setTrips([])
          else setTrips((data as TripRow[]) || [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) { setTrips([]); setLoading(false) }
      }
    }
    fetchTrips()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="px-5 pb-28 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-semibold text-drift-text">Your Trips</h1>
          <p className="text-[13px] text-drift-text3">Plan, track, and relive</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-[11px] text-drift-text3 text-center py-10">
          Loading your trips...
        </div>
      )}

      {/* Empty state */}
      {!loading && trips.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 px-4">
          <div className="w-12 h-12 rounded-full bg-drift-gold/10 flex items-center justify-center mb-4">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-drift-gold"
            >
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div className="text-[15px] font-medium text-drift-text mb-1.5">No trips yet</div>
          <div className="text-[12px] text-drift-text3 leading-relaxed max-w-[240px]">
            Your planned trips will appear here. Start with a vibe and let Drift handle the rest.
          </div>
        </div>
      )}

      {/* Trip list */}
      {!loading && trips.length > 0 && (
        <div className="space-y-3">
          {trips.map((t, i) => {
            const nights = nightCount(t.start_date, t.end_date)
            const dateStr = formatDateRange(t.start_date, t.end_date)

            return (
              <button
                key={t.id}
                onClick={() => {
                  // Navigate to trip and switch to board tab
                  loadTrip(t.id)
                  setActiveTab('board')
                  router.push(`/m/board/${t.id}`)
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-drift-border2 bg-drift-card px-4 py-4 text-left transition-all active:scale-[0.98]"
                style={{ animation: `fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}
              >
                {/* Destination initial */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-drift-gold/20 to-drift-gold/5">
                  <span className="font-serif text-lg text-drift-gold">
                    {t.destination?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-drift-text truncate">
                    {t.destination}
                    {t.country && <span className="font-normal text-drift-text3">, {t.country}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-drift-text3">
                    {dateStr && <span>{dateStr}</span>}
                    {nights > 0 && <span>· {nights}N</span>}
                    {t.travelers && t.travelers > 1 && <span>· {t.travelers} pax</span>}
                  </div>
                  {t.vibes && t.vibes.length > 0 && (
                    <div className="mt-1.5 flex gap-1.5">
                      {t.vibes.slice(0, 3).map((v) => (
                        <span key={v} className="rounded-full bg-drift-gold/10 px-2 py-0.5 text-[9px] font-medium text-drift-gold">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4a55" strokeWidth="1.5" className="shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
