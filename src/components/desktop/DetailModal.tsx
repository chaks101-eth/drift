'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { parsePrice } from '@/lib/parse-price'
import { supabase } from '@/lib/supabase'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&h=600&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop&q=80',
}

const tagBadge: Record<string, { cls: string; label: string }> = {
  flight: { cls: 'bg-drift-gold/20 text-drift-gold', label: 'Flight' },
  hotel: { cls: 'bg-drift-ok/20 text-drift-ok', label: 'Hotel' },
  activity: { cls: 'bg-[rgba(160,120,200,0.2)] text-[#a080c8]', label: 'Activity' },
  food: { cls: 'bg-drift-warn/20 text-drift-warn', label: 'Food' },
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

  const badge = tagBadge[item.category] || tagBadge.activity
  const price = parsePrice(item.price)
  const priceStr = price === 0 ? 'Free' : formatBudget(price)
  const rating = meta.rating as number | undefined
  const reviewCount = meta.reviewCount as number | undefined
  const features = (meta.features as string[]) || []
  const reason = meta.reason as string | undefined
  const whyFactors = (meta.whyFactors as string[]) || []
  const alts = (meta.alts || []) as Array<{ name: string; detail?: string; price?: string; image_url?: string }>
  const info = (meta.info || []) as Array<{ l: string; v: string }>

  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)

  const handleSwap = useCallback(async (alt: typeof alts[0]) => {
    const updates = { name: alt.name, detail: alt.detail || item.detail, price: alt.price || item.price, image_url: alt.image_url || item.image_url }
    updateItem(item.id, updates)
    await supabase.from('itinerary_items').update(updates).eq('id', item.id)
    onClose()
  }, [item, updateItem, onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[240] bg-black/65 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-10">
        <div className="relative grid max-h-[85vh] w-full max-w-[920px] overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(14,14,18,0.98)] shadow-[0_40px_100px_rgba(0,0,0,0.7)] backdrop-blur-xl md:grid-cols-[400px_1fr]">

          {/* Left: Image */}
          <div className="relative min-h-[200px] md:min-h-[400px]">
            <Image
              src={imgSrc}
              alt={item.name}
              fill
              className="object-cover"
              sizes="400px"
              unoptimized
              onError={() => setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,14,18,0.5)] to-transparent md:bg-gradient-to-r md:from-transparent md:to-transparent" />

            {/* Badge */}
            <span className={`absolute left-5 top-5 rounded-lg px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xl ${badge.cls}`}>
              {badge.label}
            </span>

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur-xl text-white transition-all hover:bg-black/70 hover:scale-105"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Right: Content */}
          <div className="overflow-y-auto p-8 md:p-9 max-h-[85vh]">
            {/* Type */}
            <div className="text-[10px] font-bold uppercase tracking-widest text-drift-gold mb-2">{badge.label}</div>

            {/* Title */}
            <h2 className="font-serif text-[28px] font-light leading-tight text-drift-text mb-1.5">{item.name}</h2>

            {/* Location/detail */}
            <div className="flex items-center gap-1.5 text-[12px] text-drift-text2 mb-5">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {item.detail}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[
                { v: priceStr, l: item.category === 'hotel' ? 'Per Night' : 'Price' },
                rating ? { v: `★ ${rating.toFixed(1)}`, l: reviewCount ? `${reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount} reviews` : 'Rating' } : null,
                ...info.slice(0, 2).map(i => ({ v: i.v, l: i.l })),
              ].filter(Boolean).map((s, i) => (
                <div key={i} className="rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-3 py-3 text-center">
                  <div className="text-[15px] font-bold text-drift-gold">{s!.v}</div>
                  <div className="mt-0.5 text-[8px] uppercase tracking-wider text-drift-text3">{s!.l}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-[13px] leading-[1.85] text-drift-text2 mb-6">{item.description}</p>
            )}

            {/* Features */}
            {features.length > 0 && (
              <div className="mb-6">
                <div className="text-[8px] uppercase tracking-widest text-drift-text3 font-bold mb-2.5">Highlights</div>
                <div className="flex flex-wrap gap-1.5">
                  {features.map((f, i) => (
                    <span key={i} className="rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] text-drift-text2 transition-all hover:border-drift-gold/15 hover:text-drift-text">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Why this */}
            {reason && (
              <div className="mb-6 rounded-xl bg-gradient-to-r from-drift-gold/[0.06] to-drift-gold/[0.02] border border-drift-gold/12 px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-drift-gold mb-2.5">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  Why Drift picked this
                </div>
                <p className="text-[13px] text-drift-text2 leading-[1.75]">{reason}</p>
                {whyFactors.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {whyFactors.map((f, i) => (
                      <span key={i} className="rounded-full bg-drift-gold/[0.06] border border-drift-gold/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-drift-gold">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Alternatives */}
            {alts.length > 0 && (
              <div className="mb-6">
                <div className="text-[8px] uppercase tracking-widest text-drift-text3 font-bold mb-2.5">Alternatives</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {alts.map((alt, i) => (
                    <div key={i} className="w-[200px] shrink-0 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] overflow-hidden transition-all hover:border-drift-gold/25 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
                      <div className="p-3.5">
                        <div className="text-[12px] font-semibold text-drift-text mb-1">{alt.name}</div>
                        <div className="flex justify-between text-[10px] text-drift-text3">
                          <span>{alt.detail || ''}</span>
                          <span className="font-bold text-drift-gold">{parsePrice(alt.price) === 0 ? 'Free' : formatBudget(parsePrice(alt.price))}</span>
                        </div>
                        <button
                          onClick={() => handleSwap(alt)}
                          className="mt-2.5 w-full rounded-lg bg-drift-gold/[0.08] border border-drift-gold/12 py-1.5 text-[10px] font-bold uppercase tracking-wider text-drift-gold transition-all hover:bg-drift-gold hover:text-drift-bg"
                        >
                          Swap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
              <button onClick={onClose} className="flex-1 rounded-xl bg-drift-gold py-4 text-[13px] font-bold uppercase tracking-wider text-drift-bg transition-all hover:shadow-[0_8px_32px_rgba(200,164,78,0.3)] hover:-translate-y-0.5">
                Keep This
              </button>
              <button
                onClick={() => { onClose(); onChat(`Tell me more about ${item.name}`) }}
                className="flex items-center gap-2 rounded-xl bg-drift-gold/[0.06] border border-drift-gold/10 px-5 py-4 text-[13px] font-semibold text-drift-gold transition-all hover:bg-drift-gold/[0.12]"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Ask Drift
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
