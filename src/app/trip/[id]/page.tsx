'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import DesktopBoardView from '@/components/desktop/BoardView'
import ChatPanel from '@/components/desktop/ChatPanel'
import NavBar from '@/app/NavBar'

export default function DesktopTripPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const setAuth = useTripStore((s) => s.setAuth)
  const currentTrip = useTripStore((s) => s.currentTrip)
  const currentItems = useTripStore((s) => s.currentItems)
  const loadTrip = useTripStore((s) => s.loadTrip)
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)

  // Mobile redirect
  useEffect(() => {
    if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = `/m/board/${id}`
    }
  }, [id])

  // Auth: anonymous session if needed
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data.session) {
          setAuth(data.session.access_token, data.session.user.id, null)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) setAuth(session.access_token, session.user.id, session.user.email || null)
      else setAuth(null, null, null)
    })
    return () => subscription.unsubscribe()
  }, [setAuth])

  // Load trip
  useEffect(() => {
    if (id && token) {
      setLoading(true)
      loadTrip(id).then(() => setLoading(false))
    }
  }, [id, token, loadTrip])

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
      <div className="h-[calc(100vh-64px)]">
        <DesktopBoardView
          trip={currentTrip}
          items={currentItems}
          onOpenChat={() => setChatOpen(true)}
        />
      </div>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        tripId={id}
      />
    </div>
  )
}
