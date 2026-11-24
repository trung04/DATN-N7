import dataSource from './typeorm.datasource';

type PropertyStyle = 'COAST' | 'CITY' | 'HERITAGE' | 'MOUNTAIN' | 'RESORT';

interface DemoHotel {
  name: string;
  city: string;
  district: string;
  street: string;
  stars: number;
  basePrice: number;
  style: PropertyStyle;
  placeId: string | null;
  checkIn: string;
  checkOut: string;
}

interface DemoRoom {
  roomNumber: string;
  roomType: string;
  maxOccupancy: number;
  priceFactor: number;
  maxAdults: number;
  maxChildren: number;
  freeChildMaxAge: number;
  childSurcharge: number;
  amenityCodes: string[];
}

const HOTEL_ID_PREFIX = '71000000';
const ROOM_ID_PREFIX = '72000000';
const HOTEL_IMAGE_ID_PREFIX = '73000000';
const ROOM_IMAGE_ID_PREFIX = '74000000';
const POLICY_ID_PREFIX = '76000000';
const REVIEW_HISTORY_ID_PREFIX = '81000000';

const DEMO_OWNERS = [
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
];
const DEMO_ADMIN = '70000000-0000-4000-8000-000000000001';
const PLACEHOLDER_IMAGE_IDS = Array.from(
  { length: 7 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const EXISTING_HOTELS = Array.from(
  { length: 4 },
  (_, index) =>
    `71000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const EXISTING_HOTEL_DESCRIPTIONS = [
  'Khách sạn ven biển gần bãi Mỹ Khê, có hồ bơi tầng thượng, nhà hàng phục vụ bữa sáng và phòng nghỉ tiện nghi cho kỳ nghỉ thư giãn tại Đà Nẵng.',
  'Khách sạn phong cách boutique giữa phố cổ Hội An, có sân trong yên tĩnh, xe đạp miễn phí và lối đi bộ thuận tiện tới sông Hoài.',
  'Không gian nghỉ dưỡng thanh lịch bên sông Hương, thuận tiện tham quan Đại Nội và các lăng tẩm. Khách sạn có nhà hàng phục vụ món địa phương và phòng nghỉ thoải mái.',
  'Khách sạn giữa đồi thông Đà Lạt, có ban công nhìn ra thung lũng, cà phê rang tại chỗ và không gian ấm cúng để thư giãn buổi tối.',
];

// These fictional listings fill the demo catalog to 100 properties.
// Names and copy are demo content; photos are real accommodation stock photos.
const additionalDemoHotels: DemoHotel[] = [
  { name: 'My Khe Azure Hotel', city: 'Da Nang', district: 'Son Tra', street: '18 Vo Nguyen Giap', stars: 4, basePrice: 1450000, style: 'COAST', placeId: '30000000-0000-4000-8000-000000000001', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Han River Grand Boutique', city: 'Da Nang', district: 'Hai Chau', street: '62 Bach Dang', stars: 4, basePrice: 1650000, style: 'CITY', placeId: '30000000-0000-4000-8000-000000000004', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Son Tra Palm Bay Resort', city: 'Da Nang', district: 'Son Tra', street: '88 Hoang Sa', stars: 5, basePrice: 2950000, style: 'RESORT', placeId: '30000000-0000-4000-8000-000000000003', checkIn: '15:00', checkOut: '12:00' },
  { name: 'Hoi An Silk Lantern Boutique', city: 'Hoi An', district: 'Minh An', street: '29 Nguyen Phuc Chu', stars: 4, basePrice: 1750000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000005', checkIn: '14:00', checkOut: '11:00' },
  { name: 'An Bang Seaside Retreat', city: 'Hoi An', district: 'Cam An', street: '12 Nguyen Phan Vinh', stars: 4, basePrice: 1850000, style: 'COAST', placeId: '30000000-0000-4000-8000-000000000006', checkIn: '14:00', checkOut: '11:00' },
  { name: 'Thu Bon Riverside House', city: 'Hoi An', district: 'Cam Nam', street: '47 Nguyen Tri Phuong', stars: 3, basePrice: 1150000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000005', checkIn: '14:00', checkOut: '11:00' },
  { name: 'Royal Citadel Garden Hotel', city: 'Hue', district: 'Vinh Ninh', street: '16 Le Loi', stars: 4, basePrice: 1550000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000007', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Perfume River Signature Hotel', city: 'Hue', district: 'Phu Hoi', street: '81 Tran Hung Dao', stars: 5, basePrice: 2450000, style: 'CITY', placeId: '30000000-0000-4000-8000-000000000008', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Hue Heritage Courtyard Stay', city: 'Hue', district: 'Thuan Hoa', street: '25 Dang Thai Than', stars: 3, basePrice: 1050000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000007', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Pine Grove Da Lat Hotel', city: 'Da Lat', district: 'Ward 3', street: '19 Tran Hung Dao', stars: 4, basePrice: 1550000, style: 'MOUNTAIN', placeId: '30000000-0000-4000-8000-000000000010', checkIn: '15:00', checkOut: '11:00' },
  { name: 'Valley Mist Retreat', city: 'Da Lat', district: 'Ward 4', street: '36 Trieu Viet Vuong', stars: 4, basePrice: 1950000, style: 'MOUNTAIN', placeId: '30000000-0000-4000-8000-000000000009', checkIn: '15:00', checkOut: '11:00' },
  { name: 'French Quarter Hill Hotel', city: 'Da Lat', district: 'Ward 9', street: '72 Hung Vuong', stars: 3, basePrice: 1250000, style: 'MOUNTAIN', placeId: '30000000-0000-4000-8000-000000000010', checkIn: '14:00', checkOut: '11:00' },
  { name: 'Hoan Kiem Grand Boutique', city: 'Hanoi', district: 'Hoan Kiem', street: '28 Hang Trong', stars: 4, basePrice: 1850000, style: 'CITY', placeId: '30000000-0000-4000-8000-000000000011', checkIn: '14:00', checkOut: '12:00' },
  { name: 'West Lake Garden Suites', city: 'Hanoi', district: 'Tay Ho', street: '55 Trich Sai', stars: 5, basePrice: 2850000, style: 'CITY', placeId: '30000000-0000-4000-8000-000000000011', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Old Quarter Residence Hanoi', city: 'Hanoi', district: 'Hoan Kiem', street: '14 Ma May', stars: 3, basePrice: 1350000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000011', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Ha Long Marina View Hotel', city: 'Ha Long', district: 'Bai Chay', street: '68 Ha Long', stars: 4, basePrice: 1750000, style: 'COAST', placeId: '30000000-0000-4000-8000-000000000012', checkIn: '14:00', checkOut: '12:00' },
  { name: 'Bayfront Lotus Resort', city: 'Ha Long', district: 'Hong Gai', street: '23 Tran Quoc Nghien', stars: 5, basePrice: 3150000, style: 'RESORT', placeId: '30000000-0000-4000-8000-000000000012', checkIn: '15:00', checkOut: '12:00' },
  { name: 'Nha Trang Coral Bay Hotel', city: 'Nha Trang', district: 'Loc Tho', street: '92 Tran Phu', stars: 4, basePrice: 1950000, style: 'COAST', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Tran Phu Ocean Suites', city: 'Nha Trang', district: 'Vinh Nguyen', street: '41 Tran Phu', stars: 5, basePrice: 3250000, style: 'RESORT', placeId: null, checkIn: '15:00', checkOut: '12:00' },
  { name: 'Phu Quoc Palm Cove Resort', city: 'Phu Quoc', district: 'Duong Dong', street: '12 Tran Hung Dao', stars: 5, basePrice: 3450000, style: 'RESORT', placeId: null, checkIn: '15:00', checkOut: '12:00' },
  { name: 'Sunset Beach Garden Phu Quoc', city: 'Phu Quoc', district: 'Cua Duong', street: '8 Duong Bao', stars: 4, basePrice: 2250000, style: 'COAST', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Sa Pa Cloud Mountain Lodge', city: 'Sa Pa', district: 'Sa Pa', street: '21 Hoang Lien', stars: 4, basePrice: 1850000, style: 'MOUNTAIN', placeId: null, checkIn: '14:00', checkOut: '11:00' },
  { name: 'Fansipan View Boutique Lodge', city: 'Sa Pa', district: 'Sa Pa', street: '6 Thac Bac', stars: 4, basePrice: 2050000, style: 'MOUNTAIN', placeId: null, checkIn: '14:00', checkOut: '11:00' },
  { name: 'Quy Nhon Sand and Sea Hotel', city: 'Quy Nhon', district: 'Nguyen Van Cu', street: '33 An Duong Vuong', stars: 4, basePrice: 1650000, style: 'COAST', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Eo Gio Coastal Retreat', city: 'Quy Nhon', district: 'Nhon Ly', street: '5 Bai Nom', stars: 3, basePrice: 1250000, style: 'RESORT', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Can Tho Riverside Grand', city: 'Can Tho', district: 'Ninh Kieu', street: '39 Hai Ba Trung', stars: 4, basePrice: 1550000, style: 'CITY', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Mekong Garden Boutique Stay', city: 'Can Tho', district: 'Cai Rang', street: '17 Ba Thang Hai', stars: 3, basePrice: 1150000, style: 'HERITAGE', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Phan Thiet Dune Oasis Resort', city: 'Phan Thiet', district: 'Mui Ne', street: '26 Nguyen Dinh Chieu', stars: 5, basePrice: 2950000, style: 'RESORT', placeId: null, checkIn: '15:00', checkOut: '12:00' },
  { name: 'Mui Ne Seaside Retreat', city: 'Phan Thiet', district: 'Mui Ne', street: '74 Huynh Thuc Khang', stars: 4, basePrice: 1850000, style: 'COAST', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Trang An Limestone Resort', city: 'Ninh Binh', district: 'Hoa Lu', street: '9 Trang An', stars: 4, basePrice: 1750000, style: 'RESORT', placeId: null, checkIn: '14:00', checkOut: '12:00' },
  { name: 'Hoi An Riverside Lantern Inn', city: 'Hoi An', district: 'Cam Pho', street: '8 Nguyen Du', stars: 3, basePrice: 1250000, style: 'HERITAGE', placeId: '30000000-0000-4000-8000-000000000005', checkIn: '14:00', checkOut: '11:00' },
];

const extraBrandFirstWords = [
  'Amber', 'Azure', 'Bamboo', 'Coral', 'Crescent', 'Emerald', 'Golden',
  'Indigo', 'Jade', 'Lotus', 'Marina', 'Moonlight', 'Ocean', 'Palm',
  'Pearl', 'River', 'Sapphire', 'Silver', 'Sunrise', 'Willow',
];
const extraBrandSecondWords = [
  'Bay', 'Court', 'Garden', 'Harbor', 'Haven', 'House', 'Lodge', 'Oasis',
  'Palace', 'Retreat',
];
const extraDestinations = [
  { city: 'Da Nang', districts: ['Son Tra', 'Hai Chau', 'Ngu Hanh Son'], placeId: '30000000-0000-4000-8000-000000000001' },
  { city: 'Hoi An', districts: ['Cam Pho', 'Minh An', 'Cam An'], placeId: '30000000-0000-4000-8000-000000000005' },
  { city: 'Hue', districts: ['Vinh Ninh', 'Phu Hoi', 'Thuan Hoa'], placeId: '30000000-0000-4000-8000-000000000007' },
  { city: 'Da Lat', districts: ['Ward 3', 'Ward 4', 'Ward 10'], placeId: '30000000-0000-4000-8000-000000000009' },
  { city: 'Hanoi', districts: ['Hoan Kiem', 'Ba Dinh', 'Tay Ho'], placeId: '30000000-0000-4000-8000-000000000011' },
  { city: 'Ha Long', districts: ['Bai Chay', 'Hong Gai', 'Hon Gai'], placeId: '30000000-0000-4000-8000-000000000012' },
  { city: 'Nha Trang', districts: ['Loc Tho', 'Vinh Nguyen', 'Phuoc Long'], placeId: null },
  { city: 'Phu Quoc', districts: ['Duong Dong', 'An Thoi', 'Cua Duong'], placeId: null },
  { city: 'Sa Pa', districts: ['Sa Pa', 'Lao Chai', 'Ta Van'], placeId: null },
  { city: 'Quy Nhon', districts: ['City Center', 'Nhon Ly', 'Ghenh Rang'], placeId: null },
  { city: 'Can Tho', districts: ['Ninh Kieu', 'Cai Rang', 'Binh Thuy'], placeId: null },
  { city: 'Phan Thiet', districts: ['Mui Ne', 'Ham Tien', 'Phu Hai'], placeId: null },
  { city: 'Ninh Binh', districts: ['Hoa Lu', 'Trang An', 'Tam Coc'], placeId: null },
  { city: 'Vung Tau', districts: ['Bai Sau', 'Bai Truoc', 'Long Hai'], placeId: null },
  { city: 'Ho Chi Minh City', districts: ['District 1', 'District 3', 'District 7'], placeId: null },
  { city: 'Phong Nha', districts: ['Son Trach', 'Phong Nha', 'Bo Trach'], placeId: null },
];
const extraStreetNames = [
  'Nguyen Van Linh', 'Le Loi', 'Tran Hung Dao', 'Bach Dang',
  'Vo Nguyen Giap', 'Hoang Sa', 'Pham Van Dong', 'Hai Ba Trung',
];
const extraStyles: PropertyStyle[] = [
  'COAST', 'CITY', 'HERITAGE', 'MOUNTAIN', 'RESORT',
];

additionalDemoHotels.push(
  ...Array.from({ length: 65 }, (_, index) => {
    const destination = extraDestinations[index % extraDestinations.length]!;
    const firstWord = extraBrandFirstWords[index % extraBrandFirstWords.length]!;
    const secondWord =
      extraBrandSecondWords[
        Math.floor(index / extraBrandFirstWords.length) % extraBrandSecondWords.length
      ]!;
    const stars = 3 + (index % 3);
    return {
      name: `${firstWord} ${secondWord} ${destination.city} Boutique Hotel`,
      city: destination.city,
      district: destination.districts[index % destination.districts.length]!,
      street: `${10 + ((index * 7) % 190)} ${extraStreetNames[index % extraStreetNames.length]}`,
      stars,
      basePrice: 1000000 + (index % 11) * 190000,
      style: extraStyles[index % extraStyles.length]!,
      placeId: destination.placeId,
      checkIn: stars === 5 ? '15:00' : '14:00',
      checkOut: index % 4 === 0 ? '11:00' : '12:00',
    };
  }),
);

const roomTemplates: DemoRoom[] = [
  { roomNumber: '101', roomType: 'SUPERIOR KING', maxOccupancy: 2, priceFactor: 1, maxAdults: 2, maxChildren: 1, freeChildMaxAge: 5, childSurcharge: 100000, amenityCodes: ['WIFI', 'AIR_CONDITIONING'] },
  { roomNumber: '201', roomType: 'DELUXE TWIN', maxOccupancy: 2, priceFactor: 1.35, maxAdults: 2, maxChildren: 2, freeChildMaxAge: 6, childSurcharge: 125000, amenityCodes: ['WIFI', 'AIR_CONDITIONING', 'BREAKFAST', 'PARKING'] },
  { roomNumber: '301', roomType: 'FAMILY SUITE', maxOccupancy: 4, priceFactor: 1.9, maxAdults: 3, maxChildren: 2, freeChildMaxAge: 6, childSurcharge: 150000, amenityCodes: ['WIFI', 'AIR_CONDITIONING', 'BREAKFAST', 'POOL', 'RESTAURANT'] },
];

function fixedId(prefix: string, sequence: number): string {
  return `${prefix}-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

const vietnameseCityNames: Record<string, string> = {
  'Da Nang': 'Đà Nẵng',
  'Hoi An': 'Hội An',
  Hue: 'Huế',
  'Da Lat': 'Đà Lạt',
  Hanoi: 'Hà Nội',
  'Ha Long': 'Hạ Long',
  'Nha Trang': 'Nha Trang',
  'Phu Quoc': 'Phú Quốc',
  'Sa Pa': 'Sa Pa',
  'Quy Nhon': 'Quy Nhơn',
  'Can Tho': 'Cần Thơ',
  'Phan Thiet': 'Phan Thiết',
  'Ninh Binh': 'Ninh Bình',
  'Vung Tau': 'Vũng Tàu',
  'Ho Chi Minh City': 'Thành phố Hồ Chí Minh',
  'Phong Nha': 'Phong Nha',
};

const vietnameseDistrictNames: Record<string, string> = {
  'Son Tra': 'Sơn Trà',
  'Hai Chau': 'Hải Châu',
  'Ngu Hanh Son': 'Ngũ Hành Sơn',
  'Cam Pho': 'Cẩm Phô',
  'Minh An': 'Minh An',
  'Cam An': 'Cẩm An',
  'Cam Nam': 'Cẩm Nam',
  'Vinh Ninh': 'Vĩnh Ninh',
  'Phu Hoi': 'Phú Hội',
  'Thuan Hoa': 'Thuận Hóa',
  'Hoan Kiem': 'Hoàn Kiếm',
  'Tay Ho': 'Tây Hồ',
  'Ba Dinh': 'Ba Đình',
  'Bai Chay': 'Bãi Cháy',
  'Hong Gai': 'Hồng Gai',
  'Hon Gai': 'Hòn Gai',
  'Loc Tho': 'Lộc Thọ',
  'Vinh Nguyen': 'Vĩnh Nguyên',
  'Phuoc Long': 'Phước Long',
  'Duong Dong': 'Dương Đông',
  'An Thoi': 'An Thới',
  'Cua Duong': 'Cửa Dương',
  'Lao Chai': 'Lao Chải',
  'Ta Van': 'Tả Van',
  'Nhon Ly': 'Nhơn Lý',
  'Ghenh Rang': 'Ghềnh Ráng',
  'Ninh Kieu': 'Ninh Kiều',
  'Cai Rang': 'Cái Răng',
  'Binh Thuy': 'Bình Thủy',
  'Mui Ne': 'Mũi Né',
  'Ham Tien': 'Hàm Tiến',
  'Phu Hai': 'Phú Hải',
  'Hoa Lu': 'Hoa Lư',
  'Trang An': 'Tràng An',
  'Tam Coc': 'Tam Cốc',
  'Bai Sau': 'Bãi Sau',
  'Bai Truoc': 'Bãi Trước',
  'Long Hai': 'Long Hải',
  'Son Trach': 'Sơn Trạch',
  'Bo Trach': 'Bố Trạch',
  'District 1': 'Quận 1',
  'District 3': 'Quận 3',
  'District 7': 'Quận 7',
};

function hotelDescription(hotel: DemoHotel, index: number): string {
  const city = vietnameseCityNames[hotel.city] ?? hotel.city;
  const district = vietnameseDistrictNames[hotel.district] ?? hotel.district;
  const descriptions: Record<PropertyStyle, string[]> = {
    COAST: [
      `Tọa lạc tại ${district}, ${city}, ${hotel.name} thuận tiện để du khách đến bãi biển và các điểm tham quan ven biển. Khách sạn có hồ bơi ngoài trời, nhà hàng phục vụ bữa sáng và phòng nghỉ tiện nghi.`,
      `Nằm gần bờ biển ${city}, ${hotel.name} mang đến không gian nghỉ ngơi thoáng đãng với hồ bơi, nhà hàng và các phòng phù hợp cho kỳ nghỉ cùng gia đình.`,
      `Từ ${hotel.name}, du khách dễ dàng khám phá bãi biển và ẩm thực địa phương tại ${city}. Khách sạn có khu vực thư giãn, dịch vụ ăn sáng và phòng nghỉ tiện nghi.`,
    ],
    CITY: [
      `Nằm tại ${district}, ${city}, ${hotel.name} thuận tiện kết nối với các điểm tham quan, nhà hàng và khu mua sắm. Khách sạn có lễ tân phục vụ 24 giờ và phòng nghỉ đầy đủ tiện nghi.`,
      `${hotel.name} nằm gần trung tâm ${city}, phù hợp cho chuyến công tác hoặc tham quan thành phố. Du khách có thể nghỉ ngơi trong phòng cách âm và sử dụng nhà hàng trong khuôn viên.`,
      `Khám phá ${city} thuận tiện từ ${hotel.name}, nơi gần các tuyến phố chính, nhà hàng và điểm tham quan. Khách sạn phục vụ bữa sáng và hỗ trợ thông tin du lịch tại quầy lễ tân.`,
    ],
    HERITAGE: [
      `Nằm gần khu phố cổ tại ${city}, ${hotel.name} kết hợp nét kiến trúc địa phương với sân trong yên tĩnh. Khách lưu trú có thể dùng xe đạp, thưởng thức bữa sáng và thuận tiện khám phá các điểm di sản.`,
      `${hotel.name} mang đến không gian nghỉ ngơi gần khu di sản ${city}, với sân vườn, phòng nghỉ ấm cúng và thông tin tham quan địa phương. Các nhà hàng và tuyến phố đi bộ nằm gần khách sạn.`,
      `Tọa lạc tại ${district}, ${city}, ${hotel.name} là điểm dừng chân thuận tiện để khám phá kiến trúc, ẩm thực và đời sống địa phương. Khách sạn có khu vực sinh hoạt yên tĩnh và phục vụ bữa sáng.`,
    ],
    MOUNTAIN: [
      `Ẩn mình tại ${district}, ${city}, ${hotel.name} có tầm nhìn hướng đồi núi hoặc thung lũng, sân vườn và không gian sinh hoạt ấm cúng. Đây là lựa chọn phù hợp cho chuyến nghỉ dưỡng giữa thiên nhiên.`,
      `Tại ${city}, ${hotel.name} mang đến không gian nghỉ ngơi yên tĩnh với phòng nhìn ra cảnh quan đồi núi, khu vườn và khu vực thư giãn. Khách có thể thưởng thức cà phê, bữa sáng và khám phá các cung đường địa phương.`,
      `${hotel.name} nằm giữa cảnh quan xanh tại ${district}, ${city}, với phòng nghỉ thoáng sáng, sân hiên và khu vực sinh hoạt chung. Khách sạn phù hợp cho chuyến đi ngắn ngày, tận hưởng khí hậu mát mẻ.`,
    ],
    RESORT: [
      `Khu nghỉ dưỡng ${hotel.name} tại ${district}, ${city} có hồ bơi, nhà hàng trong khuôn viên và các hạng phòng dành cho gia đình. Không gian phù hợp để nghỉ ngơi, thư giãn và tham gia các hoạt động địa phương.`,
      `${hotel.name} là khu nghỉ dưỡng có hồ bơi, khuôn viên xanh và nhà hàng phục vụ món địa phương. Từ đây, du khách có thể dễ dàng khám phá bãi biển và cảnh quan đặc trưng của ${city}.`,
      `Tận hưởng kỳ nghỉ tại ${hotel.name}, nơi có phòng nghỉ rộng rãi, khu vực thư giãn và nhà hàng ngay trong khuôn viên. Khách sạn tọa lạc tại ${district}, thuận tiện di chuyển đến các điểm tham quan ở ${city}.`,
    ],
  };
  return descriptions[hotel.style][index % 3]!;
}

function roomDescription(room: DemoRoom, hotel: DemoHotel): string {
  const bed = room.roomType === 'DELUXE TWIN' ? 'two single beds' : 'a comfortable bed';
  const space = room.roomType === 'FAMILY SUITE' ? 'a separate seating area and space for families' : 'a private bathroom and a work desk';
  return `${room.roomType} at ${hotel.name} includes ${bed}, air conditioning, Wi-Fi, ${space}, and daily housekeeping.`;
}

async function seedDemoLodgingExpansion(): Promise<void> {
  await dataSource.initialize();
  try {
    const owners = (await dataSource.query(
      'SELECT user_id AS "userId" FROM hotel_owners WHERE user_id = ANY($1::uuid[])',
      [DEMO_OWNERS],
    )) as Array<{ userId: string }>;
    if (owners.length !== DEMO_OWNERS.length)
      throw new Error('Run the base demo website seed before adding demo hotels.');

    const admins = (await dataSource.query(
      'SELECT id FROM users WHERE id = $1::uuid AND role = $2 AND status = $3',
      [DEMO_ADMIN, 'ADMIN', 'ACTIVE'],
    )) as Array<{ id: string }>;
    if (!admins.length)
      throw new Error('The active demo admin account is required for hotel approvals.');

    const imageRows = (await dataSource.query(
      'SELECT id FROM images WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL',
      [PLACEHOLDER_IMAGE_IDS],
    )) as Array<{ id: string }>;
    if (imageRows.length !== PLACEHOLDER_IMAGE_IDS.length)
      throw new Error('Run the base demo website seed before the catalog expansion.');

    const amenityRows = (await dataSource.query(
      'SELECT id, code FROM amenities WHERE code = ANY($1::text[])',
      [['WIFI', 'AIR_CONDITIONING', 'BREAKFAST', 'PARKING', 'POOL', 'RESTAURANT']],
    )) as Array<{ id: string; code: string }>;
    const amenityIds = new Map(amenityRows.map(({ id, code }) => [code, id]));
    const missingAmenities = roomTemplates
      .flatMap((room) => room.amenityCodes)
      .filter((code, index, all) => all.indexOf(code) === index && !amenityIds.has(code));
    if (missingAmenities.length)
      throw new Error(`Missing demo amenities: ${missingAmenities.join(', ')}`);

    const baseHotels = (await dataSource.query(
      `SELECT id FROM hotels WHERE id = ANY($1::uuid[]) AND tax_code LIKE 'DEMO-HOTEL-%'`,
      [EXISTING_HOTELS],
    )) as Array<{ id: string }>;
    if (baseHotels.length !== EXISTING_HOTELS.length)
      throw new Error('The four base demo hotels must exist before the expansion seed.');

    await dataSource.transaction(async (manager) => {
      for (const [index, hotelId] of EXISTING_HOTELS.entries()) {
        await manager.query(
          `UPDATE hotels
              SET legal_name = name, description = $2, updated_at = now()
            WHERE id = $1 AND tax_code LIKE 'DEMO-HOTEL-%'`,
          [hotelId, EXISTING_HOTEL_DESCRIPTIONS[index]],
        );
        await manager.query(
          `UPDATE hotel_review_histories
              SET reason = 'Hồ sơ khách sạn đã được xét duyệt.'
            WHERE hotel_id = $1 AND reason ILIKE '%demo%'`,
          [hotelId],
        );
      }

      for (const [hotelIndex, hotel] of additionalDemoHotels.entries()) {
        const sequence = 101 + hotelIndex;
        const hotelId = fixedId(HOTEL_ID_PREFIX, sequence);
        const ownerId = DEMO_OWNERS[hotelIndex % DEMO_OWNERS.length]!;
        const taxCode = `DEMO-HOTEL-${String(sequence).padStart(4, '0')}`;
        const age = 35 + (hotelIndex % 55);

        await manager.query(
          `INSERT INTO hotels (
             id, owner_user_id, place_id, name, legal_name, tax_code, description,
             address, phone_number, email, star_rating, check_in_time, check_out_time,
             status, submitted_at, reviewed_at, reviewed_by, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ACTIVE',
             now() - make_interval(days => $14::int),
             now() - make_interval(days => GREATEST($14::int - 1, 0)), $15,
             now() - make_interval(days => $14::int), now()
           ) ON CONFLICT (id) DO UPDATE SET
             owner_user_id = EXCLUDED.owner_user_id, place_id = EXCLUDED.place_id,
             name = EXCLUDED.name, legal_name = EXCLUDED.legal_name,
             tax_code = EXCLUDED.tax_code, description = EXCLUDED.description,
             address = EXCLUDED.address, phone_number = EXCLUDED.phone_number,
             email = EXCLUDED.email, star_rating = EXCLUDED.star_rating,
             check_in_time = EXCLUDED.check_in_time, check_out_time = EXCLUDED.check_out_time,
             status = 'ACTIVE', submitted_at = EXCLUDED.submitted_at,
             reviewed_at = EXCLUDED.reviewed_at, reviewed_by = EXCLUDED.reviewed_by,
             updated_at = now()`,
          [
            hotelId, ownerId, hotel.placeId, hotel.name, hotel.name,
            taxCode, hotelDescription(hotel, hotelIndex),
            `${hotel.street}, ${hotel.district}, ${hotel.city}`,
            `+8498000${String(sequence).padStart(4, '0')}`,
            `stay-${String(sequence).padStart(4, '0')}@demo.example.test`,
            hotel.stars, hotel.checkIn, hotel.checkOut, age, DEMO_ADMIN,
          ],
        );

        await manager.query(
          `INSERT INTO hotel_review_histories (id, hotel_id, actor_user_id, action, reason, created_at)
           VALUES ($1, $2, $3, 'APPROVED', 'Hồ sơ khách sạn đã được xét duyệt.',
                   now() - make_interval(days => $4::int))
           ON CONFLICT (id) DO UPDATE SET reason = EXCLUDED.reason`,
          [fixedId(REVIEW_HISTORY_ID_PREFIX, sequence), hotelId, DEMO_ADMIN, Math.max(age - 1, 0)],
        );

        await manager.query(
          `INSERT INTO cancellation_policies (
             id, hotel_id, name, cancel_hours, penalty_percent,
             cancellation_allowed, description, is_active, created_at, updated_at
           ) VALUES ($1, $2, 'Flexible stay policy', $3, $4, true,
                     'Cancellation terms are shown before booking; late cancellations may incur the listed fee.',
                     true, now(), now())
           ON CONFLICT (id) DO UPDATE SET
             cancel_hours = EXCLUDED.cancel_hours,
             penalty_percent = EXCLUDED.penalty_percent,
             cancellation_allowed = true, description = EXCLUDED.description,
             is_active = true, updated_at = now()`,
          [fixedId(POLICY_ID_PREFIX, sequence), hotelId, 24 + (hotelIndex % 3) * 24, 25 + (hotelIndex % 3) * 5],
        );

        for (const [roomIndex, room] of roomTemplates.entries()) {
          const roomSequence = 101 + hotelIndex * roomTemplates.length + roomIndex;
          const roomId = fixedId(ROOM_ID_PREFIX, roomSequence);
          const price = Math.round((hotel.basePrice * room.priceFactor) / 1000) * 1000;
          await manager.query(
            `INSERT INTO rooms (
               id, hotel_id, room_number, max_occupancy, price_per_night,
               currency, description, operational_status, room_type, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, 'VND', $6, 'AVAILABLE', $7, now(), now())
             ON CONFLICT (id) DO UPDATE SET
               hotel_id = EXCLUDED.hotel_id, room_number = EXCLUDED.room_number,
               max_occupancy = EXCLUDED.max_occupancy, price_per_night = EXCLUDED.price_per_night,
               currency = EXCLUDED.currency, description = EXCLUDED.description,
               operational_status = 'AVAILABLE', room_type = EXCLUDED.room_type,
               deleted_at = NULL, updated_at = now()`,
            [roomId, hotelId, room.roomNumber, room.maxOccupancy, price, roomDescription(room, hotel), room.roomType],
          );

          for (const code of room.amenityCodes) {
            await manager.query(
              'INSERT INTO room_amenities (room_id, amenity_id, created_at, updated_at) VALUES ($1, $2, now(), now()) ON CONFLICT DO NOTHING',
              [roomId, amenityIds.get(code)],
            );
          }

          await manager.query(
            `INSERT INTO room_guest_policies (
               hotel_id, room_type, max_adults, max_children, adult_age_from,
               free_child_max_age, child_surcharge_per_night, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 12, $5, $6, now(), now()) ON CONFLICT DO NOTHING`,
            [hotelId, room.roomType, room.maxAdults, room.maxChildren, room.freeChildMaxAge, room.childSurcharge],
          );

          await manager.query(
            `INSERT INTO room_images (id, room_id, image_id, image_order, created_at, updated_at)
             VALUES ($1, $2, $3, 1, now(), now())
             ON CONFLICT (id) DO UPDATE SET image_id = EXCLUDED.image_id,
               image_order = 1, deleted_at = NULL, updated_at = now()`,
            [fixedId(ROOM_IMAGE_ID_PREFIX, roomSequence), roomId, PLACEHOLDER_IMAGE_IDS[(hotelIndex + roomIndex) % PLACEHOLDER_IMAGE_IDS.length]],
          );
        }

        for (let order = 1; order <= 3; order += 1) {
          const relationSequence = 201 + hotelIndex * 3 + order - 1;
          await manager.query(
            `INSERT INTO hotel_images (id, hotel_id, image_id, image_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, now(), now())
             ON CONFLICT (id) DO UPDATE SET image_id = EXCLUDED.image_id,
               image_order = EXCLUDED.image_order, deleted_at = NULL, updated_at = now()`,
            [fixedId(HOTEL_IMAGE_ID_PREFIX, relationSequence), hotelId, PLACEHOLDER_IMAGE_IDS[(hotelIndex * 3 + order - 1) % PLACEHOLDER_IMAGE_IDS.length], order],
          );
        }
      }

      const extraPhotos = [
        { hotel: 0, order: 3, image: 5 },
        { hotel: 1, order: 2, image: 0 },
        { hotel: 1, order: 3, image: 5 },
        { hotel: 2, order: 2, image: 0 },
        { hotel: 2, order: 3, image: 5 },
        { hotel: 3, order: 2, image: 1 },
        { hotel: 3, order: 3, image: 5 },
      ];
      for (const [index, photo] of extraPhotos.entries()) {
        await manager.query(
          `INSERT INTO hotel_images (id, hotel_id, image_id, image_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, now(), now())
           ON CONFLICT (id) DO UPDATE SET image_id = EXCLUDED.image_id,
             image_order = EXCLUDED.image_order, deleted_at = NULL, updated_at = now()`,
          [fixedId(HOTEL_IMAGE_ID_PREFIX, 101 + index), EXISTING_HOTELS[photo.hotel], PLACEHOLDER_IMAGE_IDS[photo.image], photo.order],
        );
      }
    });

    console.log(
      `Seeded ${additionalDemoHotels.length} additional hotels, ${additionalDemoHotels.length * roomTemplates.length} room types, ${additionalDemoHotels.length * 3 + 7} hotel gallery links, and ${additionalDemoHotels.length * roomTemplates.length} room photo links.`,
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void seedDemoLodgingExpansion().catch((error: unknown) => {
  console.error('Failed to seed the demo hotel and room catalog.', error);
  process.exitCode = 1;
});
