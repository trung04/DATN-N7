import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleX, Clock3, Copy, CreditCard, Landmark, QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CancellationPolicyTerms } from '@/components/cancellation-policy-terms'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo, isMock } from '@/services'
import { currency, day, dateTime, errorMessage } from '@/lib/utils'
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
  if (existing) return <p className="mt-3 text-sm text-slate-600">Bạn đã gửi đánh giá cho booking này{savedReview.data?.status === 'PENDING' ? '; đánh giá đang chờ kiểm duyệt.' : '.'}</p>
  return <form className="mt-4 grid gap-4" onSubmit={submit}><FormField label="Số sao"><select required value={stars || ''} onChange={event => setStars(Number(event.target.value))}><option value="">Chọn số sao</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} sao</option>)}</select></FormField><FormField label="Nhận xét" hint="Nhập ít nhất 10 ký tự"><textarea required minLength={10} maxLength={5000} value={content} onChange={event => setContent(event.target.value)} placeholder="Chia sẻ trải nghiệm lưu trú..." /></FormField><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /><Button disabled={busy || stars < 1}>{busy ? 'Đang gửi...' : 'Gửi đánh giá'}</Button></form>
}

export { BookingCheckoutPage as BookingNewPage } from './BookingCheckoutPage'

export function BookingsPage() {
  const { data, isLoading, error } = useBookings()
  const { data: catalog } = useCatalog()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const status = params.get('status') ?? ''
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const bookings = [...(data?.bookings ?? [])].filter(b => (!q || (b.bookingCode ?? b.id).toLowerCase().includes(q) || catalog?.hotels.find(h => h.id === b.hotelId)?.name.toLowerCase().includes(q)) && (!status || b.status === status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <div className="container-app section-pad"><PageHeader title="Booking của tôi" description="Theo dõi đặt phòng, thanh toán và hoàn tiền." /><div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Tìm mã hoặc khách sạn<input value={params.get('q') ?? ''} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); setParams(next) }} /></label><label className="text-sm font-medium">Trạng thái<select value={status} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('status', e.target.value); else next.delete('status'); setParams(next) }}><option value="">Tất cả</option>{['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(x => <option key={x} value={x}>{x}</option>)}</select></label></div>{bookings.length ? <div className="grid gap-4">{bookings.map(b => <Card className="flex flex-wrap items-center justify-between gap-4 p-5" key={b.id}><div><div className="flex items-center gap-3"><h2 className="font-semibold">{catalog?.hotels.find(h => h.id === b.hotelId)?.name ?? b.hotelId}</h2><StatusBadge status={b.status} /></div><p className="mt-2 text-sm text-slate-500">{b.bookingCode ?? b.id} · {day(b.checkIn)} – {day(b.checkOut)}</p><p className="mt-1 text-sm">{b.rooms} phòng · {[...new Set((b.roomIds ?? [b.roomId]).map(roomId => catalog?.rooms.find(room => room.id === roomId)?.name).filter(Boolean))].join(', ')} · {currency(b.total)}</p></div><Button asChild variant="secondary" size="sm"><Link to={'/bookings/' + b.id}>Xem chi tiết</Link></Button></Card>)}</div> : <EmptyState title="Không có booking phù hợp" description="Thử đổi bộ lọc hoặc tìm khách sạn để đặt phòng." action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} />}</div>
}
export function BookingDetailPage() {
  const { id } = useParams()
  const user = useSession(s => s.user)
  const { data, isLoading, error } = useBooking(id)
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const booking = data?.booking
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  const hotel = catalog?.hotels.find(h => h.id === booking.hotelId)
  const bookedRoomIds = booking.roomIds?.length ? booking.roomIds : Array.from({ length: booking.rooms }, () => booking.roomId)
  const bookedRoomTypes = [...bookedRoomIds.reduce((groups, roomId) => {
    const name = catalog?.rooms.find(item => item.id === roomId)?.name ?? 'Phòng'
    groups.set(name, (groups.get(name) ?? 0) + 1)
    return groups
  }, new Map<string, number>()).entries()]
  const payment = data?.payment
  const refund = data?.refund
  const reviewed = data?.reviewed ?? false
  const canCancel = booking.status === 'CONFIRMED' && (isMock || booking.cancellationAllowedNow === true)
  const refundProgress: Record<string, string> = {
    PENDING: 'Yêu cầu đã được ghi nhận. Tiền chưa được chuyển; hệ thống đang chờ xử lý.',
    PROCESSING: 'Yêu cầu đang được xử lý chuyển khoản hoàn.',
    REFUNDED: 'Khoản hoàn đã được xác nhận là đã chuyển.',
    FAILED: refund?.failureReason ? `Chưa hoàn được tiền${refund.failedAt ? ` (${day(refund.failedAt)})` : ''}: ${refund.failureReason}` : 'Yêu cầu hoàn tiền chưa thành công. Bộ phận hỗ trợ có thể tạo lại yêu cầu.',
  }
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F]" to="/bookings">← Booking của tôi</Link><div className="mt-5"><PageHeader title={'Booking ' + (booking.bookingCode ?? booking.id)} description={hotel?.name ?? booking.hotelId} actions={<StatusBadge status={booking.status} />} /></div><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Thông tin lưu trú</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Khách sạn</dt><dd>{hotel?.name}</dd></div><div><dt className="text-slate-500">Loại phòng</dt><dd>{bookedRoomTypes.map(([name, quantity]) => <span key={name} className="block">{quantity} × {name}</span>)}</dd></div><div><dt className="text-slate-500">Ngày nhận phòng</dt><dd>{day(booking.checkIn)}</dd></div><div><dt className="text-slate-500">Ngày trả phòng</dt><dd>{day(booking.checkOut)}</dd></div><div><dt className="text-slate-500">Số lượng</dt><dd>{booking.rooms} phòng · {booking.adults + booking.children} khách</dd></div>{booking.roomGuests?.map((allocation, index) => <div className="text-xs text-slate-500" key={allocation.roomId}>{'Ph\u00f2ng ' + (index + 1) + ': ' + allocation.adultCount + ' ng\u01b0\u1eddi l\u1edbn · ' + (allocation.childAges.length ? 'tr\u1ebb em: ' + allocation.childAges.join(', ') + ' tu\u1ed5i' : 'kh\u00f4ng c\u00f3 tr\u1ebb em')}</div>)}<div><dt className="text-slate-500">Người đặt</dt><dd>{booking.guestName} · {booking.guestPhone}</dd></div></dl>{!booking.cancellationPolicySnapshot?.inclusiveHourLimits && <p className="mt-5 text-sm text-slate-600"><strong>Chính sách hủy:</strong> {booking.policySnapshot}</p>}<CancellationSnapshot booking={booking} /></Card><Card className="p-6"><h2 className="text-lg font-semibold">Thanh toán và hoàn tiền</h2><div className="mt-4 flex flex-wrap items-center gap-3 text-sm">Trạng thái thanh toán: {payment && <StatusBadge status={payment.status} />}</div>{booking.status === 'PENDING_PAYMENT' && <p className="mt-3 text-sm text-amber-800">Giữ phòng đến {dateTime(booking.holdExpiresAt)}.</p>}{refund && <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm"><p><strong>Hoàn tiền:</strong> <StatusBadge status={refund.status} /></p><p className="mt-2">Số tiền: {currency(refund.amount)}</p><p className="mt-1 text-slate-600">{refundProgress[refund.status] ?? 'Trạng thái hoàn tiền đang được cập nhật.'}</p>{refund.reference && <p className="mt-2 text-slate-500">Mã giao dịch hoàn: {refund.reference}</p>}</div>}{booking.status === 'CANCELLED' && !refund && <p className="mt-3 text-sm text-slate-500">Booking này không phát sinh khoản hoàn tiền.</p>}</Card>{booking.status === 'COMPLETED' && <Card className="p-6"><h2 className="text-lg font-semibold">Đánh giá khách sạn</h2><BookingReviewForm bookingId={booking.id} userId={user?.id ?? ''} alreadyReviewed={reviewed} /></Card>}</div><Card className="h-fit p-5"><h2 className="font-semibold">Chi phí</h2><div className="mt-4 grid gap-2 text-sm">{booking.nightlyPrices.map((price, i) => <div key={i} className="flex justify-between"><span>Đêm {i + 1} × {booking.rooms} phòng</span><span>{currency(price)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng thanh toán</span><span>{currency(booking.total)}</span></div><div className="mt-5 grid gap-2">{booking.status === 'PENDING_PAYMENT' && <Button asChild><Link to={'/bookings/' + booking.id + '/payment?auto=1'}>Tiếp tục thanh toán</Link></Button>}{canCancel && <Button variant="danger" onClick={() => setCancelOpen(true)}>Hủy booking</Button>}{booking.status === 'CONFIRMED' && !canCancel && <p className="text-sm text-amber-900">{booking.cancellationUnavailableReason || 'Chính sách đã lưu không cho phép hủy booking tại thời điểm này.'}</p>}{canCancel && booking.cancellationFeeAmountNow !== null && booking.cancellationFeeAmountNow !== undefined && <p className="text-xs text-slate-600">Phí hủy hiện tại ước tính: {currency(booking.cancellationFeeAmountNow)}. Phí cuối cùng được máy chủ tính khi xác nhận.</p>}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card></div><Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent title="Xác nhận hủy booking" description="Backend sẽ chọn chính sách phù hợp và tính phí hủy."><p className="text-sm text-slate-600">Nếu khoản thanh toán đủ điều kiện hoàn, backend sẽ chuyển trạng thái hoàn tiền sang chờ xử lý.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setCancelOpen(false)}>Quay lại</Button><Button variant="danger" onClick={async () => { try { await repo.cancelBooking(user?.id ?? '', booking.id); await Promise.all([queryClient.invalidateQueries({ queryKey: ['tourist-booking'] }), queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] })]); setCancelOpen(false); setMessage('Đã hủy booking. Trạng thái hoàn tiền được cập nhật riêng.') } catch (err) { setMessage(errorMessage(err)) } }}>Xác nhận hủy</Button></div></DialogContent></Dialog></div>
}

type SePayPayment = {
  orderCode: string
  vaNumber: string | null
  qrCode: string | null
  bankName: string | null
  accountHolderName: string | null
  expiresAt: string | null
}

const paymentNotices = {
  ready: { title: 'Chưa tạo mã thanh toán', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  waiting: { title: 'Đang chờ xác nhận chuyển khoản', tone: 'border-amber-200 bg-amber-50 text-amber-900' },
  paid: { title: 'Thanh toán thành công', tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  expired: { title: 'Đã hết hạn thanh toán', tone: 'border-red-200 bg-red-50 text-red-800' },
  failed: { title: 'Thanh toán chưa thành công', tone: 'border-red-200 bg-red-50 text-red-800' },
  closed: { title: 'Đơn đặt phòng đã đóng', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
}

function getPaymentOutcome(booking: Booking | undefined, status: PaymentStatus, checkedAt: number) {
  if (!booking || booking.status === 'CANCELLED') return null
  if (booking.status === 'CONFIRMED' || status === 'PAID') return 'paid'
  if (booking.status === 'EXPIRED' || status === 'EXPIRED') return 'expired'
  if (status === 'FAILED') return 'failed'
  if (booking.status === 'PENDING_PAYMENT' && Date.parse(booking.holdExpiresAt) <= checkedAt) return 'expired'
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
  const [operation, setOperation] = useState<'create' | 'refresh' | 'simulate' | null>(null)
  const [message, setMessage] = useState('')
  const [qrError, setQrError] = useState('')
  const [copiedField, setCopiedField] = useState('')
  const [copyError, setCopyError] = useState('')
  const [paymentInfo, setPaymentInfo] = useState<SePayPayment | null>(null)
  const started = useRef(false)
  const booking = data?.booking
  const paymentStatus = data?.payment?.status ?? 'PENDING'
  const deadline = paymentInfo?.expiresAt ?? booking?.holdExpiresAt
  const awaitingPayment = booking?.status === 'PENDING_PAYMENT'
  const outcome = getPaymentOutcome(booking, paymentStatus, dataUpdatedAt)
  const canPay = awaitingPayment && (!outcome || (isMock && outcome === 'failed'))
  const busy = operation !== null
  const loadingQr = canPay && !isMock && (operation === 'create' || (autoStart && !paymentInfo && !qrError))
  const qrCode = loadingQr || qrError ? null : paymentInfo?.qrCode

  const createPayment = useCallback(async () => {
    if (!id) return
    setOperation('create')
    setMessage('')
    setQrError('')
    try {
      const result = await api.createSePayPayment(id)
      setPaymentInfo(result)
      if (!result.qrCode) setQrError('Chưa lấy được mã QR thanh toán. Bạn có thể thử lại.')
    } catch {
      setQrError('Chưa tải được mã QR thanh toán. Vui lòng thử lại.')
    } finally {
      setOperation(null)
      void queryClient.invalidateQueries({ queryKey: ['tourist-booking', userId, id] })
    }
  }, [id, queryClient, userId])

  useEffect(() => {
    if (!isMock && autoStart && canPay && !started.current) {
      started.current = true
      void createPayment()
    }
  }, [autoStart, canPay, createPayment])

  useEffect(() => {
    if (isMock || !canPay) return
    function checkOnReturn() {
      if (document.visibilityState === 'visible') void refetch({ cancelRefetch: false })
    }
    document.addEventListener('visibilitychange', checkOnReturn)
    return () => document.removeEventListener('visibilitychange', checkOnReturn)
  }, [canPay, refetch])

  async function refreshStatus() {
    setOperation('refresh')
    setMessage('')
    try {
      await refetch({ throwOnError: true, cancelRefetch: false })
    } catch {
      setMessage('Chưa kiểm tra được trạng thái thanh toán. Vui lòng thử lại.')
    } finally {
      setOperation(null)
    }
  }

  async function copyTransferValue(label: string, value: string) {
    setCopiedField('')
    setCopyError('')
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(label)
    } catch {
      setCopyError(`Chưa sao chép được ${label.toLocaleLowerCase('vi-VN')}. Bạn có thể chọn và sao chép giá trị trên màn hình.`)
    }
  }

  if (isLoading) return <LoadingState />
  if (error && !data) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} retry={() => { void refetch() }} /></div>
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy đơn đặt phòng" /></div>

  const detailsUrl = '/bookings/' + booking.id
  const resultUrl = detailsUrl + '/payment-result'
  if (!isMock && outcome) return <Navigate to={resultUrl} replace />

  const amount = data?.payment?.amount ?? booking.total
  const state = outcome ?? (!awaitingPayment ? 'closed' : paymentInfo || paymentStatus === 'PROCESSING' ? 'waiting' : 'ready')
  const notice = paymentNotices[state]
  const StatusIcon = state === 'paid' ? CheckCircle2 : Clock3
  const fields = paymentInfo ? [
    { label: 'Ngân hàng', value: paymentInfo.bankName ?? 'Chưa có thông tin' },
    { label: 'Chủ tài khoản', value: paymentInfo.accountHolderName ?? 'Chưa có thông tin' },
    { label: 'Số tài khoản nhận tiền', value: paymentInfo.vaNumber ?? 'Chưa có thông tin', copy: paymentInfo.vaNumber },
    { label: 'Số tiền', value: currency(amount), copy: String(amount) },
    { label: 'Nội dung chuyển khoản', value: paymentInfo.orderCode, copy: paymentInfo.orderCode },
  ] : []

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

  return <div className="container-app section-pad">
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Thanh toán đặt phòng" description={'Mã đặt phòng ' + (booking.bookingCode ?? booking.id)} />
      <Card className="overflow-hidden rounded-2xl">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-[#DBE8F3] bg-[#F2F7FB] px-4 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#DBE8F3] bg-white text-[#1E3A5F]"><CreditCard size={22} aria-hidden="true" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 sm:text-lg">{isMock ? 'Thanh toán mô phỏng' : 'Chuyển khoản qua SePay'}</h2>
              {deadline && (canPay || outcome === 'expired') && <p className="mt-1 text-sm text-slate-600">Hạn thanh toán <time dateTime={deadline} className="font-medium tabular-nums text-slate-800">{dateTime(deadline)}</time></p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-slate-600">{state === 'paid' ? 'Đã thanh toán' : 'Số tiền thanh toán'}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[#173759] sm:text-3xl">{currency(amount)}</p>
          </div>
        </header>

        <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <div role="status" className={'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold ' + notice.tone}>
            <StatusIcon size={18} className="shrink-0" aria-hidden="true" />
            {loadingQr ? 'Đang tải mã QR…' : notice.title}
          </div>
          {message && <Feedback message={message} kind="error" />}
          {canPay && !loadingQr && qrError && <Feedback message={qrError} kind="error" />}

          {!isMock && canPay && paymentInfo && <div className={'grid items-start gap-4' + (qrCode ? ' md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]' : '')}>
            {qrCode && <section aria-labelledby="payment-qr" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <h3 id="payment-qr" className="flex items-center justify-center gap-2 font-semibold text-slate-900"><QrCode size={18} aria-hidden="true" />Quét mã QR</h3>
              <img className="mx-auto mt-4 aspect-square w-full max-w-60 rounded-lg border border-slate-200 bg-white object-contain p-3" src={qrCode} alt="Mã QR thanh toán đặt phòng" onError={() => setQrError('Chưa hiển thị được mã QR thanh toán. Vui lòng thử lại.')} />
              <p className="mt-3 text-sm text-slate-600">Mở ứng dụng ngân hàng để quét mã.</p>
            </section>}
            <section aria-labelledby="payment-bank-details" className="min-w-0 rounded-xl border border-slate-200 px-4 py-4">
              <h3 id="payment-bank-details" className="flex items-center gap-2 font-semibold text-slate-900"><Landmark size={18} className="shrink-0 text-[#1E3A5F]" aria-hidden="true" />Thông tin chuyển khoản</h3>
              <dl className="mt-2 divide-y divide-slate-100">
                {fields.map(({ label, value, copy }) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 py-2.5 text-sm">
                  <dt className="col-start-1 text-slate-600">{label}</dt>
                  <dd className="col-start-1 mt-0.5 font-semibold wrap-anywhere tabular-nums text-slate-900">{value}</dd>
                  {copy && <dd className="col-start-2 row-start-1 row-span-2">
                    <Button type="button" size="sm" variant="secondary" aria-label={'Sao chép ' + label.toLocaleLowerCase('vi-VN')} onClick={() => void copyTransferValue(label, copy)}>
                      {copiedField === label ? <CheckCircle2 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      {copiedField === label ? 'Đã chép' : 'Sao chép'}
                    </Button>
                  </dd>}
                </div>)}
              </dl>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Nhập đúng số tiền và nội dung chuyển khoản để hệ thống xác nhận.</p>
              <p className="sr-only" role="status">{copiedField && `Đã sao chép ${copiedField.toLocaleLowerCase('vi-VN')}.`}</p>
              {copyError && <div className="mt-3"><Feedback message={copyError} kind="error" /></div>}
            </section>
          </div>}

          {isMock && canPay && <div className="grid gap-2 sm:grid-cols-3"><Button disabled={busy} onClick={() => void simulate('success')}>Xác nhận thành công</Button><Button disabled={busy} variant="secondary" onClick={() => void simulate('failure')}>Ghi nhận thất bại</Button><Button disabled={busy} variant="secondary" onClick={() => void simulate('expire')}>Đánh dấu hết hạn</Button></div>}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Button asChild variant="ghost"><Link to={detailsUrl}><ArrowLeft size={16} aria-hidden="true" />Quay lại đơn đặt phòng</Link></Button>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {!isMock && canPay && state === 'waiting' && <Button type="button" variant={paymentInfo ? 'default' : 'secondary'} onClick={() => void refreshStatus()} disabled={busy}>
                <RefreshCw size={16} aria-hidden="true" />{operation === 'refresh' ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái'}
              </Button>}
              {!isMock && canPay && !loadingQr && (qrError || !paymentInfo) && <Button type="button" disabled={busy} onClick={() => void createPayment()}>{qrError ? 'Thử lại' : paymentStatus === 'PROCESSING' ? 'Lấy mã QR thanh toán' : 'Tạo mã QR thanh toán'}</Button>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
}
export function PaymentResultPage() {
  const { id } = useParams()
  const { data, dataUpdatedAt, isLoading, error, refetch } = useBooking(id)
  if (isLoading) return <LoadingState />
  if (error && !data) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} retry={() => { void refetch() }} /></div>
  const booking = data?.booking
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy đơn đặt phòng" /></div>
  const payment = data?.payment
  const outcome = getPaymentOutcome(booking, payment?.status ?? 'PENDING', dataUpdatedAt)
  const pending = booking.status === 'PENDING_PAYMENT' && !outcome
  const notice = paymentNotices[outcome ?? (pending ? 'waiting' : 'closed')]
  const title = booking.status === 'CONFIRMED' ? 'Đặt phòng đã được xác nhận' : notice.title
  const ResultIcon = outcome === 'paid' ? CheckCircle2 : outcome === 'failed' ? CircleX : Clock3
  const detailsUrl = '/bookings/' + booking.id

  return <div className="container-app section-pad">
    <Card className="mx-auto max-w-xl rounded-2xl p-5 text-center sm:p-8">
      <div className={'mx-auto grid size-16 place-items-center rounded-full ' + notice.tone}><ResultIcon size={32} aria-hidden="true" /></div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
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
        {isMock && booking.status === 'PENDING_PAYMENT' && outcome === 'failed' && <Button asChild variant="secondary"><Link to={detailsUrl + '/payment'}>Thử lại</Link></Button>}
      </div>
    </Card>
  </div>
}
