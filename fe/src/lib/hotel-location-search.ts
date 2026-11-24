import { api } from '@/services/api/client'

export interface HotelLocationResult {
  id: string
  address: string
  latitude: number
  longitude: number
}

export function searchHotelLocations(query: string, signal: AbortSignal) {
  return api.searchHotelLocations(query, signal)
}
