import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api/client'
import { isMock, repo } from '@/services'
import { useSession } from '@/stores/session'
import type { Booking, Payment, Refund, TravelPreference } from '@/types/domain'

export const useCatalog = () => useQuery({ queryKey: ['catalog'], queryFn: repo.publicData })
export function useFavorites() {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return []
      if (!isMock) return api.myFavorites()
      const [tourist, catalog] = await Promise.all([repo.touristData(user.id), repo.publicData()])
      return tourist.favorites.map(targetId => ({
        targetId,
        targetType: catalog.hotels.some(hotel => hotel.id === targetId) ? 'HOTEL' as const : 'PLACE' as const,
        createdAt: '',
      }))
    },
    enabled: user?.role === 'tourist',
  })
}
export function useMyItineraries() {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['my-itineraries', user?.id],
    queryFn: async () => {
      if (!user) return { trips: [], stops: [], activities: [] }
      if (isMock) {
        const data = await repo.touristData(user.id)
        return { trips: data.trips, stops: data.stops.filter(stop => data.trips.some(trip => trip.id === stop.tripId)), activities: data.activities }
      }
      return api.myItineraries(user.id)
    },
    enabled: user?.role === 'tourist',
  })
}
export function useMyProfile() {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      if (isMock) return (await repo.touristData(user.id)).user ?? null
      return api.myProfile()
    },
    enabled: user?.role === 'tourist',
  })
}
export function useMyPreference() {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['my-preference', user?.id],
    queryFn: async (): Promise<{ preference: TravelPreference | null }> => {
      if (!user) return { preference: null }
      if (isMock) return { preference: (await repo.touristData(user.id)).preference ?? null }
      return { preference: await api.myPreference() }
    },
    enabled: user?.role === 'tourist',
  })
}
export function usePartnerData() {
  const user = useSession(s => s.user)
  return useQuery({ queryKey: ['partner', user?.id], queryFn: () => repo.partnerData(user?.id ?? ''), enabled: user?.role === 'partner' })
}
export const useAdminData = () => useQuery({ queryKey: ['admin'], queryFn: repo.adminData })

export function useBookings() {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['tourist-bookings', user?.id],
    queryFn: async (): Promise<{ bookings: Booking[]; payments: Payment[]; refunds: Refund[] }> => {
      if (!user) return { bookings: [], payments: [], refunds: [] }
      if (!isMock) return api.touristBookings()
      const data = await repo.touristData(user.id)
      return { bookings: data.bookings, payments: data.payments, refunds: data.refunds }
    },
    enabled: user?.role === 'tourist',
  })
}

export function useBooking(bookingId: string | undefined) {
  const user = useSession(s => s.user)
  return useQuery({
    queryKey: ['tourist-booking', user?.id, bookingId],
    queryFn: async () => {
      if (!user || !bookingId) return null
      if (!isMock) return api.touristBooking(bookingId)
      const data = await repo.touristData(user.id)
      const booking = data.bookings.find(item => item.id === bookingId)
      if (!booking) return null
      return {
        booking,
        payment: [...data.payments.filter(item => item.bookingId === bookingId)].at(-1) ?? null,
        refund: data.refunds.find(item => item.bookingId === bookingId) ?? null,
        reviewed: data.reviews.some(item => item.bookingId === bookingId),
      }
    },
    enabled: user?.role === 'tourist' && Boolean(bookingId),
    refetchInterval: query => {
      const result = query.state.data
      return result?.booking.status === 'PENDING_PAYMENT' && result.payment?.status !== 'FAILED' && result.payment?.status !== 'EXPIRED' ? 5000 : false
    },
  })
}
