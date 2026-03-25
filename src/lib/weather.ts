// ─── Weather Intelligence (Google Weather API) ───────────────
// Uses Google Weather API to get forecasts for trip dates.
// Feeds into LLM generation for smart day sequencing:
// outdoor activities on sunny days, indoor on rainy days.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY // Same GCP key

export interface DayWeather {
  date: string
  dayNum: number
  tempMax: number
  tempMin: number
  rainProbability: number
  rainMm: number
  description: string
  iconUri: string
  uvIndex: number
  humidity: number
  isRainy: boolean
  isSunny: boolean
}

export interface TripWeather {
  days: DayWeather[]
  summary: string
  bestOutdoorDays: number[]
  rainyDays: number[]
}

/**
 * Get weather forecast for trip dates using Google Weather API.
 */
export async function getTripWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<TripWeather | null> {
  if (!API_KEY) return null

  try {
    // Calculate days needed
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) + 1

    // Google Weather API supports up to 10 forecast days
    const forecastDays = Math.min(totalDays, 10)

    const url = `https://weather.googleapis.com/v1/forecast/days:lookup?location.latitude=${lat}&location.longitude=${lng}&days=${forecastDays}&key=${API_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`[Weather] Google API returned ${res.status}`)
      return null
    }

    const data = await res.json()
    const forecastData = data.forecastDays || []
    if (!forecastData.length) return null

    const days: DayWeather[] = forecastData.map((day: Record<string, unknown>, i: number) => {
      const daytime = day.daytimeForecast as Record<string, unknown> || {}
      const nighttime = day.nighttimeForecast as Record<string, unknown> || {}
      const displayDate = day.displayDate as Record<string, number>
      const date = `${displayDate?.year}-${String(displayDate?.month).padStart(2, '0')}-${String(displayDate?.day).padStart(2, '0')}`

      const dayTemp = (daytime.temperature as Record<string, unknown>)?.degrees as number || 0
      const nightTemp = (nighttime.temperature as Record<string, unknown>)?.degrees as number || 0
      const tempMax = (day.maxTemperature as Record<string, unknown>)?.degrees as number || Math.max(dayTemp, nightTemp)
      const tempMin = (day.minTemperature as Record<string, unknown>)?.degrees as number || Math.min(dayTemp, nightTemp)

      const dayPrecip = daytime.precipitation as Record<string, unknown> || {}
      const prob = (dayPrecip.probability as Record<string, unknown>)?.percent as number || 0
      const qpf = (dayPrecip.qpf as Record<string, unknown>)?.quantity as number || 0

      const weatherCond = daytime.weatherCondition as Record<string, unknown> || {}
      const desc = (weatherCond.description as Record<string, unknown>)?.text as string || 'Unknown'
      const iconUri = weatherCond.iconBaseUri as string || ''
      const condType = weatherCond.type as string || ''

      const uvIndex = daytime.uvIndex as number || 0
      const humidity = daytime.relativeHumidity as number || 0

      const isRainy = prob > 40 || qpf > 2 || condType.includes('RAIN') || condType.includes('THUNDER')
      const isSunny = condType.includes('CLEAR') || condType.includes('SUNNY') || (prob < 20 && !condType.includes('CLOUD'))

      return {
        date,
        dayNum: i + 1,
        tempMax: Math.round(tempMax),
        tempMin: Math.round(tempMin),
        rainProbability: prob,
        rainMm: Math.round(qpf * 10) / 10,
        description: desc,
        iconUri,
        uvIndex,
        humidity,
        isRainy,
        isSunny,
      }
    })

    const bestOutdoorDays = days.filter(d => d.isSunny).map(d => d.dayNum)
    const rainyDays = days.filter(d => d.isRainy).map(d => d.dayNum)

    const sunnyCount = days.filter(d => d.isSunny).length
    const rainyCount = days.filter(d => d.isRainy).length
    const avgTemp = Math.round(days.reduce((s, d) => s + d.tempMax, 0) / days.length)

    let summary = `${avgTemp}°C average. `
    if (rainyCount === 0) {
      summary += 'Clear skies throughout — perfect for outdoor activities!'
    } else if (rainyCount === 1) {
      summary += `Rain expected Day ${rainyDays[0]} — move outdoor plans to other days.`
    } else if (rainyCount > days.length / 2) {
      summary += `Rainy season — ${rainyCount}/${days.length} days have rain. Plan indoor alternatives.`
    } else {
      summary += `${sunnyCount} sunny, ${rainyCount} rainy. Outdoor activities optimized for clear days.`
    }

    console.log(`[Weather] ${days.length}-day forecast: ${summary}`)
    return { days, summary, bestOutdoorDays, rainyDays }
  } catch (e) {
    console.warn(`[Weather] Failed: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

/**
 * Format weather data as context for the LLM generation prompt.
 */
export function formatWeatherForLLM(weather: TripWeather): string {
  const lines = weather.days.map(d => {
    const tags: string[] = []
    if (d.isRainy) tags.push('RAINY')
    if (d.isSunny) tags.push('SUNNY')
    if (d.uvIndex >= 8) tags.push('HIGH UV')
    return `  Day ${d.dayNum} (${d.date}): ${d.tempMax}°C/${d.tempMin}°C, ${d.description}, ${d.rainProbability}% rain${d.rainMm > 0 ? `, ${d.rainMm}mm` : ''}${tags.length ? ` [${tags.join(', ')}]` : ''}`
  })

  return `\n\nWEATHER FORECAST (real-time from Google Weather):
${lines.join('\n')}
Summary: ${weather.summary}

IMPORTANT: Schedule outdoor activities (beaches, hikes, walking tours, viewpoints) on SUNNY days.
Move indoor activities (museums, cooking classes, spas, shopping) to RAINY days.
If UV is HIGH, suggest morning/evening outdoor activities and midday indoor breaks.
This is real weather data for the traveler's actual dates — use it to optimize their experience.`
}
