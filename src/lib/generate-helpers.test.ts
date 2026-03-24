import { describe, it, expect } from 'vitest'

// Test the category mapping logic (copied from generate/route.ts for testability)
const validCategories = new Set(['flight', 'hotel', 'activity', 'food', 'transfer', 'day'])

function mapCategory(cat: string): string {
  if (validCategories.has(cat)) return cat
  if (['temple', 'beach', 'tour', 'sightseeing', 'shopping', 'entertainment', 'spa', 'adventure'].includes(cat)) return 'activity'
  if (['restaurant', 'cafe', 'dining', 'breakfast', 'lunch', 'dinner'].includes(cat)) return 'food'
  if (['taxi', 'drive', 'bus', 'train', 'transport'].includes(cat)) return 'transfer'
  if (['accommodation', 'resort', 'hostel', 'airbnb', 'villa'].includes(cat)) return 'hotel'
  return 'activity'
}

describe('mapCategory', () => {
  it('passes through valid categories', () => {
    expect(mapCategory('flight')).toBe('flight')
    expect(mapCategory('hotel')).toBe('hotel')
    expect(mapCategory('activity')).toBe('activity')
    expect(mapCategory('food')).toBe('food')
    expect(mapCategory('transfer')).toBe('transfer')
    expect(mapCategory('day')).toBe('day')
  })

  it('maps temple/beach/tour/sightseeing to activity', () => {
    expect(mapCategory('temple')).toBe('activity')
    expect(mapCategory('beach')).toBe('activity')
    expect(mapCategory('tour')).toBe('activity')
    expect(mapCategory('sightseeing')).toBe('activity')
    expect(mapCategory('shopping')).toBe('activity')
    expect(mapCategory('spa')).toBe('activity')
    expect(mapCategory('adventure')).toBe('activity')
  })

  it('maps restaurant/cafe/dining to food', () => {
    expect(mapCategory('restaurant')).toBe('food')
    expect(mapCategory('cafe')).toBe('food')
    expect(mapCategory('dining')).toBe('food')
    expect(mapCategory('breakfast')).toBe('food')
    expect(mapCategory('lunch')).toBe('food')
    expect(mapCategory('dinner')).toBe('food')
  })

  it('maps taxi/bus/train to transfer', () => {
    expect(mapCategory('taxi')).toBe('transfer')
    expect(mapCategory('bus')).toBe('transfer')
    expect(mapCategory('train')).toBe('transfer')
    expect(mapCategory('drive')).toBe('transfer')
    expect(mapCategory('transport')).toBe('transfer')
  })

  it('maps accommodation types to hotel', () => {
    expect(mapCategory('accommodation')).toBe('hotel')
    expect(mapCategory('resort')).toBe('hotel')
    expect(mapCategory('hostel')).toBe('hotel')
    expect(mapCategory('airbnb')).toBe('hotel')
    expect(mapCategory('villa')).toBe('hotel')
  })

  it('defaults unknown categories to activity', () => {
    expect(mapCategory('museum')).toBe('activity')
    expect(mapCategory('waterpark')).toBe('activity')
    expect(mapCategory('bazaar')).toBe('activity')
    expect(mapCategory('')).toBe('activity')
  })
})
