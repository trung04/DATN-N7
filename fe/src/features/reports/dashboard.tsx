import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, EmptyState, ErrorState, FormField, LoadingState, PageHeader } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { PartnerHotelQuery, ReportGroupBy, ReportQuery } from '@/types/domain'

const hotelsQuery: PartnerHotelQuery = { page: 1, limit: 100, sortBy: 'name', sortOrder: 'ASC' }
const groups: Array<[ReportGroupBy, string]> = [['day', 'Theo ngày'], ['week', 'Theo tuần'], ['month', 'Theo tháng']]
const bookingStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const
const statusNames: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', COMPLETED: 'Hoàn tất' }

function localDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function money(value: number, currency: string): string {
  try { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
  catch { return `${value.toLocaleString('vi-VN')} ${currency}` }
}

export function ReportDashboardPage({ admin = false }: { admin?: boolean }) {
  const [params, setParams] = useSearchParams()
  const hotels = useQuery({
    queryKey: [admin ? 'admin' : 'partner', 'report-hotels'],
    queryFn: () => admin ? api.adminHotels(hotelsQuery) : api.myHotels(hotelsQuery),
  })
  const now = new Date()
  const from = params.get('from') ?? localDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = params.get('to') ?? localDate(now)
  const selectedHotelId = params.get('hotelId') ?? (admin ? '' : hotels.data?.data[0]?.id ?? '')
  const groupBy = (params.get('groupBy') as ReportGroupBy | null) ?? 'day'
  const validRange = from <= to
  const query = useMemo<ReportQuery>(() => ({
    from, to, groupBy,
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
  }), [from, to, groupBy, selectedHotelId])
  const enabled = validRange && (admin || Boolean(selectedHotelId))
  const summary = useQuery({ queryKey: ['reports-summary', admin, query], queryFn: () => api.reportSummary(query), enabled })
  const timeseries = useQuery({ queryKey: ['reports-timeseries', admin, query], queryFn: () => api.reportTimeseries(query), enabled })

  const changeParams = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }

  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (!admin && hotels.data.data.length === 0) return <EmptyState title="Bạn chưa có khách sạn" description="Tạo hồ sơ khách sạn để xem báo cáo đặt phòng và thanh toán." />
  if (!validRange) return <div><PageHeader title={admin ? 'Báo cáo hệ thống' : 'Báo cáo khách sạn'} /><p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p></div>
  if (summary.isPending || timeseries.isPending) return <LoadingState />
  if (summary.isError) return <ErrorState message={errorMessage(summary.error)} retry={() => { void summary.refetch() }} />
  if (timeseries.isError) return <ErrorState message={errorMessage(timeseries.error)} retry={() => { void timeseries.refetch() }} />

  const hotelRows = summary.data.hotels
  const currencyRows = summary.data.financialByCurrency
  const trendCurrencies = [...new Set(timeseries.data.financialTrend.map(point => point.currency))]
  const financialByCurrency = (currency: string) => {
    return timeseries.data.financialTrend.filter(point => point.currency === currency).map(point => ({
      period: point.period,
      paidAmount: point.paidAmount,
      refundAmount: point.refundAmount,
      partnerReceivableAmount: point.partnerReceivableAmount,
    }))
  }

  return <div>
    <PageHeader title={admin ? 'Báo cáo hệ thống' : 'Báo cáo khách sạn'} description={admin ? 'Theo dõi đặt phòng, thanh toán, hoàn tiền và đối soát trên toàn hệ thống.' : 'Theo dõi đặt phòng, doanh thu và khoản đối soát của khách sạn bạn quản lý.'} />
    <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Từ ngày"><input type="date" value={from} onChange={event => changeParams({ from: event.target.value || undefined })} /></FormField>
      <FormField label="Đến ngày"><input type="date" value={to} onChange={event => changeParams({ to: event.target.value || undefined })} /></FormField>
      <FormField label="Khách sạn"><select value={selectedHotelId} onChange={event => changeParams({ hotelId: event.target.value || undefined })}><option value="">{admin ? 'Toàn hệ thống' : 'Chọn khách sạn'}</option>{hotels.data.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
      <FormField label="Nhóm biểu đồ"><select value={groupBy} onChange={event => changeParams({ groupBy: event.target.value })}>{groups.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
    </Card>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Booking được tạo" value={summary.data.bookingCount.toLocaleString('vi-VN')} />
      {bookingStatuses.map(status => <Metric key={status} label={statusNames[status] ?? status} value={(summary.data.bookingStatusCounts[status] ?? 0).toLocaleString('vi-VN')} />)}
    </div>

    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">Tổng hợp tài chính theo tiền tệ</h2>
      {currencyRows.length ? <div className="grid gap-4 xl:grid-cols-2">{currencyRows.map(item => <Card key={item.currency} className="p-5">
        <h3 className="mb-4 font-semibold">{item.currency}</h3>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Value label={`Đã thanh toán · ${item.paidBookingCount} booking`} value={money(item.paidAmount, item.currency)} />
          <Value label={`Đã thu, chờ đối soát · ${item.pendingSettlementBookingCount} booking`} value={money(item.pendingSettlementAmount, item.currency)} />
          <Value label={`Đã hoàn · ${item.refundedBookingCount} booking`} value={money(item.refundAmount, item.currency)} />
          <Value label="Giá trị đã đối soát" value={money(item.settlementBaseAmount, item.currency)} />
          <Value label="Hoa hồng" value={money(item.commissionAmount, item.currency)} />
          <Value label="Đã trả chủ khách sạn" value={money(item.partnerReceivableAmount, item.currency)} />
        </dl>
      </Card>)}</div> : <Card className="p-5 text-sm text-slate-500">Chưa có thanh toán, hoàn tiền hoặc đối soát trong khoảng thời gian này.</Card>}
    </section>

    <div className="mb-6 grid gap-5 xl:grid-cols-2">
      <Card className="p-5"><h2 className="mb-4 font-semibold">Số booking theo thời gian</h2>{timeseries.data.bookingTrend.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeseries.data.bookingTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="bookingCount" name="Booking" fill="#1E3A5F" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-slate-500">Chưa có booking trong khoảng thời gian này.</p>}</Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Dòng tiền theo thời gian</h2>{trendCurrencies.length ? <div className="grid gap-5">{trendCurrencies.map(currency => <div key={currency}><h3 className="mb-2 text-sm font-medium">{currency}</h3><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={financialByCurrency(currency)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => money(Number(value), currency)} /><Legend /><Bar dataKey="paidAmount" name="Đã thu" fill="#1E3A5F" /><Bar dataKey="refundAmount" name="Đã hoàn" fill="#DC6B55" /><Bar dataKey="partnerReceivableAmount" name="Đã trả chủ KS" fill="#3D9970" /></BarChart></ResponsiveContainer></div></div>)}</div> : <p className="py-12 text-center text-sm text-slate-500">Chưa có dữ liệu tài chính trong khoảng thời gian này.</p>}</Card>
    </div>

    <Card className="table-scroll p-5"><h2 className="mb-4 font-semibold">Tổng hợp theo khách sạn và tiền tệ</h2>{hotelRows.length ? <table><thead><tr><th>Khách sạn</th><th>Tiền tệ</th><th>Booking tạo</th><th>Đã thanh toán</th><th>Chờ đối soát</th><th>Đã hoàn</th><th>Đã trả chủ KS</th></tr></thead><tbody>{hotelRows.map(row => <tr key={`${row.hotelId}-${row.currency}`}><td>{row.hotelName}</td><td>{row.currency}</td><td>{row.bookingCount}</td><td>{money(row.paidAmount, row.currency)}</td><td>{money(row.pendingSettlementAmount, row.currency)}</td><td>{money(row.refundAmount, row.currency)}</td><td>{money(row.partnerReceivableAmount, row.currency)}</td></tr>)}</tbody></table> : <EmptyState title="Chưa có dữ liệu" description="Không có booking thuộc bộ lọc đã chọn." />}</Card>
  </div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-[#1E3A5F]">{value}</p></Card>
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>
}
