import type { Destination, Hotel } from '@/types/domain'
import { hasValidCoordinates } from './coordinates'

export const NEARBY_HOTEL_RADIUS_KM = 50

export type HotelSearchSelection =
  | { kind: 'city'; label: string; city: string }
  | { kind: 'area'; label: string; city: string; area: string }
  | { kind: 'place'; label: string; placeId: string }
  | { kind: 'hotel'; label: string; hotelId: string }
  | { kind: 'nearby'; label: string; lat: number; lng: number }

export interface HotelSearchOption {
  id: string
  title: string
  subtitle: string
  badge: string
  hotelCount: number
  searchText: string
  selection: HotelSearchSelection
}

export function normalizeHotelSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const cityNames: Record<string, string> = {
  'da nang': 'Đà Nẵng', 'da lat': 'Đà Lạt', dalat: 'Đà Lạt', 'hoi an': 'Hội An', hue: 'Huế',
  hanoi: 'Hà Nội', 'ha noi': 'Hà Nội', 'ha long': 'Hạ Long', 'nha trang': 'Nha Trang',
  'phu quoc': 'Phú Quốc', 'sa pa': 'Sa Pa', sapa: 'Sa Pa', 'quy nhon': 'Quy Nhơn',
  'can tho': 'Cần Thơ', 'phan thiet': 'Phan Thiết', 'ninh binh': 'Ninh Bình',
  'vung tau': 'Vũng Tàu', 'ho chi minh city': 'TP. Hồ Chí Minh', 'ho chi minh': 'TP. Hồ Chí Minh',
  'tp ho chi minh': 'TP. Hồ Chí Minh', 'thanh pho ho chi minh': 'TP. Hồ Chí Minh',
  'tp hcm': 'TP. Hồ Chí Minh', tphcm: 'TP. Hồ Chí Minh', saigon: 'TP. Hồ Chí Minh',
  'sai gon': 'TP. Hồ Chí Minh', 'phong nha': 'Phong Nha',
}

export function hotelDestinationCity(hotel: Pick<Hotel, 'city' | 'address'>): string {
  // Older addresses may end in a province instead of the destination city.
  const parts = hotel.address.split(',').map(part => part.trim()).reverse()
  for (const part of parts) {
    const city = cityNames[normalizeHotelSearch(part)]
    if (city) return city
  }
  return cityNames[normalizeHotelSearch(hotel.city)] ?? hotel.city.trim()
}

function cityKey(value: string): string {
  const normalized = normalizeHotelSearch(value)
  return normalizeHotelSearch(cityNames[normalized] ?? value)
}

export function matchesHotelKeyword(hotel: Hotel, keyword: string): boolean {
  const normalized = normalizeHotelSearch(keyword)
  const canonicalCity = cityKey(keyword)
  const text = normalizeHotelSearch([hotel.name, hotelDestinationCity(hotel), hotel.city, hotel.area, hotel.address].join(' '))
  return !normalized || canonicalCity === cityKey(hotelDestinationCity(hotel))
    || normalized.split(' ').every(word => text.includes(word))
}

export function distanceInKm(from: { lat?: number; lng?: number }, to: { lat?: number; lng?: number }): number {
  if (!hasValidCoordinates(from.lat, from.lng) || !hasValidCoordinates(to.lat, to.lng)) return Infinity
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latDifference = radians(to.lat! - from.lat!)
  const lngDifference = radians(to.lng! - from.lng!)
  const value = Math.sin(latDifference / 2) ** 2
    + Math.cos(radians(from.lat!)) * Math.cos(radians(to.lat!)) * Math.sin(lngDifference / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)))
}

export function hotelMatchesPlace(hotel: Hotel, place: Destination): boolean {
  return hotel.placeId === place.id || distanceInKm(hotel, place) <= 20
    || matchesHotelKeyword(hotel, place.name)
    || (cityKey(hotelDestinationCity(hotel)) === cityKey(place.city)
      && normalizeHotelSearch(hotel.area) !== ''
      && normalizeHotelSearch(place.region).includes(normalizeHotelSearch(hotel.area)))
}

export function buildHotelSearchOptions(hotels: Hotel[], destinations: Destination[], query: string): HotelSearchOption[] {
  const cities = new Map<string, { name: string; count: number }>()
  const areas = new Map<string, { city: string; area: string; count: number }>()
  for (const hotel of hotels) {
    const city = hotelDestinationCity(hotel)
    if (!city) continue
    const key = cityKey(city)
    cities.set(key, { name: city, count: (cities.get(key)?.count ?? 0) + 1 })
    const area = hotel.area.trim()
    if (area && cityKey(area) !== key) {
      const areaKey = key + ':' + normalizeHotelSearch(area)
      areas.set(areaKey, { city, area, count: (areas.get(areaKey)?.count ?? 0) + 1 })
    }
  }

  const options: HotelSearchOption[] = [...cities.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, 'vi'))
    .map(([id, city]) => ({
      id: 'city:' + id, title: city.name, subtitle: 'Việt Nam', badge: 'Thành phố', hotelCount: city.count,
      searchText: normalizeHotelSearch(city.name + ' ' + Object.entries(cityNames).filter(([, name]) => name === city.name).map(([alias]) => alias).join(' ')),
      selection: { kind: 'city', label: city.name, city: city.name },
    }))

  const words = normalizeHotelSearch(query).split(' ').filter(Boolean)
  if (!words.length) return options

  for (const [id, area] of areas) options.push({
    id: 'area:' + id, title: area.area, subtitle: area.city + ', Việt Nam', badge: 'Khu vực', hotelCount: area.count,
    searchText: normalizeHotelSearch(area.area + ' ' + area.city),
    selection: { kind: 'area', label: area.area + ', ' + area.city, city: area.city, area: area.area },
  })
  for (const place of destinations) {
    if (place.category === 'Khách sạn' || place.category === 'HOTEL') continue
    const count = hotels.filter(hotel => hotelMatchesPlace(hotel, place)).length
    if (!count) continue
    options.push({
      id: 'place:' + place.id, title: place.name, subtitle: [place.city, 'Việt Nam'].filter(Boolean).join(', '),
      badge: 'Địa điểm', hotelCount: count, searchText: normalizeHotelSearch(place.name + ' ' + place.city),
      selection: { kind: 'place', label: place.name, placeId: place.id },
    })
  }
  for (const hotel of hotels) options.push({
    id: 'hotel:' + hotel.id, title: hotel.name, subtitle: hotel.address, badge: 'Khách sạn', hotelCount: 1,
    searchText: normalizeHotelSearch([hotel.name, hotelDestinationCity(hotel), hotel.area, hotel.address].join(' ')),
    selection: { kind: 'hotel', label: hotel.name, hotelId: hotel.id },
  })

  return options.filter(option => words.every(word => option.searchText.includes(word)))
    .sort((a, b) => Number(b.searchText.startsWith(words.join(' '))) - Number(a.searchText.startsWith(words.join(' '))))
    .slice(0, 40)
}

export function hotelSearchParams(selection: HotelSearchSelection | null, keyword: string): Record<string, string> {
  const values = { city: '', area: '', hotelId: '', placeId: '', lat: '', lng: '' }
  if (!selection) return { ...values, city: keyword.trim() }
  switch (selection.kind) {
    case 'city': return { ...values, city: selection.city }
    case 'area': return { ...values, city: selection.city, area: selection.area }
    case 'hotel': return { ...values, hotelId: selection.hotelId }
    case 'place': return { ...values, placeId: selection.placeId }
    case 'nearby': return { ...values, lat: String(selection.lat), lng: String(selection.lng) }
  }
}

export function readHotelSearchSelection(params: URLSearchParams, hotels: Hotel[], destinations: Destination[]): HotelSearchSelection | null {
  const hotelId = params.get('hotelId')
  if (hotelId) return { kind: 'hotel', label: hotels.find(hotel => hotel.id === hotelId)?.name ?? 'Khách sạn đã chọn', hotelId }
  const placeId = params.get('placeId')
  if (placeId) return { kind: 'place', label: destinations.find(place => place.id === placeId)?.name ?? 'Địa điểm đã chọn', placeId }
  const latitude = params.get('lat')
  const longitude = params.get('lng')
  if (latitude?.trim() && longitude?.trim()) {
    const lat = Number(latitude), lng = Number(longitude)
    if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180) {
      return { kind: 'nearby', label: 'Gần tôi', lat, lng }
    }
  }
  const city = params.get('city')?.trim()
  if (!city) return null
  const area = params.get('area')?.trim()
  return area ? { kind: 'area', label: area + ', ' + city, city, area } : { kind: 'city', label: city, city }
}

export function matchesHotelSelection(hotel: Hotel, selection: HotelSearchSelection | null, destinations: Destination[]): boolean {
  if (!selection) return true
  switch (selection.kind) {
    case 'city': return matchesHotelKeyword(hotel, selection.city)
    case 'area': return cityKey(hotelDestinationCity(hotel)) === cityKey(selection.city)
      && normalizeHotelSearch(hotel.area) === normalizeHotelSearch(selection.area)
    case 'hotel': return hotel.id === selection.hotelId
    case 'place': {
      const place = destinations.find(item => item.id === selection.placeId)
      return Boolean(place && hotelMatchesPlace(hotel, place))
    }
    case 'nearby': return distanceInKm(hotel, selection) <= NEARBY_HOTEL_RADIUS_KM
  }
}
