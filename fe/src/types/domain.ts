export type Role = 'tourist' | 'partner' | 'admin'
export type AdminUserRole = 'TOURIST' | 'HOTEL_OWNER' | 'ADMIN'
export type AdminUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
export type AdminUserGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED'
export interface AdminUser {
  id: string
  username: string
  email: string
  googleAccountLinked: boolean
  firstName: string | null
  lastName: string | null
  displayName: string | null
  phoneNumber: string | null
  dateOfBirth: string | null
  gender: AdminUserGender | null
  status: AdminUserStatus
  role: AdminUserRole
  isEmailVerified: boolean
  createdAt: string
  updatedAt: string
}
export interface AdminUserPage { data: AdminUser[]; meta: { page: number; limit: number; total: number } }
export interface AdminUserQuery {
  page: number
  limit: number
  search?: string
  status?: AdminUserStatus
  role?: AdminUserRole
  gender?: AdminUserGender
  isEmailVerified?: boolean
  sortBy: 'username' | 'email' | 'displayName' | 'createdAt' | 'updatedAt'
  sortOrder: 'ASC' | 'DESC'
}
export type CreateAdminUserInput = Omit<AdminUser, 'id' | 'googleAccountLinked' | 'role' | 'isEmailVerified' | 'createdAt' | 'updatedAt'> & { password: string }
export type UpdateAdminUserInput = Partial<Omit<AdminUser, 'id' | 'googleAccountLinked' | 'isEmailVerified' | 'createdAt' | 'updatedAt'>>
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED'
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED'
export type SettlementStatus = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED'
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO'
export type ReviewStatus = 'VISIBLE' | 'HIDDEN' | 'PENDING'

export interface AdminUserMetadata { username: string; googleAccountLinked: boolean; firstName: string | null; lastName: string | null; displayName: string | null; phoneNumber: string | null; dateOfBirth: string | null; gender: AdminUserGender | null; status: AdminUserStatus; role: AdminUserRole; isEmailVerified: boolean; createdAt: string; updatedAt: string }
export interface User { id: string; name: string; email: string; role: Role; phone?: string; avatar?: string; verified: boolean; passwordHash?: string; deletionRequestedAt?: string; adminMetadata?: AdminUserMetadata }
export type PartnerHotelStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'INACTIVE' | 'SUSPENDED'
export type HotelDocumentType = 'BUSINESS_LICENSE' | 'HOTEL_LICENSE' | 'OWNERSHIP_DOCUMENT' | 'TAX_DOCUMENT' | 'OTHER'
export interface PartnerHotelDocument { id: string; documentType: HotelDocumentType; documentNumber: string; fileUrl: string; issuedAt: string | null; expiresAt: string | null; createdAt: string; updatedAt: string }
export interface HotelImage { id: string; hotelId: string; url: string; previewUrl: string; contentType: string; byteSize: number; width: number; height: number; createdAt: string }
export interface PartnerHotel { id: string; ownerUserId: string; placeId: string | null; name: string; legalName: string; taxCode: string; description: string | null; address: string; phoneNumber: string; email: string; starRating: number | null; checkInTime: string; checkOutTime: string; status: PartnerHotelStatus; submittedAt: string | null; reviewedAt: string | null; reviewedBy: string | null; rejectionReason: string | null; documents: PartnerHotelDocument[]; images: HotelImage[]; createdAt: string; updatedAt: string }
export interface PartnerHotelPage { data: PartnerHotel[]; meta: { page: number; limit: number; total: number } }
export interface PartnerHotelQuery { page: number; limit: number; search?: string; status?: PartnerHotelStatus; sortBy: 'createdAt' | 'name' | 'status'; sortOrder: 'ASC' | 'DESC' }
export interface PartnerHotelInput { placeId?: string | null; name: string; legalName: string; taxCode: string; description?: string | null; address: string; phoneNumber: string; email: string; starRating?: number | null; checkInTime: string; checkOutTime: string }
export interface PartnerHotelDocumentInput { documentType: HotelDocumentType; documentNumber: string; fileUrl: string; issuedAt?: string | null; expiresAt?: string | null }
export type AdminHotelReviewAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'REACTIVATED' | 'DEACTIVATED'
export type AdminHotelReviewCommand = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE'
export interface AdminHotelReviewHistory { id: string; hotelId: string; actorUserId: string; action: AdminHotelReviewAction; reason: string | null; createdAt: string }
export type RoomOperationalStatus = 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
export interface AmenityOption { id: string; code: string; name: string }
export interface HotelOwnerProfile { userId: string; bankName: string | null; bankAccountNumber: string | null; bankAccountHolder: string | null }
export interface HotelOwnerPage { data: HotelOwnerProfile[]; meta: { page: number; limit: number; total: number } }
export interface ManagedRoom { id: string; hotelId: string; roomNumber: string; maxOccupancy: number; pricePerNight: number; currency: string; description: string | null; operationalStatus: RoomOperationalStatus; roomType: string; amenities: AmenityOption[]; createdAt: string; updatedAt: string }
export interface ManagedRoomPage { data: ManagedRoom[]; meta: { page: number; limit: number; total: number } }
export interface ManagedRoomInput { hotelId: string; roomNumber: string; maxOccupancy: number; pricePerNight: number; currency: string; description?: string | null; operationalStatus: RoomOperationalStatus; roomType: string; amenityIds: string[] }
export interface CancellationPolicy { id: string; hotelId: string; name: string; minHoursBeforeCheckIn: number; maxHoursBeforeCheckIn: number | null; cancellationFeeRate: number | null; description: string | null }
export interface CancellationPolicyInput { hotelId: string; name: string; minHoursBeforeCheckIn: number; maxHoursBeforeCheckIn: number | null; cancellationFeeRate: number; description?: string | null }
export type ManagedBookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
export type ManagedPaymentStatus = 'PENDING' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
export type ManagedRefundStatus = 'NONE' | 'PENDING' | 'REFUNDED' | 'FAILED'
export type ManagedSettlementStatus = 'PENDING' | 'PROCESSING' | 'SETTLED' | 'FAILED'
export interface ManagedBookingRoom { id: string; roomId: string; roomNumberSnapshot: string; roomTypeSnapshot: string; maxOccupancySnapshot: number; pricePerNight: number; currency: string; numberOfNights: number; subtotal: number }
export interface ManagedBooking { id: string; hotelId: string; touristId: string; bookingCode: string; createdAt: string; checkInDate: string; checkOutDate: string; adultCount: number; childCount: number; guestName: string; guestEmail: string; guestPhone: string; specialRequests: string | null; bookingStatus: ManagedBookingStatus; cancelledAt: string | null; totalAmount: number; currency: string; amount: number; paymentMethod: string | null; paymentStatus: ManagedPaymentStatus; paidAt: string | null; settlementBaseAmount: number | null; commissionAmount: number | null; partnerReceivableAmount: number | null; settlementStatus: ManagedSettlementStatus; settledAt: string | null; cancellationPolicyId: string | null; cancellationFeeRateSnapshot: number | null; cancellationDescriptionSnapshot: string | null; cancellationFeeAmount: number | null; refundAmount: number | null; refundReason: string | null; refundStatus: ManagedRefundStatus; refundedAt: string | null; roomItems: ManagedBookingRoom[] }
export interface BookingListQuery { page: number; limit: number; search?: string; hotelId?: string; bookingStatus?: ManagedBookingStatus; paymentStatus?: ManagedPaymentStatus; settlementStatus?: ManagedSettlementStatus; refundStatus?: ManagedRefundStatus; createdFrom?: string; createdTo?: string; sortBy: 'createdAt' | 'bookingCode' | 'totalAmount' | 'amount'; sortOrder: 'ASC' | 'DESC' }
export interface TravelPreference { userId: string; interests: string[]; budget: number; style: string; transport: string; destinations: string[] }
export interface Destination { id: string; name: string; city: string; region: string; category: string; description: string; tags: string[]; price: number; openingHours?: string; image?: string; rating?: number; lat?: number; lng?: number }
export interface CancellationTerms { freeUntilHours: number; lateFeeRate: number; checkInHour: number }
export interface Hotel { id: string; name: string; city: string; area: string; address: string; description: string; stars: number; rating?: number; amenities: string[]; image?: string; partnerId: string; cancellationPolicy: string; cancellationTerms: CancellationTerms }
export interface RoomType { id: string; hotelId: string; name: string; description: string; capacity: number; area: number; bed: string; basePrice: number; amenities: string[]; image?: string }
export interface RoomInventory { roomId: string; date: string; offered: number; price: number; revision: number }
export interface Restaurant { id: string; name: string; city: string; area: string; cuisine: string; description: string; price: number; openingHours: string; rating?: number; image?: string }
export interface TravelActivity { id: string; stopId: string; name: string; start: string; end: string; placeId?: string; note: string; cost: number }
export interface Stopover { id: string; tripId: string; placeId?: string; name: string; address: string; start: string; end: string; order: number; note: string }
export interface Itinerary { id: string; userId: string; name: string; city: string; startDate: string; endDate: string; adults: number; children: number; budget: number; note: string; source: 'manual' | 'demo-planner'; status: 'DRAFT' | 'SAVED' }
export interface Booking { id: string; userId: string; hotelId: string; roomId: string; checkIn: string; checkOut: string; rooms: number; adults: number; children: number; guestName: string; guestEmail: string; guestPhone: string; specialRequest: string; total: number; nightlyPrices: number[]; status: BookingStatus; holdExpiresAt: string; createdAt: string; cancelledAt?: string; cancellationFee?: number; policySnapshot: string; policyTermsSnapshot: CancellationTerms; refundId?: string; tripId?: string }
export interface Payment { id: string; bookingId: string; status: PaymentStatus; amount: number; createdAt: string; reference?: string }
export interface Refund { id: string; bookingId: string; status: RefundStatus; amount: number; createdAt: string }
export interface Review { id: string; bookingId: string; bookingCode?: string; hotelId: string; hotelName?: string; userId: string; reviewerName?: string; reviewerEmail?: string | null; stars: number; content: string; status: ReviewStatus; moderationReason?: string | null; moderatedBy?: string | null; moderatedAt?: string | null; updatedAt?: string; createdAt: string }
export type ReviewModerationAction = 'APPROVE' | 'HIDE' | 'RESTORE'
export interface ReviewManagementQuery { page: number; limit: number; hotelId?: string; status?: ReviewStatus; stars?: number; search?: string; createdFrom?: string; createdTo?: string; sortBy: 'createdAt' | 'stars'; sortOrder: 'ASC' | 'DESC' }
export interface ReviewSummary { hotelId: string; averageRating: number; visibleCount: number; pendingCount?: number }
export interface ReviewModerationHistory { id: string; reviewId: string; actorUserId: string; action: ReviewModerationAction; reason: string | null; createdAt: string }
export type ReportGroupBy = 'day' | 'week' | 'month'
export interface ReportQuery { from: string; to: string; hotelId?: string; groupBy: ReportGroupBy }
export interface ReportCurrencySummary { currency: string; paidBookingCount: number; paidAmount: number; pendingSettlementBookingCount: number; pendingSettlementAmount: number; refundedBookingCount: number; refundAmount: number; settledBookingCount: number; settlementBaseAmount: number; commissionAmount: number; partnerReceivableAmount: number }
export interface ReportHotelSummary extends ReportCurrencySummary { hotelId: string; hotelName: string; bookingCount: number }
export interface ReportSummary { from: string; to: string; bookingCount: number; bookingStatusCounts: Record<ManagedBookingStatus, number>; financialByCurrency: ReportCurrencySummary[]; hotels: ReportHotelSummary[] }
export interface ReportBookingTrendPoint { period: string; bookingCount: number; statusCounts: Record<ManagedBookingStatus, number> }
export interface ReportFinancialTrendPoint { period: string; currency: string; paidAmount: number; refundAmount: number; settlementBaseAmount: number; commissionAmount: number; partnerReceivableAmount: number }
export interface ReportTimeseries { groupBy: ReportGroupBy; bookingTrend: ReportBookingTrendPoint[]; financialTrend: ReportFinancialTrendPoint[] }
export interface Partner { id: string; userId: string; name: string; email: string; type: string; status: VerificationStatus; hotelIds: string[]; bankName: string; bankLast4: string; commissionRate: number; registeredAt: string; note?: string; revision: number }
export interface ServiceCategory { id: string; name: string; description: string; active: boolean }
export interface TravelService { id: string; name: string; categoryId: string; partnerId: string; city: string; price: number; active: boolean }
export interface Settlement { id: string; partnerId: string; hotelId: string; periodStart: string; periodEnd: string; bookingIds: string[]; gross: number; commission: number; adjustment: number; net: number; status: SettlementStatus; revision: number; transferReference?: string }

export interface AppData {
  version: number
  users: User[]
  preferences: TravelPreference[]
  destinations: Destination[]
  hotels: Hotel[]
  rooms: RoomType[]
  inventory: RoomInventory[]
  restaurants: Restaurant[]
  trips: Itinerary[]
  stops: Stopover[]
  activities: TravelActivity[]
  bookings: Booking[]
  payments: Payment[]
  refunds: Refund[]
  reviews: Review[]
  partners: Partner[]
  categories: ServiceCategory[]
  services: TravelService[]
  settlements: Settlement[]
  favorites: Record<string, string[]>
}

export interface PlannerInput { city: string; startDate: string; endDate: string; adults: number; children: number; budget: number; interests: string[]; style: string; note: string }
export interface PlannerResult { trip: Itinerary; stops: Stopover[]; activities: TravelActivity[]; totalCost: number; explanation: string; costBreakdown?: { lodging: number; food: number; activities: number }; reasons?: Record<string, string>; input?: PlannerInput }
export interface BookingInput { hotelId: string; roomId: string; checkIn: string; checkOut: string; rooms: number; adults: number; children: number; guestName: string; guestEmail: string; guestPhone: string; specialRequest: string }
export interface AppError { code: string; message: string; status?: number }
