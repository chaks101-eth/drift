'use client'

import { useState } from 'react'

type Trip = {
  destination: string; country: string; vibes: string[];
  start_date: string; end_date: string; travelers: number; budget: string
}

type Item = {
  id: string; category: string; name: string; detail: string; description: string | null;
  price: string; image_url: string | null; time: string | null; position: number;
  metadata: Record<string, unknown> | null
}

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0
}

const categoryColors: Record<string, string> = {
  flight: '#c8a44e', hotel: '#4ecdc4', activity: '#e8cc6e', food: '#f0a500', transfer: '#7a7a85',
}

export default function ShareTripView({ trip, items }: { trip: Trip; items: Item[] }) {
  const [copiedLink, setCopiedLink] = useState(false)

  const days: { label: string; detail: string; items: Item[] }[] = []
  let currentDay: { label: string; detail: string; items: Item[] } | null = null

  for (const item of items) {
    if (item.category === 'day') {
      currentDay = { label: item.name, detail: item.detail || '', items: [] }
      days.push(currentDay)
    } else if (currentDay) {
      currentDay.items.push(item)
    } else {
      if (!days.length) days.push({ label: 'Overview', detail: '', items: [] })
      days[0].items.push(item)
    }
  }

  // Stats
  const real = items.filter(i => i.category !== 'day' && i.category !== 'transfer')
  const totalCost = real.reduce((s, i) => s + parsePrice(i.price), 0)
  const perPerson = trip.travelers ? Math.round(totalCost / trip.travelers) : totalCost

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(200,164,78,0.06) 0%, transparent 50%)' }}
      />

      {/* Hero */}
      <div className="relative z-[1] px-8 pt-16 pb-12 text-center border-b border-[rgba(255,255,255,0.06)] max-md:px-4 max-md:pt-10 max-md:pb-8">
        <p className="text-[11px] tracking-[4px] uppercase text-[#c8a44e] mb-3 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.1s]">Shared Trip</p>
        <h1 className="font-serif text-[clamp(32px,5vw,56px)] font-normal mb-2 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.2s]">
          {trip.destination}, <em className="text-[#c8a44e] italic">{trip.country}</em>
        </h1>
        <p className="text-[#7a7a85] text-sm mb-5 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.3s]">
          {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''} &middot; {trip.start_date} to {trip.end_date} &middot; {trip.budget} budget
        </p>

        {/* Trip stats row */}
        <div className="flex justify-center gap-6 mb-5 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.4s] max-md:gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">Days</span>
            <span className="text-lg font-light text-[#f0efe8]">{days.length}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">Activities</span>
            <span className="text-lg font-light text-[#e8cc6e]">{items.filter(i => i.category === 'activity').length}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">Total</span>
            <span className="text-lg font-light text-[#c8a44e]">${totalCost.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-[#4a4a55] uppercase tracking-wider">/person</span>
            <span className="text-lg font-light text-[#7a7a85]">${perPerson.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-6 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.5s]">
          {trip.vibes?.map(v => (
            <span key={v} className="px-3 py-1 bg-[rgba(200,164,78,0.1)] border border-[rgba(200,164,78,0.2)] rounded-full text-xs text-[#c8a44e]">{v}</span>
          ))}
        </div>
        <div className="flex justify-center gap-3 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.6s]">
          <button
            onClick={copyLink}
            className="px-6 py-2.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(200,164,78,0.3)] transition-all"
          >
            {copiedLink ? 'Link Copied!' : 'Copy Link'}
          </button>
          <a
            href="/"
            className="px-6 py-2.5 border border-[rgba(255,255,255,0.1)] text-sm rounded-full hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all"
          >
            Plan Your Own Trip
          </a>
        </div>
      </div>

      {/* Itinerary */}
      <div className="relative z-[1] max-w-[900px] mx-auto px-8 py-10 max-md:px-4 max-md:py-6">
        {days.map((day, di) => (
          <div key={di} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-[rgba(200,164,78,0.15)] border border-[rgba(200,164,78,0.2)] flex items-center justify-center text-sm font-semibold text-[#c8a44e]">{di + 1}</span>
              <div>
                <h2 className="font-serif text-xl text-[#f0efe8]">{day.label}</h2>
                {day.detail && <p className="text-[11px] text-[#4a4a55]">{day.detail}</p>}
              </div>
            </div>
            <div className="space-y-3 ml-4 border-l border-[rgba(255,255,255,0.06)] pl-6 max-md:ml-2 max-md:pl-4">
              {day.items.filter(i => i.category !== 'transfer').map(item => {
                const meta = item.metadata as Record<string, unknown> | null
                const reason = meta?.reason as string | undefined
                const catColor = categoryColors[item.category] || '#7a7a85'
                return (
                  <div key={item.id} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden flex hover:border-[rgba(255,255,255,0.12)] transition-all">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-[120px] h-auto object-cover flex-shrink-0 max-md:w-[80px]" />
                    )}
                    <div className="p-4 flex-1 min-w-0 max-md:p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ background: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>
                            {item.category}
                          </span>
                          <span className="font-serif text-[15px] truncate max-md:text-[13px]">{item.name}</span>
                        </div>
                        {item.price && <span className="text-sm font-light flex-shrink-0" style={{ color: catColor }}>{item.price}</span>}
                      </div>
                      {item.detail && <div className="text-xs text-[#7a7a85] mb-1 line-clamp-1">{item.detail}</div>}
                      <div className="flex items-center gap-3">
                        {item.time && <span className="text-[10px] text-[#4a4a55]">{item.time}</span>}
                        {reason && (
                          <span className="text-[9px] text-[#c8a44e] bg-[rgba(200,164,78,0.08)] px-1.5 py-0.5 rounded">
                            {reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="relative z-[1] text-center py-16 border-t border-[rgba(255,255,255,0.06)]">
        <p className="font-serif text-2xl text-[#f0efe8] mb-2">Want a trip like this?</p>
        <p className="text-[#7a7a85] text-sm mb-6">Drift creates personalized travel plans in seconds.</p>
        <a
          href="/"
          className="inline-block px-8 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[rgba(200,164,78,0.3)] transition-all"
        >
          Plan My Trip
        </a>
      </div>
    </div>
  )
}
