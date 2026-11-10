import type { AppData, CancellationTerms, RoomInventory } from '@/types/domain'
import { todayPlus } from '@/lib/utils'

type ExtraSeed = Pick<AppData, 'destinations' | 'hotels' | 'rooms' | 'inventory' | 'restaurants' | 'trips' | 'stops' | 'activities' | 'bookings' | 'payments' | 'refunds' | 'reviews' | 'partners' | 'services' | 'settlements' | 'favorites'>

const cancellationPolicy = 'Miễn phí khi hủy trước nhận phòng ít nhất 24 giờ; sau đó phí 50%.'
const cancellationTerms: CancellationTerms = { freeUntilHours: 24, lateFeeRate: 0.5, checkInHour: 14 }
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

export function createSeedExtras(): ExtraSeed {
  const roomInventory = [
    { roomId: 'room-sunrise-standard', offered: 5, price: 1800000 },
    { roomId: 'room-sunrise-suite', offered: 2, price: 2700000 },
    { roomId: 'room-lotus-classic', offered: 7, price: 1050000 },
    { roomId: 'room-pine-balcony', offered: 4, price: 1300000 },
    { roomId: 'room-bay-view', offered: 5, price: 1550000 },
    { roomId: 'room-lantern-garden', offered: 6, price: 850000 },
  ]
  const inventory: RoomInventory[] = []
  for (let offset = -35; offset < 95; offset++) {
    const date = todayPlus(offset)
    for (const room of roomInventory) inventory.push({ ...room, date, revision: 1 })
  }

  return {
    destinations: [
      { id: 'cong-vien-bien-dong', name: 'Công viên Biển Đông', city: 'Đà Nẵng', region: 'Sơn Trà', category: 'Biển', description: 'Không gian đi dạo ven biển, thích hợp nghỉ chân và ngắm bình minh.', tags: ['Biển', 'Gia đình'], price: 0, openingHours: 'Cả ngày', rating: 4.5 },
      { id: 'non-nuoc', name: 'Bãi biển Non Nước', city: 'Đà Nẵng', region: 'Ngũ Hành Sơn', category: 'Biển', description: 'Bãi biển thoáng đãng ở phía nam thành phố.', tags: ['Biển', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'hai-van', name: 'Đèo Hải Vân', city: 'Đà Nẵng', region: 'Liên Chiểu', category: 'Thiên nhiên', description: 'Tuyến đèo có các điểm ngắm núi và biển trên hành trình ven miền Trung.', tags: ['Thiên nhiên', 'Khám phá'], price: 0, openingHours: '06:00–18:00', rating: 4.7 },
      { id: 'cho-han', name: 'Chợ Hàn', city: 'Đà Nẵng', region: 'Hải Châu', category: 'Mua sắm', description: 'Khu chợ trung tâm để tìm đặc sản và quà lưu niệm.', tags: ['Mua sắm', 'Ẩm thực'], price: 0, openingHours: '07:00–18:00', rating: 4.3 },
      { id: 'ho-tuyen-lam', name: 'Hồ Tuyền Lâm', city: 'Đà Lạt', region: 'Phường 4', category: 'Thiên nhiên', description: 'Không gian hồ và rừng thông cho hành trình thư giãn.', tags: ['Thiên nhiên', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.7 },
      { id: 'lam-vien', name: 'Quảng trường Lâm Viên', city: 'Đà Lạt', region: 'Trung tâm', category: 'Thành phố', description: 'Quảng trường bên hồ, thuận tiện đi dạo và chụp ảnh.', tags: ['Thành phố', 'Gia đình'], price: 0, openingHours: 'Cả ngày', rating: 4.5 },
      { id: 'cau-dat', name: 'Đồi chè Cầu Đất', city: 'Đà Lạt', region: 'Xuân Trường', category: 'Thiên nhiên', description: 'Đồi chè xanh và không khí mát, phù hợp chuyến đi ngắn.', tags: ['Thiên nhiên', 'Khám phá'], price: 0, openingHours: '07:00–17:00', rating: 4.6 },
      { id: 'an-bang', name: 'Bãi biển An Bàng', city: 'Quảng Nam', region: 'Hội An', category: 'Biển', description: 'Bãi biển gần phố cổ, thích hợp nghỉ ngơi buổi sáng.', tags: ['Biển', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'chua-cau', name: 'Chùa Cầu', city: 'Quảng Nam', region: 'Hội An', category: 'Văn hóa', description: 'Công trình kiến trúc biểu tượng của khu phố cổ Hội An.', tags: ['Văn hóa', 'Khám phá'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'lang-rau-tra-que', name: 'Làng rau Trà Quế', city: 'Quảng Nam', region: 'Hội An', category: 'Văn hóa', description: 'Không gian làng quê và vườn rau truyền thống gần Hội An.', tags: ['Văn hóa', 'Ẩm thực'], price: 0, openingHours: '07:00–17:00', rating: 4.4 },
      { id: 'kinh-thanh-hue', name: 'Kinh thành Huế', city: 'Huế', region: 'Phú Xuân', category: 'Văn hóa', description: 'Quần thể di tích cung đình cho hành trình tìm hiểu lịch sử.', tags: ['Văn hóa', 'Khám phá'], price: 200000, openingHours: '07:00–17:00', rating: 4.8 },
      { id: 'truong-tien', name: 'Cầu Trường Tiền', city: 'Huế', region: 'Trung tâm', category: 'Thành phố', description: 'Cây cầu bắc qua sông Hương, thuận tiện kết hợp đi bộ ven sông.', tags: ['Thành phố', 'Văn hóa'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'vong-canh', name: 'Đồi Vọng Cảnh', city: 'Huế', region: 'Thủy Xuân', category: 'Thiên nhiên', description: 'Điểm ngắm cảnh sông Hương và những dải đồi xanh.', tags: ['Thiên nhiên', 'Nghỉ dưỡng'], price: 0, openingHours: '06:00–18:00', rating: 4.5 },
      { id: 'tran-phu-beach', name: 'Bãi biển Trần Phú', city: 'Nha Trang', region: 'Lộc Thọ', category: 'Biển', description: 'Dải bờ biển trong thành phố, phù hợp đi dạo và ngắm biển.', tags: ['Biển', 'Nghỉ dưỡng'], price: 0, openingHours: 'Cả ngày', rating: 4.6 },
      { id: 'ponagar', name: 'Tháp Bà Ponagar', city: 'Nha Trang', region: 'Vĩnh Phước', category: 'Văn hóa', description: 'Cụm tháp cổ mang dấu ấn văn hóa Chăm.', tags: ['Văn hóa', 'Khám phá'], price: 30000, openingHours: '07:00–17:00', rating: 4.7 },
    ],
    hotels: [
      { id: 'sunrise-danang', name: 'Sunrise Coast Đà Nẵng', city: 'Đà Nẵng', area: 'Sơn Trà', address: '18 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng', description: 'Khách sạn demo hướng biển với phòng rộng và khu vực nghỉ ngơi.', stars: 5, rating: 4.8, amenities: ['Wi-Fi', 'Hồ bơi', 'Bữa sáng', 'Gần biển'], partnerId: 'partner-sea', cancellationPolicy, cancellationTerms: { ...cancellationTerms } },
      { id: 'lotus-hue', name: 'Lotus Riverside Huế', city: 'Huế', area: 'Phú Hội', address: '22 Lê Lợi, Phú Hội, Huế', description: 'Khách sạn demo bên sông, thuận tiện khám phá trung tâm Huế.', stars: 4, rating: 4.6, amenities: ['Wi-Fi', 'Bữa sáng', 'Gần trung tâm'], partnerId: 'partner-lotus', cancellationPolicy, cancellationTerms: { ...cancellationTerms } },
      { id: 'pine-valley', name: 'Pine Valley Đà Lạt', city: 'Đà Lạt', area: 'Phường 4', address: '35 Trần Thánh Tông, Đà Lạt', description: 'Không gian demo gần rừng thông với phòng có ban công.', stars: 4, rating: 4.5, amenities: ['Wi-Fi', 'Sân vườn', 'Máy sưởi'], partnerId: 'partner-river', cancellationPolicy, cancellationTerms: { ...cancellationTerms } },
      { id: 'bay-breeze', name: 'Bay Breeze Nha Trang', city: 'Nha Trang', area: 'Lộc Thọ', address: '40 Trần Phú, Lộc Thọ, Nha Trang', description: 'Khách sạn demo gần bãi biển, phù hợp chuyến đi gia đình.', stars: 4, rating: 4.5, amenities: ['Wi-Fi', 'Hồ bơi', 'Gần biển'], partnerId: 'partner-bay', cancellationPolicy, cancellationTerms: { ...cancellationTerms } },
      { id: 'lantern-house', name: 'Lantern House Hội An', city: 'Quảng Nam', area: 'Hội An', address: '9 Nguyễn Duy Hiệu, Hội An, Quảng Nam', description: 'Khách sạn demo yên tĩnh, thuận tiện đi bộ vào phố cổ.', stars: 3, rating: 4.4, amenities: ['Wi-Fi', 'Sân vườn', 'Gần trung tâm'], partnerId: 'partner-river', cancellationPolicy, cancellationTerms: { ...cancellationTerms } },
    ],
    rooms: [
      { id: 'room-sunrise-standard', hotelId: 'sunrise-danang', name: 'Ocean Standard', description: 'Phòng đôi sáng thoáng hướng biển.', capacity: 2, area: 32, bed: '1 giường đôi', basePrice: 1800000, amenities: ['Wi-Fi', 'TV', 'Điều hòa', 'Bữa sáng'] },
      { id: 'room-sunrise-suite', hotelId: 'sunrise-danang', name: 'Sunrise Suite', description: 'Suite rộng có khu vực tiếp khách.', capacity: 4, area: 55, bed: '2 giường đôi', basePrice: 2700000, amenities: ['Wi-Fi', 'TV', 'Điều hòa', 'Bồn tắm'] },
      { id: 'room-lotus-classic', hotelId: 'lotus-hue', name: 'Classic River', description: 'Phòng đôi nhìn về trung tâm thành phố.', capacity: 2, area: 28, bed: '1 giường đôi', basePrice: 1050000, amenities: ['Wi-Fi', 'TV', 'Điều hòa'] },
      { id: 'room-pine-balcony', hotelId: 'pine-valley', name: 'Pine Balcony', description: 'Phòng đôi có ban công nhìn ra khu vườn.', capacity: 2, area: 30, bed: '1 giường đôi', basePrice: 1300000, amenities: ['Wi-Fi', 'Máy sưởi', 'Ban công'] },
      { id: 'room-bay-view', hotelId: 'bay-breeze', name: 'Bay View', description: 'Phòng đôi tiện nghi cho kỳ nghỉ ven biển.', capacity: 2, area: 31, bed: '1 giường đôi', basePrice: 1550000, amenities: ['Wi-Fi', 'TV', 'Điều hòa'] },
      { id: 'room-lantern-garden', hotelId: 'lantern-house', name: 'Garden Room', description: 'Phòng đôi yên tĩnh nhìn ra sân vườn.', capacity: 2, area: 27, bed: '1 giường đôi', basePrice: 850000, amenities: ['Wi-Fi', 'Điều hòa', 'Sân vườn'] },
    ],
    inventory,
    restaurants: [
      { id: 'bep-song-han', name: 'Bếp Sông Hàn', city: 'Đà Nẵng', area: 'Hải Châu', cuisine: 'Món Việt', description: 'Nhà hàng demo phục vụ cơm và món địa phương.', price: 160000, openingHours: '10:00–21:00', rating: 4.4 },
      { id: 'banh-trang-cu-quang', name: 'Góc Quảng', city: 'Đà Nẵng', area: 'Thanh Khê', cuisine: 'Món địa phương', description: 'Quán demo với các món ăn nhẹ miền Trung.', price: 85000, openingHours: '08:00–20:00', rating: 4.3 },
      { id: 'bep-thong-xanh', name: 'Bếp Thông Xanh', city: 'Đà Lạt', area: 'Trung tâm', cuisine: 'Món Việt', description: 'Không gian demo ấm cúng với thực đơn theo mùa.', price: 180000, openingHours: '10:00–22:00', rating: 4.5 },
      { id: 'quan-gao-hoian', name: 'Quán Gạo Hội An', city: 'Quảng Nam', area: 'Hội An', cuisine: 'Món địa phương', description: 'Quán demo phục vụ món cơm và rau địa phương.', price: 120000, openingHours: '09:00–21:00', rating: 4.4 },
      { id: 'com-nha-xu-hue', name: 'Cơm Nhà Xứ Huế', city: 'Huế', area: 'Phú Hội', cuisine: 'Món Huế', description: 'Bữa cơm gia đình trong không gian demo gần trung tâm.', price: 110000, openingHours: '10:00–21:00', rating: 4.5 },
      { id: 'bun-bo-pho-cu', name: 'Bún Bò Phố Cũ', city: 'Huế', area: 'Phú Nhuận', cuisine: 'Món Huế', description: 'Quán demo chuyên món bún bò và món ăn sáng.', price: 75000, openingHours: '06:30–14:00', rating: 4.4 },
      { id: 'bep-bien-xanh', name: 'Bếp Biển Xanh', city: 'Nha Trang', area: 'Lộc Thọ', cuisine: 'Hải sản', description: 'Nhà hàng demo với thực đơn hải sản và món nướng.', price: 220000, openingHours: '11:00–22:00', rating: 4.5 },
    ],
    trips: [
      { id: 'trip-hue-demo', userId: 'user-tourist', name: 'Cuối tuần ở Huế', city: 'Huế', startDate: todayPlus(18), endDate: todayPlus(20), adults: 2, children: 0, budget: 5500000, note: 'Ưu tiên di tích và ẩm thực Huế', source: 'manual', status: 'SAVED' },
      { id: 'trip-dalat-demo', userId: 'user-tourist', name: 'Nghỉ dưỡng Đà Lạt', city: 'Đà Lạt', startDate: todayPlus(32), endDate: todayPlus(34), adults: 2, children: 0, budget: 7000000, note: 'Đi nhẹ, nhiều thời gian nghỉ', source: 'manual', status: 'SAVED' },
    ],
    stops: [
      { id: 'stop-hue-demo', tripId: 'trip-hue-demo', placeId: 'kinh-thanh-hue', name: 'Kinh thành Huế', address: 'Phú Xuân, Huế', start: todayPlus(18) + 'T09:00', end: todayPlus(18) + 'T11:00', order: 1, note: 'Tham quan buổi sáng' },
      { id: 'stop-dalat-demo', tripId: 'trip-dalat-demo', placeId: 'ho-tuyen-lam', name: 'Hồ Tuyền Lâm', address: 'Phường 4, Đà Lạt', start: todayPlus(32) + 'T09:00', end: todayPlus(32) + 'T11:00', order: 1, note: 'Đi dạo ven hồ' },
    ],
    activities: [
      { id: 'activity-hue-demo', stopId: 'stop-hue-demo', placeId: 'kinh-thanh-hue', name: 'Tìm hiểu di tích', start: todayPlus(18) + 'T09:00', end: todayPlus(18) + 'T10:30', note: '', cost: 200000 },
      { id: 'activity-dalat-demo', stopId: 'stop-dalat-demo', placeId: 'ho-tuyen-lam', name: 'Đi dạo và chụp ảnh', start: todayPlus(32) + 'T09:00', end: todayPlus(32) + 'T10:30', note: '', cost: 0 },
    ],
    bookings: [
      { id: 'BK-DEMO-002', userId: 'user-tourist', hotelId: 'lotus-hue', roomId: 'room-lotus-classic', checkIn: todayPlus(-18), checkOut: todayPlus(-16), rooms: 1, adults: 2, children: 0, guestName: 'Nguyễn Minh Anh', guestEmail: 'khach@demo.vn', guestPhone: '0901234567', specialRequest: '', total: 2100000, nightlyPrices: [1050000, 1050000], status: 'COMPLETED', holdExpiresAt: daysAgo(21), createdAt: daysAgo(21), policySnapshot: cancellationPolicy, policyTermsSnapshot: { ...cancellationTerms } },
      { id: 'BK-DEMO-003', userId: 'user-tourist', hotelId: 'sunrise-danang', roomId: 'room-sunrise-standard', checkIn: todayPlus(-12), checkOut: todayPlus(-10), rooms: 1, adults: 2, children: 0, guestName: 'Nguyễn Minh Anh', guestEmail: 'khach@demo.vn', guestPhone: '0901234567', specialRequest: '', total: 3600000, nightlyPrices: [1800000, 1800000], status: 'COMPLETED', holdExpiresAt: daysAgo(15), createdAt: daysAgo(15), policySnapshot: cancellationPolicy, policyTermsSnapshot: { ...cancellationTerms } },
      { id: 'BK-DEMO-004', userId: 'user-tourist', hotelId: 'sunrise-danang', roomId: 'room-sunrise-standard', checkIn: todayPlus(14), checkOut: todayPlus(16), rooms: 1, adults: 2, children: 0, guestName: 'Nguyễn Minh Anh', guestEmail: 'khach@demo.vn', guestPhone: '0901234567', specialRequest: 'Phòng yên tĩnh', total: 3600000, nightlyPrices: [1800000, 1800000], status: 'CONFIRMED', holdExpiresAt: daysAgo(1), createdAt: daysAgo(2), policySnapshot: cancellationPolicy, policyTermsSnapshot: { ...cancellationTerms } },
      { id: 'BK-DEMO-005', userId: 'user-tourist', hotelId: 'lantern-house', roomId: 'room-lantern-garden', checkIn: todayPlus(20), checkOut: todayPlus(22), rooms: 1, adults: 2, children: 0, guestName: 'Nguyễn Minh Anh', guestEmail: 'khach@demo.vn', guestPhone: '0901234567', specialRequest: '', total: 1700000, nightlyPrices: [850000, 850000], status: 'CANCELLED', holdExpiresAt: daysAgo(3), createdAt: daysAgo(3), cancelledAt: daysAgo(2), cancellationFee: 0, policySnapshot: cancellationPolicy, policyTermsSnapshot: { ...cancellationTerms }, refundId: 'REF-DEMO-005' },
    ],
    payments: [
      { id: 'PAY-DEMO-002', bookingId: 'BK-DEMO-002', status: 'PAID', amount: 2100000, createdAt: daysAgo(21), reference: 'MOCK-PAID-002' },
      { id: 'PAY-DEMO-003', bookingId: 'BK-DEMO-003', status: 'PAID', amount: 3600000, createdAt: daysAgo(15), reference: 'MOCK-PAID-003' },
      { id: 'PAY-DEMO-004', bookingId: 'BK-DEMO-004', status: 'PAID', amount: 3600000, createdAt: daysAgo(2), reference: 'MOCK-PAID-004' },
      { id: 'PAY-DEMO-005', bookingId: 'BK-DEMO-005', status: 'PAID', amount: 1700000, createdAt: daysAgo(3), reference: 'MOCK-PAID-005' },
    ],
    refunds: [{ id: 'REF-DEMO-005', bookingId: 'BK-DEMO-005', status: 'REFUNDED', amount: 1700000, createdAt: daysAgo(2) }],
    reviews: [
      { id: 'REV-DEMO-002', bookingId: 'BK-DEMO-002', hotelId: 'lotus-hue', userId: 'user-tourist', stars: 5, content: 'Phòng sạch, nhân viên hỗ trợ tốt và thuận tiện đi dạo bên sông.', status: 'VISIBLE', createdAt: daysAgo(15) },
      { id: 'REV-DEMO-003', bookingId: 'BK-DEMO-003', hotelId: 'sunrise-danang', userId: 'user-tourist', stars: 3, content: 'Vị trí đẹp nhưng thời gian nhận phòng cần rõ ràng hơn.', status: 'HIDDEN', createdAt: daysAgo(9), moderationReason: 'Đang kiểm tra thông tin nhận phòng' },
    ],
    partners: [
      { id: 'partner-lotus', userId: '', name: 'Lotus Hospitality Huế', email: 'lotus@example.vn', type: 'Khách sạn', status: 'VERIFIED', hotelIds: ['lotus-hue'], bankName: 'VietinBank', bankLast4: '4567', commissionRate: 0.1, registeredAt: daysAgo(60), revision: 1 },
      { id: 'partner-bay', userId: '', name: 'Bay Breeze Hospitality', email: 'bay@example.vn', type: 'Khách sạn', status: 'NEEDS_INFO', hotelIds: ['bay-breeze'], bankName: 'ACB', bankLast4: '8812', commissionRate: 0.1, registeredAt: daysAgo(4), note: 'Cần bổ sung giấy phép kinh doanh', revision: 1 },
    ],
    services: [
      { id: 'service-sunrise', name: 'Sunrise Coast Đà Nẵng', categoryId: 'cat-hotel', partnerId: 'partner-sea', city: 'Đà Nẵng', price: 1800000, active: true },
      { id: 'service-lotus', name: 'Lotus Riverside Huế', categoryId: 'cat-hotel', partnerId: 'partner-lotus', city: 'Huế', price: 1050000, active: true },
      { id: 'service-pine', name: 'Pine Valley Đà Lạt', categoryId: 'cat-hotel', partnerId: 'partner-river', city: 'Đà Lạt', price: 1300000, active: true },
      { id: 'service-bay', name: 'Bay Breeze Nha Trang', categoryId: 'cat-hotel', partnerId: 'partner-bay', city: 'Nha Trang', price: 1550000, active: true },
      { id: 'service-lantern', name: 'Lantern House Hội An', categoryId: 'cat-hotel', partnerId: 'partner-river', city: 'Quảng Nam', price: 850000, active: true },
      { id: 'service-hue-food', name: 'Cơm Nhà Xứ Huế', categoryId: 'cat-food', partnerId: 'partner-lotus', city: 'Huế', price: 110000, active: true },
    ],
    settlements: [{ id: 'SET-DEMO-002', partnerId: 'partner-lotus', hotelId: 'lotus-hue', periodStart: todayPlus(-25), periodEnd: todayPlus(-12), bookingIds: ['BK-DEMO-002'], gross: 2100000, commission: 210000, adjustment: 0, net: 1890000, status: 'DRAFT', revision: 1 }],
    favorites: { 'user-tourist': ['kinh-thanh-hue', 'lotus-hue', 'ho-tuyen-lam'] },
  }
}

function appendMissing<T extends { id: string }>(target: T[], source: T[]) {
  const existing = new Set(target.map(item => item.id))
  target.push(...source.filter(item => !existing.has(item.id)))
}

export function mergeSeedExtras(data: AppData): AppData {
  const extra = createSeedExtras()
  appendMissing(data.destinations, extra.destinations)
  appendMissing(data.hotels, extra.hotels)
  appendMissing(data.rooms, extra.rooms)
  appendMissing(data.restaurants, extra.restaurants)
  appendMissing(data.trips, extra.trips)
  appendMissing(data.stops, extra.stops)
  appendMissing(data.activities, extra.activities)
  appendMissing(data.bookings, extra.bookings)
  appendMissing(data.payments, extra.payments)
  appendMissing(data.refunds, extra.refunds)
  appendMissing(data.reviews, extra.reviews)
  appendMissing(data.partners, extra.partners)
  appendMissing(data.services, extra.services)
  appendMissing(data.settlements, extra.settlements)
  const inventoryKeys = new Set(data.inventory.map(item => item.roomId + ':' + item.date))
  data.inventory.push(...extra.inventory.filter(item => !inventoryKeys.has(item.roomId + ':' + item.date)))
  for (const [userId, ids] of Object.entries(extra.favorites)) {
    const favorites = data.favorites[userId] ?? []
    data.favorites[userId] = [...new Set([...favorites, ...ids])]
  }
  for (const [partnerId, hotelIds] of [['partner-sea', ['sunrise-danang']], ['partner-river', ['pine-valley', 'lantern-house']]] as const) {
    const partner = data.partners.find(item => item.id === partnerId)
    if (partner) partner.hotelIds = [...new Set([...partner.hotelIds, ...hotelIds])]
  }
  data.version = 3
  return data
}
