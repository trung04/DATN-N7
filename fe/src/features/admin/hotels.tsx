import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { AdminHotelReviewAction, AdminHotelReviewCommand, PartnerHotel, PartnerHotelQuery, PartnerHotelStatus } from '@/types/domain'

const statusLabel: Record<PartnerHotelStatus, string> = {
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm đình chỉ',
}
const actionLabel: Record<AdminHotelReviewAction, string> = {
  SUBMITTED: 'Đã gửi xét duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
  SUSPENDED: 'Tạm đình chỉ', REACTIVATED: 'Đã kích hoạt lại', DEACTIVATED: 'Chủ khách sạn đã ngừng hoạt động',
}
const sortFields: PartnerHotelQuery['sortBy'][] = ['createdAt', 'name', 'status']
const commands: Record<AdminHotelReviewCommand, { label: string; variant: 'default' | 'secondary' | 'danger'; reasonRequired: boolean }> = {
  APPROVE: { label: 'Duyệt khách sạn', variant: 'default', reasonRequired: false },
  REJECT: { label: 'Từ chối hồ sơ', variant: 'danger', reasonRequired: true },
  SUSPEND: { label: 'Tạm đình chỉ', variant: 'danger', reasonRequired: true },
  REACTIVATE: { label: 'Kích hoạt lại', variant: 'default', reasonRequired: false },
}

function readQuery(params: URLSearchParams): PartnerHotelQuery {
  const status = params.get('status') as PartnerHotelStatus | null
  const sortBy = params.get('sortBy') as PartnerHotelQuery['sortBy'] | null
  const query: PartnerHotelQuery = {
    page: Math.max(1, Number(params.get('page')) || 1), limit: 20,
    sortBy: sortFields.includes(sortBy as PartnerHotelQuery['sortBy']) ? sortBy as PartnerHotelQuery['sortBy'] : 'createdAt',
    sortOrder: params.get('sortOrder') === 'ASC' ? 'ASC' : 'DESC',
  }
  const search = params.get('q')?.trim()
  if (search) query.search = search
  if (status && Object.hasOwn(statusLabel, status)) query.status = status
  return query
}

export function AdminHotelsPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => readQuery(params), [params])
  const hotels = useQuery({ queryKey: ['admin-hotels', query], queryFn: () => api.adminHotels(query) })
  const data = hotels.data
  const pageCount = Math.max(1, Math.ceil((data?.meta.total ?? 0) / query.limit))
  const setFilter = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }
  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  return <div>
    <PageHeader title="Duyệt khách sạn" description="Xem hồ sơ do chủ khách sạn gửi, kiểm tra giấy tờ và cập nhật trạng thái xét duyệt." />
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><FormField label="Tên, mã số thuế hoặc địa chỉ"><input value={params.get('q') ?? ''} onChange={event => setFilter('q', event.target.value)} placeholder="Tìm khách sạn" /></FormField><FormField label="Trạng thái"><select value={params.get('status') ?? ''} onChange={event => setFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></FormField><FormField label="Sắp xếp"><span className="relative block"><ArrowDownUp className="absolute left-3 top-3 text-slate-400" size={16} /><select className="!pl-9" value={`${query.sortBy}:${query.sortOrder}`} onChange={event => { const [field, order] = event.target.value.split(':'); const next = new URLSearchParams(params); next.set('sortBy', field ?? 'createdAt'); next.set('sortOrder', order ?? 'DESC'); next.delete('page'); setParams(next, { replace: true }) }}>{sortFields.map(field => <option key={field} value={`${field}:${query.sortOrder}`}>{({ createdAt: 'Ngày tạo', name: 'Tên khách sạn', status: 'Trạng thái' })[field]} · {query.sortOrder === 'DESC' ? 'giảm dần' : 'tăng dần'}</option>)}</select><button type="button" className="absolute right-3 top-2.5 text-xs font-semibold text-[#1E3A5F]" aria-label="Đổi chiều sắp xếp" onClick={() => setFilter('sortOrder', query.sortOrder === 'DESC' ? 'ASC' : 'DESC', false)}>Đổi chiều</button></span></FormField></div>
    {data?.data.length ? <><Card className="table-scroll"><table><thead><tr><th>Khách sạn</th><th>Chủ khách sạn</th><th>Địa chỉ</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>{data.data.map(hotel => <tr key={hotel.id}><td className="font-semibold">{hotel.name}<span className="block text-xs font-normal text-slate-500">MST: {hotel.taxCode}</span></td><td>{hotel.ownerUserId}</td><td>{hotel.address}</td><td><StatusBadge status={hotel.status} /><span className="sr-only">{statusLabel[hotel.status]}</span></td><td>{hotel.submittedAt ? day(hotel.submittedAt.slice(0, 10)) : 'Chưa gửi'}</td><td><Button asChild size="sm" variant="secondary"><Link to={`/admin/hotels/${hotel.id}`}>Xem hồ sơ</Link></Button></td></tr>)}</tbody></table></Card><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.meta.total} khách sạn · Trang {query.page}/{pageCount}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={query.page <= 1} onClick={() => setFilter('page', String(query.page - 1), false)}>Trước</Button><Button size="sm" variant="secondary" disabled={query.page >= pageCount} onClick={() => setFilter('page', String(query.page + 1), false)}>Sau</Button></div></div></> : <EmptyState title="Không có khách sạn phù hợp" description="Thử thay đổi tìm kiếm hoặc bộ lọc trạng thái." />}
  </div>
}

export function AdminHotelDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const hotelQuery = useQuery({ queryKey: ['admin-hotel', id], queryFn: () => api.adminHotel(id), enabled: Boolean(id) })
  const historyQuery = useQuery({ queryKey: ['admin-hotel-history', id], queryFn: () => api.adminHotelReviewHistory(id), enabled: Boolean(id) })
  const [command, setCommand] = useState<AdminHotelReviewCommand | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const hotel = hotelQuery.data
  const actions = hotel ? availableActions(hotel) : []
  const selected = command ? commands[command] : null

  const openAction = (next: AdminHotelReviewCommand) => { setCommand(next); setReason(''); setError(''); setMessage('') }
  const closeDialog = (open: boolean) => { if (!open && !saving) setCommand(null) }
  const review = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!command || !hotel) return
    if (selected?.reasonRequired && !reason.trim()) { setError('Nhập lý do để tiếp tục.'); return }
    setSaving(true); setError('')
    try {
      await api.reviewHotel(hotel.id, command, reason.trim() || undefined)
      setMessage('Đã cập nhật trạng thái xét duyệt.')
      setCommand(null)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-hotels'] }), queryClient.invalidateQueries({ queryKey: ['admin-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['admin-hotel-history', id] })])
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  if (hotelQuery.isPending) return <LoadingState />
  if (hotelQuery.isError) return <ErrorState message={errorMessage(hotelQuery.error)} retry={() => { void hotelQuery.refetch() }} />
  if (!hotel) return <EmptyState title="Không tìm thấy khách sạn" />
  const businessLicense = hotel.documents.find(document => document.documentType === 'BUSINESS_LICENSE')
  const licenseExpired = Boolean(businessLicense?.expiresAt && businessLicense.expiresAt < new Date().toISOString().slice(0, 10))

  return <div>
    <Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to="/admin/hotels">← Danh sách khách sạn</Link>
    <div className="mt-5"><PageHeader title={hotel.name} description={`${hotel.legalName} · MST ${hotel.taxCode}`} actions={<StatusBadge status={hotel.status} />} /></div>
    {message && <div className="mb-4"><Feedback message={message} /></div>}
    {hotel.rejectionReason && <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Lý do từ chối gần nhất:</strong> {hotel.rejectionReason}</p>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Thông tin khách sạn</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Info label="Tên hiển thị" value={hotel.name} /><Info label="Tên pháp lý" value={hotel.legalName} /><Info label="Mã số thuế" value={hotel.taxCode} /><Info label="Chủ sở hữu (user ID)" value={hotel.ownerUserId} /><Info label="Email liên hệ" value={hotel.email} /><Info label="Điện thoại" value={hotel.phoneNumber} /><Info label="Địa chỉ" value={hotel.address} /><Info label="Hạng sao" value={hotel.starRating ? `${hotel.starRating} sao` : 'Chưa xếp hạng'} /><Info label="Giờ nhận phòng" value={hotel.checkInTime.slice(0, 5)} /><Info label="Giờ trả phòng" value={hotel.checkOutTime.slice(0, 5)} /><Info label="Ngày gửi xét duyệt" value={hotel.submittedAt ? day(hotel.submittedAt.slice(0, 10)) : 'Chưa gửi'} /><Info label="Ngày cập nhật xét duyệt" value={hotel.reviewedAt ? day(hotel.reviewedAt.slice(0, 10)) : 'Chưa có'} /></dl>{hotel.description && <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-sm font-semibold">Mô tả</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{hotel.description}</p></div>}</Card>

      <Card className="p-6"><h2 className="text-lg font-semibold">Giấy tờ pháp lý</h2>{businessLicense && <p className={`mt-3 rounded-lg p-3 text-sm ${licenseExpired ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{licenseExpired ? 'Giấy phép kinh doanh đã hết hạn.' : 'Đã có giấy phép kinh doanh còn hiệu lực.'}</p>}{hotel.documents.length ? <div className="mt-4 grid gap-3">{hotel.documents.map(document => <div key={document.id} className="rounded-lg border border-slate-200 p-4"><p className="font-semibold">{documentTypeLabel(document.documentType)} · {document.documentNumber}</p><a className="mt-2 block break-all text-sm text-[#1E3A5F] underline" href={document.fileUrl} target="_blank" rel="noreferrer">Mở giấy tờ</a><p className="mt-2 text-xs text-slate-500">Cấp: {document.issuedAt ? day(document.issuedAt) : '—'} · Hết hạn: {document.expiresAt ? day(document.expiresAt) : 'Không thời hạn'}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">Chưa có giấy tờ.</p>}</Card></div>

      <div className="grid gap-5"><Card className="p-6"><h2 className="text-lg font-semibold">Xử lý hồ sơ</h2><p className="mt-2 text-sm text-slate-500">Thao tác khả dụng phụ thuộc trạng thái hiện tại.</p><div className="mt-4 grid gap-2">{actions.length ? actions.map(action => <Button key={action} variant={commands[action].variant} onClick={() => openAction(action)}>{commands[action].label}</Button>) : <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Không có thao tác xét duyệt cho trạng thái này.</p>}</div></Card>

      <Card className="p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Lịch sử xét duyệt</h2>{historyQuery.isFetching && <span className="text-xs text-slate-500">Đang tải…</span>}</div>{historyQuery.isError ? <div className="mt-3"><ErrorState message={errorMessage(historyQuery.error)} retry={() => { void historyQuery.refetch() }} /></div> : historyQuery.isPending ? <LoadingState /> : historyQuery.data?.length ? <ol className="mt-4 grid gap-4">{historyQuery.data.map(item => <li key={item.id} className="border-l-2 border-[#CBD5E1] pl-4"><p className="font-semibold">{actionLabel[item.action]}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</p>{item.reason && <p className="mt-2 text-sm text-slate-600">{item.reason}</p>}<p className="mt-1 text-xs text-slate-400">Người xử lý: {item.actorUserId}</p></li>)}</ol> : <p className="mt-3 text-sm text-slate-500">Chưa có lịch sử xét duyệt.</p>}</Card></div>
    </div>

    <Dialog open={Boolean(command)} onOpenChange={closeDialog}><DialogContent title={selected?.label ?? 'Xử lý hồ sơ'} description={`Khách sạn: ${hotel.name}`}><form className="grid gap-4" onSubmit={review}>{selected?.reasonRequired && <FormField label="Lý do" error={error}><textarea required maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nhập lý do để lưu vào lịch sử xét duyệt." /></FormField>}{!selected?.reasonRequired && <p className="text-sm text-slate-600">Xác nhận cập nhật trạng thái khách sạn?</p>}{error && !selected?.reasonRequired && <Feedback message={error} kind="error" />}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={() => closeDialog(false)}>Hủy</Button><Button disabled={saving}>{saving ? 'Đang xử lý...' : 'Xác nhận'}</Button></div></form></DialogContent></Dialog>
  </div>
}

function availableActions(hotel: PartnerHotel): AdminHotelReviewCommand[] {
  if (hotel.status === 'PENDING_APPROVAL') return ['APPROVE', 'REJECT']
  if (hotel.status === 'ACTIVE') return ['SUSPEND']
  if (hotel.status === 'SUSPENDED') return ['REACTIVATE']
  return []
}
function documentTypeLabel(type: string): string {
  return ({ BUSINESS_LICENSE: 'Giấy phép kinh doanh', HOTEL_LICENSE: 'Giấy phép khách sạn', OWNERSHIP_DOCUMENT: 'Giấy tờ sở hữu', TAX_DOCUMENT: 'Chứng từ thuế', OTHER: 'Khác' } as Record<string, string>)[type] ?? type
}
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div> }
