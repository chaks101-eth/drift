'use client'

import { useTripStore } from '@/stores/trip-store'
import type { ItineraryItem, ItemMetadata } from '@/stores/trip-store'

interface FlightCardProps {
  item: ItineraryItem
  onTap: () => void
}

export default function FlightCard({ item, onTap }: FlightCardProps) {
  const formatBudget = useTripStore((s) => s.formatBudget)
  const meta = (item.metadata || {}) as ItemMetadata
  const dep = (meta.departure || {}) as Record<string, string>
  const arr = (meta.arrival || {}) as Record<string, string>
  const info = (meta.info || []) as Array<{ l: string; v: string }>
  const dur = info.find((i) => i.l === 'Duration')?.v || ''
  const stops = info.find((i) => i.l === 'Stops')?.v || ''

  return (
    <div className="relative" onClick={onTap}>
      {/* HUD corners */}
      <div className="relative rounded-2xl border border-drift-border2 bg-drift-card p-4">
        {/* Flight label */}
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-drift-gold">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
          Flight
        </div>

        {/* Airport codes */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-serif text-4xl font-light text-drift-text">{dep.airport || '?'}</div>
            <div className="text-[10px] text-drift-text3">{dep.time || ''}</div>
          </div>

          <div className="flex flex-1 flex-col items-center px-4">
            <div className="flex w-full items-center gap-1">
              <div className="h-px flex-1 border-t border-dashed border-white/12" />
              <svg className="h-3.5 w-3.5 shrink-0 text-drift-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
              </svg>
              <div className="h-px flex-1 border-t border-dashed border-white/12" />
            </div>
            <div className="mt-1 text-[9px] text-drift-text3">
              {dur}{stops ? ` · ${stops}` : ''}
            </div>
          </div>

          <div className="text-right">
            <div className="font-serif text-4xl font-light text-drift-text">{arr.airport || '?'}</div>
            <div className="text-[10px] text-drift-text3">{arr.time || ''}</div>
          </div>
        </div>

        {/* Airline + price */}
        <div className="flex items-center justify-between border-t border-drift-border2 pt-3">
          <span className="text-xs text-drift-text2">{(meta.airline as string) || item.detail || ''}</span>
          <span className="text-sm font-bold text-drift-gold">{(() => { const n = parseFloat((item.price || '0').replace(/[^0-9.]/g, '')) || 0; return n === 0 ? '' : formatBudget(n) })()}</span>
        </div>
      </div>
    </div>
  )
}
