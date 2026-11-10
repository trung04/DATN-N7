import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo, isMock } from '@/services'
import { currency, day, dateTime, errorMessage, nights, stayDays, todayPlus } from '@/lib/utils'
import { cancellationQuote } from '@/lib/booking'
import { useSession } from '@/stores/session'
import { useCatalog, useTourist } from '@/hooks/data'
import type { BookingInput } from '@/types/domain'

export function BookingNewPage() {
  const user = useSession(s => s.user)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useCatalog()
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<BookingInput>({
    hotelId: params.get('hotelId') ?? '', roomId: params.get('roomId') ?? '',
    checkIn: params.get('checkIn') ?? todayPlus(7), checkOut: params.get('checkOut') ?? todayPlus(9),
    rooms: Number(params.get('rooms') ?? 1), adults: Number(params.get('adults') ?? 2), children: Number(params.get('children') ?? 0),
    guestName: user?.name ?? '', guestEmail: user?.email ?? '', guestPhone: user?.phone ?? '', specialRequest: '',
  })
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const hotel = data?.hotels.find(h => h.id === form.hotelId)
  const room = data?.rooms.find(r => r.id === form.roomId && r.hotelId === form.hotelId)
  if (!hotel || !room || !data) return <div className="container-app section-pad"><EmptyState title="Chưa chọn phòng" description="Chọn khách sạn và loại phòng trước khi đặt." action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} /></div>
  const dates = nights(form.checkIn, form.checkOut) > 0 ? stayDays(form.checkIn, form.checkOut) : []
  const prices = dates.map(date => data.inventory.find(i => i.roomId === room.id && i.date === date)?.price ?? room.basePrice)
  const total = prices.reduce((sum, price) => sum + price * form.rooms, 0)
  const available = dates.length > 0 && dates.every(date => (data.availability.find(a => a.roomId === room.id && a.date === date)?.available ?? 0) >= form.rooms)
  const capacity = form.adults + form.children <= room.capacity * form.rooms
  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const next = () => {
    setMessage('')
    if (step === 1) { if (form.checkIn < todayPlus(0) || !dates.length || !available || !capacity || form.rooms < 1 || form.adults < 1) { setMessage('Ngày lưu trú, số khách hoặc tình trạng phòng không hợp lệ.'); return } setStep(2) }
    else if (step === 2) { if (form.guestName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.guestEmail) || !/^0\d{9,10}$/.test(form.guestPhone)) { setMessage('Kiểm tra họ tên, email và số điện thoại người đặt.'); return } setStep(3) }
  }
  const confirm = async () => { setBusy(true); setMessage(''); try { const booking = await repo.createBooking(user?.id ?? '', form); navigate('/bookings/' + booking.id + '/payment') } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) } }
  return <div className="container-app section-pad"><PageHeader title="Đặt phòng khách sạn" description={'Bước ' + step + '/3 · ' + (step === 1 ? 'Chọn phòng' : step === 2 ? 'Thông tin người đặt' : 'Xác nhận booking')} /><div className="grid gap-6 lg:grid-cols-[1fr_350px]"><Card className="p-6">{step === 1 ? <div className="grid gap-4"><h2 className="text-lg font-semibold">Phòng và ngày lưu trú</h2><p className="text-sm text-slate-600">{hotel.name} · {room.name} · tối đa {room.capacity} khách/phòng</p><div className="grid gap-4 sm:grid-cols-2"><FormField label="Nhận phòng"><input type="date" min={todayPlus(0)} value={form.checkIn} onChange={e => set('checkIn', e.target.value)} /></FormField><FormField label="Trả phòng"><input type="date" min={form.checkIn} value={form.checkOut} onChange={e => set('checkOut', e.target.value)} /></FormField><FormField label="Số phòng"><input type="number" min="1" max="5" value={form.rooms} onChange={e => set('rooms', Number(e.target.value))} /></FormField><FormField label="Người lớn"><input type="number" min="1" max="12" value={form.adults} onChange={e => set('adults', Number(e.target.value))} /></FormField><FormField label="Trẻ em"><input type="number" min="0" max="10" value={form.children} onChange={e => set('children', Number(e.target.value))} /></FormField></div><p className={'text-sm ' + (available && capacity ? 'text-emerald-700' : 'text-red-700')}>{available && capacity ? 'Phòng còn nhận đặt cho các ngày đã chọn.' : 'Không đủ phòng hoặc vượt sức chứa.'}</p></div> : step === 2 ? <div className="grid gap-4"><h2 className="text-lg font-semibold">Thông tin người đặt</h2><FormField label="Họ tên"><input required value={form.guestName} onChange={e => set('guestName', e.target.value)} autoComplete="name" /></FormField><FormField label="Email"><input required type="email" value={form.guestEmail} onChange={e => set('guestEmail', e.target.value)} autoComplete="email" /></FormField><FormField label="Số điện thoại"><input required inputMode="tel" value={form.guestPhone} onChange={e => set('guestPhone', e.target.value)} autoComplete="tel" /></FormField><FormField label="Yêu cầu đặc biệt"><textarea value={form.specialRequest} onChange={e => set('specialRequest', e.target.value)} /></FormField></div> : <div><h2 className="text-lg font-semibold">Kiểm tra thông tin trước khi đặt</h2><dl className="mt-5 grid gap-4 text-sm"><div><dt className="text-slate-500">Khách sạn / phòng</dt><dd className="font-semibold">{hotel.name} · {room.name}</dd></div><div><dt className="text-slate-500">Ngày lưu trú</dt><dd>{day(form.checkIn)} – {day(form.checkOut)} · {dates.length} đêm</dd></div><div><dt className="text-slate-500">Khách / phòng</dt><dd>{form.adults} người lớn, {form.children} trẻ em · {form.rooms} phòng</dd></div><div><dt className="text-slate-500">Người đặt</dt><dd>{form.guestName} · {form.guestEmail} · {form.guestPhone}</dd></div><div><dt className="text-slate-500">Chính sách hủy</dt><dd>{hotel.cancellationPolicy}</dd></div></dl><p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Xác nhận tạo booking chờ thanh toán và giữ phòng 15 phút. Booking chỉ được xác nhận sau kết quả thanh toán đã xác minh.</p></div>}<div className="mt-6"><Feedback message={message} kind="error" /></div><div className="mt-6 flex gap-2">{step > 1 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Quay lại</Button>}{step < 3 ? <Button onClick={next}>Tiếp tục</Button> : <Button disabled={busy} onClick={confirm}>{busy ? 'Đang tạo booking...' : 'Xác nhận và thanh toán'}</Button>}</div></Card><Card className="h-fit p-5"><h2 className="font-semibold">Tóm tắt giá</h2><div className="mt-4 grid gap-2 text-sm">{prices.map((price, i) => <div key={dates[i]} className="flex justify-between gap-3"><span>{dates[i] ? day(dates[i]) : ''} × {form.rooms} phòng</span><span>{currency(price * form.rooms)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng thanh toán</span><span className="text-[#1E3A5F]">{currency(total)}</span></div><p className="mt-3 text-xs text-slate-500">Giá demo đã bao gồm các khoản thể hiện ở trên; không phát sinh thuế/phí khác trong dữ liệu mẫu.</p></Card></div></div>
}

export function BookingsPage() {
  const { data, isLoading, error } = useTourist()
  const { data: catalog } = useCatalog()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').toLowerCase()
  const status = params.get('status') ?? ''
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const bookings = [...(data?.bookings ?? [])].filter(b => (!q || b.id.toLowerCase().includes(q) || catalog?.hotels.find(h => h.id === b.hotelId)?.name.toLowerCase().includes(q)) && (!status || b.status === status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <div className="container-app section-pad"><PageHeader title="Booking của tôi" description="Theo dõi đặt phòng, thanh toán và hoàn tiền." /><div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Tìm mã hoặc khách sạn<input value={params.get('q') ?? ''} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); setParams(next) }} /></label><label className="text-sm font-medium">Trạng thái<select value={status} onChange={e => { const next = new URLSearchParams(params); if (e.target.value) next.set('status', e.target.value); else next.delete('status'); setParams(next) }}><option value="">Tất cả</option>{['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(x => <option key={x} value={x}>{x}</option>)}</select></label></div>{bookings.length ? <div className="grid gap-4">{bookings.map(b => <Card className="flex flex-wrap items-center justify-between gap-4 p-5" key={b.id}><div><div className="flex items-center gap-3"><h2 className="font-semibold">{catalog?.hotels.find(h => h.id === b.hotelId)?.name ?? b.hotelId}</h2><StatusBadge status={b.status} /></div><p className="mt-2 text-sm text-slate-500">{b.id} · {day(b.checkIn)} – {day(b.checkOut)}</p><p className="mt-1 text-sm">{catalog?.rooms.find(r => r.id === b.roomId)?.name} · {currency(b.total)}</p></div><Button asChild variant="secondary" size="sm"><Link to={'/bookings/' + b.id}>Xem chi tiết</Link></Button></Card>)}</div> : <EmptyState title="Không có booking phù hợp" description="Thử đổi bộ lọc hoặc tìm khách sạn để đặt phòng." action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} />}</div>
}
export function BookingDetailPage() {
  const { id } = useParams()
  const [now] = useState(() => Date.now())
  const user = useSession(s => s.user)
  const { data, isLoading, error } = useTourist()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [stars, setStars] = useState(0)
  const [content, setContent] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const booking = data?.bookings.find(b => b.id === id)
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  const hotel = catalog?.hotels.find(h => h.id === booking.hotelId)
  const room = catalog?.rooms.find(r => r.id === booking.roomId)
  const payment = [...(data?.payments.filter(p => p.bookingId === booking.id) ?? [])].at(-1)
  const refund = data?.refunds.find(r => r.bookingId === booking.id)
  const reviewed = data?.reviews.some(r => r.bookingId === booking.id)
  const quote = cancellationQuote(booking, now)
  const canCancel = booking.status === 'CONFIRMED' && quote.allowed
  const fee = quote.fee
  return <div className="container-app section-pad"><Link className="text-sm text-[#1E3A5F]" to="/bookings">← Booking của tôi</Link><div className="mt-5"><PageHeader title={'Booking ' + booking.id} description={hotel?.name ?? booking.hotelId} actions={<StatusBadge status={booking.status} />} /></div><div className="grid gap-6 lg:grid-cols-[1fr_340px]"><div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Thông tin lưu trú</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Khách sạn</dt><dd>{hotel?.name}</dd></div><div><dt className="text-slate-500">Loại phòng</dt><dd>{room?.name}</dd></div><div><dt className="text-slate-500">Ngày nhận phòng</dt><dd>{day(booking.checkIn)}</dd></div><div><dt className="text-slate-500">Ngày trả phòng</dt><dd>{day(booking.checkOut)}</dd></div><div><dt className="text-slate-500">Số lượng</dt><dd>{booking.rooms} phòng · {booking.adults + booking.children} khách</dd></div><div><dt className="text-slate-500">Người đặt</dt><dd>{booking.guestName} · {booking.guestPhone}</dd></div></dl><p className="mt-5 text-sm text-slate-600"><strong>Chính sách lưu khi đặt:</strong> {booking.policySnapshot}</p></Card><Card className="p-6"><h2 className="text-lg font-semibold">Thanh toán và hoàn tiền</h2><div className="mt-4 flex flex-wrap items-center gap-3 text-sm">Trạng thái thanh toán: {payment && <StatusBadge status={payment.status} />}</div>{booking.status === 'PENDING_PAYMENT' && <p className="mt-3 text-sm text-amber-800">Giữ phòng đến {dateTime(booking.holdExpiresAt)}.</p>}{refund && <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm"><p><strong>Hoàn tiền:</strong> <StatusBadge status={refund.status} /></p><p className="mt-2">Số tiền yêu cầu: {currency(refund.amount)}</p><p className="mt-1 text-slate-500">Đã hủy booking không có nghĩa là tiền đã được hoàn.</p></div>}{booking.status === 'CANCELLED' && !refund && <p className="mt-3 text-sm text-slate-500">Theo chính sách hủy, booking này không phát sinh hoàn tiền.</p>}</Card>{booking.status === 'COMPLETED' && <Card className="p-6"><h2 className="text-lg font-semibold">Đánh giá khách sạn</h2>{reviewed ? <p className="mt-3 text-sm text-slate-600">Bạn đã gửi đánh giá cho booking này.</p> : <form className="mt-4 grid gap-4" onSubmit={async e => { e.preventDefault(); try { await repo.addReview(user?.id ?? '', booking.id, stars, content); await queryClient.invalidateQueries({ queryKey: ['tourist'] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }); setMessage('Đã gửi đánh giá.') } catch (err) { setMessage(errorMessage(err)) } }}><FormField label="Số sao"><select value={stars} onChange={e => setStars(Number(e.target.value))}><option value="0">Chọn số sao</option>{[1, 2, 3, 4, 5].map(x => <option key={x} value={x}>{x} sao</option>)}</select></FormField><FormField label="Nhận xét"><textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Chia sẻ trải nghiệm lưu trú..." /></FormField><Button className="w-fit">Gửi đánh giá</Button></form>}</Card>}</div><Card className="h-fit p-5"><h2 className="font-semibold">Chi phí</h2><div className="mt-4 grid gap-2 text-sm">{booking.nightlyPrices.map((price, i) => <div key={i} className="flex justify-between"><span>Đêm {i + 1} × {booking.rooms} phòng</span><span>{currency(price * booking.rooms)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng thanh toán</span><span>{currency(booking.total)}</span></div><div className="mt-5 grid gap-2">{booking.status === 'PENDING_PAYMENT' && <Button asChild><Link to={'/bookings/' + booking.id + '/payment'}>Tiếp tục thanh toán</Link></Button>}{canCancel && <Button variant="danger" onClick={() => setCancelOpen(true)}>Hủy booking</Button>}</div><div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></Card></div><Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent title="Xác nhận hủy booking" description="Việc hủy sẽ giải phóng phòng. Hoàn tiền được theo dõi riêng."><div className="grid gap-2 text-sm"><p>Chính sách: {booking.policySnapshot}</p><p>Phí hủy dự kiến: <strong>{currency(fee)}</strong></p><p>Số tiền yêu cầu hoàn: <strong>{currency(booking.total - fee)}</strong></p></div><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setCancelOpen(false)}>Quay lại</Button><Button variant="danger" onClick={async () => { try { await repo.cancelBooking(user?.id ?? '', booking.id); await queryClient.invalidateQueries({ queryKey: ['tourist'] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }); setCancelOpen(false); setMessage('Đã hủy booking. Yêu cầu hoàn tiền đang chờ xử lý.') } catch (err) { setMessage(errorMessage(err)) } }}>Xác nhận hủy</Button></div></DialogContent></Dialog></div>
}

export function PaymentPage() {
  const { id } = useParams()
  const user = useSession(s => s.user)
  const { data, isLoading } = useTourist()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  const booking = data?.bookings.find(b => b.id === id)
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  if (booking.status !== 'PENDING_PAYMENT') return <div className="container-app section-pad"><EmptyState title="Booking không còn chờ thanh toán" action={<Button asChild><Link to={'/bookings/' + booking.id}>Xem booking</Link></Button>} /></div>
  const simulate = async (outcome: 'success' | 'failure' | 'expire') => { setBusy(true); try { await repo.payBooking(user?.id ?? '', booking.id, outcome); await queryClient.invalidateQueries({ queryKey: ['tourist'] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }); navigate('/bookings/' + booking.id + '/payment-result') } catch (err) { setMessage(errorMessage(err)) } finally { setBusy(false) } }
  return <div className="container-app section-pad"><PageHeader title="Thanh toán booking" description={'Mã ' + booking.id + ' · giữ phòng đến ' + dateTime(booking.holdExpiresAt)} /><Card className="max-w-2xl p-6"><div className="flex items-center gap-3"><CreditCard size={24} className="text-[#1E3A5F]" /><div><h2 className="text-lg font-semibold">VNPAY</h2><p className="text-sm text-slate-500">{isMock ? 'Mô phỏng kết quả thanh toán, không phát sinh giao dịch thật.' : 'Kết quả do backend xác minh.'}</p></div></div><p className="mt-6 text-2xl font-semibold text-[#1E3A5F]">{currency(booking.total)}</p><p className="mt-2 text-sm text-slate-500">Không nhập hoặc lưu thông tin thẻ trên giao diện này.</p><div className="mt-6"><Feedback message={message} kind="error" /></div>{isMock ? <div className="mt-6 grid gap-2 sm:grid-cols-3"><Button disabled={busy} onClick={() => simulate('success')}>Mô phỏng thành công</Button><Button disabled={busy} variant="secondary" onClick={() => simulate('failure')}>Mô phỏng thất bại</Button><Button disabled={busy} variant="secondary" onClick={() => simulate('expire')}>Mô phỏng hết hạn</Button></div> : <Button className="mt-6" disabled={busy} onClick={() => simulate('success')}>Tiếp tục qua VNPAY</Button>}<Button asChild variant="ghost" className="mt-3"><Link to={'/bookings/' + booking.id}>Quay lại booking</Link></Button></Card></div>
}
export function PaymentResultPage() {
  const { id } = useParams()
  const { data, isLoading } = useTourist()
  if (isLoading) return <LoadingState />
  const booking = data?.bookings.find(b => b.id === id)
  if (!booking) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy booking" /></div>
  const payment = [...(data?.payments.filter(p => p.bookingId === id) ?? [])].at(-1)
  const success = booking.status === 'CONFIRMED'
  return <div className="container-app section-pad"><Card className="mx-auto max-w-xl p-8 text-center"><div className={'mx-auto flex h-16 w-16 items-center justify-center rounded-full ' + (success ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{success ? <CheckCircle2 size={32} /> : <CreditCard size={32} />}</div><h1 className="mt-5 text-2xl font-semibold">{success ? 'Đặt phòng đã được xác nhận' : booking.status === 'EXPIRED' ? 'Thời gian giữ phòng đã hết' : 'Thanh toán chưa thành công'}</h1><p className="mt-2 text-slate-500">Booking {booking.id} · {currency(booking.total)}</p><div className="mt-4 flex justify-center gap-2"><StatusBadge status={booking.status} />{payment && <StatusBadge status={payment.status} />}</div>{isMock && <p className="mt-5 text-sm text-amber-800">Đây là kết quả mô phỏng, không phải giao dịch VNPAY thật.</p>}<div className="mt-7 flex justify-center gap-2"><Button asChild><Link to={'/bookings/' + booking.id}>Chi tiết booking</Link></Button>{booking.status === 'PENDING_PAYMENT' && <Button asChild variant="secondary"><Link to={'/bookings/' + booking.id + '/payment'}>Thử lại</Link></Button>}</div></Card></div>
}
