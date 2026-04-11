'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTripStore, type Destination } from '@/stores/trip-store'

// ─── Planet system — 12 orbiting destinations in 3 rings ─────
interface Planet {
  name: string
  country: string
  tag: string
  tagline: string
  ring: 0 | 1 | 2
  angle: number
  size: number
  color: string
  img: string
}

const PLANETS: Planet[] = [
  // Inner ring
  { name: 'Bali', country: 'Indonesia', tag: 'BEACH · SPIRITUAL', tagline: 'Rice fields and temple sunsets.', ring: 0, angle: 0, size: 50, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Tokyo', country: 'Japan', tag: 'CITY · FOODIE', tagline: 'Neon nights, omakase mornings.', ring: 0, angle: 90, size: 46, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { name: 'Paris', country: 'France', tag: 'CULTURE · ROMANCE', tagline: 'Cafés and walkable boulevards.', ring: 0, angle: 180, size: 44, color: '#a880ff', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
  { name: 'Maldives', country: 'Maldives', tag: 'LUXURY · ROMANCE', tagline: 'Overwater villas on pure blue.', ring: 0, angle: 270, size: 46, color: '#4ecdc4', img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },

  // Middle ring
  { name: 'Dubai', country: 'UAE', tag: 'LUXURY · CITY', tagline: 'Sky-high dinners, desert dunes.', ring: 1, angle: 45, size: 42, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80' },
  { name: 'Santorini', country: 'Greece', tag: 'ROMANCE · BEACH', tagline: 'White villas, caldera sunsets.', ring: 1, angle: 135, size: 40, color: '#5ea8ff', img: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80' },
  { name: 'Phuket', country: 'Thailand', tag: 'BEACH · PARTY', tagline: 'Island hops and full-moon beaches.', ring: 1, angle: 225, size: 40, color: '#ffeb6c', img: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=400&q=80' },
  { name: 'Singapore', country: 'Singapore', tag: 'CITY · FOODIE', tagline: 'Hawker centres, garden cities.', ring: 1, angle: 315, size: 40, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80' },

  // Outer ring
  { name: 'Istanbul', country: 'Turkey', tag: 'CULTURE · FOODIE', tagline: 'Bazaars and Bosphorus ferries.', ring: 2, angle: 22, size: 36, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=400&q=80' },
  { name: 'Marrakech', country: 'Morocco', tag: 'CULTURE · HIDDEN', tagline: 'Riads and Atlas mountain light.', ring: 2, angle: 112, size: 36, color: '#e8b56c', img: 'https://images.unsplash.com/photo-1545158181-9a4e6e8f2cf9?w=400&q=80' },
  { name: 'Bangkok', country: 'Thailand', tag: 'CITY · FOODIE', tagline: 'Street food and temple tuk-tuks.', ring: 2, angle: 202, size: 38, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&q=80' },
  { name: 'Goa', country: 'India', tag: 'BEACH · PARTY', tagline: 'Portuguese villas and beach shacks.', ring: 2, angle: 292, size: 36, color: '#4ecdc4', img: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80' },
]

const RING_RADII = [180, 280, 380]
const ORBIT_PERIODS = [42000, 68000, 100000] // ms — outer = slower, like real mechanics
const ELLIPSE_TILT = 0.55 // y-squish for 3D tilted orbit feel
const PARTICLE_COUNT = 38

// ─── Scroll counter ─────────────────────────────────────────
function Counter({ value, suffix = '', duration = 1800 }: { value: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - progress, 3)
          setN(Math.round(value * eased))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value, duration])
  return <span ref={ref}>{n}{suffix}</span>
}

// ─── OrbitalSystem ────────────────────────────────────────────
// Self-contained, isolated re-render. rAF + computed positions for
// real orbital motion, comet trails, scan beams, energy waves,
// particle field, and cursor parallax. Heart of the page.
function OrbitalSystem({
  focus,
  onSelect,
  onHover,
}: {
  focus: Planet | null
  onSelect: (p: Planet) => void
  onHover: (p: Planet | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(0)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [scanTarget, setScanTarget] = useState<string | null>(null)
  const [scanKey, setScanKey] = useState(0)

  // ─── Time loop (rAF) — drives all motion ───
  useEffect(() => {
    let frame: number
    let last = performance.now()
    const tick = (now: number) => {
      setTime(prev => prev + (now - last))
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // ─── Cursor parallax (clamped) ───
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      setParallax({
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ─── Scan beam scheduler ───
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const schedule = () => {
      const delay = 3500 + Math.random() * 3500
      timeout = setTimeout(() => {
        const target = PLANETS[Math.floor(Math.random() * PLANETS.length)]
        setScanTarget(target.name)
        setScanKey(k => k + 1)
        setTimeout(() => setScanTarget(null), 1700)
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [])

  // ─── Particle field — seeded once on mount ───
  const [particles] = useState(() => Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: ((i * 37 + 13) % 100),
    y: ((i * 53 + 7) % 100),
    size: 0.5 + ((i * 17) % 15) / 10,
    duration: 14 + ((i * 31) % 18),
    delay: -((i * 23) % 25),
    driftX: (((i * 43) % 80) - 40),
    driftY: (((i * 59) % 80) - 40),
  })))

  // ─── Compute live positions for all planets ───
  const positions = PLANETS.map(p => {
    const period = ORBIT_PERIODS[p.ring]
    const angleDeg = p.angle + (time / period) * 360
    const angleRad = (angleDeg * Math.PI) / 180
    const x = Math.cos(angleRad) * RING_RADII[p.ring]
    const y = Math.sin(angleRad) * RING_RADII[p.ring] * ELLIPSE_TILT
    return { p, x, y, angleDeg }
  })

  // ─── Constellation lines (proximity-based) ───
  const constellations: Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }> = []
  const MAX_DIST = 175
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]
      const b = positions[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < MAX_DIST) {
        constellations.push({
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          alpha: (1 - dist / MAX_DIST) * 0.18,
        })
      }
    }
  }

  // SVG canvas dimensions — sized to comfortably fit elliptical orbits + halos
  const SVG_W = (RING_RADII[2] + 80) * 2
  const SVG_H = (RING_RADII[2] * ELLIPSE_TILT + 80) * 2

  return (
    <div ref={containerRef} className="relative min-h-[760px] max-xl:min-h-[680px]">
      {/* ─── Parallax wrapper ─── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${parallax.x * 10}px, ${parallax.y * 10}px)`,
          transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* ─── Particle field ─── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full bg-white/40"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animation: `particleDrift ${p.duration}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
                ['--drift-x' as string]: `${p.driftX}px`,
                ['--drift-y' as string]: `${p.driftY}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* ─── Elliptical orbit rings ─── */}
        {RING_RADII.map((r, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full border border-white/[0.05]"
            style={{
              width: r * 2,
              height: r * 2 * ELLIPSE_TILT,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* ─── SVG layer: constellations + comet trails + connection + scan beam ─── */}
        <svg
          className="absolute top-1/2 left-1/2 pointer-events-none"
          width={SVG_W}
          height={SVG_H}
          viewBox={`-${SVG_W / 2} -${SVG_H / 2} ${SVG_W} ${SVG_H}`}
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          {/* Constellation lines — dynamically connect nearby planets */}
          {constellations.map((c, i) => (
            <line
              key={i}
              x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
              stroke="#c8a44e"
              strokeWidth="0.5"
              opacity={c.alpha}
            />
          ))}

          {/* Comet trails — 8 fading arc segments per planet */}
          {positions.map(({ p, angleDeg }) => {
            const r = RING_RADII[p.ring]
            const ry = r * ELLIPSE_TILT
            return (
              <g key={`trail-${p.name}`}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const segLen = 4
                  const a1 = ((angleDeg - (i + 1) * segLen) * Math.PI) / 180
                  const a2 = ((angleDeg - i * segLen) * Math.PI) / 180
                  const x1 = Math.cos(a1) * r
                  const y1 = Math.sin(a1) * ry
                  const x2 = Math.cos(a2) * r
                  const y2 = Math.sin(a2) * ry
                  const alpha = ((8 - i) / 8) * 0.55
                  return (
                    <path
                      key={i}
                      d={`M ${x1} ${y1} A ${r} ${ry} 0 0 1 ${x2} ${y2}`}
                      stroke={p.color}
                      strokeWidth={2.2 - i * 0.18}
                      fill="none"
                      opacity={alpha}
                      strokeLinecap="round"
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Connection line to focused planet */}
          {focus && (() => {
            const pos = positions.find(po => po.p.name === focus.name)
            if (!pos) return null
            return (
              <line
                x1={0} y1={0}
                x2={pos.x} y2={pos.y}
                stroke={focus.color}
                strokeWidth="1.2"
                strokeDasharray="3 4"
                opacity="0.55"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="14" dur="1s" repeatCount="indefinite" />
              </line>
            )
          })()}

          {/* Scan beam — fires randomly between core and a planet */}
          {scanTarget && (() => {
            const pos = positions.find(po => po.p.name === scanTarget)
            if (!pos) return null
            return (
              <g key={scanKey} className="animate-[beamFire_1.7s_ease-out_forwards]">
                <line
                  x1={0} y1={0}
                  x2={pos.x} y2={pos.y}
                  stroke={pos.p.color}
                  strokeWidth="2"
                  strokeDasharray="2 3"
                  style={{
                    animation: 'beamFlow 0.4s linear infinite',
                    filter: `drop-shadow(0 0 4px ${pos.p.color})`,
                  }}
                />
              </g>
            )
          })()}
        </svg>

        {/* ─── Center core (energy waves + pulsing sphere) ─── */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {/* Energy waves — 3 concentric expanding rings */}
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[130px] w-[130px] rounded-full border border-[#c8a44e]/40"
              style={{
                animation: 'coreWave 5s ease-out infinite',
                animationDelay: `${i * 1.66}s`,
              }}
            />
          ))}
          {/* Static rings around core */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[150px] w-[150px] rounded-full border border-[#c8a44e]/40" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[170px] w-[170px] rounded-full border border-[#c8a44e]/25" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[192px] w-[192px] rounded-full border border-[#c8a44e]/15" />
          {/* Core sphere */}
          <div
            className="relative h-[130px] w-[130px] rounded-full bg-gradient-to-br from-[#e8cc6e] via-[#c8a44e] to-[#8b7034] flex items-center justify-center"
            style={{ animation: 'corePulse 4s ease-in-out infinite' }}
          >
            <span className="font-serif italic text-[72px] text-[#08080c] leading-none translate-y-[-4px]">D</span>
          </div>
        </div>

        {/* ─── Planets (with bigger hit targets) ─── */}
        {positions.map(({ p, x, y }, i) => {
          const isFocused = focus?.name === p.name
          const hitSize = Math.max(p.size + 18, 60)
          return (
            <button
              key={p.name}
              onClick={() => onSelect(p)}
              onMouseEnter={() => onHover(p)}
              onMouseLeave={() => onHover(null)}
              className="absolute top-1/2 left-1/2 z-30 flex items-center justify-center group opacity-0 animate-[fadeIn_0.7s_ease_forwards]"
              style={{
                width: hitSize,
                height: hitSize,
                transform: `translate(${x - hitSize / 2}px, ${y - hitSize / 2}px)`,
                animationDelay: `${0.6 + i * 0.06}s`,
                willChange: 'transform',
              }}
            >
              {/* Visible planet (smaller than hit target) */}
              <div className="relative" style={{ width: p.size, height: p.size }}>
                {/* Glow halo */}
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-500 ${isFocused ? 'scale-[1.7] opacity-100' : 'scale-[1.2] opacity-60'}`}
                  style={{ background: `radial-gradient(circle, ${p.color}50, transparent 70%)` }}
                />
                {/* Sphere */}
                <div
                  className="relative h-full w-full rounded-full overflow-hidden border-2 transition-all duration-300 group-hover:scale-125"
                  style={{
                    borderColor: isFocused ? p.color : `${p.color}60`,
                    boxShadow: isFocused
                      ? `0 0 36px ${p.color}cc, 0 0 72px ${p.color}66`
                      : `0 0 14px ${p.color}55`,
                  }}
                >
                  <Image src={p.img} alt={p.name} fill className="object-cover" sizes={`${p.size}px`} unoptimized />
                </div>
              </div>

              {/* Label */}
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap transition-all duration-300 ${isFocused ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'} group-hover:opacity-100 group-hover:translate-y-0`}>
                <div className="rounded-md border border-white/10 bg-black/80 backdrop-blur-md px-2.5 py-1">
                  <div className="font-serif text-[12px] text-white leading-tight">{p.name}</div>
                  <div className="font-mono text-[8px] tracking-[1px] mt-0.5" style={{ color: `${p.color}cc` }}>{p.tag}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ─── Corner telemetry (outside parallax) ─── */}
      <div className="absolute top-4 left-4 font-mono text-[9px] tracking-[1px] text-white/30 leading-relaxed pointer-events-none">
        <div>ORBIT.01 · R=180</div>
        <div className="text-[#c8a44e]/50">4 BODIES · T=42s</div>
      </div>
      <div className="absolute bottom-4 right-4 text-right font-mono text-[9px] tracking-[1px] text-white/30 leading-relaxed pointer-events-none">
        <div>ORBIT.03 · R=380</div>
        <div className="text-[#c8a44e]/50">4 BODIES · T=100s</div>
      </div>
      <div className="absolute bottom-4 left-4 font-mono text-[9px] tracking-[1px] text-white/30 pointer-events-none">
        DRIFT.CORE · ACTIVE
      </div>
      <div className="absolute top-4 right-4 text-right font-mono text-[9px] tracking-[1px] text-white/30 pointer-events-none">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" /> TELEMETRY
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const router = useRouter()
  const setDestination = useTripStore((s) => s.setDestination)
  const userEmail = useTripStore((s) => s.userEmail)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<Planet | null>(null)
  const [hovered, setHovered] = useState<Planet | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [recentTrips, setRecentTrips] = useState<Array<{ id: string; destination: string; country: string; start_date: string; vibes: string[] }>>([])

  // URL extraction state
  const [urlMode, setUrlMode] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlExtracting, setUrlExtracting] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [urlExtracted, setUrlExtracted] = useState<{
    primaryDestination: string; country: string; vibes: string[]; suggestedDays: number;
    highlights: Array<{ name: string; category: string; detail: string; estimatedPrice?: string; inferredFromDestination?: boolean }>;
    budgetHint: string; summary: string; sourceType: string; sourceTitle: string;
  } | null>(null)

  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = '/m'
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true)
  }, [])

  // Cursor follower
  useEffect(() => {
    if (!ready) return
    const move = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [ready])

  // Scroll reveal
  useEffect(() => {
    if (!ready) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [ready])

  // Fetch recent trips for returning users
  useEffect(() => {
    if (!userEmail) return
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('trips').select('id, destination, country, start_date, vibes')
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => { if (data?.length) setRecentTrips(data) })
    })
  }, [userEmail])

  if (!ready) return <div className="min-h-screen bg-[#050509]" />

  const focus = hovered || selected
  const countryMap: Record<string, string> = {
    Bali: 'Indonesia', Tokyo: 'Japan', Paris: 'France', Maldives: 'Maldives',
    Dubai: 'UAE', Santorini: 'Greece', Phuket: 'Thailand', Singapore: 'Singapore',
    Istanbul: 'Turkey', Marrakech: 'Morocco', Bangkok: 'Thailand', Goa: 'India',
  }

  // URL extraction handler
  const handleUrlExtract = async () => {
    if (!urlValue.trim()) return
    try { new URL(urlValue) } catch { setUrlError('Paste a valid URL'); return }
    setUrlError('')
    setUrlExtracting(true)
    try {
      const token = useTripStore.getState().token
      const res = await fetch('/api/ai/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: urlValue }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setUrlError(data.error || 'Could not extract travel data from this link'); setUrlExtracting(false); return }
      setUrlExtracted(data.extracted)
    } catch {
      setUrlError('Network error. Check your connection.')
    } finally {
      setUrlExtracting(false)
    }
  }

  // Proceed with extracted URL data → set destination + vibes + navigate
  const proceedWithExtraction = () => {
    if (!urlExtracted) return
    setDestination({
      city: urlExtracted.primaryDestination,
      country: urlExtracted.country || '',
      tagline: urlExtracted.summary || '',
      match: 100,
      vibes: urlExtracted.vibes.slice(0, 5),
    })
    // Store highlights for loading page
    sessionStorage.setItem('drift-url-highlights', JSON.stringify({
      highlights: urlExtracted.highlights,
      summary: urlExtracted.summary,
    }))
    router.push('/vibes')
  }

  // Compose trip to a specific planet — sets destination + routes to vibes
  const composeToPlanet = (p: Planet) => {
    const dest: Destination = {
      city: p.name,
      country: p.country || countryMap[p.name] || '',
      tagline: p.tagline,
      match: 100,
      vibes: [],
      image_url: p.img,
    }
    setDestination(dest)
    router.push('/vibes')
  }

  return (
    <div className="min-h-screen bg-[#050509] text-[#f0efe8] overflow-x-hidden font-sans cursor-none max-md:cursor-auto">
      {/* ═══ Custom cursor ═══ */}
      <div
        className="pointer-events-none fixed z-[200] hidden md:block transition-transform duration-100"
        style={{ left: cursor.x, top: cursor.y, transform: 'translate(-50%, -50%)' }}
      >
        <div className="h-8 w-8 rounded-full border border-[#c8a44e]/50" />
        <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-[#c8a44e]" />
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── HERO — Orbital System ─────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Starfield */}
        <div className="absolute inset-0 starfield pointer-events-none" />

        {/* Ambient glow at center */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 62% 50%, rgba(200,164,78,0.12) 0%, transparent 55%)' }}
        />

        {/* Noise grain */}
        <div className="absolute inset-0 noise-grain pointer-events-none" />

        {/* ─── Top nav ─── */}
        <div className="relative z-10 flex items-center justify-between px-12 py-7 max-lg:px-6">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="font-serif text-[26px] italic text-[#c8a44e] hover:opacity-85 transition-opacity leading-none">
            Drift
          </button>

          {/* Center nav — editorial, tiny uppercase */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-9 max-lg:hidden">
            {[
              { label: 'Product', id: 'product' },
              { label: 'How it works', id: 'how' },
              { label: 'Principles', id: 'why' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[10px] font-medium tracking-[1.8px] uppercase text-white/55 hover:text-[#c8a44e] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right — trips + sign in */}
          <div className="flex items-center gap-7">
            <button
              onClick={() => router.push('/trips')}
              className="text-[10px] font-medium tracking-[1.8px] uppercase text-white/55 hover:text-[#c8a44e] transition-colors"
            >
              Trips
            </button>
            <div className="h-3 w-px bg-white/15" />
            <button
              onClick={() => router.push('/login')}
              className="group flex items-center gap-2 text-[10px] font-medium tracking-[1.8px] uppercase text-[#c8a44e] hover:opacity-85 transition-opacity"
            >
              Sign in
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-0.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Live telemetry — top right status ─── */}
        <div className="absolute top-24 right-12 z-10 max-lg:right-6 opacity-0 animate-[fadeUp_0.8s_ease_forwards_1s]">
          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-black/40 backdrop-blur-md px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />
            <span className="font-mono text-[9px] tracking-[1px] text-white/70 uppercase">System online · 12 bodies</span>
          </div>
        </div>

        {/* ─── Main hero grid ─── */}
        <div className="relative z-10 grid grid-cols-[minmax(400px,1fr)_860px] max-xl:grid-cols-1 gap-10 px-12 max-lg:px-6 pt-8 pb-16 items-center min-h-[calc(100vh-80px)]">

          {/* ─── LEFT: Copy + Selected panel ─── */}
          <div className="flex flex-col justify-center max-w-[560px] py-10">
            {/* Eyebrow */}
            <div className="mb-5 opacity-0 animate-[fadeUp_0.9s_ease_forwards_0.4s]">
              <div className="inline-flex items-center gap-3">
                <div className="h-px w-6 bg-[#c8a44e]/60" />
                <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">
                  Drift · 2026
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-[clamp(36px,4.2vw,60px)] font-light leading-[0.98] tracking-[-0.02em] mb-5 opacity-0 animate-[fadeUp_1s_ease_forwards_0.6s]">
              Your next trip is<br />
              already <em className="italic text-[#c8a44e]">in orbit</em>.
            </h1>

            {/* Subtitle */}
            <p className="text-[14px] font-light text-white/60 max-w-[440px] leading-[1.7] mb-8 opacity-0 animate-[fadeUp_1s_ease_forwards_0.8s]">
              Pick a destination, describe a vibe, or paste a travel reel. Drift composes the rest.
            </p>

            {/* Selected / default panel */}
            <div className="opacity-0 animate-[fadeUp_1s_ease_forwards_1s]">
              {focus ? (
                <div
                  key={focus.name}
                  className="rounded-2xl border bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-sm p-5 animate-[fadeUp_0.35s_ease]"
                  style={{ borderColor: `${focus.color}30` }}
                >
                  <div className="flex items-center gap-3.5 mb-3.5">
                    <div className="relative h-14 w-14 rounded-xl overflow-hidden border shrink-0" style={{ borderColor: `${focus.color}40` }}>
                      <Image src={focus.img} alt="" fill className="object-cover" sizes="56px" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[9px] tracking-[1.5px] mb-0.5" style={{ color: `${focus.color}cc` }}>
                        {focus.tag}
                      </div>
                      <div className="font-serif text-[22px] font-light leading-tight text-white">{focus.name}</div>
                      <div className="text-[10px] text-white/40 italic">{focus.country}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-4 italic">
                    {focus.tagline}
                  </p>
                  <button
                    onClick={() => composeToPlanet(focus)}
                    className="group w-full flex items-center justify-between rounded-full border border-[#c8a44e]/40 bg-[#c8a44e]/[0.06] px-5 py-3 transition-all hover:bg-[#c8a44e] hover:border-[#c8a44e]"
                  >
                    <span className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-[#c8a44e] group-hover:text-[#08080c] transition-colors">
                      Drift to {focus.name}
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#c8a44e] group-hover:text-[#08080c] transition-all group-hover:translate-x-0.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : urlExtracted ? (
                /* URL extraction result */
                <div className="rounded-2xl border border-[#c8a44e]/25 bg-gradient-to-br from-[#c8a44e]/[0.05] to-transparent backdrop-blur-sm p-5 animate-[fadeUp_0.4s_ease]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                        <span className="font-mono text-[9px] tracking-[1.5px] text-[#c8a44e]/80 uppercase">Extracted</span>
                      </div>
                      <div className="font-serif text-[22px] font-light text-white leading-tight">
                        {urlExtracted.primaryDestination}
                        {urlExtracted.country && <span className="text-white/40 italic"> · {urlExtracted.country}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setUrlExtracted(null); setUrlMode(true); setUrlValue('') }} className="text-white/35 hover:text-white/70 transition-colors text-lg leading-none mt-1">×</button>
                  </div>
                  <p className="text-[11px] text-white/55 leading-relaxed mb-1.5">{urlExtracted.summary?.slice(0, 120)}{urlExtracted.summary?.length > 120 ? '…' : ''}</p>
                  <div className="flex items-center gap-3 text-[9px] text-white/40 font-mono tracking-wider mb-4">
                    <span>{urlExtracted.highlights.length} places</span>
                    <span className="text-white/15">·</span>
                    <span>{urlExtracted.suggestedDays}d</span>
                    <span className="text-white/15">·</span>
                    <span className="capitalize">{urlExtracted.budgetHint}</span>
                  </div>
                  <button
                    onClick={proceedWithExtraction}
                    className="group w-full flex items-center justify-between rounded-full bg-[#c8a44e] px-5 py-3 transition-all hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] hover:-translate-y-0.5"
                  >
                    <span className="font-mono text-[10px] font-bold tracking-[2px] uppercase text-[#08080c]">
                      Build this trip
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              ) : urlMode ? (
                /* URL input mode */
                <div className="animate-[fadeUp_0.3s_ease]">
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus
                      value={urlValue}
                      onChange={e => { setUrlValue(e.target.value); setUrlError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleUrlExtract()}
                      placeholder="Paste a YouTube, Instagram, or TikTok URL…"
                      className="flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-[13px] text-white placeholder:text-white/30 focus:border-[#c8a44e]/40 focus:outline-none transition-colors"
                    />
                    <button
                      onClick={handleUrlExtract}
                      disabled={!urlValue.trim() || urlExtracting}
                      className="shrink-0 rounded-full bg-[#c8a44e] px-5 py-3 text-[10px] font-bold uppercase tracking-[2px] text-[#08080c] transition-all hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      {urlExtracting ? '…' : 'Extract'}
                    </button>
                  </div>
                  {urlError && <div className="text-[11px] text-[#e74c3c] mb-2 pl-1">{urlError}</div>}
                  {urlExtracting && (
                    <div className="flex items-center gap-2 pl-1 mt-2">
                      <div className="h-3 w-3 animate-spin rounded-full border border-[#c8a44e]/30 border-t-[#c8a44e]" />
                      <span className="text-[11px] text-white/50">Reading the content…</span>
                    </div>
                  )}
                  <button onClick={() => setUrlMode(false)} className="mt-3 text-[10px] text-white/40 hover:text-white/60 transition-colors">
                    ← Back to compose
                  </button>
                </div>
              ) : (
                /* Default: two entry paths */
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => router.push('/vibes')}
                    className="group flex items-center justify-between rounded-full bg-[#c8a44e] px-7 py-3.5 transition-all hover:shadow-[0_12px_36px_rgba(200,164,78,0.3)] hover:-translate-y-0.5"
                  >
                    <span className="text-[10px] font-bold tracking-[2px] uppercase text-[#08080c]">Compose a trip</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                  <button
                    onClick={() => setUrlMode(true)}
                    className="group flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.02] px-7 py-3.5 transition-all hover:border-[#c8a44e]/30 hover:bg-white/[0.04]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50 group-hover:text-[#c8a44e] transition-colors">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span className="text-[10px] font-medium tracking-[1.5px] uppercase text-white/60 group-hover:text-[#c8a44e] transition-colors">Build from a link</span>
                  </button>
                </div>
              )}
            </div>

            {/* Small telemetry — trimmed */}
            <div className="mt-7 flex items-center gap-4 font-mono text-[9px] tracking-[1px] text-white/35 flex-wrap opacity-0 animate-[fadeUp_1s_ease_forwards_1.2s]">
              <span>200+ trips</span>
              <span className="text-white/12">◆</span>
              <span>58 destinations</span>
              <span className="text-white/12">◆</span>
              <span>0 hallucinations</span>
            </div>
          </div>

          {/* ─── RIGHT: The orbital system ─── */}
          <OrbitalSystem
            focus={focus}
            onSelect={(p) => setSelected(p)}
            onHover={(p) => setHovered(p)}
          />
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-0 animate-[fadeUp_1s_ease_forwards_1.8s]">
          <span className="font-mono text-[8px] tracking-[2px] text-white/35">SCROLL</span>
          <div className="h-6 w-px bg-gradient-to-b from-[#c8a44e]/60 to-transparent animate-[scrollHint_2s_ease-in-out_infinite]" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── TELEMETRY BAND ───────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section className="relative border-y border-white/[0.06] py-7 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050509] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050509] to-transparent z-10" />

        <div className="flex animate-[marquee_50s_linear_infinite] whitespace-nowrap">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex shrink-0 items-center gap-14 px-7">
              {[
                { v: '200+', l: 'Trips dispatched' },
                { v: '58', l: 'Destinations' },
                { v: '28.3s', l: 'Avg. compose' },
                { v: '0', l: 'Hallucinations' },
                { v: '2M+', l: 'Reviews grounded' },
              ].map((s, i) => (
                <div key={`${k}-${i}`} className="flex items-baseline gap-3">
                  <span className="font-serif text-[26px] font-light text-[#c8a44e] tabular-nums">{s.v}</span>
                  <span className="font-mono text-[9px] tracking-[1.5px] uppercase text-white/40">{s.l}</span>
                  <span className="text-white/10 ml-10 text-[9px]">◆</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── RETURNING USER: Recent trips ──────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      {recentTrips.length > 0 && (
        <section className="relative py-16 px-12 lg:px-24 reveal">
          <div className="mx-auto max-w-[1200px]">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-px w-6 bg-[#c8a44e]/60" />
                <span className="text-[10px] font-medium tracking-[2px] uppercase text-[#c8a44e]/80">Welcome back</span>
              </div>
              <button
                onClick={() => router.push('/trips')}
                className="text-[10px] font-medium tracking-[1.8px] uppercase text-white/50 hover:text-[#c8a44e] transition-colors"
              >
                All trips →
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {recentTrips.map(trip => (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 text-left transition-all duration-400 hover:border-[#c8a44e]/25 hover:-translate-y-1 hover:bg-white/[0.025]"
                >
                  <div className="font-serif text-[20px] font-light text-white/95 mb-1 group-hover:text-[#c8a44e] transition-colors">
                    {trip.destination}
                  </div>
                  <div className="text-[10px] text-white/45 mb-3">
                    {trip.country}
                    {trip.start_date && ` · ${new Date(trip.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </div>
                  {trip.vibes?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {trip.vibes.slice(0, 3).map(v => (
                        <span key={v} className="rounded-full bg-[#c8a44e]/10 px-2 py-0.5 text-[9px] text-[#c8a44e]/80">{v}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── INSIDE THE COMPOSER ───────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="product" className="relative py-24 px-12 lg:px-24 reveal overflow-hidden">
        <div className="aurora-blob h-[520px] w-[520px] left-1/2 top-0 -translate-x-1/2 bg-[#c8a44e]" style={{ opacity: 0.05 }} />

        <div className="relative mx-auto max-w-[1200px]">
          {/* Centered section header */}
          <div className="mb-12 text-center max-w-[680px] mx-auto">
            <div className="mb-4 inline-flex items-center gap-3">
              <div className="h-px w-6 bg-[#c8a44e]/60" />
              <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">The product</span>
              <div className="h-px w-6 bg-[#c8a44e]/60" />
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,46px)] font-light leading-[1.05] tracking-[-0.02em] mb-4">
              A complete trip. <em className="italic text-[#c8a44e]">Not a list.</em>
            </h2>
            <p className="text-[13px] text-white/55 leading-[1.75] max-w-[480px] mx-auto">
              Flights connect. Stays anchor. Days flow. Ask Drift to swap anything — the whole board adjusts.
            </p>
          </div>

          {/* Browser mockup frame */}
          <div className="relative max-w-[1120px] mx-auto">
            {/* Corner brackets — UI frame */}
            <div className="pointer-events-none absolute -top-2 -left-2 h-5 w-5 border-l border-t border-[#c8a44e]/30" />
            <div className="pointer-events-none absolute -top-2 -right-2 h-5 w-5 border-r border-t border-[#c8a44e]/30" />
            <div className="pointer-events-none absolute -bottom-2 -left-2 h-5 w-5 border-l border-b border-[#c8a44e]/30" />
            <div className="pointer-events-none absolute -bottom-2 -right-2 h-5 w-5 border-r border-b border-[#c8a44e]/30" />

            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0c0c12] shadow-[0_60px_140px_rgba(0,0,0,0.7)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#08080c] border-b border-white/[0.04]">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/40" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]/40" />
                </div>
                <div className="mx-auto rounded-md bg-white/[0.03] border border-white/[0.04] px-3 py-1 font-mono text-[10px] text-white/35">
                  driftntravel.com/trip/bali-7-days
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[#4ecdc4]/20 bg-[#4ecdc4]/[0.05] px-2 py-1">
                  <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" />
                  <span className="font-mono text-[8px] text-[#4ecdc4]/80 tracking-wider">LIVE</span>
                </div>
              </div>

              <div className="p-8 space-y-7">
                {/* Trip header */}
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/[0.04]">
                  <div>
                    <div className="font-serif text-[24px] font-light text-white/95">Bali, Indonesia</div>
                    <div className="flex items-center gap-2 mt-1.5 font-mono text-[9px] text-white/40 tracking-[1px] uppercase">
                      <span>7 nights</span>
                      <span className="text-white/15">·</span>
                      <span>2 travelers</span>
                      <span className="text-white/15">·</span>
                      <span className="text-[#c8a44e]/70">beach + foodie</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[14px] font-semibold text-[#c8a44e] tabular-nums">₹186,450</div>
                      <div className="font-mono text-[8px] text-white/35 tracking-[1px] mt-0.5">OF ₹200,000</div>
                    </div>
                    <div className="w-24 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full w-[92%] bg-[#c8a44e] rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Day tabs */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'].map((d, i) => (
                    <div key={d} className={`shrink-0 px-3 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-[1px] transition-all ${i === 0 ? 'bg-[#c8a44e]/10 text-[#c8a44e] border border-[#c8a44e]/20' : 'text-white/30'}`}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day label */}
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#c8a44e]/80" />
                  <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-white/45">Day 01 · Ubud · Arrival</span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] text-white/35">Fri, May 2</span>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
                  {[
                    { tag: 'Stay', time: '14:00', name: 'Bambu Indah', detail: 'Eco-luxury treehouse · Ubud', img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&q=80', price: '₹14,200/night', stars: '4.9', reviews: '1.2K' },
                    { tag: 'Food', time: '19:30', name: 'Locavore Ubud', detail: 'Farm-to-table tasting menu', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80', price: '₹6,800', stars: '4.8', reviews: '3.4K' },
                    { tag: 'Activity', time: '06:00', name: 'Tegallalang Terraces', detail: 'Sunrise rice field walk', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80', price: 'Free', stars: '4.7', reviews: '8.1K' },
                  ].map((c, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0a0a0f] overflow-hidden group hover:border-white/15 transition-colors">
                      <div className="relative h-[130px]">
                        <Image src={c.img} alt={c.name} fill className="object-cover" sizes="300px" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/20 to-transparent" />
                        <div className="absolute top-2.5 left-2.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[1.5px] text-white/85">
                          {c.tag}
                        </div>
                        <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 font-mono text-[9px] text-white/80 tabular-nums">{c.time}</div>
                      </div>
                      <div className="p-3">
                        <div className="text-[12px] font-semibold text-white/90 truncate">{c.name}</div>
                        <div className="text-[10px] text-white/40 mt-0.5 truncate">{c.detail}</div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                          <span className="text-[11px] font-medium text-white/85 tabular-nums">{c.price}</span>
                          <span className="flex items-center gap-1 font-mono text-[9px] text-white/45">
                            <span className="text-amber-400/70">★</span>{c.stars}
                            <span className="text-white/25">({c.reviews})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drift chat callout */}
                <div className="rounded-xl border border-[#c8a44e]/15 bg-gradient-to-br from-[#c8a44e]/[0.05] to-transparent p-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="h-7 w-7 rounded-full bg-[#c8a44e] flex items-center justify-center shrink-0">
                      <span className="font-serif italic text-[#08080c] text-[15px] leading-none translate-y-[-1px]">D</span>
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-[#c8a44e]/85">Drift, just now</div>
                  </div>
                  <div className="text-[13px] text-white/70 italic leading-[1.7] pl-10">
                    &ldquo;Swapped Bambu Indah for Hoshinoya — ₹2K more but 0.8km closer to the rice fields and has private onsens. The cost bar still clears.&rdquo;
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex items-center justify-center gap-6 font-mono text-[9px] text-white/40 tracking-[1.5px] uppercase flex-wrap">
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-[#4ecdc4]" /> Amadeus prices</span>
            <span className="text-white/12">·</span>
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-[#c8a44e]" /> Real places</span>
            <span className="text-white/12">·</span>
            <span className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-white/70" /> 2M reviews grounded</span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── THE SEQUENCE (how it works) ───────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="how" className="relative py-24 px-12 lg:px-24 reveal">
        <div className="mx-auto max-w-[1200px]">
          {/* Left-aligned header — smaller */}
          <div className="mb-14 max-w-[560px]">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-6 bg-[#c8a44e]/60" />
              <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">How it works</span>
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,46px)] font-light leading-[1.05] tracking-[-0.02em]">
              Three beats. <em className="italic text-[#c8a44e]">Under thirty seconds.</em>
            </h2>
          </div>

          {/* Timeline cards */}
          <div className="relative grid grid-cols-3 gap-5 max-md:grid-cols-1">
            {/* Connecting line */}
            <div className="pointer-events-none absolute top-[118px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-[#c8a44e]/20 to-transparent max-md:hidden" />

            {[
              {
                num: '01',
                time: '0:00',
                eyebrow: 'INPUT',
                title: 'Type a feeling',
                desc: 'Not a destination. A mood. Drift reads intent.',
                img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
              },
              {
                num: '02',
                time: '0:08',
                eyebrow: 'COMPOSE',
                title: 'The board builds',
                desc: 'Real flights. Real hotels. Twenty-one stops, ranked.',
                img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
              },
              {
                num: '03',
                time: '0:28',
                eyebrow: 'REFINE',
                title: 'Swap and go',
                desc: 'Ask Drift for something quieter. The whole trip adjusts.',
                img: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&q=80',
              },
            ].map((s, i) => (
              <div
                key={s.num}
                className="reveal group relative"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-10 h-3 w-3 rounded-full bg-[#c8a44e] shadow-[0_0_14px_rgba(200,164,78,0.5)] border-2 border-[#050509] max-md:hidden" />

                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] transition-all duration-500 group-hover:border-[#c8a44e]/25 group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
                  <div className="relative h-[180px] overflow-hidden">
                    <Image src={s.img} alt={s.title} fill className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110" sizes="400px" unoptimized />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/50 to-[#08080c]/10" />

                    <div className="absolute top-5 left-5 flex items-baseline gap-3">
                      <span className="font-serif text-[44px] font-light text-white/15 leading-[0.8]">{s.num}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[8px] tracking-[1.5px] text-[#c8a44e]/70 uppercase">{s.eyebrow}</span>
                        <span className="font-mono text-[9px] text-white/40 tabular-nums">T+{s.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="font-serif text-[19px] font-normal leading-tight mb-2">{s.title}</h3>
                    <p className="text-[12px] leading-[1.7] text-white/55">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── FOUR PRINCIPLES ───────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section id="why" className="relative py-24 px-12 lg:px-24 reveal overflow-hidden">
        <div className="aurora-blob h-[480px] w-[480px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#c8a44e]" style={{ opacity: 0.04 }} />

        <div className="relative mx-auto max-w-[1200px]">
          {/* Simple left-aligned header */}
          <div className="mb-14 max-w-[560px]">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-6 bg-[#c8a44e]/60" />
              <span className="font-mono text-[9px] tracking-[2px] uppercase text-[#c8a44e]/80">Principles</span>
            </div>
            <h2 className="font-serif text-[clamp(30px,3.6vw,46px)] font-light leading-[1.05] tracking-[-0.02em]">
              Not search. <em className="italic text-[#c8a44e]">Curation.</em>
            </h2>
          </div>

          {/* Principles — editorial numbered list */}
          <div className="grid grid-cols-2 gap-0 border-t border-white/[0.06] max-md:grid-cols-1">
            {[
              {
                num: 'I',
                title: 'Every pick is explained',
                desc: 'No black box. Each stop shows its reasoning — vibe, budget, timing, tradeoffs.',
              },
              {
                num: 'II',
                title: 'Every price is live',
                desc: 'Pulled from Amadeus at generation time. No stale averages, no fictional rates.',
              },
              {
                num: 'III',
                title: 'Every place is real',
                desc: 'Grounded in Google Maps and two million reviews. Zero invented venues.',
              },
              {
                num: 'IV',
                title: 'Every swap is one sentence',
                desc: '&ldquo;Somewhere quieter.&rdquo; &ldquo;Cheaper.&rdquo; The whole board adjusts.',
              },
            ].map((p, i) => (
              <div
                key={p.num}
                className={`reveal group relative p-9 max-md:p-7 border-b border-white/[0.06] ${i % 2 === 0 ? 'lg:border-r border-white/[0.06]' : ''} transition-colors hover:bg-white/[0.015]`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="font-serif text-[64px] font-light leading-[0.8] text-[#c8a44e]/15 italic mb-5 group-hover:text-[#c8a44e]/30 transition-colors">
                  {p.num}
                </div>
                <h3 className="font-serif text-[20px] font-normal leading-tight mb-2.5 max-w-[380px]">
                  {p.title}
                </h3>
                <p className="text-[12px] leading-[1.75] text-white/55 max-w-[420px]" dangerouslySetInnerHTML={{ __html: p.desc }} />
              </div>
            ))}
          </div>

          {/* Stats band */}
          <div className="mt-14 reveal">
            <div className="grid grid-cols-4 gap-0 rounded-2xl border border-white/[0.06] bg-white/[0.01] max-md:grid-cols-2 overflow-hidden">
              {[
                { v: 200, suffix: '+', l: 'Trips composed' },
                { v: 58, suffix: '', l: 'Destinations' },
                { v: 100, suffix: '%', l: 'Real data' },
                { v: 0, suffix: '', l: 'Hallucinations' },
              ].map((s, i) => (
                <div key={s.l} className={`p-7 ${i < 3 ? 'border-r border-white/[0.06] max-md:border-b' : ''} ${i < 2 ? 'max-md:border-b' : ''}`}>
                  <div className="font-serif text-[clamp(30px,3.2vw,42px)] font-light text-[#c8a44e] tabular-nums leading-none mb-2.5">
                    <Counter value={s.v} suffix={s.suffix} />
                  </div>
                  <div className="font-mono text-[9px] tracking-[1.5px] text-white/55 uppercase">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ─── DEPARTURE (final CTA) ─────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════ */}
      <section className="relative py-28 px-12 lg:px-24 text-center reveal overflow-hidden">
        <div className="aurora-blob h-[560px] w-[560px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#c8a44e]" style={{ opacity: 0.08 }} />

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[460px] w-[460px] rounded-full border border-[#c8a44e]/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[620px] w-[620px] rounded-full border border-[#c8a44e]/[0.04]" />

        <div className="relative mx-auto max-w-[640px]">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-px w-6 bg-[#c8a44e]/60" />
            <span className="font-mono text-[9px] tracking-[2px] text-[#c8a44e]/80 uppercase">Departure</span>
            <div className="h-px w-6 bg-[#c8a44e]/60" />
          </div>

          <h2 className="font-serif text-[clamp(34px,4.2vw,58px)] font-light leading-[1.0] mb-5 tracking-[-0.02em]">
            Stop planning.<br />
            <em className="italic text-[#c8a44e]">Start drifting.</em>
          </h2>

          <p className="text-[13px] text-white/55 mb-10 leading-[1.7] max-w-[440px] mx-auto">
            Your next trip is one sentence away.
          </p>

          <button
            onClick={() => router.push('/vibes')}
            className="group inline-flex items-center gap-3 rounded-full bg-[#c8a44e] px-10 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all duration-400"
          >
            Compose my trip
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          <div className="mt-7 flex items-center justify-center gap-5 font-mono text-[9px] text-white/35 tracking-[1.5px] uppercase flex-wrap">
            <span>Free forever</span>
            <span className="text-white/12">◆</span>
            <span>No card</span>
            <span className="text-white/12">◆</span>
            <span>~30s</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.06] py-12 px-12 lg:px-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-12 gap-6 items-start">
            {/* Brand */}
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-serif text-[22px] italic text-[#c8a44e]">Drift</span>
                <span className="font-mono text-[9px] tracking-[1.5px] text-white/35">/ v1.0 · MMXXVI</span>
              </div>
              <p className="text-[11px] text-white/45 leading-[1.7] max-w-[280px]">
                Travel composed, not searched. An AI that reads your vibe and builds trips you&apos;d actually book.
              </p>
            </div>

            {/* Product */}
            <div className="col-span-6 lg:col-span-2">
              <div className="font-mono text-[9px] tracking-[1.5px] text-white/35 uppercase mb-3">Product</div>
              <div className="flex flex-col gap-2 text-[11px]">
                <button onClick={() => router.push('/vibes')} className="text-left text-white/60 hover:text-[#c8a44e] transition-colors">Compose a trip</button>
                <button onClick={() => router.push('/destinations')} className="text-left text-white/60 hover:text-[#c8a44e] transition-colors">Destinations</button>
                <button onClick={() => router.push('/trips')} className="text-left text-white/60 hover:text-[#c8a44e] transition-colors">My trips</button>
              </div>
            </div>

            {/* Company */}
            <div className="col-span-6 lg:col-span-2">
              <div className="font-mono text-[9px] tracking-[1.5px] text-white/35 uppercase mb-3">Company</div>
              <div className="flex flex-col gap-2 text-[11px]">
                <Link href="/about" className="text-white/60 hover:text-[#c8a44e] transition-colors">About</Link>
                <Link href="/faq" className="text-white/60 hover:text-[#c8a44e] transition-colors">FAQ</Link>
              </div>
            </div>

            {/* Legal */}
            <div className="col-span-6 lg:col-span-2">
              <div className="font-mono text-[9px] tracking-[1.5px] text-white/35 uppercase mb-3">Legal</div>
              <div className="flex flex-col gap-2 text-[11px]">
                <Link href="/privacy" className="text-white/60 hover:text-[#c8a44e] transition-colors">Privacy</Link>
                <Link href="/terms" className="text-white/60 hover:text-[#c8a44e] transition-colors">Terms</Link>
              </div>
            </div>

            {/* Status */}
            <div className="col-span-6 lg:col-span-2">
              <div className="font-mono text-[9px] tracking-[1.5px] text-white/35 uppercase mb-3">Status</div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />
                <span className="font-mono text-[10px] text-[#4ecdc4]/85 tracking-wider">All systems nominal</span>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-10 pt-6 border-t border-white/[0.04] flex items-center justify-between font-mono text-[9px] text-white/30 tracking-[1px] uppercase flex-wrap gap-3">
            <div>© MMXXVI · Drift — All rights reserved</div>
            <div className="flex items-center gap-4">
              <span>Designed in New Delhi</span>
              <span className="text-white/15">◆</span>
              <span>Composed by Gemini 2.5</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
