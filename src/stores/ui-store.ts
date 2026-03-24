import { create } from 'zustand'

type ActiveTab = 'board' | 'trips' | 'profile'

interface UIStore {
  // Tab navigation
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void

  // Overlays
  showDetail: boolean
  detailItemId: string | null
  openDetail: (itemId: string) => void
  closeDetail: () => void

  showChat: boolean
  chatInitMessage: string | null
  chatContextItemId: string | null
  openChat: (initMessage?: string, contextItemId?: string) => void
  closeChat: () => void

  showCardMenu: boolean
  menuItemId: string | null
  openCardMenu: (itemId: string) => void
  closeCardMenu: () => void

  showRemix: boolean
  openRemix: () => void
  closeRemix: () => void

  showShare: boolean
  toggleShare: () => void
  closeShare: () => void

  // Toast
  toastText: string
  toastError: boolean
  toastVisible: boolean
  toastUndo: (() => void) | null
  toast: (text: string, isError?: boolean, undo?: () => void) => void
  hideToast: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  // Tabs
  activeTab: 'board',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Detail
  showDetail: false,
  detailItemId: null,
  openDetail: (itemId) => set({ showDetail: true, detailItemId: itemId }),
  closeDetail: () => set({ showDetail: false }),

  // Chat
  showChat: false,
  chatInitMessage: null,
  chatContextItemId: null,
  openChat: (initMessage, contextItemId) => set({ showChat: true, chatInitMessage: initMessage || null, chatContextItemId: contextItemId || null }),
  closeChat: () => set({ showChat: false, chatInitMessage: null, chatContextItemId: null }),

  // Card menu
  showCardMenu: false,
  menuItemId: null,
  openCardMenu: (itemId) => set({ showCardMenu: true, menuItemId: itemId }),
  closeCardMenu: () => set({ showCardMenu: false, menuItemId: null }),

  // Remix
  showRemix: false,
  openRemix: () => set({ showRemix: true }),
  closeRemix: () => set({ showRemix: false }),

  // Share
  showShare: false,
  toggleShare: () => set((s) => ({ showShare: !s.showShare })),
  closeShare: () => set({ showShare: false }),

  // Toast
  toastText: '',
  toastError: false,
  toastVisible: false,
  toastUndo: null,
  toast: (text, isError = false, undo) =>
    set({ toastText: text, toastError: isError, toastVisible: true, toastUndo: undo || null }),
  hideToast: () => set({ toastVisible: false, toastUndo: null }),
}))
