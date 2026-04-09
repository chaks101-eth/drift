'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import NavBar from '@/app/NavBar'
import DesktopAuthProvider from '@/components/desktop/AuthProvider'
import { useTripStore, type Destination } from '@/stores/trip-store'

export default function DestinationsPage() {
  return (
    <DesktopAuthProvider>
      <DestinationsContent />
    </DesktopAuthProvider>
  )
}

function DestinationsContent() {
  const router = useRouter()
  const { token, onboarding, setDestination } = useTripStore()
  const { pickedVibes, budgetLevel, budgetAmount, travelers, origin, startDate, endDate } = onboarding

  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDest, setSelectedDest] = useState<Destination | null>(null)
  const [navigating, setNavigating] = useState(false)

  // Custom destination
  const [customDest, setCustomDest] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ city: string; country: string; description: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Redirect if no vibes selected
  useEffect(() => {
    if (pickedVibes.length === 0) router.push('/vibes')
  }, [pickedVibes, router])

  // Fetch destinations
  useEffect(() => {
    if (!token || pickedVibes.length === 0) return

    async function fetchDests() {
      setLoading(true)
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            type: 'destinations',
            vibes: pickedVibes,
            budget: budgetLevel,
            origin: origin || 'Delhi',
            start_date: startDate,
            end_date: endDate,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setDestinations(data.destinations || [])
        if (!data.destinations?.length) setError('No destinations found. Try different vibes.')
      } catch {
        setError('Couldn\'t load destinations.')
      } finally {
        setLoading(false)
      }
    }

    fetchDests()
  }, [token, pickedVibes, budgetLevel, origin, startDate, endDate])

  // Autocomplete
  useEffect(() => {
    if (customDest.length < 2) { setSuggestions([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(customDest)}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.predictions || [])
          setShowSuggestions(true)
        }
      } catch { /* ignore */ }
    }, 300)
  }, [customDest])

  const countryMap: Record<string, string> = {
    bali: 'Indonesia', bangkok: 'Thailand', dubai: 'UAE', paris: 'France', tokyo: 'Japan',
    istanbul: 'Turkey', phuket: 'Thailand', singapore: 'Singapore', maldives: 'Maldives',
    goa: 'India', london: 'UK', jaipur: 'India', manali: 'India', delhi: 'India',
  }

  function handleConfirm() {
    if (navigating) return

    if (customDest.trim().length > 1) {
      const city = customDest.trim()
      const country = customCountry || countryMap[city.toLowerCase()] || ''
      setDestination({ city, country, tagline: `Your ${city} adventure`, match: 100, vibes: pickedVibes })
    } else if (selectedDest) {
      setDestination(selectedDest)
    } else {
      return
    }

    setNavigating(true)
    router.push('/loading-trip')
  }

  const canConfirm = customDest.trim().length > 1 || selectedDest !== null

  return (
    <div className="min-h-screen bg-drift-bg text-drift-text animate-[fadeIn_0.4s_ease]">
      <NavBar />
      <div className="mx-auto max-w-[1100px] px-8 pt-20 pb-16">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-px w-8 bg-drift-gold opacity-60" />
          <span className="text-[10px] font-semibold tracking-[4px] uppercase text-drift-gold">Step 2 of 3 · Pick destination</span>
        </div>
        <h1 className="font-serif text-[clamp(36px,5vw,56px)] font-light mb-3 leading-[1.05]">
          Where should you <em className="text-drift-gold italic">drift</em>?
        </h1>
        <p className="text-[15px] text-drift-text2 mb-8 max-w-[560px]">Matched to your vibes: <span className="text-drift-gold">{pickedVibes.join(', ')}</span>. Or search for your own below.</p>

        {/* Custom destination search */}
        <div className="relative mb-8 max-w-[500px]">
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={customDest}
              onChange={e => { setCustomDest(e.target.value); setCustomCountry(''); setSelectedDest(null) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Or type a destination..."
              className="flex-1 bg-transparent text-sm text-drift-text placeholder:text-drift-text3 focus:outline-none"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-[rgba(255,255,255,0.08)] bg-drift-card shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => { setCustomDest(s.city); setCustomCountry(s.country); setShowSuggestions(false) }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[rgba(200,164,78,0.06)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  <div>
                    <span className="text-drift-text">{s.city}</span>
                    <span className="text-drift-text3">, {s.country}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-drift-gold/30 border-t-drift-gold" />
              <p className="mt-4 text-sm text-drift-text3">Matching destinations to your vibes...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-drift-text3 mb-4">{error}</p>
            <button onClick={() => router.push('/vibes')} className="rounded-xl border border-drift-gold/20 px-6 py-2.5 text-sm text-drift-gold hover:bg-drift-gold/5">
              Try different vibes
            </button>
          </div>
        )}

        {/* Destination grid */}
        {!loading && !error && destinations.length > 0 && (
          <div className="grid grid-cols-3 gap-5 mb-10 max-lg:grid-cols-2 max-md:grid-cols-1">
            {destinations.map((dest, i) => {
              const isSelected = selectedDest?.city === dest.city
              return (
                <div
                  key={dest.city}
                  onClick={() => { setSelectedDest(dest); setCustomDest(''); setCustomCountry('') }}
                  className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                    isSelected
                      ? 'border-drift-gold shadow-[0_0_32px_rgba(200,164,78,0.15)]'
                      : 'border-transparent hover:border-[rgba(255,255,255,0.1)] hover:-translate-y-1'
                  }`}
                >
                  <div className="relative h-[200px]">
                    {dest.image_url && (
                      <Image src={dest.image_url} alt={dest.city} fill className="object-cover" sizes="400px" unoptimized />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.95)] via-[rgba(8,8,12,0.4)_50%] to-transparent" />
                  </div>

                  {/* Match badge */}
                  <span className="absolute left-3 top-3 rounded-lg bg-drift-gold/15 border border-drift-gold/25 px-2.5 py-1 text-[10px] font-bold text-drift-gold backdrop-blur-xl">
                    {dest.match || 85}% match
                  </span>

                  {/* Check */}
                  <div className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? 'border-drift-gold bg-drift-gold' : 'border-white/25'
                  }`}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="text-lg font-semibold">{dest.city}</div>
                    <div className="text-[11px] text-drift-text3">{dest.country}{dest.price ? ` · from ${dest.price}` : ''}</div>
                    {dest.vibes && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dest.vibes.slice(0, 3).map(v => (
                          <span key={v} className="rounded-full bg-drift-gold/10 px-2 py-0.5 text-[9px] text-drift-gold">{v}</span>
                        ))}
                      </div>
                    )}
                    {dest.tagline && <p className="mt-1.5 text-[11px] text-drift-text2 line-clamp-2">{dest.tagline}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Confirm */}
        <div className="flex justify-center">
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || navigating}
            className={`min-w-[300px] rounded-full py-4 text-sm font-bold uppercase tracking-widest transition-all ${
              canConfirm && !navigating
                ? 'bg-gradient-to-r from-drift-gold to-[#a88a3e] text-drift-bg shadow-[0_12px_40px_rgba(200,164,78,0.25)] hover:-translate-y-0.5'
                : 'bg-drift-gold/20 text-drift-text3 cursor-not-allowed'
            }`}
          >
            {navigating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" />
              </span>
            ) : (
              `Plan ${customDest || selectedDest?.city || 'Trip'}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
