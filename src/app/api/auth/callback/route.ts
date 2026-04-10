import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function getBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost || req.headers.get('host') || 'www.driftntravel.com'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

function isMobileUA(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') || ''
  return /iPhone|iPad|iPod|Android/i.test(ua)
}

export async function GET(req: NextRequest) {
  const base = getBaseUrl(req)
  const code = req.nextUrl.searchParams.get('code')
  const isMobile = isMobileUA(req)
  const loginPath = isMobile ? '/m/login' : '/login'
  const homePath = isMobile ? '/m' : '/trips'

  if (!code) return NextResponse.redirect(`${base}${loginPath}`)

  try {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth Callback] Exchange failed:', error.message)
      return NextResponse.redirect(`${base}${loginPath}?error=auth_failed`)
    }
  } catch (err) {
    console.error('[Auth Callback] Error:', err)
    return NextResponse.redirect(`${base}${loginPath}?error=auth_failed`)
  }

  // Redirect to the appropriate home page
  // Client-side auth listener + sessionStorage('drift-login-return') handles final routing
  return NextResponse.redirect(`${base}${homePath}`)
}
