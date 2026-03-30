import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/m/login', req.url))

  try {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth Callback] Exchange failed:', error.message)
      return NextResponse.redirect(new URL('/m/login?error=auth_failed', req.url))
    }
  } catch (err) {
    console.error('[Auth Callback] Error:', err)
    return NextResponse.redirect(new URL('/m/login?error=auth_failed', req.url))
  }

  // Redirect to home — layout will detect session and redirect to last trip
  return NextResponse.redirect(new URL('/m', req.url))
}
