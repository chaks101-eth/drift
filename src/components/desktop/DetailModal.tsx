'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { parsePrice } from '@/lib/parse-price'
import { supabase } from '@/lib/supabase'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'

const TripMap = dynamic(() => import('./TripMap'), { ssr: false })

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000&h=800&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&h=800&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1000&h=800&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1000&h=800&fit=crop&q=80',
}

const CATEGORY_LABELS: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Stay',
  activity: 'Activity',
  food: 'Food',
}

interface Props {
  item: ItineraryItem
  onClose: () => void
  onChat: (msg: string) => void
}

export default function DetailModal({ item, onClose, onChat }: Props) {
  const meta = (item.metadata || {}) as ItemMetadata
  const formatBudget = useTripStore((s) => s.formatBudget)
  const updateItem = useTripStore((s) => s.updateItem)
  const toast = useUIStore((s) => s.toast)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  const categoryLabel = CATEGORY_LABELS[item.category] || 'Item'
  const price = parsePrice(item.price)
  const priceStr = price === 0 ? 'Free' : formatBudget(price)
  const rating = meta.rating as number | undefined
  const reviewCount = meta.reviewCount as number | undefined
  const features = (meta.features as string[]) || []
  const reason = meta.reason as string | undefined
  const whyFactors = (meta.whyFactors as string[]) || []
  const alts = (meta.alts || []) as Array<{ name: string; detail?: string; price?: string; image_url?: string }>
  const info = (meta.info || []) as Array<{ l: string; v: string }>
  const photos = (meta.photos as string[]) || []
  const address = meta.address as string | undefined

  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  const [swapping, setSwapping] = useState<string | null>(null)

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    firstButtonRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSwap = useCallback(async (alt: typeof alts[0]) => {
    setSwapping(alt.name)
    const prevState = { name: item.name, detail: item.detail, price: item.price, image_url: item.image_url }
    const updates = { name: alt.name, detail: alt.detail || item.detail, price: alt.price || item.price, image_url: alt.image_url || item.image_url }

    updateItem(item.id, updates)
    try {
      const { error } = await supabase.from('itinerary_items').update(updates).eq('id', item.id)
      if (error) throw error
      toast(`Swapped → ${alt.name}`)
      onClose()
    } catch {
      updateItem(item.id, prevState)
      toast('Swap failed — try again', true)
      setSwapping(null)
    }
  }, [item, updateItem, onClose, toast])

  // Compact stats row — only show what exists
  const stats: Array<{ label: string; value: string }> = []
  if (item.category === 'hotel') stats.push({ label: 'Per night', value: priceStr })
  else stats.push({ label: 'Price', value: priceStr })
  if (rating && rating > 0) {
    stats.push({
      label: reviewCount && reviewCount > 0 ? `${reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount} reviews` : 'Rating',
      value: `★ ${rating.toFixed(1)}`,
    })
  }
  if (item.time) stats.push({ label: 'Time', value: item.time })
  info.slice(0, 4 - stats.length).forEach(i => stats.push({ label: i.l, value: i.v }))

  return (
    <>
      {/* Backdrop — softer */}
      <div
        className="fixed inset-0 z-[240] bg-black/75 backdrop-blur-lg animate-[fadeIn_0.3s_ease]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-8 pointer-events-none">
        <div className="relative grid max-h-[86vh] w-full max-w-[980px] overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0c0c12] shadow-[0_60px_140px_rgba(0,0,0,0.85)] pointer-events-auto animate-[fadeUp_0.4s_cubic-bezier(0.2,0.8,0.2,1)] lg:grid-cols-[440px_1fr]">

          {/* ─── Left: Image ────────────────────────────────── */}
          <div className="relative min-h-[280px] lg:min-h-[520px] bg-[#08080c]">
            <Image
              src={imgSrc}
              alt={item.name}
              fill
              className="object-cover"
              sizes="440px"
              unoptimized
              onError={() => setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)}
            />

            {/* Photo nav dots — bottom center */}
            {photos.length > 1 && (
              <div className="absolute bottom-5 left-0 right-0 flex gap-1.5 justify-center">
                {photos.slice(0, 6).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setImgSrc(p)}
                    className={`h-1 rounded-full transition-all duration-300 ${imgSrc === p ? 'w-8 bg-white' : 'w-3 bg-white/35 hover:bg-white/55'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── Right: Content (flex column with fixed footer) ─ */}
          <div className="flex flex-col max-h-[86vh] overflow-hidden relative">
            {/* Close button — absolutely positioned over scrolling content */}
            <button
              onClick={onClose}
              ref={firstButtonRef}
              aria-label="Close"
              className="absolute right-6 top-6 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-drift-bg/40 backdrop-blur-md text-drift-text3 transition-all hover:bg-white/[0.08] hover:text-drift-text focus:outline-none"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-9 lg:p-10 pb-6 scrollbar-hide">
              <div className="pr-2">

            {/* Category — neutral, small caps */}
            <div className="text-[9px] font-semibold uppercase tracking-[2.5px] text-drift-text3 mb-3">
              {categoryLabel}
            </div>

            {/* Title */}
            <h2 className="font-serif text-[30px] font-light leading-[1.1] text-drift-text mb-2 pr-10">{item.name}</h2>

            {/* Detail / address */}
            {(item.detail || address) && (
              <div className="flex items-start gap-1.5 text-[12px] text-drift-text3 mb-7 leading-relaxed">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-1 shrink-0 opacity-50">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                <span>{address || item.detail}</span>
              </div>
            )}

            {/* Stats row — inline with hairline separators */}
            {stats.length > 0 && (
              <div className="flex items-end gap-6 mb-8 pb-6 border-b border-white/[0.05]">
                {stats.map((s, i) => (
                  <div key={i} className={`${i > 0 ? 'pl-6 border-l border-white/[0.05]' : ''}`}>
                    <div className="text-[16px] font-medium text-drift-text tabular-nums">{s.value}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-[1.5px] text-drift-text3">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {item.description && (
              <p className="text-[13.5px] leading-[1.85] text-drift-text2 mb-8">{item.description}</p>
            )}

            {/* Highlights — minimal, separated by middots */}
            {features.length > 0 && (
              <div className="mb-8">
                <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2.5">Highlights</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-drift-text2">
                  {features.map((f, i) => (
                    <span key={i} className="flex items-center gap-3">
                      {i > 0 && <span className="text-drift-text3/40">·</span>}
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mini-map */}
            {(meta.lat && meta.lng) ? (
              <div className="mb-8">
                <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2.5">Location</div>
                <div className="overflow-hidden rounded-xl border border-white/[0.05]">
                  <TripMap items={[item]} height="180px" />
                </div>
              </div>
            ) : null}

            {/* Why this — editorial reasoning + factor list */}
            {reason && (
              <div className="mb-8 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="opacity-70 shrink-0">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <div className="text-[9px] font-semibold uppercase tracking-[2.5px] text-drift-gold/80">Why Drift picked this</div>
                </div>

                {/* The reason — leads the section */}
                <p className="text-[13.5px] italic text-drift-text2 leading-[1.7] mb-5">
                  {reason.startsWith('"') ? reason : `"${reason}"`}
                </p>

                {/* Structured factor list */}
                {whyFactors.length > 0 && (
                  <div className="border-t border-white/[0.04] pt-4">
                    <div className="text-[8px] font-semibold uppercase tracking-[2px] text-drift-text3 mb-2.5">Key reasons</div>
                    <ul className="space-y-1.5">
                      {whyFactors.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[12px] text-drift-text2 leading-snug">
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#c8a44e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 opacity-60">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Alternatives */}
            {alts.length > 0 && (
              <div className="mb-8">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[2px] text-drift-text3">Alternatives</div>
                  <div className="text-[10px] text-drift-text3">{alts.length} options</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {alts.map((alt, i) => {
                    const altPrice = parsePrice(alt.price)
                    const savings = price - altPrice
                    return (
                      <div key={i} className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015] transition-all duration-300 hover:border-white/12 hover:-translate-y-0.5">
                        {alt.image_url && (
                          <div className="relative h-[100px] w-full">
                            <Image src={alt.image_url} alt={alt.name} fill className="object-cover" unoptimized />
                            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.85)] to-transparent" />
                            {savings > 0 && (
                              <span className="absolute top-2 right-2 rounded bg-black/60 backdrop-blur-md border border-white/10 px-1.5 py-0.5 text-[9px] font-medium text-drift-ok">
                                Save {formatBudget(savings)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="p-3">
                          <div className="text-[12px] font-semibold text-drift-text line-clamp-1">{alt.name}</div>
                          {alt.detail && <div className="mt-0.5 text-[10px] text-drift-text3 line-clamp-1">{alt.detail}</div>}
                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="text-[12px] font-semibold text-drift-text2 tabular-nums">{altPrice === 0 ? 'Free' : formatBudget(altPrice)}</span>
                            <button
                              onClick={() => handleSwap(alt)}
                              disabled={swapping !== null}
                              className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-drift-text2 transition-all hover:border-drift-gold/40 hover:text-drift-gold hover:bg-drift-gold/[0.04] disabled:opacity-50"
                            >
                              {swapping === alt.name ? '...' : 'Swap'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

              </div>
            </div>

            {/* Action footer — fixed at the bottom of the right column */}
            <div className="shrink-0 border-t border-white/[0.05] bg-[#0c0c12] px-9 lg:px-10 py-5 flex items-center gap-3">
              {meta.bookingUrl ? (
                <a
                  href={meta.bookingUrl as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-full bg-drift-gold py-3 text-[11px] font-bold uppercase tracking-[2px] text-drift-bg text-center transition-all hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] hover:-translate-y-0.5"
                >
                  Book Now
                </a>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 rounded-full bg-drift-gold py-3 text-[11px] font-bold uppercase tracking-[2px] text-drift-bg transition-all hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] hover:-translate-y-0.5"
                >
                  Keep This
                </button>
              )}
              <button
                onClick={() => { onClose(); onChat(`Tell me more about ${item.name}`) }}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] px-5 py-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-drift-text2 transition-all hover:border-white/20 hover:text-drift-text"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Ask Drift
              </button>
              <button
                onClick={() => {
                  const mapsUrl = (meta.mapsUrl as string) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`
                  window.open(mapsUrl, '_blank')
                }}
                aria-label="View on map"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] text-drift-text3 transition-all hover:border-white/20 hover:text-drift-text"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
