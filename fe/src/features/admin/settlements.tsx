import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { PartnerHotelQuery, SettlementBatch } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }
const fmt = (amount: number, code: string) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} ${code}`
const eventLabel = (status: string) => ({ DRAFT: 'Tạo kỳ', APPROVED: 'Đã duyệt', PROCESSING: 'Chờ chuyển khoản', PAID: 'Đã ghi nhận chi trả', FAILED: 'Chuyển khoản thất bại' }[status] ?? status)

export function AdminSettlementsPage() {
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: ['settlement-hotels'], queryFn: () => api.adminHotels(hotelsQuery) })
  const batches = useQuery({ queryKey: ['settlement-batches'], queryFn: () => api.settlementBatches() })
  const [hotelId, setHotelId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      const batch = await api.createSettlementBatch({ hotelId, periodStart, periodEnd })
      await queryClient.invalidateQueries({ queryKey: ['settlement-batches'] })
      setNotice(`Đã tạo kỳ đối soát ${batch.id}.`)
      setHotelId('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }

  if (hotels.isPending || batches.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (batches.isError) return <ErrorState message={errorMessage(batches.error)} retry={() => { void batches.refetch() }} />

  return <div>
    <PageHeader title="Đối soát và chi trả" description="Tạo bảng kê từ booking đủ điều kiện, duyệt số liệu và ghi nhận giao dịch chuyển khoản cho khách sạn." />
    <Card className="mb-5 p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">Tạo kỳ đối soát</h2>
      <p className="mt-1 text-sm text-slate-500">Chỉ lấy booking đã hoàn tất, đã thanh toán và chưa hoàn tiền. Mỗi booking chỉ thuộc một kỳ.</p>
      <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Khách sạn"><select required value={hotelId} onChange={event => setHotelId(event.target.value)}><option value="">Chọn khách sạn</option>{hotels.data.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
        <FormField label="Từ ngày"><input required type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></FormField>
        <FormField label="Đến ngày"><input required type="date" min={periodStart || undefined} value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></FormField>
        <div className="flex items-end"><Button disabled={busy || !hotelId || !periodStart || !periodEnd}>{busy ? 'Đang tạo…' : 'Tạo bảng kê'}</Button></div>
      </form>
      <div className="mt-3"><Feedback message={notice || error} kind={notice ? 'success' : 'error'} /></div>
    </Card>
    {batches.data.length ? <Card className="table-scroll"><table><thead><tr><th>Khách sạn</th><th>Kỳ</th><th>Booking</th><th>Tổng đã thu</th><th>Hoa hồng</th><th>Thực trả</th><th>Trạng thái</th><th></th></tr></thead><tbody>{batches.data.map(batch => <tr key={batch.id}><td className="font-medium">{batch.hotelNameSnapshot}</td><td>{day(batch.periodStart)} – {day(batch.periodEnd)}</td><td>{batch.bookingCount}</td><td>{fmt(batch.grossAmount, batch.currency)}</td><td>{fmt(batch.commissionAmount, batch.currency)}</td><td className="font-semibold">{fmt(batch.netAmount, batch.currency)}</td><td><StatusBadge status={batch.status} /></td><td><Link className="font-semibold text-[#1E3A5F] hover:underline" to={`/admin/settlements/${batch.id}`}>Chi tiết</Link></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có kỳ đối soát" description="Chọn khách sạn và khoảng ngày để tạo bảng kê từ dữ liệu booking thật." />}
  </div>
}

export function AdminSettlementDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const batchQuery = useQuery({ queryKey: ['settlement-batch', id], queryFn: () => api.settlementBatch(id), enabled: Boolean(id) })
  const [transferReference, setTransferReference] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: (batch: SettlementBatch) => Promise<SettlementBatch>) => {
    if (!batchQuery.data) return
    setError(''); setBusy(true)
    try {
      await action(batchQuery.data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settlement-batch', id] }),
        queryClient.invalidateQueries({ queryKey: ['settlement-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['managed-bookings'] }),
      ])
      setTransferReference(''); setFailureReason('')
    } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) }
  }

  if (batchQuery.isPending) return <LoadingState />
  if (batchQuery.isError) return <ErrorState message={errorMessage(batchQuery.error)} retry={() => { void batchQuery.refetch() }} />
  const batch = batchQuery.data
  const approve = batch.status === 'DRAFT'
  const canStart = batch.status === 'APPROVED' || batch.status === 'FAILED'
  const processing = batch.status === 'PROCESSING'

  return <div>
    <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#1E3A5F]" to="/admin/settlements"><ArrowLeft size={16} /> Danh sách kỳ đối soát</Link>
    <div className="mt-5"><PageHeader title={batch.hotelNameSnapshot} description={`Kỳ ${day(batch.periodStart)} – ${day(batch.periodEnd)} · ${batch.bookingCount} booking · Mã ${batch.id}`} actions={<StatusBadge status={batch.status} />} /></div>
    <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle size={20} className="shrink-0" /><p>Ứng dụng chưa kết nối API chuyển tiền ngân hàng. Admin cần tự chuyển khoản ngoài hệ thống; chỉ nhập mã giao dịch sau khi ngân hàng xác nhận đã chuyển.</p></div>
    <Card className="mb-5 p-5"><h2 className="font-semibold">Lịch sử xử lý</h2><ol className="mt-3 space-y-3">{batch.events.map(event => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-l-2 border-slate-200 pl-3 text-sm"><span><strong>{eventLabel(event.toStatus)}</strong>{event.note && <span className="ml-2 text-slate-600">{event.note}</span>}{event.transferReference && <span className="ml-2 font-mono text-slate-600">{event.transferReference}</span>}</span><time className="shrink-0 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('vi-VN')}</time></li>)}</ol></Card>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 p-5 sm:p-6"><h2 className="font-semibold">Booking trong kỳ</h2><div className="table-scroll mt-4"><table><thead><tr><th>Mã booking</th><th>Ngày trả phòng</th><th>Đã thu</th><th>Hoa hồng</th><th>Thực trả</th></tr></thead><tbody>{batch.items.map(item => <tr key={item.id}><td className="font-mono text-sm">{item.bookingCodeSnapshot}</td><td>{day(item.checkOutDateSnapshot)}</td><td>{fmt(item.grossAmount, item.currencySnapshot)}</td><td>{fmt(item.commissionAmount, item.currencySnapshot)} ({item.commissionRateSnapshot}%)</td><td className="font-semibold">{fmt(item.netAmount, item.currencySnapshot)}</td></tr>)}</tbody></table></div>
        <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm"><p className="flex justify-between"><span>Tổng đã thu</span><strong>{fmt(batch.grossAmount, batch.currency)}</strong></p><p className="flex justify-between"><span>Hoa hồng</span><strong>{fmt(batch.commissionAmount, batch.currency)}</strong></p><p className="flex justify-between"><span>Điều chỉnh</span><strong>{fmt(batch.adjustmentAmount, batch.currency)}</strong></p><p className="flex justify-between text-lg"><span>Chuyển cho khách sạn</span><strong className="text-[#1E3A5F]">{fmt(batch.netAmount, batch.currency)}</strong></p></div>
      </Card>
      <Card className="h-fit p-5"><h2 className="font-semibold">Tài khoản nhận</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Ngân hàng</dt><dd className="font-medium">{batch.bankNameSnapshot}</dd></div><div><dt className="text-slate-500">Số tài khoản</dt><dd className="font-mono font-medium">{batch.bankAccountNumberSnapshot}</dd></div><div><dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-medium">{batch.bankAccountHolderSnapshot}</dd></div></dl>
        {batch.transferReference && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline" size={16} /> Mã giao dịch: {batch.transferReference}</p>}
        {batch.failureReason && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Lần chuyển trước thất bại: {batch.failureReason}</p>}
        <div className="mt-5 grid gap-3">
          {approve && <Button disabled={busy} onClick={() => void run(row => api.approveSettlementBatch(row.id))}>Duyệt bảng kê</Button>}
          {canStart && <Button disabled={busy} onClick={() => void run(row => api.startSettlementBatch(row.id))}><ExternalLink size={16} /> Bắt đầu chuyển khoản</Button>}
          {processing && <><FormField label="Mã giao dịch ngân hàng"><input required maxLength={255} value={transferReference} onChange={event => setTransferReference(event.target.value)} placeholder="Nhập sau khi chuyển thành công" /></FormField><Button disabled={busy || !transferReference.trim()} onClick={() => void run(row => api.confirmSettlementBatch(row.id, transferReference.trim()))}><CheckCircle2 size={16} /> Xác nhận đã chuyển</Button><FormField label="Lý do chuyển thất bại"><input maxLength={1000} value={failureReason} onChange={event => setFailureReason(event.target.value)} placeholder="Ví dụ: ngân hàng từ chối giao dịch" /></FormField><Button variant="secondary" disabled={busy || !failureReason.trim()} onClick={() => void run(row => api.failSettlementBatch(row.id, failureReason.trim()))}>Ghi nhận thất bại</Button></>}
          {batch.status === 'PAID' && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Đã ghi nhận chi trả lúc {batch.paidAt ? new Date(batch.paidAt).toLocaleString('vi-VN') : '—'}.</p>}
          <Feedback message={error} kind="error" />
          <Button variant="ghost" onClick={() => navigate('/admin/settlements')}><RotateCw size={16} /> Quay lại danh sách</Button>
        </div>
      </Card>
    </div>
  </div>
}
