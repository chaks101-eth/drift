'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function NavBar({ showBack = false }: { showBack?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-8 h-14 flex items-center justify-between bg-[rgba(8,8,12,0.75)] backdrop-blur-[24px] border-b border-[rgba(255,255,255,0.04)] max-md:px-4 max-md:h-[50px]">
      <div className="flex items-center gap-4">
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
      </div>

      {/* Pill nav links — hidden on mobile (bottom nav takes over) */}
      <div className="flex gap-1 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 nav-links-responsive">
        {[
          { href: '/vibes', label: 'Vibes' },
          { href: '/destinations', label: 'Destinations' },
        ].map(link => (
          <a
            key={link.href}
            onClick={() => router.push(link.href)}
            className={`px-4 py-[7px] rounded-[9px] text-xs font-medium cursor-pointer transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.15,1)] relative ${
              pathname === link.href
                ? 'text-[#c8a44e] bg-[rgba(200,164,78,0.08)] shadow-[0_0_12px_rgba(200,164,78,0.06)]'
                : 'text-[#4a4a55] hover:text-[#7a7a85] hover:bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
