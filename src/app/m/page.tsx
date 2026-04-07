'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

const words = [
  { text: 'Every trip ', delay: 0.3 },
  { text: 'begins with ', delay: 0.5 },
  { text: 'a ', delay: 0.7 },
  { text: 'feeling.', delay: 0.9, italic: true },
]

export default function HeroPage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const userId = useTripStore((s) => s.userId)
  const [checked, setChecked] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [starting, setStarting] = useState(false)

  // Check for post-auth return path (e.g., returning from Google OAuth during onboarding)
  useEffect(() => {
    if (!token || !userId) return
    const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('drift-login-return') : null
    if (returnTo) {
      sessionStorage.removeItem('drift-login-return')
      router.replace(returnTo)
      return
    }
  }, [token, userId, router])

  // Redirect logged-in users with existing trips to their last trip
  useEffect(() => {
    if (!token || !userId || checked) return
    setChecked(true)
    setRedirecting(true)

    const timeout = setTimeout(() => setRedirecting(false), 5000)

    supabase
      .from('trips')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        clearTimeout(timeout)
        if (!error && data?.length) {
          router.replace(`/m/board/${data[0].id}`)
        } else {
          setRedirecting(false)
        }
      }, () => { clearTimeout(timeout); setRedirecting(false) })

    return () => clearTimeout(timeout)
  }, [token, userId, checked, router])

  // Show loading screen while checking for existing trips
  if (redirecting) {
    return (
      <div className="flex h-full items-center justify-center bg-drift-bg">
        <div className="text-center">
          <div className="mb-4 font-serif text-xl text-drift-gold opacity-80">Drift</div>
          <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-drift-border2 border-t-drift-gold" />
        </div>
      </div>
    )
  }

  const handleStart = () => {
    if (starting) return
    setStarting(true)
    router.push('/m/plan/vibes')
  }

  return (
    <div className="flex h-full flex-col justify-end px-6 pb-[env(safe-area-inset-bottom)]">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_85%,rgba(200,164,78,0.06)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-drift-bg via-drift-bg/40 to-drift-bg" />
      </div>

      {/* Content */}
      <div className="relative z-10 pb-4">
        {/* Drift mark */}
        <div className="mb-11 flex items-center gap-2.5 opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_0.2s_forwards]">
          <div className="h-px w-5 bg-drift-gold opacity-40" />
          <span className="font-serif text-sm font-light uppercase tracking-[6px] text-drift-gold opacity-70">
            Drift
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-[18px] font-serif text-[46px] font-light leading-[1.04] tracking-tight">
          {words.map((w, i) => (
            <span
              key={i}
              className="inline opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_forwards]"
              style={{ animationDelay: `${w.delay}s` }}
            >
              {w.italic ? <em className="font-normal italic text-drift-gold">{w.text}</em> : w.text}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="mb-8 max-w-[260px] text-[13px] leading-[1.7] tracking-wide text-drift-text2 opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.4s_forwards]">
          Your vibe. Your budget. Your dates. AI builds a trip you&apos;d actually book.
        </p>

        {/* CTA — visible faster so user can interact sooner */}
        <button
          onClick={handleStart}
          disabled={starting}
          className={"relative mb-0 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] px-6 py-[19px] text-[13px] font-bold uppercase tracking-widest opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.6s_forwards] transition-transform duration-200 " + (starting ? "bg-drift-gold/50 text-drift-text3" : "bg-drift-gold text-drift-bg shadow-[0_16px_48px_rgba(200,164,78,0.18)] active:scale-[0.97]")}
        >
          {starting && (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/25 border-t-current" />
          )}
          {!starting && (
            <span className="flex items-center gap-2.5">
              Start Planning
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          )}
          {!starting && (
            <span className="absolute left-[-100%] top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shine_5s_ease-in-out_3s_infinite]" />
          )}
        </button>

        {/* Reel CTA */}
        <button
          onClick={() => router.push('/m/plan/url')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] border border-drift-gold/20 bg-transparent px-4 py-[15px] text-xs font-semibold tracking-wider text-drift-gold opacity-0 animate-[fadeUp_0.6s_var(--ease-smooth)_0.8s_forwards] transition-all duration-200 active:scale-[0.97] active:bg-drift-gold/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Got a travel reel? Create from URL
        </button>

        {/* Legal links */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[10px] text-[#4a4a55] opacity-0 animate-[fadeUp_0.8s_var(--ease-smooth)_2s_forwards]">
          <Link href="/privacy" className="hover:text-[#c8a44e] transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-[#c8a44e] transition-colors">Terms</Link>
        </div>
      </div>
    </div>
  )
}
