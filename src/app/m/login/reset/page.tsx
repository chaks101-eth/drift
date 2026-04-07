'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async () => {
    setError('')

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.')
      return
    }

    setLoading(true)

    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.replace('/m/plan/vibes'), 1500)
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 animate-[fadeUp_0.45s_var(--ease-smooth)]">
      <div className="w-full max-w-[320px]">
        {/* Logo */}
        <div className="mb-3 text-center font-serif text-2xl font-light tracking-widest text-drift-gold">
          Drift
        </div>
        <p className="mb-8 text-center text-xs text-drift-text3">Set a new password</p>

        {/* Error / Success */}
        {error && (
          <div className="mb-4 rounded-xl border border-drift-err/20 bg-drift-err/5 px-3 py-2.5 text-[11px] text-drift-err">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-[#4ecdc4]/15 bg-[#4ecdc4]/5 px-3 py-2.5 text-[11px] text-[#4ecdc4]">
            Password updated. Welcome back.
          </div>
        )}

        {/* Fields */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-drift-text3">
          New Password
        </label>
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError('') }}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          className="mb-4 w-full rounded-xl border border-drift-border2 bg-transparent px-4 py-3 text-sm text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />

        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-drift-text3">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Repeat password"
          autoComplete="new-password"
          className="mb-6 w-full rounded-xl border border-drift-border2 bg-transparent px-4 py-3 text-sm text-drift-text placeholder:text-drift-text3/40 focus:border-drift-gold/30 focus:outline-none transition-colors"
        />

        <button
          onClick={handleSubmit}
          disabled={loading || success}
          className={`w-full rounded-[14px] py-4 text-xs font-extrabold uppercase tracking-widest transition-all duration-300 ${
            loading || success
              ? 'bg-drift-gold/30 text-drift-text3 cursor-not-allowed'
              : 'bg-drift-gold text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)]'
          }`}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}
