'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/mobile/BackButton'
import { useTripStore } from '@/stores/trip-store'
import { trackEvent } from '@/lib/analytics'

interface Mood {
  id: string
  name: string
  desc: string
  tags: string[]
  img: string
}

const moods: Mood[] = [
  { id: 'beach', name: 'Beach Chill', desc: 'Sun, sand, zero stress', tags: ['Relaxation', 'Island', 'Coastal'], img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'adventure', name: 'Adventure', desc: 'Hikes, thrills, adrenaline', tags: ['Adventure', 'Nature', 'Outdoor'], img: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'city', name: 'City Nights', desc: 'Rooftops, lights, energy', tags: ['Urban', 'Nightlife', 'Shopping'], img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'romance', name: 'Romance', desc: 'Sunsets, wine, intimacy', tags: ['Romance', 'Sunset', 'Wine'], img: 'https://images.unsplash.com/photo-1501426026826-31c667bdf23d?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'spiritual', name: 'Spiritual', desc: 'Peace, temples, mindfulness', tags: ['Temples', 'Wellness', 'Peace'], img: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'foodie', name: 'Foodie Trail', desc: 'Street food & fine dining', tags: ['Food', 'Markets', 'Cuisine'], img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'party', name: 'Party Mode', desc: 'Clubs, festivals, all night', tags: ['Nightlife', 'Music', 'Festival'], img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'culture', name: 'Culture Deep Dive', desc: 'Art, history, local life', tags: ['Culture', 'History', 'Art'], img: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1200&h=1800&fit=crop&auto=format&q=90' },
  { id: 'hidden', name: 'Hidden Gems', desc: 'Off-the-beaten-path spots only locals know about', tags: ['Adventure', 'Culture', 'Nature'], img: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=1200&h=1800&fit=crop&auto=format&q=90' },
]

export default function VibesPage() {
  const router = useRouter()
  const { setVibes, token } = useTripStore()

  useEffect(() => { if (token === null) router.replace('/m/login') }, [token, router])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const dragRef = useRef({ on: false, x0: 0, y0: 0, dx: 0 })
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const swipeTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Cleanup swipe timer on unmount
  useEffect(() => {
    return () => { if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current) }
  }, [])

  const counterText = picked.length === 0
    ? 'Pick 3 vibes'
    : picked.length < 3
      ? `${picked.length} of 3 picked`
      : 'All 3 picked!'

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (done) return
    const newPicked = direction === 'right'
      ? [...picked, moods[currentIdx].id]
      : picked

    if (direction === 'right') setPicked(newPicked)

    const nextIdx = currentIdx + 1

    if (newPicked.length >= 3 || nextIdx >= moods.length) {
      setDone(true)
      setVibes(newPicked)
      trackEvent('vibes_selected', 'onboarding', newPicked.join(','))
      return
    }

    setCurrentIdx(nextIdx)
  }, [currentIdx, picked, done, setVibes])

  const handleContinue = () => {
    router.push('/m/plan/destinations')
  }

  // Touch handlers for the top card
  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { on: true, x0: e.touches[0].clientX, y0: e.touches[0].clientY, dx: 0 }
    const card = cardRefs.current.get(currentIdx)
    if (card) card.style.transition = 'none'
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.on) return
    const dx = e.touches[0].clientX - dragRef.current.x0
    const dy = e.touches[0].clientY - dragRef.current.y0
    dragRef.current.dx = dx
    const card = cardRefs.current.get(currentIdx)
    if (card) {
      const rotate = dx * 0.07
      card.style.transform = `translate(${dx}px, ${dy * 0.12}px) rotate(${rotate}deg)`
      // Show YES/PASS labels
      const yesEl = card.querySelector('.swipe-yes') as HTMLElement
      const noEl = card.querySelector('.swipe-no') as HTMLElement
      if (yesEl) yesEl.style.opacity = String(Math.max(0, dx / 100))
      if (noEl) noEl.style.opacity = String(Math.max(0, -dx / 100))
    }
  }

  const onTouchEnd = () => {
    if (!dragRef.current.on) return
    dragRef.current.on = false
    const dx = dragRef.current.dx
    const card = cardRefs.current.get(currentIdx)

    if (Math.abs(dx) > 80) {
      // Fly out
      if (card) {
        const flyX = dx > 0 ? 500 : -500
        card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.3s'
        card.style.transform = `translateX(${flyX}px) rotate(${dx > 0 ? 30 : -30}deg)`
        card.style.opacity = '0'
      }
      swipeTimerRef.current = setTimeout(() => handleSwipe(dx > 0 ? 'right' : 'left'), 150)
    } else {
      // Spring back
      if (card) {
        card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.3s'
        card.style.transform = 'scale(1) translateY(0)'
        card.style.opacity = '1'
        const yesEl = card.querySelector('.swipe-yes') as HTMLElement
        const noEl = card.querySelector('.swipe-no') as HTMLElement
        if (yesEl) yesEl.style.opacity = '0'
        if (noEl) noEl.style.opacity = '0'
      }
    }
  }

  // Visible cards (current + 2 behind it)
  const visibleCards = []
  for (let i = Math.min(2, moods.length - currentIdx - 1); i >= 0; i--) {
    const idx = currentIdx + i
    if (idx < moods.length) visibleCards.push({ mood: moods[idx], stackPos: i })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden animate-[fadeUp_0.45s_var(--ease-smooth)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="mb-3 flex items-center justify-between">
          <BackButton href="/m/plan/budget" />
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] tabular-nums transition-colors ${
              picked.length > 0 ? 'text-drift-gold' : 'text-drift-text3'
            }`}>
              {counterText}
            </span>
            <span className="text-[13px] font-medium tabular-nums text-drift-text4">04 / 05</span>
          </div>
        </div>
        <h1 className="mb-1 font-serif text-3xl font-light">
          What&apos;s your travel <em className="font-normal italic text-drift-gold">vibe?</em>
        </h1>
        <p className="mb-3 text-xs text-drift-text3">Swipe right to pick, left to skip</p>
        {/* Progress dots */}
        <div className="mb-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                i < picked.length ? 'bg-drift-gold scale-125' : 'bg-drift-border2'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card stack */}
      <div className="relative flex flex-1 items-center justify-center px-6">
        {done ? (
          /* Done state */
          <div className="flex flex-col items-center gap-4 text-center animate-[fadeUp_0.5s_var(--ease-smooth)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-drift-gold-bg">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-drift-gold">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="text-lg font-medium text-drift-text">Perfect picks</div>
            <div className="flex flex-wrap justify-center gap-2">
              {picked.map((id) => {
                const mood = moods.find((m) => m.id === id)
                return mood ? (
                  <span key={id} className="rounded-full border border-drift-gold/20 bg-drift-gold-bg px-3 py-1.5 text-xs font-medium text-drift-gold">
                    {mood.name}
                  </span>
                ) : null
              })}
            </div>
            <button
              onClick={handleContinue}
              className="mt-4 w-full rounded-[14px] bg-drift-gold px-6 py-4 text-xs font-extrabold uppercase tracking-widest text-drift-bg shadow-[0_12px_36px_rgba(200,164,78,0.18)] transition-transform active:scale-[0.97]"
            >
              Find destinations
            </button>
          </div>
        ) : (
          /* Cards */
          visibleCards.map(({ mood, stackPos }) => {
            const isTop = stackPos === 0
            return (
              <div
                key={mood.id}
                ref={(el) => { if (el) cardRefs.current.set(currentIdx + stackPos, el) }}
                className="absolute left-6 right-6 overflow-hidden rounded-3xl shadow-2xl"
                style={{
                  zIndex: 10 - stackPos,
                  transform: `scale(${1 - stackPos * 0.04}) translateY(${stackPos * 16}px)`,
                  opacity: stackPos > 2 ? 0.15 : 1,
                  transition: isTop ? undefined : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1)',
                }}
                {...(isTop ? {
                  onTouchStart,
                  onTouchMove,
                  onTouchEnd,
                } : {})}
              >
                {/* Image */}
                <div className="relative h-[420px] w-full">
                  <Image
                    src={mood.img}
                    alt={mood.name}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    draggable={false}
                  />
                </div>
                {/* YES / PASS labels */}
                <div className="swipe-yes pointer-events-none absolute left-6 top-6 rounded-xl border-2 border-green-400 px-4 py-2 text-lg font-extrabold text-green-400 opacity-0 rotate-[-15deg]">
                  YES
                </div>
                <div className="swipe-no pointer-events-none absolute right-6 top-6 rounded-xl border-2 border-red-400 px-4 py-2 text-lg font-extrabold text-red-400 opacity-0 rotate-[15deg]">
                  NOPE
                </div>
                {/* Info overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-6 pt-20">
                  <div className="font-serif text-2xl font-medium text-white">{mood.name}</div>
                  <div className="mt-1 text-sm text-white/70">{mood.desc}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mood.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Skip / Pick buttons */}
      {!done && currentIdx < moods.length && (
        <div className="shrink-0 flex items-center justify-between px-10 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
          <button
            onClick={() => handleSwipe('left')}
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-drift-text3 active:text-drift-text2 transition-colors"
          >
            &lt; Skip
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-drift-gold active:text-drift-gold/70 transition-colors"
          >
            Pick &gt;
          </button>
        </div>
      )}
    </div>
  )
}
