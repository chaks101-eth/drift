import { describe, it, expect, vi } from 'vitest'

// Mock supabase and images before importing catalog
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}))
vi.mock('@/lib/images', () => ({
  upsizeGoogleImage: (url: string) => url || '',
}))

import { buildRichCatalogContext, enrichItemsWithCatalog, type CatalogData, type CatalogHotel, type CatalogActivity, type CatalogRestaurant } from './catalog'

const mockHotel: CatalogHotel = {
  id: 'h1',
  name: 'Grand Hyatt',
  description: 'Luxury hotel',
  detail: '5-star hotel',
  category: 'hotel',
  price_per_night: '$250',
  price_level: 'luxury',
  rating: 4.8,
  vibes: ['luxury', 'romance'],
  amenities: ['Pool', 'Spa', 'Gym', 'Restaurant'],
  image_url: 'https://example.com/hotel.jpg',
  location: 'Downtown Bangkok',
  booking_url: 'https://booking.com/grand-hyatt',
  source: 'serpapi',
}

const mockActivity: CatalogActivity = {
  id: 'a1',
  name: 'Grand Palace',
  description: 'Historic palace complex',
  detail: 'Iconic temple complex',
  category: 'sightseeing',
  price: '$15',
  duration: '2-3 hours',
  vibes: ['culture', 'spiritual'],
  best_time: 'morning',
  image_url: 'https://example.com/palace.jpg',
  location: 'Phra Nakhon',
  booking_url: null,
  source: 'serpapi',
}

const mockRestaurant: CatalogRestaurant = {
  id: 'r1',
  name: 'Gaggan Anand',
  description: 'Progressive Indian cuisine',
  detail: 'Molecular gastronomy',
  cuisine: 'Indian Fusion',
  price_level: 'luxury',
  avg_cost: '$120',
  vibes: ['foodie', 'luxury'],
  must_try: ['Lick It Up', 'Yogurt Explosion'],
  image_url: 'https://example.com/gaggan.jpg',
  location: 'Langsuan',
  booking_url: 'https://gaggan.com',
  source: 'serpapi',
}

const mockCatalog: CatalogData = {
  destination: {
    id: 'd1', city: 'Bangkok', country: 'Thailand',
    vibes: ['city', 'foodie', 'culture'],
    description: 'Vibrant Thai capital',
    cover_image: 'https://example.com/bangkok.jpg',
    avg_budget_per_day: { budget: 50, mid: 120, luxury: 300 },
  },
  hotels: [mockHotel],
  activities: [mockActivity],
  restaurants: [mockRestaurant],
  template: null,
}

describe('buildRichCatalogContext', () => {
  it('includes hotel details with ratings and amenities', () => {
    const context = buildRichCatalogContext(mockCatalog)
    expect(context).toContain('Grand Hyatt')
    expect(context).toContain('$250/night')
    expect(context).toContain('4.8')
    expect(context).toContain('Pool')
    expect(context).toContain('Downtown Bangkok')
  })

  it('includes activity details with best time and duration', () => {
    const context = buildRichCatalogContext(mockCatalog)
    expect(context).toContain('Grand Palace')
    expect(context).toContain('$15')
    expect(context).toContain('2-3 hours')
    expect(context).toContain('morning')
  })

  it('includes restaurant details with cuisine and must-try', () => {
    const context = buildRichCatalogContext(mockCatalog)
    expect(context).toContain('Gaggan Anand')
    expect(context).toContain('Indian Fusion')
    expect(context).toContain('Lick It Up')
  })

  it('includes the PREFER instruction', () => {
    const context = buildRichCatalogContext(mockCatalog)
    expect(context).toContain('PREFER these real places')
    expect(context).not.toContain('ONLY these')
  })

  it('returns empty string when no catalog items', () => {
    const empty: CatalogData = {
      ...mockCatalog,
      hotels: [], activities: [], restaurants: [],
    }
    expect(buildRichCatalogContext(empty)).toBe('')
  })
})

describe('enrichItemsWithCatalog', () => {
  const llmItems = [
    {
      category: 'hotel', name: 'Grand Hyatt', detail: 'Luxury stay',
      description: 'Nice hotel', price: '$250', image_url: '',
      time: '14:00', position: 0, metadata: {} as Record<string, unknown>,
    },
    {
      category: 'activity', name: 'Grand Palace', detail: 'Temple visit',
      description: 'Historic palace', price: '$15', image_url: '',
      time: '09:00', position: 1, metadata: {} as Record<string, unknown>,
    },
    {
      category: 'food', name: 'Gaggan Anand', detail: 'Fine dining',
      description: 'Indian fusion', price: '$120', image_url: '',
      time: '19:00', position: 2, metadata: {} as Record<string, unknown>,
    },
    {
      category: 'day', name: 'Day 1 — Arrival', detail: '',
      description: '', price: '', image_url: '',
      time: '', position: 3, metadata: {} as Record<string, unknown>,
    },
  ]

  it('enriches matched hotel with catalog data', () => {
    const enriched = enrichItemsWithCatalog(llmItems, mockCatalog)
    const hotel = enriched[0]
    expect(hotel.image_url).toBe('https://example.com/hotel.jpg')
    expect(hotel.metadata.source).toBe('catalog')
    expect(hotel.metadata.bookingUrl).toBe('https://booking.com/grand-hyatt')
    expect(hotel.metadata.features).toContain('Pool')
    expect(hotel.metadata.rating).toBe(4.8)
  })

  it('enriches matched activity with catalog data', () => {
    const enriched = enrichItemsWithCatalog(llmItems, mockCatalog)
    const activity = enriched[1]
    expect(activity.image_url).toBe('https://example.com/palace.jpg')
    expect(activity.metadata.source).toBe('catalog')
    expect(activity.metadata.best_time).toBe('morning')
    expect(activity.metadata.duration).toBe('2-3 hours')
  })

  it('enriches matched restaurant with catalog data', () => {
    const enriched = enrichItemsWithCatalog(llmItems, mockCatalog)
    const food = enriched[2]
    expect(food.image_url).toBe('https://example.com/gaggan.jpg')
    expect(food.metadata.source).toBe('catalog')
    expect(food.metadata.bookingUrl).toBe('https://gaggan.com')
  })

  it('leaves day separators as ai source', () => {
    const enriched = enrichItemsWithCatalog(llmItems, mockCatalog)
    const day = enriched[3]
    expect(day.metadata.source).toBe('ai')
    expect(day.metadata.bookingUrl).toBeUndefined()
  })

  it('handles unmatched items gracefully', () => {
    const unmatched = [{
      category: 'activity', name: 'Unknown Place', detail: '',
      description: '', price: '$50', image_url: '',
      time: '10:00', position: 0, metadata: {} as Record<string, unknown>,
    }]
    const enriched = enrichItemsWithCatalog(unmatched, mockCatalog)
    expect(enriched[0].metadata.source).toBe('ai')
    expect(enriched[0].image_url).toBe('')
  })
})
