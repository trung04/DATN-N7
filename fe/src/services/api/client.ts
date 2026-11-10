import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { DomainError } from '@/lib/errors'
import type { Hotel, RoomType } from '@/types/domain'
import type { MockRepository } from '../mock/logic'

interface Page<T> { data: T[]; meta: { page: number; limit: number; total: number } }
interface BackendHotel {
  id: string; name: string; description: string | null; address: string
  starRating: number | null; checkInTime: string
}
interface BackendRoom {
  id: string; hotelId: string; maxOccupancy: number; pricePerNight: number
  description: string | null; roomType: string
  amenities: Array<{ id: string; code: string; name: string }>
}
interface BackendCancellationPolicy {
  id: string; hotelId: string; cancellationWindow: number | null
  cancellationFeeRate: number | null; description: string | null
}

const baseURL = import.meta.env.VITE_API_BASE_URL
const client = axios.create({ baseURL, withCredentials: true, timeout: 15000, headers: { 'Content-Type': 'application/json' } })

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  if (!baseURL) throw new DomainError('CONFIG', 'Chưa cấu hình VITE_API_BASE_URL cho chế độ API.')
  try { return (await client.request<T>(config)).data }
  catch (error) {
    if (error instanceof AxiosError) {
      const response = error.response?.data as { detail?: string; message?: string; code?: string } | undefined
      throw new DomainError(response?.code ?? 'HTTP_ERROR', response?.detail ?? response?.message ?? (error.response ? 'Máy chủ trả về lỗi. Vui lòng thử lại.' : 'Không thể kết nối máy chủ.'), error.response?.status ?? 0)
    }
    throw error
  }
}

async function publicCatalog() {
  const [hotelPage, roomPage, policyPage] = await Promise.all([
    request<Page<BackendHotel>>({ method: 'GET', url: '/hotels', params: { page: 1, limit: 100 } }),
    request<Page<BackendRoom>>({ method: 'GET', url: '/rooms', params: { page: 1, limit: 100 } }),
    request<Page<BackendCancellationPolicy>>({ method: 'GET', url: '/cancellation-policies', params: { page: 1, limit: 100 } }),
  ])
  const rooms: RoomType[] = roomPage.data.map(room => ({
    id: room.id,
    hotelId: room.hotelId,
    name: room.roomType,
    description: room.description ?? '',
    capacity: room.maxOccupancy,
    area: 0,
    bed: 'Chưa cập nhật',
    basePrice: room.pricePerNight,
    amenities: room.amenities.map(amenity => amenity.name),
  }))
  const hotels: Hotel[] = hotelPage.data.map(hotel => {
    const address = hotel.address.split(',').map(part => part.trim()).filter(Boolean)
    const hotelRooms = rooms.filter(room => room.hotelId === hotel.id)
    const policy = policyPage.data.find(item => item.hotelId === hotel.id)
    return {
      id: hotel.id,
      name: hotel.name,
      city: address.at(-1) ?? hotel.address,
      area: address.length >= 3 ? address.at(-2) ?? '' : address.at(-1) ?? '',
      address: hotel.address,
      description: hotel.description ?? '',
      stars: hotel.starRating ?? 0,
      amenities: [...new Set(hotelRooms.flatMap(room => room.amenities))],
      partnerId: '',
      cancellationPolicy: policy?.description ?? 'Chưa có chính sách hủy.',
      cancellationTerms: {
        freeUntilHours: policy?.cancellationWindow ?? 0,
        lateFeeRate: (policy?.cancellationFeeRate ?? 0) / 100,
        checkInHour: Number.parseInt(hotel.checkInTime.slice(0, 2), 10),
      },
    }
  })
  return {
    destinations: [], hotels, rooms, inventory: [], availability: [],
    restaurants: [], reviews: [], categories: [], services: [],
  }
}

export const api: MockRepository = {
  publicData: publicCatalog,
  touristData: userId => request({ method: 'GET', url: '/users/' + userId + '/overview' }),
  partnerData: userId => request({ method: 'GET', url: '/partners/by-user/' + userId + '/overview' }),
  adminData: () => request({ method: 'GET', url: '/admin/overview' }),
  login: (email, password) => request({ method: 'POST', url: '/auth/login', data: { email, password } }),
  register: (name, email, password) => request({ method: 'POST', url: '/auth/register', data: { name, email, password } }),
  verifyOtp: otp => request({ method: 'POST', url: '/auth/verify-otp', data: { otp } }),
  requestOtp: email => request({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  resendOtp: () => request({ method: 'POST', url: '/auth/resend-otp' }),
  resetPassword: (email, password, otp) => request({ method: 'POST', url: '/auth/reset-password', data: { email, password, otp } }),
  saveProfile: (userId, values) => request({ method: 'PATCH', url: '/users/' + userId, data: values }),
  requestDeletion: (userId, password) => request({ method: 'POST', url: '/users/' + userId + '/deletion-request', data: { password } }),
  savePreference: (userId, pref) => request({ method: 'PUT', url: '/users/' + userId + '/preferences', data: pref }),
  clearPreference: userId => request({ method: 'DELETE', url: '/users/' + userId + '/preferences' }),
  toggleFavorite: (userId, id) => request({ method: 'POST', url: '/users/' + userId + '/favorites/toggle', data: { id } }),
  recommend: (query, userId) => request({ method: 'POST', url: '/ai/recommendations', data: { query, userId } }),
  plan: input => request({ method: 'POST', url: '/ai/trip-planner', data: input }),
  savePlannedTrip: (userId, result) => request({ method: 'POST', url: '/users/' + userId + '/trips/from-plan', data: result }),
  saveTrip: (userId, values) => request({ method: values.id ? 'PUT' : 'POST', url: '/users/' + userId + '/trips' + (values.id ? '/' + values.id : ''), data: values }),
  deleteTrip: (userId, tripId) => request({ method: 'DELETE', url: '/users/' + userId + '/trips/' + tripId }),
  saveStop: (userId, stop) => request({ method: stop.id ? 'PUT' : 'POST', url: '/users/' + userId + '/trips/' + stop.tripId + '/stops' + (stop.id ? '/' + stop.id : ''), data: stop }),
  deleteStop: (userId, stopId) => request({ method: 'DELETE', url: '/users/' + userId + '/stops/' + stopId }),
  saveActivity: (userId, activity) => request({ method: activity.id ? 'PUT' : 'POST', url: '/users/' + userId + '/stops/' + activity.stopId + '/activities' + (activity.id ? '/' + activity.id : ''), data: activity }),
  deleteActivity: (userId, activityId) => request({ method: 'DELETE', url: '/users/' + userId + '/activities/' + activityId }),
  createBooking: (userId, values) => request({ method: 'POST', url: '/users/' + userId + '/bookings', data: values, headers: { 'Idempotency-Key': crypto.randomUUID() } }),
  payBooking: (userId, bookingId) => request({ method: 'POST', url: '/users/' + userId + '/bookings/' + bookingId + '/payments', data: { provider: 'VNPAY' } }),
  cancelBooking: (userId, bookingId) => request({ method: 'POST', url: '/users/' + userId + '/bookings/' + bookingId + '/cancel' }),
  resolveRefund: () => { throw new DomainError('API_ONLY', 'Trạng thái hoàn tiền do backend/cổng thanh toán xác nhận.') },
  addReview: (userId, bookingId, stars, content) => request({ method: 'POST', url: '/users/' + userId + '/bookings/' + bookingId + '/reviews', data: { stars, content } }),
  saveRoom: (userId, room) => request({ method: room.id ? 'PUT' : 'POST', url: '/partners/by-user/' + userId + '/rooms' + (room.id ? '/' + room.id : ''), data: room }),
  saveInventory: (userId, roomId, rows) => request({ method: 'PUT', url: '/partners/by-user/' + userId + '/rooms/' + roomId + '/inventory', data: rows }),
  verifyPartner: (id, status, note, revision) => request({ method: 'POST', url: '/admin/partners/' + id + '/verification', data: { status, note, revision } }),
  saveCategory: (id, name, description, active) => request({ method: id ? 'PUT' : 'POST', url: '/admin/service-categories' + (id ? '/' + id : ''), data: { name, description, active } }),
  toggleService: id => request({ method: 'POST', url: '/admin/services/' + id + '/toggle' }),
  moderateReview: (id, status, reason) => request({ method: 'POST', url: '/admin/reviews/' + id + '/moderation', data: { status, reason } }),
  transitionSettlement: (id, next, revision) => request({ method: 'POST', url: '/admin/settlements/' + id + '/transition', data: { next, revision } }),
  reset: () => { throw new DomainError('API_ONLY', 'Chỉ có thể đặt lại dữ liệu ở chế độ demo.') },
}
