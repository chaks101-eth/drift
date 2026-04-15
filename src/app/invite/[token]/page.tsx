'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'

export default function InvitePage() {
  const { token: inviteToken } = useParams<{ token: string }>()
  const router = useRouter()
  const authToken = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)
  const setAuth = useTripStore((s) => s.setAuth)

  const [status, setStatus] = useState<'loading' | 'accepting' | 'done' | 'error'>('loading')
  const [tripId, setTripId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Ensure we have a session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        const { data } = await supabase.auth.signInAnonymously()
        if (data.session) {
          setAuth(data.session.access_token, data.session.user.id, null)
        }
      } else {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      }
    })
  }, [setAuth])

  // Accept the invite once we have auth
  useEffect(() => {
    if (!authToken || !userId || !inviteToken) return
    setStatus('accepting')

    fetch(`/api/invite/${inviteToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setStatus('error')
        } else {
          setTripId(data.tripId)
          setStatus('done')
          // Redirect to the trip after a moment
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          setTimeout(() => {
            router.push(isMobile ? `/m/board/${data.tripId}` : `/trip/${data.tripId}`)
          }, 1500)
        }
      })
      .catch(() => {
        setError('Failed to accept invite')
        setStatus('error')
      })
  }, [authToken, userId, inviteToken, router])

  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
      <div className="text-center px-8">
        <div className="font-serif text-[32px] italic text-[#c8a44e] mb-4">Drift</div>

        {status === 'loading' || status === 'accepting' ? (
          <>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e] mb-4" />
            <p className="text-[14px] text-[#7a7a85]">Accepting your invitation…</p>
          </>
        ) : status === 'done' ? (
          <>
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#4ecdc4]/20 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-[16px] text-[#f0efe8] mb-2">You&apos;re in!</p>
            <p className="text-[13px] text-[#7a7a85]">Taking you to the trip…</p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-[#e74c3c] mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="rounded-full bg-[#c8a44e] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#08080c]"
            >
              Go to Drift
            </button>
          </>
        )}
      </div>
    </div>
  )
}
