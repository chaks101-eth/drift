'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import ErrorBoundary from '@/components/mobile/ErrorBoundary'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const setAuth = useTripStore((s) => s.setAuth)

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
        router.replace('/m/login/reset')
        return
      }
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      } else {
        setAuth(null, null, null)
      }
    })

    // Check initial session — if none, create anonymous session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      } else {
        // Auto-create anonymous session so user can plan without signing up
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data.session) {
          setAuth(data.session.access_token, data.session.user.id, null)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [setAuth, router])

  return (
    <div className="fixed inset-0 overflow-hidden bg-drift-bg font-sans text-drift-text">
      <div className="relative mx-auto h-full w-full max-w-[430px]">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  )
}
