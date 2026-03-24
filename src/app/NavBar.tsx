'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function NavBar({ showBack = false }: { showBack?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })
  }, [])

  const links = [
    { href: '/vibes', label: 'Vibes' },
    { href: '/destinations', label: 'Destinations' },
    ...(authed ? [{ href: '/trips', label: 'My Trips' }] : []),
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-8 h-14 flex items-center justify-between bg-[rgba(8,8,12,0.85)] backdrop-blur-[24px] border-b border-[rgba(255,255,255,0.04)] max-md:px-4 max-md:h-[50px]">
      <div className="flex items-center gap-6">
        <div
          onClick={() => router.push('/')}
          className="font-serif text-xl font-semibold text-[#c8a44e] cursor-pointer transition-all hover:opacity-80 max-md:text-lg"
        >
          Drift
        </div>

        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[#7a7a85] text-[13px] bg-transparent border-none cursor-pointer transition-all hover:text-[#f0efe8]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
        )}

        {/* Nav links — inline with logo, hidden on mobile */}
        {!showBack && (
          <div className="flex items-center gap-1 nav-links-responsive">
            {links.map(link => (
              <a
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`px-3 py-1.5 text-[13px] cursor-pointer transition-all duration-300 relative ${
                  pathname === link.href
                    ? 'text-[#c8a44e]'
                    : 'text-[#4a4a55] hover:text-[#7a7a85]'
                }`}
              >
                {link.label}
                {pathname === link.href && (
                  <span className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-[#c8a44e] rounded-full" />
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right side — New Trip CTA when authed */}
      {authed && (
        <button
          onClick={() => router.push('/vibes')}
          className="px-5 py-[7px] rounded-full text-[11px] font-semibold bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,164,78,0.25)] transition-all nav-links-responsive"
        >
          New Trip
        </button>
      )}
    </nav>
  )
}
