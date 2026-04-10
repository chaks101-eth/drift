'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import VariationNav from '../VariationNav'

// ─── Mission Control ──────────────────────────────────────────
// Landing page IS a live operations dashboard.
// Cockpit of widgets, counters, globe, prompt input.

export default function V5MissionControl() {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const updateTime = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    updateTime()
    const t = setInterval(updateTime, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const target = 200
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1800)
      setCount(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  return (
    <div className="min-h-screen bg-[#030307] text-[#f0efe8] overflow-hidden font-mono">
      <VariationNav current={5} name="Mission Control" />

      {/* Scan line overlay */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, #4ecdc4 0px, #4ecdc4 1px, transparent 1px, transparent 4px)' }}
      />

      {/* Top status bar */}
      <div className="border-b border-[#4ecdc4]/15 bg-[#4ecdc4]/[0.02] px-6 py-3 flex items-center justify-between text-[10px] tracking-[1px]">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[18px] italic text-[#c8a44e] not-italic"><em className="italic">Drift</em></span>
            <span className="text-[#4ecdc4]/50">· OPERATIONS</span>
          </div>
          <div className="flex items-center gap-4 text-[#4ecdc4]/60">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" /> SYSTEM_NOMINAL</span>
            <span>LAT 12ms</span>
            <span>UPTIME 99.98%</span>
          </div>
        </div>
        <div className="flex items-center gap-6 text-[#4ecdc4]/60 tabular-nums">
          <span>UTC {time}</span>
          <span>SECTOR DEL-ASIA</span>
        </div>
      </div>

      {/* Main dashboard grid */}
      <div className="p-6">
        <div className="grid grid-cols-12 gap-4 auto-rows-min" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* ─── BIG HEADLINE (col 1-8, row 1) ─── */}
          <div className="col-span-12 lg:col-span-8 rounded-lg border border-[#4ecdc4]/15 bg-[#05050a] p-8 relative overflow-hidden">
            <div className="absolute top-3 left-3 text-[9px] tracking-[1px] text-[#4ecdc4]/50">{'// PRIMARY_DISPLAY'}</div>
            <div className="absolute top-3 right-3 text-[9px] tracking-[1px] text-[#4ecdc4]/50">W01 · 100%</div>
            <div className="mt-10">
              <h1 className="font-serif font-light leading-[0.92] tracking-[-0.02em] text-[clamp(38px,5vw,68px)] text-[#f0efe8] mb-4">
                Travel,<br />
                <em className="italic text-[#c8a44e]">dispatched</em>.
              </h1>
              <p className="text-[12px] text-[#f0efe8]/55 max-w-[420px] leading-[1.7] font-sans mb-8">
                A travel composer running 24/7. Tell it how you want to feel. It will dispatch a complete trip in under thirty seconds.
              </p>
              <button
                onClick={() => router.push('/vibes')}
                className="flex items-center gap-3 rounded-sm border border-[#c8a44e]/60 bg-[#c8a44e]/10 px-5 py-2.5 text-[10px] tracking-[2px] text-[#c8a44e] uppercase hover:bg-[#c8a44e] hover:text-[#08080c] transition-all"
              >
                [ INITIATE_COMPOSE ] <span className="animate-pulse">▶</span>
              </button>
            </div>
            {/* Radar sweep */}
            <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full border border-[#4ecdc4]/20 opacity-50">
              <div className="absolute inset-0 rounded-full border border-[#4ecdc4]/30 animate-spin" style={{ animationDuration: '4s' }}>
                <div className="absolute top-0 left-1/2 h-1/2 w-px bg-gradient-to-b from-[#4ecdc4] to-transparent -translate-x-1/2" />
              </div>
              <div className="absolute inset-3 rounded-full border border-[#4ecdc4]/15" />
              <div className="absolute inset-6 rounded-full border border-[#4ecdc4]/10" />
              <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-[#4ecdc4]" />
            </div>
          </div>

          {/* ─── SYSTEM STATUS (col 9-12, row 1) ─── */}
          <div className="col-span-12 lg:col-span-4 rounded-lg border border-[#4ecdc4]/15 bg-[#05050a] p-5">
            <div className="text-[9px] tracking-[1px] text-[#4ecdc4]/50 mb-4">{'// SYSTEM_STATUS'}</div>
            <div className="space-y-3">
              {[
                { l: 'gemini_2.5', v: 'ONLINE', c: '#4ecdc4' },
                { l: 'amadeus_api', v: 'ONLINE', c: '#4ecdc4' },
                { l: 'serpapi', v: 'ONLINE', c: '#4ecdc4' },
                { l: 'supabase', v: 'ONLINE', c: '#4ecdc4' },
                { l: 'hallucinations', v: '0 / 24HR', c: '#c8a44e' },
                { l: 'composer_load', v: '12%', c: '#c8a44e' },
              ].map(s => (
                <div key={s.l} className="flex items-center justify-between text-[10px] border-b border-white/[0.04] pb-2">
                  <span className="text-white/50">{s.l}</span>
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full" style={{ background: s.c }} />
                    <span style={{ color: s.c }} className="tabular-nums">{s.v}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── TRIPS COUNTER (col 1-4, row 2) ─── */}
          <div className="col-span-6 lg:col-span-4 rounded-lg border border-[#c8a44e]/15 bg-[#05050a] p-6">
            <div className="text-[9px] tracking-[1px] text-[#c8a44e]/60 mb-3">{'// TRIPS_COMPOSED'}</div>
            <div className="font-serif text-[clamp(48px,6vw,88px)] font-light text-[#c8a44e] leading-none tabular-nums">
              {count}<span className="text-[#c8a44e]/50">+</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[9px] text-white/40">
              <span className="h-1 w-1 rounded-full bg-[#4ecdc4] live-dot" /> +3 IN LAST HOUR
            </div>
            {/* Mini chart */}
            <svg className="mt-4 w-full h-12" viewBox="0 0 200 40" preserveAspectRatio="none">
              <polyline points="0,30 20,28 40,25 60,20 80,22 100,18 120,15 140,17 160,10 180,12 200,5" fill="none" stroke="#c8a44e" strokeWidth="1" />
              <polyline points="0,30 20,28 40,25 60,20 80,22 100,18 120,15 140,17 160,10 180,12 200,5" fill="url(#grad)" opacity="0.3" />
              <defs>
                <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#c8a44e" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#c8a44e" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* ─── COMPOSE INPUT (col 5-12, row 2) ─── */}
          <div className="col-span-6 lg:col-span-8 rounded-lg border border-[#4ecdc4]/15 bg-[#05050a] p-6">
            <div className="text-[9px] tracking-[1px] text-[#4ecdc4]/50 mb-3">{'// LIVE_COMPOSE_INPUT'}</div>
            <div className="rounded-md border border-[#4ecdc4]/20 bg-black/40 px-4 py-4 mb-4 flex items-center">
              <span className="text-[#c8a44e]/60 mr-3">&gt;</span>
              <span className="text-[14px] text-white/90 font-sans italic">&quot;beach + foodie, 7 days in bali&quot;</span>
              <span className="inline-block w-[8px] h-[14px] bg-[#4ecdc4] caret ml-2" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <button onClick={() => router.push('/vibes')} className="border border-white/10 rounded px-2 py-2 text-white/50 hover:border-[#c8a44e]/40 hover:text-[#c8a44e] transition-colors">[F1] NEW_TRIP</button>
              <button className="border border-white/10 rounded px-2 py-2 text-white/50 hover:border-[#c8a44e]/40 hover:text-[#c8a44e] transition-colors">[F2] BROWSE_DESTS</button>
              <button className="border border-white/10 rounded px-2 py-2 text-white/50 hover:border-[#c8a44e]/40 hover:text-[#c8a44e] transition-colors">[F3] MY_TRIPS</button>
            </div>
          </div>

          {/* ─── DESTINATIONS GRID (col 1-12, row 3) ─── */}
          <div className="col-span-12 rounded-lg border border-[#4ecdc4]/15 bg-[#05050a] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[9px] tracking-[1px] text-[#4ecdc4]/50">{'// ACTIVE_NODES (58)'}</div>
              <div className="text-[9px] tracking-[1px] text-white/35">DISPLAYING 1-12 · SORT:TRIPS_DESC</div>
            </div>
            <div className="grid grid-cols-12 gap-2 text-[10px]">
              {[
                { n: 'BALI', t: 31, s: 'ONLINE' },
                { n: 'TOKYO', t: 28, s: 'ONLINE' },
                { n: 'DUBAI', t: 25, s: 'ONLINE' },
                { n: 'PHUKET', t: 22, s: 'ONLINE' },
                { n: 'MALDIVES', t: 19, s: 'ONLINE' },
                { n: 'PARIS', t: 18, s: 'ONLINE' },
                { n: 'SINGAPORE', t: 16, s: 'ONLINE' },
                { n: 'BANGKOK', t: 15, s: 'ONLINE' },
                { n: 'GOA', t: 14, s: 'ONLINE' },
                { n: 'JAIPUR', t: 12, s: 'ONLINE' },
                { n: 'MANALI', t: 11, s: 'ONLINE' },
                { n: 'ISTANBUL', t: 9, s: 'ONLINE' },
              ].map(d => (
                <button key={d.n} onClick={() => router.push('/vibes')} className="col-span-3 lg:col-span-2 border border-white/[0.08] rounded px-2 py-2 text-left hover:border-[#c8a44e]/30 hover:bg-[#c8a44e]/[0.03] transition-all">
                  <div className="font-bold text-white/80 truncate">{d.n}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[8px] text-white/40">
                    <span className="text-[#4ecdc4]">●</span>
                    <span className="tabular-nums">{d.t} trips</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
