'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'

export default function InvitePage() {
  const { token: inviteToken } = useParams<{ token: string }>()
  const router = useRouter()
  const userEmail = useTripStore((s) => s.userEmail)
  const token = useTripStore((s) => s.token)
  const isAnonymous = useTripStore((s) => s.isAnonymous)
  const setAuth = useTripStore((s) => s.setAuth)

  const [status, setStatus] = useState<'login' | 'accepting' | 'done' | 'error'>('login')
  const [error, setError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      }
    })
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user.email) {
        setAuth(session.access_token, session.user.id, session.user.email)
      }
    })
    return () => subscription.unsubscribe()
  }, [setAuth])

  // Once user is signed in (has real email, not anonymous), accept the invite
  const acceptedRef = useRef(false)
  useEffect(() => {
    if (!token || !userEmail || isAnonymous || !inviteToken) return
    if (acceptedRef.current) return
    acceptedRef.current = true

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('accepting')

    fetch(`/api/invite/${inviteToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
          setStatus('error')
        } else {
          setStatus('done')
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
  }, [token, userEmail, isAnonymous, inviteToken, router])

  const handleGoogleSignIn = async () => {
    setAuthLoading(true)
    try {
      // Store invite token so we can resume after OAuth
      sessionStorage.setItem('drift-pending-invite', inviteToken)

      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/invite/${inviteToken}` },
      })
      if (err) {
        setError(err.message)
        setAuthLoading(false)
      }
    } catch {
      setError('Sign-in failed')
      setAuthLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center px-6">
      <div className="w-full max-w-[400px] text-center">
        <div className="font-serif text-[36px] italic text-[#c8a44e] mb-2">Drift</div>

        {status === 'login' && !userEmail && (
          <div className="animate-[fadeUp_0.5s_ease]">
            <div className="mb-3 text-[20px] font-serif font-light text-[#f0efe8]">
              You&apos;ve been invited to a trip
            </div>
            <p className="text-[13px] text-[#7a7a85] mb-8 leading-relaxed">
              Sign in to view the itinerary, vote on places, and coordinate with the group.
            </p>

            <button
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 rounded-full bg-white py-3.5 text-[13px] font-semibold text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 mb-4"
            >
              {authLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="text-[10px] text-[#4a4a55]">
              You need an account to collaborate on trips
            </p>
          </div>
        )}

        {(status === 'accepting' || (status === 'login' && userEmail)) && (
          <>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-[#c8a44e]/30 border-t-[#c8a44e] mb-4" />
            <p className="text-[14px] text-[#7a7a85]">Joining the trip…</p>
          </>
        )}

        {status === 'done' && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-[#4ecdc4]/20 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-[16px] text-[#f0efe8] mb-2">You&apos;re in!</p>
            <p className="text-[13px] text-[#7a7a85]">Taking you to the trip…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-[fadeUp_0.3s_ease]">
            <p className="text-[14px] text-[#e74c3c] mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="rounded-full bg-[#c8a44e] px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#08080c]"
            >
              Go to Drift
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
