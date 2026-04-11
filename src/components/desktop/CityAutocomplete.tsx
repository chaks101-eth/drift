'use client'

import { useState, useRef, useEffect } from 'react'

interface Suggestion {
  city: string
  country: string
  description: string
}

interface Props {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
}

export default function CityAutocomplete({ value, onChange, placeholder = 'Delhi, Mumbai, London…', className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch suggestions on input change — use callback to avoid lint warning
  const fetchSuggestions = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) { setSuggestions([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          const preds = (data.predictions || []) as Suggestion[]
          setSuggestions(preds)
          if (preds.length > 0) setShowDropdown(true)
        }
      } catch { /* ignore */ }
    }, 300)
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  const handleSelect = (s: Suggestion) => {
    onChange(s.city)
    setSuggestions([])
    setShowDropdown(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 focus-within:border-drift-gold/30 transition-colors ${className || ''}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5" className="shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value) }}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[13px] text-drift-text placeholder:text-drift-text3 focus:outline-none"
        />
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-white/[0.08] bg-[#0c0c12] shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden max-h-[240px] overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[12px] hover:bg-drift-gold/[0.04] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7a7a85" strokeWidth="1.5" className="shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0">
                <span className="text-drift-text font-medium">{s.city}</span>
                <span className="text-drift-text3">, {s.country}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
