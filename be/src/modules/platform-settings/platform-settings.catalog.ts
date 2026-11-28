type FieldKind = 'text' | 'secret' | 'number' | 'boolean';
export type SettingValue = string | number | boolean;

export interface SettingsReader {
  get<T>(key: string, fallback?: T): T | undefined;
  getOrThrow<T>(key: string, fallback?: T): T;
}

interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  readOnly?: boolean;
  min?: number;
  max?: number;
}

const field = (key: string, label: string, kind: FieldKind, options: Partial<Pick<Field, 'readOnly' | 'min' | 'max'>> = {}): Field => ({ key, label, kind, ...options });
const info = (key: string, label: string, kind: FieldKind = 'text') => field(key, label, kind, { readOnly: true });
const payos = (prefix: string) => [
  field(`${prefix}_CLIENT_ID`, 'Mã định danh ứng dụng', 'secret'),
  field(`${prefix}_API_KEY`, 'Khóa truy cập API', 'secret'),
  field(`${prefix}_CHECKSUM_KEY`, 'Khóa kiểm tra chữ ký', 'secret'),
];

export const platformSections = {
  booking: {
    label: 'Giữ phòng', description: 'Thời hạn giữ phòng cho đơn đặt phòng mới.', fields: [
      field('BOOKING_HOLD_MINUTES', 'Giữ phòng chờ thanh toán (phút)', 'number', { min: 5, max: 1440 }),
      field('IDEMPOTENCY_KEY_TTL_HOURS', 'Thời gian chống tạo đơn trùng (giờ)', 'number', { min: 1, max: 168 }),
    ],
  },
  'payos-collection': {
    label: 'payOS thu tiền', description: 'Kênh thanh toán đơn đặt phòng. Mã định danh ứng dụng được cố định để tra cứu giao dịch cũ.', fields: payos('PAYOS'),
  },
  'payos-payout': {
    label: 'payOS chi tiền', description: 'Kênh hoàn tiền và chi trả khách sạn. Mã định danh ứng dụng được cố định sau khi thiết lập.', fields: payos('PAYOS_PAYOUT'),
  },
  refunds: {
    label: 'Hoàn tiền', description: 'Điều khiển việc tự gửi yêu cầu hoàn đủ điều kiện qua kênh chi payOS.', fields: [
      field('PAYOS_AUTO_REFUNDS_ENABLED', 'Tự động hoàn tiền qua payOS', 'boolean'),
    ],
  },
  google: {
    label: 'Google', description: 'Đăng nhập Google. Dùng URL chuyển hướng này trong cấu hình OAuth của Google.', fields: [
      field('GOOGLE_CLIENT_ID', 'Mã định danh ứng dụng Google', 'text'),
      field('GOOGLE_CLIENT_SECRET', 'Khóa bí mật của ứng dụng Google', 'secret'),
      info('GOOGLE_REDIRECT_URI', 'URL chuyển hướng'),
    ],
  },
  'email-connection': {
    label: 'Kết nối thư điện tử', description: 'Thiết lập máy chủ SMTP để gửi mã xác thực và thông báo.', fields: [
      info('SMTP_HOST', 'Máy chủ SMTP'),
      field('SMTP_PORT', 'Cổng SMTP', 'number', { min: 1, max: 65535 }),
      field('SMTP_SECURE', 'Kết nối TLS ngay từ đầu', 'boolean'),
    ],
  },
  'email-account': {
    label: 'Tài khoản thư điện tử', description: 'Thông tin gửi mã xác thực và thông báo qua máy chủ SMTP đã khai báo.', fields: [
      field('EMAIL_FROM', 'Địa chỉ gửi', 'text'),
      field('SMTP_USER', 'Tên đăng nhập SMTP', 'text'),
      field('SMTP_PASSWORD', 'Mật khẩu SMTP', 'secret'),
    ],
  },
  map: {
    label: 'Bản đồ', description: 'Mã truy cập Mapbox công khai và thông tin nhận diện khi tìm địa chỉ.', fields: [
      field('MAPBOX_PUBLIC_TOKEN', 'Mã truy cập Mapbox công khai (pk.)', 'text'),
      field('HOTEL_GEOCODER_USER_AGENT', 'Thông tin nhận diện ứng dụng', 'text'),
      info('HOTEL_GEOCODER_ORIGIN', 'Máy chủ tìm địa chỉ'),
    ],
  },
  ai: {
    label: 'Dịch vụ AI', description: 'Kết nối nội bộ được cấp theo cấu hình triển khai. Cấu hình nhà cung cấp và mô hình nằm trong dịch vụ AI.', fields: [
      info('AI_BASE_URL', 'Địa chỉ dịch vụ AI'), info('AI_API_KEY', 'Khóa kết nối nội bộ', 'secret'), info('AI_TIMEOUT_MS', 'Thời gian chờ (ms)', 'number'),
    ],
  },
  storage: {
    label: 'Lưu trữ ảnh', description: 'Kết nối kho lưu trữ ảnh đang được sử dụng.', fields: [
      info('S3_ENDPOINT', 'Địa chỉ S3 / MinIO'), info('S3_HOTEL_IMAGES_BUCKET', 'Tên kho chứa ảnh'), info('S3_SECRET_KEY', 'Khóa lưu trữ', 'secret'),
    ],
  },
} satisfies Record<string, { label: string; description: string; fields: Field[] }>;

export type PlatformSection = keyof typeof platformSections;

export function isPlatformSection(value: string): value is PlatformSection {
  return Object.hasOwn(platformSections, value);
}
