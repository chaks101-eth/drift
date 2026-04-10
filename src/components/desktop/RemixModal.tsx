'use client'

import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'

// Full vibe set — matches the vibes page
const ALL_VIBES = [
  { id: 'beach', name: 'Beach Chill' },
  { id: 'adventure', name: 'Adventure' },
  { id: 'city', name: 'City Nights' },
  { id: 'romance', name: 'Romance' },
  { id: 'luxury', name: 'Luxury' },
  { id: 'wellness', name: 'Wellness' },
  { id: 'spiritual', name: 'Spiritual' },
  { id: 'foodie', name: 'Foodie Trail' },
  { id: 'party', name: 'Party Mode' },
  { id: 'nature', name: 'Nature Escape' },
  { id: 'family', name: 'Family Fun' },
  { id: 'backpacker', name: 'Backpacker' },
  { id: 'culture', name: 'Culture' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'hidden', name: 'Hidden Gems' },
]

const MAX_VIBES = 3

export default function RemixModal() {
  const showRemix = useUIStore((s) => s.showRemix)
  const closeRemix = useUIStore((s) => s.closeRemix)
  const openChat = useUIStore((s) => s.openChat)
  const toast = useUIStore((s) => s.toast)
  const currentTrip = useTripStore((s) => s.currentTrip)
  const token = useTripStore((s) => s.token)
  const setCurrentTrip = useTripStore((s) => s.setCurrentTrip)
  const setCurrentItems = useTripStore((s) => s.setCurrentItems)

  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const currentVibes = currentTrip?.vibes || []

  // Reset selected vibes when modal opens
  useEffect(() => {
    if (showRemix) {
      setSelectedVibes([...currentVibes])
      setTimeout(() => closeBtnRef.current?.focus(), 50)
    }
  }, [showRemix]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes
  useEffect(() => {
    if (!showRemix) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closeRemix()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showRemix, loading, closeRemix])

  if (!showRemix) return null

  const toggleVibe = (id: string) => {
    setSelectedVibes((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast('Pick at least one vibe')
          return prev
        }
        return prev.filter((v) => v !== id)
      }
      if (prev.length >= MAX_VIBES) {
        toast(`Max ${MAX_VIBES} vibes`)
        return prev
      }
      return [...prev, id]
    })
  }

  const vibesChanged =
    selectedVibes.length > 0 &&
    (selectedVibes.length !== currentVibes.length ||
      selectedVibes.some((v) => !currentVibes.includes(v)))

  const ctaLabel = vibesChanged
    ? `Remix with ${selectedVibes.length} new vibe${selectedVibes.length > 1 ? 's' : ''}`
    : 'Remix with same vibes'

  const handleRemix = async () => {
    if (!currentTrip || !token || loading) return
    setLoading(true)

    const mode = vibesChanged ? 'vibes' : 'full'
    const vibesForRemix = vibesChanged ? selectedVibes : currentTrip.vibes

    try {
      const res = await fetch('/api/ai/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tripId: currentTrip.id,
          mode,
          lockedItemIds: [],
          vibes: vibesForRemix,
        }),
      })
      const data = await res.json()

      if (data.error || !res.ok) {
        toast(`Remix failed: ${data.error || res.statusText}`, true)
        setLoading(false)
        return
      }

      // Reload trip from API
      const reloadRes = await fetch(`/api/trips/${currentTrip.id}`)
      if (reloadRes.ok) {
        const reload = await reloadRes.json()
        if (reload.trip) setCurrentTrip(reload.trip)
        if (reload.items) setCurrentItems(reload.items)
      }

      toast('Trip remixed — new picks ready')
      closeRemix()
    } catch {
      toast("Couldn't remix. Check your connection.", true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[260] bg-black/75 backdrop-blur-lg animate-[fadeIn_0.3s_ease]"
        onClick={() => !loading && closeRemix()}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[270] flex items-center justify-center p-8 pointer-events-none">
        <div className="relative w-full max-w-[620px] overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0c0c12] shadow-[0_60px_140px_rgba(0,0,0,0.85)] pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.2,0.8,0.2,1)]">

          {/* Close */}
          <button
            ref={closeBtnRef}
            onClick={closeRemix}
            disabled={loading}
            aria-label="Close"
            className="absolute right-6 top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full text-drift-text3 transition-all hover:bg-white/[0.06] hover:text-drift-text disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Header */}
          <div className="px-10 pt-10 pb-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px w-6 bg-drift-gold/60" />
              <span className="text-[9px] font-semibold uppercase tracking-[2.5px] text-drift-gold/80">Remix</span>
            </div>
            <h2 className="font-serif text-[28px] font-light leading-[1.1] text-drift-text mb-2">
              Change the <em className="italic text-drift-gold">energy</em>
            </h2>
            <p className="text-[13px] text-drift-text2 leading-relaxed max-w-[480px]">
              Tap vibes to swap the mood, then Drift will regenerate the days. Or remix as-is for fresh picks with the same vibes.
            </p>
          </div>

          {/* Vibes grid */}
          <div className="px-10 pb-6">
            <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-3">
              Vibes · {selectedVibes.length}/{MAX_VIBES}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_VIBES.map((v) => {
                const isActive = selectedVibes.includes(v.id)
                const isDisabled = !isActive && selectedVibes.length >= MAX_VIBES
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVibe(v.id)}
                    disabled={isDisabled || loading}
                    className={`rounded-full border px-4 py-2 text-[12px] transition-all duration-200 ${
                      isActive
                        ? 'border-drift-gold/40 bg-drift-gold/[0.08] text-drift-gold font-medium'
                        : isDisabled
                        ? 'border-white/[0.04] text-drift-text3/40 cursor-not-allowed'
                        : 'border-white/[0.06] text-drift-text2 hover:border-white/15 hover:text-drift-text hover:bg-white/[0.02]'
                    }`}
                  >
                    {v.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.05] bg-white/[0.01] px-10 py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={closeRemix}
                disabled={loading}
                className="rounded-full border border-white/[0.06] px-5 py-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-drift-text2 transition-all hover:border-white/15 hover:text-drift-text disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                onClick={handleRemix}
                disabled={loading || selectedVibes.length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-full bg-drift-gold py-3 text-[11px] font-bold uppercase tracking-[2px] text-drift-bg transition-all hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                    Remixing…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                    </svg>
                    {ctaLabel}
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => {
                closeRemix()
                openChat('Suggest improvements for this trip')
              }}
              disabled={loading}
              className="mt-3 flex w-full items-center justify-center gap-2 text-[11px] text-drift-text3 transition-colors hover:text-drift-text2 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Or ask Drift for suggestions instead
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
