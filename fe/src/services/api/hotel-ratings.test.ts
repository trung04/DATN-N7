import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: (config: AxiosRequestConfig) => actual.default.create({ ...config, adapter: transport }) } }
})
import { api } from './client'

const records = ['unrated', 'good', 'best'].map(id => ({ id, name: id, address: 'Đà Nẵng', starRating: 4, checkInTime: '14:00', images: [] }))
const page = (data: unknown[]) => ({ data, meta: { page: 1, limit: 100, total: data.length } })
describe('Hotel catalogue review ratings', () => {
  beforeEach(() => {
    transport.mockReset()
    transport.mockImplementation(async (config: AxiosRequestConfig) => {
      const data = config.url === '/hotels' ? page(records)
        : config.url === '/reviews/summaries' ? [
          { hotelId: 'good', averageRating: 4.25, visibleCount: 4 },
          { hotelId: 'best', averageRating: 4.75, visibleCount: 4 },
          { hotelId: 'unrated', averageRating: 0, visibleCount: 0 },
        ] : page([])
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    })
  })

  it('loads ratings in one batch and enables filtering and descending sorting without rating unrated hotels', async () => {
    const data = await api.publicData()
    expect(data.hotels.find(hotel => hotel.id === 'unrated')?.rating).toBeUndefined()
    expect(data.hotels.filter(hotel => (hotel.rating ?? 0) >= 4).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).map(hotel => hotel.id)).toEqual(['best', 'good'])
    const requests = transport.mock.calls.map(([config]) => config as AxiosRequestConfig).filter(config => config.url === '/reviews/summaries')
    expect(requests).toHaveLength(1)
    expect(requests[0]?.params).toEqual({ hotelIds: 'unrated,good,best' })
  })

  it('reports a ratings API failure instead of showing a misleading empty result', async () => {
    const original = transport.getMockImplementation()!
    transport.mockImplementation(config => config.url === '/reviews/summaries' ? Promise.reject(new Error('Ratings unavailable')) : original(config))
    await expect(api.publicData()).rejects.toThrow('Ratings unavailable')
  })

  it('uses only the hotel coordinates and never borrows the linked attraction location', async () => {
    transport.mockImplementation(async (config: AxiosRequestConfig) => ({
      data: config.url === '/hotels' ? page([
        { ...records[0], placeId: 'attraction', latitude: null, longitude: null },
        { ...records[1], placeId: 'attraction', latitude: 0, longitude: 0 },
        { ...records[2], latitude: 91, longitude: 108 },
      ]) : config.url === '/places' ? page([{ id: 'attraction', name: 'Attraction', latitude: 16.06, longitude: 108.24 }])
        : config.url === '/reviews/summaries' ? [] : page([]),
      status: 200, statusText: 'OK', headers: {}, config,
    }))
    const data = await api.publicData()
    expect(data.hotels[0]?.lat).toBeUndefined()
    expect(data.hotels[0]?.lng).toBeUndefined()
    expect(data.hotels[1]).toMatchObject({ lat: 0, lng: 0 })
    expect(data.hotels[2]?.lat).toBeUndefined()
    expect(data.destinations[0]).toMatchObject({ lat: 16.06, lng: 108.24 })
  })
})
