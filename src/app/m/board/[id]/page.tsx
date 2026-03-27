'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTripStore } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'
import BottomNav from '@/components/mobile/BottomNav'
import Toast from '@/components/mobile/Toast'
import DetailSheet from '@/components/mobile/DetailSheet'
import ChatOverlay from '@/components/mobile/ChatOverlay'
import CardMenu from '@/components/mobile/CardMenu'
import RemixOverlay from '@/components/mobile/RemixOverlay'
import BoardView from '@/components/mobile/BoardView'
import TripsTab from '@/components/mobile/tabs/TripsTab'
import ProfileTab from '@/components/mobile/tabs/ProfileTab'

export default function BoardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { loadTrip, currentTrip, currentItems, token } = useTripStore()
  const { activeTab } = useUIStore()
  const [loading, setLoading] = useState(true)

  // Don't redirect immediately — token may be loading from session
  useEffect(() => {
    // Give auth 2s to initialize before redirecting
    const t = setTimeout(() => {
      if (token === null) router.replace('/m/login')
    }, 2000)
    return () => clearTimeout(t)
  }, [token, router])

  useEffect(() => {
    if (id && token) {
      setLoading(true)
      loadTrip(id).then(() => {
        setLoading(false)
        // Check if personalization is needed and trigger it
        fetch('/api/ai/personalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tripId: id }),
        }).then(async (res) => {
          if (!res.ok) { console.warn('[Board] Personalization endpoint error:', res.status); return }
          const data = await res.json()
          console.log('[Board] Personalize result:', data.status, data.updated || 0)
          if (data.status === 'personalized' && data.updated > 0) {
            loadTrip(id) // Refresh with personalized data
          }
        }).catch((e) => console.warn('[Board] Personalization failed:', e))
      })
    }
  }, [id, token, loadTrip])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-drift-gold/30 border-t-drift-gold" />
      </div>
    )
  }

  if (!currentTrip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <div className="text-sm text-drift-text3">Trip not found</div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/m/plan/origin')} className="rounded-xl bg-drift-gold px-5 py-2.5 text-xs font-semibold text-drift-bg">
            Plan a New Trip
          </button>
          <button onClick={() => router.push('/m')} className="rounded-xl border border-drift-border2 px-5 py-2.5 text-xs font-semibold text-drift-text3">
            Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab content — all tabs stay mounted for instant switching */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'board' ? 'h-full' : 'hidden'}>
          <BoardView trip={currentTrip} items={currentItems} />
        </div>
        <div className={activeTab === 'trips' ? 'h-full' : 'hidden'}>
          <TripsTab />
        </div>
        <div className={activeTab === 'profile' ? 'h-full' : 'hidden'}>
          <ProfileTab />
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav />

      {/* Remix FAB + Overlay */}
      {activeTab === 'board' && <RemixOverlay />}

      {/* Overlays */}
      <DetailSheet />
      <ChatOverlay />
      <CardMenu />
      <Toast />
    </div>
  )
}
