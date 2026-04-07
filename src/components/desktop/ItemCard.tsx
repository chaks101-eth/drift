'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&h=300&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=300&fit=crop&q=80',
}

const catIcons: Record<string, { icon: React.ReactNode; cls: string }> = {
  hotel: {
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M14 11h4M6 15h4M14 15h4M10 21V7l2-4 2 4v14" /></svg>,
    cls: 'text-drift-ok',
  },
  food: {
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>,
    cls: 'text-drift-warn',
  },
  activity: {
    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>,
    cls: 'text-drift-gold',
  },
}

interface Props {
  item: ItineraryItem
  onClick?: () => void
}

export default function DesktopItemCard({ item, onClick }: Props) {
  const meta = (item.metadata || {}) as ItemMetadata
  const formatBudget = useTripStore((s) => s.formatBudget)
  const cat = catIcons[item.category] || catIcons.activity

  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  const onImgError = useCallback(() => {
    setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  }, [item.category])

  const price = parsePrice(item.price)
  const priceStr = price === 0 ? 'Free' : formatBudget(price)
  const rating = meta.rating as number | undefined
  const tags = (meta.features as string[]) || []
  const reason = meta.reason as string | undefined
  const isHotel = item.category === 'hotel'

  return (
    <div
      onClick={onClick}
      className={`group relative w-[220px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border transition-all duration-400
        ${isHotel
          ? 'border-drift-ok/15 bg-gradient-to-b from-drift-ok/[0.04] to-[rgba(8,8,12,0.95)]'
          : 'border-[rgba(255,255,255,0.06)] bg-[rgba(8,8,12,0.95)]'
        }
        hover:border-drift-gold/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]`}
    >
      {/* Image */}
      <div className="relative h-[120px] w-full overflow-hidden">
        <Image
          src={imgSrc}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="220px"
          unoptimized={!imgSrc.includes('unsplash.com') && !imgSrc.includes('googleusercontent.com')}
          onError={onImgError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.6)] to-transparent" />

        {/* 3-dot menu — appears on hover */}
        <div className="absolute right-2 top-2 z-[3] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 opacity-0 backdrop-blur-md border border-[rgba(255,255,255,0.1)] transition-opacity group-hover:opacity-100">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5">
        {/* Category */}
        <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${cat.cls}`}>
          {cat.icon}
          {item.category === 'hotel' ? 'Hotel' : item.category === 'food' ? 'Food' : 'Activity'}
          {item.time && <span className="ml-auto text-[9px] font-normal text-drift-text3">{item.time}</span>}
        </div>

        {/* Name */}
        <div className="font-serif text-[15px] leading-tight text-drift-text line-clamp-2">{item.name}</div>

        {/* Meta */}
        <div className="mt-1 text-[11px] text-drift-text3 line-clamp-1">{item.detail}</div>

        {/* Price + Rating */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-drift-gold">{priceStr}</span>
          {rating && rating > 0 && (
            <span className="text-[10px] text-drift-text3">
              <span className="text-amber-400">★</span> {rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t, i) => (
              <span key={i} className="rounded-full bg-drift-gold/[0.06] border border-drift-gold/10 px-2 py-0.5 text-[8px] text-drift-gold">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reason bar */}
      {reason && (
        <div className="mx-3.5 mb-3 flex items-start gap-1.5 rounded-lg bg-gradient-to-r from-drift-gold/[0.08] to-drift-gold/[0.03] border border-drift-gold/10 px-2.5 py-2">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#c8a44e" strokeWidth="1.5" className="mt-0.5 shrink-0 opacity-70">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span className="text-[9px] leading-relaxed text-drift-gold/80 line-clamp-2">{reason}</span>
        </div>
      )}
    </div>
  )
}
