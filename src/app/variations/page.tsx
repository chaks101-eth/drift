'use client'

import Link from 'next/link'

const VARIATIONS = [
  { id: 'v1', name: 'Terminal / CLI First', desc: 'The whole landing is a command-line interface. Type, compose, execute.', tag: 'DEVELOPER_GRADE', accent: '#4ecdc4' },
  { id: 'v2', name: 'Constellation Map', desc: 'World map. Destinations are stars. Flight paths are glowing arcs.', tag: 'CARTOGRAPHIC', accent: '#c8a44e' },
  { id: 'v3', name: 'Split Asymmetric', desc: '50/50 split: typographic hero on the left, live scrolling compose feed on the right.', tag: 'EDITORIAL_SPLIT', accent: '#c8a44e' },
  { id: 'v4', name: 'Brutalist Swiss', desc: 'Massive serif type. Grid lines visible. Black + gold only. Like a fashion house manifesto.', tag: 'MAXIMUM_RESTRAINT', accent: '#c8a44e' },
  { id: 'v5', name: 'Mission Control', desc: 'Landing page IS a fake dashboard. Live widgets, counters, prompt input. Like a cockpit.', tag: 'OPERATIONS_FLOOR', accent: '#4ecdc4' },
  { id: 'v6', name: 'Editorial Cover', desc: 'Looks like a premium travel magazine cover. Issue number, bylines, pull quotes.', tag: 'PRINT_ASPIRATION', accent: '#c8a44e' },
  { id: 'v7', name: 'Synthwave Horizon', desc: 'Cyberpunk sunset. Laser grid floor. Neon gradients. 1984 retrofuture.', tag: 'NEON_FIELD', accent: '#ff6b9e' },
  { id: 'v8', name: 'Interactive Prompt', desc: 'Hero is a giant input field. Watch Drift compose a trip live as you type.', tag: 'LIVE_COMPOSE', accent: '#c8a44e' },
  { id: 'v9', name: 'Generative Blob', desc: 'Morphing organic shape as the hero. Your trip is a feeling visualized.', tag: 'BIOMORPHIC', accent: '#a880ff' },
  { id: 'v10', name: 'Orbital System', desc: 'Central sphere with destinations orbiting. Click any to preview. A solar system of travel.', tag: 'ORBIT_MECHANICS', accent: '#c8a44e' },
]

export default function VariationsGallery() {
  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] font-mono">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-12 py-8">
        <div className="mx-auto max-w-[1200px]">
          <Link href="/" className="font-serif text-[24px] italic text-[#c8a44e] hover:opacity-80 transition-opacity">
            Drift
          </Link>
          <div className="mt-4 flex items-baseline justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[10px] text-[#c8a44e]/70 tracking-[1px] mb-2">{'// LANDING.EXPLORATIONS / v0.3'}</div>
              <h1 className="font-serif text-[40px] font-light leading-tight tracking-[-0.01em] text-[#f0efe8]">
                Ten directions. <em className="italic text-[#c8a44e]">Pick one.</em>
              </h1>
              <p className="mt-3 text-[12px] text-white/50 max-w-[640px] leading-relaxed">
                Click any tile to preview the full landing in that direction. Navigate between variations with the arrows inside each one, or come back here to compare. Each is genuinely distinct — different typography, layout, interaction model, and emotional register.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/[0.08] px-4 py-2 text-[10px] tracking-[1px] text-white/60 hover:border-[#c8a44e]/30 hover:text-[#c8a44e] transition-colors"
            >
              ← CURRENT_LIVE
            </Link>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-[1200px] px-12 py-12">
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          {VARIATIONS.map((v, i) => (
            <Link
              key={v.id}
              href={`/variations/${v.id}`}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.01] p-8 transition-all duration-500 hover:border-[#c8a44e]/25 hover:-translate-y-1 hover:bg-white/[0.03]"
            >
              {/* Number */}
              <div className="flex items-start justify-between mb-6">
                <div className="font-mono text-[11px] tracking-[1px] text-white/40">{String(i + 1).padStart(2, '0')} / 10</div>
                <div className="font-mono text-[9px] tracking-[1px] px-2 py-0.5 rounded-full border" style={{ color: v.accent, borderColor: `${v.accent}30` }}>
                  {v.tag}
                </div>
              </div>

              {/* Title */}
              <h2 className="font-serif text-[28px] font-light leading-tight tracking-[-0.01em] text-[#f0efe8] mb-2 group-hover:text-[#c8a44e] transition-colors">
                {v.name}
              </h2>

              {/* Description */}
              <p className="text-[12px] text-white/55 leading-relaxed max-w-[420px]">{v.desc}</p>

              {/* Action */}
              <div className="mt-6 flex items-center gap-2 text-[10px] font-mono tracking-[1px] text-white/40 group-hover:text-[#c8a44e] transition-colors">
                OPEN_VARIATION
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:translate-x-1">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>

              {/* Accent line */}
              <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${v.accent}40, transparent)` }} />
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-[10px] tracking-[1px] text-white/30">
          {'// WHEN_YOU_PICK_ONE, SAY THE NUMBER. I\'LL TURN IT INTO THE REAL LANDING.'}
        </div>
      </div>
    </div>
  )
}
