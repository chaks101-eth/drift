'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function Landing() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // On mobile, redirect to React mobile app
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = '/m'
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/vibes')
      else setReady(true)
    })
  }, [router])

  // Scroll reveal
  useEffect(() => {
    if (!ready) return
    const els = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.15 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [ready])

  if (!ready) return <div className="min-h-screen bg-[#08080c]" />

  return (
    <div className="min-h-screen bg-[#08080c] overflow-x-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 25% 45%, rgba(200,164,78,0.07) 0%, transparent 55%), radial-gradient(ellipse at 75% 55%, rgba(78,130,200,0.04) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(200,78,130,0.03) 0%, transparent 45%)' }}
      />

      {/* Particles */}
      <Particles />

      {/* ─── HERO ─── */}
      <section className="relative z-[2] min-h-screen flex items-center justify-center flex-col text-center px-6">
        <h1 className="font-serif text-[clamp(52px,11vw,130px)] font-normal leading-[1.05] mb-3 opacity-0 animate-[fadeUp_1s_ease_forwards_0.2s]">
          Just <em className="text-[#c8a44e] italic">Drift.</em>
        </h1>
        <p className="text-[clamp(14px,2vw,18px)] text-[#7a7a85] font-light max-w-[540px] leading-relaxed mb-9 opacity-0 animate-[fadeUp_1s_ease_forwards_0.5s]">
          Tell us your <strong className="text-[#f0efe8] font-medium">vibe</strong>, your <strong className="text-[#f0efe8] font-medium">budget</strong>, your <strong className="text-[#f0efe8] font-medium">dates</strong>. Our AI builds a trip you&apos;d actually book — with real flights, real hotels, and reasons behind every pick.
        </p>
        <div className="flex gap-3 justify-center items-center opacity-0 animate-[fadeUp_1s_ease_forwards_0.8s] landing-btns-responsive">
          <button
            onClick={() => router.push('/login')}
            className="px-11 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(200,164,78,0.3),0_4px_12px_rgba(200,164,78,0.15)] transition-all duration-400 active:translate-y-0 active:scale-[0.97] flex items-center gap-2.5"
          >
            Plan My Trip
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => router.push('/login?surprise=1')}
            className="px-8 py-3.5 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[#f0efe8] text-sm font-medium rounded-full hover:border-[#c8a44e] hover:text-[#c8a44e] transition-all active:scale-[0.97]"
          >
            Surprise Me
          </button>
        </div>

        {/* Social proof */}
        <div className="mt-12 flex items-center gap-5 opacity-0 animate-[fadeUp_1s_ease_forwards_1.1s] max-md:flex-col max-md:gap-2.5">
          <p className="text-xs text-[#4a4a55] leading-relaxed text-center">
            <strong className="text-[#7a7a85]">Early access</strong> — limited spots. Real flights. Real hotels. Real AI.<br />No credit card required.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 animate-[fadeUp_1s_ease_forwards_1.4s]">
          <div className="w-px h-8 bg-gradient-to-b from-[#c8a44e] to-transparent mx-auto mb-1.5" />
          <span className="text-[9px] tracking-[3px] uppercase text-[#4a4a55]">See how it works</span>
        </div>
      </section>

      {/* ─── PRODUCT PREVIEW ─── */}
      <section className="relative z-[2] max-w-[1100px] mx-auto px-8 py-24 max-md:px-4 max-md:py-16 reveal">
        <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-2.5">Your trip, visualized</p>
        <h2 className="font-serif text-[clamp(26px,4vw,40px)] font-normal leading-[1.25] mb-2.5 max-md:text-[clamp(22px,6vw,32px)]">
          A flowchart, not a <em className="text-[#c8a44e] italic">spreadsheet</em>
        </h2>
        <p className="text-[15px] text-[#7a7a85] leading-[1.7] max-w-[520px] mb-9 max-md:text-[13px]">
          Every flight, hotel, activity, and meal — connected in a visual board. Tap to swap. Ask AI to adjust. Your trip is alive, not static.
        </p>
        <ProductMockup />
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative z-[2] max-w-[1100px] mx-auto px-8 pt-10 pb-24 max-md:px-4 max-md:py-16 reveal">
        <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-2.5">How it works</p>
        <h2 className="font-serif text-[clamp(26px,4vw,40px)] font-normal leading-[1.25] mb-8 max-md:text-[clamp(22px,6vw,32px)]">
          Three steps. <em className="text-[#c8a44e] italic">No planning headaches.</em>
        </h2>
        <div className="grid grid-cols-3 gap-8 l-steps-responsive max-md:grid-cols-1 max-md:gap-3">
          {[
            { num: '1', title: 'Pick your vibe', desc: 'Beach chill? Culture deep dive? Foodie trail? Select up to 3 moods. Set budget and dates.' },
            { num: '2', title: 'AI builds your trip', desc: 'Real flights, vetted hotels, crowd-optimized timings. Every pick comes with a reason you can see.' },
            { num: '3', title: 'Make it yours', desc: "Swap anything with one tap. Ask AI to adjust. Share with friends. Book when you're ready." },
          ].map(s => (
            <div key={s.num} className="text-center p-7 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] transition-all duration-400 hover:border-[rgba(200,164,78,0.12)] hover:bg-[rgba(200,164,78,0.03)] max-md:p-5">
              <div className="w-9 h-9 rounded-full border border-[rgba(200,164,78,0.25)] bg-[rgba(200,164,78,0.06)] flex items-center justify-center text-sm text-[#c8a44e] font-semibold mx-auto mb-3.5 font-serif">{s.num}</div>
              <div className="text-sm font-semibold mb-1.5">{s.title}</div>
              <div className="text-xs text-[#4a4a55] leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── WHY DRIFT ─── */}
      <section className="relative z-[2] max-w-[1100px] mx-auto px-8 pt-10 pb-24 max-md:px-4 max-md:py-16 reveal">
        <p className="text-[10px] tracking-[4px] uppercase text-[#c8a44e] font-semibold mb-2.5">Why Drift</p>
        <h2 className="font-serif text-[clamp(26px,4vw,40px)] font-normal leading-[1.25] mb-8 max-md:text-[clamp(22px,6vw,32px)]">
          Built different, <em className="text-[#c8a44e] italic">on purpose</em>
        </h2>
        <div className="grid grid-cols-2 gap-4 l-diffs-responsive max-md:grid-cols-1 max-md:gap-2.5">
          {[
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
              title: 'AI that explains itself',
              desc: 'Every recommendation shows why it was picked. Price-to-comfort ratio. Crowd timing. Vibe alignment. No black boxes.',
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
              title: 'Real data, not guesses',
              desc: "Live flight prices from Amadeus. Hotel ratings from 2M+ reviews. Not some LLM making up numbers.",
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
              title: "Swap, don't start over",
              desc: "Don't like a hotel? Tap alternatives, see trust badges, swap in one click. The cost bar updates live.",
            },
            {
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
              title: 'Vibes, not filters',
              desc: 'You don\'t search by star rating. You say "romantic + foodie + beach" and Drift gets it. Travel that feels like you.',
            },
          ].map(d => (
            <div key={d.title} className="p-5 rounded-[14px] border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] transition-all duration-400 hover:border-[rgba(200,164,78,0.1)] hover:-translate-y-0.5">
              <div className="mb-2.5 text-[#c8a44e] opacity-70">{d.icon}</div>
              <div className="text-[13px] font-semibold mb-1">{d.title}</div>
              <div className="text-[11px] text-[#4a4a55] leading-relaxed">{d.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="relative z-[2] text-center px-8 pt-20 pb-16 max-md:px-4 max-md:pt-16 max-md:pb-10 reveal">
        <h2 className="font-serif text-[clamp(28px,5vw,48px)] font-normal leading-[1.2] mb-2.5 max-md:text-[clamp(24px,6vw,36px)]">
          Stop planning. <em className="text-[#c8a44e] italic">Start drifting.</em>
        </h2>
        <p className="text-sm text-[#4a4a55] mb-7">Free to use. No credit card. Your first trip is 30 seconds away.</p>
        <div className="flex gap-3 justify-center max-md:flex-col max-md:px-4">
          <button
            onClick={() => router.push('/login')}
            className="px-11 py-3.5 bg-gradient-to-br from-[#c8a44e] to-[#a88a3e] text-[#0a0a0f] text-sm font-semibold rounded-full hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(200,164,78,0.3)] transition-all active:scale-[0.97] flex items-center gap-2.5 justify-center"
          >
            Plan My Trip — Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-[2] text-center px-8 py-6 border-t border-[rgba(255,255,255,0.06)] text-[11px] text-[#4a4a55]">
        Drift &middot;{' '}
        <Link href="/about" className="hover:text-[#c8a44e] transition-colors">About</Link>
        {' '}&middot;{' '}
        <Link href="/faq" className="hover:text-[#c8a44e] transition-colors">FAQ</Link>
        {' '}&middot;{' '}
        <Link href="/privacy" className="hover:text-[#c8a44e] transition-colors">Privacy</Link>
        {' '}&middot;{' '}
        <Link href="/terms" className="hover:text-[#c8a44e] transition-colors">Terms</Link>
        {' '}&middot; Built with taste.
      </footer>
    </div>
  )
}

/* ─── Particles Component ─────────────────────────────────────── */
function Particles() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      p.style.left = `${Math.random() * 100}%`
      p.style.animationDuration = `${8 + Math.random() * 12}s`
      p.style.animationDelay = `${Math.random() * 10}s`
      const size = 1 + Math.random() * 2
      p.style.width = `${size}px`
      p.style.height = `${size}px`
      container.appendChild(p)
    }
    return () => { container.innerHTML = '' }
  }, [])

  return <div ref={ref} className="fixed inset-0 pointer-events-none z-0" />
}

/* ─── Product Mockup ──────────────────────────────────────────── */
function ProductMockup() {
  const cards = [
    { tag: 'Flight', tagClass: 'bg-[rgba(200,164,78,0.15)] text-[#c8a44e]', name: 'IndiGo 6E-2087', detail: 'DEL → DPS · 9h 20m', price: '$420', img: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&h=200&fit=crop' },
    { tag: 'Hotel', tagClass: 'bg-[rgba(78,205,196,0.15)] text-[#4ecdc4]', name: 'Alila Ubud', detail: 'Infinity pool · 4.8★', price: '$89/nt', img: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&h=200&fit=crop' },
    { tag: 'Activity', tagClass: 'bg-[rgba(160,120,200,0.15)] text-[#a080c8]', name: 'Tegallalang Rice Terraces', detail: 'Morning · 2 hours', price: '$12', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=200&fit=crop' },
    { tag: 'Food', tagClass: 'bg-[rgba(240,165,0,0.15)] text-[#f0a500]', name: 'Locavore', detail: 'Fine dining · Tasting menu', price: '$65', img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=200&fit=crop' },
  ]

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0e0e14] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)]">
      {/* Browser bar */}
      <div className="h-8 bg-[rgba(255,255,255,0.03)] border-b border-[rgba(255,255,255,0.06)] flex items-center px-3 gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[#e74c3c]" />
        <div className="w-2 h-2 rounded-full bg-[#f0a500]" />
        <div className="w-2 h-2 rounded-full bg-[#4ecdc4]" />
      </div>
      {/* Cards */}
      <div className="p-5 flex gap-3 overflow-x-auto max-md:p-3.5">
        {cards.map((c, i) => (
          <div key={i} className="flex items-center gap-0 flex-shrink-0">
            <div className="w-40 rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] max-md:w-[140px]">
              <div className="relative w-full h-[90px] max-md:h-[72px]">
                <Image src={c.img} alt={c.name} fill className="object-cover" sizes="(max-width: 768px) 140px, 160px" />
              </div>
              <div className="p-2.5">
                <span className={`text-[7px] px-1.5 py-0.5 rounded ${c.tagClass} uppercase tracking-wide font-semibold inline-block mb-1`}>{c.tag}</span>
                <div className="text-[11px] font-semibold mb-0.5">{c.name}</div>
                <div className="text-[9px] text-[#4a4a55]">{c.detail}</div>
                <div className="text-xs text-[#c8a44e] font-medium mt-1">{c.price}</div>
              </div>
            </div>
            {i < cards.length - 1 && (
              <div className="flex items-center px-1 flex-shrink-0">
                <div className="w-8 h-px bg-[rgba(255,255,255,0.06)] relative">
                  <div className="absolute right-0 -top-[3px] border-l-[5px] border-l-[rgba(255,255,255,0.06)] border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
