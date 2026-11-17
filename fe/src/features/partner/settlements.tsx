import { useQuery } from '@tanstack/react-query'
import { Banknote, CalendarDays, ReceiptText } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'

const money = (amount: number, currency: string) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} ${currency}`

export function PartnerSettlementsPage() {
  const query = useQuery({
    queryKey: ['partner-settlement-batches'],
    queryFn: () => api.partnerSettlementBatches(),
  })

  if (query.isPending) return <LoadingState />
  if (query.isError) return <ErrorState message={errorMessage(query.error)} retry={() => { void query.refetch() }} />

  const batches = query.data

  return <div>
    <PageHeader title="Đối soát và chi trả" description="Theo dõi bảng kê, khoản thực nhận và trạng thái xử lý của các booking tại khách sạn của bạn." />
    {batches.length === 0 ? <EmptyState title="Chưa có kỳ đối soát" description="Các kỳ đối soát sẽ xuất hiện ở đây sau khi hệ thống lập bảng kê booking đủ điều kiện." /> : <Card className="table-scroll">
      <table>
        <thead><tr><th>Khách sạn</th><th>Kỳ đối soát</th><th>Booking</th><th>Đã thu</th><th>Hoa hồng</th><th>Thực nhận</th><th>Trạng thái</th><th>Chi trả</th></tr></thead>
        <tbody>{batches.map(batch => <tr key={batch.id}>
          <td className="font-medium">{batch.hotelNameSnapshot}</td>
          <td><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" />{day(batch.periodStart)} – {day(batch.periodEnd)}</span></td>
          <td>{batch.bookingCount}</td>
          <td>{money(batch.grossAmount, batch.currency)}</td>
          <td>{money(batch.commissionAmount, batch.currency)}</td>
          <td className="font-semibold">{money(batch.netAmount, batch.currency)}</td>
          <td><StatusBadge status={batch.status} /></td>
          <td>{batch.transferMode === 'SEPAY_BANKHUB_SANDBOX'
            ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Banknote size={14} />SePay</span>
            : batch.transferMode === 'MANUAL' && batch.transferReference
              ? <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><ReceiptText size={14} />Đã ghi nhận thủ công</span>
              : <span className="text-sm text-slate-500">Chưa chi trả</span>}</td>
        </tr>)}</tbody>
      </table>
      {batches.map(batch => batch.events.length > 0 && <details key={`${batch.id}-events`} className="border-t border-slate-200 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-[#1E3A5F]">Lịch sử xử lý · {batch.hotelNameSnapshot} · {day(batch.periodStart)} – {day(batch.periodEnd)}</summary>
        <ol className="mt-3 space-y-2 pl-5">
          {batch.events.map(event => <li key={event.id} className="text-slate-600">
            <span className="font-medium text-slate-800">{event.toStatus}</span>
            {event.note && !/(sandbox|mô phỏng|giả lập|demo[- ]?seed|simulation)/i.test(event.note) && <span> — {event.note}</span>}
            {event.transferReference && <span className="ml-1 font-mono">({event.transferReference})</span>}
            <time className="ml-2 text-xs text-slate-400">{new Date(event.createdAt).toLocaleString('vi-VN')}</time>
          </li>)}
        </ol>
        {batch.providerTransferId && <p className="mt-3 break-all text-xs text-slate-500">Mã giao dịch nhà cung cấp: {batch.providerTransferId}</p>}
      </details>)}
    </Card>}
  </div>
}
