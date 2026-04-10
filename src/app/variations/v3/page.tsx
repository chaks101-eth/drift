'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import VariationNav from '../VariationNav'

// ─── Split Asymmetric ─────────────────────────────────────────
// 50/50: left is typographic hero, right is live scrolling feed of trip fragments.

const FEED = [
  { type: 'prompt', content: '"beach chill + foodie in bali"', meta: 'sarah · 12s ago' },
  { type: 'compose', content: 'Day 1 · Arrive Denpasar', sub: 'Bambu Indah check-in · ₹14,200/night', img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=80' },
  { type: 'swap', content: 'Swapped Warung Babi Guling → Locavore', meta: '0.4km closer · ₹200 saved' },
  { type: 'compose', content: 'Day 2 · Ubud monkey forest', sub: 'sunrise entry · skip crowds · free', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { type: 'prompt', content: '"7 days tokyo foodie"', meta: 'alex · 45s ago' },
  { type: 'compose', content: 'Day 1 · Tsukiji Outer Market', sub: 'sushi dai · 5:30am arrival · ₹2,800', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { type: 'swap', content: 'Swapped Park Hyatt → Hoshinoya Tokyo', meta: 'onsen access · ₹4k more' },
  { type: 'compose', content: 'Day 3 · Omoide Yokocho', sub: 'yakitori alley · 7pm · ₹1,500', img: 'https://images.unsplash.com/photo-1554797589-7241bb691973?w=400&q=80' },
  { type: 'prompt', content: '"luxury maldives romance 5 days"', meta: 'priya · 2m ago' },
  { type: 'compose', content: 'Soneva Fushi · overwater villa', sub: 'private butler · ₹42,000/night', img: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },
]

export default function V3Split() {
  const router = useRouter()
  const [visible, setVisible] = useState(1)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(v => Math.min(FEED.length, v + 1))
    }, 900)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] overflow-x-hidden font-sans">
      <VariationNav current={3} name="Split Asymmetric" />

      {/* Background grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(200,164,78,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(200,164,78,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }}
      />

      <div className="relative min-h-screen grid grid-cols-[1.1fr_1fr] max-lg:grid-cols-1 max-lg:grid-rows-[auto_1fr]">
        {/* ───────── LEFT: Typographic hero ───────── */}
        <div className="relative flex flex-col justify-between p-12 lg:p-16 min-h-screen max-lg:min-h-[70vh]">
          {/* Top nav */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
              <span className="font-mono text-[9px] tracking-[1.5px] text-white/40">/ 2026</span>
            </div>
            <div className="font-mono text-[9px] tracking-[1px] text-white/40">
              <div>DEL → 000</div>
              <div>93% · ₹186K/₹200K</div>
            </div>
          </div>

          {/* Middle — big headline */}
          <div className="py-16">
            <div className="font-mono text-[10px] tracking-[1.5px] text-[#c8a44e]/70 mb-8">
              {'// CHAPTER 01 / A NEW KIND OF TRAVEL PLANNER'}
            </div>
            <h1 className="font-serif text-[clamp(56px,8vw,140px)] font-light leading-[0.88] tracking-[-0.035em] mb-8">
              Travel<br />
              <span className="italic text-[#c8a44e]">composed</span><br />
              <span className="text-white/45">not searched.</span>
            </h1>
            <p className="text-[15px] text-white/55 max-w-[460px] leading-[1.75] mb-10">
              A language model with taste, a booking engine with receipts, and a chat that actually changes things. Tell Drift how you want to feel — get a complete trip back.
            </p>

            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push('/vibes')}
                className="group rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all"
              >
                Compose →
              </button>
              <button className="font-mono text-[10px] tracking-[0.5px] text-white/55 hover:text-[#c8a44e] transition-colors">
                read_more
              </button>
            </div>
          </div>

          {/* Bottom — metadata */}
          <div className="grid grid-cols-3 gap-6 border-t border-white/[0.06] pt-6">
            {[
              { l: 'TRIPS', v: '200+' },
              { l: 'NODES', v: '58' },
              { l: 'HALLUCINATIONS', v: '0' },
            ].map(s => (
              <div key={s.l}>
                <div className="font-serif text-[32px] font-light text-[#c8a44e] leading-none">{s.v}</div>
                <div className="font-mono text-[9px] tracking-[1px] text-white/40 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ───────── RIGHT: Live feed ───────── */}
        <div className="relative border-l border-white/[0.06] bg-[#06060a] overflow-hidden max-lg:border-l-0 max-lg:border-t">
          {/* Feed header */}
          <div className="sticky top-0 z-10 bg-[#06060a]/90 backdrop-blur-md border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />
              <span className="font-mono text-[10px] tracking-[1px] text-[#4ecdc4]/80">LIVE_COMPOSE_FEED</span>
            </div>
            <div className="font-mono text-[9px] tracking-[1px] text-white/35">watching · 847 users</div>
          </div>

          {/* Feed items */}
          <div className="p-6 space-y-4 max-h-screen overflow-y-auto scrollbar-hide">
            {FEED.slice(0, visible).map((item, i) => (
              <div key={i} className="animate-[fadeUp_0.5s_ease]">
                {item.type === 'prompt' && (
                  <div className="rounded-xl border border-[#c8a44e]/15 bg-[#c8a44e]/[0.04] p-4">
                    <div className="font-mono text-[9px] tracking-[1px] text-[#c8a44e]/60 mb-1">→ PROMPT</div>
                    <div className="font-serif italic text-[16px] text-white/90">{item.content}</div>
                    <div className="mt-1 font-mono text-[9px] text-white/35">{item.meta}</div>
                  </div>
                )}
                {item.type === 'compose' && (
                  <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
                    {item.img && (
                      <div className="relative h-[70px] w-[90px] shrink-0 rounded-lg overflow-hidden">
                        <Image src={item.img} alt="" fill className="object-cover" sizes="90px" unoptimized />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[9px] tracking-[1px] text-[#4ecdc4]/70 mb-1">→ COMPOSED</div>
                      <div className="text-[13px] text-white/90 font-medium truncate">{item.content}</div>
                      <div className="text-[11px] text-white/45 mt-0.5 truncate">{item.sub}</div>
                    </div>
                  </div>
                )}
                {item.type === 'swap' && (
                  <div className="flex items-start gap-2.5 pl-3 border-l-2 border-[#a880ff]/30">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a880ff" strokeWidth="2" className="mt-0.5 opacity-70"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
                    <div>
                      <div className="text-[12px] text-white/80">{item.content}</div>
                      <div className="text-[10px] text-white/35 mt-0.5">{item.meta}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Typing indicator */}
            <div className="flex items-center gap-2 text-white/30 font-mono text-[10px] tracking-[1px] pl-2">
              <div className="flex gap-1">
                <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_infinite]" />
                <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite]" />
                <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite]" />
              </div>
              NEXT_COMPOSE
            </div>
          </div>

          {/* Feed fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06060a] to-transparent" />
        </div>
      </div>
    </div>
  )
}
