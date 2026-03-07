export type Database = {
  public: {
    Tables: {
      trips: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['trips']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trips']['Insert']>
      }
      itinerary_items: {
        Row: {
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
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['itinerary_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['itinerary_items']['Insert']>
      }
      chat_messages: {
        Row: {
          id: string
          trip_id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          context_item_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>
      }
    }
  }
}

// Convenience types
export type Trip = Database['public']['Tables']['trips']['Row']
export type ItineraryItem = Database['public']['Tables']['itinerary_items']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

// ─── Structured Metadata Types ──────────────────────────────────
// The metadata JSONB column on itinerary_items carries all AI reasoning,
// enrichment data, and display helpers. These types define the shape.

export interface TrustBadge {
  type: 'success' | 'gold' | 'warn'
  text: string
}

export interface AltItem {
  name: string
  detail: string
  price: string
  image_url?: string
  bookingUrl?: string
  trust?: TrustBadge[]
}

export interface ItemMetadata {
  // AI reasoning — the soul of the product
  reason?: string
  whyFactors?: string[]

  // Display helpers
  info?: { l: string; v: string }[]
  features?: string[]
  alts?: AltItem[]

  // AI enrichment from catalog pipeline
  honest_take?: string
  practical_tips?: string[]
  best_for?: string[]
  pairs_with?: string[]
  review_synthesis?: { loved?: string[]; complaints?: string[]; vibe_words?: string[] }

  // Real data from APIs
  source?: string
  bookingUrl?: string
  placeId?: string
  dataId?: string
  reviewCount?: number
  mapsUrl?: string

  // Flight-specific
  departure?: { airport: string; time: string; terminal?: string }
  arrival?: { airport: string; time: string; terminal?: string }
  airline?: string
  flightNumber?: string
  skyscannerUrl?: string

  // Transfer / location
  travel?: string
  lat?: number
  lng?: number
}
