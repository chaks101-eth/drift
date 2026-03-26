'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'

// Category-specific fallback images (curated Unsplash, never expire)
const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&h=400&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=400&fit=crop&q=80',
}

interface ItemCardProps {
  item: ItineraryItem
  tripVibes: string[]
  onTap: () => void
  onMenu: () => void
}

const tagConfig: Record<string, { cls: string; label: string }> = {
  hotel: { cls: 'bg-drift-ok/10 text-drift-ok', label: 'Hotel' },
  food: { cls: 'bg-drift-warn/10 text-drift-warn', label: 'Food' },
  activity: { cls: 'bg-drift-gold-bg text-drift-gold', label: 'Activity' },
}

export default function ItemCard({ item, tripVibes, onTap, onMenu }: ItemCardProps) {
  const meta = (item.metadata || {}) as ItemMetadata
  const tag = tagConfig[item.category] || tagConfig.activity
  const updateItem = useTripStore((s) => s.updateItem)
  const formatBudget = useTripStore((s) => s.formatBudget)
  const toast = useUIStore((s) => s.toast)

  const [showWhy, setShowWhy] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  const onImgError = useCallback(() => {
    setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  }, [item.category])

  const reason = (meta.reason as string) || (meta.honest_take as string) || ''
  const alts = (meta.alts as Array<{ name: string; detail: string; price: string; image_url?: string; trust?: Array<{ type: string; text: string }> }>) || []

  const handleSwap = async (alt: typeof alts[number], e: React.MouseEvent) => {
    e.stopPropagation()
    const prevName = item.name
    const updates = { name: alt.name, detail: alt.detail, price: alt.price, image_url: alt.image_url || item.image_url }
    updateItem(item.id, updates)
    await supabase.from('itinerary_items').update(updates).eq('id', item.id)
    toast(`Swapped ${prevName} → ${alt.name}`)
    setShowAlts(false)
  }

  return (
    <div className="rounded-2xl border border-drift-border bg-drift-card overflow-hidden">
      {/* Main card — tappable */}
      <div role="button" tabIndex={0} className="relative" onClick={onTap} onKeyDown={(e) => { if (e.key === 'Enter') onTap() }}>
        {/* 3-dot menu */}
        <button
          onClick={(e) => { e.stopPropagation(); onMenu() }}
          aria-label={`Menu for ${item.name}`}
          className="absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-drift-text2">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>

        <div className="flex gap-0">
          {/* Image */}
          <div className="relative h-[92px] w-[92px] shrink-0 bg-drift-surface">
            <Image
              src={imgSrc}
              alt={item.name}
              fill
              className="object-cover"
              sizes="92px"
              unoptimized={!imgSrc.includes('unsplash.com') && !imgSrc.includes('googleusercontent.com') && !imgSrc.includes('googleapis.com')}
              onError={onImgError}
            />
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col justify-center p-3">
            <span className={`mb-1 inline-block self-start rounded-md px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider ${tag.cls}`}>
              {tag.label}
            </span>
            <div className="text-[13px] font-semibold leading-tight text-drift-text line-clamp-1">
              {item.name}
            </div>
            <div className="mt-0.5 text-[10px] leading-snug text-drift-text3 line-clamp-1">
              {item.detail || ''}
            </div>
            <div className="mt-1 text-xs font-bold text-drift-text">
              {(() => {
                const num = parsePrice(item.price)
                return num === 0 ? 'Free' : formatBudget(num)
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Inline actions — Why this? + Alternatives */}
      {(reason || alts.length > 0) && (
        <div className="border-t border-drift-border2 px-3 py-1.5 flex gap-3">
          {reason && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowWhy(!showWhy); setShowAlts(false) }}
              className="flex items-center gap-1 text-[9px] font-semibold text-drift-gold/70 transition-colors hover:text-drift-gold"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Why this?
            </button>
          )}
          {alts.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAlts(!showAlts); setShowWhy(false) }}
              className="flex items-center gap-1 text-[9px] font-semibold text-drift-text3 transition-colors hover:text-drift-text2"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              {alts.length} alternative{alts.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Expanded: Why this? */}
      {showWhy && reason && (
        <div className="border-t border-drift-border2 px-3 py-2.5 animate-[fadeUp_0.2s_ease-out]">
          <div className="flex gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-drift-gold to-drift-gold-dim text-[7px] font-extrabold text-drift-bg">
              D
            </div>
            <p className="flex-1 text-[10px] leading-relaxed text-drift-text2">{reason}</p>
          </div>
          {meta.whyFactors && (meta.whyFactors as string[]).length > 0 && (
            <div className="mt-2 ml-7 flex flex-col gap-1">
              {(meta.whyFactors as string[]).slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[9px] text-drift-text3">
                  <span className="mt-0.5 text-drift-gold/50">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded: Alternatives carousel */}
      {showAlts && alts.length > 0 && (
        <div className="border-t border-drift-border2 px-3 py-2.5 animate-[fadeUp_0.2s_ease-out]">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
            {alts.map((alt, i) => {
              const altNum = parsePrice(alt.price)
              const ratingBadge = alt.trust?.find(t => t.type === 'success')

              return (
                <div key={i} className="w-[150px] shrink-0 rounded-xl border border-drift-border2 bg-drift-surface overflow-hidden">
                  {alt.image_url && (
                    <div className="relative h-[48px] w-full">
                      <Image src={alt.image_url} alt={alt.name} fill className="object-cover" sizes="150px" unoptimized />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="text-[11px] font-semibold text-drift-text line-clamp-1">{alt.name}</div>
                    <div className="mt-0.5 text-[9px] text-drift-text3 line-clamp-1">{alt.detail}</div>
                    {ratingBadge && (
                      <span className="mt-1 inline-block rounded bg-drift-ok/10 px-1.5 py-0.5 text-[7px] font-bold text-drift-ok">
                        {ratingBadge.text}
                      </span>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-drift-text">
                        {altNum === 0 ? 'Free' : formatBudget(altNum)}
                      </span>
                      <button
                        onClick={(e) => handleSwap(alt, e)}
                        className="rounded-md bg-drift-gold px-2 py-0.5 text-[8px] font-bold text-drift-bg"
                      >
                        Swap
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
  )
}
