'use client'

import Image from 'next/image'
import type { ItineraryItem, ItemMetadata } from '@/stores/trip-store'

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

  // Vibe match
  const itemVibes = [...(meta.best_for || []), ...(meta.features || [])]
  let matchCount = 0
  tripVibes.forEach((v) => {
    if (itemVibes.some((iv) => String(iv).toLowerCase().includes(v.toLowerCase()))) matchCount++
  })
  const matchPct = tripVibes.length > 0 ? Math.round((matchCount / tripVibes.length) * 100) : 0

  return (
    <div role="button" tabIndex={0} className="relative rounded-2xl border border-drift-border bg-drift-card overflow-hidden" onClick={onTap} onKeyDown={(e) => { if (e.key === 'Enter') onTap() }}>
      {/* 3-dot menu */}
      <button
        onClick={(e) => { e.stopPropagation(); onMenu() }}
        aria-label={`Menu for ${item.name}`}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-drift-text2">
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>

      <div className="flex gap-0">
        {/* Image */}
        <div className="relative h-[92px] w-[92px] shrink-0">
          <Image
            src={item.image_url || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=90'}
            alt={item.name}
            fill
            className="object-cover"
            sizes="92px"
            unoptimized={!item.image_url?.includes('unsplash.com') && !item.image_url?.includes('googleusercontent.com')}
          />
          {item.time && (
            <span className="absolute bottom-1 left-1 z-[2] rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm">
              {item.time}
            </span>
          )}
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
            {item.price || ''}
          </div>
          {matchPct > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-0.5 flex-1 rounded-full bg-drift-border2">
                <div className="h-full rounded-full bg-drift-gold opacity-50" style={{ width: `${matchPct}%` }} />
              </div>
              <span className="text-[7px] font-semibold tracking-wider text-drift-text3">
                {matchPct}% match
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
