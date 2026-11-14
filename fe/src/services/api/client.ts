import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { DomainError } from '@/lib/errors'
import type { AdminHotelReviewCommand, AdminHotelReviewHistory, AdminPlace, AdminUser, AdminUserPage, AdminUserQuery, AmenityOption, Booking, BookingInput, BookingListQuery, CancellationPolicy, CancellationPolicyInput, CancellationPolicySchedule, CancellationPolicySnapshot, CreateAdminUserInput, Destination, Hotel, HotelOwnerPage, HotelOwnerProfile, Itinerary, ManagedBooking, ManagedRoom, ManagedRoomInput, ManagedRoomPage, Notification, PartnerHotel, PartnerHotelDocumentInput, PartnerHotelInput, PartnerHotelPage, PartnerHotelQuery, Payment, PlaceAdminListItem, PlaceAdminRequest, PlaceCatalogOptions, PlannerResult, Refund, ReportQuery, ReportSummary, ReportTimeseries, Review, ReviewManagementQuery, ReviewModerationAction, ReviewModerationHistory, ReviewSummary, Role, RoomType, SettlementBatch, SettlementStatus, Stopover, TravelActivity, TravelPreference, UpdateAdminUserInput, User, UserProfileInput } from '@/types/domain'
import type { MockRepository } from '../mock/logic'

interface Page<T> { data: T[]; meta: { page: number; limit: number; total: number } }
interface BackendHotel {
  id: string; name: string; description: string | null; address: string
  starRating: number | null; checkInTime: string
  images: PartnerHotel['images']
}
interface BackendRoom {
  id: string; hotelId: string; maxOccupancy: number; pricePerNight: number
  description: string | null; roomType: string; roomNumber: string
  operationalStatus: 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
  amenities: Array<{ id: string; code: string; name: string }>
}
interface BackendPlace {
  id: string; name: string; city: string | null; category: string | null
  address: string | null; description?: string | null; primaryImageUrl?: string | null
  tags?: string[]; latitude?: number | null; longitude?: number | null
  status?: 'ACTIVE' | 'INACTIVE'
  price?: { isFree: boolean; minPrice: number; maxPrice: number; currency: string; pricingUnit?: string; description?: string | null } | null
}
const placeCategoryLabels: Record<string, string> = {
  ATTRACTION: 'Điểm tham quan',
  RESTAURANT: 'Nhà hàng',
  HOTEL: 'Khách sạn',
}
interface BackendItinerary {
  id: string; touristUserId: string; name: string; destinationCity: string
  description: string | null; startDate: string; endDate: string; adultCount: number
  childCount: number; budget: number | null; status: 'DRAFT' | 'SAVED' | 'ARCHIVED'
  isAiGenerated: boolean
}
interface BackendStopover {
  id: string; itineraryId: string; placeId: string; stopOrder: number
  arrivalTime: string; departureTime: string; description: string | null
}
interface BackendActivity {
  id: string; stopoverId: string; activityOrder: number; name: string
  description: string | null; startTime: string; endTime: string
  estimatedCost: number | null; currency: string
}
interface BackendBooking {
  id: string; hotelId: string; touristId: string; bookingCode: string
  createdAt: string; checkInDate: string; checkOutDate: string
  adultCount: number; childCount: number; guestName: string; guestEmail: string
  guestPhone: string; specialRequests: string | null
  bookingStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  cancelledAt: string | null; reservationExpiresAt: string
  totalAmount: number; amount: number; paymentStatus: 'PENDING' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
  paymentCreatedAt: string | null; paymentExpiresAt: string | null; paidAt: string | null
  paymentTransactionId: string | null
  cancellationPolicySnapshot: CancellationPolicySnapshot | null
  cancellationAllowedNow: boolean
  cancellationUnavailableReason: string | null
  cancellationFeeAmountNow: number | null
  cancellationDescriptionSnapshot: string | null; cancellationFeeAmount: number | null
  refundAmount: number | null; refundStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED'
  refundRequestedAt: string | null; refundProcessingAt: string | null; refundAttempt: number
  refundFailureReason: string | null; refundFailedAt: string | null
  refundedAt: string | null; refundTransactionId: string | null
  roomItems: Array<{ roomId: string; roomNumberSnapshot: string; roomTypeSnapshot: string; maxOccupancySnapshot: number; pricePerNight: number; numberOfNights: number }>
}
type BackendBookingPage = Page<BackendBooking>
interface BackendUser {
  id: string
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  displayName: string | null
  phoneNumber: string | null
  dateOfBirth?: string | null
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED' | null
  role: 'TOURIST' | 'HOTEL_OWNER' | 'ADMIN'
  isEmailVerified: boolean
  googleAccountLinked?: boolean
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  createdAt?: string
  updatedAt?: string
}

const roleMap: Record<BackendUser['role'], Role> = {
  TOURIST: 'tourist',
  HOTEL_OWNER: 'partner',
  ADMIN: 'admin',
}

const mapBookingStatus = (booking: BackendBooking): Booking['status'] => {
  if (booking.bookingStatus === 'CANCELLED') return 'CANCELLED'
  if (booking.bookingStatus === 'COMPLETED') return 'COMPLETED'
  if (booking.bookingStatus === 'CONFIRMED') return 'CONFIRMED'
  if (booking.paymentStatus === 'EXPIRED' || (booking.paymentStatus === 'PENDING' && Date.parse(booking.reservationExpiresAt) <= Date.now())) return 'EXPIRED'
  return 'PENDING_PAYMENT'
}

export function mapBackendBooking(booking: BackendBooking): Booking {
  const firstRoom = booking.roomItems[0]
  const nights = Math.max(1, firstRoom?.numberOfNights ?? 1)
  const nightlyTotal = booking.roomItems.reduce((total, room) => total + room.pricePerNight, 0)
  return {
    id: booking.id,
    bookingCode: booking.bookingCode,
    userId: booking.touristId,
    hotelId: booking.hotelId,
    roomId: firstRoom?.roomId ?? '',
    roomIds: booking.roomItems.map(room => room.roomId),
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
    rooms: booking.roomItems.length,
    adults: booking.adultCount,
    children: booking.childCount,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    specialRequest: booking.specialRequests ?? '',
    total: booking.totalAmount,
    nightlyPrices: Array.from({ length: nights }, () => nightlyTotal),
    status: mapBookingStatus(booking),
    holdExpiresAt: booking.paymentExpiresAt ?? booking.reservationExpiresAt,
    createdAt: booking.createdAt,
    ...(booking.cancelledAt ? { cancelledAt: booking.cancelledAt } : {}),
    ...(booking.cancellationFeeAmount !== null ? { cancellationFee: booking.cancellationFeeAmount } : {}),
    policySnapshot: booking.cancellationDescriptionSnapshot ?? 'Chính sách hủy sẽ được áp dụng theo quy định của khách sạn tại thời điểm hủy.',
    policyTermsSnapshot: { freeUntilHours: 0, lateFeeRate: 0, checkInHour: 14 },
    cancellationAllowedNow: booking.cancellationAllowedNow,
    cancellationUnavailableReason: booking.cancellationUnavailableReason,
    cancellationFeeAmountNow: booking.cancellationFeeAmountNow,
    cancellationPolicySnapshot: booking.cancellationPolicySnapshot ?? undefined,
    cancellationRulesSnapshot: booking.cancellationPolicySnapshot?.rules,
  }
}

function mapBackendPayment(booking: BackendBooking): Payment {
  const status = booking.paymentStatus === 'PAYMENT_PENDING' ? 'PROCESSING' : booking.paymentStatus
  return {
    id: booking.paymentTransactionId ?? booking.id,
    bookingId: booking.id,
    status,
    amount: booking.amount,
    createdAt: booking.paymentCreatedAt ?? booking.createdAt,
    ...(booking.paymentTransactionId ? { reference: booking.paymentTransactionId } : {}),
  }
}

function mapBackendRefund(booking: BackendBooking): Refund | null {
  if (booking.refundStatus === 'NONE' || booking.refundAmount === null) return null
  return {
    id: booking.refundTransactionId ?? booking.id,
    bookingId: booking.id,
    status: booking.refundStatus,
    amount: booking.refundAmount,
    createdAt: booking.refundRequestedAt ?? booking.createdAt,
    ...(booking.refundFailureReason ? { failureReason: booking.refundFailureReason } : {}),
    ...(booking.refundFailedAt ? { failedAt: booking.refundFailedAt } : {}),
    ...(booking.refundTransactionId ? { reference: booking.refundTransactionId } : {}),
  }
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
    ...(user.dateOfBirth !== undefined ? { dateOfBirth: user.dateOfBirth } : {}),
    ...(user.gender !== undefined ? { gender: user.gender } : {}),
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const interestCodesByLabel: Record<string, string> = {
  'Bi\u1ec3n': 'BEACH',
  'Thi\u00ean nhi\u00ean': 'NATURE',
  '\u1ea8m th\u1ef1c': 'FOOD',
  'V\u0103n h\u00f3a': 'CULTURE',
  'Mua s\u1eafm': 'SHOPPING',
  'Ngh\u1ec9 d\u01b0\u1ee1ng': 'RELAXATION',
  'Kh\u00e1m ph\u00e1': 'EXPLORATION',
  'Gia \u0111\u00ecnh': 'FAMILY',
}
export function apiAssetUrl(path: string): string {
  return new URL(path, new URL(baseURL, window.location.origin)).href
}
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
  const [hotelPage, roomPage, placePage] = await Promise.all([
    request<Page<BackendHotel>>({ method: 'GET', url: '/hotels', params: { page: 1, limit: 100 } }),
    request<Page<BackendRoom>>({ method: 'GET', url: '/rooms', params: { page: 1, limit: 100 } }),
    request<Page<BackendPlace>>({ method: 'GET', url: '/places', params: { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' } }),
  ])
  const destinations: Destination[] = placePage.data.map(place => ({
    id: place.id,
    name: place.name,
    city: place.city ?? '',
    region: place.address ?? place.city ?? '',
    category: place.category
      ? placeCategoryLabels[place.category] ?? place.category
      : 'Điểm tham quan',
    description: place.description ?? '',
    tags: place.tags ?? [],
    price: place.price?.isFree ? 0 : place.price?.minPrice ?? 0,
    ...(place.latitude != null ? { lat: place.latitude } : {}),
    ...(place.longitude != null ? { lng: place.longitude } : {}),
    ...(place.primaryImageUrl ? { image: apiAssetUrl(place.primaryImageUrl) } : {}),
  }))
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
    roomNumber: room.roomNumber,
    operationalStatus: room.operationalStatus,
  }))
  const hotels: Hotel[] = hotelPage.data.map(hotel => {
    const address = hotel.address.split(',').map(part => part.trim()).filter(Boolean)
    const hotelRooms = rooms.filter(room => room.hotelId === hotel.id)
    return {
      id: hotel.id,
      name: hotel.name,
      city: address.at(-1) ?? hotel.address,
      area: address.length >= 2 ? address.at(-2) ?? '' : '',
      address: hotel.address,
      description: hotel.description ?? '',
      stars: hotel.starRating ?? 0,
      image: hotel.images?.[0] ? apiAssetUrl(hotel.images[0].url) : undefined,
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
    destinations, hotels, rooms, inventory: [], availability: [],
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
  uploadHotelImage: (hotelId: string, file: File) => Promise<PartnerHotel['images'][number]>
  deleteHotelImage: (hotelId: string, imageId: string) => Promise<void>
  submitHotel: (hotelId: string) => Promise<PartnerHotel>
}

export type FavoriteTargetType = 'PLACE' | 'HOTEL'
export type ApiFavorite = { targetType: FavoriteTargetType; targetId: string; createdAt: string }

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

type PlaceManagementApi = {
  adminPlaces: (query?: { page?: number; limit?: number; search?: string; status?: 'ACTIVE' | 'INACTIVE' }) => Promise<Page<PlaceAdminListItem>>
  adminPlace: (placeId: string) => Promise<AdminPlace>
  placeCatalogOptions: () => Promise<PlaceCatalogOptions>
  createPlace: (input: PlaceAdminRequest) => Promise<AdminPlace>
  updatePlace: (placeId: string, input: PlaceAdminRequest) => Promise<AdminPlace>
  deletePlace: (placeId: string) => Promise<void>
}

type CancellationPoliciesApi = {
  cancellationPolicies: (hotelId: string) => Promise<Page<CancellationPolicy>>
  cancellationPolicySchedule: (hotelId: string) => Promise<CancellationPolicySchedule>
  createCancellationPolicy: (input: CancellationPolicyInput) => Promise<CancellationPolicy>
  updateCancellationPolicy: (id: string, input: Partial<CancellationPolicyInput>) => Promise<CancellationPolicy>
  deleteCancellationPolicy: (id: string) => Promise<void>
}

type BookingsManagementApi = {
  managedBookings: (query: BookingListQuery) => Promise<Page<ManagedBooking>>
  managedBooking: (bookingId: string) => Promise<ManagedBooking>
  completeManagedBooking: (bookingId: string) => Promise<ManagedBooking>
  refundManagedBooking: (bookingId: string, refundAmount: number, refundReason: string) => Promise<ManagedBooking>
  syncManagedRefund: (bookingId: string) => Promise<ManagedBooking>
}

type SettlementsApi = {
  settlementBatches: (filters?: { hotelId?: string; status?: SettlementStatus }) => Promise<SettlementBatch[]>
  settlementBatch: (id: string) => Promise<SettlementBatch>
  createSettlementBatch: (input: { hotelId: string; periodStart: string; periodEnd: string }) => Promise<SettlementBatch>
  approveSettlementBatch: (id: string) => Promise<SettlementBatch>
  startSettlementBatch: (id: string) => Promise<SettlementBatch>
  confirmSettlementBatch: (id: string, transferReference: string) => Promise<SettlementBatch>
  failSettlementBatch: (id: string, reason: string) => Promise<SettlementBatch>
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

const toDateTimeInput = (value: string) => {
  const localDate = new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}
const toBackendTime = (value: string) => new Date(value).toISOString()

async function loadMyItineraries(userId: string) {
  const page = await request<Page<BackendItinerary>>({
    method: 'GET', url: '/itineraries',
    params: { page: 1, limit: 100, sortBy: 'updatedAt', sortOrder: 'DESC' },
  })
  const stopPages = await Promise.all(page.data.map(itinerary => request<Page<BackendStopover>>({
    method: 'GET', url: '/itineraries/' + itinerary.id + '/stopovers',
    params: { page: 1, limit: 100, sortBy: 'stopOrder', sortOrder: 'ASC' },
  })))
  const backendStops = stopPages.flatMap(response => response.data)
  const placeIds = [...new Set(backendStops.map(stop => stop.placeId))]
  const places = await Promise.all(placeIds.map(id => request<BackendPlace>({ method: 'GET', url: '/places/' + id })))
  const placeById = new Map(places.map(place => [place.id, place]))
  const activityPages = await Promise.all(backendStops.map(stop => request<Page<BackendActivity>>({
    method: 'GET', url: '/stopovers/' + stop.id + '/activities',
    params: { page: 1, limit: 100, sortBy: 'activityOrder', sortOrder: 'ASC' },
  })))
  const trips: Itinerary[] = page.data.map(itinerary => ({
    id: itinerary.id,
    userId: itinerary.touristUserId || userId,
    name: itinerary.name,
    city: itinerary.destinationCity,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
    adults: itinerary.adultCount,
    children: itinerary.childCount,
    budget: itinerary.budget ?? 0,
    note: itinerary.description ?? '',
    source: itinerary.isAiGenerated ? 'demo-planner' : 'manual',
    status: itinerary.status,
  }))
  const stops: Stopover[] = backendStops.map(stop => {
    const place = placeById.get(stop.placeId)
    return {
      id: stop.id,
      tripId: stop.itineraryId,
      placeId: stop.placeId,
      name: place?.name ?? 'Địa điểm đã lưu',
      address: place?.address ?? place?.city ?? '',
      start: toDateTimeInput(stop.arrivalTime),
      end: toDateTimeInput(stop.departureTime),
      order: stop.stopOrder,
      note: stop.description ?? '',
    }
  })
  const activities: TravelActivity[] = activityPages.flatMap(response => response.data.map(activity => ({
    id: activity.id,
    stopId: activity.stopoverId,
    name: activity.name,
    order: activity.activityOrder,
    start: toDateTimeInput(activity.startTime),
    end: toDateTimeInput(activity.endTime),
    note: activity.description ?? '',
    cost: activity.estimatedCost ?? 0,
  })))
  return { trips, stops, activities }
}

export const api: MockRepository & PartnerHotelsApi & AdminHotelsApi & PartnerRoomsApi & HotelOwnersApi & PlaceManagementApi & CancellationPoliciesApi & BookingsManagementApi & SettlementsApi & ReviewsApi & ReportsApi & {
  myProfile: () => Promise<User>
  myFavorites: () => Promise<ApiFavorite[]>
  toggleMyFavorite: (targetType: FavoriteTargetType, targetId: string) => Promise<{ saved: boolean }>
  myItineraries: (userId: string) => Promise<{ trips: Itinerary[]; stops: Stopover[]; activities: TravelActivity[] }>
  myPreference: () => Promise<TravelPreference | null>
  searchRoomAvailability: (query: { hotelId?: string; checkInDate: string; checkOutDate: string }) => Promise<{ hotelId: string | null; checkInDate: string; checkOutDate: string; availableRoomIds: string[] }>
  touristBookings: () => Promise<{ bookings: Booking[]; payments: Payment[]; refunds: Refund[] }>
  touristBooking: (bookingId: string) => Promise<{ booking: Booking; payment: Payment; refund: Refund | null; reviewed: false }>
  createSePayPayment: (bookingId: string) => Promise<{ bookingId: string; bookingCode: string; paymentMethod: string | null; paymentStatus: string; orderCode: string; vaNumber: string; qrCode: string | null; bankName: string | null; accountNumber: string | null; accountHolderName: string | null; expiresAt: string | null }>
  notifications: (page?: number, limit?: number) => Promise<Page<Notification> & { meta: Page<Notification>['meta'] & { unreadCount: number } }>
  markNotificationRead: (notificationId: string) => Promise<Notification>
  markAllNotificationsRead: () => Promise<{ updated: number }>
} = {
  publicData: publicCatalog,
  touristData: userId => request({ method: 'GET', url: '/users/' + userId + '/overview' }),
  myItineraries: loadMyItineraries,
  partnerData: userId => request({ method: 'GET', url: '/partners/by-user/' + userId + '/overview' }),
  adminData: () => request({ method: 'GET', url: '/admin/overview' }),
  adminPlaces: query => request<Page<PlaceAdminListItem>>({ method: 'GET', url: '/places', params: { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC', ...query } }),
  adminPlace: placeId => request<AdminPlace>({ method: 'GET', url: '/places/' + placeId }),
  placeCatalogOptions: () => request<PlaceCatalogOptions>({ method: 'GET', url: '/places/options' }),
  createPlace: input => request<AdminPlace>({ method: 'POST', url: '/places', data: input }),
  updatePlace: (placeId, input) => request<AdminPlace>({ method: 'PATCH', url: '/places/' + placeId, data: input }),
  deletePlace: placeId => request<void>({ method: 'DELETE', url: '/places/' + placeId }),
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
  uploadHotelImage: (hotelId, file) => {
    const data = new FormData()
    data.append('file', file)
    return request<PartnerHotel['images'][number]>({ method: 'POST', url: '/hotels/' + hotelId + '/images', data, headers: { 'Content-Type': undefined }, timeout: 60000 })
  },
  deleteHotelImage: (hotelId, imageId) => request<void>({ method: 'DELETE', url: '/hotels/' + hotelId + '/images/' + imageId }),
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
  cancellationPolicySchedule: hotelId => request<CancellationPolicySchedule>({ method: 'GET', url: '/cancellation-policies/schedule/' + hotelId }),
  createCancellationPolicy: input => request<CancellationPolicy>({ method: 'POST', url: '/cancellation-policies', data: input }),
  updateCancellationPolicy: (id, input) => request<CancellationPolicy>({ method: 'PATCH', url: '/cancellation-policies/' + id, data: input }),
  deleteCancellationPolicy: id => request<void>({ method: 'DELETE', url: '/cancellation-policies/' + id }),
  managedBookings: query => request<Page<ManagedBooking>>({ method: 'GET', url: '/bookings', params: query }),
  managedBooking: bookingId => request<ManagedBooking>({ method: 'GET', url: '/bookings/' + bookingId }),
  completeManagedBooking: bookingId => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/complete' }),
  refundManagedBooking: (bookingId, refundAmount, refundReason) => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/refund', data: { refundAmount, refundReason } }),
  syncManagedRefund: bookingId => request<ManagedBooking>({ method: 'PUT', url: '/bookings/' + bookingId + '/refund/sync' }),
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
  register: (name, username, email, password) => request({ method: 'POST', url: '/auth/register', data: { displayName: name, username, email, password } }),
  verifyOtp: (email, otp) => request({ method: 'POST', url: '/auth/verify-otp', data: { email, otp } }),
  requestOtp: email => request({ method: 'POST', url: '/auth/forgot-password', data: { email } }),
  resendOtp: email => request({ method: 'POST', url: '/auth/resend-otp', data: { email } }),
  resetPassword: (email, password, otp) => request({ method: 'POST', url: '/auth/reset-password', data: { email, password, otp } }),
  myProfile: () => request<BackendUser>({ method: 'GET', url: '/users/me' }).then(mapBackendUser),
  saveProfile: (_userId: string, values: UserProfileInput) => request<BackendUser>({ method: 'PATCH', url: '/users/me', data: { displayName: values.name, phoneNumber: values.phone ?? null, dateOfBirth: values.dateOfBirth ?? null, gender: values.gender ?? null } }).then(mapBackendUser),
  requestDeletion: (userId, password) => request({ method: 'POST', url: '/users/' + userId + '/deletion-request', data: { password } }),
  myPreference: () => request<TravelPreference | null>({ method: 'GET', url: '/users/me/preferences' }),
  savePreference: (_userId, pref) => request<TravelPreference>({ method: 'PUT', url: '/users/me/preferences', data: { interestCodes: pref.interests.map(interest => interestCodesByLabel[interest] ?? interest), budget: pref.budget, style: pref.style, transport: pref.transport, destinations: pref.destinations } }),
  clearPreference: _userId => request<void>({ method: 'DELETE', url: '/users/me/preferences' }),
  myFavorites: () => request<ApiFavorite[]>({ method: 'GET', url: '/users/me/favorites' }),
  toggleFavorite: async (_userId, id) => {
    const catalog = await publicCatalog()
    const targetType: FavoriteTargetType = catalog.hotels.some(hotel => hotel.id === id) ? 'HOTEL' : 'PLACE'
    await request<{ saved: boolean }>({ method: 'POST', url: '/users/me/favorites/toggle', data: { targetType, targetId: id } })
    return (await request<ApiFavorite[]>({ method: 'GET', url: '/users/me/favorites' })).map(favorite => favorite.targetId)
  },
  toggleMyFavorite: (targetType, targetId) => request<{ saved: boolean }>({ method: 'POST', url: '/users/me/favorites/toggle', data: { targetType, targetId } }),
  recommend: (query, userId) => request({ method: 'POST', url: '/ai/recommendations', data: { query, userId } }),
  plan: input => request({ method: 'POST', url: '/ai/trip-planner', data: input }),
  savePlannedTrip: async (userId, result: PlannerResult) => {
    const trip = await request<BackendItinerary>({
      method: 'POST', url: '/itineraries',
      data: { name: result.trip.name, destinationCity: result.trip.city, description: result.trip.note, startDate: result.trip.startDate, endDate: result.trip.endDate, adultCount: result.trip.adults, childCount: result.trip.children, budget: result.trip.budget, currency: 'VND', status: 'SAVED' },
    })
    const savedStops = new Map<string, string>()
    try {
      for (const stop of [...result.stops].sort((a, b) => a.order - b.order)) {
        if (!stop.placeId) throw new DomainError('PLACE_REQUIRED', 'Một điểm dừng chưa gắn với địa điểm trong danh mục.')
        const created = await request<BackendStopover>({
          method: 'POST', url: '/itineraries/' + trip.id + '/stopovers',
          data: { placeId: stop.placeId, stopOrder: stop.order, arrivalTime: toBackendTime(stop.start), departureTime: toBackendTime(stop.end), description: stop.note },
        })
        savedStops.set(stop.id, created.id)
        const activities = result.activities.filter(item => item.stopId === stop.id).sort((a, b) => a.start.localeCompare(b.start))
        for (const [index, activity] of activities.entries()) {
          await request<BackendActivity>({
            method: 'POST', url: '/stopovers/' + created.id + '/activities',
            data: { activityOrder: activity.order ?? index + 1, name: activity.name, description: activity.note, startTime: toBackendTime(activity.start), endTime: toBackendTime(activity.end), estimatedCost: activity.cost, currency: 'VND' },
          })
        }
      }
    } catch (error) {
      await request<void>({ method: 'DELETE', url: '/itineraries/' + trip.id }).catch(() => undefined)
      throw error
    }
    return { ...result.trip, id: trip.id, userId, city: trip.destinationCity, note: trip.description ?? '', status: 'SAVED' as const, source: 'demo-planner' as const }
  },
  saveTrip: async (userId, values) => {
    const payload = { name: values.name, destinationCity: values.city, description: values.note || null, startDate: values.startDate, endDate: values.endDate, adultCount: values.adults, childCount: values.children, budget: values.budget, currency: 'VND', status: values.status }
    const saved = values.id
      ? await request<BackendItinerary>({ method: 'PATCH', url: '/itineraries/' + values.id, data: payload })
      : await request<BackendItinerary>({ method: 'POST', url: '/itineraries', data: payload })
    return { ...values, id: saved.id, userId, city: saved.destinationCity, status: saved.status, source: saved.isAiGenerated ? 'demo-planner' as const : 'manual' as const }
  },
  deleteTrip: (_userId, tripId) => request<void>({ method: 'DELETE', url: '/itineraries/' + tripId }),
  saveStop: async (_userId, stop) => {
    if (!stop.placeId) throw new DomainError('PLACE_REQUIRED', 'Vui lòng chọn địa điểm từ danh mục.')
    const payload = { placeId: stop.placeId, stopOrder: stop.order, arrivalTime: toBackendTime(stop.start), departureTime: toBackendTime(stop.end), description: stop.note || null }
    if (stop.id) await request<BackendStopover>({ method: 'PATCH', url: '/itineraries/' + stop.tripId + '/stopovers/' + stop.id, data: payload })
    else await request<BackendStopover>({ method: 'POST', url: '/itineraries/' + stop.tripId + '/stopovers', data: payload })
  },
  deleteStop: (_userId, stopId, tripId) => {
    if (!tripId) throw new DomainError('ITINERARY_REQUIRED', 'Thiếu mã chuyến đi để xóa điểm dừng.')
    return request<void>({ method: 'DELETE', url: '/itineraries/' + tripId + '/stopovers/' + stopId })
  },
  saveActivity: async (_userId, activity) => {
    const payload = { activityOrder: activity.order ?? 1, name: activity.name, description: activity.note || null, startTime: toBackendTime(activity.start), endTime: toBackendTime(activity.end), estimatedCost: activity.cost, currency: 'VND' }
    if (activity.id) await request<BackendActivity>({ method: 'PATCH', url: '/stopovers/' + activity.stopId + '/activities/' + activity.id, data: payload })
    else await request<BackendActivity>({ method: 'POST', url: '/stopovers/' + activity.stopId + '/activities', data: payload })
  },
  deleteActivity: (_userId, activityId, stopId) => {
    if (!stopId) throw new DomainError('STOPOVER_REQUIRED', 'Thiếu mã điểm dừng để xóa hoạt động.')
    return request<void>({ method: 'DELETE', url: '/stopovers/' + stopId + '/activities/' + activityId })
  },
  searchRoomAvailability: query => request({ method: 'GET', url: '/bookings/availability', params: query }),
  notifications: (page = 1, limit = 20) => request({ method: 'GET', url: '/notifications', params: { page, limit } }),
  markNotificationRead: notificationId => request({ method: 'PATCH', url: '/notifications/' + notificationId + '/read' }),
  markAllNotificationsRead: () => request({ method: 'PATCH', url: '/notifications/read-all' }),
  touristBookings: async () => {
    const page = await request<BackendBookingPage>({ method: 'GET', url: '/bookings', params: { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'DESC' } })
    return {
      bookings: page.data.map(mapBackendBooking),
      payments: page.data.map(mapBackendPayment),
      refunds: page.data.map(mapBackendRefund).filter((refund): refund is Refund => refund !== null),
    }
  },
  touristBooking: async bookingId => {
    const result = await request<BackendBooking>({ method: 'GET', url: '/bookings/' + bookingId })
    return { booking: mapBackendBooking(result), payment: mapBackendPayment(result), refund: mapBackendRefund(result), reviewed: false as const }
  },
  createBooking: (_userId, values: BookingInput) => request<BackendBooking>({
    method: 'POST', url: '/bookings',
    data: {
      roomIds: values.roomIds ?? [values.roomId],
      checkInDate: values.checkIn,
      checkOutDate: values.checkOut,
      adultCount: values.adults,
      childCount: values.children,
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestPhone: values.guestPhone,
      specialRequests: values.specialRequest || null,
      cancellationPolicyVersion: values.cancellationPolicyVersion,
    },
    headers: { 'Idempotency-Key': values.idempotencyKey ?? crypto.randomUUID() },
  }).then(mapBackendBooking),
  createSePayPayment: bookingId => request({ method: 'PUT', url: '/bookings/' + bookingId + '/payment/sepay' }),
  payBooking: async (_userId, bookingId) => {
    await request({ method: 'PUT', url: '/bookings/' + bookingId + '/payment/sepay' })
    return request<BackendBooking>({ method: 'GET', url: '/bookings/' + bookingId }).then(mapBackendBooking)
  },
  cancelBooking: async (_userId, bookingId) => request<BackendBooking>({ method: 'POST', url: '/bookings/' + bookingId + '/cancel' }).then(mapBackendBooking),
  resolveRefund: () => { throw new DomainError('API_ONLY', 'Trạng thái hoàn tiền do backend/cổng thanh toán xác nhận.') },
  addReview: (_userId, bookingId, stars, content) => request({ method: 'POST', url: '/bookings/' + bookingId + '/reviews', data: { stars, content } }),
  saveRoom: (userId, room) => request({ method: room.id ? 'PUT' : 'POST', url: '/partners/by-user/' + userId + '/rooms' + (room.id ? '/' + room.id : ''), data: room }),
  saveInventory: (userId, roomId, rows) => request({ method: 'PUT', url: '/partners/by-user/' + userId + '/rooms/' + roomId + '/inventory', data: rows }),
  verifyPartner: (id, status, note, revision) => request({ method: 'POST', url: '/admin/partners/' + id + '/verification', data: { status, note, revision } }),
  saveCategory: (id, name, description, active) => request({ method: id ? 'PUT' : 'POST', url: '/admin/service-categories' + (id ? '/' + id : ''), data: { name, description, active } }),
  toggleService: id => request({ method: 'POST', url: '/admin/services/' + id + '/toggle' }),
  moderateReview: (id, status, reason) => request({ method: 'POST', url: '/admin/reviews/' + id + '/moderation', data: { status, reason } }),
  settlementBatches: filters => request<SettlementBatch[]>({ method: 'GET', url: '/settlements', params: filters }),
  settlementBatch: id => request<SettlementBatch>({ method: 'GET', url: '/settlements/' + id }),
  createSettlementBatch: input => request<SettlementBatch>({ method: 'POST', url: '/settlements', data: input }),
  approveSettlementBatch: id => request<SettlementBatch>({ method: 'POST', url: '/settlements/' + id + '/approve' }),
  startSettlementBatch: id => request<SettlementBatch>({ method: 'POST', url: '/settlements/' + id + '/start' }),
  confirmSettlementBatch: (id, transferReference) => request<SettlementBatch>({ method: 'POST', url: '/settlements/' + id + '/confirm', data: { transferReference } }),
  failSettlementBatch: (id, reason) => request<SettlementBatch>({ method: 'POST', url: '/settlements/' + id + '/fail', data: { reason } }),
  transitionSettlement: (_id: string, _next: 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED', _revision: number) => { throw new DomainError('API_ONLY', 'Dùng quy trình kỳ đối soát tại trang quản trị.') },
  reset: () => { throw new DomainError('API_ONLY', 'Chỉ có thể đặt lại dữ liệu ở chế độ demo.') },
}
