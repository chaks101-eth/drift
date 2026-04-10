'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const TOTAL = 10

interface Props {
  current: number
  name: string
}

export default function VariationNav({ current, name }: Props) {
  const router = useRouter()
  const prev = current === 1 ? TOTAL : current - 1
  const next = current === TOTAL ? 1 : current + 1

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') router.push(`/variations/v${prev}`)
      if (e.key === 'ArrowRight') router.push(`/variations/v${next}`)
      if (e.key === 'Escape') router.push('/variations')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prev, next, router])

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/60 backdrop-blur-xl px-2 py-2 font-mono text-[10px]">
      <Link
        href="/variations"
        className="px-3 py-1 rounded-full text-white/55 hover:text-[#c8a44e] transition-colors tracking-[1px]"
      >
        ← ALL
      </Link>
      <div className="h-4 w-px bg-white/10" />
      <Link
        href={`/variations/v${prev}`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:text-[#c8a44e] hover:bg-white/[0.06] transition-all"
        aria-label="Previous"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
      </Link>
      <div className="px-2 text-[#c8a44e]/80 tracking-[1px] min-w-[80px] text-center">
        <span className="text-[#c8a44e]">{String(current).padStart(2, '0')}</span>
        <span className="text-white/30"> / 10</span>
      </div>
      <Link
        href={`/variations/v${next}`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:text-[#c8a44e] hover:bg-white/[0.06] transition-all"
        aria-label="Next"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
      </Link>
      <div className="h-4 w-px bg-white/10" />
      <div className="px-3 text-white/55 tracking-[0.5px] max-w-[220px] truncate">
        {name}
      </div>
    </div>
  )
}
