import { parseISO } from 'date-fns'
import { localizedErrorMessage } from './error-messages'
import { DomainError } from './errors'

export const currency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
const vnDayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
const vnTimeFormatter = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?$/
export const day = (value: string) => {
  const local = localDatePattern.exec(value)
  if (local) return `${local[3]}/${local[2]}/${local[1]}`
  const date = parseISO(value)
  return Number.isFinite(date.getTime()) ? vnDayFormatter.format(date) : '—'
}
export const dateTime = (value: string) => {
  const local = localDatePattern.exec(value)
  if (local) return local[4] ? day(value) + ' ' + local[4] : day(value)
  const date = parseISO(value)
  return Number.isFinite(date.getTime()) ? vnDayFormatter.format(date) + ' ' + vnTimeFormatter.format(date) : '—'
}
export const addDay = (start: string, offset: number) => {
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
export const todayPlus = (n: number) => {
  const parts = vnDayFormatter.formatToParts(new Date())
  const read = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return addDay(`${read('year')}-${read('month')}-${read('day')}`, n)
}
export const nights = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
export const stayDays = (start: string, end: string) => Array.from({ length: Math.max(0, nights(start, end)) }, (_, i) => addDay(start, i))
export const uid = (prefix: string) => prefix + '-' + crypto.randomUUID().slice(0, 8)
export const overlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && bStart < aEnd
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const formatStatus = (s: string) => ({
  PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn',
  PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền',
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối', NEEDS_INFO: 'Cần bổ sung', SUSPENDED: 'Tạm đình chỉ',
  ACTIVE: 'Hoạt động', INACTIVE: 'Không hoạt động', DEACTIVATED: 'Đã vô hiệu hóa',
  VISIBLE: 'Hiển thị', HIDDEN: 'Đã ẩn', SAVED: 'Đã lưu',
  AVAILABLE: 'Đang kinh doanh', MAINTENANCE: 'Đang bảo trì', OUT_OF_SERVICE: 'Ngừng khai thác',
  PAYMENT_PENDING: 'Chờ thanh toán', SETTLED: 'Đã đối soát', NONE: 'Chưa phát sinh',
  SUBMITTED: 'Đã gửi xét duyệt', REACTIVATED: 'Đã kích hoạt lại',
} as Record<string, string>)[s] ?? 'Chưa xác định'
export const errorMessage = (error: unknown) => localizedErrorMessage(
  error instanceof Error ? error.message : undefined,
  error instanceof DomainError ? error.code : undefined,
  error instanceof DomainError ? error.status : undefined,
)
