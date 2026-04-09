'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface UserInfo {
  email: string | null
  name: string | null
  avatar: string | null
  isAnon: boolean
}

export default function NavBar({ showBack = false }: { showBack?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Hydrate user from session
  useEffect(() => {
    const hydrate = (session: { user: { email?: string | null; user_metadata?: Record<string, unknown>; is_anonymous?: boolean } } | null) => {
      if (!session) { setUser(null); return }
      const meta = session.user.user_metadata || {}
      setUser({
        email: session.user.email || null,
        name: (meta.full_name as string) || (meta.name as string) || null,
        avatar: (meta.avatar_url as string) || (meta.picture as string) || null,
        isAnon: session.user.is_anonymous || false,
      })
    }
    supabase.auth.getSession().then(({ data: { session } }) => hydrate(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => hydrate(session))
    return () => subscription.unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Don't render on landing — landing has its own header
  if (pathname === '/') return null

  const isOnboarding = pathname === '/vibes' || pathname === '/destinations' || pathname === '/loading-trip'
  const authed = user !== null && !user.isAnon
  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'G'
  const displayName = user?.name || user?.email?.split('@')[0] || 'Guest'

  async function handleSignOut() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-8 h-14 flex items-center justify-between bg-[rgba(8,8,12,0.85)] backdrop-blur-[24px] border-b border-[rgba(255,255,255,0.04)] max-md:px-4 max-md:h-[50px]">
      {/* ─── Left: Logo + back ─── */}
      <div className="flex items-center gap-5">
        <div
          onClick={() => router.push('/')}
          className="cursor-pointer transition-opacity hover:opacity-80"
        >
          <span className="font-serif text-[20px] italic text-[#c8a44e]">Drift</span>
        </div>

        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[#7a7a85] text-[12px] transition-colors hover:text-[#f0efe8]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
        )}
      </div>

      {/* ─── Right: Context-aware actions ─── */}
      <div className="flex items-center gap-1">
        {isOnboarding ? (
          /* Onboarding: minimal — just profile */
          <ProfileDropdown user={user} initial={initial} displayName={displayName} authed={authed} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} onSignOut={handleSignOut} router={router} />
        ) : (
          <>
            {/* My Trips link */}
            {authed && (
              <button
                onClick={() => router.push('/trips')}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] uppercase tracking-[1.5px] transition-colors ${
                  pathname === '/trips' ? 'text-drift-gold' : 'text-drift-text3 hover:text-drift-text2'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                Trips
              </button>
            )}

            {/* New Trip CTA */}
            <button
              onClick={() => router.push('/vibes')}
              className="ml-2 flex items-center gap-1.5 px-4 py-[7px] rounded-full text-[10px] font-bold uppercase tracking-[1.5px] bg-drift-gold text-drift-bg hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(200,164,78,0.3)] transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              New Trip
            </button>

            {/* Profile dropdown */}
            <div className="ml-1.5">
              <ProfileDropdown user={user} initial={initial} displayName={displayName} authed={authed} menuOpen={menuOpen} setMenuOpen={setMenuOpen} menuRef={menuRef} onSignOut={handleSignOut} router={router} />
            </div>
          </>
        )}
      </div>
    </nav>
  )
}

// ─── Profile Dropdown ─────────────────────────────────────────
interface DropdownProps {
  user: UserInfo | null
  initial: string
  displayName: string
  authed: boolean
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  menuRef: React.RefObject<HTMLDivElement | null>
  onSignOut: () => void
  router: ReturnType<typeof useRouter>
}

function ProfileDropdown({ user, initial, displayName, authed, menuOpen, setMenuOpen, menuRef, onSignOut, router }: DropdownProps) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Profile menu"
        className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition-all ${
          menuOpen
            ? 'bg-drift-gold text-drift-bg'
            : authed
            ? 'bg-white/[0.06] text-drift-text2 hover:bg-white/[0.1]'
            : 'border border-white/[0.08] text-drift-text3 hover:border-white/15 hover:text-drift-text2'
        }`}
      >
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-11 z-[110] min-w-[240px] rounded-2xl border border-white/[0.06] bg-[#0c0c12] shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-[fadeUp_0.2s_ease]">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
            {authed ? (
              <>
                <div className="text-[13px] font-semibold text-drift-text truncate">{displayName}</div>
                {user?.email && <div className="mt-0.5 text-[11px] text-drift-text3 truncate">{user.email}</div>}
              </>
            ) : (
              <>
                <div className="text-[12px] text-drift-text2">Guest session</div>
                <div className="mt-0.5 text-[10px] text-drift-text3">Sign in to save your trips</div>
              </>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <MenuItem
              icon={<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>}
              label="My Trips"
              onClick={() => { setMenuOpen(false); router.push('/trips') }}
            />
            <MenuItem
              icon={<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              label="Plan New Trip"
              onClick={() => { setMenuOpen(false); router.push('/vibes') }}
            />
            <MenuItem
              icon={<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>}
              label="Settings"
              onClick={() => { setMenuOpen(false); router.push('/account') }}
            />

            <div className="my-1.5 mx-3 border-t border-white/[0.04]" />

            {authed ? (
              <MenuItem
                icon={<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
                label="Sign out"
                onClick={onSignOut}
                muted
              />
            ) : (
              <MenuItem
                icon={<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>}
                label="Sign in"
                onClick={() => { setMenuOpen(false); router.push('/login') }}
                accent
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, muted, accent }: { icon: React.ReactNode; label: string; onClick: () => void; muted?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] transition-colors ${
        accent
          ? 'text-drift-gold hover:bg-drift-gold/[0.06]'
          : muted
          ? 'text-drift-text3 hover:bg-white/[0.04] hover:text-drift-text2'
          : 'text-drift-text2 hover:bg-white/[0.04] hover:text-drift-text'
      }`}
    >
      <span className="opacity-60">{icon}</span>
      {label}
    </button>
  )
}
