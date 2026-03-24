'use client'

import { useUIStore } from '@/stores/ui-store'
import { useTripStore } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

export default function CardMenu() {
  const { showCardMenu, menuItemId, closeCardMenu, openDetail, openChat } = useUIStore()
  const { currentItems, removeItem, token } = useTripStore()
  const { toast } = useUIStore()

  const item = currentItems.find((i) => i.id === menuItemId)

  const handleAction = async (action: 'alts' | 'chat' | 'remove') => {
    const savedId = menuItemId
    const savedItem = item
    closeCardMenu()
    if (!savedId || !savedItem) return

    if (action === 'alts') {
      openDetail(savedId)
    } else if (action === 'chat') {
      openChat(`What are better options for ${savedItem.name}?`)
    } else if (action === 'remove') {
      const name = savedItem.name
      removeItem(savedId)
      const { error } = await supabase.from('itinerary_items').delete().eq('id', savedId)
      if (error) {
        toast("Couldn't remove this item. Check your connection.", true)
      } else {
        toast(`${name} removed from your trip`)
      }
    }
  }

  return (
    <div className={`fixed inset-0 z-[250] transition-opacity duration-300 ${showCardMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={closeCardMenu} />

      <div className={`absolute bottom-0 left-0 right-0 rounded-t-[20px] border-t border-drift-border2 bg-drift-card transition-transform duration-400 ease-[var(--ease-spring)] pb-[calc(12px+env(safe-area-inset-bottom))] ${showCardMenu ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Handle */}
        <div className="flex justify-center py-2.5">
          <div className="h-[3px] w-8 rounded-full bg-white/8" />
        </div>

        {/* Menu items */}
        <button
          onClick={() => handleAction('alts')}
          className="flex w-full items-center gap-3 px-6 py-3.5 text-[13px] font-medium text-drift-text transition-colors active:bg-white/3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-drift-text2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          Find Alternatives
        </button>

        <button
          onClick={() => handleAction('chat')}
          className="flex w-full items-center gap-3 px-6 py-3.5 text-[13px] font-medium text-drift-text transition-colors active:bg-white/3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-drift-text2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Ask AI About This
        </button>

        <button
          onClick={() => handleAction('remove')}
          className="flex w-full items-center gap-3 px-6 py-3.5 text-[13px] font-medium text-[#e74c3c] transition-colors active:bg-white/3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-[#e74c3c]">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Remove from Trip
        </button>
      </div>
    </div>
  )
}
