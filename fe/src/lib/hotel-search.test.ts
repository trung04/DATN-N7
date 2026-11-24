import { describe, expect, it } from 'vitest'
import { buildHotelSearchOptions, hotelDestinationCity, hotelSearchParams, matchesHotelKeyword, matchesHotelSelection, readHotelSearchSelection } from './hotel-search'
import type { Destination, Hotel } from '@/types/domain'

const hotel = (overrides: Partial<Hotel>): Hotel => ({
  id: 'sea', name: 'Sea Garden Hotel', city: 'Đà Nẵng', area: 'Sơn Trà', address: '68 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng',
  description: '', stars: 4, amenities: [], partnerId: '', cancellationPolicy: '', cancellationTerms: { lateFeeRate: 0 }, ...overrides,
})
const hotels = [
  hotel({ lat: 16.06, lng: 108.24, placeId: 'beach' }),
  hotel({ id: 'river', name: 'River Light Hotel', city: 'Da Nang', area: 'Hai Chau', address: '12 Bach Dang, Hai Chau, Da Nang' }),
  hotel({ id: 'pine', name: 'Pine Hill Retreat', city: 'Lâm Đồng', area: 'Đà Lạt', address: '22 Trần Hưng Đạo, Đà Lạt, Lâm Đồng', lat: 11.94, lng: 108.44 }),
]
const beach: Destination = { id: 'beach', name: 'Bãi biển Mỹ Khê', city: 'Đà Nẵng', region: 'Sơn Trà', category: 'Biển', description: '', tags: [], price: 0, lat: 16.06, lng: 108.24 }

describe('hotel destination search', () => {
  it('groups English and Vietnamese city names and counts each hotel once', () => {
    const options = buildHotelSearchOptions(hotels, [beach], '')
    expect(options.map(option => [option.title, option.hotelCount])).toEqual([['Đà Nẵng', 2], ['Đà Lạt', 1]])
    expect(hotelDestinationCity(hotels[2]!)).toBe('Đà Lạt')
  })

  it('matches unaccented queries against accented cities, addresses and hotel names', () => {
    expect(matchesHotelKeyword(hotels[0]!, 'da nang')).toBe(true)
    expect(matchesHotelKeyword(hotels[1]!, 'Đà Nẵng')).toBe(true)
    expect(matchesHotelKeyword(hotels[0]!, 'vo nguyen giap')).toBe(true)
    expect(buildHotelSearchOptions(hotels, [beach], 'my khe').map(option => option.id)).toContain('place:beach')
    expect(buildHotelSearchOptions(hotels, [beach], 'sea garden').map(option => option.id)).toEqual(['hotel:sea'])
  })

  it('keeps a selected hotel exact even when another hotel has the same name', () => {
    const selection = { kind: 'hotel' as const, label: hotels[0]!.name, hotelId: 'sea' }
    const duplicate = hotel({ id: 'other', name: hotels[0]!.name })
    expect(matchesHotelSelection(hotels[0]!, selection, [])).toBe(true)
    expect(matchesHotelSelection(duplicate, selection, [])).toBe(false)
  })

  it('scopes an area to its city and preserves all search target types in the URL', () => {
    const area = { kind: 'area' as const, label: 'Sơn Trà, Đà Nẵng', city: 'Đà Nẵng', area: 'Sơn Trà' }
    expect(matchesHotelSelection(hotels[0]!, area, [])).toBe(true)
    expect(matchesHotelSelection(hotel({ city: 'Huế', address: '1 Sơn Trà, Huế' }), area, [])).toBe(false)
    for (const selection of [area, { kind: 'hotel' as const, label: hotels[0]!.name, hotelId: 'sea' }, { kind: 'place' as const, label: beach.name, placeId: beach.id }, { kind: 'nearby' as const, label: 'Gần tôi', lat: 0, lng: 0 }]) {
      expect(readHotelSearchSelection(new URLSearchParams(hotelSearchParams(selection, selection.label)), hotels, [beach])).toEqual(selection)
    }
  })

  it('finds hotels linked to or near a landmark and returns no matches for a missing landmark', () => {
    const selection = { kind: 'place' as const, label: beach.name, placeId: beach.id }
    expect(matchesHotelSelection(hotels[0]!, selection, [beach])).toBe(true)
    expect(matchesHotelSelection(hotels[2]!, selection, [beach])).toBe(false)
    expect(matchesHotelSelection(hotels[0]!, selection, [])).toBe(false)
  })

  it('limits nearby results to 50 km and excludes hotels with unknown coordinates', () => {
    const selection = { kind: 'nearby' as const, label: 'Gần tôi', lat: 16.06, lng: 108.24 }
    expect(hotels.filter(h => matchesHotelSelection(h, selection, [])).map(h => h.id)).toEqual(['sea'])
    expect(matchesHotelSelection(hotel({ lat: 16.5, lng: 108.24 }), selection, [])).toBe(true)
    expect(matchesHotelSelection(hotel({ lat: 16.6, lng: 108.24 }), selection, [])).toBe(false)
    expect(matchesHotelSelection(hotel({ lat: 91, lng: 108.24 }), selection, [])).toBe(false)
    expect(matchesHotelSelection(hotel({ lat: 16.06, lng: undefined, placeId: beach.id }), selection, [beach])).toBe(false)
  })

  it('rejects invalid location parameters and clears a previous target when typing a new search', () => {
    for (const query of ['lat=abc&lng=108', 'lat=91&lng=108', 'lat=16&lng=181', 'lat=&lng=108', 'lat=16']) {
      expect(readHotelSearchSelection(new URLSearchParams(query), hotels, [])).toBeNull()
    }
    expect(hotelSearchParams(null, '  khách sạn mới  ')).toEqual({ city: 'khách sạn mới', area: '', hotelId: '', placeId: '', lat: '', lng: '' })
    expect(buildHotelSearchOptions(hotels, [], 'zzzz')).toEqual([])
  })
})
