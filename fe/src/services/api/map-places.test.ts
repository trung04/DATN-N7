import type { AxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock('axios', async importOriginal => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, create: (config: AxiosRequestConfig) => actual.default.create({ ...config, adapter: transport }) } }
})

import { api } from './client'

describe('map places API', () => {
  beforeEach(() => {
    transport.mockReset()
    transport.mockResolvedValue({
      data: {
        data: [{
          id: 'place-1',
          name: 'Cầu Rồng',
          categoryCode: 'ATTRACTION',
          categoryName: 'Điểm tham quan',
          latitude: 16.061,
          longitude: 108.227,
        }],
        meta: { returned: 1, limit: 80, truncated: false, zoom: 11 },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
  })

  it('requests only the current viewport with stable multi-category filters', async () => {
    const signal = new AbortController().signal
    const result = await api.mapPlaces({
      bbox: [108.12, 15.95, 108.3, 16.15],
      zoom: 11,
      categoryCodes: ['RESTAURANT', 'ATTRACTION'],
    }, signal)

    const config = transport.mock.calls[0]?.[0] as AxiosRequestConfig
    expect(config).toMatchObject({
      method: 'get',
      url: '/places/map',
      signal,
      params: {
        bbox: '108.12,15.95,108.3,16.15',
        zoom: 11,
        categoryCodes: 'ATTRACTION,RESTAURANT',
      },
    })
    expect(result.data[0]).toEqual({
      id: 'place-1',
      name: 'Cầu Rồng',
      categoryCode: 'ATTRACTION',
      categoryName: 'Điểm tham quan',
      lat: 16.061,
      lng: 108.227,
    })
  })
})
