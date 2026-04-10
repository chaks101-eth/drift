'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import VariationNav from '../VariationNav'

// ─── Generative Blob ──────────────────────────────────────────
// Morphing organic shape as hero. Your trip is a feeling visualized.
// Biomorphic, moody, abstract.

const MOODS = [
  { name: 'BEACH + CHILL', gradient: 'linear-gradient(135deg, #00c6a7, #4ecdc4, #a0e8d8)', color: '#4ecdc4' },
  { name: 'CITY + FOODIE', gradient: 'linear-gradient(135deg, #ff6b9e, #c8a44e, #ffeb6c)', color: '#c8a44e' },
  { name: 'ROMANCE + LUXURY', gradient: 'linear-gradient(135deg, #8a4fff, #ff6b9e, #ffa5b9)', color: '#ff6b9e' },
  { name: 'ADVENTURE + NATURE', gradient: 'linear-gradient(135deg, #4ecdc4, #5ea8ff, #a0d8ff)', color: '#5ea8ff' },
  { name: 'SPIRITUAL + CULTURE', gradient: 'linear-gradient(135deg, #c8a44e, #e8b56c, #f5d38c)', color: '#c8a44e' },
]

export default function V9Blob() {
  const router = useRouter()
  const [moodIdx, setMoodIdx] = useState(0)
  const mood = MOODS[moodIdx]

  useEffect(() => {
    const t = setInterval(() => setMoodIdx(i => (i + 1) % MOODS.length), 4500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#050509] text-[#f0efe8] overflow-hidden font-sans relative">
      <VariationNav current={9} name="Generative Blob" />

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none transition-all duration-[3000ms]"
        style={{ background: `radial-gradient(ellipse at 70% 40%, ${mood.color}15 0%, transparent 60%)` }}
      />

      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 noise-grain" />

      <div className="relative z-10 min-h-screen grid grid-cols-2 max-lg:grid-cols-1 max-lg:grid-rows-[1fr_auto]">
        {/* ───────── LEFT: Copy ───────── */}
        <div className="flex flex-col justify-between p-12 lg:p-16 min-h-screen max-lg:min-h-[60vh]">
          {/* Top */}
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
            <span className="font-mono text-[9px] tracking-[1.5px] text-white/40">/ BIOMORPH.EXE</span>
          </div>

          {/* Middle */}
          <div className="py-12">
            <div className="font-mono text-[10px] tracking-[1.5px] text-white/50 mb-6">
              {'// EVERY TRIP HAS A SHAPE'}
            </div>

            <h1 className="font-serif font-light leading-[0.92] tracking-[-0.025em] text-[clamp(48px,6.5vw,100px)] mb-7">
              What does<br />
              <em className="italic" style={{ color: mood.color, transition: 'color 1.5s ease' }}>your trip</em><br />
              feel like?
            </h1>

            <p className="text-[14px] text-white/55 max-w-[440px] leading-[1.75] mb-10">
              Drift doesn&apos;t start with a destination. It starts with a feeling. Pick the mood. Watch it take shape.
            </p>

            {/* Active mood */}
            <div className="mb-8">
              <div className="font-mono text-[9px] tracking-[2px] text-white/40 mb-2">CURRENTLY_RENDERING</div>
              <div className="font-mono text-[13px] tracking-[1.5px]" style={{ color: mood.color, transition: 'color 1.5s ease' }}>
                {mood.name}
              </div>
              <div className="mt-3 flex gap-1.5">
                {MOODS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setMoodIdx(i)}
                    className={`h-[2px] rounded-full transition-all duration-700 ${i === moodIdx ? 'w-8' : 'w-3 bg-white/20 hover:bg-white/35'}`}
                    style={i === moodIdx ? { background: mood.color } : undefined}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => router.push('/vibes')}
              className="group flex items-center gap-4 rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all"
            >
              Shape your trip
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Bottom metadata */}
          <div className="font-mono text-[9px] tracking-[1px] text-white/35 flex items-center gap-6 flex-wrap">
            <span>200+ TRIPS</span>
            <span className="text-white/15">◆</span>
            <span>58 NODES</span>
            <span className="text-white/15">◆</span>
            <span>0 HALLUCINATIONS</span>
            <span className="text-white/15">◆</span>
            <span>~28.3s AVG</span>
          </div>
        </div>

        {/* ───────── RIGHT: The blob ───────── */}
        <div className="relative flex items-center justify-center p-12 lg:p-16 min-h-[60vh]">
          {/* Ambient ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[440px] h-[440px] rounded-full border border-white/[0.06]" />
            <div className="absolute w-[560px] h-[560px] rounded-full border border-white/[0.04]" />
            <div className="absolute w-[680px] h-[680px] rounded-full border border-white/[0.02]" />
          </div>

          {/* The blob */}
          <div
            className="relative blob-morph transition-all duration-[2500ms] ease-in-out"
            style={{
              width: '420px',
              height: '420px',
              background: mood.gradient,
              filter: 'blur(1px) saturate(1.15)',
              boxShadow: `0 0 120px ${mood.color}40, 0 0 240px ${mood.color}20, inset 0 0 80px rgba(255,255,255,0.15)`,
            }}
          >
            {/* Inner highlights */}
            <div className="absolute inset-0 blob-morph"
              style={{
                background: 'radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.35), transparent 50%)',
                animationDirection: 'reverse',
                animationDuration: '18s',
              }}
            />
          </div>

          {/* Coordinate tags around the blob */}
          <div className="absolute top-[12%] right-[8%] font-mono text-[9px] text-white/40 tracking-wider">
            <div className="text-[#c8a44e]/70">+21.04</div>
            <div>INTENSITY</div>
          </div>
          <div className="absolute bottom-[15%] left-[5%] font-mono text-[9px] text-white/40 tracking-wider">
            <div className="text-[#c8a44e]/70">-0.82</div>
            <div>DRIFT</div>
          </div>
          <div className="absolute top-[40%] left-[2%] font-mono text-[9px] text-white/40 tracking-wider">
            <div className="text-[#c8a44e]/70">+∞</div>
            <div>HORIZON</div>
          </div>

          {/* Bottom label */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <div className="font-mono text-[9px] tracking-[2px] text-white/40">BIOMORPH_001 · RENDERING</div>
          </div>
        </div>
      </div>
    </div>
  )
}
