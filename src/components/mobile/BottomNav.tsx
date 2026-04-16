'use client'

import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'

export default function BottomNav() {
  const openChat = useUIStore((s) => s.openChat)
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center bg-gradient-to-t from-drift-bg/100 via-drift-bg/60 to-transparent px-4 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5">
      <div
        role="tablist"
        className="flex items-center gap-1 rounded-[20px] border border-drift-border2 bg-drift-card/95 px-2 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
      >
        {/* Board — current trip */}
        <button
          role="tab"
          aria-selected
          aria-label="Board"
          className="relative flex h-11 w-16 flex-col items-center justify-center gap-0.5 rounded-[14px] bg-drift-gold-bg text-drift-gold transition-all duration-300"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" className="scale-110 transition-transform duration-300">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
          <span className="text-[7px] font-bold uppercase tracking-wider">Board</span>
        </button>

        {/* Chat — primary action */}
        <button
          aria-label="Chat with Drift"
          onClick={() => openChat()}
          className="relative flex h-11 w-16 flex-col items-center justify-center gap-0.5 rounded-[14px] text-drift-text3 transition-all duration-300 active:scale-95 active:bg-white/[0.04]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-[7px] font-bold uppercase tracking-wider opacity-60">Chat</span>
        </button>

        {/* Home — all trips + compose */}
        <button
          aria-label="Home"
          onClick={() => router.push('/m')}
          className="relative flex h-11 w-16 flex-col items-center justify-center gap-0.5 rounded-[14px] text-drift-text3 transition-all duration-300 active:scale-95 active:bg-white/[0.04]"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12l9-9 9 9" />
            <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
          </svg>
          <span className="text-[7px] font-bold uppercase tracking-wider opacity-60">Home</span>
        </button>
      </div>
    </div>
  )
}
