'use client'

import { useState } from 'react'
import { useUIStore } from '@/stores/ui-store'
import { useTripStore, type ItineraryItem } from '@/stores/trip-store'
import { supabase } from '@/lib/supabase'

export default function CardMenu() {
  const { showCardMenu, menuItemId, closeCardMenu, openDetail, openChat } = useUIStore()
  const { currentItems, removeItem, token } = useTripStore()
  const { toast } = useUIStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const item = currentItems.find((i) => i.id === menuItemId)

  // Reset confirm state when menu closes
  if (!showCardMenu && confirmDelete) setConfirmDelete(false)

  const handleAction = async (action: 'alts' | 'chat' | 'remove' | 'confirm-remove') => {
    const savedId = menuItemId
    const savedItem = item

    if (action === 'remove') {
      // First tap shows confirmation
      setConfirmDelete(true)
      return
    }

    closeCardMenu()
    setConfirmDelete(false)
    if (!savedId || !savedItem) return

    if (action === 'alts') {
      openDetail(savedId)
    } else if (action === 'chat') {
      openChat(`What are better options for ${savedItem.name}?`)
    } else if (action === 'confirm-remove') {
      const name = savedItem.name
      // Save full item for rollback
      const snapshot = { ...savedItem } as ItineraryItem
      removeItem(savedId)
      try {
        const { error } = await supabase.from('itinerary_items').delete().eq('id', savedId)
        if (error) throw error
        toast(`${name} removed from your trip`)
      } catch {
        // Rollback: re-add item to state
        useTripStore.getState().setCurrentItems([
          ...useTripStore.getState().currentItems,
          snapshot,
        ].sort((a, b) => a.position - b.position))
        toast("Couldn't remove — check your connection", true)
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

        {confirmDelete ? (
          <button
            onClick={() => handleAction('confirm-remove')}
            className="flex w-full items-center gap-3 px-6 py-3.5 text-[13px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 transition-colors active:bg-[#e74c3c]/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-[#e74c3c]">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Tap again to confirm removal
          </button>
        ) : (
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
        )}
      </div>
    </div>
  )
}
