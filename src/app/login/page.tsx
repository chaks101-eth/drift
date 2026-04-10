'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTripStore } from '@/stores/trip-store'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const token = useTripStore((s) => s.token)
  const userEmail = useTripStore((s) => s.userEmail)
  const emailRef = useRef<HTMLInputElement>(null)

  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in (real account, not anonymous)
  useEffect(() => {
    if (token && userEmail) {
      const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('drift-login-return') : null
      sessionStorage.removeItem('drift-login-return')
      router.replace(returnTo || '/trips')
    }
  }, [token, userEmail, router])

  // Mobile redirect
  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = '/m/login'
    }
  }, [])

  // Auto-focus email
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  const isValid = email.includes('@') && password.length >= 6

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!isValid || loading) return
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setInfo('Check your email for a confirmation link.')
        setLoading(false)
        return
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
      // Auth state listener will update the store → useEffect redirect fires
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.includes('Invalid login')) setError('Wrong email or password')
      else if (msg.includes('already registered')) setError('Account already exists — sign in instead')
      else if (msg.includes('valid email')) setError('Check your email address')
      else if (msg.includes('Password')) setError('Password must be at least 6 characters')
      else if (msg.includes('rate limit')) setError('Too many attempts. Wait a minute.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

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
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,164,78,0.05) 0%, transparent 60%)' }}
      />

      <div className="w-full max-w-[400px] relative z-10">
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[#4a4a55] text-[11px] tracking-wider uppercase hover:text-[#7a7a85] transition-colors mb-10 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.05s]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>

        {/* Logo */}
        <div className="mb-10 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.1s]">
          <div className="font-serif text-[40px] italic text-[#c8a44e] mb-1">Drift</div>
          <div className="text-[11px] tracking-[2px] uppercase text-[#7a7a85]">Save your trips</div>
        </div>

        {/* Google — primary CTA */}
        <div className="opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.2s]">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-full bg-white py-3.5 text-[13px] font-semibold text-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.15)] active:scale-[0.98] disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-7 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.3s]">
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
          <span className="text-[10px] text-[#4a4a55] uppercase tracking-wider">or use email</span>
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
        </div>

        {/* Error / Info */}
        <div className="opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.3s]">
          {error && (
            <div className="mb-4 rounded-xl border border-[#e74c3c]/20 bg-[#e74c3c]/5 px-3 py-2.5 text-[11px] text-[#e74c3c]">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-xl border border-[#4ecdc4]/20 bg-[#4ecdc4]/5 px-3 py-2.5 text-[11px] text-[#4ecdc4]">
              {info}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.35s]">
          {/* Email */}
          <div>
            <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-[#7a7a85]">Email</label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('login-pass')?.focus()}
              placeholder="you@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-[13px] text-[#f0efe8] placeholder:text-[#4a4a55] focus:border-[#c8a44e]/30 focus:outline-none transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1.5 text-[9px] font-semibold uppercase tracking-[2px] text-[#7a7a85]">Password</label>
            <div className="relative">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="6+ characters"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-3 pr-11 text-[13px] text-[#f0efe8] placeholder:text-[#4a4a55] focus:border-[#c8a44e]/30 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide' : 'Show'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#4a4a55] hover:text-[#7a7a85] transition-colors"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  className={showPassword ? 'opacity-100' : 'opacity-50'}
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`w-full rounded-full py-3.5 text-[11px] font-bold uppercase tracking-[2px] transition-all ${
              isValid && !loading
                ? 'bg-[#c8a44e] text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(200,164,78,0.25)]'
                : 'bg-[#c8a44e]/25 text-[#4a4a55] cursor-not-allowed'
            }`}
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Forgot + Toggle */}
        <div className="mt-5 space-y-3 text-center opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.45s]">
          {!isSignUp && (
            <button onClick={handleForgotPassword} className="text-[11px] text-[#4a4a55] hover:text-[#7a7a85] transition-colors">
              Forgot password?
            </button>
          )}
          <div className="text-[11px] text-[#7a7a85]">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setInfo('') }} className="font-semibold text-[#c8a44e] hover:underline">
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
