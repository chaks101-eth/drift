'use client'

import { useTripStore } from '@/stores/trip-store'
import { parsePrice } from '@/lib/parse-price'
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
  const transportMode = meta.transport_mode as string | undefined
  const transportAlts = meta.transportAlts as Array<{ mode: string; name: string; detail: string; price: string; bookingUrl?: string }> | undefined

  const isTrainOrBus = transportMode === 'train' || transportMode === 'bus'
  const modeLabel = isTrainOrBus ? (transportMode === 'train' ? 'Train' : 'Bus') : 'Flight'

  // For trains/buses, use station names from the item name (e.g., "Delhi Station → Jaipur Station")
  const [fromStation, toStation] = isTrainOrBus
    ? (item.name || '').split('→').map(s => s.trim())
    : [dep.airport || '?', arr.airport || '?']

  return (
    <div className="relative" onClick={onTap}>
      <div className="relative rounded-2xl border border-drift-border2 bg-drift-card p-4">
        {/* Mode label */}
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-drift-gold">
          {isTrainOrBus ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              {transportMode === 'train' ? (
                <><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M4 11h16" /><path d="M12 3v8" /><path d="M8 21l2-4h4l2 4" /><circle cx="8.5" cy="15.5" r="0.5" fill="currentColor" /><circle cx="15.5" cy="15.5" r="0.5" fill="currentColor" /></>
              ) : (
                <><rect x="3" y="3" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="7" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M5 17h14" /></>
              )}
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          )}
          {modeLabel}
        </div>

        {/* Station/Airport codes */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className={`font-serif font-light text-drift-text ${isTrainOrBus ? 'text-xl' : 'text-4xl'}`}>{fromStation}</div>
            {!isTrainOrBus && <div className="text-[10px] text-drift-text3">{dep.time || ''}</div>}
          </div>

          <div className="flex flex-1 flex-col items-center px-4">
            <div className="flex w-full items-center gap-1">
              <div className="h-px flex-1 border-t border-dashed border-white/12" />
              {isTrainOrBus ? (
                <svg className="h-3.5 w-3.5 shrink-0 text-drift-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0 text-drift-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
              )}
              <div className="h-px flex-1 border-t border-dashed border-white/12" />
            </div>
            <div className="mt-1 text-[9px] text-drift-text3">
              {dur}{stops && !isTrainOrBus ? ` · ${stops}` : ''}
            </div>
          </div>

          <div className="text-right">
            <div className={`font-serif font-light text-drift-text ${isTrainOrBus ? 'text-xl' : 'text-4xl'}`}>{toStation}</div>
            {!isTrainOrBus && <div className="text-[10px] text-drift-text3">{arr.time || ''}</div>}
          </div>
        </div>

        {/* Operator + price */}
        <div className="flex items-center justify-between border-t border-drift-border2 pt-3">
          <span className="text-xs text-drift-text2">{isTrainOrBus ? item.detail : ((meta.airline as string) || item.detail || '')}</span>
          <span className="text-sm font-bold text-drift-gold">{(() => { const n = parsePrice(item.price); return n === 0 ? '' : formatBudget(n) })()}</span>
        </div>

        {/* Route hints — train/bus alternatives on this route */}
        {transportAlts && transportAlts.length > 0 && (
          <div className="mt-3 border-t border-drift-border2 pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-drift-text3">
              <span>Also by train or bus</span>
              <span className="text-drift-text3/50 font-normal normal-case tracking-normal">· tap to search live times</span>
            </div>
            {transportAlts.map((alt, i) => (
              <a
                key={i}
                href={alt.bookingUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-between py-1.5 transition-colors active:bg-drift-surface2 -mx-1 px-1 rounded"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-drift-surface2 text-drift-text2">
                    {alt.mode === 'train' ? (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="4" y="3" width="16" height="14" rx="2" /><path d="M4 11h16" /><path d="M12 3v8" /><path d="M8 21l2-4h4l2 4" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="7" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M5 17h14" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[11px] text-drift-text2 line-clamp-1 min-w-0">{alt.detail}</span>
                </div>
                <svg className="h-3 w-3 text-drift-text3 shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
