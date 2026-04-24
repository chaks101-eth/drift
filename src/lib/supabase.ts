import type { Session } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey)

// Server-side client (for API routes with user's auth token)
export function createServerClient(authToken?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    },
  })
}

/**
 * Returns an existing session, or creates an anonymous one on demand.
 *
 * Call this at the last possible moment — when you're about to write data
 * that needs a user_id (saving a trip, reacting, joining, commenting).
 *
 * Do NOT call on page load. Auto-creating anon users on every visit pollutes
 * analytics, pressures Supabase's anon-auth rate limit, and makes most visits
 * create ghost accounts that never link to a real user.
 *
 * A single in-flight promise is shared so concurrent callers don't race to
 * create multiple anon users on the same visit.
 */
let inflight: Promise<Session | null> | null = null

export async function ensureAnonSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('[ensureAnonSession] anonymous sign-in failed:', error.message)
        return null
      }
      return data.session
    } finally {
      inflight = null
    }
  })()

  return inflight
}
