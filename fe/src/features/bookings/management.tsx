import { DateField } from '@/components/ui/date-input'
import { loadHotelOptions } from '@/services/api/management-options'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { readPage, readPageSize } from '@/lib/pagination'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, SlidersHorizontal } from 'lucide-react'
import { ManagementSearch, SearchButton } from '@/components/management-search'
import { HotelManagementLocked } from '@/components/hotel-management-locked'
import { useSearchFilters } from '@/lib/use-search-filters'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { currency, day, errorMessage } from '@/lib/utils'
import type { BookingListQuery, ManagedBooking, ManagedBookingStatus, ManagedPaymentStatus, ManagedRefundStatus, ManagedSettlementStatus } from '@/types/domain'
import { BookingDetails } from './booking-details'

const statuses: Array<['bookingStatus' | 'paymentStatus' | 'refundStatus' | 'settlementStatus', string, string[]]> = [
  ['bookingStatus', 'Đơn đặt phòng', ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']],
  ['paymentStatus', 'Thanh toán', ['PENDING', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'EXPIRED']],
  ['refundStatus', 'Hoàn tiền', ['NONE', 'PENDING', 'PROCESSING', 'REFUNDED', 'FAILED']],
  ['settlementStatus', 'Đối soát', ['PENDING', 'PROCESSING', 'SETTLED', 'FAILED']],
]
const labels: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', COMPLETED: 'Hoàn tất', PAYMENT_PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', EXPIRED: 'Hết hạn', NONE: 'Chưa yêu cầu', REFUNDED: 'Đã hoàn', PROCESSING: 'Đang xử lý', SETTLED: 'Đã quyết toán' }
const parseStatus = <T extends string>(value: string | null): T | undefined => value ? value as T : undefined
const extraFilters = ['paymentStatus', 'refundStatus', 'settlementStatus', 'createdFrom', 'createdTo']

export function BookingManagementPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: [admin ? 'admin' : 'partner', 'booking-hotels'], queryFn: () => loadHotelOptions(admin) })
  const selectedHotelId = params.get('hotelId') || (admin ? '' : (hotels.data?.find(hotel => hotel.status === 'ACTIVE') ?? hotels.data?.[0])?.id || '')
  const selectedHotel = hotels.data?.find(hotel => hotel.id === selectedHotelId)
  const canCompleteAt = (hotelId: string) => !admin && hotels.data?.some(hotel => hotel.id === hotelId && hotel.status === 'ACTIVE')
  const page = readPage(params)
  const size = readPageSize(params)
  const query = useMemo<BookingListQuery>(() => ({
    page, limit: size,
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
  }), [page, size, params, selectedHotelId])
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, {
    search: params.get('search') ?? '', hotelId: selectedHotelId,
    bookingStatus: params.get('bookingStatus') ?? '', paymentStatus: params.get('paymentStatus') ?? '',
    refundStatus: params.get('refundStatus') ?? '', settlementStatus: params.get('settlementStatus') ?? '',
    createdFrom: params.get('createdFrom') ?? '', createdTo: params.get('createdTo') ?? '',
    sortBy: query.sortBy, sortOrder: query.sortOrder,
  })
  const bookings = useQuery({ queryKey: ['managed-bookings', admin, query], queryFn: () => api.managedBookings(query), enabled: admin || Boolean(selectedHotelId), placeholderData: keepPreviousData })
  const pagination = usePagination(bookings.isPlaceholderData ? undefined : bookings.data?.meta.total)
  const extraFilterCount = extraFilters.filter(key => params.get(key)).length
  const [filtersOpen, setFiltersOpen] = useState(() => extraFilterCount > 0)
  const [selectedId, setSelectedId] = useState('')
  const detail = useQuery({ queryKey: ['managed-booking', selectedId], queryFn: () => api.managedBooking(selectedId), enabled: Boolean(selectedId) })
  const [action, setAction] = useState<'refund' | 'confirm-manual-refund' | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [refundReference, setRefundReference] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const refundFormId = useId()

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['managed-bookings'] })
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ['managed-booking', selectedId] })
  }
  const beginAction = (next: 'refund' | 'confirm-manual-refund', booking: ManagedBooking) => {
    setAction(next); setError('')
    setRefundReference('')
    setAmount(String(booking.refundAmount ?? booking.amount)); setReason(booking.refundReason ?? `Hoàn tiền đơn đặt phòng ${booking.bookingCode}`)
  }
  const submitAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!detail.data) return
    setBusy(true); setError('')
    try {
      if (action === 'confirm-manual-refund') {
        await api.confirmManagedManualRefund(detail.data.id, Number(amount), refundReference.trim())
        setNotice('Đã ghi nhận khoản hoàn tiền.')
      } else {
        await api.refundManagedBooking(detail.data.id, Number(amount), reason.trim())
        setNotice('Đã ghi nhận yêu cầu chi hoàn qua payOS. Xem trạng thái ở phần kết quả hoàn tiền.')
      }
      await refresh()
      setAction(null)
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const completeBooking = async () => {
    if (!detail.data || !canCompleteAt(detail.data.hotelId)) return
    setBusy(true); setError('')
    try { await api.completeManagedBooking(detail.data.id); await refresh(); setNotice('Đã đánh dấu đơn đặt phòng hoàn tất.') }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const refreshRefund = async (id: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await api.refreshPayosRefund(id); await refresh() }
    catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  const verifyRefundAccount = async (id: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const updated = await api.refreshPayosPayment(id)
      await refresh()
      if (updated.hasRefundDestination) setNotice('Đã xác minh tài khoản nhận tiền hoàn từ giao dịch gốc.')
      else setError('payOS chưa trả về thông tin tài khoản có thể dùng để hoàn tiền.')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }
  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!admin && hotels.data.length === 0) return <EmptyState title="Bạn chưa có khách sạn" description="Tạo hồ sơ khách sạn trước khi quản lý đặt phòng." />
  const hotelName = (id: string) => hotels.data.find(hotel => hotel.id === id)?.name ?? id
  const statusFilter = ([key, title, values]: typeof statuses[number]) => <FormField key={key} label={`Trạng thái ${title.toLocaleLowerCase('vi-VN')}`}><select value={filters[key]} onChange={event => changeFilters({ [key]: event.target.value })}><option value="">Tất cả</option>{values.map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></FormField>
  const booking = detail.data
  const canComplete = booking?.bookingStatus === 'CONFIRMED' && booking.paymentStatus === 'PAID' && canCompleteAt(booking.hotelId)
  const canConfirmManualRefund = admin && booking?.manualRefund && booking.paymentStatus === 'PAID' &&
    booking.refundStatus === 'PENDING' && booking.settlementStatus === 'PENDING' && (booking.refundAmount ?? 0) > 0
  const canRequestPayosRefund = admin && booking?.paymentProvider === 'PAYOS' && booking.bookingStatus === 'CANCELLED' &&
    booking.paymentStatus === 'PAID' && booking.settlementStatus === 'PENDING' && ['PENDING', 'FAILED'].includes(booking.refundStatus)
  const canRefreshRefund = admin && booking?.paymentProvider === 'PAYOS' && booking.refundStatus === 'PROCESSING'
  const refundFooter = booking && (action ? <>
    <Button variant="secondary" disabled={busy} onClick={() => { setAction(null); setError('') }}>Quay lại</Button>
    <Button type="submit" form={refundFormId} disabled={busy || (action === 'confirm-manual-refund' && !refundReference.trim())}>
      {busy ? 'Đang xử lý...' : action === 'confirm-manual-refund' ? 'Ghi nhận hoàn tiền' : 'Xác nhận'}
    </Button>
  </> : (canComplete || canConfirmManualRefund || canRequestPayosRefund || canRefreshRefund) ? <>
    {canComplete && <Button disabled={busy} onClick={() => void completeBooking()}>Đánh dấu hoàn tất</Button>}
    {canConfirmManualRefund && <Button disabled={busy} onClick={() => beginAction('confirm-manual-refund', booking)}>Xác nhận đã hoàn tiền</Button>}
    {canRequestPayosRefund && (booking.hasRefundDestination
      ? <Button variant="secondary" disabled={busy} onClick={() => beginAction('refund', booking)}>{booking.refundStatus === 'FAILED' ? 'Tạo lại yêu cầu hoàn tiền' : 'Hoàn tiền qua payOS'}</Button>
      : <>
        <p className="mr-auto text-sm text-amber-800">Hệ thống chưa xác minh được tài khoản người chuyển.</p>
        {booking.refundStatus === 'PENDING' && <Button variant="secondary" disabled={busy} onClick={() => void verifyRefundAccount(booking.id)}>Kiểm tra lại tài khoản hoàn tiền</Button>}
      </>)}
    {canRefreshRefund && <Button variant="secondary" disabled={busy} onClick={() => void refreshRefund(booking.id)}>Tra cứu hoàn tiền</Button>}
  </> : null)
  return <div className="management-list">
    <PageHeader title={admin ? 'Quản lý đặt phòng' : 'Đặt phòng khách sạn'} description={admin ? 'Tra cứu đơn đặt phòng toàn hệ thống, theo dõi thanh toán, hoàn tiền và quyết toán.' : 'Theo dõi đơn đặt phòng, thanh toán và hủy tại khách sạn của bạn.'} />
    <form aria-label="Tìm kiếm đặt phòng" onSubmit={applyFilters} className="management-filters rounded-xl border border-slate-200 bg-white">
      <div className="management-filter-row">
        <FormField label="Tìm đơn đặt phòng hoặc khách"><ManagementSearch value={filters.search} onChange={event => changeFilters({ search: event.target.value })} placeholder="Mã đặt phòng, tên hoặc thư điện tử" /></FormField>
        <FormField label="Khách sạn"><select required={!admin} value={filters.hotelId} onChange={event => changeFilters({ hotelId: event.target.value })}><option value="">{admin ? 'Tất cả khách sạn' : 'Chọn khách sạn'}</option>{hotels.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
        {statuses.slice(0, 1).map(statusFilter)}
        <FormField label="Sắp xếp"><select value={`${filters.sortBy}:${filters.sortOrder}`} onChange={event => { const [sortBy, sortOrder] = event.target.value.split(':'); changeFilters({ sortBy: sortBy as typeof filters.sortBy, sortOrder: sortOrder as typeof filters.sortOrder }) }}><option value="createdAt:DESC">Mới nhất</option><option value="createdAt:ASC">Cũ nhất</option><option value="bookingCode:ASC">Mã đặt phòng A–Z</option><option value="amount:DESC">Giá trị cao nhất</option><option value="amount:ASC">Giá trị thấp nhất</option></select></FormField>
        <Button type="button" variant="secondary" className="h-9 justify-self-start" aria-expanded={filtersOpen} aria-controls="booking-extra-filters" onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16} aria-hidden="true" />Bộ lọc{extraFilterCount > 0 && <span className="rounded-full bg-slate-200 px-1.5 text-xs tabular-nums">{extraFilterCount}</span>}</Button>
        <SearchButton />
      </div>
      {filtersOpen && <div id="booking-extra-filters" className="management-filter-more">
        {statuses.slice(1).map(statusFilter)}
        <DateField label="Tạo từ" value={filters.createdFrom} onChange={value => changeFilters({ createdFrom: value })} />
        <DateField label="Tạo đến" value={filters.createdTo} onChange={value => changeFilters({ createdTo: value })} />
      </div>}
    </form>
    {!admin && selectedHotel && selectedHotel.status !== 'ACTIVE' && <HotelManagementLocked hotel={selectedHotel} />}
    <Feedback message={notice} />
    {bookings.isPending ? <LoadingState /> : bookings.isError ? <ErrorState message={errorMessage(bookings.error)} retry={() => { void bookings.refetch() }} /> : bookings.data.data.length ? <>
      <Card className="table-scroll"><table className="management-booking-table"><thead><tr><th>Mã đặt phòng</th>{admin && <th className="management-booking-secondary">Khách sạn</th>}<th>Khách đặt</th><th className="management-booking-secondary">Ngày lưu trú</th><th className="management-booking-secondary">Tổng tiền</th><th>Đơn đặt phòng</th><th className="management-booking-secondary">Thanh toán</th><th className="management-actions">Chi tiết</th></tr></thead><tbody>{bookings.data.data.map(booking => <tr key={booking.id}><td className="font-mono text-sm"><span className="management-booking-text" title={booking.bookingCode}>{booking.bookingCode}</span><span className="management-booking-secondary block font-sans text-xs text-slate-500">Đặt {day(booking.createdAt)}</span></td>{admin && <td className="management-booking-secondary"><span className="management-booking-text" title={hotelName(booking.hotelId)}>{hotelName(booking.hotelId)}</span></td>}<td><strong className="management-booking-text" title={booking.guestName}>{booking.guestName}</strong><span className="management-booking-text text-xs text-slate-500" title={booking.guestEmail}>{booking.guestEmail}</span></td><td className="management-booking-secondary"><span className="block">{day(booking.checkInDate)}</span><span className="block text-xs text-slate-500">đến {day(booking.checkOutDate)}</span></td><td className="management-booking-secondary">{currency(booking.amount)}</td><td><StatusBadge status={booking.bookingStatus} /><span className="management-booking-mobile"><StatusBadge status={booking.paymentStatus} /></span></td><td className="management-booking-secondary"><StatusBadge status={booking.paymentStatus} />{booking.refundStatus !== 'NONE' && <small className="mt-1 block text-xs text-slate-500">Hoàn tiền · {labels[booking.refundStatus]}</small>}</td><td><Button variant="secondary" size="sm" aria-label={'Mở đơn đặt phòng ' + booking.bookingCode} onClick={() => { setSelectedId(booking.id); setAction(null); setError(''); setNotice('') }}><Eye size={15} aria-hidden="true" /><span className="hidden md:inline">Mở</span></Button></td></tr>)}</tbody></table></Card>

    </> : <EmptyState title="Không có đơn đặt phòng phù hợp" description="Thử đổi khách sạn, khoảng ngày hoặc bộ lọc trạng thái." />}

    {bookings.data && <Pagination page={page} total={bookings.data.meta.total} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />}
    <Dialog open={Boolean(selectedId)} onOpenChange={open => { if (!open) { setSelectedId(''); setAction(null); setError('') } }}>
      <DialogContent title={booking ? `Đơn đặt phòng ${booking.bookingCode}` : 'Chi tiết đơn đặt phòng'} layout="workspace" footer={refundFooter}>
        {detail.isPending ? <LoadingState /> : detail.isError ? <ErrorState message={errorMessage(detail.error)} retry={() => { void detail.refetch() }} /> : booking && <div className="grid gap-3">
          {action ? <form id={refundFormId} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:p-4" onSubmit={submitAction}>
            {action === 'confirm-manual-refund' ? <>
              <h3 className="font-semibold">Ghi nhận hoàn tiền giao dịch cũ</h3>
              <p className="text-sm text-slate-600">Sau khi đã chuyển {currency(Number(amount))} cho khách, nhập mã giao dịch từ ứng dụng ngân hàng.</p>
              <FormField label="Mã giao dịch hoàn"><input required maxLength={255} value={refundReference} onChange={event => setRefundReference(event.target.value)} /></FormField>
            </> : <>
              <h3 className="font-semibold">Xác nhận hoàn tiền qua payOS</h3>
              <p className="text-sm text-slate-600">Khoản hoàn sẽ được chuyển về tài khoản người thanh toán đã xác minh.</p>
              <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <FormField label="Số tiền hoàn"><input required type="number" min="1" step="1" max={booking.amount} value={amount} readOnly={booking.refundAmount !== null} onChange={event => setAmount(event.target.value)} /></FormField>
                <FormField label="Lý do hoàn tiền"><textarea required maxLength={5000} value={reason} onChange={event => setReason(event.target.value)} /></FormField>
              </div>
            </>}
          </form> : <BookingDetails booking={booking} hotelName={hotelName(booking.hotelId)} />}
          <Feedback message={error} kind="error" />
          <Feedback message={notice} />
        </div>}
      </DialogContent>
    </Dialog>
  </div>
}
