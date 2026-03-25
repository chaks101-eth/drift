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

  // Redirect if already logged in
  useEffect(() => {
    if (token) router.replace('/m')
  }, [token, router])

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
        Just Drift.
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
