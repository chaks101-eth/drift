'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'

interface TripRow {
  id: string
  destination: string
  country: string
  start_date: string | null
  end_date: string | null
}

export default function ProfileTab() {
  const router = useRouter()
  const userEmail = useTripStore((s) => s.userEmail)
  const token = useTripStore((s) => s.token)
  const [trips, setTrips] = useState<TripRow[]>([])
  const [loading, setLoading] = useState(true)

  const initials = userEmail ? userEmail[0].toUpperCase() : '?'
  const displayName = userEmail ? userEmail.split('@')[0] : 'Guest'

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function fetchTrips() {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('id, destination, country, start_date, end_date')
          .order('created_at', { ascending: false })
          .limit(50)

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

  // Stats
  const tripCount = trips.length
  const countries = new Set(trips.map((t) => t.country).filter(Boolean)).size
  const totalDays = trips.reduce((sum, t) => {
    if (t.start_date && t.end_date) {
      return sum + Math.max(1, Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000))
    }
    return sum
  }, 0)

  async function handleSignOut() {
    await supabase.auth.signOut()
    useTripStore.getState().setAuth(null, null, null)
    router.push('/m/login')
  }

  return (
    <div className="h-full overflow-y-auto px-5 pb-28 pt-2">
      {/* User header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-drift-gold to-amber-700 flex items-center justify-center flex-shrink-0">
          <span className="text-[22px] font-semibold text-drift-bg font-serif">{initials}</span>
        </div>
        <div>
          <div className="text-[18px] font-semibold text-drift-text font-serif">{displayName}</div>
          <div className="text-[12px] text-drift-text3 mt-0.5">{userEmail || ''}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { value: loading ? '-' : tripCount, label: 'Trips' },
          { value: loading ? '-' : countries, label: 'Countries' },
          { value: loading ? '-' : totalDays, label: 'Days' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-drift-card border border-drift-border2 rounded-xl py-4 flex flex-col items-center"
          >
            <div className="text-[20px] font-semibold text-drift-gold">{stat.value}</div>
            <div className="text-[11px] text-drift-text3 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="mb-7">
        <h2 className="text-[13px] font-semibold text-drift-text3 uppercase tracking-wider mb-3">
          Legal
        </h2>
        <div className="bg-drift-card border border-drift-border2 rounded-xl overflow-hidden">
          <a
            href="https://drifttravel.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3.5 border-b border-drift-border2"
          >
            <span className="text-[13px] text-drift-text">Privacy Policy</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-drift-text3">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
          <a
            href="https://drifttravel.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3.5"
          >
            <span className="text-[13px] text-drift-text">Terms of Service</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-drift-text3">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>
      </div>

      {/* Delete Account */}
      <div className="mb-7">
        <h2 className="text-[13px] font-semibold text-drift-text3 uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="bg-drift-card border border-drift-border2 rounded-xl px-4 py-3.5">
          <p className="text-[13px] text-drift-text mb-1">Delete Account</p>
          <p className="text-[11px] text-drift-text3 leading-relaxed">
            To delete your account and all associated data, email{' '}
            <span className="text-drift-gold">privacy@drifttravel.app</span>
          </p>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 text-center text-[14px] font-medium text-red-500 bg-drift-card border border-drift-border2 rounded-xl active:opacity-70 transition-opacity"
      >
        Sign Out
      </button>
    </div>
  )
}
