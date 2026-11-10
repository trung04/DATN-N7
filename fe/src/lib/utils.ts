import { format, parseISO } from 'date-fns'

export const currency = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n)
export const day = (value: string) => format(parseISO(value), 'dd/MM/yyyy')
export const dateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
export const addDay = (start: string, offset: number) => {
  const date = new Date(`${start}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
const vnDayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
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
  DRAFT: 'Bản nháp', APPROVED: 'Đã duyệt', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối', NEEDS_INFO: 'Cần bổ sung',
  VISIBLE: 'Hiển thị', HIDDEN: 'Đã ẩn', SAVED: 'Đã lưu',
} as Record<string, string>)[s] ?? s
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
