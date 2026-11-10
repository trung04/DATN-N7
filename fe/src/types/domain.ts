export type Role = 'tourist' | 'partner' | 'admin'
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED'
export type RefundStatus = 'PENDING' | 'PROCESSING' | 'REFUNDED' | 'FAILED'
export type SettlementStatus = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED'
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO'
export type ReviewStatus = 'VISIBLE' | 'HIDDEN' | 'PENDING'

export interface User { id: string; name: string; email: string; role: Role; phone?: string; avatar?: string; verified: boolean; passwordHash?: string; deletionRequestedAt?: string }
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
export interface Review { id: string; bookingId: string; hotelId: string; userId: string; stars: number; content: string; status: ReviewStatus; createdAt: string; moderationReason?: string }
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
