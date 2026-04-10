'use client'

import { useRouter } from 'next/navigation'
import VariationNav from '../VariationNav'

// ─── Brutalist Swiss ──────────────────────────────────────────
// Massive serif type. Grid lines visible. Black, gold, white only.
// Inspired by Pentagram / Stripe Press / fashion house manifestos.

export default function V4Brutalist() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] overflow-x-hidden font-sans relative">
      <VariationNav current={4} name="Brutalist Swiss" />

      {/* Grid overlay (12 columns, visible hairlines) */}
      <div className="pointer-events-none fixed inset-0 max-w-[1400px] mx-auto">
        <div className="relative h-full grid grid-cols-12 gap-0">
          {Array.from({ length: 13 }).map((_, i) => (
            <div key={i} className="border-l border-white/[0.025] h-full" />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        {/* Top rail */}
        <div className="border-b border-white/[0.08] px-8 py-5 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <span className="font-serif text-[28px] italic text-[#c8a44e] leading-none">Drift</span>
            <span className="font-mono text-[9px] tracking-[2px] text-white/40 uppercase">Vol. 01 — No. 2026</span>
          </div>
          <div className="font-mono text-[9px] tracking-[2px] text-white/40 uppercase flex items-center gap-6">
            <span>◆ New Delhi, IN</span>
            <span>{new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <button onClick={() => router.push('/trips')} className="hover:text-[#c8a44e] transition-colors">Subscribers ↗</button>
          </div>
        </div>

        {/* Section header number */}
        <div className="border-b border-white/[0.08] px-8 py-3">
          <div className="font-mono text-[10px] tracking-[2px] text-[#c8a44e]/70 uppercase flex justify-between">
            <span>§ 01 — The Manifesto</span>
            <span className="text-white/30">01 / 04</span>
          </div>
        </div>

        {/* MAIN HERO */}
        <div className="px-8 py-24 lg:py-32">
          {/* Asymmetric grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Massive headline — cols 1-10 */}
            <div className="col-span-12 lg:col-span-11">
              <h1 className="font-serif font-light leading-[0.84] tracking-[-0.04em] text-[clamp(72px,12vw,220px)]">
                Travel,<br />
                <span className="italic text-[#c8a44e]">composed.</span>
              </h1>
            </div>

            {/* Ampersand / accent — col 11-12 */}
            <div className="col-span-12 lg:col-span-1 flex items-start pt-8">
              <div className="font-serif text-[80px] italic text-[#c8a44e]/25">&amp;</div>
            </div>
          </div>

          {/* Sub-grid: footnote + lead */}
          <div className="mt-16 grid grid-cols-12 gap-6">
            {/* Footnote left */}
            <div className="col-span-12 lg:col-span-3 border-l border-white/20 pl-5">
              <div className="font-mono text-[9px] tracking-[1.5px] text-white/40 uppercase mb-3">¶ Footnote</div>
              <p className="text-[11px] text-white/50 leading-[1.7] italic">
                We refuse the spreadsheet. We refuse the twelve open tabs. We refuse the form fields. You will tell us how you want to feel, and we will tell you where to go.
              </p>
            </div>

            {/* Large lead right */}
            <div className="col-span-12 lg:col-span-7 lg:col-start-5">
              <p className="font-serif text-[clamp(18px,2vw,26px)] font-light leading-[1.5] text-white/75 mb-10">
                Drift reads your vibe, queries real data, and composes a trip you&apos;d actually book — in less than thirty seconds. No filters. No forms. No lies.
              </p>

              <div className="flex items-center gap-8">
                <button
                  onClick={() => router.push('/vibes')}
                  className="group relative"
                >
                  <div className="flex items-center gap-6 border-t border-b border-[#c8a44e]/40 py-4 pr-12 pl-6 transition-all hover:bg-[#c8a44e]/[0.03] hover:border-[#c8a44e]">
                    <span className="font-mono text-[10px] tracking-[3px] uppercase text-[#c8a44e]">§ Begin</span>
                    <span className="font-serif text-[22px] italic text-[#f0efe8]">a new trip</span>
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 transition-transform group-hover:translate-x-1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                <div className="font-mono text-[10px] tracking-[1.5px] text-white/40 uppercase">
                  No card.<br />No login.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats block — three massive numbers */}
        <div className="border-y border-white/[0.08] px-8 py-16">
          <div className="grid grid-cols-3 gap-12 max-md:grid-cols-1">
            {[
              { n: '200', s: '+', l: 'Trips composed since launch', ref: 'I.' },
              { n: '58', s: '', l: 'Destinations handverified', ref: 'II.' },
              { n: '00', s: '', l: 'Hallucinations, to date', ref: 'III.' },
            ].map(s => (
              <div key={s.n} className="border-l border-white/10 pl-6">
                <div className="font-mono text-[9px] tracking-[2px] text-[#c8a44e]/60 uppercase mb-4">§ {s.ref}</div>
                <div className="font-serif text-[clamp(80px,11vw,160px)] font-light leading-[0.82] tracking-[-0.04em] text-[#f0efe8]">
                  {s.n}<span className="text-[#c8a44e]">{s.s}</span>
                </div>
                <div className="font-mono text-[10px] tracking-[1.5px] text-white/50 uppercase mt-3 max-w-[260px]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Colophon */}
        <div className="px-8 py-10">
          <div className="grid grid-cols-12 gap-6 font-mono text-[9px] tracking-[1.5px] text-white/35 uppercase">
            <div className="col-span-12 lg:col-span-3 border-t border-white/10 pt-3">
              Designed in<br />
              <span className="text-white/60">New Delhi, India</span>
            </div>
            <div className="col-span-12 lg:col-span-3 border-t border-white/10 pt-3">
              Set in<br />
              <span className="text-white/60">Playfair Display &amp; Inter</span>
            </div>
            <div className="col-span-12 lg:col-span-3 border-t border-white/10 pt-3">
              Composed by<br />
              <span className="text-white/60">Gemini 2.5 Flash</span>
            </div>
            <div className="col-span-12 lg:col-span-3 border-t border-white/10 pt-3">
              © MMXXVI<br />
              <span className="text-[#c8a44e]">Drift — All rights reserved</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
