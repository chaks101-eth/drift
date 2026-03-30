import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/login', req.url))

  const supabase = createServerClient()
  await supabase.auth.exchangeCodeForSession(code)

  return NextResponse.redirect(new URL('/m', req.url))
}
