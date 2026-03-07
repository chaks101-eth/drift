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

export default function ShareTripView({ trip, items }: { trip: Trip; items: Item[] }) {
  const [copiedLink, setCopiedLink] = useState(false)

  const days: { label: string; items: Item[] }[] = []
  let currentDay: { label: string; items: Item[] } | null = null

  for (const item of items) {
    if (item.category === 'day') {
      currentDay = { label: item.name, items: [] }
      days.push(currentDay)
    } else if (currentDay) {
      currentDay.items.push(item)
    } else {
      // Items before first day separator
      if (!days.length) days.push({ label: 'Overview', items: [] })
      days[0].items.push(item)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const categoryIcon: Record<string, string> = {
    flight: '\u2708', hotel: '\u2616', activity: '\u2605',
    food: '\u2615', transfer: '\u2192',
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Hero */}
      <div className="px-8 pt-16 pb-10 text-center border-b border-[rgba(255,255,255,0.06)]">
        <p className="text-[11px] tracking-[4px] uppercase text-[#c8a44e] mb-3">Shared Trip</p>
        <h1 className="font-serif text-[clamp(32px,5vw,56px)] font-normal mb-2">
          {trip.destination}, <em className="text-[#c8a44e] italic">{trip.country}</em>
        </h1>
        <p className="text-[#7a7a85] text-sm mb-4">
          {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''} &middot; {trip.start_date} to {trip.end_date} &middot; {trip.budget} budget
        </p>
        <div className="flex justify-center gap-2 mb-6">
          {trip.vibes?.map(v => (
            <span key={v} className="px-3 py-1 bg-[rgba(200,164,78,0.1)] border border-[rgba(200,164,78,0.2)] rounded-full text-xs text-[#c8a44e]">{v}</span>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={copyLink}
            className="px-6 py-2.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 transition-all"
          >
            {copiedLink ? 'Link Copied!' : 'Copy Link'}
          </button>
          <a
            href="/"
            className="px-6 py-2.5 border border-[rgba(255,255,255,0.1)] text-sm rounded-full hover:border-[#c8a44e] transition-colors"
          >
            Plan Your Own Trip
          </a>
        </div>
      </div>

      {/* Itinerary */}
      <div className="max-w-[900px] mx-auto px-8 py-10">
        {days.map((day, di) => (
          <div key={di} className="mb-10">
            <h2 className="font-serif text-xl text-[#c8a44e] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[rgba(200,164,78,0.15)] flex items-center justify-center text-sm font-semibold">{di + 1}</span>
              {day.label}
            </h2>
            <div className="space-y-3 ml-4 border-l border-[rgba(255,255,255,0.06)] pl-6">
              {day.items.map(item => (
                <div key={item.id} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden flex">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-[120px] h-auto object-cover flex-shrink-0" />
                  )}
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{categoryIcon[item.category] || '\u2022'}</span>
                        <span className="font-serif text-[15px]">{item.name}</span>
                      </div>
                      {item.price && <span className="text-[#c8a44e] text-sm flex-shrink-0">{item.price}</span>}
                    </div>
                    {item.detail && <div className="text-xs text-[#7a7a85] mb-1">{item.detail}</div>}
                    {item.time && <div className="text-[10px] text-[#4a4a55]">{item.time}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="text-center py-16 border-t border-[rgba(255,255,255,0.06)]">
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
