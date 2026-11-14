import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { currency, day, errorMessage } from '@/lib/utils'
import type { BookingListQuery, ManagedBooking, ManagedBookingStatus, ManagedPaymentStatus, ManagedRefundStatus, ManagedSettlementStatus, PartnerHotelQuery } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }
const statuses: Array<['bookingStatus' | 'paymentStatus' | 'refundStatus' | 'settlementStatus', string, string[]]> = [
  ['bookingStatus', 'Booking', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']],
  ['paymentStatus', 'Thanh toán', ['PENDING', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED']],
  ['refundStatus', 'Hoàn tiền', ['NONE', 'PENDING', 'PROCESSING', 'REFUNDED', 'FAILED']],
  ['settlementStatus', 'Đối soát', ['PENDING', 'PROCESSING', 'SETTLED', 'FAILED']],
]
const labels: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', COMPLETED: 'Hoàn tất', PAYMENT_PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', EXPIRED: 'Hết hạn', NONE: 'Chưa yêu cầu', REFUNDED: 'Đã hoàn', PROCESSING: 'Đang xử lý', SETTLED: 'Đã quyết toán' }
const parseStatus = <T extends string>(value: string | null): T | undefined => value ? value as T : undefined

export function BookingManagementPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'booking-hotels'], queryFn: () => admin ? api.adminHotels(hotelsQuery) : api.myHotels(hotelsQuery) })
  const selectedHotelId = params.get('hotelId') || (admin ? '' : hotels.data?.data[0]?.id || '')
  const page = Number(params.get('page') || 1)
  const query = useMemo<BookingListQuery>(() => ({
    page, limit: 20,
    sortBy: (params.get('sortBy') as BookingListQuery['sortBy'] | null) ?? 'createdAt',
    sortOrder: (params.get('sortOrder') as BookingListQuery['sortOrder'] | null) ?? 'DESC',
    ...(params.get('search') ? { search: params.get('search')! } : {}),
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(parseStatus<ManagedBookingStatus>(params.get('bookingStatus')) ? { bookingStatus: parseStatus<ManagedBookingStatus>(params.get('bookingStatus')) } : {}),
    ...(parseStatus<ManagedPaymentStatus>(params.get('paymentStatus')) ? { paymentStatus: parseStatus<ManagedPaymentStatus>(params.get('paymentStatus')) } : {}),
    ...(parseStatus<ManagedRefundStatus>(params.get('refundStatus')) ? { refundStatus: parseStatus<ManagedRefundStatus>(params.get('refundStatus')) } : {}),
    ...(parseStatus<ManagedSettlementStatus>(params.get('settlementStatus')) ? { settlementStatus: parseStatus<ManagedSettlementStatus>(params.get('settlementStatus')) } : {}),
    ...(params.get('createdFrom') ? { createdFrom: params.get('createdFrom')! } : {}),
    ...(params.get('createdTo') ? { createdTo: params.get('createdTo')! } : {}),
  }), [page, params, selectedHotelId])
  const bookings = useQuery({ queryKey: ['managed-bookings', admin, query], queryFn: () => api.managedBookings(query), enabled: admin || Boolean(selectedHotelId) })
  const [selectedId, setSelectedId] = useState('')
  const detail = useQuery({ queryKey: ['managed-booking', selectedId], queryFn: () => api.managedBooking(selectedId), enabled: Boolean(selectedId) })
  const [action, setAction] = useState<'refund' | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const updateParams = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.set('page', '1')
    setParams(next, { replace: true })
  }
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['managed-bookings'] })
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ['managed-booking', selectedId] })
  }
  const beginAction = (next: 'refund', booking: ManagedBooking) => {
    setAction(next); setError('')
    setAmount(String(booking.refundAmount ?? booking.amount)); setReason(booking.refundReason ?? `Hoàn tiền booking ${booking.bookingCode}`)
  }
  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!detail.data) return
    setBusy(true); setError('')
    try {
      await api.refundManagedBooking(detail.data.id, Number(amount), reason.trim())
      await refresh(); setAction(null); setNotice('Đã gửi yêu cầu hoàn tiền tới SePay; trạng thái sẽ được cập nhật từ phía ngân hàng.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const completeBooking = async () => {
    if (!detail.data) return
    setBusy(true); setError('')
    try { await api.completeManagedBooking(detail.data.id); await refresh(); setNotice('Đã đánh dấu booking hoàn tất.') }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const syncRefund = async () => {
    if (!detail.data) return
    setBusy(true); setError('')
    try { await api.syncManagedRefund(detail.data.id); await refresh(); setNotice('Đã đồng bộ trạng thái hoàn tiền từ SePay.') }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!admin && hotels.data.data.length === 0) return <EmptyState title="Bạn chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi quản lý đặt phòng." />
  if (bookings.isPending) return <LoadingState />
  if (bookings.isError) return <ErrorState message={errorMessage(bookings.error)} retry={() => { void bookings.refetch() }} />

  const hotelName = (id: string) => hotels.data.data.find(hotel => hotel.id === id)?.name ?? id
  return <div>
    <PageHeader title={admin ? 'Quản lý đặt phòng' : 'Đặt phòng khách sạn'} description={admin ? 'Tra cứu booking toàn hệ thống, theo dõi thanh toán, hoàn tiền và quyết toán.' : 'Theo dõi booking, thanh toán và hủy tại khách sạn của bạn.'} />
    <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Tìm booking hoặc khách"><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="pl-9" value={params.get('search') ?? ''} onChange={event => updateParams({ search: event.target.value || undefined })} placeholder="Mã booking, tên hoặc email" /></div></FormField>
      <FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => updateParams({ hotelId: event.target.value || undefined })}><option value="">{admin ? 'Tất cả khách sạn' : 'Chọn khách sạn'}</option>{hotels.data.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
      {statuses.map(([key, title, values]) => <FormField key={key} label={`Trạng thái ${title.toLocaleLowerCase('vi-VN')}`}><select value={params.get(key) ?? ''} onChange={event => updateParams({ [key]: event.target.value || undefined })}><option value="">Tất cả</option>{values.map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></FormField>)}
      <FormField label="Tạo từ"><input type="date" value={params.get('createdFrom') ?? ''} onChange={event => updateParams({ createdFrom: event.target.value || undefined })} /></FormField>
      <FormField label="Tạo đến"><input type="date" value={params.get('createdTo') ?? ''} onChange={event => updateParams({ createdTo: event.target.value || undefined })} /></FormField>
      <FormField label="Sắp xếp"><select value={`${query.sortBy}:${query.sortOrder}`} onChange={event => { const [sortBy, sortOrder] = event.target.value.split(':'); updateParams({ sortBy, sortOrder }) }}><option value="createdAt:DESC">Mới nhất</option><option value="createdAt:ASC">Cũ nhất</option><option value="bookingCode:ASC">Mã booking A–Z</option><option value="amount:DESC">Giá trị cao nhất</option><option value="amount:ASC">Giá trị thấp nhất</option></select></FormField>
    </Card>
    <Feedback message={notice} />
    {bookings.data.data.length ? <>
      <Card className="table-scroll mt-4"><table><thead><tr><th>Mã booking</th>{admin && <th>Khách sạn</th>}<th>Khách đặt</th><th>Ngày lưu trú</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Booking</th><th>Thanh toán</th><th>Hoàn tiền</th><th>Chi tiết</th></tr></thead><tbody>{bookings.data.data.map(booking => <tr key={booking.id}><td className="font-mono text-sm">{booking.bookingCode}</td>{admin && <td>{hotelName(booking.hotelId)}</td>}<td><strong>{booking.guestName}</strong><span className="block text-xs text-slate-500">{booking.guestEmail}</span></td><td>{day(booking.checkInDate)} – {day(booking.checkOutDate)}</td><td>{day(booking.createdAt)}</td><td>{currency(booking.amount)}</td><td><StatusBadge status={booking.bookingStatus} /></td><td><StatusBadge status={booking.paymentStatus} /></td><td><StatusBadge status={booking.refundStatus} /></td><td><Button variant="secondary" size="sm" onClick={() => { setSelectedId(booking.id); setAction(null); setError(''); setNotice('') }}><Eye size={15} />Mở</Button></td></tr>)}</tbody></table></Card>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{bookings.data.meta.total} booking · trang {page}</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>Trước</Button><Button variant="secondary" disabled={page * 20 >= bookings.data.meta.total} onClick={() => updateParams({ page: String(page + 1) })}>Tiếp</Button></div></div>
    </> : <EmptyState title="Không có booking phù hợp" description="Thử đổi khách sạn, khoảng ngày hoặc bộ lọc trạng thái." />}

    <Dialog open={Boolean(selectedId)} onOpenChange={open => { if (!open) { setSelectedId(''); setAction(null); setError('') } }}><DialogContent title={detail.data ? `Booking ${detail.data.bookingCode}` : 'Chi tiết booking'}>
      {detail.isPending ? <LoadingState /> : detail.isError ? <ErrorState message={errorMessage(detail.error)} retry={() => { void detail.refetch() }} /> : detail.data ? <div className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-2"><StatusBadge status={detail.data.bookingStatus} /><StatusBadge status={detail.data.paymentStatus} /><StatusBadge status={detail.data.refundStatus} /><StatusBadge status={detail.data.settlementStatus} /></div>
        <Card className="grid gap-2 p-4 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Khách sạn</span><br /><strong>{hotelName(detail.data.hotelId)}</strong></p><p><span className="text-slate-500">Khách đặt</span><br /><strong>{detail.data.guestName}</strong></p><p>{detail.data.guestEmail}</p><p>{detail.data.guestPhone}</p><p><span className="text-slate-500">Nhận phòng</span><br />{day(detail.data.checkInDate)}</p><p><span className="text-slate-500">Trả phòng</span><br />{day(detail.data.checkOutDate)}</p><p><span className="text-slate-500">Số khách</span><br />{detail.data.adultCount} người lớn · {detail.data.childCount} trẻ em</p><p><span className="text-slate-500">Phương thức</span><br />{detail.data.paymentMethod ?? '—'}</p></Card>
        <Card className="p-4"><h3 className="font-semibold">Phòng và chi phí</h3><div className="mt-3 grid gap-2 text-sm">{detail.data.roomItems.map(item => <div className="flex justify-between gap-3" key={item.id}><span>{item.roomNumberSnapshot} · {item.roomTypeSnapshot} · {item.numberOfNights} đêm</span><strong>{currency(item.subtotal)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t pt-3 font-semibold"><span>Tổng booking</span><span>{currency(detail.data.amount)}</span></div></Card>
        <Card className="grid gap-2 p-4 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Đã thanh toán</span><br />{detail.data.paidAt ? day(detail.data.paidAt) : 'Chưa thanh toán'}</p><p><span className="text-slate-500">Phí hủy</span><br />{detail.data.cancellationFeeAmount === null ? '—' : currency(detail.data.cancellationFeeAmount)}{detail.data.cancellationFeeRateSnapshot !== null ? ` (${detail.data.cancellationFeeRateSnapshot}%)` : ''}</p><p><span className="text-slate-500">Chính sách đã áp dụng</span><br />{detail.data.cancellationDescriptionSnapshot ?? 'Chưa hủy'}</p><p><span className="text-slate-500">Số tiền hoàn</span><br />{detail.data.refundAmount === null ? '—' : currency(detail.data.refundAmount)}</p><p><span className="text-slate-500">Lý do hoàn</span><br />{detail.data.refundReason ?? '—'}</p><p><span className="text-slate-500">Ngày yêu cầu hoàn</span><br />{detail.data.refundRequestedAt ? day(detail.data.refundRequestedAt) : '—'}</p><p><span className="text-slate-500">Bắt đầu xử lý</span><br />{detail.data.refundProcessingAt ? day(detail.data.refundProcessingAt) : 'Chưa bắt đầu'}</p><p><span className="text-slate-500">Lần yêu cầu</span><br />{detail.data.refundAttempt}</p><p><span className="text-slate-500">Mã giao dịch hoàn</span><br />{detail.data.refundTransactionId ?? 'Chưa có'}</p>{detail.data.refundFailureReason && <p className="sm:col-span-2"><span className="text-slate-500">Lý do thất bại gần nhất{detail.data.refundFailedAt ? ` · ${day(detail.data.refundFailedAt)}` : ''}</span><br />{detail.data.refundFailureReason}</p>}<p><span className="text-slate-500">Thời điểm hoàn</span><br />{detail.data.refundedAt ? day(detail.data.refundedAt) : 'Chưa hoàn'}</p><p><span className="text-slate-500">Cơ sở quyết toán</span><br />{detail.data.settlementBaseAmount === null ? '—' : currency(detail.data.settlementBaseAmount)}</p><p><span className="text-slate-500">Đã quyết toán</span><br />{detail.data.settledAt ? day(detail.data.settledAt) : 'Chưa quyết toán'}</p><p className="sm:col-span-2"><span className="text-slate-500">Yêu cầu đặc biệt</span><br />{detail.data.specialRequests || 'Không có'}</p></Card>
        <Feedback message={error} kind="error" /><Feedback message={notice} />
        {!action && <div className="flex flex-wrap justify-end gap-2">{!admin && detail.data.bookingStatus === 'CONFIRMED' && detail.data.paymentStatus === 'PAID' && <Button disabled={busy} onClick={() => { void completeBooking() }}>Đánh dấu hoàn tất</Button>}{admin && detail.data.paymentStatus === 'PAID' && (detail.data.refundStatus === 'NONE' || detail.data.refundStatus === 'FAILED') && <Button variant="secondary" onClick={() => beginAction('refund', detail.data!)}>{detail.data.refundStatus === 'FAILED' ? 'Tạo lại yêu cầu hoàn tiền' : 'Tạo yêu cầu hoàn tiền'}</Button>}{admin && ['PENDING', 'PROCESSING'].includes(detail.data.refundStatus) && <Button disabled={busy} onClick={() => { void syncRefund() }}>Đồng bộ trạng thái hoàn tiền</Button>}</div>}
        {action && <form className="grid gap-3 rounded-lg border border-slate-200 p-4" onSubmit={submitAction}><h3 className="font-semibold">Gửi yêu cầu hoàn tiền qua SePay</h3><p className="text-sm text-amber-800">Backend sẽ gửi lệnh hoàn tiền tự động qua SePay API v2 và cập nhật trạng thái từ SePay.</p><FormField label="Số tiền hoàn"><input required type="number" min="1" step="1" max={detail.data.amount} value={amount} readOnly={detail.data.refundStatus === 'FAILED'} onChange={event => setAmount(event.target.value)} /></FormField><FormField label="Lý do hoàn tiền"><textarea required maxLength={5000} value={reason} onChange={event => setReason(event.target.value)} /></FormField><Feedback message={error} kind="error" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setAction(null); setError('') }}>Quay lại</Button><Button disabled={busy}>{busy ? 'Đang xử lý...' : 'Xác nhận'}</Button></div></form>}
      </div> : null}
    </DialogContent></Dialog>
  </div>
}
