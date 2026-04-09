'use client'

import { parsePrice } from '@/lib/parse-price'
import { useTripStore, type ItineraryItem } from '@/stores/trip-store'

interface Props {
  item: ItineraryItem
  onClick?: () => void
}

// Format any time string — handles ISO datetimes ("2026-04-10T17:10:00") and plain ("17:10")
function formatTime(raw?: string): string {
  if (!raw) return ''
  // ISO datetime → strip date, keep HH:MM
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    return raw.slice(11, 16)
  }
  // Already a time
  return raw
}

function formatDate(raw?: string): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return raw
}

export default function DesktopFlightCard({ item, onClick }: Props) {
  const formatBudget = useTripStore((s) => s.formatBudget)
  const meta = (item.metadata || {}) as Record<string, unknown>

  const dep = (meta.departure || {}) as Record<string, string>
  const arr = (meta.arrival || {}) as Record<string, string>
  const airline = (meta.airline as string) || item.detail || ''
  const duration = (meta.duration as string) || ''
  const stops = (meta.stops as string) || 'Direct'
  const layover = meta.layover as string | undefined
  const price = parsePrice(item.price)

  // Robust time/city extraction — handles cases where city slot has datetime
  const depTime = formatTime(dep.time || dep.city)
  const arrTime = formatTime(arr.time || arr.city)
  const depCity = dep.city && !/^\d{4}-/.test(dep.city) ? dep.city : ''
  const arrCity = arr.city && !/^\d{4}-/.test(arr.city) ? arr.city : ''
  const depDate = formatDate(dep.date || dep.time || dep.city)

  return (
    <div
      onClick={onClick}
      className="group relative w-[300px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c0c12] transition-all duration-400 hover:border-white/15 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
    >
      {/* Header — minimal */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-drift-text3">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.7.5-1.1z" />
          </svg>
          Flight
        </div>
        {price > 0 && <div className="text-[13px] font-semibold text-drift-text">{formatBudget(price)}</div>}
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 px-5 pt-3 pb-3">
        {/* Departure */}
        <div className="text-left shrink-0">
          <div className="font-serif text-[26px] font-light text-drift-text leading-none">{dep.airport || '—'}</div>
          {depTime && <div className="mt-1.5 text-[11px] font-medium text-drift-text2 tabular-nums">{depTime}</div>}
          {depCity && <div className="mt-0.5 text-[10px] text-drift-text3 truncate max-w-[80px]">{depCity}</div>}
        </div>

        {/* Route line */}
        <div className="flex-1 flex flex-col items-center gap-1 px-1">
          <div className="text-[9px] text-drift-text3 tabular-nums">{duration || '—'}</div>
          <div className="relative w-full">
            <div className="h-px bg-white/[0.08]" />
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c12] px-1" viewBox="0 0 24 24" width="16" height="14" fill="#7a7a85" stroke="none">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <div className={`text-[9px] ${stops === 'Direct' ? 'text-drift-ok' : 'text-drift-text3'}`}>{stops}</div>
        </div>

        {/* Arrival */}
        <div className="text-right shrink-0">
          <div className="font-serif text-[26px] font-light text-drift-text leading-none">{arr.airport || '—'}</div>
          {arrTime && <div className="mt-1.5 text-[11px] font-medium text-drift-text2 tabular-nums">{arrTime}</div>}
          {arrCity && <div className="mt-0.5 text-[10px] text-drift-text3 truncate max-w-[80px]">{arrCity}</div>}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-5 py-3 text-[10px] text-drift-text3 border-t border-white/[0.04]">
        <span className="truncate flex-1">{airline}</span>
        {depDate && (
          <>
            <span className="text-drift-text3/40">·</span>
            <span className="whitespace-nowrap">{depDate}</span>
          </>
        )}
        {layover && (
          <>
            <span className="text-drift-text3/40">·</span>
            <span className="truncate">{layover}</span>
          </>
        )}
      </div>

      {/* 3-dot menu */}
      <div className="absolute right-2.5 top-2.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 opacity-0 backdrop-blur-md border border-white/10 transition-opacity group-hover:opacity-100">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </div>
    </div>
  )
}
