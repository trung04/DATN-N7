import { PaginatedList } from '@/components/paginated-list'
import { ManagementSearch, SearchButton } from '@/components/management-search'
import { Pagination } from '@/components/pagination'
import { pageItems, PAGE_SIZE } from '@/lib/pagination'
import { usePagination } from '@/lib/use-pagination'
import { useSearchFilters } from '@/lib/use-search-filters'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleX, Clock3, CreditCard, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CancellationPolicyTerms } from '@/components/cancellation-policy-terms'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo, isMock } from '@/services'
import { currency, day, dateTime, errorMessage, formatStatus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useBooking, useBookings, useCatalog } from '@/hooks/data'
import { api } from '@/services/api/client'
import type { Booking, PaymentStatus } from '@/types/domain'

function CancellationSnapshot({ booking }: { booking: Booking }) {
  const snapshot = booking.cancellationPolicySnapshot
  if (snapshot?.inclusiveHourLimits) {
    const tiers = snapshot.rules.map(rule => ({
      upToHours: rule.maxHoursAfterBooking ?? null,
      feePercent: rule.cancellationAllowed ? rule.cancellationFeeRate ?? 0 : null,
    }))
    return <div className="mt-3 rounded-lg bg-slate-50 p-4">
      <h3 className="mb-2 text-sm font-semibold">Điều khoản đã xác nhận</h3>
      <CancellationPolicyTerms tiers={tiers} description={snapshot.policyDescription} />
    </div>
  }
  if (snapshot?.cancelHours !== undefined) {
    const text = snapshot.cancellationAllowed === false
      ? `Không hỗ trợ hủy. ${snapshot.policyDescription ?? ''}`.trim()
      : `Miễn phí hủy trong ${snapshot.cancelHours} giờ đầu sau khi đặt; sau đó phí hủy ${snapshot.penaltyPercent ?? 0}%.`
    return <div className="mt-3 rounded-lg bg-slate-50 p-4"><h3 className="text-sm font-semibold">Điều khoản đã xác nhận</h3><p className="mt-2 text-sm">{text}</p></div>
  }
  if (!booking.cancellationRulesSnapshot?.length) return null
  const hoursAfterBooking = booking.cancellationPolicySnapshot?.basis === 'HOURS_AFTER_BOOKING'
  return <div className="mt-3 rounded-lg bg-slate-50 p-4"><h3 className="text-sm font-semibold">Các điều khoản đã xác nhận</h3><ul className="mt-2 grid gap-2 text-sm">{booking.cancellationRulesSnapshot.map(rule => { const min = rule.minHoursAfterBooking ?? rule.minHoursBeforeCheckIn ?? 0; const max = rule.maxHoursAfterBooking ?? rule.maxHoursBeforeCheckIn ?? null; return <li key={rule.id}><strong>{rule.name}:</strong> {min}–{max ?? 'không giới hạn'} giờ {hoursAfterBooking ? 'sau khi đặt' : 'trước giờ nhận phòng'} · {rule.cancellationAllowed ? `được hủy, phí ${rule.cancellationFeeRate ?? 0}%` : `không được hủy${rule.description ? ` — ${rule.description}` : ''}`}</li> })}</ul></div>
}

function BookingReviewForm({ bookingId, userId, alreadyReviewed }: { bookingId: string; userId: string; alreadyReviewed: boolean }) {
  const queryClient = useQueryClient()
  const savedReview = useQuery({ queryKey: ['my-booking-review', bookingId], queryFn: () => api.myBookingReview(bookingId), enabled: !isMock })
  const [stars, setStars] = useState(0)
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const existing = isMock ? alreadyReviewed : Boolean(savedReview.data)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (isMock) await repo.addReview(userId, bookingId, stars, content)
      else await api.createBookingReview(bookingId, stars, content)
      await queryClient.invalidateQueries({ queryKey: ['tourist'] })
      await queryClient.invalidateQueries({ queryKey: ['my-booking-review', bookingId] })
      await queryClient.invalidateQueries({ queryKey: ['managed-reviews'] })
      setMessage('Đã gửi đánh giá, đánh giá đang chờ kiểm duyệt.')
    } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) }
  }
  if (!isMock && savedReview.isPending) return <LoadingState />
  if (!isMock && savedReview.isError) return <ErrorState message={errorMessage(savedReview.error)} retry={() => { void savedReview.refetch() }} />
  if (existing) return <p className="mt-3 text-sm text-slate-600">Bạn đã gửi đánh giá cho đơn đặt phòng này{savedReview.data?.status === 'PENDING' ? '; đánh giá đang chờ kiểm duyệt.' : '.'}</p>
  return <form className="mt-4 grid gap-4" onSubmit={submit}><FormField label="Số sao"><select required value={stars || ''} onChange={event => setStars(Number(event.target.value))}><option value="">Chọn số sao</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} sao</option>)}</select></FormField><FormField label="Nhận xét" hint="Nhập ít nhất 10 ký tự"><textarea required minLength={10} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} placeholder="Chia sẻ trải nghiệm lưu trú..." /></FormField><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /><Button disabled={busy || stars < 1}>{busy ? 'Đang gửi...' : 'Gửi đánh giá'}</Button></form>
}

export { BookingCheckoutPage as BookingNewPage } from './BookingCheckoutPage'

export function BookingsPage() {
  const { data, isLoading, error, refetch } = useBookings()
  const { data: catalog, isLoading: catalogLoading } = useCatalog()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const q = query.toLowerCase()
  const status = params.get('status') ?? ''
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, { q: query, status })
  const hotelNames = new Map(catalog?.hotels.map(hotel => [hotel.id, hotel.name]))
  const roomNames = new Map(catalog?.rooms.map(room => [room.id, room.name]))
  const bookings = (data?.bookings ?? [])
    .filter(booking => (!q || (booking.bookingCode ?? booking.id).toLowerCase().includes(q) ||
      hotelNames.get(booking.hotelId)?.toLowerCase().includes(q)) && (!status || booking.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  const pagination = usePagination(data && !catalogLoading ? bookings.length : undefined)

  if (isLoading || catalogLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} retry={() => { void refetch() }} /></div>

  return <div className="container-app section-pad">
    <PageHeader title="Đơn đặt phòng của tôi" description="Theo dõi đặt phòng, thanh toán và hoàn tiền." />
    <form aria-label="Tìm kiếm đơn đặt phòng của tôi" onSubmit={applyFilters} className="mb-5 grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
      <FormField label="Tìm mã hoặc khách sạn"><ManagementSearch value={filters.q} onChange={event => changeFilters({ q: event.target.value })} /></FormField>
      <FormField label="Trạng thái"><select value={filters.status} onChange={event => changeFilters({ status: event.target.value })}>
        <option value="">Tất cả</option>
        {(['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const).map(value => <option key={value} value={value}>{formatStatus(value)}</option>)}
      </select></FormField>
      <SearchButton className="h-[42px]" />
    </form>
    {bookings.length ? <>
      <div className="grid gap-3">{pageItems(bookings, pagination.page, pagination.size).map(booking => {
        const types = [...new Set((booking.roomIds ?? [booking.roomId]).map(id => roomNames.get(id)).filter(Boolean))]
        return <Card className="flex flex-wrap items-center justify-between gap-3 p-4" key={booking.id}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{hotelNames.get(booking.hotelId) ?? booking.hotelId}</h2><StatusBadge status={booking.status} /></div>
            <p className="mt-1 text-sm text-slate-500">{booking.bookingCode ?? booking.id} · {day(booking.checkIn)} – {day(booking.checkOut)}</p>
            <p className="mt-1 text-sm">{[booking.rooms + ' phòng', ...types, currency(booking.total)].join(' · ')}</p>
          </div>
          <Button asChild variant="secondary" size="sm"><Link to={'/bookings/' + booking.id}>Xem chi tiết</Link></Button>
        </Card>
      })}</div>
      {bookings.length > PAGE_SIZE && <Pagination label="Phân trang đơn đặt phòng" page={pagination.page} size={pagination.size}
        total={bookings.length} onPageChange={pagination.setPage} onSizeChange={pagination.setSize} />}
    </> : <EmptyState title="Không có đơn đặt phòng phù hợp" description="Thử đổi bộ lọc hoặc tìm khách sạn để đặt phòng." action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} />}
  </div>
}

function usePayosPaymentRefresh(booking: Booking | undefined, status: PaymentStatus | undefined, refetch: () => Promise<unknown>) {
  const queryClient = useQueryClient()
  const bookingId = booking?.id
  const awaitingPayment = booking?.status === 'PENDING_PAYMENT'
  const shouldRefresh = (awaitingPayment || booking?.status === 'EXPIRED') && (status === 'PROCESSING' || status === 'FAILED')
  const keepChecking = awaitingPayment && status === 'PROCESSING'

  useEffect(() => {
    if (isMock || !bookingId || !shouldRefresh) return
    let inFlight = false
    let stop = false
    const refresh = async () => {
      if (stop || inFlight) return
      inFlight = true
      try {
        const updated = await api.refreshPayosPayment(bookingId)
        if (stop || updated.paymentStatus === 'PAYMENT_PENDING') return
        stop = true
        const tasks = [refetch(), queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] })]
        if (updated.bookingStatus === 'CANCELLED' || updated.bookingStatus === 'CONFIRMED') {
          tasks.push(queryClient.invalidateQueries({ queryKey: ['room-availability'] }))
        }
        await Promise.all(tasks)
      } catch {
        // Keep polling after a temporary error while the booking is still awaiting payment.
      } finally {
        inFlight = false
      }
    }

    void refresh()
    const timer = keepChecking ? window.setInterval(() => { void refresh() }, 5000) : undefined
    return () => {
      stop = true
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [bookingId, keepChecking, queryClient, refetch, shouldRefresh])
}

export function BookingDetailPage() {
  const { id } = useParams()
  const user = useSession(s => s.user)
  const { data, isLoading, error, refetch } = useBooking(id)
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')
  const booking = data?.booking
  const payment = data?.payment
  usePayosPaymentRefresh(booking, payment?.status, refetch)
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy đơn đặt phòng" /></div>
  const hotel = catalog?.hotels.find(h => h.id === booking.hotelId)
  const bookedRoomIds = booking.roomIds?.length ? booking.roomIds : Array.from({ length: booking.rooms }, () => booking.roomId)
  const bookedRoomTypes = [...bookedRoomIds.reduce((groups, roomId) => {
    const name = catalog?.rooms.find(item => item.id === roomId)?.name ?? 'Phòng'
    groups.set(name, (groups.get(name) ?? 0) + 1)
    return groups
  }, new Map<string, number>()).entries()]
  const refund = data?.refund
  const reviewed = data?.reviewed ?? false
  const holdingRoom = booking.status === 'PENDING_PAYMENT'
  const canPay = holdingRoom && (isMock || payment?.status !== 'FAILED')
  const canCancel = holdingRoom || (booking.status === 'CONFIRMED' && (isMock || booking.cancellationAllowedNow === true))
  const cancelBooking = async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      await repo.cancelBooking(user?.id ?? '', booking.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tourist-booking'] }),
        queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['room-availability'] }),
      ])
      setCancelOpen(false)
      setMessage('Đã hủy đơn và giải phóng phòng.')
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setCancelling(false)
    }
  }
  const refundProgress: Record<string, string> = {
    PENDING: 'Yêu cầu đã được ghi nhận. Tiền chưa được chuyển; hệ thống đang chờ xử lý.',
    PROCESSING: 'Yêu cầu đang được xử lý chuyển khoản hoàn.',
    REFUNDED: 'Khoản hoàn đã được xác nhận là đã chuyển.',
    FAILED: refund?.failureReason ? `Chưa hoàn được tiền${refund.failedAt ? ` (${day(refund.failedAt)})` : ''}: ${refund.failureReason}` : 'Yêu cầu hoàn tiền chưa thành công. Bộ phận hỗ trợ có thể tạo lại yêu cầu.',
  }
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F]" to="/bookings">← Đơn đặt phòng của tôi</Link><div className="mt-5"><PageHeader title={'Đơn đặt phòng ' + (booking.bookingCode ?? booking.id)} description={hotel?.name ?? booking.hotelId} actions={<StatusBadge status={booking.status} />} /></div><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Thông tin lưu trú</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Khách sạn</dt><dd>{hotel?.name}</dd></div><div><dt className="text-slate-500">Loại phòng</dt><dd>{bookedRoomTypes.map(([name, quantity]) => <span key={name} className="block">{quantity} × {name}</span>)}</dd></div><div><dt className="text-slate-500">Ngày nhận phòng</dt><dd>{day(booking.checkIn)}</dd></div><div><dt className="text-slate-500">Ngày trả phòng</dt><dd>{day(booking.checkOut)}</dd></div><div><dt className="text-slate-500">Số lượng</dt><dd>{booking.rooms} phòng · {booking.adults + booking.children} khách</dd></div>{booking.roomGuests?.map((allocation, index) => <div className="text-xs text-slate-500" key={allocation.roomId}>{'Ph\u00f2ng ' + (index + 1) + ': ' + allocation.adultCount + ' ng\u01b0\u1eddi l\u1edbn · ' + (allocation.childAges.length ? 'tr\u1ebb em: ' + allocation.childAges.join(', ') + ' tu\u1ed5i' : 'kh\u00f4ng c\u00f3 tr\u1ebb em')}</div>)}<div><dt className="text-slate-500">Người đặt</dt><dd>{booking.guestName} · {booking.guestPhone}</dd></div></dl>{!booking.cancellationPolicySnapshot?.inclusiveHourLimits && <p className="mt-5 text-sm text-slate-600"><strong>Chính sách hủy:</strong> {booking.policySnapshot}</p>}<CancellationSnapshot booking={booking} /></Card><Card className="p-6"><h2 className="text-lg font-semibold">Thanh toán và hoàn tiền</h2><div className="mt-4 flex flex-wrap items-center gap-3 text-sm">Trạng thái thanh toán: {payment && <StatusBadge status={payment.status} />}</div>{holdingRoom && <p className="mt-3 text-sm text-amber-800">Giữ phòng đến {dateTime(booking.holdExpiresAt)}.</p>}{refund && <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm"><p><strong>Hoàn tiền:</strong> <StatusBadge status={refund.status} /></p><p className="mt-2">Số tiền: {currency(refund.amount)}</p><p className="mt-1 text-slate-600">{refundProgress[refund.status] ?? 'Trạng thái hoàn tiền đang được cập nhật.'}</p>{refund.reference && <p className="mt-2 text-slate-500">Mã giao dịch hoàn: {refund.reference}</p>}</div>}{booking.status === 'CANCELLED' && !refund && <p className="mt-3 text-sm text-slate-500">Đơn đặt phòng này không phát sinh khoản hoàn tiền.</p>}</Card>{booking.status === 'COMPLETED' && <Card className="p-6"><h2 className="text-lg font-semibold">Đánh giá khách sạn</h2><BookingReviewForm bookingId={booking.id} userId={user?.id ?? ''} alreadyReviewed={reviewed} /></Card>}</div><Card className="h-fit p-5"><h2 className="font-semibold">Chi phí</h2><PaginatedList key={booking.id} items={booking.nightlyPrices} label="Phân trang giá theo đêm">{(visible, offset) => <div className="mt-4 grid gap-2 text-sm">{visible.map((price, index) => <div key={offset + index} className="flex justify-between"><span>Đêm {offset + index + 1} × {booking.rooms} phòng</span><span>{currency(price)}</span></div>)}</div>}</PaginatedList><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng thanh toán</span><span>{currency(booking.total)}</span></div><div className="mt-5 grid gap-2">{canPay && <Button asChild><Link to={'/bookings/' + booking.id + '/payment?auto=1'}>Tiếp tục thanh toán</Link></Button>}{booking.status === 'CANCELLED' && <Button asChild><Link to={'/hotels/' + booking.hotelId}>Đặt lại</Link></Button>}{canCancel && <Button variant="danger" onClick={() => setCancelOpen(true)}>{holdingRoom ? 'Hủy đơn' : 'Hủy đơn đặt phòng'}</Button>}{booking.status === 'CONFIRMED' && !canCancel && <p className="text-sm text-amber-900">{booking.cancellationUnavailableReason || 'Chính sách đã lưu không cho phép hủy đơn đặt phòng tại thời điểm này.'}</p>}{canCancel && booking.status === 'CONFIRMED' && booking.cancellationFeeAmountNow !== null && booking.cancellationFeeAmountNow !== undefined && <p className="text-xs text-slate-600">Phí hủy hiện tại ước tính: {currency(booking.cancellationFeeAmountNow)}. Phí cuối cùng được máy chủ tính khi xác nhận.</p>}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card></div><Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent title="Xác nhận hủy đơn đặt phòng" description={holdingRoom ? 'Phòng sẽ được giải phóng ngay sau khi hủy đơn.' : 'Phí hủy được tính theo chính sách của đơn.'}><p className="text-sm text-slate-600">{holdingRoom ? 'Nếu tiền được ghi nhận sau khi hủy, hệ thống sẽ chuyển khoản đó sang chờ hoàn.' : 'Khoản thanh toán đủ điều kiện hoàn sẽ chuyển sang chờ xử lý.'}</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={cancelling} onClick={() => setCancelOpen(false)}>Quay lại</Button><Button variant="danger" disabled={cancelling} onClick={() => void cancelBooking()}>{cancelling ? 'Đang hủy…' : 'Xác nhận hủy'}</Button></div></DialogContent></Dialog></div>
}

const paymentNotices = {
  ready: { title: 'Chưa khởi tạo thanh toán', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  waiting: { title: 'Đang chờ xác nhận thanh toán', tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  paid: { title: 'Thanh toán thành công', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  expired: { title: 'Đã hết hạn thanh toán', tone: 'border-red-200 bg-red-50 text-red-800' },
  failed: { title: 'Thanh toán chưa thành công', tone: 'border-red-200 bg-red-50 text-red-800' },
  cancelled: { title: 'Đơn đặt phòng đã hủy', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  closed: { title: 'Đơn đặt phòng đã đóng', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
}

function getPaymentOutcome(
  booking: Booking | undefined,
  status: PaymentStatus,
  checkedAt: number,
  expiresAt = Date.parse(booking?.holdExpiresAt ?? ''),
) {
  if (!booking) return null
  if (booking.status === 'CANCELLED') return 'cancelled'
  if (booking.status === 'CONFIRMED' || status === 'PAID') return 'paid'
  if (booking.status === 'EXPIRED' || status === 'EXPIRED') return 'expired'
  if (booking.status === 'PENDING_PAYMENT' && expiresAt <= checkedAt) return 'expired'
  if (status === 'FAILED') return 'failed'
  return null
}

export function PaymentPage() {
  const { id } = useParams()
  return <BookingPayment key={id} id={id} />
}

function BookingPayment({ id }: { id: string | undefined }) {
  const [searchParams] = useSearchParams()
  const autoStart = searchParams.get('auto') === '1'
  const userId = useSession(s => s.user?.id)
  const { data, dataUpdatedAt, isLoading, error, refetch } = useBooking(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [operation, setOperation] = useState<'create' | 'simulate' | null>(null)
  const [message, setMessage] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [clockTime, setClockTime] = useState(Date.now)
  const started = useRef(false)
  const mounted = useRef(false)
  const opening = useRef(false)
  const booking = data?.booking
  const paymentStatus = data?.payment?.status ?? 'PENDING'
  const expiresAt = Date.parse(booking?.holdExpiresAt ?? '')
  const checkedAt = Math.max(clockTime, dataUpdatedAt)
  const awaitingPayment = booking?.status === 'PENDING_PAYMENT'
  const outcome = getPaymentOutcome(booking, paymentStatus, checkedAt, expiresAt)
  const canPay = awaitingPayment && (!outcome || (isMock && outcome === 'failed'))
  const secondsLeft = Math.ceil((expiresAt - checkedAt) / 1000)
  const countdownActive = canPay && secondsLeft > 0
  const busy = operation !== null
  const loadingPayment = canPay && !isMock && (operation === 'create' || (autoStart && !paymentError))

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const createPayment = useCallback(async () => {
    if (!id || opening.current) return
    opening.current = true
    setOperation('create')
    setPaymentError('')
    try {
      const result = await api.createPayosPayment(id)
      if (!mounted.current) return
      if (Date.parse(result.expiresAt) <= Date.now()) {
        throw new Error('Phiên thanh toán đã hết hạn.')
      }
      window.location.replace(result.paymentUrl)
    } catch (cause) {
      if (!mounted.current) return
      opening.current = false
      setPaymentError(errorMessage(cause))
      setOperation(null)
    }
  }, [id])

  useEffect(() => {
    if (!isMock && autoStart && canPay && !started.current) {
      started.current = true
      void createPayment()
    }
  }, [autoStart, canPay, createPayment])

  useEffect(() => {
    if (!countdownActive) return
    const tick = () => setClockTime(Date.now())
    const interval = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [countdownActive])

  if (isLoading) return <LoadingState label={!isMock && autoStart ? 'Đang chuyển đến payOS…' : undefined} />
  if (error && !data) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} retry={() => { void refetch() }} /></div>
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy đơn đặt phòng" /></div>

  const detailsUrl = '/bookings/' + booking.id
  const resultUrl = detailsUrl + '/payment-result'
  if (!isMock && outcome && outcome !== 'expired') return <Navigate to={resultUrl} replace />

  const amount = data?.payment?.amount ?? booking.total
  const state = outcome ?? (!awaitingPayment ? 'closed' : paymentStatus === 'PROCESSING' ? 'waiting' : 'ready')
  const notice = paymentNotices[state]
  const StatusIcon = state === 'paid' ? CheckCircle2 : Clock3
  const countdown = [
    Math.floor(secondsLeft / 60),
    secondsLeft % 60,
  ].map(part => String(part).padStart(2, '0')).join(':')
  const simulate = async (outcome: 'success' | 'failure' | 'expire') => {
    setOperation('simulate')
    setMessage('')
    try {
      await repo.payBooking(userId ?? '', booking.id, outcome)
      await queryClient.invalidateQueries({ queryKey: ['tourist-booking'] })
      await queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] })
      navigate(resultUrl, { replace: true })
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setOperation(null)
    }
  }

  return <div className="container-app max-w-5xl py-3">
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
      <h1 className="text-xl font-bold tracking-tight text-[#173759] sm:text-2xl">Thanh toán đặt phòng</h1>
      <p className="wrap-anywhere text-sm text-slate-600">Mã đặt phòng {booking.bookingCode ?? booking.id}</p>
    </div>
    <Card className="overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#DBE8F3] bg-[#F2F7FB] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden size-9 shrink-0 place-items-center rounded-lg border border-[#DBE8F3] bg-white text-[#1E3A5F] sm:grid"><CreditCard size={19} aria-hidden="true" /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{isMock ? 'Thanh toán mô phỏng' : 'payOS'}</h2>
            {countdownActive && <p role="timer" className="text-sm text-slate-600">Còn <strong className="font-semibold tabular-nums text-slate-800">{countdown}</strong> để thanh toán</p>}
            {outcome === 'expired' && <p role="status" className="mt-1 text-sm font-semibold text-red-800">{notice.title}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-slate-600">{state === 'paid' ? 'Đã thanh toán' : 'Số tiền thanh toán'}</p>
          <p className="text-xl font-bold tracking-tight tabular-nums text-[#173759] sm:text-2xl">{currency(amount)}</p>
        </div>
      </header>

      <div className="space-y-2.5 p-3">
        {outcome !== 'expired' && <div role="status" className={'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold ' + notice.tone}>
          {loadingPayment ? <LoaderCircle size={16} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : <StatusIcon size={16} className="shrink-0" aria-hidden="true" />}
          {loadingPayment ? 'Đang chuyển đến payOS…' : notice.title}
        </div>}
        {message && <Feedback message={message} kind="error" />}
        {canPay && !loadingPayment && paymentError && <Feedback message={paymentError} kind="error" />}

        {isMock && canPay && <div className="grid gap-2 sm:grid-cols-3"><Button disabled={busy} onClick={() => void simulate('success')}>Xác nhận thành công</Button><Button disabled={busy} variant="secondary" onClick={() => void simulate('failure')}>Ghi nhận thất bại</Button><Button disabled={busy} variant="secondary" onClick={() => void simulate('expire')}>Đánh dấu hết hạn</Button></div>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
          <Button asChild size="sm" variant="ghost"><Link to={detailsUrl} aria-label="Quay lại đơn đặt phòng"><ArrowLeft size={16} aria-hidden="true" /><span>Quay lại<span className="hidden sm:inline"> đơn đặt phòng</span></span></Link></Button>
          {!isMock && canPay && !loadingPayment && <Button type="button" size="sm" disabled={busy} onClick={() => void createPayment()}>{paymentError ? 'Thử lại' : 'Thanh toán qua payOS'}</Button>}
        </div>
      </div>
    </Card>
  </div>
}
export function PaymentResultPage() {
  const { id } = useParams()
  const { data, dataUpdatedAt, isLoading, error, refetch } = useBooking(id)
  const booking = data?.booking
  const payment = data?.payment
  usePayosPaymentRefresh(booking, payment?.status, refetch)
  if (isLoading) return <LoadingState label="Đang xác nhận thanh toán…" />
  if (error && !data) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} retry={() => { void refetch() }} /></div>
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy đơn đặt phòng" /></div>
  const outcome = getPaymentOutcome(booking, payment?.status ?? 'PENDING', dataUpdatedAt)
  const pending = booking.status === 'PENDING_PAYMENT' && !outcome
  const notice = paymentNotices[outcome ?? (pending ? 'waiting' : 'closed')]
  const title = pending ? 'Đang xác nhận thanh toán…' : notice.title
  const ResultIcon = pending ? LoaderCircle : outcome === 'paid' ? CheckCircle2 : outcome === 'failed' ? CircleX : Clock3
  const detailsUrl = '/bookings/' + booking.id

  return <div className="container-app section-pad">
    <Card className="mx-auto max-w-xl rounded-2xl p-5 text-center sm:p-8">
      <div className={'mx-auto grid size-16 place-items-center rounded-full ' + notice.tone}><ResultIcon size={32} className={pending ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" /></div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900" aria-live="polite">{title}</h1>
      <p className="mt-2 wrap-anywhere text-slate-600">Mã đặt phòng {booking.bookingCode ?? booking.id} · {currency(payment?.amount ?? booking.total)}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {outcome === 'expired' ? <StatusBadge status="EXPIRED" /> : <>
          <StatusBadge status={booking.status} />
          {payment && <StatusBadge status={payment.status} />}
        </>}
      </div>
      {pending && <p className="mt-4 text-sm text-slate-600">Trạng thái sẽ tự cập nhật khi có kết quả.</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button asChild><Link to={detailsUrl}>Xem chi tiết đơn</Link></Button>
        {booking.status === 'CANCELLED' && <Button asChild variant="secondary"><Link to={'/hotels/' + booking.hotelId}>Đặt lại</Link></Button>}
        {isMock && booking.status === 'PENDING_PAYMENT' && outcome === 'failed' && <Button asChild variant="secondary"><Link to={detailsUrl + '/payment'}>Thử lại</Link></Button>}
      </div>
    </Card>
  </div>
}
