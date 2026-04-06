'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

type Tab = 'board' | 'trips' | 'profile'

const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  {
    id: 'board',
    label: 'Board',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
  {
    id: 'trips',
    label: 'Trips',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const openChat = useUIStore((s) => s.openChat)
  const resetOnboarding = useTripStore((s) => s.resetOnboarding)
  const isAnonymous = useTripStore((s) => s.isAnonymous)
  const router = useRouter()
  const [showNewTrip, setShowNewTrip] = useState(false)

  // Anonymous users tapping Trips/Profile get redirected to sign in
  const handleAuthTab = (tab: Tab) => {
    if (isAnonymous) {
      try { sessionStorage.setItem('drift-login-return', window.location.pathname) } catch {}
      router.push('/m/login')
    } else {
      setActiveTab(tab)
    }
  }

  const handleFromScratch = () => {
    setShowNewTrip(false)
    resetOnboarding()
    router.push('/m/plan/origin')
  }

  const handleFromUrl = () => {
    setShowNewTrip(false)
    router.push('/m/plan/url')
  }

  return (
    <>
      {/* New Trip choice sheet */}
      {showNewTrip && (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewTrip(false)} />
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <div className="w-full max-w-[430px] rounded-t-2xl border-t border-drift-border2 bg-drift-card px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-drift-border2" />
              <h3 className="mb-4 font-serif text-lg text-drift-text">Create a new trip</h3>
              <div className="space-y-2.5">
                <button
                  onClick={handleFromScratch}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-drift-border2 bg-drift-surface p-4 text-left transition-all active:scale-[0.98]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-drift-gold-bg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-drift-text">Plan from scratch</div>
                    <div className="text-[11px] text-drift-text3">Pick your vibes, dates & budget</div>
                  </div>
                </button>
                <button
                  onClick={handleFromUrl}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-drift-border2 bg-drift-surface p-4 text-left transition-all active:scale-[0.98]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-drift-gold-bg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a44e" strokeWidth="1.5">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-drift-text">Create from reel or link</div>
                    <div className="text-[11px] text-drift-text3">YouTube, Instagram, TikTok, or blog</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center bg-gradient-to-t from-drift-bg/100 via-drift-bg/60 to-transparent px-4 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5">
      <div role="tablist" className="flex items-center gap-1 rounded-[20px] border border-drift-border2 bg-drift-card/95 px-2 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {/* Board — left */}
        <button
          role="tab"
          aria-selected={activeTab === 'board'}
          aria-label="Board"
          onClick={() => setActiveTab('board')}
          className={`relative flex h-11 w-14 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-all duration-300 ${
            activeTab === 'board' ? 'bg-drift-gold-bg text-drift-gold' : 'text-drift-text3'
          }`}
        >
          <span className={`h-[18px] w-[18px] transition-transform duration-300 ${activeTab === 'board' ? 'scale-110' : ''}`}>
            {tabs[0].icon}
          </span>
          <span className={`text-[7px] font-bold uppercase tracking-wider transition-opacity duration-300 ${activeTab === 'board' ? 'opacity-100' : 'opacity-0'}`}>Board</span>
        </button>

        {/* Chat */}
        <button
          aria-label="Chat with Drift"
          onClick={() => openChat()}
          className="flex h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-[14px] text-drift-text3 transition-all duration-300"
        >
          <span className="h-[18px] w-[18px]"><ChatIcon /></span>
        </button>

        {/* New Trip — center */}
        <button
          onClick={() => setShowNewTrip(true)}
          aria-label="New trip"
          className="mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-drift-gold shadow-[0_4px_16px_rgba(200,164,78,0.25)] transition-transform duration-300 active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#08080c" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Trips — right */}
        <button
          role="tab"
          aria-selected={activeTab === 'trips'}
          aria-label="My Trips"
          onClick={() => handleAuthTab('trips')}
          className={`relative flex h-11 w-14 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-all duration-300 ${
            activeTab === 'trips' ? 'bg-drift-gold-bg text-drift-gold' : 'text-drift-text3'
          }`}
        >
          <span className={`h-[18px] w-[18px] transition-transform duration-300 ${activeTab === 'trips' ? 'scale-110' : ''}`}>
            {tabs[1].icon}
          </span>
          <span className={`text-[7px] font-bold uppercase tracking-wider transition-opacity duration-300 ${activeTab === 'trips' ? 'opacity-100' : 'opacity-0'}`}>Trips</span>
        </button>

        {/* Profile — far right */}
        <button
          role="tab"
          aria-selected={activeTab === 'profile'}
          aria-label="Profile"
          onClick={() => handleAuthTab('profile')}
          className={`relative flex h-11 w-14 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-all duration-300 ${
            activeTab === 'profile' ? 'bg-drift-gold-bg text-drift-gold' : 'text-drift-text3'
          }`}
        >
          <span className={`h-[18px] w-[18px] transition-transform duration-300 ${activeTab === 'profile' ? 'scale-110' : ''}`}>
            {tabs[2].icon}
          </span>
          <span className={`text-[7px] font-bold uppercase tracking-wider transition-opacity duration-300 ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0'}`}>Profile</span>
        </button>
      </div>
    </div>
    </>
  )
}
