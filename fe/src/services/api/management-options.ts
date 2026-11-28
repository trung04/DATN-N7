import { api } from './client'
import { fetchAllPages } from '@/lib/pagination'

export function loadHotelOptions(admin = false) {
  return fetchAllPages(page => {
    const query = { page, limit: 100, sortBy: 'name' as const, sortOrder: 'ASC' as const }
    return admin ? api.adminHotels(query) : api.myHotels(query)
  })
}
