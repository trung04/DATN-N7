import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { DomainError } from '@/lib/errors'
import type { AdminHotelReviewCommand, AdminHotelReviewHistory, AdminUser, AdminUserPage, AdminUserQuery, AmenityOption, BookingListQuery, CancellationPolicy, CancellationPolicyInput, CreateAdminUserInput, Hotel, HotelOwnerPage, HotelOwnerProfile, ManagedBooking, ManagedRoom, ManagedRoomInput, ManagedRoomPage, PartnerHotel, PartnerHotelDocumentInput, PartnerHotelInput, PartnerHotelPage, PartnerHotelQuery, ReportQuery, ReportSummary, ReportTimeseries, Review, ReviewManagementQuery, ReviewModerationAction, ReviewModerationHistory, ReviewSummary, Role, RoomType, UpdateAdminUserInput, User } from '@/types/domain'
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
interface BackendUser {
  id: string
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  phoneNumber: string | null
  role: 'TOURIST' | 'HOTEL_OWNER' | 'ADMIN'
  isEmailVerified: boolean
}

const roleMap: Record<BackendUser['role'], Role> = {
  TOURIST: 'tourist',
  HOTEL_OWNER: 'partner',
  ADMIN: 'admin',
}

export function mapBackendUser(user: BackendUser): User {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return {
    id: user.id,
    name: user.displayName || fullName || user.username,
    email: user.email,
    role: roleMap[user.role],
    phone: user.phoneNumber ?? undefined,
    verified: user.isEmailVerified,
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const client = axios.create({ baseURL, withCredentials: true, timeout: 15000, headers: { 'Content-Type': 'application/json' } })
const sessionClient = axios.create({ baseURL, withCredentials: true, timeout: 15000, headers: { 'Content-Type': 'application/json' } })

type RetriableRequest = InternalAxiosRequestConfig & { _sessionRetry?: boolean }
let refreshRequest: Promise<void> | null = null

client.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableRequest | undefined
  const path = config?.url ?? ''
  const canRefresh = error.response?.status === 401 && config && !config._sessionRetry
    && !['/auth/login', '/auth/refresh', '/auth/logout'].some(route => path.endsWith(route))
  if (!canRefresh) throw error

  config._sessionRetry = true
  refreshRequest ??= sessionClient.post<void>('/auth/refresh').then(() => undefined).finally(() => { refreshRequest = null })
  try {
    await refreshRequest
    return await client.request(config)
  } catch {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('smarttravel:unauthorized'))
    throw error
  }
})

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
  const [hotelPage, roomPage] = await Promise.all([
    request<Page<BackendHotel>>({ method: 'GET', url: '/hotels', params: { page: 1, limit: 100 } }),
    request<Page<BackendRoom>>({ method: 'GET', url: '/rooms', params: { page: 1, limit: 100 } }),
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
      cancellationPolicy: 'Chính sách phí được xác định khi hủy booking.',
      cancellationTerms: {
        freeUntilHours: 0,
        lateFeeRate: 0,
        checkInHour: Number.parseInt(hotel.checkInTime.slice(0, 2), 10),
      },
    }
  })
  return {
    destinations: [], hotels, rooms, inventory: [], availability: [],
    restaurants: [], reviews: [], categories: [], services: [],
  }
}

type PartnerHotelsApi = {
  myHotels: (query: PartnerHotelQuery) => Promise<PartnerHotelPage>
  myHotel: (hotelId: string) => Promise<PartnerHotel>
  createHotel: (input: PartnerHotelInput) => Promise<PartnerHotel>
  updateHotel: (hotelId: string, input: Partial<PartnerHotelInput>) => Promise<PartnerHotel>
  addHotelDocument: (hotelId: string, input: PartnerHotelDocumentInput) => Promise<PartnerHotel['documents'][number]>
  deleteHotelDocument: (hotelId: string, documentId: string) => Promise<void>
  submitHotel: (hotelId: string) => Promise<PartnerHotel>
}

type AdminHotelsApi = {
  adminHotels: (query: PartnerHotelQuery) => Promise<PartnerHotelPage>
  adminHotel: (hotelId: string) => Promise<PartnerHotel>
  adminHotelReviewHistory: (hotelId: string) => Promise<AdminHotelReviewHistory[]>
  reviewHotel: (hotelId: string, action: AdminHotelReviewCommand, reason?: string) => Promise<PartnerHotel>
}

type PartnerRoomsApi = {
  amenities: () => Promise<Page<AmenityOption>>
  managedRooms: (hotelId: string) => Promise<ManagedRoomPage>
  managedRoom: (roomId: string) => Promise<ManagedRoom>
  createManagedRoom: (input: ManagedRoomInput) => Promise<ManagedRoom>
  updateManagedRoom: (roomId: string, input: Partial<ManagedRoomInput>) => Promise<ManagedRoom>
  deleteManagedRoom: (roomId: string) => Promise<void>
}

type HotelOwnersApi = {
  hotelOwners: (page: number, limit: number, search?: string) => Promise<HotelOwnerPage>
  hotelOwnerProfile: (userId: string) => Promise<HotelOwnerProfile>
  createHotelOwnerProfile: (profile: HotelOwnerProfile) => Promise<HotelOwnerProfile>
  updateHotelOwnerProfile: (userId: string, profile: Partial<HotelOwnerProfile>) => Promise<HotelOwnerProfile>
  deleteHotelOwnerProfile: (userId: string) => Promise<void>
  createAmenity: (input: Pick<AmenityOption, 'code' | 'name'>) => Promise<AmenityOption>
  updateAmenity: (id: string, input: Partial<Pick<AmenityOption, 'code' | 'name'>>) => Promise<AmenityOption>
  deleteAmenity: (id: string) => Promise<void>
  hotelAmenities: (hotelId: string) => Promise<Page<AmenityOption>>
  createHotelAmenity: (hotelId: string, input: Pick<AmenityOption, 'code' | 'name'>) => Promise<AmenityOption>
  updateHotelAmenity: (hotelId: string, id: string, input: Partial<Pick<AmenityOption, 'code' | 'name'>>) => Promise<AmenityOption>
  deleteHotelAmenity: (hotelId: string, id: string) => Promise<void>
}

type CancellationPoliciesApi = {
  cancellationPolicies: (hotelId: string) => Promise<Page<CancellationPolicy>>
  createCancellationPolicy: (input: CancellationPolicyInput) => Promise<CancellationPolicy>
  updateCancellationPolicy: (id: string, input: Partial<CancellationPolicyInput>) => Promise<CancellationPolicy>
  deleteCancellationPolicy: (id: string) => Promise<void>
}

type BookingsManagementApi = {
  managedBookings: (query: BookingListQuery) => Promise<Page<ManagedBooking>>
  managedBooking: (bookingId: string) => Promise<ManagedBooking>
  completeManagedBooking: (bookingId: string) => Promise<ManagedBooking>
  refundManagedBooking: (bookingId: string, refundAmount: number, refundReason: string) => Promise<ManagedBooking>
  settleManagedBooking: (bookingId: string, input: { settlementBaseAmount: number; transactionId: string; bankNameSnapshot: string; bankAccountNumberSnapshot: string; bankAccountHolderSnapshot: string }) => Promise<ManagedBooking>
}

type ReviewsApi = {
  reviewPage: (query: ReviewManagementQuery) => Promise<Page<Review>>
  managedReview: (reviewId: string) => Promise<Review>
  publicReviewPage: (query: ReviewManagementQuery) => Promise<Page<Review>>
  publicReviewSummary: (hotelId: string) => Promise<ReviewSummary>
  reviewSummary: (hotelId: string) => Promise<ReviewSummary>
  myBookingReview: (bookingId: string) => Promise<Review | null>
  reviewHistory: (reviewId: string) => Promise<ReviewModerationHistory[]>
  createBookingReview: (bookingId: string, stars: number, content: string) => Promise<Review>
  moderateManagedReview: (reviewId: string, action: ReviewModerationAction, reason?: string, note?: string) => Promise<Review>
}

type ReportsApi = {
  reportSummary: (query: ReportQuery) => Promise<ReportSummary>
  reportTimeseries: (query: ReportQuery) => Promise<ReportTimeseries>
}

export const api: MockRepository & PartnerHotelsApi & AdminHotelsApi & PartnerRoomsApi & HotelOwnersApi & CancellationPoliciesApi & BookingsManagementApi & ReviewsApi & ReportsApi = {
  publicData: publicCatalog,
  touristData: userId => request({ method: 'GET', url: '/users/' + userId + '/overview' }),
  partnerData: userId => request({ method: 'GET', url: '/partners/by-user/' + userId + '/overview' }),
  adminData: () => request({ method: 'GET', url: '/admin/overview' }),
  adminUsers: (query: AdminUserQuery) => request<AdminUserPage>({ method: 'GET', url: '/users', params: query }),
  adminUser: (userId: string) => request<AdminUser>({ method: 'GET', url: '/users/' + userId }),
  createAdminUser: (input: CreateAdminUserInput) => request<AdminUser>({ method: 'POST', url: '/users', data: input }),
  updateAdminUser: (userId: string, input: UpdateAdminUserInput) => request<AdminUser>({ method: 'PATCH', url: '/users/' + userId, data: input }),
  resetAdminUserPassword: (userId: string, newPassword: string) => request<void>({ method: 'PUT', url: '/users/' + userId + '/password', data: { newPassword } }),
  deleteAdminUser: (userId: string) => request<void>({ method: 'DELETE', url: '/users/' + userId }),
  myHotels: (query: PartnerHotelQuery) => request<PartnerHotelPage>({ method: 'GET', url: '/hotels/mine', params: query }),
  myHotel: (hotelId: string) => request<PartnerHotel>({ method: 'GET', url: '/hotels/mine/' + hotelId }),
  createHotel: (input: PartnerHotelInput) => request<PartnerHotel>({ method: 'POST', url: '/hotels', data: input }),
  updateHotel: (hotelId: string, input: Partial<PartnerHotelInput>) => request<PartnerHotel>({ method: 'PATCH', url: '/hotels/' + hotelId, data: input }),
  addHotelDocument: (hotelId: string, input: PartnerHotelDocumentInput) => request<PartnerHotel['documents'][number]>({ method: 'POST', url: '/hotels/' + hotelId + '/documents', data: input }),
  deleteHotelDocument: (hotelId: string, documentId: string) => request<void>({ method: 'DELETE', url: '/hotels/' + hotelId + '/documents/' + documentId }),
  submitHotel: (hotelId: string) => request<PartnerHotel>({ method: 'PUT', url: '/hotels/' + hotelId + '/submit' }),
  adminHotels: (query: PartnerHotelQuery) => request<PartnerHotelPage>({ method: 'GET', url: '/admin/hotels', params: query }),
  adminHotel: (hotelId: string) => request<PartnerHotel>({ method: 'GET', url: '/admin/hotels/' + hotelId }),
  adminHotelReviewHistory: (hotelId: string) => request<AdminHotelReviewHistory[]>({ method: 'GET', url: '/admin/hotels/' + hotelId + '/review-history' }),
  reviewHotel: (hotelId: string, action: AdminHotelReviewCommand, reason?: string) => request<PartnerHotel>({ method: 'PATCH', url: '/admin/hotels/' + hotelId + '/status', data: { action, ...(reason ? { reason } : {}) } }),
  amenities: () => request<Page<AmenityOption>>({ method: 'GET', url: '/amenities', params: { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' } }),
  managedRooms: hotelId => request<ManagedRoomPage>({ method: 'GET', url: '/rooms', params: { page: 1, limit: 100, hotelId, sortBy: 'roomNumber', sortOrder: 'ASC' } }),
  managedRoom: roomId => request<ManagedRoom>({ method: 'GET', url: '/rooms/' + roomId }),
  createManagedRoom: input => request<ManagedRoom>({ method: 'POST', url: '/rooms', data: input }),
  updateManagedRoom: (roomId, input) => request<ManagedRoom>({ method: 'PATCH', url: '/rooms/' + roomId, data: input }),
  deleteManagedRoom: roomId => request<void>({ method: 'DELETE', url: '/rooms/' + roomId }),
  hotelOwners: (page, limit, search) => request<HotelOwnerPage>({ method: 'GET', url: '/hotel-owners', params: { page, limit, ...(search ? { search } : {}), sortBy: 'userId', sortOrder: 'ASC' } }),
  hotelOwnerProfile: userId => request<HotelOwnerProfile>({ method: 'GET', url: '/hotel-owners/' + userId }),
  createHotelOwnerProfile: input => request<HotelOwnerProfile>({ method: 'POST', url: '/hotel-owners', data: input }),
  updateHotelOwnerProfile: (userId, input) => request<HotelOwnerProfile>({ method: 'PATCH', url: '/hotel-owners/' + userId, data: input }),
  deleteHotelOwnerProfile: userId => request<void>({ method: 'DELETE', url: '/hotel-owners/' + userId }),
  createAmenity: input => request<AmenityOption>({ method: 'POST', url: '/amenities', data: input }),
  updateAmenity: (id, input) => request<AmenityOption>({ method: 'PATCH', url: '/amenities/' + id, data: input }),
  deleteAmenity: id => request<void>({ method: 'DELETE', url: '/amenities/' + id }),
  hotelAmenities: hotelId => request<Page<AmenityOption>>({ method: 'GET', url: '/hotels/' + hotelId + '/amenities', params: { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' } }),
  createHotelAmenity: (hotelId, input) => request<AmenityOption>({ method: 'POST', url: '/hotels/' + hotelId + '/amenities', data: input }),
  updateHotelAmenity: (hotelId, id, input) => request<AmenityOption>({ method: 'PATCH', url: '/hotels/' + hotelId + '/amenities/' + id, data: input }),
  deleteHotelAmenity: (hotelId, id) => request<void>({ method: 'DELETE', url: '/hotels/' + hotelId + '/amenities/' + id }),
  cancellationPolicies: hotelId => request<Page<CancellationPolicy>>({ method: 'GET', url: '/cancellation-policies', params: { page: 1, limit: 100, hotelId, sortBy: 'name', sortOrder: 'ASC' } }),
  createCancellationPolicy: input => request<CancellationPolicy>({ method: 'POST', url: '/cancellation-policies', data: input }),
  updateCancellationPolicy: (id, input) => request<CancellationPolicy>({ method: 'PATCH', url: '/cancellation-policies/' + id, data: input }),
  deleteCancellationPolicy: id => request<void>({ method: 'DELETE', url: '/cancellation-policies/' + id }),
  managedBookings: query => request<Page<ManagedBooking>>({ method: 'GET', url: '/bookings', params: query }),
  managedBooking: bookingId => request<ManagedBooking>({ method: 'GET', url: '/bookings/' + bookingId }),
  completeManagedBooking: bookingId => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/complete' }),
  refundManagedBooking: (bookingId, refundAmount, refundReason) => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/refund', data: { refundAmount, refundReason } }),
  settleManagedBooking: (bookingId, input) => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/settlement', data: input }),
  reviewPage: query => request<Page<Review>>({ method: 'GET', url: '/reviews', params: query }),
  managedReview: reviewId => request<Review>({ method: 'GET', url: '/reviews/' + reviewId }),
  publicReviewPage: query => request<Page<Review>>({ method: 'GET', url: '/reviews/public', params: query }),
  publicReviewSummary: hotelId => request<ReviewSummary>({ method: 'GET', url: '/reviews/summary', params: { hotelId } }),
  reviewSummary: hotelId => request<ReviewSummary>({ method: 'GET', url: '/reviews/summary/management', params: { hotelId } }),
  myBookingReview: bookingId => request<Review | null>({ method: 'GET', url: '/bookings/' + bookingId + '/reviews/mine' }),
  reviewHistory: reviewId => request<ReviewModerationHistory[]>({ method: 'GET', url: '/reviews/' + reviewId + '/history' }),
  createBookingReview: (bookingId, stars, content) => request<Review>({ method: 'POST', url: '/bookings/' + bookingId + '/reviews', data: { stars, content } }),
  moderateManagedReview: (reviewId, action, reason, note) => request<Review>({ method: 'PATCH', url: '/reviews/' + reviewId + '/moderation', data: { action, ...(reason ? { reason } : {}), ...(note ? { note } : {}) } }),
  reportSummary: query => request<ReportSummary>({ method: 'GET', url: '/reports/summary', params: query }),
  reportTimeseries: query => request<ReportTimeseries>({ method: 'GET', url: '/reports/timeseries', params: query }),
  currentUser: () => request<BackendUser>({ method: 'GET', url: '/auth/me' }).then(mapBackendUser),
  login: (username, password) => request<BackendUser>({ method: 'POST', url: '/auth/login', data: { username, password } }).then(mapBackendUser),
  logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
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
  cancelBooking: (_userId, bookingId) => request({ method: 'POST', url: '/bookings/' + bookingId + '/cancel' }),
  resolveRefund: () => { throw new DomainError('API_ONLY', 'Trạng thái hoàn tiền do backend/cổng thanh toán xác nhận.') },
  addReview: (_userId, bookingId, stars, content) => request({ method: 'POST', url: '/bookings/' + bookingId + '/reviews', data: { stars, content } }),
  saveRoom: (userId, room) => request({ method: room.id ? 'PUT' : 'POST', url: '/partners/by-user/' + userId + '/rooms' + (room.id ? '/' + room.id : ''), data: room }),
  saveInventory: (userId, roomId, rows) => request({ method: 'PUT', url: '/partners/by-user/' + userId + '/rooms/' + roomId + '/inventory', data: rows }),
  verifyPartner: (id, status, note, revision) => request({ method: 'POST', url: '/admin/partners/' + id + '/verification', data: { status, note, revision } }),
  saveCategory: (id, name, description, active) => request({ method: id ? 'PUT' : 'POST', url: '/admin/service-categories' + (id ? '/' + id : ''), data: { name, description, active } }),
  toggleService: id => request({ method: 'POST', url: '/admin/services/' + id + '/toggle' }),
  moderateReview: (id, status, reason) => request({ method: 'POST', url: '/admin/reviews/' + id + '/moderation', data: { status, reason } }),
  transitionSettlement: (id, next, revision) => request({ method: 'POST', url: '/admin/settlements/' + id + '/transition', data: { next, revision } }),
  reset: () => { throw new DomainError('API_ONLY', 'Chỉ có thể đặt lại dữ liệu ở chế độ demo.') },
}
