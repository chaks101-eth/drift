'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import VariationNav from '../VariationNav'

// ─── Orbital System ───────────────────────────────────────────
// Central sphere with destinations orbiting. A solar system of travel.

interface Planet {
  name: string
  tag: string
  radius: number // orbit radius px
  duration: number // seconds for full orbit
  angle: number // starting angle
  size: number
  color: string
  img: string
}

const PLANETS: Planet[] = [
  { name: 'BALI', tag: 'Beach · Spiritual', radius: 180, duration: 40, angle: 0, size: 44, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=200&q=80' },
  { name: 'TOKYO', tag: 'City · Foodie', radius: 180, duration: 40, angle: 90, size: 40, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200&q=80' },
  { name: 'PARIS', tag: 'Culture', radius: 180, duration: 40, angle: 180, size: 36, color: '#a880ff', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&q=80' },
  { name: 'MALDIVES', tag: 'Luxury', radius: 180, duration: 40, angle: 270, size: 38, color: '#4ecdc4', img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=200&q=80' },
  { name: 'DUBAI', tag: 'Luxury · City', radius: 280, duration: 70, angle: 45, size: 36, color: '#c8a44e', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=200&q=80' },
  { name: 'SANTORINI', tag: 'Romance', radius: 280, duration: 70, angle: 135, size: 34, color: '#5ea8ff', img: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=200&q=80' },
  { name: 'PHUKET', tag: 'Beach · Party', radius: 280, duration: 70, angle: 225, size: 34, color: '#ffeb6c', img: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=200&q=80' },
  { name: 'SINGAPORE', tag: 'City · Foodie', radius: 280, duration: 70, angle: 315, size: 34, color: '#ff6b9e', img: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=200&q=80' },
]

export default function V10Orbital() {
  const router = useRouter()
  const [selected, setSelected] = useState<Planet | null>(null)

  return (
    <div className="min-h-screen bg-[#030308] text-[#f0efe8] overflow-hidden font-sans">
      <VariationNav current={10} name="Orbital System" />

      {/* Starfield */}
      <div className="fixed inset-0 starfield pointer-events-none" />

      {/* Ambient glow at center */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(200,164,78,0.1) 0%, transparent 50%)' }}
      />

      {/* Top nav */}
      <div className="relative z-10 flex items-center justify-between px-12 py-7">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
          <span className="font-mono text-[9px] tracking-[1.5px] text-white/40">/ ORBITAL.VIEW</span>
        </div>
        <div className="font-mono text-[9px] tracking-[1px] text-white/40 flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" /> SYSTEM_LIVE</span>
          <span>8 BODIES · 2 ORBITS</span>
        </div>
      </div>

      {/* Hero split */}
      <div className="relative z-10 grid grid-cols-[1fr_720px] max-lg:grid-cols-1 px-12 pt-12 pb-16 gap-10">
        {/* ───── LEFT COPY ───── */}
        <div className="flex flex-col justify-center max-w-[520px]">
          <div className="font-mono text-[10px] tracking-[1.5px] text-[#c8a44e]/70 mb-6">
            {'// THE DRIFT SYSTEM / 2026'}
          </div>
          <h1 className="font-serif font-light leading-[0.9] tracking-[-0.025em] text-[clamp(48px,6vw,88px)] mb-7">
            Your next trip<br />
            is already <em className="italic text-[#c8a44e]">in orbit</em>.
          </h1>
          <p className="text-[14px] text-white/55 leading-[1.75] mb-8">
            58 destinations circle the Drift composer, waiting for your vibe. Pick one to pull it into focus — or let Drift choose.
          </p>

          <div className="flex items-center gap-5 mb-10">
            <button
              onClick={() => router.push('/vibes')}
              className="rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all"
            >
              Compose a trip →
            </button>
            <button className="font-mono text-[10px] tracking-[0.5px] text-white/55 hover:text-[#c8a44e] transition-colors">
              view_list
            </button>
          </div>

          {/* Selected body details */}
          {selected && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 animate-[fadeUp_0.3s_ease]">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[9px] tracking-[1.5px] text-[#c8a44e]/70">SELECTED_NODE</div>
                <button onClick={() => setSelected(null)} className="text-white/35 hover:text-white transition-colors text-sm">×</button>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 rounded-full overflow-hidden border border-white/10 shrink-0">
                  <Image src={selected.img} alt="" fill className="object-cover" sizes="56px" unoptimized />
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-[22px] text-white leading-tight">{selected.name}</div>
                  <div className="font-mono text-[9px] tracking-[1px] text-[#c8a44e]/70 mt-0.5">{selected.tag}</div>
                </div>
              </div>
              <button
                onClick={() => router.push('/vibes')}
                className="mt-4 w-full rounded-md border border-[#c8a44e]/40 bg-[#c8a44e]/[0.06] py-2.5 text-[10px] font-bold tracking-[2px] text-[#c8a44e] uppercase hover:bg-[#c8a44e] hover:text-[#08080c] transition-all"
              >
                [ DRIFT TO {selected.name} ]
              </button>
            </div>
          )}

          {!selected && (
            <div className="font-mono text-[10px] tracking-[1px] text-white/30">
              {'// CLICK ANY ORBITING BODY TO SELECT →'}
            </div>
          )}
        </div>

        {/* ───── RIGHT: The orbital system ───── */}
        <div className="relative flex items-center justify-center min-h-[680px]">
          {/* Orbit rings */}
          <div className="absolute w-[360px] h-[360px] rounded-full border border-[#c8a44e]/15" />
          <div className="absolute w-[560px] h-[560px] rounded-full border border-[#c8a44e]/10" />
          <div className="absolute w-[700px] h-[700px] rounded-full border border-white/[0.04]" />

          {/* Tick marks on inner orbit */}
          <div className="absolute w-[360px] h-[360px] compass-ring">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 left-1/2 h-1.5 w-px bg-[#c8a44e]/30 origin-[50%_180px]"
                style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
              />
            ))}
          </div>

          {/* Center Drift sphere */}
          <div className="relative z-20">
            <div className="h-[120px] w-[120px] rounded-full bg-gradient-to-br from-[#c8a44e] via-[#e8cc6e] to-[#a88a3e] flex items-center justify-center shadow-[0_0_80px_rgba(200,164,78,0.4)]">
              <span className="font-serif italic text-[64px] text-[#08080c] leading-none translate-y-[-4px]">D</span>
            </div>
            {/* Rings */}
            <div className="absolute inset-0 rounded-full border border-[#c8a44e]/40 scale-[1.18]" />
            <div className="absolute inset-0 rounded-full border border-[#c8a44e]/25 scale-[1.35]" />
          </div>

          {/* Planets — using inline transform instead of animation for simplicity */}
          {PLANETS.map((p) => {
            const rad = (p.angle * Math.PI) / 180
            const x = Math.cos(rad) * p.radius
            const y = Math.sin(rad) * p.radius
            return (
              <button
                key={p.name}
                onClick={() => setSelected(p)}
                className="group absolute top-1/2 left-1/2"
                style={{
                  transform: `translate(${x - p.size / 2}px, ${y - p.size / 2}px)`,
                  width: p.size,
                  height: p.size,
                  transition: 'transform 0.4s ease',
                }}
              >
                <div
                  className="relative h-full w-full rounded-full overflow-hidden border transition-all duration-300 group-hover:scale-125"
                  style={{ borderColor: `${p.color}60`, boxShadow: `0 0 ${p.size / 2}px ${p.color}80` }}
                >
                  <Image src={p.img} alt={p.name} fill className="object-cover" sizes={`${p.size}px`} unoptimized />
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="rounded-md bg-black/80 backdrop-blur-sm border border-white/10 px-2 py-1 font-mono text-[9px] tracking-[1px] text-white/90">
                    {p.name}
                  </div>
                </div>
              </button>
            )
          })}

          {/* Corner telemetry */}
          <div className="absolute top-4 left-4 font-mono text-[9px] tracking-[1px] text-white/30">
            <div>ORBIT_01 · 4 BODIES</div>
            <div>R = 180PX · T = 40s</div>
          </div>
          <div className="absolute bottom-4 right-4 text-right font-mono text-[9px] tracking-[1px] text-white/30">
            <div>ORBIT_02 · 4 BODIES</div>
            <div>R = 280PX · T = 70s</div>
          </div>
          <div className="absolute bottom-4 left-4 font-mono text-[9px] tracking-[1px] text-white/30">
            DRIFT.CORE · ACTIVE
          </div>
          <div className="absolute top-4 right-4 text-right font-mono text-[9px] tracking-[1px] text-white/30">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" /> LIVE
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
