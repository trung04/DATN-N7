import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CreditCard, Hotel, ReceiptText, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, ErrorState, Feedback, LoadingState, StatusBadge } from '@/components/common'
import { useAdminData } from '@/hooks/data'
import { currency, day, errorMessage, formatStatus } from '@/lib/utils'
import { isMock, repo } from '@/services'
import type { BookingStatus } from '@/types/domain'

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <Card className="min-w-0 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF0F6] text-[#1E3A5F]">{icon}</span></div>
    <p className="mt-2 break-words text-[clamp(1.55rem,2vw,2rem)] font-semibold tracking-tight text-[#1E3A5F]">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </Card>
}

const bookingStatuses: BookingStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED']

export function AdminDashboard() {
  const { data, isLoading, error } = useAdminData()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  if (!data) return <ErrorState message="Không có dữ liệu quản trị." />

  const paidPayments = data.payments.filter(payment => payment.status === 'PAID')
  const paidAmount = paidPayments.reduce((total, payment) => total + payment.amount, 0)
  const refundedAmount = data.refunds.filter(refund => refund.status === 'REFUNDED').reduce((total, refund) => total + refund.amount, 0)
  const pendingPartners = data.partners.filter(partner => partner.status === 'PENDING' || partner.status === 'NEEDS_INFO')
  const pendingRefunds = data.refunds.filter(refund => refund.status === 'PENDING' || refund.status === 'PROCESSING')
  const pendingSettlements = data.settlements.filter(settlement => settlement.status === 'DRAFT' || settlement.status === 'FAILED')
  const pendingCount = pendingPartners.length + pendingRefunds.length + pendingSettlements.length
  const recentBookings = [...data.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const statusCounts = bookingStatuses.map(status => ({ status, count: data.bookings.filter(booking => booking.status === status).length }))
  const maxCount = Math.max(1, ...statusCounts.map(row => row.count))

  const updateRefund = async (bookingId: string, next: 'PROCESSING' | 'REFUNDED' | 'FAILED') => {
    try {
      await repo.resolveRefund(bookingId, next)
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
      setMessage(next === 'PROCESSING' ? 'Đã chuyển yêu cầu hoàn tiền sang xử lý demo.' : next === 'REFUNDED' ? 'Đã mô phỏng hoàn tiền thành công.' : 'Đã mô phỏng hoàn tiền thất bại.')
    } catch (cause) { setMessage(errorMessage(cause)) }
  }

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl bg-[#1E3A5F] px-6 py-7 text-white sm:px-8 sm:py-8">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BFD0DE]">Trung tâm điều hành</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tổng quan quản trị</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#D6E3EC]">Theo dõi booking, đối tác và các khoản cần xử lý từ dữ liệu hiện có.</p></div>
        <div className="flex items-center gap-4 rounded-xl border border-white/20 bg-white/10 px-5 py-4"><span className="text-4xl font-semibold leading-none">{pendingCount}</span><div className="text-sm leading-5 text-[#EAF0F6]">mục cần<br />theo dõi</div></div>
      </div>
    </section>

    <section aria-label="Chỉ số tổng quan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Người dùng" value={String(data.users.length)} detail="Tài khoản trong hệ thống" icon={<UsersRound size={20} />} />
      <MetricCard label="Đối tác" value={String(data.partners.length)} detail={`${pendingPartners.length} hồ sơ cần xử lý`} icon={<Hotel size={20} />} />
      <MetricCard label="Booking" value={String(data.bookings.length)} detail={`${data.bookings.filter(booking => booking.status === 'CONFIRMED').length} đã xác nhận`} icon={<CalendarClock size={20} />} />
      <MetricCard label="Thanh toán ghi nhận" value={currency(paidAmount)} detail={`${paidPayments.length} giao dịch đã thanh toán`} icon={<CreditCard size={20} />} />
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Booking theo trạng thái</h2><p className="mt-1 text-sm text-slate-500">Tổng hợp trực tiếp từ {data.bookings.length} booking.</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] hover:underline" to="/admin/reports">Xem báo cáo <ArrowRight size={15} /></Link></div>
        <div className="mt-7 space-y-4">{statusCounts.map(row => <div className="grid grid-cols-[112px_minmax(0,1fr)_26px] items-center gap-3 text-sm sm:grid-cols-[135px_minmax(0,1fr)_30px]" key={row.status}><span className="text-slate-600">{formatStatus(row.status)}</span><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1E3A5F]" style={{ width: `${row.count / maxCount * 100}%` }} /></div><strong className="text-right text-[#1E3A5F]">{row.count}</strong></div>)}</div>
        <div className="mt-7 grid gap-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2"><div className="rounded-lg bg-[#F3F7FA] p-4"><p className="text-slate-500">Đã thanh toán</p><p className="mt-1 text-lg font-semibold text-[#1E3A5F]">{currency(paidAmount)}</p></div><div className="rounded-lg bg-[#F3F7FA] p-4"><p className="text-slate-500">Đã hoàn tiền</p><p className="mt-1 text-lg font-semibold text-[#1E3A5F]">{currency(refundedAmount)}</p></div></div>
      </Card>

      <Card className="min-w-0 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Việc cần xử lý</h2><p className="mt-1 text-sm text-slate-500">Các hồ sơ và yêu cầu đang mở.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{pendingPartners.length + pendingRefunds.length}</span></div>
        <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">Hồ sơ đối tác</h3><Link className="text-xs font-semibold text-[#1E3A5F] hover:underline" to="/admin/partners">Xem tất cả</Link></div>{pendingPartners.length ? <div className="mt-3 space-y-1">{pendingPartners.slice(0, 3).map(partner => <Link to={'/admin/partners/' + partner.id} key={partner.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50"><span className="min-w-0 truncate font-medium text-slate-700">{partner.name}</span><StatusBadge status={partner.status} /></Link>)}</div> : <p className="mt-3 text-sm text-slate-500">Không có hồ sơ chờ xử lý.</p>}</div>
        <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold text-slate-800">Hoàn tiền demo</h3>{pendingRefunds.length ? <div className="mt-3 space-y-3">{pendingRefunds.map(refund => <div key={refund.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><p className="font-semibold text-slate-800">{refund.bookingId}</p><p className="text-slate-500">{currency(refund.amount)}</p></div><StatusBadge status={refund.status} /></div>{isMock && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => updateRefund(refund.bookingId, refund.status === 'PENDING' ? 'PROCESSING' : 'REFUNDED')}>{refund.status === 'PENDING' ? 'Bắt đầu xử lý demo' : 'Hoàn thành demo'}</Button>{refund.status === 'PROCESSING' && <Button size="sm" variant="ghost" onClick={() => updateRefund(refund.bookingId, 'FAILED')}>Thất bại demo</Button>}</div>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">Không có yêu cầu hoàn tiền đang chờ.</p>}</div>
        <div className="mt-4"><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div>
      </Card>
    </div>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
      <Card className="min-w-0 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold text-slate-900">Booking gần đây</h2><p className="mt-1 text-sm text-slate-500">Các giao dịch được tạo gần nhất.</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] hover:underline" to="/admin/reports">Xem báo cáo <ArrowRight size={15} /></Link></div><div className="table-scroll"><table><thead><tr><th>Mã booking</th><th>Khách sạn</th><th>Ngày lưu trú</th><th>Giá trị</th><th>Trạng thái</th></tr></thead><tbody>{recentBookings.map(booking => <tr key={booking.id}><td className="font-semibold text-[#1E3A5F]">{booking.id}</td><td>{data.hotels.find(hotel => hotel.id === booking.hotelId)?.name ?? booking.hotelId}</td><td>{day(booking.checkIn)}</td><td>{currency(booking.total)}</td><td><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div></Card>
      <Card className="min-w-0 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Đối soát cần duyệt</h2><p className="mt-1 text-sm text-slate-500">Chi trả chỉ được mô phỏng sau khi duyệt.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF0F6] text-[#1E3A5F]"><ReceiptText size={18} /></span></div>{pendingSettlements.length ? <div className="mt-5 space-y-3">{pendingSettlements.slice(0, 4).map(settlement => <Link to={'/admin/settlements/' + settlement.id} key={settlement.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 hover:border-[#9CB4C9] hover:bg-[#F8FAFC]"><div className="min-w-0"><p className="font-semibold text-slate-800">{data.hotels.find(hotel => hotel.id === settlement.hotelId)?.name ?? settlement.hotelId}</p><p className="mt-1 text-xs text-slate-500">{settlement.id} · {day(settlement.periodStart)} – {day(settlement.periodEnd)}</p><p className="mt-2 text-sm font-semibold text-[#1E3A5F]">Cần trả {currency(settlement.net)}</p></div><ArrowRight size={17} className="shrink-0 text-[#1E3A5F]" /></Link>)}</div> : <p className="mt-5 text-sm text-slate-500">Không có kỳ đối soát cần duyệt.</p>}<Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] hover:underline" to="/admin/settlements">Tất cả kỳ đối soát <ArrowRight size={15} /></Link></Card>
    </div>
  </div>
}
