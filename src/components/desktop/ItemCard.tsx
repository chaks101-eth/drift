'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { parsePrice } from '@/lib/parse-price'
import { supabase } from '@/lib/supabase'
import { useTripStore, type ItineraryItem, type ItemMetadata } from '@/stores/trip-store'
import { useUIStore } from '@/stores/ui-store'

const FALLBACK_IMAGES: Record<string, string> = {
  hotel: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop&q=80',
  activity: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=400&h=300&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=300&fit=crop&q=80',
}

const catIcons: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  hotel: {
    icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M14 11h4M6 15h4M14 15h4M10 21V7l2-4 2 4v14" /></svg>,
    cls: 'text-drift-ok',
    label: 'Hotel',
  },
  food: {
    icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>,
    cls: 'text-drift-gold',
    label: 'Food',
  },
  activity: {
    icon: <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>,
    cls: 'text-drift-gold',
    label: 'Activity',
  },
}

interface Props {
  item: ItineraryItem
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  isDragging?: boolean
  isDragTarget?: boolean
  reaction?: { count: number; reacted: boolean }
  onReact?: () => void
  onStartPoll?: () => void
  poll?: { options: Array<{ name: string; votes: string[] }>; status: string }
  onVote?: (optionIndex: number) => void
  onApplyPoll?: () => void
  onClosePoll?: () => void
}

export default function DesktopItemCard({ item, onClick, draggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDragTarget, reaction, onReact, onStartPoll, poll, onVote, onApplyPoll, onClosePoll }: Props) {
  const meta = (item.metadata || {}) as ItemMetadata
  const formatBudget = useTripStore((s) => s.formatBudget)
  const removeItem = useTripStore((s) => s.removeItem)
  const toast = useUIStore((s) => s.toast)
  const cat = catIcons[item.category] || catIcons.activity

  const [imgSrc, setImgSrc] = useState(item.image_url || FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const onImgError = useCallback(() => {
    setImgSrc(FALLBACK_IMAGES[item.category] || FALLBACK_IMAGES.default)
  }, [item.category])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Remove "${item.name}" from your trip?`)) return
    setMenuOpen(false)

    // Optimistic delete
    removeItem(item.id)
    const { error } = await supabase.from('itinerary_items').delete().eq('id', item.id)
    if (error) {
      toast('Delete failed — refresh to retry', true)
    } else {
      toast(`Removed ${item.name}`)
    }
  }, [item, removeItem, toast])

  const handleViewMap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    const mapsUrl = (meta.mapsUrl as string) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`
    window.open(mapsUrl, '_blank')
  }, [item.name, meta.mapsUrl])

  const handleBook = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    const bookingUrl = meta.bookingUrl as string
    if (bookingUrl) {
      window.open(bookingUrl, '_blank')
    } else {
      toast('No booking link yet', true)
    }
  }, [meta.bookingUrl, toast])

  const price = parsePrice(item.price)
  const priceStr = price === 0 ? 'Free' : formatBudget(price)
  const rating = meta.rating as number | undefined
  const reviewCount = meta.reviewCount as number | undefined
  const tags = (meta.features as string[]) || []
  const source = meta.source as string | undefined
  const isVerified = source && ['catalog', 'ai+grounded', 'url_import_enriched'].includes(source)
  const isHotel = item.category === 'hotel'

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative w-[230px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border transition-all duration-400
        ${isDragging ? 'opacity-30 scale-95' : ''}
        ${isDragTarget ? 'ring-2 ring-drift-gold scale-[1.02]' : ''}
        ${isHotel
          ? 'border-white/[0.06] bg-[#0c0c12]'
          : 'border-white/[0.06] bg-[#0c0c12]'
        }
        hover:border-white/15 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]`}
    >
      {/* Image */}
      <div className="relative h-[140px] w-full overflow-hidden">
        <Image
          src={imgSrc}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          sizes="230px"
          unoptimized={!imgSrc.includes('unsplash.com') && !imgSrc.includes('googleusercontent.com')}
          onError={onImgError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,12,0.85)] via-[rgba(8,8,12,0.1)] to-transparent" />

        {/* Source badge */}
        {isVerified && (
          <span className="absolute left-2.5 top-2.5 z-[2] flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-md border border-white/10 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider text-white/85">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            Verified
          </span>
        )}

        {/* 3-dot menu */}
        <div className="absolute right-2 top-2 z-[3]" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-[rgba(255,255,255,0.12)] text-white transition-opacity ${
              menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-[10] min-w-[180px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(14,14,20,0.98)] backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden animate-[fadeUp_0.15s_ease]">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick?.() }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-drift-text2 hover:bg-drift-gold/[0.06] hover:text-drift-gold transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                View Details
              </button>
              <button
                onClick={handleViewMap}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-drift-text2 hover:bg-drift-gold/[0.06] hover:text-drift-gold transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                View on Map
              </button>
              {meta.bookingUrl && (
                <button
                  onClick={handleBook}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-drift-text2 hover:bg-drift-gold/[0.06] hover:text-drift-gold transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Book Now
                </button>
              )}
              <div className="border-t border-[rgba(255,255,255,0.06)]" />
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-drift-err/80 hover:bg-drift-err/[0.08] hover:text-drift-err transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Time badge */}
        {item.time && (
          <span className="absolute bottom-2.5 right-2.5 z-[2] rounded-md bg-black/55 backdrop-blur-md px-2 py-0.5 text-[9px] font-medium text-white/90">
            {item.time}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category — much smaller, neutral */}
        <div className={`mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[1.5px] ${cat.cls} opacity-70`}>
          {cat.icon}
          {cat.label}
        </div>

        {/* Name */}
        <div className="text-[14px] font-semibold leading-snug text-drift-text line-clamp-2 min-h-[36px]">{item.name}</div>

        {/* Meta */}
        <div className="mt-1 text-[11px] text-drift-text3 line-clamp-1">{item.detail}</div>

        {/* Price + Rating */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-drift-text">{priceStr}</span>
          {rating && rating > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-drift-text3">
              <span className="text-amber-400/80">★</span>
              <span className="font-medium text-drift-text2">{rating.toFixed(1)}</span>
              {reviewCount && reviewCount > 0 && (
                <span className="text-drift-text3/60">({reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount})</span>
              )}
            </span>
          )}
        </div>

        {/* Tags — neutral */}
        {tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t, i) => (
              <span key={i} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-drift-text3">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Reaction + poll trigger */}
        {(onReact || onStartPoll) && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center gap-3">
            {onReact && (
              <button
                onClick={(e) => { e.stopPropagation(); onReact() }}
                className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                  reaction?.reacted ? 'text-drift-gold' : 'text-drift-text3 hover:text-drift-gold'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={reaction?.reacted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {reaction && reaction.count > 0 && <span className="tabular-nums">{reaction.count}</span>}
              </button>
            )}
            {onStartPoll && !poll && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartPoll() }}
                className="text-[9px] text-drift-text3 hover:text-drift-gold transition-colors"
              >
                Not sure?
              </button>
            )}
          </div>
        )}

        {/* Active poll */}
        {poll && poll.status === 'open' && onVote && (
          <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] bg-white/[0.02] -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold uppercase tracking-[1.5px] text-drift-gold">Group vote</span>
              {onClosePoll && (
                <button onClick={onClosePoll} className="text-[8px] text-drift-text3 hover:text-drift-text2 transition-colors">Dismiss</button>
              )}
            </div>
            <div className="space-y-1.5">
              {poll.options.map((opt, i) => {
                const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
                const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0
                const userId = useTripStore.getState().userId
                const voted = opt.votes.includes(userId || '')
                return (
                  <button
                    key={i}
                    onClick={() => onVote(i)}
                    className={`relative w-full rounded-lg border px-3 py-2 text-left text-[11px] overflow-hidden transition-all ${
                      voted ? 'border-drift-gold/40 text-drift-text' : 'border-white/[0.06] text-drift-text2 hover:border-white/15'
                    }`}
                  >
                    <div className="absolute inset-0 bg-drift-gold/10 rounded-lg" style={{ width: `${pct}%` }} />
                    <div className="relative flex justify-between">
                      <span className="truncate font-medium">{opt.name}</span>
                      <span className="shrink-0 ml-2 text-drift-text3 tabular-nums">{opt.votes.length}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Apply winner button — shows when there are votes */}
            {(() => {
              const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
              if (totalVotes === 0 || !onApplyPoll) return null
              const winner = poll.options.reduce((a, b) => a.votes.length >= b.votes.length ? a : b)
              return (
                <button
                  onClick={onApplyPoll}
                  className="mt-2 w-full rounded-lg bg-drift-gold/10 border border-drift-gold/25 py-2 text-[10px] font-semibold text-drift-gold hover:bg-drift-gold/20 transition-colors"
                >
                  Apply winner: {winner.name}
                </button>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
