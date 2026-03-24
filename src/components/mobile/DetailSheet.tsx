'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'
import type { ItemMetadata } from '@/stores/trip-store'

function generateFallbackReason(item: { name: string; category: string }, vibes: string[]): string {
  const v = vibes[0] || 'travel'
  const templates: Record<string, string[]> = {
    hotel: [
      `Picked for location and value — fits your ${v} energy without blowing the budget.`,
      `This one stood out for the reviews. Real travelers, not bots, say it delivers.`,
    ],
    activity: [
      `This is why you came. Core ${v} experience, not a tourist trap.`,
      `Strategically placed in your day — high energy when you need it, chill when you don't.`,
    ],
    food: [
      `Not the most famous spot, but the one locals actually eat at.`,
      `Picked for the food, not the Instagram. This place earns every review.`,
    ],
  }
  const pool = templates[item.category] || templates.activity
  return pool[item.name.length % pool.length]
}

export default function DetailSheet() {
  const { showDetail, detailItemId, closeDetail, openChat } = useUIStore()
  const { currentItems, currentTrip, formatBudget, updateItem } = useTripStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  const item = currentItems.find((i) => i.id === detailItemId)
  const meta = (item?.metadata || {}) as ItemMetadata

  // Reset scroll on open
  useEffect(() => {
    if (showDetail) {
      setActivePhoto(0)
      scrollRef.current?.scrollTo({ left: 0 })
    }
  }, [showDetail, detailItemId])

  if (!item) return null

  const photos = (meta.photos || []).filter((p): p is string => typeof p === 'string' && p.length > 0)
  const mainImg = item.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80'
  const allPhotos = photos.length > 1
    ? [mainImg, ...photos.filter((p) => p !== mainImg)].slice(0, 6)
    : [mainImg]

  const reason = meta.reason || generateFallbackReason(item, currentTrip?.vibes || [])
  const features = meta.features || []
  const info = meta.info || []
  const alts = meta.alts || []

  // Stats
  const stats: Array<{ v: string; l: string }> = []
  if (item.price) {
    const num = parseFloat((item.price || '0').replace(/[^0-9.]/g, '')) || 0
    stats.push({ v: num === 0 ? 'Free' : formatBudget(num), l: item.category === 'hotel' ? 'Per Night' : 'Price' })
  }
  info.slice(0, 3).forEach((i) => stats.push({ v: i.v, l: i.l }))

  // Booking URL
  const bookingUrl = (meta.bookingUrl || meta.booking_url) as string | undefined
  const mapsUrl = meta.mapsUrl as string | undefined
  const dest = currentTrip?.destination || ''
  const searchName = encodeURIComponent(`${item.name} ${dest}`)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth)
    setActivePhoto(idx)
  }

  return (
    <div className={`fixed inset-0 z-[150] transition-opacity duration-300 ${showDetail ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop — closes on tap */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDetail} onTouchEnd={closeDetail} />

      <div className={`absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-drift-border2 bg-drift-card transition-transform duration-500 ease-[var(--ease-spring)] ${showDetail ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Handle — tap to close */}
        <div className="sticky top-0 z-10 flex justify-center bg-drift-card pt-3 pb-2 cursor-pointer" onClick={closeDetail}>
          <div className="h-1 w-9 rounded-full bg-white/25" />
        </div>

        {/* Close button */}
        <button onClick={closeDetail} aria-label="Close detail" className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Gallery */}
        <div className="relative overflow-hidden">
          <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide">
            {allPhotos.map((url, i) => (
              <div key={i} className="relative h-[210px] w-full shrink-0 snap-start">
                <Image src={url} alt={`${item.name} photo ${i + 1}`} fill className="object-cover" sizes="100vw" unoptimized />
              </div>
            ))}
          </div>
          {allPhotos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 z-[3] flex -translate-x-1/2 gap-1.5">
              {allPhotos.map((_, i) => (
                <span key={i} className={`rounded-full transition-all ${i === activePhoto ? 'h-[5px] w-3.5 bg-white' : 'h-[5px] w-[5px] bg-white/35'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          {/* Title */}
          <h2 className="mt-4 font-serif text-xl font-semibold text-drift-text">{item.name}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-drift-text2">{item.description || item.detail || ''}</p>

          {/* Stats */}
          {stats.length > 0 && (
            <div className="mt-4 flex gap-3">
              {stats.map((s, i) => (
                <div key={i} className="flex-1 rounded-xl border border-drift-border2 bg-drift-surface p-3 text-center">
                  <div className="text-sm font-bold text-drift-text">{s.v}</div>
                  <div className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-drift-text3">{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Features */}
          {features.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {features.map((f, i) => (
                <span key={i} className="rounded-full border border-drift-border2 bg-drift-surface px-3 py-1 text-[10px] font-medium text-drift-text2">
                  {f as string}
                </span>
              ))}
            </div>
          )}

          {/* AI Reason */}
          <div className="mt-4 rounded-xl border border-drift-gold/8 bg-gradient-to-br from-drift-gold/4 to-drift-gold/1 p-3">
            <div className="flex gap-2.5">
              <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[8px] font-extrabold text-drift-bg">
                D
              </div>
              <p className="flex-1 text-[10.5px] leading-relaxed text-drift-text2">{reason}</p>
            </div>
          </div>

          {/* Booking / Maps */}
          <div className="mt-4 flex gap-2">
            {bookingUrl ? (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-drift-gold py-3 text-[11px] font-bold text-drift-bg">
                Book Now
              </a>
            ) : item.category === 'hotel' ? (
              <a href={`https://www.booking.com/search.html?ss=${searchName}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-drift-gold py-3 text-[11px] font-bold text-drift-bg">
                Find on Booking.com
              </a>
            ) : item.category === 'activity' ? (
              <a href={`https://www.viator.com/searchResults/all?text=${searchName}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-drift-gold py-3 text-[11px] font-bold text-drift-bg">
                Find on Viator
              </a>
            ) : item.category === 'food' ? (
              <a href={`https://www.google.com/maps/search/${searchName}`} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-drift-gold py-3 text-[11px] font-bold text-drift-bg">
                View on Maps
              </a>
            ) : null}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-drift-border2 bg-drift-surface px-4 py-3 text-[11px] font-bold text-drift-text">
                Maps
              </a>
            )}
          </div>

          {/* Alternatives */}
          {alts.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-drift-text3">Alternatives</div>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {alts.map((alt, i) => (
                  <div key={i} className="w-[160px] shrink-0 rounded-xl border border-drift-border2 bg-drift-surface p-3">
                    <div className="text-xs font-semibold text-drift-text line-clamp-1">{alt.name}</div>
                    <div className="mt-0.5 text-[10px] text-drift-text3 line-clamp-1">{alt.detail}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-drift-text">{(() => { const n = parseFloat((alt.price || '0').replace(/[^0-9.]/g, '')) || 0; return n === 0 ? 'Free' : formatBudget(n) })()}</span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!item) return
                          const prevName = item.name
                          const updates = { name: alt.name, detail: alt.detail, price: alt.price, image_url: alt.image_url || item.image_url }
                          updateItem(item.id, updates)
                          await supabase.from('itinerary_items').update(updates).eq('id', item.id)
                          closeDetail()
                          useUIStore.getState().toast(`Swapped ${prevName} → ${alt.name}`)
                        }}
                        className="rounded-lg bg-drift-gold px-2.5 py-1 text-[9px] font-bold text-drift-bg"
                      >Swap</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { closeDetail(); useUIStore.getState().openCardMenu(item.id) }}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface text-drift-text3"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
            <button
              onClick={() => { closeDetail(); openChat(`Tell me more about ${item.name}`) }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-drift-border2 bg-drift-surface py-3 text-xs font-semibold text-drift-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Ask AI
            </button>
            <button
              onClick={() => { closeDetail(); openChat(`Find me alternatives for ${item.name}`) }}
              className="flex flex-1 items-center justify-center rounded-xl border border-drift-border2 bg-drift-surface py-3 text-xs font-semibold text-drift-text"
            >
              Find Alternatives
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
