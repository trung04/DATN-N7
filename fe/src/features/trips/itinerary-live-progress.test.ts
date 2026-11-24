import { describe, expect, it } from 'vitest'
import type { Stopover } from '@/types/domain'
import { distanceKm, nextLiveStop } from './itinerary-live-progress'

const stops = [
  { id: 'overnight', tripId: 'trip', name: 'Khách sạn', address: '', start: '2026-11-20T20:00', end: '2026-11-22T08:00', order: 1, note: '' },
  { id: 'museum', tripId: 'trip', name: 'Bảo tàng', address: '', start: '2026-11-21T09:00', end: '2026-11-21T10:00', order: 2, note: '' },
] satisfies Stopover[]

describe('itinerary live progress', () => {
  it('selects an active cross-day stop and advances after completion', () => {
    expect(nextLiveStop(stops, '2026-11-21', [], 'overnight')?.id).toBe('overnight')
    expect(nextLiveStop(stops, '2026-11-21', ['overnight'])?.id).toBe('museum')
  })

  it('calculates a stable straight-line status distance', () => {
    expect(distanceKm([108.2022, 16.0544], [108.2022, 16.0544])).toBe(0)
    expect(distanceKm([108.2022, 16.0544], [108.2122, 16.0544])).toBeGreaterThan(1)
  })
})
