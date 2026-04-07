'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&h=400&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=400&fit=crop&q=80',
}

const tagConfig: Record<string, { cls: string; label: string }> = {
  hotel: { cls: 'bg-drift-ok/10 text-drift-ok', label: 'Hotel' },
  food: { cls: 'bg-drift-warn/10 text-drift-warn', label: 'Food' },
  activity: { cls: 'bg-drift-gold-bg text-drift-gold', label: 'Activity' },
}

interface DesktopItemCardProps {
  item: ItineraryItem
  tripVibes: string[]
}

export default function DesktopItemCard({ item, tripVibes }: DesktopItemCardProps) {
  const meta = (item.metadata || {}) as ItemMetadata
  const tag = tagConfig[item.category] || tagConfig.activity
  const updateItem = useTripStore((s) => s.updateItem)
  const formatBudget = useTripStore((s) => s.formatBudget)
  const toast = useUIStore((s) => s.toast)

  const [showWhy, setShowWhy] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  const [menuOpen, setMenuOpen] = useState(false)

  const onImgError = useCallback(() => {
    setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  }, [item.category])

  const handleSwap = useCallback(async (alt: { name: string; detail?: string; price?: string; image_url?: string }) => {
    const updates = { name: alt.name, detail: alt.detail || item.detail, price: alt.price || item.price, image_url: alt.image_url || item.image_url }
    updateItem(item.id, updates)
    await supabase.from('itinerary_items').update(updates).eq('id', item.id)
    toast(`Swapped → ${alt.name}`)
    setShowAlts(false)
  }, [item, updateItem, toast])

  const alts = (meta.alts || []) as Array<{ name: string; detail?: string; price?: string; image_url?: string }>
  const num = parsePrice(item.price)
  const priceStr = num === 0 ? 'Free' : formatBudget(num)
  const rating = meta.rating as number | undefined
  const reviewCount = meta.reviewCount as number | undefined
  const source = meta.source as string | undefined

  return (
    <div className="group relative rounded-2xl border border-drift-border bg-drift-card transition-all duration-300 hover:border-drift-gold/20 hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="relative h-[100px] w-[140px] shrink-0 overflow-hidden rounded-xl bg-drift-surface">
          <Image
            src={imgSrc}
            alt={item.name}
            fill
            className="object-cover"
            sizes="140px"
            unoptimized={!imgSrc.includes('unsplash.com') && !imgSrc.includes('googleusercontent.com')}
            onError={onImgError}
          />
          {imgSrc.includes('unsplash.com') && (
            <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 py-px text-[7px] text-white/50">Illustration</span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            {/* Tags row */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className={`inline-block rounded-md px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${tag.cls}`}>
                {tag.label}
              </span>
              {source && (
                <span className={`inline-block rounded-md px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider ${
                  ['catalog', 'ai+grounded', 'url_import_enriched'].includes(source) ? 'bg-drift-ok/10 text-drift-ok' : 'bg-drift-surface2 text-drift-text3'
                }`}>
                  {['catalog', 'ai+grounded', 'url_import_enriched'].includes(source) ? 'Verified' : 'AI'}
                </span>
              )}
              {item.time && (
                <span className="text-[10px] text-drift-text3">{item.time}</span>
              )}
            </div>

            {/* Name + detail */}
            <h3 className="text-[15px] font-semibold text-drift-text">{item.name}</h3>
            <p className="mt-0.5 text-[12px] text-drift-text3 line-clamp-1">{item.detail}</p>
            {item.description && (
              <p className="mt-1 text-[11px] text-drift-text2 line-clamp-2 leading-relaxed">{item.description}</p>
            )}
          </div>

          {/* Bottom row: price + rating */}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-bold text-drift-text">{priceStr}</span>
            {rating && rating > 0 && (
              <span className="text-[11px] text-drift-text3">
                <span className="text-amber-400">★</span> {rating.toFixed(1)}
                {reviewCount && reviewCount > 0 && (
                  <span className="text-drift-text3/60"> ({reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount})</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* 3-dot menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-drift-surface"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border border-drift-border bg-drift-card/95 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <button onClick={() => { setShowWhy(!showWhy); setMenuOpen(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[12px] text-drift-text2 hover:bg-drift-gold/5 hover:text-drift-gold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  Why this?
                </button>
                <button onClick={() => { setShowAlts(!showAlts); setMenuOpen(false) }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[12px] text-drift-text2 hover:bg-drift-gold/5 hover:text-drift-gold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /></svg>
                  Swap ({alts.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Why this? — expandable */}
      {showWhy && meta.reason && (
        <div className="border-t border-drift-border px-4 py-3">
          <div className="flex items-start gap-2 rounded-xl bg-drift-gold/5 border border-drift-gold/10 px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="mt-0.5 shrink-0"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            <div>
              <p className="text-[12px] text-drift-gold font-medium">{meta.reason as string}</p>
              {(meta.whyFactors as string[])?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {(meta.whyFactors as string[]).map((f, i) => (
                    <li key={i} className="text-[11px] text-drift-text3">• {f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alternatives — expandable */}
      {showAlts && alts.length > 0 && (
        <div className="border-t border-drift-border px-4 py-3">
          <div className="text-[10px] text-drift-text3 uppercase tracking-wider mb-2">Alternatives</div>
          <div className="space-y-2">
            {alts.map((alt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-drift-surface px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-drift-text">{alt.name}</div>
                  {alt.detail && <div className="text-[10px] text-drift-text3">{alt.detail}</div>}
                </div>
                <span className="text-[11px] font-medium text-drift-text shrink-0">
                  {parsePrice(alt.price) === 0 ? 'Free' : formatBudget(parsePrice(alt.price))}
                </span>
                <button
                  onClick={() => handleSwap(alt)}
                  className="shrink-0 rounded-lg bg-drift-gold/10 px-3 py-1.5 text-[10px] font-bold text-drift-gold hover:bg-drift-gold/20"
                >
                  Swap
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
