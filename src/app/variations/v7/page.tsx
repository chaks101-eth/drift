'use client'

import { useRouter } from 'next/navigation'
import VariationNav from '../VariationNav'

// ─── Synthwave Horizon ────────────────────────────────────────
// Cyberpunk sunset. Laser grid floor. Neon gradients.
// 1984 retrofuture. Purple + cyan + pink.

export default function V7Synthwave() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0612] text-[#f0efe8] overflow-x-hidden font-sans relative">
      <VariationNav current={7} name="Synthwave Horizon" />

      {/* Sky gradient */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, #0a0612 0%, #1a0628 40%, #3d0f4a 65%, #6b1f5e 85%, #ff3d7f 100%)' }}
      />

      {/* Stars */}
      <div className="fixed inset-0 starfield pointer-events-none" />

      {/* Sun */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[35%] w-[300px] h-[300px] rounded-full synthwave-sun"
        style={{
          background: 'linear-gradient(180deg, #ffeb6c 0%, #ff8c42 40%, #ff3d7f 70%, #8a4fff 100%)',
          maskImage: 'linear-gradient(180deg, black 0%, black 50%, transparent 52%, black 54%, transparent 56%, black 58%, transparent 60%, black 64%, transparent 68%, black 74%, transparent 82%, black 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 50%, transparent 52%, black 54%, transparent 56%, black 58%, transparent 60%, black 64%, transparent 68%, black 74%, transparent 82%, black 100%)',
        }}
      />

      {/* Laser grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[55vh] synth-grid" />

      {/* Horizon line with glow */}
      <div className="absolute left-0 right-0 h-[2px] top-[58vh]"
        style={{ background: 'linear-gradient(90deg, transparent, #ff3d7f 20%, #ffffff 50%, #8a4fff 80%, transparent)', boxShadow: '0 0 40px #ff3d7f, 0 0 80px #8a4fff' }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Top nav */}
        <div className="flex items-center justify-between px-12 py-7 max-lg:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-[28px] italic font-normal" style={{ color: '#ffeb6c', textShadow: '0 0 20px #ff3d7f, 0 0 40px #8a4fff' }}>Drift</span>
            <span className="font-mono text-[9px] tracking-[2px] text-[#ffeb6c]/60">{'// 1984.MODE'}</span>
          </div>
          <nav className="flex items-center gap-8 font-mono text-[10px] tracking-[1px] uppercase">
            {['trips', 'nodes', 'about'].map(l => (
              <button key={l} className="text-[#ffeb6c]/70 hover:text-[#ff6b9e] transition-colors glitch-hover">{l}</button>
            ))}
          </nav>
        </div>

        {/* Hero */}
        <div className="relative px-12 pt-16 pb-8 max-lg:px-6 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 rounded-full border border-[#ff6b9e]/40 bg-black/40 backdrop-blur-sm px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffeb6c] live-dot" style={{ boxShadow: '0 0 10px #ffeb6c' }} />
            <span className="font-mono text-[9px] tracking-[2px] text-[#ffeb6c] uppercase">System Online · 200+ Trips</span>
          </div>

          {/* Headline with layered neon effect */}
          <h1 className="font-serif font-light leading-[0.9] tracking-[-0.03em] text-[clamp(56px,10vw,160px)] mb-6 relative">
            <span className="block" style={{ color: '#ffeb6c', textShadow: '0 0 15px #ff6b9e, 0 0 40px #8a4fff, 0 0 80px #ff3d7f' }}>
              Drive into
            </span>
            <span className="block italic" style={{ color: '#ff6b9e', textShadow: '0 0 20px #ff6b9e, 0 0 60px #8a4fff' }}>
              the horizon.
            </span>
          </h1>

          <p className="text-[15px] max-w-[560px] mx-auto mb-10 leading-[1.7]" style={{ color: 'rgba(255, 235, 108, 0.75)' }}>
            Tell the composer where you want to go. Watch a complete trip materialize in thirty seconds of pure neon. No forms. No spreadsheets. Just vibes.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/vibes')}
              className="group relative overflow-hidden rounded-full px-9 py-4 text-[11px] font-bold tracking-[2.5px] uppercase transition-all"
              style={{
                background: 'linear-gradient(90deg, #ff6b9e, #8a4fff)',
                color: '#0a0612',
                boxShadow: '0 0 30px rgba(255, 107, 158, 0.5), 0 0 60px rgba(138, 79, 255, 0.3)',
              }}
            >
              <span className="relative z-10 flex items-center gap-3">
                Compose_Trip
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </span>
            </button>

            <button className="rounded-full border border-[#ffeb6c]/50 bg-black/30 backdrop-blur-sm px-6 py-4 font-mono text-[10px] tracking-[1px] text-[#ffeb6c] uppercase hover:bg-[#ffeb6c]/10 transition-colors">
              view_demo ▶
            </button>
          </div>
        </div>

        {/* Marquee strip */}
        <div className="absolute bottom-4 left-0 right-0 border-y border-[#ff6b9e]/30 bg-black/40 backdrop-blur-sm overflow-hidden py-3">
          <div className="flex animate-[marquee_30s_linear_infinite] whitespace-nowrap">
            {[...Array(2)].map((_, k) => (
              <div key={k} className="flex shrink-0 items-center gap-10 px-6">
                {[
                  { v: '200+', l: 'TRIPS' },
                  { v: '58', l: 'NODES' },
                  { v: '∞', l: 'HORIZON' },
                  { v: '0', l: 'HALLUCINATIONS' },
                  { v: '28.3s', l: 'AVG.COMPOSE' },
                  { v: '4K', l: 'REVIEWS' },
                ].map((s, i) => (
                  <div key={`${k}-${i}`} className="flex items-baseline gap-3">
                    <span className="font-serif text-[24px] italic" style={{ color: '#ffeb6c', textShadow: '0 0 8px #ff6b9e' }}>{s.v}</span>
                    <span className="font-mono text-[9px] tracking-[2px] text-[#ff6b9e]/80 uppercase">{s.l}</span>
                    <span className="text-[#8a4fff]/60 ml-6">◆</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
