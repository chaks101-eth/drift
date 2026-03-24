'use client'

import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'

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
  const resetOnboarding = useTripStore((s) => s.resetOnboarding)
  const router = useRouter()

  const handleNewTrip = () => {
    resetOnboarding()
    router.push('/m/plan/origin')
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center bg-gradient-to-t from-drift-bg/100 via-drift-bg/60 to-transparent px-4 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5">
      <div role="tablist" className="flex items-center gap-0 rounded-[20px] border border-drift-border2 bg-drift-card/95 px-2 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
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

        {/* New Trip — center */}
        <button
          onClick={handleNewTrip}
          aria-label="New trip"
          className="mx-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-drift-gold shadow-[0_4px_16px_rgba(200,164,78,0.25)] transition-transform duration-300 active:scale-90"
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
          onClick={() => setActiveTab('trips')}
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
          onClick={() => setActiveTab('profile')}
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
  )
}
