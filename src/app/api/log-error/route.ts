import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// Client error logging endpoint — forwards to Sentry when available
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { msg, src, line, col, stack } = body

    console.error('[ClientError]', {
      message: msg,
      source: src,
      line,
      col,
      stack: stack?.slice(0, 500),
      timestamp: new Date().toISOString(),
      ua: req.headers.get('user-agent')?.slice(0, 100),
    })

    // Forward to Sentry if initialized
    if (Sentry.isInitialized()) {
      Sentry.captureException(new Error(msg || 'Client error'), {
        extra: { source: src, line, col, stack: stack?.slice(0, 500) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
