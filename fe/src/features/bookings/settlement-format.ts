import type { SettlementStatus } from '@/types/domain'

const labels: Record<SettlementStatus, string> = {
  DRAFT: 'Bản nháp',
  APPROVED: 'Chờ chi trả',
  PROCESSING: 'Đang chi trả',
  PAID: 'Đã chi trả',
  FAILED: 'Chi trả thất bại',
}

export function settlementStatusLabel(status: SettlementStatus, simulated: boolean) {
  return simulated ? 'Chi trả mô phỏng' : labels[status]
}

export function settlementEventLabel(status: SettlementStatus, simulated: boolean) {
  if (status === 'DRAFT') return 'Tạo bảng kê'
  if (status === 'APPROVED') return 'Đã duyệt bảng kê'
  return settlementStatusLabel(status, status === 'PAID' && simulated)
}

export function settlementMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(amount)} ${currency}`
}
