'use client'

import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem } from '@/stores/trip-store'

interface DesktopFlightCardProps {
  item: ItineraryItem
}

export default function DesktopFlightCard({ item }: DesktopFlightCardProps) {
  const formatBudget = useTripStore((s) => s.formatBudget)
  const meta = (item.metadata || {}) as Record<string, unknown>

  const dep = (meta.departure || {}) as Record<string, string>
  const arr = (meta.arrival || {}) as Record<string, string>
  const airline = (meta.airline as string) || item.detail || ''
  const duration = (meta.duration as string) || ''
  const stops = (meta.stops as string) || 'Direct'
  const price = parsePrice(item.price)

  return (
    <div className="rounded-2xl border border-drift-gold/15 bg-gradient-to-r from-drift-gold/5 to-transparent p-5 transition-all hover:border-drift-gold/25">
      <div className="flex items-center gap-6">
        {/* Departure */}
        <div className="text-center shrink-0">
          <div className="font-serif text-2xl text-drift-text">{dep.airport || '?'}</div>
          <div className="text-[10px] text-drift-text3">{dep.city || ''}</div>
          {dep.time && <div className="mt-1 text-[11px] font-medium text-drift-text2">{dep.time}</div>}
        </div>

        {/* Route line */}
        <div className="flex-1 text-center">
          <div className="relative mx-4">
            <div className="h-px bg-drift-gold/30" />
            <div className="absolute right-0 -top-[3px] h-0 w-0 border-b-[4px] border-l-[6px] border-t-[4px] border-b-transparent border-l-drift-gold/30 border-t-transparent" />
          </div>
          <div className="mt-1.5 text-[10px] text-drift-text3">{duration}{stops !== 'Direct' ? ` · ${stops}` : ' · Direct'}</div>
          <div className="text-[10px] text-drift-text3/60">{airline}</div>
        </div>

        {/* Arrival */}
        <div className="text-center shrink-0">
          <div className="font-serif text-2xl text-drift-text">{arr.airport || '?'}</div>
          <div className="text-[10px] text-drift-text3">{arr.city || ''}</div>
          {arr.time && <div className="mt-1 text-[11px] font-medium text-drift-text2">{arr.time}</div>}
        </div>

        {/* Price */}
        <div className="shrink-0 text-right pl-4 border-l border-drift-border">
          <div className="text-lg font-bold text-drift-gold">{price > 0 ? formatBudget(price) : ''}</div>
          <div className="text-[9px] text-drift-text3 uppercase tracking-wider">per person</div>
        </div>
      </div>
    </div>
  )
}
