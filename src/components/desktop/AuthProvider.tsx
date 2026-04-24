'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'

/**
 * Desktop auth provider — initializes anonymous session + listens for auth changes.
 * Same behavior as mobile layout's auth setup.
 * Wrap any desktop page that needs auth/trip-store access.
 */
export default function DesktopAuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useTripStore((s) => s.setAuth)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
        return
      }
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      } else {
        setAuth(null, null, null)
      }
    })

    // Check initial session — but do NOT auto-create an anonymous user.
    // Anon sign-in is deferred to the first write (see ensureAnonSession in @/lib/supabase).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuth(session.access_token, session.user.id, session.user.email || null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setAuth])

  return <>{children}</>
}
