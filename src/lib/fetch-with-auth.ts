// ─── Auth-Aware Fetch Wrapper ─────────────────────────────────
// Attaches Bearer token, handles 401 by refreshing session.
// Falls back to login redirect if refresh fails.

import { supabase } from './supabase'
import { useTripStore } from '@/stores/trip-store'

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = useTripStore.getState().token
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res = await fetch(url, { ...options, headers })

  if (res.status === 401 && token) {
    // Token expired — try refresh
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (data?.session && !error) {
        const newToken = data.session.access_token
        useTripStore.getState().setAuth(
          newToken,
          data.session.user.id,
          data.session.user.email || null,
        )
        headers.set('Authorization', `Bearer ${newToken}`)
        res = await fetch(url, { ...options, headers })
      } else {
        // Refresh failed — clear auth, redirect
        useTripStore.getState().setAuth(null, null, null)
        if (typeof window !== 'undefined') window.location.href = '/m/login'
      }
    } catch {
      useTripStore.getState().setAuth(null, null, null)
      if (typeof window !== 'undefined') window.location.href = '/m/login'
    }
  }

  return res
}
