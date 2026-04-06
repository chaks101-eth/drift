'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'

export default function LoginPage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const emailRef = useRef<HTMLInputElement>(null)

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in (with real account, not anonymous)
  const userEmail = useTripStore((s) => s.userEmail)
  useEffect(() => {
    if (token && userEmail) {
      // Return to previous page if available, otherwise hero
      const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('drift-login-return') : null
      sessionStorage.removeItem('drift-login-return')
      router.replace(returnTo || '/m')
    }
  }, [token, userEmail, router])

  // Auto-focus email
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  const isValid = email.includes('@') && password.length >= 6

  const handleSubmit = async () => {
    if (!isValid || loading) return
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
      // Auth state listener in layout will update the store
      router.push('/m')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      // Human-readable errors
      if (msg.includes('Invalid login')) setError('Wrong email or password')
      else if (msg.includes('already registered')) setError('Account already exists — sign in instead')
      else if (msg.includes('valid email')) setError('Check your email address')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.includes('@')) {
      setError('Enter your email first')
      return
    }
    setError('')
    setInfo('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email)
    if (err) setError(err.message)
    else setInfo('Check your email for a reset link')
  }

  return (
    <div className="flex h-full flex-col justify-center px-8 animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Back */}
      <button
        onClick={() => router.push('/m')}
        aria-label="Back to home"
        className="absolute left-6 top-[calc(env(safe-area-inset-top)+16px)] bg-transparent border-none text-drift-text"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      {/* Logo */}
      <div className="mb-1 font-serif text-[38px] italic text-drift-text">Drift</div>
      <div className="mb-8 text-xs font-medium tracking-[0.2em] text-drift-text3">
        Save your trips
      </div>

      {/* Google sign-in */}
      <button
        onClick={async () => {
          setLoading(true)
          // If anonymous user, link Google identity to preserve trips
          const isAnon = useTripStore.getState().isAnonymous
          if (isAnon) {
            const { error: err } = await supabase.auth.linkIdentity({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/api/auth/callback` },
            })
            if (err) {
              // linkIdentity failed — fall back to regular OAuth
              console.warn('[Login] linkIdentity failed, falling back:', err.message)
              const { error: err2 } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/api/auth/callback` },
              })
              if (err2) { setError(err2.message); setLoading(false) }
            }
          } else {
            const { error: err } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/api/auth/callback` },
            })
            if (err) { setError(err.message); setLoading(false) }
          }
        }}
        disabled={loading}
        className="mb-4 flex w-full items-center justify-center gap-3 rounded-[14px] bg-white py-4 text-sm font-semibold text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-all duration-200 active:scale-[0.97]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-drift-border2" />
        <span className="text-[10px] text-drift-text3">or use email</span>
        <div className="h-px flex-1 bg-drift-border2" />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-drift-err/20 bg-drift-err/5 px-3 py-2.5 text-[11px] text-drift-err">
          {error}
        </div>
      )}
      {/* Info (e.g. password reset success) */}
      {info && (
        <div className="mb-4 rounded-xl border border-drift-gold/20 bg-drift-gold/5 px-3 py-2.5 text-[11px] text-drift-gold">
          {info}
        </div>
      )}

      {/* Email */}
      <label className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-drift-text2">
        Email
      </label>
      <input
        ref={emailRef}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('login-pass')?.focus()}
        placeholder="your@email.com"
        autoComplete="email"
        className="mb-4 w-full rounded-[14px] border border-drift-border2 bg-transparent px-4 py-3.5 text-sm text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
      />

      {/* Password */}
      <label className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-drift-text2">
        Password
      </label>
      <div className="relative mb-4">
        <input
          id="login-pass"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Your password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          className="w-full rounded-[14px] border border-drift-border2 bg-transparent px-4 py-3.5 pr-11 text-sm text-drift-text placeholder:text-drift-text3 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />
        <button
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-drift-text3"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className={showPassword ? 'opacity-100' : 'opacity-40'}
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || loading}
        className={`w-full rounded-[14px] py-4 text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${
          isValid && !loading
            ? 'bg-drift-gold text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)]'
            : 'bg-drift-gold/30 text-drift-text3 cursor-not-allowed'
        }`}
      >
        {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
      </button>

      {/* Forgot */}
      <div className="mt-2.5 text-center">
        <button onClick={handleForgotPassword} className="text-[11px] text-drift-text3">
          Forgot password?
        </button>
      </div>

      {/* Toggle */}
      <div className="mt-4 text-center text-[11px] text-drift-text3">
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <button onClick={() => { setIsSignUp(!isSignUp); setError('') }} className="font-semibold text-drift-gold">
          {isSignUp ? 'Sign in' : 'Sign up'}
        </button>
      </div>
    </div>
  )
}
