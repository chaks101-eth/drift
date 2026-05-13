import { describe, it, expect } from 'vitest'
import { splitByPlaceId } from '../pipeline'

describe('splitByPlaceId', () => {
  it('separates rows by place_id presence', () => {
    const rows = [
      { name: 'Hotel A', place_id: 'abc', destination_id: 'd1' },
      { name: 'Hotel B', place_id: null, destination_id: 'd1' },
      { name: 'Hotel C', place_id: 'def', destination_id: 'd1' },
    ]
    const { withPlaceId, withoutPlaceId } = splitByPlaceId(rows)
    expect(withPlaceId).toHaveLength(2)
    expect(withoutPlaceId).toHaveLength(1)
    expect(withoutPlaceId[0].name).toBe('Hotel B')
  })

  it('handles all items having place_id', () => {
    const rows = [{ name: 'A', place_id: 'x', destination_id: 'd1' }]
    const { withPlaceId, withoutPlaceId } = splitByPlaceId(rows)
    expect(withPlaceId).toHaveLength(1)
    expect(withoutPlaceId).toHaveLength(0)
  })

  it('handles empty input', () => {
    const { withPlaceId, withoutPlaceId } = splitByPlaceId([])
    expect(withPlaceId).toHaveLength(0)
    expect(withoutPlaceId).toHaveLength(0)
  })

  it('treats undefined place_id same as null', () => {
    const rows = [
      { name: 'Hotel X', destination_id: 'd1' },
      { name: 'Hotel Y', place_id: undefined, destination_id: 'd1' },
      { name: 'Hotel Z', place_id: 'ghi', destination_id: 'd1' },
    ]
    const { withPlaceId, withoutPlaceId } = splitByPlaceId(rows)
    expect(withPlaceId).toHaveLength(1)
    expect(withPlaceId[0].name).toBe('Hotel Z')
    expect(withoutPlaceId).toHaveLength(2)
  })
})
