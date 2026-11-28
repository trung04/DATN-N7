import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/common'
import { Pagination } from '@/components/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogList, DialogSections } from '@/components/ui/dialog-sections'
import { pageItems } from '@/lib/pagination'
import { usePagination } from '@/lib/use-pagination'
import { dateTime, day, errorMessage } from '@/lib/utils'
import { api } from '@/services/api/client'
import { useSession } from '@/stores/session'
import type { SettlementBatch } from '@/types/domain'
import { SettlementBadge } from '../bookings/settlement-display'
import { settlementEventLabel, settlementMoney } from '../bookings/settlement-format'

export function PartnerSettlementsPage() {
  const userId = useSession(state => state.user?.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['partner-settlement-batches', userId],
    queryFn: api.partnerSettlementBatches,
    refetchInterval: query => query.state.data?.some(batch =>
      batch.transferMode !== 'LEGACY_SIMULATED' && (batch.status === 'APPROVED' || batch.status === 'PROCESSING')
    ) ? 10_000 : false,
  })
  const pagination = usePagination(query.data?.length)
  if (query.isPending) return <LoadingState />
  if (!query.data) return <ErrorState message={errorMessage(query.error)} retry={() => { void query.refetch() }} />

  const batches = pageItems(query.data, pagination.page, pagination.size)
  const selected = query.data.find(batch => batch.id === selectedId)

  return <div className="management-list">
    <PageHeader title="Đối soát và chi trả" description="Xem bảng kê từng kỳ và theo dõi tiền chuyển về tài khoản khách sạn." />
    {batches.length === 0 ? <EmptyState title="Chưa có kỳ đối soát được duyệt" description="Bảng kê sẽ xuất hiện sau khi quản trị viên duyệt." /> : <>
      <Card className="table-scroll">
        <table className="max-md:table-fixed max-md:[&_:is(th,td)]:px-1.5!">
          <thead><tr>
            <th className="max-md:w-[37%]">Khách sạn</th>
            <th className="hidden md:table-cell">Kỳ đối soát</th>
            <th className="text-right max-md:w-[24%]">Số tiền</th>
            <th className="max-md:w-[24%] max-md:whitespace-normal!">Trạng thái chi trả</th>
            <th className="text-right max-md:w-[15%]"><span className="max-md:sr-only">Thao tác</span></th>
          </tr></thead>
          <tbody>{batches.map(batch => {
            const period = `${day(batch.periodStart)} – ${day(batch.periodEnd)}`
            const simulated = batch.transferMode === 'LEGACY_SIMULATED'
            return <tr key={batch.id}>
              <td><span className="font-semibold">{batch.hotelNameSnapshot}</span><span className="mt-1 block text-xs text-slate-500 md:hidden">{period}</span></td>
              <td className="hidden md:table-cell">{period}</td>
              <td className="text-right tabular-nums">
                <span className="block font-semibold">{settlementMoney(batch.netAmount, batch.currency)}</span>
                {simulated ? <small className="text-slate-500">Số liệu mô phỏng</small>
                  : batch.status !== 'PAID' && <small className="text-slate-500">Dự kiến nhận</small>}
              </td>
              <td>
                <SettlementBadge batch={batch} />
                {batch.status === 'PAID' && !simulated && batch.paidAt &&
                  <time className="mt-1 block text-xs text-slate-500" dateTime={batch.paidAt}>{dateTime(batch.paidAt)}</time>}
              </td>
              <td className="text-right">
                <Button variant="secondary" size="sm" className="max-md:w-9 max-md:px-0" aria-label={`Xem chi tiết kỳ ${period}`} onClick={() => setSelectedId(batch.id)}>
                  <Eye size={15} aria-hidden="true" /><span className="hidden md:inline">Xem chi tiết</span>
                </Button>
              </td>
            </tr>
          })}</tbody>
        </table>
      </Card>
      <Pagination page={pagination.page} total={query.data.length} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
    </>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null) }}>
      {selected && <DialogContent title="Chi tiết kỳ đối soát" description={`${selected.hotelNameSnapshot} · ${day(selected.periodStart)} – ${day(selected.periodEnd)}`}
        layout="workspace" className="max-w-4xl">
        <SettlementDetails key={selected.id} batch={selected} />
      </DialogContent>}
    </Dialog>
  </div>
}

function SettlementDetails({ batch }: { batch: SettlementBatch }) {
  const simulated = batch.transferMode === 'LEGACY_SIMULATED'
  const paid = batch.status === 'PAID' && !simulated
  const amountLabel = simulated ? 'Số tiền mô phỏng' : paid ? 'Số tiền đã chi' : 'Số tiền dự kiến nhận'
  return <DialogSections label="Chi tiết kỳ đối soát" sections={[
    {
      id: 'summary', label: 'Tổng quan', content: <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-3 sm:p-4">
          <h3 className="mb-3 font-semibold">Tổng hợp số tiền</h3>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3"><dt>Tiền đã thu</dt><dd>{settlementMoney(batch.grossAmount, batch.currency)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Hoa hồng</dt><dd>{settlementMoney(batch.commissionAmount, batch.currency)}</dd></div>
            {batch.adjustmentAmount !== 0 && <div className="flex justify-between gap-3"><dt>Điều chỉnh</dt><dd>{settlementMoney(batch.adjustmentAmount, batch.currency)}</dd></div>}
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-2 font-semibold"><dt>{amountLabel}</dt><dd>{settlementMoney(batch.netAmount, batch.currency)}</dd></div>
          </dl>
        </Card>
        <Card className="min-w-0 p-3 sm:p-4">
          <h3 className="mb-3 font-semibold">Kết quả chi trả</h3>
          <SettlementBadge batch={batch} />
          {paid && <dl className="mt-3 grid gap-2 text-sm">
            {batch.paidAt && <div><dt className="text-slate-500">Thời điểm chuyển tiền</dt><dd><time dateTime={batch.paidAt}>{dateTime(batch.paidAt)}</time></dd></div>}
            {batch.transferReference && <div><dt className="text-slate-500">Mã giao dịch</dt><dd className="font-mono wrap-anywhere">{batch.transferReference}</dd></div>}
          </dl>}
          {batch.failureReason && !simulated && <p className="mt-2 text-sm text-red-800">{batch.failureReason}</p>}
        </Card>
      </div>,
    },
    {
      id: 'bookings', label: `Đơn đặt phòng (${batch.bookingCount})`, content: <Card className="p-3 sm:p-4">
        {batch.items.length ? <DialogList label="Trang đơn đặt phòng trong kỳ" pageSize={4} items={batch.items.map(item => <li key={item.id} className="py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <strong className="wrap-anywhere">{item.bookingCodeSnapshot}</strong><span className="text-slate-500">Trả phòng {day(item.checkOutDateSnapshot)}</span>
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <div className="flex gap-1"><dt>Đã thu</dt><dd>{settlementMoney(item.grossAmount, item.currencySnapshot)}</dd></div>
            <div className="flex gap-1"><dt>Hoa hồng</dt><dd>{settlementMoney(item.commissionAmount, item.currencySnapshot)}</dd></div>
            <div className="flex gap-1 font-semibold"><dt>Sau hoa hồng</dt><dd>{settlementMoney(item.netAmount, item.currencySnapshot)}</dd></div>
          </dl>
        </li>)} /> : <p className="text-sm text-slate-500">Chưa có đơn đặt phòng trong kỳ này.</p>}
      </Card>,
    },
    {
      id: 'history', label: 'Lịch sử', content: <Card className="p-3 sm:p-4">
        {batch.events.length ? <DialogList label="Trang lịch sử đối soát" pageSize={4} items={batch.events.map(event => <li key={event.id} className="py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <strong>{settlementEventLabel(event.toStatus, simulated)}</strong>
            <time dateTime={event.createdAt} className="text-xs text-slate-500">{dateTime(event.createdAt)}</time>
          </div>
          {event.note && !simulated && <p className="mt-1 whitespace-pre-wrap wrap-anywhere text-slate-600">{event.note}</p>}
        </li>)} /> : <p className="text-sm text-slate-500">Chưa có lịch sử xử lý.</p>}
      </Card>,
    },
  ]} />
}
