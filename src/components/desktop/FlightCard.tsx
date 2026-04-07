'use client'

import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem } from '@/stores/trip-store'

interface Props {
  item: ItineraryItem
  onClick?: () => void
}

export default function DesktopFlightCard({ item, onClick }: Props) {
  const formatBudget = useTripStore((s) => s.formatBudget)
  const meta = (item.metadata || {}) as Record<string, unknown>

  const dep = (meta.departure || {}) as Record<string, string>
  const arr = (meta.arrival || {}) as Record<string, string>
  const airline = (meta.airline as string) || item.detail || ''
  const duration = (meta.duration as string) || ''
  const stops = (meta.stops as string) || 'Direct'
  const price = parsePrice(item.price)
  const tags = (meta.features as string[]) || []

  return (
    <div
      onClick={onClick}
      className="group w-[280px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-drift-gold/15 bg-gradient-to-b from-drift-gold/[0.06] to-[rgba(8,8,12,0.95)] transition-all duration-400 hover:border-drift-gold/30 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
    >
      {/* Route display */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2.5">
        {/* Departure */}
        <div className="text-center shrink-0">
          <div className="font-serif text-[22px] font-light tracking-wide text-drift-text">{dep.airport || '?'}</div>
          <div className="text-[9px] text-drift-text3">{dep.city || ''}</div>
        </div>

        {/* Route line */}
        <div className="flex-1 text-center">
          <div className="relative mx-2">
            <div className="h-px bg-drift-gold/40" />
            <div className="absolute right-[-1px] top-[-3px] h-0 w-0 border-b-[4px] border-l-[5px] border-t-[4px] border-b-transparent border-l-drift-gold/40 border-t-transparent" />
          </div>
          <div className="mt-1.5 text-[10px] text-drift-text3">{duration}</div>
        </div>

        {/* Arrival */}
        <div className="text-center shrink-0">
          <div className="font-serif text-[22px] font-light tracking-wide text-drift-text">{arr.airport || '?'}</div>
          <div className="text-[9px] text-drift-text3">{arr.city || ''}</div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="text-[10px] text-drift-text3">{airline}{stops !== 'Direct' ? ` · ${stops}` : ' · Direct'}</div>
        <div className="text-[14px] font-semibold text-drift-gold">{price > 0 ? formatBudget(price) : ''}</div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex gap-1 px-4 pb-3">
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} className="rounded-md bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[8px] text-drift-text2">{t}</span>
          ))}
        </div>
      )}

      {/* 3-dot menu */}
      <div className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 opacity-0 backdrop-blur-md border border-[rgba(255,255,255,0.1)] transition-opacity group-hover:opacity-100">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </div>
    </div>
  )
}
