import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { CurrencyCode } from '@/lib/currency'
import { detectCurrencyFromOrigin, formatPrice } from '@/lib/currency'

// ─── Types ──────────────────────────────────────────────────

export interface Trip {
  id: string
  user_id: string
  destination: string
  country: string
  vibes: string[]
  start_date: string
  end_date: string
  travelers: number
  budget: string
  status: 'planning' | 'booked' | 'completed'
  share_slug: string | null
  created_at: string
  updated_at: string
}

export interface ItemMetadata {
  reason?: string
  whyFactors?: string[]
  info?: Array<{ l: string; v: string }>
  features?: string[]
  best_for?: string[]
  alts?: Array<{
    name: string
    detail: string
    price: string
    image_url?: string
    bookingUrl?: string
    trust?: Array<{ type: string; text: string }>
  }>
  photos?: string[]
  bookingUrl?: string
  booking_url?: string
  mapsUrl?: string
  address?: string
  rating?: number
  reviewCount?: number
  source?: string
  trip_brief?: string
  day_insight?: string
  honest_take?: string
  practical_tips?: string
  pairs_with?: string
  review_synthesis?: string
  transport_mode?: 'flight' | 'train' | 'bus'
  transportAlts?: Array<{
    mode: string; name: string; detail: string; price: string; bookingUrl?: string
  }>
  [key: string]: unknown
}

export interface ItineraryItem {
  id: string
  trip_id: string
  category: 'flight' | 'hotel' | 'activity' | 'food' | 'transfer' | 'day'
  name: string
  detail: string
  description: string | null
  price: string
  image_url: string | null
  time: string | null
  position: number
  status: 'none' | 'picked' | 'skipped' | 'saved'
  metadata: ItemMetadata | null
  created_at: string
}

export interface Destination {
  city: string
  country: string
  tagline: string
  match: number
  price?: string
  price_usd?: number
  image_url?: string
  vibes?: string[]
  isDomestic?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  actions?: Array<{ type: string; [key: string]: unknown }>
}

// ─── Onboarding State ───────────────────────────────────────

interface OnboardingState {
  origin: string
  startDate: string
  endDate: string
  budgetLevel: 'budget' | 'mid' | 'luxury'
  budgetAmount: number
  travelers: number
  pickedVibes: string[]
  occasion: string
  destination: Destination | null
}

/**
 * Minimal shape of a source trip for the Remix flow. Kept narrow on purpose
 * so callers (ShareTripView, /vibes?remix=, /m/plan/vibes?remix=) can pass
 * a subset of Trip without importing the full server type.
 */
export interface RemixSource {
  id: string
  destination: string
  country: string | null
  vibes: string[] | null
  travelers: number | null
  budget: string | null // 'budget' | 'mid' | 'luxury'
}

// ─── Store ──────────────────────────────────────────────────

interface TripStore {
  // Auth
  token: string | null
  userId: string | null
  userEmail: string | null
  isAnonymous: boolean
  setAuth: (token: string | null, userId: string | null, email: string | null) => void

  // Currency
  currency: CurrencyCode
  formatBudget: (usd: number) => string

  // Onboarding
  onboarding: OnboardingState
  setOrigin: (origin: string) => void
  setDates: (start: string, end: string) => void
  setBudget: (level: 'budget' | 'mid' | 'luxury', amount: number) => void
  setTravelers: (count: number) => void
  addVibe: (vibe: string) => void
  removeVibe: (vibe: string) => void
  setVibes: (vibes: string[]) => void
  setOccasion: (occasion: string) => void
  setDestination: (dest: Destination | null) => void
  resetOnboarding: () => void
  remixFromTrip: (source: RemixSource) => void

  // Remix — the trip we're currently forking from, if any. Surfaced in UI as a pill.
  remixSource: RemixSource | null
  clearRemixSource: () => void

  // Active trip
  currentTrip: Trip | null
  currentItems: ItineraryItem[]
  setCurrentTrip: (trip: Trip | null) => void
  setCurrentItems: (items: ItineraryItem[]) => void
  updateItem: (id: string, updates: Partial<ItineraryItem>) => void
  removeItem: (id: string) => void

  // Trip loading
  loadTrip: (tripId: string) => Promise<void>

  // Chat
  chatHistory: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void
  updateLastChatMessage: (update: Partial<ChatMessage>) => void
  clearChat: () => void
}

const defaultOnboarding: OnboardingState = {
  origin: '',
  startDate: '',
  endDate: '',
  budgetLevel: 'mid',
  budgetAmount: 3000,
  travelers: 2,
  pickedVibes: [],
  occasion: '',
  destination: null,
}

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
  // Auth
  token: null,
  userId: null,
  userEmail: null,
  isAnonymous: true,
  setAuth: (token, userId, email) => set({ token, userId, userEmail: email, isAnonymous: !email }),

  // Currency
  currency: 'USD',
  formatBudget: (usd: number) => {
    const { currency } = get()
    return formatPrice(usd, currency)
  },

  // Onboarding
  onboarding: { ...defaultOnboarding },
  setOrigin: (origin) => {
    const currency = detectCurrencyFromOrigin(origin)
    set((s) => ({
      currency,
      onboarding: { ...s.onboarding, origin },
    }))
  },
  setDates: (start, end) =>
    set((s) => ({ onboarding: { ...s.onboarding, startDate: start, endDate: end } })),
  setBudget: (level, amount) =>
    set((s) => ({ onboarding: { ...s.onboarding, budgetLevel: level, budgetAmount: amount } })),
  setTravelers: (count) =>
    set((s) => ({ onboarding: { ...s.onboarding, travelers: count } })),
  addVibe: (vibe) =>
    set((s) => ({
      onboarding: {
        ...s.onboarding,
        pickedVibes: s.onboarding.pickedVibes.includes(vibe)
          ? s.onboarding.pickedVibes
          : [...s.onboarding.pickedVibes, vibe],
      },
    })),
  removeVibe: (vibe) =>
    set((s) => ({
      onboarding: {
        ...s.onboarding,
        pickedVibes: s.onboarding.pickedVibes.filter((v) => v !== vibe),
      },
    })),
  setVibes: (vibes) =>
    set((s) => ({ onboarding: { ...s.onboarding, pickedVibes: vibes } })),
  setOccasion: (occasion) =>
    set((s) => ({ onboarding: { ...s.onboarding, occasion } })),
  setDestination: (dest) =>
    set((s) => ({ onboarding: { ...s.onboarding, destination: dest } })),
  resetOnboarding: () => set({ onboarding: { ...defaultOnboarding }, remixSource: null }),

  // Remix — fork a public trip's vibes/destination/travelers/budget into the onboarding state.
  // Dates are intentionally NOT copied — the remixer picks their own dates.
  // Origin is intentionally NOT copied — the remixer departs from their own city.
  remixSource: null,
  remixFromTrip: (source) => {
    const level = (source.budget === 'budget' || source.budget === 'mid' || source.budget === 'luxury')
      ? source.budget
      : 'mid'
    // Budget amount is a reasonable default per level — the user can adjust.
    const amount = level === 'budget' ? 1500 : level === 'luxury' ? 7000 : 3000
    set((s) => ({
      remixSource: source,
      onboarding: {
        ...s.onboarding,
        pickedVibes: (source.vibes || []).slice(0, 5),
        travelers: source.travelers && source.travelers > 0 ? source.travelers : s.onboarding.travelers,
        budgetLevel: level,
        budgetAmount: amount,
        destination: {
          city: source.destination,
          country: source.country || '',
          tagline: '',
          match: 100,
          vibes: source.vibes || [],
        },
      },
    }))
  },
  clearRemixSource: () => set({ remixSource: null }),

  // Active trip
  currentTrip: null,
  currentItems: [],
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  setCurrentItems: (items) => set({ currentItems: items }),
  updateItem: (id, updates) =>
    set((s) => ({
      currentItems: s.currentItems.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeItem: (id) =>
    set((s) => ({
      currentItems: s.currentItems.filter((i) => i.id !== id),
    })),

  // Trip loading
  loadTrip: async (tripId: string) => {
    const { token } = get()
    if (!token) return

    const [tripRes, itemsRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('itinerary_items').select('*').eq('trip_id', tripId).order('position'),
    ])

    if (tripRes.data) set({ currentTrip: tripRes.data })
    if (itemsRes.data) set({ currentItems: itemsRes.data })
  },

  // Chat
  chatHistory: [],
  addChatMessage: (msg) =>
    set((s) => ({ chatHistory: [...s.chatHistory, msg].slice(-50) })), // cap at 50 messages
  updateLastChatMessage: (update) =>
    set((s) => {
      const history = [...s.chatHistory]
      if (history.length > 0) {
        const last = history[history.length - 1]
        history[history.length - 1] = { ...last, ...update, content: update.content !== undefined ? update.content : last.content }
      }
      return { chatHistory: history }
    }),
  clearChat: () => set({ chatHistory: [] }),
    }),
    {
      name: 'drift-trip-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      partialize: (state) => ({
        onboarding: state.onboarding,
        currency: state.currency,
        remixSource: state.remixSource,
        // Don't persist: token, userId, currentTrip, currentItems, chatHistory
        // Those come from Supabase auth listener and DB
      }),
    }
  )
)
