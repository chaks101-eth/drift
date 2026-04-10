'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'
import DesktopBoardView from '@/components/desktop/BoardView'
import ChatPanel from '@/components/desktop/ChatPanel'
import DetailModal from '@/components/desktop/DetailModal'
import RemixModal from '@/components/desktop/RemixModal'
import DesktopToast from '@/components/desktop/Toast'
import NavBar from '@/app/NavBar'

export default function DesktopTripPage() {
  const { id } = useParams<{ id: string }>()
  const setAuth = useTripStore((s) => s.setAuth)
  const currentTrip = useTripStore((s) => s.currentTrip)
  const currentItems = useTripStore((s) => s.currentItems)
  const showChat = useUIStore((s) => s.showChat)
  const openChat = useUIStore((s) => s.openChat)
  const closeChat = useUIStore((s) => s.closeChat)
  const [loading, setLoading] = useState(true)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)

  const detailItem = detailItemId ? currentItems.find(i => i.id === detailItemId) || null : null
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  // Mobile redirect — check before any render
  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = `/m/board/${id}`
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobile(true)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobile(false)
    }
  }, [id])

  // Auth + load trip
  useEffect(() => {
    if (isMobile !== false) return // skip if still checking or redirecting
    let cancelled = false

    async function initAndLoad() {
      // Get or create session
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data } = await supabase.auth.signInAnonymously()
        session = data.session
      }

      if (!session || cancelled) return
      setAuth(session.access_token, session.user.id, session.user.email || null)

      // Load trip via admin API (bypasses RLS — desktop board should work for any trip, like shared trips)
      try {
        const res = await fetch(`/api/trips/${id}`)
        if (res.ok) {
          const data = await res.json()
          if (cancelled) return
          if (data.trip) useTripStore.getState().setCurrentTrip(data.trip)
          if (data.items) useTripStore.getState().setCurrentItems(data.items)
        }
      } catch (e) {
        console.error('[Desktop Board] Failed to load trip:', e)
      }
      if (!cancelled) setLoading(false)
    }

    initAndLoad()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) setAuth(session.access_token, session.user.id, session.user.email || null)
      else setAuth(null, null, null)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [id, setAuth, isMobile])

  // Mobile check or loading
  if (isMobile !== false || loading || !currentTrip) {
    return (
      <div className="min-h-screen bg-drift-bg">
        <NavBar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-drift-gold/30 border-t-drift-gold" />
            <p className="mt-4 text-sm text-drift-text3">Loading trip...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text animate-[fadeIn_0.4s_ease]">
      <NavBar />
      <div className="h-[calc(100vh-56px)] mt-14">
        <DesktopBoardView
          trip={currentTrip}
          items={currentItems}
          onOpenDetail={(itemId) => setDetailItemId(itemId)}
          onOpenChat={() => openChat()}
        />
      </div>

      {/* Drift Chat FAB — branded mark, opens chat panel */}
      {!showChat && (
        <button
          onClick={() => openChat()}
          aria-label="Chat with Drift"
          className="group fixed bottom-8 right-8 z-[280] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-[#a88a3e] shadow-[0_12px_36px_rgba(200,164,78,0.35)] transition-all duration-400 hover:scale-[1.08] hover:shadow-[0_16px_48px_rgba(200,164,78,0.5)] active:scale-95"
        >
          <span className="font-serif italic text-[26px] font-normal text-drift-bg leading-none translate-y-[-1px]">D</span>
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-full border border-drift-gold/60 opacity-0 animate-[fabPulse_3s_ease-out_infinite]" />
          <span className="absolute inset-0 rounded-full border border-drift-gold/40 opacity-0 animate-[fabPulse_3s_ease-out_infinite]" style={{ animationDelay: '1.5s' }} />
        </button>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          onClose={() => setDetailItemId(null)}
          onChat={() => { setDetailItemId(null); openChat() }}
        />
      )}

      {/* Chat Panel */}
      <ChatPanel
        open={showChat}
        onClose={() => closeChat()}
        tripId={id}
      />

      {/* Remix Modal */}
      <RemixModal />

      {/* Toast notifications */}
      <DesktopToast />
    </div>
  )
}
