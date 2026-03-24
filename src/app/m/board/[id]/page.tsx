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

  useEffect(() => { if (token === null) router.replace('/m/login') }, [token, router])

  useEffect(() => {
    if (id && token) {
      setLoading(true)
      loadTrip(id).finally(() => setLoading(false))
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
      <div className="flex h-full items-center justify-center text-sm text-drift-text3">
        Trip not found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'board' && (
          <BoardView trip={currentTrip} items={currentItems} />
        )}
        {activeTab === 'trips' && <TripsTab />}
        {activeTab === 'profile' && <ProfileTab />}
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
