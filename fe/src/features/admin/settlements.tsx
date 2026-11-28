import { DateField } from '@/components/ui/date-input'
import { PaginatedList } from '@/components/paginated-list'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { pageItems } from '@/lib/pagination'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Banknote, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SettlementBadge } from '../bookings/settlement-display'
import { settlementEventLabel, settlementMoney as fmt } from '../bookings/settlement-format'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { dateTime, day, errorMessage } from '@/lib/utils'
import type { PartnerHotelQuery, SettlementBatch } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }

export function AdminSettlementsPage() {
  const queryClient = useQueryClient()
  const hotels = useQuery({ queryKey: ['settlement-hotels'], queryFn: () => api.adminHotels(hotelsQuery) })
  const batches = useQuery({ queryKey: ['settlement-batches'], queryFn: () => api.settlementBatches() })
  const pagination = usePagination(batches.data?.length)
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

  return <div className="management-list">
    <PageHeader title="Đối soát và chi trả" description="Tạo bảng kê từ đơn đặt phòng đủ điều kiện, duyệt số liệu và ghi nhận giao dịch chuyển khoản cho khách sạn." />
    <Card className="management-filters">
      <h2 className="font-semibold text-slate-900">Tạo kỳ đối soát</h2>
      <p className="mt-1 text-sm text-slate-500">Chỉ lấy đơn đặt phòng đã hoàn tất, đã thanh toán và chưa hoàn tiền. Mỗi đơn đặt phòng chỉ thuộc một kỳ.</p>
      <form onSubmit={create} className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Khách sạn"><select required value={hotelId} onChange={event => setHotelId(event.target.value)}><option value="">Chọn khách sạn</option>{hotels.data.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
        <DateField label="Từ ngày" required value={periodStart} onChange={value => setPeriodStart(value)} />
        <DateField label="Đến ngày" required min={periodStart || undefined} value={periodEnd} onChange={value => setPeriodEnd(value)} />
        <div className="flex items-end"><Button disabled={busy || !hotelId || !periodStart || !periodEnd}>{busy ? 'Đang tạo…' : 'Tạo bảng kê'}</Button></div>
      </form>
      <div className="mt-3"><Feedback message={notice || error} kind={notice ? 'success' : 'error'} /></div>
    </Card>
    {batches.data.length ? <Card className="table-scroll"><table><thead><tr><th>Khách sạn</th><th>Kỳ</th><th>Đơn đặt phòng</th><th>Tổng đã thu</th><th>Hoa hồng</th><th>Thực trả</th><th>Trạng thái</th><th></th></tr></thead><tbody>{pageItems(batches.data, pagination.page, pagination.size).map(batch => <tr key={batch.id}><td className="font-medium">{batch.hotelNameSnapshot}</td><td>{day(batch.periodStart)} – {day(batch.periodEnd)}</td><td>{batch.bookingCount}</td><td>{fmt(batch.grossAmount, batch.currency)}</td><td>{fmt(batch.commissionAmount, batch.currency)}</td><td className="font-semibold">{fmt(batch.netAmount, batch.currency)}</td><td><SettlementBadge batch={batch} /></td><td><Link className="font-semibold text-[#1E3A5F] hover:underline" to={`/admin/settlements/${batch.id}`}>Chi tiết</Link></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có kỳ đối soát" description="Chọn khách sạn và khoảng ngày để tạo bảng kê từ dữ liệu đơn đặt phòng thật." />}
    <Pagination page={pagination.page} total={batches.data.length} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
  </div>
}

export function AdminSettlementDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const batchQuery = useQuery({
    queryKey: ['settlement-batch', id],
    queryFn: () => api.settlementBatch(id),
    enabled: Boolean(id),
    refetchInterval: state => state.state.data?.status === 'PROCESSING' && state.state.data.transferMode === 'PAYOS' ? 10_000 : false,
  })
  const [transferReference, setTransferReference] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [payout, setPayout] = useState<SettlementBatch | null>(null)
  const [payoutError, setPayoutError] = useState('')

  const run = async (action: (batch: SettlementBatch) => Promise<SettlementBatch>, reportError = setError) => {
    if (!batchQuery.data || busy) return false
    reportError('')
    setBusy(true)
    try {
      const updated = await action(batchQuery.data)
      queryClient.setQueryData(['settlement-batch', id], updated)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settlement-batch', id] }),
        queryClient.invalidateQueries({ queryKey: ['settlement-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['managed-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['partner-settlement-batches'] }),
      ])
      setTransferReference(''); setFailureReason('')
      return true
    } catch (cause) {
      reportError(errorMessage(cause))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (batchQuery.isPending) return <LoadingState />
  if (!batchQuery.data) return <ErrorState message={errorMessage(batchQuery.error)} retry={() => { void batchQuery.refetch() }} />
  const batch = batchQuery.data
  const approve = batch.status === 'DRAFT'
  const canPayos = (batch.status === 'APPROVED' && batch.transferMode === 'MANUAL') || (batch.status === 'FAILED' && batch.transferMode === 'PAYOS')
  const canStart = batch.status === 'FAILED' && batch.transferMode === 'MANUAL' && Boolean(batch.processingAt)
  const manualProcessing = batch.status === 'PROCESSING' && batch.transferMode === 'MANUAL'

  return <div>
    <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#1E3A5F]" to="/admin/settlements"><ArrowLeft size={16} /> Danh sách kỳ đối soát</Link>
    <div className="mt-5"><PageHeader title={batch.hotelNameSnapshot} description={`Kỳ ${day(batch.periodStart)} – ${day(batch.periodEnd)} · ${batch.bookingCount} đơn đặt phòng · Mã ${batch.id}`} actions={<SettlementBadge batch={batch} />} /></div>
    <Card className="mb-5 p-5"><h2 className="font-semibold">Lịch sử xử lý</h2><PaginatedList key={batch.id} items={batch.events} label="Phân trang lịch sử đối soát">{visible => <ol className="mt-3 space-y-3">{visible.map(event => <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-l-2 border-slate-200 pl-3 text-sm"><span><strong>{settlementEventLabel(event.toStatus, batch.transferMode === 'LEGACY_SIMULATED')}</strong>{event.note && !/(sandbox|mô phỏng|giả lập|demo[- ]?seed|simulation)/i.test(event.note) && <span className="ml-2 text-slate-600">{event.note}</span>}{event.transferReference && <span className="ml-2 font-mono text-slate-600">{event.transferReference}</span>}</span><time className="shrink-0 text-xs text-slate-500">{dateTime(event.createdAt)}</time></li>)}</ol>}</PaginatedList></Card>
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-w-0 p-5 sm:p-6"><h2 className="font-semibold">Đơn đặt phòng trong kỳ</h2><PaginatedList key={batch.id} items={batch.items} label="Phân trang đơn đặt phòng trong kỳ">{visible => <div className="table-scroll mt-4"><table><thead><tr><th>Mã đặt phòng</th><th>Ngày trả phòng</th><th>Đã thu</th><th>Hoa hồng</th><th>Thực trả</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td className="font-mono text-sm">{item.bookingCodeSnapshot}</td><td>{day(item.checkOutDateSnapshot)}</td><td>{fmt(item.grossAmount, item.currencySnapshot)}</td><td>{fmt(item.commissionAmount, item.currencySnapshot)} ({item.commissionRateSnapshot}%)</td><td className="font-semibold">{fmt(item.netAmount, item.currencySnapshot)}</td></tr>)}</tbody></table></div>}</PaginatedList>
        <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4 text-sm"><p className="flex justify-between"><span>Tổng đã thu</span><strong>{fmt(batch.grossAmount, batch.currency)}</strong></p><p className="flex justify-between"><span>Hoa hồng</span><strong>{fmt(batch.commissionAmount, batch.currency)}</strong></p><p className="flex justify-between"><span>Điều chỉnh</span><strong>{fmt(batch.adjustmentAmount, batch.currency)}</strong></p><p className="flex justify-between text-lg"><span>Chuyển cho khách sạn</span><strong className="text-[#1E3A5F]">{fmt(batch.netAmount, batch.currency)}</strong></p></div>
      </Card>
      <Card className="h-fit p-5"><h2 className="font-semibold">Tài khoản nhận</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-slate-500">Ngân hàng</dt><dd className="font-medium">{batch.bankNameSnapshot}</dd></div><div><dt className="text-slate-500">Số tài khoản</dt><dd className="font-mono font-medium">{batch.bankAccountNumberSnapshot}</dd></div><div><dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-medium">{batch.bankAccountHolderSnapshot}</dd></div></dl>
        {batch.transferReference && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 className="mr-1 inline" size={16} /> Mã giao dịch: {batch.transferReference}</p>}
        {batch.providerTransferId && <p className="mt-2 break-all text-xs text-slate-500">Mã giao dịch nhà cung cấp: {batch.providerTransferId}</p>}
        {batch.failureReason && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Lần chuyển trước thất bại: {batch.failureReason}</p>}
        <div className="mt-5 grid gap-3">
          {approve && <Button disabled={busy} onClick={() => void run(row => api.approveSettlementBatch(row.id))}>Duyệt bảng kê</Button>}
          {canPayos && <>
            <Button disabled={busy || Boolean(batch.payoutUnavailableReason)} onClick={() => { setPayoutError(''); setPayout(batch) }}>
              <Banknote size={16} aria-hidden="true" />{batch.status === 'FAILED' ? 'Thử lại chi trả qua payOS' : 'Chi trả qua payOS'}
            </Button>
            {batch.payoutUnavailableReason && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{batch.payoutUnavailableReason}</p>}
          </>}
          {batch.status === 'PROCESSING' && batch.transferMode === 'PAYOS' && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Đang chờ payOS xác nhận giao dịch.</p>}
          {canStart && <Button disabled={busy} onClick={() => void run(row => api.startSettlementBatch(row.id))}><Banknote size={16} /> Thử lại chuyển thủ công</Button>}
          {manualProcessing && <><FormField label="Mã giao dịch ngân hàng"><input required maxLength={255} value={transferReference} onChange={event => setTransferReference(event.target.value)} placeholder="Nhập sau khi ngân hàng xác nhận đã chuyển" /></FormField><Button disabled={busy || !transferReference.trim()} onClick={() => void run(row => api.confirmSettlementBatch(row.id, transferReference.trim()))}><CheckCircle2 size={16} /> Xác nhận đã chuyển thủ công</Button><FormField label="Lý do chuyển thất bại"><input maxLength={1000} value={failureReason} onChange={event => setFailureReason(event.target.value)} placeholder="Ví dụ: ngân hàng từ chối giao dịch" /></FormField><Button variant="secondary" disabled={busy || !failureReason.trim()} onClick={() => void run(row => api.failSettlementBatch(row.id, failureReason.trim()))}>Ghi nhận thất bại</Button></>}
          {batch.status === 'PAID' && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{batch.transferMode === 'LEGACY_SIMULATED' ? 'Đã ghi nhận chi trả mô phỏng.' : 'Đã ghi nhận chi trả.'} {batch.paidAt ? `Thời gian: ${dateTime(batch.paidAt)}.` : ''}</p>}
          <Feedback message={error} kind="error" />
          <Button variant="ghost" onClick={() => navigate('/admin/settlements')}>Quay lại danh sách</Button>
        </div>
      </Card>
    </div>
    <Dialog open={Boolean(payout)} onOpenChange={open => { if (!open && !busy) setPayout(null) }}>
      {payout && <DialogContent title="Xác nhận chi trả qua payOS" description={payout.hotelNameSnapshot} layout="workspace" className="max-w-lg"
        footer={<>
          <Button variant="secondary" disabled={busy} onClick={() => setPayout(null)}>Quay lại</Button>
          <Button disabled={busy} onClick={async () => {
            const submitted = await run(() => api.requestSettlementPayout(payout.id, payout.revision), setPayoutError)
            if (submitted) setPayout(null)
          }}>{busy ? 'Đang gửi lệnh chi…' : 'Xác nhận chi trả'}</Button>
        </>}>
        <dl className="grid gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-slate-600">Số tiền chuyển</dt>
            <dd className="mt-1 text-xl font-semibold">{fmt(payout.netAmount, payout.currency)}</dd>
          </div>
          <div><dt className="text-slate-500">Ngân hàng</dt><dd className="font-medium wrap-anywhere">{payout.bankNameSnapshot}</dd></div>
          <div><dt className="text-slate-500">Số tài khoản</dt><dd className="font-mono wrap-anywhere">{payout.bankAccountNumberSnapshot}</dd></div>
          <div><dt className="text-slate-500">Chủ tài khoản</dt><dd className="font-medium wrap-anywhere">{payout.bankAccountHolderSnapshot}</dd></div>
        </dl>
        {payoutError && <div className="mt-3"><Feedback message={payoutError} kind="error" /></div>}
      </DialogContent>}
    </Dialog>
  </div>
}
