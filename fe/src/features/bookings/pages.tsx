import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo, isMock } from '@/services'
import { currency, day, dateTime, errorMessage } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useBooking, useBookings, useCatalog } from '@/hooks/data'
import { api } from '@/services/api/client'
import type { Booking } from '@/types/domain'

function CancellationSnapshot({ booking }: { booking: Booking }) {
  const snapshot = booking.cancellationPolicySnapshot
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
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F]" to="/bookings">← Booking của tôi</Link><div className="mt-5"><PageHeader title={'Booking ' + (booking.bookingCode ?? booking.id)} description={hotel?.name ?? booking.hotelId} actions={<StatusBadge status={booking.status} />} /></div><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Thông tin lưu trú</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Khách sạn</dt><dd>{hotel?.name}</dd></div><div><dt className="text-slate-500">Loại phòng</dt><dd>{bookedRoomTypes.map(([name, quantity]) => <span key={name} className="block">{quantity} × {name}</span>)}</dd></div><div><dt className="text-slate-500">Ngày nhận phòng</dt><dd>{day(booking.checkIn)}</dd></div><div><dt className="text-slate-500">Ngày trả phòng</dt><dd>{day(booking.checkOut)}</dd></div><div><dt className="text-slate-500">Số lượng</dt><dd>{booking.rooms} phòng · {booking.adults + booking.children} khách</dd></div><div><dt className="text-slate-500">Người đặt</dt><dd>{booking.guestName} · {booking.guestPhone}</dd></div></dl><p className="mt-5 text-sm text-slate-600"><strong>Chính sách hủy:</strong> {booking.policySnapshot}</p><CancellationSnapshot booking={booking} /></Card><Card className="p-6"><h2 className="text-lg font-semibold">Thanh toán và hoàn tiền</h2><div className="mt-4 flex flex-wrap items-center gap-3 text-sm">Trạng thái thanh toán: {payment && <StatusBadge status={payment.status} />}</div>{booking.status === 'PENDING_PAYMENT' && <p className="mt-3 text-sm text-amber-800">Giữ phòng đến {dateTime(booking.holdExpiresAt)}.</p>}{refund && <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm"><p><strong>Hoàn tiền:</strong> <StatusBadge status={refund.status} /></p><p className="mt-2">Số tiền: {currency(refund.amount)}</p><p className="mt-1 text-slate-600">{refundProgress[refund.status] ?? 'Trạng thái hoàn tiền đang được cập nhật.'}</p>{refund.reference && <p className="mt-2 text-slate-500">Mã giao dịch hoàn: {refund.reference}</p>}</div>}{booking.status === 'CANCELLED' && !refund && <p className="mt-3 text-sm text-slate-500">Booking này không phát sinh khoản hoàn tiền.</p>}</Card>{booking.status === 'COMPLETED' && <Card className="p-6"><h2 className="text-lg font-semibold">Đánh giá khách sạn</h2><BookingReviewForm bookingId={booking.id} userId={user?.id ?? ''} alreadyReviewed={reviewed} /></Card>}</div><Card className="h-fit p-5"><h2 className="font-semibold">Chi phí</h2><div className="mt-4 grid gap-2 text-sm">{booking.nightlyPrices.map((price, i) => <div key={i} className="flex justify-between"><span>Đêm {i + 1} × {booking.rooms} phòng</span><span>{currency(price)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng thanh toán</span><span>{currency(booking.total)}</span></div><div className="mt-5 grid gap-2">{booking.status === 'PENDING_PAYMENT' && <Button asChild><Link to={'/bookings/' + booking.id + '/payment'}>Tiếp tục thanh toán</Link></Button>}{canCancel && <Button variant="danger" onClick={() => setCancelOpen(true)}>Hủy booking</Button>}{booking.status === 'CONFIRMED' && !canCancel && <p className="text-sm text-amber-900">{booking.cancellationUnavailableReason || 'Chính sách đã lưu không cho phép hủy booking tại thời điểm này.'}</p>}{canCancel && booking.cancellationFeeAmountNow !== null && booking.cancellationFeeAmountNow !== undefined && <p className="text-xs text-slate-600">Phí hủy hiện tại ước tính: {currency(booking.cancellationFeeAmountNow)}. Phí cuối cùng được máy chủ tính khi xác nhận.</p>}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card></div><Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent title="Xác nhận hủy booking" description="Backend sẽ chọn chính sách phù hợp và tính phí hủy."><p className="text-sm text-slate-600">Nếu khoản thanh toán đủ điều kiện hoàn, backend sẽ chuyển trạng thái hoàn tiền sang chờ xử lý.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setCancelOpen(false)}>Quay lại</Button><Button variant="danger" onClick={async () => { try { await repo.cancelBooking(user?.id ?? '', booking.id); await Promise.all([queryClient.invalidateQueries({ queryKey: ['tourist-booking'] }), queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] })]); setCancelOpen(false); setMessage('Đã hủy booking. Trạng thái hoàn tiền được cập nhật riêng.') } catch (err) { setMessage(errorMessage(err)) } }}>Xác nhận hủy</Button></div></DialogContent></Dialog></div>
}

type SePayPayment = {
  orderCode: string
  vaNumber: string
  qrCode: string | null
  bankName: string | null
  accountNumber: string | null
  accountHolderName: string | null
  expiresAt: string | null
}

export function PaymentPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const autoStart = searchParams.get('auto') === '1'
  const user = useSession(s => s.user)
  const { data, isLoading, error } = useBooking(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [paymentInfo, setPaymentInfo] = useState<SePayPayment | null>(null)
  const started = useRef(false)

  const createPayment = useCallback(async () => {
    if (!id) return
    setBusy(true)
    setMessage('')
    try {
      const result = await api.createSePayPayment(id)
      setPaymentInfo(result)
      await queryClient.invalidateQueries({ queryKey: ['tourist-booking', id] })
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }, [id, queryClient])

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      void createPayment()
    }
  }, [autoStart, createPayment])

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const booking = data?.booking
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  const paymentStatus = data?.payment?.status ?? 'PENDING'
  if (booking.status !== 'PENDING_PAYMENT' && (isMock || booking.status !== 'CONFIRMED')) return <div className="container-app section-pad"><EmptyState title="Booking không còn chờ thanh toán" action={<Button asChild><Link to={'/bookings/' + booking.id}>Xem booking</Link></Button>} /></div>
  const simulate = async (outcome: 'success' | 'failure' | 'expire') => { setBusy(true); try { await repo.payBooking(user?.id ?? '', booking.id, outcome); await queryClient.invalidateQueries({ queryKey: ['tourist-booking'] }); await queryClient.invalidateQueries({ queryKey: ['tourist-bookings'] }); navigate('/bookings/' + booking.id + '/payment-result') } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) } }

  return <div className="container-app section-pad">
    <PageHeader title="Thanh toán booking" description={'Mã ' + (booking.bookingCode ?? booking.id) + ' · giữ phòng đến ' + dateTime(booking.holdExpiresAt)} />
    <Card className="max-w-2xl p-6">
      <div className="flex items-center gap-3"><CreditCard size={24} className="text-[#1E3A5F]" /><div><h2 className="text-lg font-semibold">Chuyển khoản qua SePay</h2><p className="text-sm text-slate-500">{isMock ? 'Mô phỏng kết quả, không phát sinh giao dịch thật.' : 'Quét QR hoặc chuyển đúng số tiền và mã nội dung để hệ thống tự xác nhận.'}</p></div></div>
      <p className="mt-6 text-2xl font-semibold text-[#1E3A5F]">{currency(booking.total)}</p>
      <div className="mt-6"><Feedback message={message} kind="error" /></div>
      {isMock ? <div className="mt-6 grid gap-2 sm:grid-cols-3"><Button disabled={busy} onClick={() => simulate('success')}>Mô phỏng thành công</Button><Button disabled={busy} variant="secondary" onClick={() => simulate('failure')}>Mô phỏng thất bại</Button><Button disabled={busy} variant="secondary" onClick={() => simulate('expire')}>Mô phỏng hết hạn</Button></div>
      : booking.status === 'CONFIRMED' ? <div className="mt-6"><p className="text-sm text-emerald-700">SePay đã xác nhận thanh toán thành công.</p><Button asChild className="mt-3"><Link to={'/bookings/' + booking.id + '/payment-result'}>Xem kết quả</Link></Button></div>
      : paymentInfo ? <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_220px]">
        <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
          <p>Ngân hàng: <strong>{paymentInfo.bankName ?? 'Ngân hàng nhận'}</strong></p>
          <p>Số tài khoản ảo nhận tiền: <strong className="font-mono">{paymentInfo.vaNumber}</strong></p>
          <p>Chủ tài khoản: <strong>{paymentInfo.accountHolderName ?? 'SePay'}</strong></p>
          <p>Số tiền: <strong>{currency(booking.total)}</strong></p>
          <p>Nội dung chuyển khoản: <strong className="font-mono">{paymentInfo.orderCode}</strong></p>
          <p className="text-slate-500">Mã tài khoản ảo: <span className="font-mono">{paymentInfo.vaNumber}</span></p>
          {paymentInfo.expiresAt && <p className="text-slate-500">Hết hạn: {dateTime(paymentInfo.expiresAt)}</p>}
          {paymentStatus === 'PROCESSING' && <p className="text-amber-800">Đang chờ SePay gửi xác nhận. Trạng thái sẽ được cập nhật sau khi nhận webhook.</p>}
        </div>
        {paymentInfo.qrCode && <img className="mx-auto h-56 w-56 rounded-lg border border-slate-200 object-contain p-2" src={paymentInfo.qrCode} alt="QR thanh toán booking" />}
        <Button variant="secondary" onClick={() => void createPayment()} disabled={busy}>Tải lại thông tin thanh toán</Button>
      </div>
      : paymentStatus === 'FAILED' ? <p className="mt-6 text-sm text-red-700">Không tạo được mã thanh toán. Booking chưa được xác nhận.</p>
      : paymentStatus === 'EXPIRED' ? <p className="mt-6 text-sm text-red-700">Thời gian giữ phòng hoặc thanh toán đã hết hạn.</p>
      : <Button className="mt-6" disabled={busy} onClick={() => void createPayment()}>{busy ? 'Đang tạo mã thanh toán...' : 'Tạo mã QR thanh toán'}</Button>}
      <Button asChild variant="ghost" className="mt-3"><Link to={'/bookings/' + booking.id}>Quay lại booking</Link></Button>
    </Card>
  </div>
}
export function PaymentResultPage() {
  const { id } = useParams()
  const { data, isLoading, error } = useBooking(id)
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const booking = data?.booking
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  const payment = data?.payment
  const paymentStatus = payment?.status ?? 'PENDING'
  const success = booking.status === 'CONFIRMED'
  const pending = booking.status === 'PENDING_PAYMENT' && (paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING')
  const expired = booking.status === 'EXPIRED' || paymentStatus === 'EXPIRED'
  const title = success ? 'Đặt phòng đã được xác nhận' : pending ? 'Đang chờ xác nhận thanh toán' : expired ? 'Thời gian giữ phòng đã hết' : 'Thanh toán chưa thành công'
  return <div className="container-app section-pad"><Card className="mx-auto max-w-xl p-8 text-center"><div className={'mx-auto flex h-16 w-16 items-center justify-center rounded-full ' + (success ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{success ? <CheckCircle2 size={32} /> : <CreditCard size={32} />}</div><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-2 text-slate-500">Booking {booking.bookingCode ?? booking.id} · {currency(booking.total)}</p><div className="mt-4 flex justify-center gap-2"><StatusBadge status={booking.status} />{payment && <StatusBadge status={payment.status} />}</div>{pending && <p className="mt-5 text-sm text-slate-600">Backend đang cập nhật giao dịch. Hãy quay lại trang này sau ít giây.</p>}{isMock && <p className="mt-5 text-sm text-amber-800">Đây là kết quả mô phỏng, không phải giao dịch SePay thật.</p>}<div className="mt-7 flex justify-center gap-2"><Button asChild><Link to={'/bookings/' + booking.id}>Chi tiết booking</Link></Button>{isMock && booking.status === 'PENDING_PAYMENT' && <Button asChild variant="secondary"><Link to={'/bookings/' + booking.id + '/payment'}>Thử lại</Link></Button>}</div></Card></div>
}
