import type { AxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: (config: AxiosRequestConfig) => actual.default.create({ ...config, adapter: transport }) } }
})

import { api } from './client'

describe('public places pagination API', () => {
  beforeEach(() => {
    transport.mockReset()
    transport.mockResolvedValue({
      data: {
        data: [{ id: 'place-1', name: 'Cầu Rồng', city: 'Đà Nẵng', category: 'ATTRACTION', address: 'Hải Châu', status: 'ACTIVE', averageRating: 4.7, reviewCount: 100, primaryImageUrl: null, price: null }],
        meta: { page: 2, limit: 10, total: 1700 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
  })

  it('requests only the selected page and preserves pagination metadata', async () => {
    const result = await api.publicPlaces({
      page: 2,
      limit: 10,
      search: 'cầu',
      city: 'Đà Nẵng',
      categoryCode: 'ATTRACTION',
      sortBy: 'averageRating',
      sortOrder: 'DESC',
    })

    const placeRequests = transport.mock.calls.map(([config]) => config as AxiosRequestConfig).filter(config => config.url === '/places')
    expect(placeRequests).toHaveLength(1)
    expect(placeRequests[0]?.params).toEqual({
      page: 2,
      limit: 10,
      search: 'cầu',
      city: 'Đà Nẵng',
      categoryCode: 'ATTRACTION',
      status: 'ACTIVE',
      sortBy: 'averageRating',
      sortOrder: 'DESC',
    })
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1700 })
    expect(result.data[0]).toMatchObject({ id: 'place-1', name: 'Cầu Rồng', category: 'Điểm tham quan', rating: 4.7 })
  })

  it('loads public filter options without loading place pages', async () => {
    transport.mockResolvedValueOnce({
      data: { cities: ['Đà Nẵng'], categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })

    await expect(api.publicPlaceOptions()).resolves.toEqual({ cities: ['Đà Nẵng'], categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }] })
    const requests = transport.mock.calls.map(([config]) => config as AxiosRequestConfig)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('/places/options')
  })

  it('loads one destination directly by id', async () => {
    transport.mockResolvedValueOnce({
      data: { id: 'place-1', name: 'Cầu Rồng', city: 'Đà Nẵng', category: 'ATTRACTION', address: 'Hải Châu', description: 'Biểu tượng thành phố', tags: ['check-in'], status: 'ACTIVE', averageRating: 4.7, reviewCount: 100, primaryImageUrl: null, price: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })

    await expect(api.publicPlace('place-1')).resolves.toMatchObject({ id: 'place-1', description: 'Biểu tượng thành phố', tags: ['check-in'] })
    expect((transport.mock.calls[0]?.[0] as AxiosRequestConfig).url).toBe('/places/place-1')
  })
})
