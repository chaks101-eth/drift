'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VariationNav from '../VariationNav'

// ─── Terminal / CLI First ─────────────────────────────────────
// The entire landing IS a command-line interface. You watch Drift
// compose a trip in real-time, then you can run your own.

const SEQUENCE: Array<{ type: 'prompt' | 'output' | 'meta'; text: string; delay?: number }> = [
  { type: 'meta', text: 'drift v1.0.0 · travel composer · © 2026' },
  { type: 'meta', text: 'session initialized · anon_7f3e · delhi, IN' },
  { type: 'meta', text: 'type a prompt or press ? for help' },
  { type: 'prompt', text: 'drift compose "beach + foodie" --days 7 --budget 200k', delay: 2200 },
  { type: 'output', text: '→ parsing intent... vibes[beach, foodie] · duration[7d] · budget[₹200,000]', delay: 900 },
  { type: 'output', text: '→ matching destinations... 12 candidates → 3 finalists → BALI (0.94)', delay: 1100 },
  { type: 'output', text: '→ querying amadeus... 4 direct flights DEL→DPS found', delay: 1400 },
  { type: 'output', text: '→ grounding venues... 847 reviews scanned · 0 hallucinations detected', delay: 1600 },
  { type: 'output', text: '→ composing itinerary... 21 stops · 6 hotels · 12 restaurants · 9 experiences', delay: 1300 },
  { type: 'output', text: '✓ trip composed in 28.3s · budget: ₹186,450 / ₹200,000 (93%)', delay: 1000 },
  { type: 'meta', text: '' },
  { type: 'meta', text: 'view board → driftntravel.com/trip/bali-7-days' },
]

export default function V1Terminal() {
  const router = useRouter()
  const [lines, setLines] = useState<typeof SEQUENCE>([])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')

  useEffect(() => {
    let i = 0
    const next = () => {
      if (i >= SEQUENCE.length) return
      const line = SEQUENCE[i]
      setLines(prev => [...prev, line])
      i++
      setTimeout(next, line.delay || 600)
    }
    setTimeout(next, 600)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setTyping(true)
    setTimeout(() => router.push('/vibes'), 400)
  }

  return (
    <div className="min-h-screen bg-[#050509] text-[#4ecdc4] font-mono overflow-x-hidden">
      <VariationNav current={1} name="Terminal / CLI First" />

      {/* CRT scanlines */}
      <div className="pointer-events-none fixed inset-0 opacity-30"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(78,205,196,0.04) 0px, rgba(78,205,196,0.04) 1px, transparent 1px, transparent 3px)' }}
      />
      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 bg-radial-gradient"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)' }}
      />

      <div className="relative min-h-screen flex items-center justify-center p-8 pt-24">
        <div className="w-full max-w-[960px]">
          {/* Window chrome */}
          <div className="rounded-lg border border-[#4ecdc4]/20 bg-[#02020580] backdrop-blur-sm overflow-hidden shadow-[0_0_80px_rgba(78,205,196,0.1)]">
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#4ecdc4]/[0.04] border-b border-[#4ecdc4]/15">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
              </div>
              <div className="text-[10px] text-[#4ecdc4]/50 tracking-[1px]">drift@composer:~ — tty0</div>
              <div className="text-[10px] text-[#4ecdc4]/50 tabular-nums">{new Date().toTimeString().slice(0, 5)}</div>
            </div>

            {/* Terminal body */}
            <div className="p-8 min-h-[560px] font-mono text-[13px] leading-[1.9]">
              {/* Drift ASCII logo */}
              <pre className="text-[#c8a44e] text-[9px] leading-[1.1] mb-6 opacity-80">
{`  ╔═══════════════════════════════╗
  ║    D R I F T · composer       ║
  ║  travel at sentence speed     ║
  ╚═══════════════════════════════╝`}
              </pre>

              {lines.map((line, i) => (
                <div key={i} className="animate-[fadeIn_0.3s_ease]">
                  {line.type === 'meta' && (
                    <div className="text-[#4ecdc4]/40">{line.text || '\u00A0'}</div>
                  )}
                  {line.type === 'prompt' && (
                    <div>
                      <span className="text-[#c8a44e]">drift@composer</span>
                      <span className="text-[#4ecdc4]/40">:</span>
                      <span className="text-[#a880ff]">~</span>
                      <span className="text-[#4ecdc4]/40">$ </span>
                      <span className="text-[#f0efe8]">{line.text}</span>
                    </div>
                  )}
                  {line.type === 'output' && (
                    <div className="text-[#4ecdc4]/80 pl-0">{line.text}</div>
                  )}
                </div>
              ))}

              {/* Input prompt */}
              <form onSubmit={handleSubmit} className="mt-4 flex items-center">
                <span className="text-[#c8a44e]">drift@composer</span>
                <span className="text-[#4ecdc4]/40">:</span>
                <span className="text-[#a880ff]">~</span>
                <span className="text-[#4ecdc4]/40">$&nbsp;</span>
                <input
                  autoFocus
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={typing}
                  placeholder="type your vibe..."
                  className="flex-1 bg-transparent text-[#f0efe8] focus:outline-none placeholder:text-[#4ecdc4]/25"
                />
                <span className="inline-block w-[10px] h-[15px] bg-[#4ecdc4] caret ml-1" />
              </form>

              {/* Hint */}
              <div className="mt-8 text-[11px] text-[#4ecdc4]/40 border-t border-[#4ecdc4]/10 pt-4">
                <span className="text-[#c8a44e]/60">hint:</span> press <kbd className="px-1.5 py-0.5 border border-[#4ecdc4]/20 rounded text-[9px]">enter</kbd> to run · or try <span className="text-[#a880ff]/70">&quot;romantic weekend in paris&quot;</span>
              </div>
            </div>
          </div>

          {/* Footer telemetry */}
          <div className="mt-4 flex items-center justify-between text-[9px] text-[#4ecdc4]/40 tracking-[1px] px-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#4ecdc4] live-dot" /> CONNECTED</span>
              <span>LATENCY 12ms</span>
              <span>SESSION ANON_7F3E</span>
            </div>
            <div>{'// DRIFT.V1.0.0'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
