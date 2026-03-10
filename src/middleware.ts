import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Serve the static waitlist page at the root URL
// Remove this middleware when the full app is ready to launch
export function middleware(request: NextRequest) {
  return NextResponse.rewrite(new URL('/waitlist.html', request.url))
}

export const config = { matcher: '/' }
