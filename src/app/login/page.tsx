'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#08080c]" />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const isSurprise = searchParams.get('surprise') === '1'
  const emailRef = useRef<HTMLInputElement>(null)

  // Auto-focus email on mount
  useEffect(() => { emailRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      // Human-readable error messages (philosophy: errors in plain English)
      const msg = authError.message
      if (msg.includes('Invalid login')) setError('Wrong email or password. Double-check and try again.')
      else if (msg.includes('already registered')) setError('This email is already registered. Try signing in instead.')
      else if (msg.includes('Password')) setError('Password needs to be at least 6 characters.')
      else if (msg.includes('rate limit')) setError('Too many attempts. Take a breath and try in a minute.')
      else setError(msg)
      setLoading(false)
      return
    }

    if (isSignUp) {
      setError('Check your email for a confirmation link.')
      setLoading(false)
      return
    }

    if (isSurprise) {
      const allVibes = ['beach', 'culture', 'foodie', 'adventure', 'party', 'spiritual', 'romance', 'city', 'solo', 'winter']
      const shuffled = allVibes.sort(() => Math.random() - 0.5)
      const picked = shuffled.slice(0, 3)
      router.push(`/vibes?surprise=${picked.join(',')}`)
    } else {
      router.push('/vibes')
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  const isConfirmation = error.includes('Check your email')

  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,164,78,0.05) 0%, transparent 60%)' }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Back to home */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[#4a4a55] text-xs hover:text-[#7a7a85] transition-colors mb-8 opacity-0 animate-[fadeUp_1s_ease_forwards_0.05s]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to home
        </button>

        {/* Logo */}
        <div className="text-center mb-10 opacity-0 animate-[fadeUp_1s_ease_forwards_0.1s]">
          <h1 className="font-serif text-4xl text-[#c8a44e] mb-2">Drift</h1>
          <p className="text-[#7a7a85] text-sm tracking-widest uppercase">Just Drift.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 opacity-0 animate-[fadeUp_1s_ease_forwards_0.3s]">
          <input
            ref={emailRef}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-xl text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all placeholder:text-[#4a4a55]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-xl text-[#f0efe8] text-sm outline-none focus:border-[#c8a44e] focus:shadow-[0_0_0_3px_rgba(200,164,78,0.08)] transition-all placeholder:text-[#4a4a55]"
          />

          {error && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs leading-relaxed ${
              isConfirmation
                ? 'bg-[rgba(78,205,196,0.08)] border border-[rgba(78,205,196,0.15)] text-[#4ecdc4]'
                : 'bg-[rgba(231,76,60,0.08)] border border-[rgba(231,76,60,0.15)] text-[#e74c3c]'
            }`}>
              <span className="mt-0.5 flex-shrink-0">{isConfirmation ? '✓' : '!'}</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] font-semibold text-sm rounded-full hover:shadow-[0_12px_40px_rgba(200,164,78,0.3)] hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.97]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[#0a0a0f] border-t-transparent animate-[load-spin_1s_linear_infinite]" />
                {isSignUp ? 'Creating...' : 'Signing in...'}
              </span>
            ) : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6 opacity-0 animate-[fadeUp_1s_ease_forwards_0.5s]">
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
          <span className="text-[#4a4a55] text-xs">or</span>
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-full text-[#f0efe8] text-sm hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.06)] transition-all active:scale-[0.98] opacity-0 animate-[fadeUp_1s_ease_forwards_0.5s]"
        >
          Continue with Google
        </button>

        {/* Toggle */}
        <p className="text-center text-[#7a7a85] text-xs mt-6 opacity-0 animate-[fadeUp_1s_ease_forwards_0.7s]">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="text-[#c8a44e] hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
