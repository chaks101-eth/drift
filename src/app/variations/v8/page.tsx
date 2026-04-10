'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import VariationNav from '../VariationNav'

// ─── Interactive Prompt ───────────────────────────────────────
// Hero is a giant input field. Drift composes live as you type.

const PLACEHOLDERS = [
  'a foodie weekend in tokyo…',
  'romantic 5 days in santorini…',
  'bali beach + spiritual for 7 days…',
  'hidden gems in northern thailand…',
  'luxury honeymoon in the maldives…',
]

const SAMPLE_COMPOSITION = [
  { step: '→ parsing: beach + foodie + 7d + delhi', delay: 500 },
  { step: '→ matching: BALI · 0.94 match', delay: 900 },
  { step: '→ flights: DEL→DPS · ₹16,116 · direct', delay: 1300 },
  { step: '→ hotels: 6 verified · Bambu Indah picked', delay: 1700 },
  { step: '→ stops: 21 composed · 12 restaurants', delay: 2100 },
  { step: '✓ trip ready · 28.3s · under budget', delay: 2500 },
]

const SAMPLE_CARDS = [
  { tag: 'STAY', name: 'Bambu Indah', detail: 'Eco-luxury · Ubud', price: '₹14,200', img: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=80' },
  { tag: 'FOOD', name: 'Locavore Ubud', detail: 'Tasting menu', price: '₹6,800', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&q=80' },
  { tag: 'ACT', name: 'Tegallalang', detail: 'Sunrise walk', price: 'Free', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
]

export default function V8Prompt() {
  const router = useRouter()
  const [placeholder, setPlaceholder] = useState('')
  const [phIdx, setPhIdx] = useState(0)
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<string[]>([])
  const [showCards, setShowCards] = useState(false)

  // Cycling typewriter placeholder
  useEffect(() => {
    if (input) return
    const target = PLACEHOLDERS[phIdx]
    let i = 0
    setPlaceholder('')
    const typing = setInterval(() => {
      if (i >= target.length) {
        clearInterval(typing)
        setTimeout(() => setPhIdx(p => (p + 1) % PLACEHOLDERS.length), 2000)
        return
      }
      setPlaceholder(target.slice(0, i + 1))
      i++
    }, 55)
    return () => clearInterval(typing)
  }, [phIdx, input])

  // Auto-compose demo after mount
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    SAMPLE_COMPOSITION.forEach(s => {
      timers.push(setTimeout(() => setSteps(prev => [...prev, s.step]), s.delay + 3500))
    })
    timers.push(setTimeout(() => setShowCards(true), 3500 + 2600))
    return () => timers.forEach(clearTimeout)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/vibes')
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] overflow-x-hidden font-sans">
      <VariationNav current={8} name="Interactive Prompt" />

      {/* Grid background */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />
      <div className="aurora-blob h-[600px] w-[600px] left-1/2 top-1/4 -translate-x-1/2 bg-[#c8a44e]" style={{ opacity: 0.08 }} />

      <div className="relative z-10">
        {/* Top nav */}
        <div className="flex items-center justify-between px-12 py-7">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
            <span className="font-mono text-[9px] tracking-[1.5px] text-white/40">/ v1.0</span>
          </div>
          <button onClick={() => router.push('/trips')} className="font-mono text-[10px] tracking-[1px] text-white/50 hover:text-[#c8a44e] transition-colors">my_trips</button>
        </div>

        {/* Hero */}
        <div className="relative mx-auto max-w-[1080px] px-12 pt-16 pb-20 text-center">
          {/* Eyebrow */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#c8a44e]/20 bg-[#c8a44e]/[0.04] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />
            <span className="font-mono text-[9px] tracking-[1.5px] text-[#c8a44e]/80 uppercase">Live · 200+ trips composed</span>
          </div>

          {/* Headline */}
          <h1 className="font-serif font-light leading-[0.92] tracking-[-0.025em] text-[clamp(48px,6vw,88px)] mb-6">
            Just type it.<br />
            <em className="italic text-[#c8a44e]">Drift will compose it.</em>
          </h1>
          <p className="text-[15px] text-white/55 max-w-[560px] mx-auto leading-[1.7] mb-10">
            Tell Drift how you want your trip to feel — in plain English. Watch a complete itinerary materialize below in thirty seconds.
          </p>

          {/* BIG PROMPT INPUT */}
          <form onSubmit={handleSubmit} className="relative mb-6 max-w-[760px] mx-auto">
            <div className="relative rounded-2xl border border-[#c8a44e]/25 bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-sm p-2 focus-within:border-[#c8a44e]/60 focus-within:shadow-[0_0_60px_rgba(200,164,78,0.15)] transition-all">
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="h-8 w-8 rounded-full bg-[#c8a44e] flex items-center justify-center font-serif italic text-[#08080c] text-sm shrink-0">D</div>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={placeholder || 'type your trip…'}
                  className="flex-1 bg-transparent text-[18px] text-[#f0efe8] focus:outline-none placeholder:text-white/30 font-serif italic"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#c8a44e] px-5 py-3 text-[10px] font-bold tracking-[2px] uppercase text-[#08080c] hover:shadow-[0_8px_24px_rgba(200,164,78,0.3)] transition-all shrink-0"
                >
                  Compose →
                </button>
              </div>
              {/* Keyboard hint */}
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.04] text-[10px] font-mono tracking-[0.5px] text-white/35">
                <span>try: <span className="text-[#c8a44e]/70 italic">&quot;hidden gems in kerala&quot;</span></span>
                <span>press <kbd className="px-1.5 py-0.5 border border-white/10 rounded text-[9px]">enter</kbd> to compose</span>
              </div>
            </div>
          </form>

          {/* Quick suggestions */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-14">
            {['beach + foodie', 'romantic weekend', 'solo backpack', 'luxury honeymoon', 'family adventure'].map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[10px] text-white/55 hover:border-[#c8a44e]/30 hover:text-[#c8a44e] hover:bg-[#c8a44e]/[0.04] transition-all"
              >
                {s}
              </button>
            ))}
          </div>

          {/* LIVE COMPOSE PREVIEW */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c12] overflow-hidden text-left max-w-[860px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-center gap-2 font-mono text-[9px] tracking-[1.5px] text-[#4ecdc4]/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" />
                LIVE_COMPOSE
              </div>
              <div className="font-mono text-[9px] tracking-[1px] text-white/35">watching drift compose a sample trip</div>
            </div>

            {/* Steps */}
            <div className="px-5 py-4 font-mono text-[11px] space-y-1.5 min-h-[180px]">
              {steps.map((s, i) => (
                <div key={i} className={`animate-[fadeIn_0.4s_ease] ${s.startsWith('✓') ? 'text-[#4ecdc4]' : 'text-white/55'}`}>
                  {s}
                </div>
              ))}
              {steps.length < SAMPLE_COMPOSITION.length && (
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_infinite]" />
                  <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_0.2s_infinite]" />
                  <div className="h-1 w-1 rounded-full bg-[#c8a44e]/60 animate-[typing-dot_1.4s_ease-in-out_0.4s_infinite]" />
                </div>
              )}
            </div>

            {/* Cards reveal */}
            {showCards && (
              <div className="border-t border-white/[0.04] px-5 py-5 animate-[fadeUp_0.6s_ease]">
                <div className="font-mono text-[9px] tracking-[1px] text-white/40 mb-3">{'// RESULT · DAY 1 · SAMPLE'}</div>
                <div className="grid grid-cols-3 gap-3">
                  {SAMPLE_CARDS.map((c, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0a0a0f] overflow-hidden">
                      <div className="relative h-[100px]">
                        <Image src={c.img} alt={c.name} fill className="object-cover" sizes="240px" unoptimized />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
                      </div>
                      <div className="p-3">
                        <div className="font-mono text-[8px] text-white/35 tracking-[1px] mb-1">{c.tag}</div>
                        <div className="text-[12px] font-semibold text-white/90 truncate">{c.name}</div>
                        <div className="text-[10px] text-white/40 truncate">{c.detail}</div>
                        <div className="mt-1.5 text-[11px] text-[#c8a44e] tabular-nums">{c.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
