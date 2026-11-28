import type { ReactNode } from 'react'
import { Card, StatusBadge } from '@/components/common'
import { DialogList, DialogSections } from '@/components/ui/dialog-sections'
import { currency, dateTime, day } from '@/lib/utils'
import { localizedErrorMessage } from '@/lib/error-messages'
import type { ManagedBooking } from '@/types/domain'

const paymentMethods: Record<string, string> = {
  QR: 'Quét mã QR',
  CARD: 'Thẻ ngân hàng',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  CASH: 'Tiền mặt',
}

export function BookingDetails({ booking, hotelName }: { booking: ManagedBooking; hotelName: string }) {
  const statusItems = [
    { label: 'Đơn đặt phòng', status: booking.bookingStatus },
    { label: 'Thanh toán', status: booking.paymentStatus },
    { label: 'Hoàn tiền', status: booking.refundStatus },
    { label: 'Đối soát', status: booking.settlementStatus },
  ]

  return <>
    <dl className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-4">
      {statusItems.map(({ label, status }) => <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <dt className="mb-1 text-xs font-medium text-slate-600">{label}</dt>
        <dd><StatusBadge status={status} /></dd>
      </div>)}
    </dl>
    <DialogSections label="Chi tiết đơn đặt phòng" sections={[
      {
        id: 'overview', label: 'Tổng quan', content: <div className="grid gap-3 md:grid-cols-2">
          <Card className="min-w-0 p-3 sm:p-4">
            <h3 className="mb-2 font-semibold">Khách đặt</h3>
            <dl className="grid grid-cols-2 gap-2 sm:gap-3">
              <Detail label="Họ và tên">{booking.guestName}</Detail>
              <Detail label="Số điện thoại">{booking.guestPhone}</Detail>
              <Detail label="Thư điện tử" className="col-span-2">{booking.guestEmail}</Detail>
            </dl>
          </Card>
          <Card className="min-w-0 p-3 sm:p-4">
            <h3 className="mb-2 font-semibold">Lưu trú</h3>
            <dl className="grid grid-cols-2 gap-2 sm:gap-3">
              <Detail label="Khách sạn" className="col-span-2">{hotelName}</Detail>
              <Detail label="Nhận phòng">{day(booking.checkInDate)}</Detail>
              <Detail label="Trả phòng">{day(booking.checkOutDate)}</Detail>
              <Detail label="Ngày đặt">{day(booking.createdAt)}</Detail>
              <Detail label="Số khách">{booking.adultCount} người lớn · {booking.childCount} trẻ em</Detail>
            </dl>
          </Card>
        </div>,
      },
      {
        id: 'rooms', label: 'Phòng', content: <Card className="p-3 sm:p-4">
          <h3 className="mb-2 font-semibold">Phòng và chi phí</h3>
          <DialogList label="Trang danh sách phòng" pageSize={3} items={booking.roomItems.map(item =>
            <li className="flex items-start justify-between gap-3 py-2 text-sm" key={item.id}>
              <span className="min-w-0 wrap-anywhere"><strong>{item.roomNumberSnapshot}</strong> · {item.roomTypeSnapshot} · {item.numberOfNights} đêm</span>
              <strong className="shrink-0">{currency(item.subtotal)}</strong>
            </li>
          )} />
          <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-2 font-semibold"><span>Tổng tiền đặt phòng</span><span>{currency(booking.amount)}</span></div>
          <dl className="mt-3 border-t border-slate-200 pt-3"><Detail label="Yêu cầu đặc biệt">{booking.specialRequests || 'Không có'}</Detail></dl>
        </Card>,
      },
      {
        id: 'refund', label: 'Hoàn tiền', content: <Card className="p-3 sm:p-4">
          <h3 className="mb-2 font-semibold">Chi tiết hoàn tiền</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Detail label="Số tiền hoàn">{booking.refundAmount === null ? '—' : currency(booking.refundAmount)}</Detail>
            <Detail label="Phí hủy">{booking.cancellationFeeAmount === null ? '—' : currency(booking.cancellationFeeAmount)}{booking.cancellationFeeRateSnapshot !== null ? ` (${booking.cancellationFeeRateSnapshot}%)` : ''}</Detail>
            <Detail label="Lần yêu cầu">{booking.refundAttempt}</Detail>
            <Detail label="Ngày yêu cầu hoàn">{booking.refundRequestedAt ? dateTime(booking.refundRequestedAt) : '—'}</Detail>
            <Detail label="Bắt đầu xử lý">{booking.refundProcessingAt ? dateTime(booking.refundProcessingAt) : 'Chưa bắt đầu'}</Detail>
            <Detail label="Thời điểm hoàn">{booking.refundedAt ? dateTime(booking.refundedAt) : 'Chưa hoàn'}</Detail>
            <Detail label="Mã giao dịch hoàn" className="col-span-2 sm:col-span-3">{booking.refundTransactionId ?? 'Chưa có'}</Detail>
            {booking.refundReason && <Detail label="Lý do hoàn" className="col-span-2 sm:col-span-3">{booking.refundReason}</Detail>}
            {booking.refundFailureReason && <Detail label={`Kết quả hoàn tiền${booking.refundFailedAt ? ` · ${dateTime(booking.refundFailedAt)}` : ''}`} className="col-span-2 sm:col-span-3">{localizedErrorMessage(booking.refundFailureReason)}</Detail>}
          </dl>
        </Card>,
      },
      {
        id: 'finance', label: 'Thanh toán', content: <div className="grid gap-3 md:grid-cols-2">
          <Card className="min-w-0 p-3 sm:p-4">
            <h3 className="mb-2 font-semibold">Thanh toán</h3>
            <dl className="grid grid-cols-2 gap-3">
              <Detail label="Tổng tiền đặt phòng">{currency(booking.amount)}</Detail>
              <Detail label="Phương thức">{booking.paymentMethod ? paymentMethods[booking.paymentMethod] ?? 'Chưa xác định' : '—'}</Detail>
              <Detail label="Thời điểm thanh toán" className="col-span-2">{booking.paidAt ? dateTime(booking.paidAt) : 'Chưa thanh toán'}</Detail>
              <Detail label="Chính sách hủy đã áp dụng" className="col-span-2">{booking.cancellationDescriptionSnapshot ?? 'Chưa hủy'}</Detail>
            </dl>
          </Card>
          <Card className="min-w-0 p-3 sm:p-4">
            <h3 className="mb-2 font-semibold">Đối soát</h3>
            <dl className="grid grid-cols-2 gap-3">
              <Detail label="Cơ sở quyết toán">{booking.settlementBaseAmount === null ? '—' : currency(booking.settlementBaseAmount)}</Detail>
              <Detail label="Thời điểm quyết toán">{booking.settledAt ? dateTime(booking.settledAt) : 'Chưa quyết toán'}</Detail>
            </dl>
          </Card>
        </div>,
      },
    ]} />
  </>
}

function Detail({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <div className={`min-w-0 text-sm ${className}`}>
    <dt className="text-slate-500">{label}</dt>
    <dd className="mt-0.5 whitespace-pre-wrap wrap-anywhere text-slate-800">{children}</dd>
  </div>
}
