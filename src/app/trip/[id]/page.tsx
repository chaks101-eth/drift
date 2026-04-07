'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import DesktopBoardView from '@/components/desktop/BoardView'
import ChatPanel from '@/components/desktop/ChatPanel'
import DetailModal from '@/components/desktop/DetailModal'
import NavBar from '@/app/NavBar'

export default function DesktopTripPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const setAuth = useTripStore((s) => s.setAuth)
  const currentTrip = useTripStore((s) => s.currentTrip)
  const currentItems = useTripStore((s) => s.currentItems)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)

  const detailItem = detailItemId ? currentItems.find(i => i.id === detailItemId) || null : null

  // Mobile redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = `/m/board/${id}`
    }
  }, [id])

  // Auth + load trip
  useEffect(() => {
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
  }, [id, setAuth])

  // Loading state
  if (loading || !currentTrip) {
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
    <div className="min-h-screen bg-drift-bg text-drift-text">
      <NavBar />
      <div className="h-[calc(100vh-56px)]">
        <DesktopBoardView
          trip={currentTrip}
          items={currentItems}
          onOpenDetail={(itemId) => setDetailItemId(itemId)}
        />
      </div>

      {/* Floating Chat FAB */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-8 right-8 z-[280] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-[#a88a3e] shadow-[0_8px_32px_rgba(200,164,78,0.35)] transition-all hover:scale-[1.08] hover:shadow-[0_12px_40px_rgba(200,164,78,0.45)] active:scale-95"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {/* Pulse ring */}
          <span className="absolute inset-[-4px] rounded-full border-2 border-drift-gold opacity-0 animate-[fabPulse_3s_ease-out_infinite]" />
        </button>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <DetailModal
          item={detailItem}
          onClose={() => setDetailItemId(null)}
          onChat={() => { setDetailItemId(null); setChatOpen(true) }}
        />
      )}

      {/* Chat Panel */}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        tripId={id}
      />
    </div>
  )
}
