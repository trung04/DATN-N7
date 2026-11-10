import type { AppData, RoomInventory } from '@/types/domain'
import { todayPlus } from '@/lib/utils'
import { mergeSeedExtras } from './seed-extras'

export const DEMO_PASSWORD = 'Demo@123'
export const DEMO_CANCELLATION_TERMS = { freeUntilHours: 24, lateFeeRate: 0.5, checkInHour: 14 }
export const demoAccounts = [
  { email: 'khach@demo.vn', role: 'Du khách' },
  { email: 'doitac@demo.vn', role: 'Đối tác' },
  { email: 'admin@demo.vn', role: 'Quản trị' },
] as const

export function seedData(): AppData {
  const inventory: RoomInventory[] = []
  for (let i = -35; i < 95; i++) {
    const date = todayPlus(i)
    inventory.push({ roomId: 'room-deluxe', date, offered: 5, price: i % 7 > 4 ? 1450000 : 1200000, revision: 1 })
    inventory.push({ roomId: 'room-family', date, offered: 3, price: i % 7 > 4 ? 2350000 : 2000000, revision: 1 })
    inventory.push({ roomId: 'room-river', date, offered: 6, price: 900000, revision: 1 })
    inventory.push({ roomId: 'room-dalat', date, offered: 4, price: 1100000, revision: 1 })
  }
  const now = new Date().toISOString()
  const earlier = new Date(Date.now() - 20 * 86400000).toISOString()
  return mergeSeedExtras({
    version: 3,
    users: [
      { id: 'user-tourist', name: 'Nguyễn Minh Anh', email: 'khach@demo.vn', role: 'tourist', phone: '0901234567', verified: true },
      { id: 'user-partner', name: 'Trần Hải Nam', email: 'doitac@demo.vn', role: 'partner', phone: '0902223344', verified: true },
      { id: 'user-admin', name: 'Lê Thu Hà', email: 'admin@demo.vn', role: 'admin', verified: true },
    ],
    preferences: [{ userId: 'user-tourist', interests: ['Biển', 'Ẩm thực', 'Thiên nhiên'], budget: 6000000, style: 'Cân bằng', transport: 'Máy bay', destinations: ['Đà Nẵng'] }],
    destinations: [
      { id: 'my-khe', name: 'Bãi biển Mỹ Khê', city: 'Đà Nẵng', region: 'Sơn Trà', category: 'Biển', description: 'Bãi biển rộng với bờ cát dài, phù hợp đi dạo và đón bình minh.', tags: ['Biển', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.8, lat: 16.0614, lng: 108.2468 },
      { id: 'son-tra', name: 'Bán đảo Sơn Trà', city: 'Đà Nẵng', region: 'Sơn Trà', category: 'Thiên nhiên', description: 'Khu bán đảo xanh với các điểm ngắm toàn cảnh thành phố và biển.', tags: ['Thiên nhiên', 'Khám phá'], price: 0, openingHours: '06:00–18:00', rating: 4.7, lat: 16.1194, lng: 108.2911 },
      { id: 'ngu-hanh-son', name: 'Ngũ Hành Sơn', city: 'Đà Nẵng', region: 'Ngũ Hành Sơn', category: 'Văn hóa', description: 'Quần thể núi đá vôi, hang động và chùa cổ phía nam thành phố.', tags: ['Văn hóa', 'Khám phá'], price: 40000, openingHours: '07:00–17:30', rating: 4.6, lat: 16.0039, lng: 108.2634 },
      { id: 'hoi-an', name: 'Phố cổ Hội An', city: 'Quảng Nam', region: 'Hội An', category: 'Văn hóa', description: 'Những con phố nhỏ, kiến trúc cổ và không gian ven sông về đêm.', tags: ['Văn hóa', 'Ẩm thực'], price: 120000, openingHours: 'Cả ngày', rating: 4.8 },
      { id: 'cau-rong', name: 'Cầu Rồng', city: 'Đà Nẵng', region: 'Hải Châu', category: 'Thành phố', description: 'Biểu tượng kiến trúc bên sông Hàn, nổi bật vào buổi tối.', tags: ['Thành phố', 'Khám phá'], price: 0, openingHours: 'Cả ngày', rating: 4.5 },
      { id: 'ho-xuan-huong', name: 'Hồ Xuân Hương', city: 'Đà Lạt', region: 'Trung tâm', category: 'Thiên nhiên', description: 'Hồ nước giữa lòng Đà Lạt, phù hợp tản bộ và nghỉ ngơi.', tags: ['Thiên nhiên', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'thung-lung-tinh-yeu', name: 'Thung lũng Tình Yêu', city: 'Đà Lạt', region: 'Phường 8', category: 'Thiên nhiên', description: 'Không gian đồi thông và hồ nước với nhiều tuyến dạo bộ.', tags: ['Thiên nhiên', 'Gia đình'], price: 250000, openingHours: '07:00–17:00', rating: 4.4 },
    ],
    hotels: [
      { id: 'sea-garden', name: 'Sea Garden Hotel', city: 'Đà Nẵng', area: 'Sơn Trà', address: '68 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', description: 'Khách sạn ven biển với phòng nghỉ sáng thoáng, phù hợp chuyến đi nghỉ dưỡng.', stars: 4, rating: 4.7, amenities: ['Wi-Fi', 'Hồ bơi', 'Bữa sáng', 'Gần biển'], partnerId: 'partner-sea', cancellationPolicy: 'Miễn phí khi hủy trước nhận phòng ít nhất 24 giờ; sau đó phí 50%.', cancellationTerms: { ...DEMO_CANCELLATION_TERMS } },
      { id: 'river-light', name: 'River Light Hotel', city: 'Đà Nẵng', area: 'Hải Châu', address: '12 Bạch Đằng, Hải Châu, Đà Nẵng', description: 'Lưu trú thuận tiện bên sông Hàn, gần trung tâm và các điểm ăn uống.', stars: 3, rating: 4.4, amenities: ['Wi-Fi', 'Điều hòa', 'Gần trung tâm'], partnerId: 'partner-river', cancellationPolicy: 'Miễn phí khi hủy trước nhận phòng ít nhất 24 giờ; sau đó phí 50%.', cancellationTerms: { ...DEMO_CANCELLATION_TERMS } },
      { id: 'pine-house', name: 'Pine House Đà Lạt', city: 'Đà Lạt', area: 'Trung tâm', address: '25 Trần Hưng Đạo, Đà Lạt', description: 'Không gian yên tĩnh nhìn ra vườn thông, phù hợp nghỉ ngơi cuối tuần.', stars: 3, rating: 4.5, amenities: ['Wi-Fi', 'Sân vườn', 'Bữa sáng'], partnerId: 'partner-river', cancellationPolicy: 'Miễn phí khi hủy trước nhận phòng ít nhất 24 giờ; sau đó phí 50%.', cancellationTerms: { ...DEMO_CANCELLATION_TERMS } },
    ],
    rooms: [
      { id: 'room-deluxe', hotelId: 'sea-garden', name: 'Deluxe Double', description: 'Phòng đôi có ban công hướng biển.', capacity: 2, area: 30, bed: '1 giường đôi', basePrice: 1200000, amenities: ['Wi-Fi', 'TV', 'Điều hòa', 'Ban công'] },
      { id: 'room-family', hotelId: 'sea-garden', name: 'Family Suite', description: 'Không gian rộng cho gia đình.', capacity: 4, area: 48, bed: '2 giường đôi', basePrice: 2000000, amenities: ['Wi-Fi', 'TV', 'Điều hòa', 'Bồn tắm'] },
      { id: 'room-river', hotelId: 'river-light', name: 'Superior River', description: 'Phòng hướng sông, đầy đủ tiện nghi.', capacity: 2, area: 26, bed: '1 giường đôi', basePrice: 900000, amenities: ['Wi-Fi', 'TV', 'Điều hòa'] },
      { id: 'room-dalat', hotelId: 'pine-house', name: 'Garden Room', description: 'Phòng nhìn ra khu vườn thông.', capacity: 2, area: 28, bed: '1 giường đôi', basePrice: 1100000, amenities: ['Wi-Fi', 'Máy sưởi', 'Ban công'] },
    ],
    inventory,
    restaurants: [
      { id: 'be-man', name: 'Hải sản Bé Mặn', city: 'Đà Nẵng', area: 'Sơn Trà', cuisine: 'Hải sản', description: 'Hải sản tươi, thực đơn phong phú gần bãi biển.', price: 300000, openingHours: '10:00–22:00', rating: 4.5 },
      { id: 'my-quang-ba-mua', name: 'Mì Quảng Bà Mua', city: 'Đà Nẵng', area: 'Hải Châu', cuisine: 'Món địa phương', description: 'Mì Quảng với nhiều lựa chọn truyền thống.', price: 60000, openingHours: '06:30–21:00', rating: 4.6 },
      { id: 'com-ga-ba-buoi', name: 'Cơm gà Bà Buội', city: 'Quảng Nam', area: 'Hội An', cuisine: 'Món địa phương', description: 'Quán cơm gà lâu năm trong khu phố cổ.', price: 80000, openingHours: '10:30–20:00', rating: 4.4 },
      { id: 'nem-nuong-ba-hung', name: 'Nem nướng Bà Hùng', city: 'Đà Lạt', area: 'Trung tâm', cuisine: 'Món địa phương', description: 'Món nem nướng ăn cùng rau và nước chấm đặc trưng.', price: 90000, openingHours: '10:00–21:00', rating: 4.5 },
    ],
    trips: [{ id: 'trip-demo', userId: 'user-tourist', name: 'Đà Nẵng cuối tuần', city: 'Đà Nẵng', startDate: todayPlus(10), endDate: todayPlus(12), adults: 2, children: 0, budget: 6000000, note: 'Ưu tiên biển và ẩm thực địa phương', source: 'manual', status: 'SAVED' }],
    stops: [{ id: 'stop-demo', tripId: 'trip-demo', placeId: 'my-khe', name: 'Bãi biển Mỹ Khê', address: 'Sơn Trà, Đà Nẵng', start: todayPlus(10) + 'T09:00', end: todayPlus(10) + 'T11:00', order: 1, note: '' }],
    activities: [{ id: 'activity-demo', stopId: 'stop-demo', name: 'Dạo biển và chụp ảnh', start: todayPlus(10) + 'T09:00', end: todayPlus(10) + 'T10:00', placeId: 'my-khe', note: '', cost: 0 }],
    bookings: [{ id: 'BK-DEMO-001', userId: 'user-tourist', hotelId: 'sea-garden', roomId: 'room-deluxe', checkIn: todayPlus(-23), checkOut: todayPlus(-21), rooms: 1, adults: 2, children: 0, guestName: 'Nguyễn Minh Anh', guestEmail: 'khach@demo.vn', guestPhone: '0901234567', specialRequest: '', total: 2400000, nightlyPrices: [1200000, 1200000], status: 'COMPLETED', holdExpiresAt: earlier, createdAt: earlier, policySnapshot: 'Miễn phí khi hủy trước nhận phòng ít nhất 24 giờ; sau đó phí 50%.', policyTermsSnapshot: { ...DEMO_CANCELLATION_TERMS } }],
    payments: [{ id: 'PAY-DEMO-001', bookingId: 'BK-DEMO-001', status: 'PAID', amount: 2400000, createdAt: earlier, reference: 'MOCK-PAID-001' }],
    refunds: [],
    reviews: [],
    partners: [
      { id: 'partner-sea', userId: 'user-partner', name: 'Công ty Sea Garden', email: 'doitac@demo.vn', type: 'Khách sạn', status: 'VERIFIED', hotelIds: ['sea-garden'], bankName: 'Vietcombank', bankLast4: '1234', commissionRate: 0.1, registeredAt: earlier, revision: 1 },
      { id: 'partner-river', userId: '', name: 'River Hospitality', email: 'river@example.vn', type: 'Khách sạn', status: 'PENDING', hotelIds: ['river-light', 'pine-house'], bankName: 'BIDV', bankLast4: '7865', commissionRate: 0.1, registeredAt: now, revision: 1 },
    ],
    categories: [{ id: 'cat-hotel', name: 'Lưu trú', description: 'Khách sạn và nơi nghỉ', active: true }, { id: 'cat-food', name: 'Ẩm thực', description: 'Nhà hàng, quán ăn', active: true }, { id: 'cat-activity', name: 'Hoạt động', description: 'Trải nghiệm tại điểm đến', active: true }],
    services: [{ id: 'service-sea', name: 'Sea Garden Hotel', categoryId: 'cat-hotel', partnerId: 'partner-sea', city: 'Đà Nẵng', price: 1200000, active: true }, { id: 'service-river', name: 'River Light Hotel', categoryId: 'cat-hotel', partnerId: 'partner-river', city: 'Đà Nẵng', price: 900000, active: true }],
    settlements: [{ id: 'SET-DEMO-001', partnerId: 'partner-sea', hotelId: 'sea-garden', periodStart: todayPlus(-30), periodEnd: todayPlus(-15), bookingIds: ['BK-DEMO-001'], gross: 2400000, commission: 240000, adjustment: 0, net: 2160000, status: 'DRAFT', revision: 1 }],
    favorites: { 'user-tourist': ['my-khe', 'sea-garden'] },
  })
}
