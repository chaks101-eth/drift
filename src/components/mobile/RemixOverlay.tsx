'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'

const allVibeOptions = [
  { id: 'beach', name: 'Beach' },
  { id: 'adventure', name: 'Adventure' },
  { id: 'city', name: 'City' },
  { id: 'romance', name: 'Romance' },
  { id: 'spiritual', name: 'Spiritual' },
  { id: 'foodie', name: 'Foodie' },
  { id: 'party', name: 'Party' },
  { id: 'culture', name: 'Culture' },
]

export default function RemixOverlay() {
  const { showRemix, closeRemix, openChat, toast } = useUIStore()
  const { currentTrip, token, loadTrip } = useTripStore()
  const router = useRouter()
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const currentVibes = currentTrip?.vibes || []

  // Reset vibes when overlay opens
  useEffect(() => {
    if (showRemix) {
      setSelectedVibes([...currentVibes])
    }
  }, [showRemix]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVibe = (id: string) => {
    setSelectedVibes((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) { toast('Need at least 1 vibe'); return prev }
        return prev.filter((v) => v !== id)
      }
      if (prev.length >= 5) {
        toast('Max 5 vibes')
        return prev
      }
      return [...prev, id]
    })
  }

  const vibesChanged =
    selectedVibes.length > 0 &&
    (selectedVibes.length !== currentVibes.length ||
      selectedVibes.some((v) => !currentVibes.includes(v)))

  const btnText = vibesChanged
    ? `Remix with ${selectedVibes.length} New Vibe${selectedVibes.length > 1 ? 's' : ''}`
    : 'Remix Trip'

  const handleRemix = async () => {
    if (!currentTrip || !token || loading) return
    closeRemix()
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

      if (data.error) {
        toast('Remix failed: ' + data.error, true)
        setLoading(false)
        return
      }

      // Reload trip data from Supabase
      await loadTrip(currentTrip.id)
      toast('Trip remixed — check out the new stops!')
    } catch {
      toast("Couldn't remix. Check your connection.", true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => useUIStore.getState().openRemix()}
        aria-label="Remix trip"
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-[18px] z-[15] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-drift-gold shadow-[0_6px_24px_rgba(200,164,78,0.3),0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="2">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      </button>

      {/* Overlay */}
      <div className={`fixed inset-0 z-[250] transition-opacity duration-300 ${showRemix ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40" onClick={closeRemix} />

        <div className={`absolute bottom-0 left-0 right-0 max-h-[75vh] overflow-y-auto rounded-t-[20px] border-t border-drift-border2 bg-drift-card transition-transform duration-400 ease-[var(--ease-spring)] ${showRemix ? 'translate-y-0' : 'translate-y-full'}`}>
          {/* Handle */}
          <div className="flex justify-center py-2.5">
            <div className="h-[3px] w-8 rounded-full bg-white/8" />
          </div>

          {/* Description */}
          <p className="px-6 pb-2.5 text-xs leading-relaxed text-drift-text2">
            Tap vibes to change the energy. Or remix as-is for fresh picks with the same vibes.
          </p>

          {/* Vibe chips */}
          <div className="flex flex-wrap gap-2 px-6 pb-3.5">
            {allVibeOptions.map((v) => {
              const isActive = selectedVibes.includes(v.id)
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVibe(v.id)}
                  className={`inline-flex items-center gap-1.5 rounded-[20px] border px-3.5 py-2 text-xs transition-all duration-200 active:scale-95 ${
                    isActive
                      ? 'border-drift-gold/30 bg-drift-gold/10 font-semibold text-drift-gold'
                      : 'border-drift-border2 bg-white/3 text-drift-text2'
                  }`}
                >
                  {v.name}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="border-t border-drift-border px-6 py-3.5 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <button
              onClick={handleRemix}
              disabled={loading}
              className="w-full rounded-xl bg-drift-gold py-3.5 text-xs font-bold tracking-wider text-drift-bg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'Remixing...' : btnText}
            </button>

            <button
              onClick={() => {
                closeRemix()
                openChat('Suggest improvements for this trip')
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 border-t border-drift-border2 pt-3.5 text-xs font-medium text-drift-text2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Ask Drift for suggestions instead
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
