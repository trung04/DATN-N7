import { describe, expect, it } from 'vitest'
import type { Itinerary, Stopover, TravelActivity } from '@/types/domain'
import { defaultActivityTimes, defaultStopTimes, validateActivitySchedule, validateStopSchedule } from './trip-schedule'

const trip = { id: 'trip', userId: 'user', name: 'Test', city: 'Hà Nội', startDate: '2026-11-20', endDate: '2026-11-22', adults: 2, children: 0, budget: 1, note: '', source: 'manual', status: 'SAVED' } satisfies Itinerary
const stop = { id: 'stop-1', tripId: trip.id, placeId: 'place-1', name: 'Điểm 1', address: '', start: '2026-11-20T09:00', end: '2026-11-20T11:00', order: 1, note: '' } satisfies Stopover
const activity = { id: 'activity-1', stopId: stop.id, name: 'Hoạt động', start: '2026-11-20T09:00', end: '2026-11-20T10:00', order: 1, note: '', cost: 0 } satisfies TravelActivity

describe('trip schedule', () => {
  it('uses the end of the previous item as the next default time', () => {
    expect(defaultStopTimes('2026-11-20', [stop], [activity])).toEqual({ start: '2026-11-20T11:00', end: '2026-11-20T13:00' })
    expect(defaultActivityTimes(stop, [activity])).toEqual({ start: '2026-11-20T10:00', end: '2026-11-20T11:00' })
  })

  it('reports overlapping stops and activities', () => {
    expect(validateStopSchedule(trip, { ...stop, id: '', start: '2026-11-20T10:00', end: '2026-11-20T12:00' }, [stop])).toContain('trùng thời gian')
    expect(validateActivitySchedule(stop, { ...activity, id: '', start: '2026-11-20T09:30', end: '2026-11-20T10:30' }, [activity])).toContain('trùng thời gian')
  })

  it('accepts a custom Mapbox stop with a name and coordinates', () => {
    expect(validateStopSchedule(trip, { ...stop, id: '', placeId: undefined, name: 'Quán cà phê', lat: 16.06, lng: 108.22 }, [])).toBeNull()
  })
})
