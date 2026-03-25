'use client'

import { useState } from 'react'
import Image from 'next/image'

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

function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const categoryColors: Record<string, string> = {
  flight: '#c8a44e', hotel: '#4ecdc4', activity: '#e8cc6e', food: '#f0a500', transfer: '#7a7a85',
}

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400',
}

export default function ShareTripView({ trip, items }: { trip: Trip; items: Item[] }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  // Parse days
  const days: { label: string; items: Item[]; insight?: string; mapUrl?: string; weather?: Record<string, unknown> }[] = []
  let currentDay: typeof days[0] | null = null
  let tripBrief = ''
  let weatherSummary = ''

  for (const item of items) {
    if (item.category === 'day') {
      const meta = item.metadata || {}
      if (meta.trip_brief) tripBrief = meta.trip_brief as string
      if (meta.weatherSummary) weatherSummary = meta.weatherSummary as string
      currentDay = {
        label: item.name,
        items: [],
        insight: meta.day_insight as string | undefined,
        mapUrl: meta.dayMapUrl as string | undefined,
        weather: meta.weather as Record<string, unknown> | undefined,
      }
      days.push(currentDay)
    } else if (currentDay) {
      currentDay.items.push(item)
    } else {
      if (!days.length) days.push({ label: 'Overview', items: [] })
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

  function onImageError(id: string) {
    setFailedImages(prev => new Set([...prev, id]))
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8]">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(200,164,78,0.06) 0%, transparent 50%)' }}
      />

      {/* Hero */}
      <div className="relative z-[1] px-8 pt-16 pb-10 text-center border-b border-[rgba(255,255,255,0.06)] max-md:px-5 max-md:pt-12 max-md:pb-8">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.1s]">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#8B7845] flex items-center justify-center text-[9px] font-extrabold text-[#08080c]">D</div>
          <span className="text-[11px] tracking-[3px] uppercase text-[#7a7a85]">Drift Trip</span>
        </div>

        <h1 className="font-serif text-[clamp(32px,6vw,52px)] font-light mb-1 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.2s]">
          {trip.destination}{trip.country && trip.country.toLowerCase() !== trip.destination?.toLowerCase() ? <span className="text-[#c8a44e] italic font-serif">, {trip.country}</span> : ''}
        </h1>

        <p className="text-[#7a7a85] text-[13px] mb-5 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.3s]">
          {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)} · {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''} · {trip.budget}
        </p>

        <div className="flex justify-center gap-2 mb-5 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.35s]">
          {trip.vibes?.map(v => (
            <span key={v} className="px-3 py-1 bg-[rgba(200,164,78,0.08)] border border-[rgba(200,164,78,0.15)] rounded-full text-[10px] font-medium text-[#c8a44e] uppercase tracking-wider">{v}</span>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-8 mb-6 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.4s] max-md:gap-5">
          <div className="text-center">
            <div className="text-2xl font-light text-[#f0efe8]">{days.length}</div>
            <div className="text-[8px] uppercase tracking-wider text-[#4a4a55] font-semibold">Days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-light text-[#c8a44e]">{items.filter(i => i.category === 'activity').length + items.filter(i => i.category === 'food').length}</div>
            <div className="text-[8px] uppercase tracking-wider text-[#4a4a55] font-semibold">Stops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-light text-[#e8cc6e]">${totalCost.toLocaleString()}</div>
            <div className="text-[8px] uppercase tracking-wider text-[#4a4a55] font-semibold">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-light text-[#7a7a85]">${perPerson.toLocaleString()}</div>
            <div className="text-[8px] uppercase tracking-wider text-[#4a4a55] font-semibold">/Person</div>
          </div>
        </div>

        {/* Trip Brief */}
        {tripBrief && (
          <div className="max-w-[500px] mx-auto mb-5 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.5s]">
            <div className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-2xl px-5 py-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#8B7845] flex items-center justify-center text-[7px] font-bold text-[#08080c]">D</div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#4a4a55]">Drift&apos;s strategy</span>
              </div>
              <p className="text-[12px] leading-relaxed text-[#7a7a85]">{tripBrief}</p>
              {weatherSummary && (
                <div className="mt-3 flex items-start gap-2 bg-[rgba(255,255,255,0.03)] rounded-lg px-3 py-2">
                  <span className="text-sm mt-px">{weatherSummary.toLowerCase().includes('rain') ? '🌧' : '☀️'}</span>
                  <p className="text-[10px] leading-snug text-[#7a7a85]">{weatherSummary}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-3 opacity-0 animate-[fadeUp_0.8s_ease_forwards_0.6s]">
          <button onClick={copyLink}
            className="px-6 py-2.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(200,164,78,0.3)] transition-all active:scale-95">
            {copiedLink ? 'Link Copied!' : 'Copy Link'}
          </button>
          <a href="/m"
            className="px-6 py-2.5 border border-[rgba(255,255,255,0.1)] text-sm rounded-full hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all">
            Plan Your Own Trip
          </a>
        </div>
      </div>

      {/* Itinerary */}
      <div className="relative z-[1] max-w-[680px] mx-auto px-8 py-10 max-md:px-5 max-md:py-6">
        {days.map((day, di) => (
          <div key={di} className="mb-10">
            {/* Day header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-full bg-[rgba(200,164,78,0.12)] border border-[rgba(200,164,78,0.15)] flex items-center justify-center text-sm font-semibold text-[#c8a44e]">{di + 1}</span>
              <div className="flex-1">
                <h2 className="font-serif text-lg text-[#f0efe8]">{day.label}</h2>
              </div>
              {day.weather && (
                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${(day.weather.isRainy) ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}>
                  <span className="text-xs">{(day.weather.isRainy) ? '🌧' : (day.weather.isSunny) ? '☀️' : '⛅'}</span>
                  <span className={`text-[10px] font-semibold ${(day.weather.isRainy) ? 'text-blue-400' : 'text-amber-400'}`}>{day.weather.tempMax as number}°</span>
                </div>
              )}
            </div>

            {/* Day map */}
            {day.mapUrl && (
              <div className="mb-4 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)]">
                <img src={day.mapUrl} alt={`Map for Day ${di + 1}`} className="h-[140px] w-full object-cover" loading="lazy" />
              </div>
            )}

            {/* Day insight */}
            {day.insight && (
              <div className="mb-4 flex gap-2.5 rounded-xl bg-[rgba(200,164,78,0.04)] border border-[rgba(200,164,78,0.08)] px-4 py-3">
                <div className="h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#8B7845] flex items-center justify-center text-[7px] font-bold text-[#08080c] mt-px">D</div>
                <p className="text-[11px] leading-relaxed text-[#7a7a85]">{day.insight}</p>
              </div>
            )}

            {/* Items */}
            <div className="space-y-3 ml-4 border-l border-[rgba(255,255,255,0.06)] pl-5 max-md:ml-2 max-md:pl-4">
              {day.items.filter(i => i.category !== 'transfer').map(item => {
                const meta = item.metadata as Record<string, unknown> | null
                const reason = meta?.reason as string | undefined
                const rating = meta?.rating as number | undefined
                const catColor = categoryColors[item.category] || '#7a7a85'
                const imgSrc = failedImages.has(item.id) ? FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.activity : item.image_url

                return (
                  <div key={item.id} className="bg-[#0e0e14] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden flex hover:border-[rgba(255,255,255,0.1)] transition-all">
                    {imgSrc && (
                      <div className="relative w-[100px] min-h-[80px] flex-shrink-0 max-md:w-[72px]">
                        <Image
                          src={imgSrc}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="100px"
                          unoptimized={!imgSrc.includes('unsplash.com')}
                          onError={() => onImageError(item.id)}
                        />
                      </div>
                    )}
                    <div className="p-3.5 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ background: `${catColor}15`, color: catColor }}>
                            {item.category}
                          </span>
                          <span className="font-serif text-[14px] truncate">{item.name}</span>
                        </div>
                        {item.price && <span className="text-[13px] font-light flex-shrink-0" style={{ color: catColor }}>{item.price}</span>}
                      </div>
                      {item.detail && <div className="text-[11px] text-[#7a7a85] mb-1.5 line-clamp-1">{item.detail}</div>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.time && <span className="text-[9px] text-[#4a4a55] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded">{item.time}</span>}
                        {rating && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">{rating}★</span>}
                        {reason && <span className="text-[9px] text-[#c8a44e] bg-[rgba(200,164,78,0.06)] px-1.5 py-0.5 rounded line-clamp-1">{reason}</span>}
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
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#c8a44e] to-[#8B7845] flex items-center justify-center text-sm font-extrabold text-[#08080c] mx-auto mb-4">D</div>
        <p className="font-serif text-2xl text-[#f0efe8] mb-2">Want a trip like this?</p>
        <p className="text-[#7a7a85] text-sm mb-6">Tell Drift your vibes and we&apos;ll build it in seconds.</p>
        <a href="/m"
          className="inline-block px-8 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[rgba(200,164,78,0.3)] transition-all active:scale-95">
          Plan My Trip
        </a>
        <p className="mt-4 text-[10px] text-[#4a4a55]">Real photos · Real prices · Weather-aware · AI-powered</p>
      </div>
    </div>
  )
}
