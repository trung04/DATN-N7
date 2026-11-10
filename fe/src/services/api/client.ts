import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { DomainError } from '@/lib/errors'
import type { MockRepository } from '../mock/logic'

const baseURL = import.meta.env.VITE_API_BASE_URL
const client = axios.create({ baseURL, withCredentials: true, timeout: 15000, headers: { 'Content-Type': 'application/json' } })

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  if (!baseURL) throw new DomainError('CONFIG', 'Chưa cấu hình VITE_API_BASE_URL cho chế độ API.')
  try { return (await client.request<T>(config)).data }
  catch (error) {
    if (error instanceof AxiosError) {
      const response = error.response?.data as { message?: string; code?: string } | undefined
      throw new DomainError(response?.code ?? 'HTTP_ERROR', response?.message ?? (error.response ? 'Máy chủ trả về lỗi. Vui lòng thử lại.' : 'Không thể kết nối máy chủ.'), error.response?.status ?? 0)
    }
    throw error
  }
}

// The paths below are a proposed contract. No backend is bundled with this app.
export const api: MockRepository = {
  publicData: () => request({ method: 'GET', url: '/catalog' }),
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
