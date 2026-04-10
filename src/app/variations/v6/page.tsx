'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import VariationNav from '../VariationNav'

// ─── Editorial Cover ──────────────────────────────────────────
// Treats Drift like a premium travel magazine. Cover photo,
// issue number, bylines, pull quotes.

export default function V6Editorial() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0efe8] overflow-x-hidden font-sans">
      <VariationNav current={6} name="Editorial Cover" />

      {/* Grain overlay */}
      <div className="pointer-events-none fixed inset-0 noise-grain" />

      <div className="relative">
        {/* Masthead */}
        <div className="border-b-2 border-[#c8a44e] px-8 py-5 flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[2px] text-[#c8a44e] uppercase">Vol. I · No. 01 · MMXXVI</div>
          <div className="font-serif text-[52px] italic text-[#c8a44e] leading-none">Drift</div>
          <div className="font-mono text-[10px] tracking-[2px] text-[#c8a44e] uppercase text-right">
            ₹0.00<br />
            <span className="text-[8px] text-[#c8a44e]/50">Free forever</span>
          </div>
        </div>

        {/* Cover hero */}
        <div className="relative min-h-[680px] overflow-hidden">
          <Image
            src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=2400&q=90"
            alt=""
            fill
            priority
            className="object-cover scale-105"
            sizes="100vw"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />

          {/* Left content */}
          <div className="relative z-10 grid grid-cols-12 gap-6 px-8 pt-20 pb-16">
            <div className="col-span-12 lg:col-span-8">
              {/* Feature tag */}
              <div className="mb-6 inline-flex items-center gap-3">
                <div className="h-px w-8 bg-[#c8a44e]" />
                <span className="font-mono text-[10px] font-semibold tracking-[2.5px] text-[#c8a44e] uppercase">The Feature</span>
              </div>

              {/* Title */}
              <h1 className="font-serif font-light leading-[0.9] tracking-[-0.03em] text-[clamp(56px,9vw,140px)] mb-6">
                The end of<br />
                <em className="italic text-[#c8a44e]">planning.</em>
              </h1>

              {/* Kicker */}
              <p className="font-serif italic text-[clamp(16px,2vw,22px)] text-white/75 max-w-[560px] leading-[1.5] mb-8">
                How a language model with taste is quietly replacing every travel spreadsheet, forum, and form you&apos;ve ever filled out.
              </p>

              {/* Byline */}
              <div className="flex items-center gap-4 text-[10px] font-mono tracking-[1.5px] text-[#c8a44e]/80 uppercase">
                <span>By Drift</span>
                <span className="text-white/30">·</span>
                <span>200+ trips composed</span>
                <span className="text-white/30">·</span>
                <span>8 min read</span>
              </div>
            </div>
          </div>

          {/* Table of contents — bottom right */}
          <div className="absolute bottom-8 right-8 z-10 max-lg:hidden">
            <div className="rounded-lg border border-white/[0.08] bg-black/40 backdrop-blur-md p-5 w-[260px]">
              <div className="font-mono text-[9px] tracking-[2px] text-[#c8a44e]/70 uppercase mb-3">In This Issue</div>
              <div className="space-y-2 text-[11px] font-serif">
                {[
                  { n: 'I.', t: 'The Manifesto', p: '04' },
                  { n: 'II.', t: 'A Composed Trip', p: '12' },
                  { n: 'III.', t: 'Dispatches, Verified', p: '24' },
                  { n: 'IV.', t: 'Postcards from 58 Nodes', p: '36' },
                ].map(i => (
                  <div key={i.n} className="flex items-baseline gap-3 text-white/70 hover:text-[#c8a44e] transition-colors cursor-pointer">
                    <span className="text-[#c8a44e]/60 italic text-[10px]">{i.n}</span>
                    <span className="flex-1 border-b border-dotted border-white/10 pb-0.5 truncate">{i.t}</span>
                    <span className="font-mono text-[9px] text-white/40">{i.p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quote section */}
        <div className="border-y border-white/[0.08] px-8 py-16">
          <div className="mx-auto max-w-[900px]">
            <div className="font-serif text-[120px] italic leading-[0] text-[#c8a44e]/50 h-16">&ldquo;</div>
            <blockquote className="font-serif italic text-[clamp(26px,3vw,42px)] font-light leading-[1.35] text-[#f0efe8] -mt-4">
              I asked for <span className="text-[#c8a44e]">romantic + foodie + beach</span>, and thirty seconds later I had a seven-day trip to Santorini with real hotel prices, restaurant bookings, and a sunset spot for day three.
            </blockquote>
            <div className="mt-6 font-mono text-[10px] tracking-[1.5px] text-[#c8a44e]/70 uppercase">
              — A subscriber, on their first composed trip
            </div>
          </div>
        </div>

        {/* Editor's letter section */}
        <div className="px-8 py-20 mx-auto max-w-[1080px]">
          <div className="grid grid-cols-12 gap-8">
            {/* Sidebar */}
            <div className="col-span-12 lg:col-span-3">
              <div className="sticky top-24">
                <div className="font-mono text-[9px] tracking-[2px] text-[#c8a44e]/70 uppercase mb-3">§ Editor&apos;s Letter</div>
                <div className="font-serif italic text-[22px] text-[#f0efe8] mb-2">Dear reader,</div>
                <div className="font-mono text-[9px] tracking-[1px] text-white/40 uppercase">From New Delhi</div>
              </div>
            </div>

            {/* Body columns */}
            <div className="col-span-12 lg:col-span-9">
              <div className="columns-1 lg:columns-2 gap-10 text-[14px] leading-[1.85] text-white/70 font-serif">
                <p className="mb-5">
                  <span className="font-serif text-[52px] italic text-[#c8a44e] float-left leading-[0.85] mr-2 mt-1">T</span>
                  ravel planning has been broken for a long time. Twelve tabs, a spreadsheet, four hours of research, and you still aren&apos;t sure the hotel is any good. Then someone asks &ldquo;what about Ubud?&rdquo; and you start over.
                </p>
                <p className="mb-5">
                  We built Drift because we were tired of that loop. Tell Drift how you want to feel — beach, foodie, romance, adventure — and it composes a complete trip from real flights, real hotels, and places locals actually love.
                </p>
                <p className="mb-5">
                  Every recommendation shows its reasoning. Every price comes from a live API. Every alternative is one tap away. Don&apos;t like a hotel? Swap it. The trip adjusts.
                </p>
                <p className="mb-5">
                  This is not another trip planner. This is what travel planning looks like when a language model has taste and a booking engine has receipts.
                </p>
                <p>
                  We hope you enjoy your first composition.
                </p>
                <div className="mt-6 font-serif italic text-[18px] text-[#c8a44e]">— Drift</div>
              </div>

              {/* CTA */}
              <div className="mt-12 pt-8 border-t border-white/[0.08] flex items-center gap-5">
                <button
                  onClick={() => router.push('/vibes')}
                  className="rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all"
                >
                  Read the full issue →
                </button>
                <div className="font-mono text-[9px] tracking-[1px] text-white/40 uppercase">
                  Compose your first trip<br />
                  <span className="text-white/25">~30 seconds</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer masthead */}
        <div className="border-t-2 border-[#c8a44e] px-8 py-5 flex items-center justify-between font-mono text-[9px] tracking-[2px] text-[#c8a44e]/70 uppercase">
          <span>© MMXXVI — Drift Publishing</span>
          <span>A Quarterly</span>
          <span>Printed Digitally in New Delhi</span>
        </div>
      </div>
    </div>
  )
}
