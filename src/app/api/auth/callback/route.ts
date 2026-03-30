import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function getBaseUrl(req: NextRequest): string {
  // Use x-forwarded-host (set by Railway/proxy) or host header
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost || req.headers.get('host') || 'www.driftntravel.com'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req)
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(`${base}/m/login`)

  try {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth Callback] Exchange failed:', error.message)
      return NextResponse.redirect(`${base}/m/login?error=auth_failed`)
    }
  } catch (err) {
    console.error('[Auth Callback] Error:', err)
    return NextResponse.redirect(`${base}/m/login?error=auth_failed`)
  }

  return NextResponse.redirect(`${base}/m`)
}
