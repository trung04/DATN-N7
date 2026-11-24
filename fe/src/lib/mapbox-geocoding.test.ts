import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapboxGeocodingError, searchMapboxAddresses, searchPermanentMapboxAddress } from './mapbox-geocoding'

const response = {
  features: [{
    id: 'address.1',
    geometry: { coordinates: [108.05, 15.99] },
    properties: {
      mapbox_id: 'mapbox_id_1',
      name: 'Bà Nà – Suối Mơ',
      full_address: 'Bà Nà – Suối Mơ, Đà Nẵng, Việt Nam',
      feature_type: 'place',
    },
  }],
}

afterEach(() => vi.unstubAllGlobals())

describe('Mapbox geocoding', () => {
  it('keeps autocomplete searches temporary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)))
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchMapboxAddresses('Bà Nà', 'pk.test', [108, 16], new AbortController().signal)
    const url = new URL(fetchMock.mock.calls.at(0)?.at(0) as string)

    expect(results[0]).toMatchObject({
      name: 'Bà Nà – Suối Mơ',
      address: 'Bà Nà – Suối Mơ, Đà Nẵng, Việt Nam',
      coordinates: [108.05, 15.99],
    })
    expect(url.searchParams.get('autocomplete')).toBe('true')
    expect(url.searchParams.has('permanent')).toBe(false)
  })

  it('requests a permanent, non-autocomplete result for an explicit add action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchPermanentMapboxAddress('Bà Nà', 'pk.test', [108, 16], new AbortController().signal)
    const url = new URL(fetchMock.mock.calls.at(0)?.at(0) as string)

    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('autocomplete')).toBe('false')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(result?.name).toBe('Bà Nà – Suối Mơ')
  })

  it('surfaces the provider status without exposing its response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private provider payload', { status: 429 })))

    const result = searchPermanentMapboxAddress('Bà Nà', 'pk.test', [108, 16], new AbortController().signal)
    await expect(result).rejects.toBeInstanceOf(MapboxGeocodingError)
    await expect(result).rejects.toMatchObject({ status: 429 })
  })
})
