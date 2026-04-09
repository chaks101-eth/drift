'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// ─── Cinematic hero rotation ──────────────────────────────────
const HERO_IMAGES = [
  { src: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=2400&q=90', location: 'Tegallalang', country: 'Bali' },
  { src: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=2400&q=90', location: 'Shibuya', country: 'Tokyo' },
  { src: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=2400&q=90', location: 'Amalfi', country: 'Italy' },
  { src: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=2400&q=90', location: 'Santorini', country: 'Greece' },
  { src: 'https://images.unsplash.com/photo-1504598318550-17eba1008a68?w=2400&q=90', location: 'Cappadocia', country: 'Turkey' },
]

// ─── Magnetic CTA hook ─────────────────────────────────────────
function useMagnetic() {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`
    }
    const handleLeave = () => { el.style.transform = 'translate(0, 0)' }
    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [])
  return ref
}

// ─── Animated counter ───────────────────────────────────────────
function Counter({ value, suffix = '', duration = 1800 }: { value: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration)
          const eased = 1 - Math.pow(1 - progress, 3)
          setN(Math.round(value * eased))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value, duration])
  return <span ref={ref}>{n}{suffix}</span>
}

export default function Landing() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [heroIdx, setHeroIdx] = useState(0)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const cursorVisible = useRef(false)
  const primaryRef = useMagnetic()

  useEffect(() => {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.href = '/m'
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true)
  }, [])

  // Hero rotation
  useEffect(() => {
    if (!ready) return
    const t = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 6500)
    return () => clearInterval(t)
  }, [ready])

  // Cursor follower
  useEffect(() => {
    if (!ready) return
    const move = (e: MouseEvent) => {
      cursorVisible.current = true
      setCursor({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [ready])

  // Scroll reveal
  useEffect(() => {
    if (!ready) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [ready])

  if (!ready) return <div className="min-h-screen bg-[#08080c]" />

  const hero = HERO_IMAGES[heroIdx]

  return (
    <div className="min-h-screen bg-[#08080c] text-[#f0efe8] overflow-x-hidden cursor-none max-md:cursor-auto">
      {/* ═══ Custom cursor follower ═══ */}
      <div
        className="pointer-events-none fixed z-[200] hidden md:block"
        style={{
          left: cursor.x,
          top: cursor.y,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="h-8 w-8 rounded-full border border-[#c8a44e]/60 transition-transform duration-200 ease-out" />
        <div className="absolute inset-0 m-auto h-1 w-1 rounded-full bg-[#c8a44e]" />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── HERO ─── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Rotating photos */}
        {HERO_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className="absolute inset-0 transition-opacity duration-[2200ms] ease-in-out"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          >
            <Image
              src={img.src}
              alt=""
              fill
              priority={i === 0}
              className="object-cover scale-110 animate-[heroKenBurns_18s_ease-in-out_infinite]"
              sizes="100vw"
              unoptimized
            />
          </div>
        ))}

        {/* Aurora blobs */}
        <div className="aurora-blob h-[520px] w-[520px] -left-40 top-20 bg-[#c8a44e]" style={{ animationDelay: '0s' }} />
        <div className="aurora-blob h-[420px] w-[420px] right-0 bottom-20 bg-[#7a5cb8]" style={{ animationDelay: '-8s', opacity: 0.2 }} />

        {/* Animated grid */}
        <div className="absolute inset-0 grid-bg" />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(8,8,12,0.4)] via-[rgba(8,8,12,0.55)] to-[#08080c]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,8,12,0.75)] via-transparent to-transparent" />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-12 py-7 max-lg:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-[26px] italic text-[#c8a44e]">Drift</span>
            <span className="text-[8px] font-semibold tracking-[3px] uppercase text-white/40">AI Composer</span>
          </div>
          <nav className="flex items-center gap-10 text-[10px] font-medium tracking-[2px] uppercase">
            <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} className="text-white/60 hover:text-[#c8a44e] transition-colors">How</button>
            <button onClick={() => document.getElementById('why')?.scrollIntoView({ behavior: 'smooth' })} className="text-white/60 hover:text-[#c8a44e] transition-colors">Why</button>
            <button onClick={() => router.push('/trips')} className="text-white/60 hover:text-[#c8a44e] transition-colors">My Trips</button>
          </nav>
        </div>

        {/* Hero content */}
        <div className="absolute inset-0 flex items-center">
          <div className="px-12 lg:px-24 max-w-[960px]">
            {/* Eyebrow */}
            <div className="mb-8 flex items-center gap-3 opacity-0 animate-[fadeUp_0.9s_ease_forwards_0.4s]">
              <div className="h-px w-10 bg-[#c8a44e]" />
              <span className="text-[9px] font-semibold tracking-[3px] uppercase text-[#c8a44e]/90">Travel, composed</span>
            </div>

            {/* Headline — toned down with text-reveal masking */}
            <h1 className="font-serif text-[clamp(40px,5.5vw,76px)] font-light leading-[1.0] mb-7 tracking-[-0.02em]">
              <span className="text-reveal-line"><span style={{ animationDelay: '0.5s' }}>Every trip begins</span></span>
              <br />
              <span className="text-reveal-line"><span style={{ animationDelay: '0.75s' }}>with a&nbsp;</span></span>
              <span className="text-reveal-line"><span style={{ animationDelay: '0.9s' }} className="italic text-[#c8a44e]">feeling</span></span>
              <span className="text-reveal-line"><span style={{ animationDelay: '0.95s' }}>.</span></span>
            </h1>

            {/* Subtitle — refined */}
            <p className="text-[15px] font-light text-white/65 max-w-[480px] leading-[1.7] mb-12 opacity-0 animate-[fadeUp_1s_ease_forwards_1.2s]">
              Not another planner. An intelligence that reads your vibe, finds places locals love, and composes a trip you&apos;d actually book — in 30 seconds.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-5 opacity-0 animate-[fadeUp_1s_ease_forwards_1.4s]">
              <button
                ref={primaryRef}
                onClick={() => router.push('/vibes')}
                className="group relative overflow-hidden rounded-full bg-[#c8a44e] px-8 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] transition-shadow duration-400 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)]"
                style={{ transition: 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.4), box-shadow 0.4s' }}
              >
                <span className="relative z-10 flex items-center gap-3">
                  Start Drifting
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </span>
                {/* Shimmer */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-full transition-transform duration-1000" />
              </button>

              <button
                onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
                className="group flex items-center gap-3 px-2 py-3 text-[10px] font-semibold tracking-[2px] uppercase text-white/70 hover:text-[#c8a44e] transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 group-hover:border-[#c8a44e]/60 group-hover:bg-[#c8a44e]/10 transition-all">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
                See how
              </button>
            </div>
          </div>
        </div>

        {/* Bottom-left location indicator */}
        <div className="absolute bottom-14 left-12 z-10 max-lg:left-8 opacity-0 animate-[fadeUp_1s_ease_forwards_1.6s]">
          <div className="flex items-center gap-3">
            <div className="h-px w-6 bg-[#c8a44e]/50" />
            <div>
              <div className="text-[8px] font-semibold tracking-[2px] uppercase text-white/40">Now showing</div>
              <div key={heroIdx} className="text-[14px] font-medium text-white/90 mt-0.5 animate-[fadeIn_0.8s_ease]">
                {hero.location} <span className="text-white/50 italic font-light">· {hero.country}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Image dots */}
        <div className="absolute bottom-16 right-12 z-10 flex gap-2 max-lg:right-8 opacity-0 animate-[fadeUp_1s_ease_forwards_1.6s]">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroIdx(i)}
              className={`h-[2px] rounded-full transition-all duration-700 ${
                i === heroIdx ? 'w-10 bg-[#c8a44e]' : 'w-4 bg-white/25 hover:bg-white/45'
              }`}
            />
          ))}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 opacity-0 animate-[fadeUp_1s_ease_forwards_1.8s]">
          <span className="text-[8px] font-semibold tracking-[2px] uppercase text-white/35">Scroll</span>
          <div className="h-6 w-px bg-gradient-to-b from-[#c8a44e]/60 to-transparent animate-[scrollHint_2s_ease-in-out_infinite]" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── STATS MARQUEE ─── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative border-y border-white/[0.06] py-8 overflow-hidden">
        <div className="flex animate-[marquee_40s_linear_infinite] whitespace-nowrap">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex shrink-0 items-center gap-16 px-8">
              {[
                { v: '200+', l: 'Trips Composed' },
                { v: '58', l: 'Destinations' },
                { v: '100%', l: 'Real Data' },
                { v: '0', l: 'Hallucinations' },
                { v: '30s', l: 'Avg. Compose' },
                { v: 'AI', l: 'Curated' },
              ].map((s, i) => (
                <div key={`${k}-${i}`} className="flex items-baseline gap-3">
                  <span className="font-serif text-[28px] font-light text-[#c8a44e]">{s.v}</span>
                  <span className="text-[9px] font-semibold tracking-[2.5px] uppercase text-white/40">{s.l}</span>
                  <span className="text-white/15 ml-12">◆</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── HOW IT WORKS ─── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="how" className="relative py-32 px-12 lg:px-24 reveal">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-16 max-w-[680px]">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-10 bg-[#c8a44e]" />
              <span className="text-[9px] font-semibold tracking-[3px] uppercase text-[#c8a44e]/90">The process</span>
            </div>
            <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-light leading-[1.1] tracking-[-0.01em]">
              Three steps. <em className="italic text-[#c8a44e]">No headaches.</em>
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
            {[
              {
                num: '01',
                title: 'Set your vibe',
                desc: 'Tell Drift how you want to feel — beach chill, foodie deep-dive, adventure rush. No boring forms.',
                img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
              },
              {
                num: '02',
                title: 'AI composes',
                desc: 'Drift evaluates timing, price, vibe fit — then assembles a cohesive trip you\'d actually book.',
                img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
              },
              {
                num: '03',
                title: 'Refine & go',
                desc: 'Chat with Drift to swap, adjust, explore alternatives. Every change cascades intelligently.',
                img: 'https://images.unsplash.com/photo-1523484763220-f02e4937d58e?w=800&q=80',
              },
            ].map((s, i) => (
              <div
                key={s.num}
                className="reveal group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] transition-all duration-500 hover:border-[#c8a44e]/25 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="relative h-[180px] overflow-hidden">
                  <Image src={s.img} alt={s.title} fill className="object-cover transition-transform duration-1000 ease-out group-hover:scale-110" sizes="400px" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/40 to-transparent" />
                  <div className="absolute top-5 left-5 font-serif text-[52px] font-light text-[#c8a44e]/35 leading-none">{s.num}</div>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-[20px] font-normal mb-2.5">{s.title}</h3>
                  <p className="text-[12px] leading-[1.7] text-white/55">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── WHY DRIFT — Bento grid ─── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="why" className="relative py-32 px-12 lg:px-24 reveal">
        {/* Subtle aurora */}
        <div className="aurora-blob h-[420px] w-[420px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#c8a44e]" style={{ opacity: 0.06 }} />

        <div className="relative mx-auto max-w-[1100px]">
          <div className="mb-16 max-w-[680px]">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-10 bg-[#c8a44e]" />
              <span className="text-[9px] font-semibold tracking-[3px] uppercase text-[#c8a44e]/90">Why Drift</span>
            </div>
            <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-light leading-[1.1] tracking-[-0.01em]">
              Not search. <em className="italic text-[#c8a44e]">Curation by intelligence.</em>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            {[
              {
                title: 'AI that explains itself',
                desc: 'Every recommendation shows why it was picked. Price-to-comfort. Crowd timing. Vibe alignment. No black boxes.',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
              },
              {
                title: 'Real data, not guesses',
                desc: 'Live flight prices from Amadeus. Hotel ratings from 2M+ reviews. Not some LLM making up numbers.',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
              },
              {
                title: 'Swap, don\'t start over',
                desc: 'Don\'t like a hotel? Tap alternatives, see trust badges, swap in one click. The cost bar updates live.',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>,
              },
              {
                title: 'Vibes, not filters',
                desc: 'You don\'t search by star rating. You say "romantic + foodie + beach" and Drift gets it.',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
              },
            ].map((d, i) => (
              <div
                key={d.title}
                className="reveal group relative flex gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm p-7 transition-all duration-500 hover:border-[#c8a44e]/20 hover:-translate-y-1 hover:bg-white/[0.025]"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#c8a44e]/10 text-[#c8a44e] transition-all duration-500 group-hover:bg-[#c8a44e]/15 group-hover:scale-110">
                  {d.icon}
                </div>
                <div>
                  <h3 className="font-serif text-[18px] font-normal mb-2">{d.title}</h3>
                  <p className="text-[12px] leading-[1.7] text-white/55">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live stats row */}
          <div className="mt-16 grid grid-cols-4 gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] py-8 px-8 max-md:grid-cols-2 reveal">
            {[
              { v: 200, suffix: '+', l: 'Trips composed' },
              { v: 58, suffix: '', l: 'Destinations' },
              { v: 100, suffix: '%', l: 'Real data' },
              { v: 0, suffix: '', l: 'Hallucinations' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="font-serif text-[32px] font-light text-[#c8a44e] tabular-nums">
                  <Counter value={s.v} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-[9px] font-semibold tracking-[2px] uppercase text-white/45">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── FINAL CTA ─── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-32 px-12 lg:px-24 text-center reveal overflow-hidden">
        <div className="aurora-blob h-[600px] w-[600px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#c8a44e]" style={{ opacity: 0.08 }} />
        <div className="relative mx-auto max-w-[680px]">
          <h2 className="font-serif text-[clamp(32px,4.5vw,56px)] font-light leading-[1.05] mb-6 tracking-[-0.01em]">
            Stop planning.<br />
            <em className="italic text-[#c8a44e]">Start drifting.</em>
          </h2>
          <p className="text-[13px] text-white/55 mb-10">Free. No credit card. Your first trip is 30 seconds away.</p>
          <button
            onClick={() => router.push('/vibes')}
            className="inline-flex items-center gap-3 rounded-full bg-[#c8a44e] px-10 py-4 text-[10px] font-bold tracking-[2.5px] uppercase text-[#08080c] hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(200,164,78,0.4)] transition-all duration-400"
          >
            Compose My Trip
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06] py-10 px-12 text-center text-[10px] text-white/35">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className="font-serif text-[16px] italic text-[#c8a44e]">Drift</span>
          <span>·</span>
          <Link href="/about" className="hover:text-[#c8a44e] transition-colors uppercase tracking-wider">About</Link>
          <span>·</span>
          <Link href="/faq" className="hover:text-[#c8a44e] transition-colors uppercase tracking-wider">FAQ</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[#c8a44e] transition-colors uppercase tracking-wider">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-[#c8a44e] transition-colors uppercase tracking-wider">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
