'use client'

interface WeatherData {
  tempMax?: number
  tempMin?: number
  description?: string
  rainProbability?: number
  uvIndex?: number
  isRainy?: boolean
  isSunny?: boolean
  iconUri?: string
}

interface Props {
  weather: WeatherData
  compact?: boolean
}

function getPackingHint(w: WeatherData): string | null {
  if (w.isRainy || (w.rainProbability && w.rainProbability > 60)) return 'Bring an umbrella'
  if (w.uvIndex && w.uvIndex >= 8) return 'Sunscreen + hat essential'
  if (w.tempMax && w.tempMax < 10) return 'Layers + warm jacket'
  if (w.tempMax && w.tempMax > 30) return 'Light clothes + water'
  return null
}

export default function DayWeather({ weather, compact = false }: Props) {
  const packingHint = getPackingHint(weather)
  const { tempMax, tempMin, description, rainProbability, uvIndex, isRainy, isSunny } = weather

  const iconColor = isRainy ? 'text-blue-400' : isSunny ? 'text-amber-400' : 'text-drift-text3'
  const Icon = isRainy ? (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 16.2A4.5 4.5 0 0017.5 8h-1.8A7 7 0 104 14.9" /><path d="M16 14v6M8 14v6M12 16v6" />
    </svg>
  ) : isSunny ? (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  )

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[10px] ${iconColor}`}>
        {Icon}
        <span className="text-drift-text2">{tempMax}°</span>
        {description && <span className="text-drift-text3">· {description}</span>}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.04)] ${iconColor}`}>
          {Icon}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold text-drift-text">{tempMax}°</span>
            {tempMin != null && <span className="text-[11px] text-drift-text3">/ {tempMin}°</span>}
            {description && <span className="text-[11px] text-drift-text2 capitalize">· {description}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-drift-text3">
            {rainProbability != null && rainProbability > 0 && <span>💧 {rainProbability}% rain</span>}
            {uvIndex != null && uvIndex > 0 && <span>☀️ UV {uvIndex}</span>}
          </div>
        </div>
      </div>
      {packingHint && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-drift-gold">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {packingHint}
        </div>
      )}
    </div>
  )
}
