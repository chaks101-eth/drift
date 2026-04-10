'use client'

import { useRouter } from 'next/navigation'
import VariationNav from '../VariationNav'

// ─── Constellation Map ────────────────────────────────────────
// World map with destinations as stars, flight paths as glowing arcs.

interface Point { x: number; y: number; name: string; tag: string; size?: number }

// Approximate 2D projection of major destinations (percentage of viewBox 1000x500)
const DESTINATIONS: Point[] = [
  { x: 215, y: 195, name: 'London', tag: 'CULTURE', size: 4 },
  { x: 260, y: 205, name: 'Paris', tag: 'ROMANCE', size: 5 },
  { x: 305, y: 230, name: 'Rome', tag: 'CULTURE', size: 3 },
  { x: 335, y: 215, name: 'Istanbul', tag: 'CULTURE', size: 4 },
  { x: 398, y: 260, name: 'Dubai', tag: 'LUXURY', size: 5 },
  { x: 455, y: 275, name: 'Delhi', tag: 'ORIGIN', size: 6 },
  { x: 495, y: 305, name: 'Mumbai', tag: 'CITY', size: 4 },
  { x: 540, y: 340, name: 'Maldives', tag: 'BEACH', size: 4 },
  { x: 575, y: 320, name: 'Bangkok', tag: 'FOODIE', size: 5 },
  { x: 595, y: 340, name: 'Phuket', tag: 'BEACH', size: 4 },
  { x: 620, y: 360, name: 'Bali', tag: 'SPIRITUAL', size: 5 },
  { x: 610, y: 305, name: 'Singapore', tag: 'CITY', size: 4 },
  { x: 710, y: 230, name: 'Tokyo', tag: 'CITY', size: 5 },
  { x: 725, y: 250, name: 'Osaka', tag: 'FOODIE', size: 3 },
  { x: 840, y: 420, name: 'Sydney', tag: 'NATURE', size: 4 },
  { x: 200, y: 270, name: 'Marrakech', tag: 'CULTURE', size: 3 },
  { x: 155, y: 300, name: 'Canary', tag: 'BEACH', size: 3 },
  { x: 140, y: 250, name: 'Lisbon', tag: 'FOODIE', size: 4 },
]

// Flight paths from Delhi (origin)
const ORIGIN = DESTINATIONS.find(d => d.name === 'Delhi')!
const ROUTES = DESTINATIONS.filter(d => d.name !== 'Delhi').map(d => ({ from: ORIGIN, to: d }))

function curvePath(from: Point, to: Point) {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2 - Math.abs(from.x - to.x) * 0.25
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`
}

export default function V2Constellation() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-[#050509] text-[#f0efe8] overflow-x-hidden font-sans">
      <VariationNav current={2} name="Constellation Map" />

      {/* Background starfield */}
      <div className="fixed inset-0 starfield pointer-events-none" />

      {/* Radial gradient atmosphere */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(200,164,78,0.06) 0%, transparent 60%)' }} />

      {/* Nav header */}
      <div className="relative z-10 flex items-center justify-between px-12 py-7">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
          <span className="font-mono text-[9px] tracking-[1.5px] text-white/35">/ CARTOGRAPHIC.VIEW</span>
        </div>
        <nav className="flex items-center gap-8 font-mono text-[10px] tracking-[0.5px] text-white/50">
          <button className="hover:text-[#c8a44e] transition-colors">destinations</button>
          <button className="hover:text-[#c8a44e] transition-colors">routes</button>
          <button className="hover:text-[#c8a44e] transition-colors">my_trips</button>
        </nav>
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-[1300px] px-12 pt-8 pb-12">
        <div className="mb-2 font-mono text-[10px] tracking-[1.5px] text-[#c8a44e]/70">{'// ATLAS / 58 NODES / 203 ROUTES'}</div>
        <h1 className="font-serif text-[clamp(44px,6vw,88px)] font-light leading-[0.95] tracking-[-0.025em] mb-4 max-w-[900px]">
          Chart a path through <em className="italic text-[#c8a44e]">the world</em>.
        </h1>
        <p className="text-[14px] text-white/55 max-w-[520px] leading-relaxed mb-8">
          Every destination Drift has verified. Every route composed. Click any node to start a trip from your city.
        </p>
      </div>

      {/* The map */}
      <div className="relative mx-auto max-w-[1300px] px-12 pb-24">
        <div className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.015] to-transparent p-6 overflow-hidden">
          {/* Corner markers */}
          <div className="absolute top-3 left-3 font-mono text-[9px] text-[#c8a44e]/50 tracking-[1px]">84.42°W / 52.18°N</div>
          <div className="absolute top-3 right-3 font-mono text-[9px] text-[#c8a44e]/50 tracking-[1px]">151.2°E / 52.18°N</div>
          <div className="absolute bottom-3 left-3 font-mono text-[9px] text-[#c8a44e]/50 tracking-[1px]">84.42°W / -35.5°S</div>
          <div className="absolute bottom-3 right-3 font-mono text-[9px] text-[#c8a44e]/50 tracking-[1px]">151.2°E / -35.5°S</div>

          {/* Grid overlay */}
          <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ minHeight: '420px' }}>
            {/* Graticule */}
            <defs>
              <pattern id="grat" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="star">
                <stop offset="0%" stopColor="#c8a44e" stopOpacity="1" />
                <stop offset="40%" stopColor="#c8a44e" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#c8a44e" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1000" height="500" fill="url(#grat)" />

            {/* Continent outlines — simplified silhouettes */}
            <g stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" fill="rgba(200,164,78,0.02)">
              {/* Europe + Africa */}
              <path d="M 180,150 L 230,140 L 280,150 L 330,170 L 370,200 L 380,280 L 340,360 L 300,400 L 250,410 L 220,380 L 200,300 L 180,220 Z" />
              {/* Asia */}
              <path d="M 380,140 L 500,130 L 620,150 L 720,180 L 780,220 L 760,280 L 680,320 L 600,340 L 520,350 L 450,330 L 400,280 L 380,200 Z" />
              {/* Australia/Oceania */}
              <path d="M 780,380 L 870,370 L 900,410 L 880,440 L 820,450 L 790,420 Z" />
              {/* Americas (partial, left edge) */}
              <path d="M 40,180 L 100,170 L 110,250 L 90,320 L 70,380 L 50,400 L 30,350 L 20,260 Z" />
            </g>

            {/* Flight paths */}
            {ROUTES.map((r, i) => (
              <path
                key={i}
                d={curvePath(r.from, r.to)}
                fill="none"
                stroke="rgba(200,164,78,0.25)"
                strokeWidth="0.6"
                strokeDasharray="2 3"
                filter="url(#glow)"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="10" dur="3s" repeatCount="indefinite" />
              </path>
            ))}

            {/* Destination stars */}
            {DESTINATIONS.map((d) => (
              <g key={d.name} className="cursor-pointer" onClick={() => router.push('/vibes')}>
                {/* Glow */}
                <circle cx={d.x} cy={d.y} r={(d.size || 4) * 3} fill="url(#star)" opacity="0.6">
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
                </circle>
                {/* Core */}
                <circle cx={d.x} cy={d.y} r={d.size || 4} fill="#c8a44e" />
                {/* Label */}
                <text x={d.x + (d.size || 4) + 4} y={d.y + 3} fontSize="8" fontFamily="Inter, sans-serif" fill="rgba(240,239,232,0.75)" className="tabular-nums">
                  {d.name}
                </text>
                <text x={d.x + (d.size || 4) + 4} y={d.y + 12} fontSize="5.5" fontFamily="JetBrains Mono, monospace" fill="rgba(200,164,78,0.5)" letterSpacing="0.5">
                  {d.tag}
                </text>
              </g>
            ))}

            {/* Origin pulse */}
            <circle cx={ORIGIN.x} cy={ORIGIN.y} r="10" fill="none" stroke="#4ecdc4" strokeWidth="1">
              <animate attributeName="r" from="6" to="18" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-between text-[9px] font-mono tracking-[1px] text-white/40">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4]" /> ORIGIN</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#c8a44e]" /> DESTINATIONS</span>
              <span className="flex items-center gap-2"><span className="h-px w-4 bg-[#c8a44e]/40" /> ROUTES (203)</span>
            </div>
            <div>ZOOM.FIT · LAYER:POLITICAL</div>
          </div>
        </div>

        {/* CTA below map */}
        <div className="mt-10 flex items-center justify-between flex-wrap gap-5">
          <div>
            <div className="font-mono text-[10px] text-[#c8a44e]/70 tracking-[1px] mb-2">{'// READY TO DEPART?'}</div>
            <div className="font-serif text-[28px] font-light leading-tight">Pick any node. Compose a trip.</div>
          </div>
          <button
            onClick={() => router.push('/vibes')}
            className="rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all"
          >
            Begin Navigation →
          </button>
        </div>
      </div>
    </div>
  )
}
