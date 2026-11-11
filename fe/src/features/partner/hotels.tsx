import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { HotelDocumentType, PartnerHotel, PartnerHotelInput, PartnerHotelQuery, PartnerHotelStatus } from '@/types/domain'

const statusLabel: Record<PartnerHotelStatus, string> = {
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm đình chỉ',
}
const documentLabel: Record<HotelDocumentType, string> = {
  BUSINESS_LICENSE: 'Giấy phép kinh doanh', HOTEL_LICENSE: 'Giấy phép hoạt động khách sạn',
  OWNERSHIP_DOCUMENT: 'Giấy tờ sở hữu', TAX_DOCUMENT: 'Chứng từ thuế', OTHER: 'Khác',
}
const sortFields: PartnerHotelQuery['sortBy'][] = ['createdAt', 'name', 'status']
const emptyHotel: PartnerHotelInput = { name: '', legalName: '', taxCode: '', description: '', address: '', phoneNumber: '', email: '', starRating: null, checkInTime: '14:00', checkOutTime: '12:00' }

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
function hotelInput(hotel?: PartnerHotel): PartnerHotelInput {
  if (!hotel) return { ...emptyHotel }
  return { placeId: hotel.placeId, name: hotel.name, legalName: hotel.legalName, taxCode: hotel.taxCode, description: hotel.description, address: hotel.address, phoneNumber: hotel.phoneNumber, email: hotel.email, starRating: hotel.starRating, checkInTime: hotel.checkInTime.slice(0, 5), checkOutTime: hotel.checkOutTime.slice(0, 5) }
}

export function PartnerHotelsPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => readQuery(params), [params])
  const hotels = useQuery({ queryKey: ['partner-hotels', query], queryFn: () => api.myHotels(query) })
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
    <PageHeader title="Khách sạn của tôi" description="Tạo hồ sơ, bổ sung giấy tờ và theo dõi tiến trình xét duyệt." actions={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Thêm khách sạn</Link></Button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <FormField label="Tên hoặc địa chỉ"><input value={params.get('q') ?? ''} onChange={event => setFilter('q', event.target.value)} placeholder="Tìm khách sạn" /></FormField>
      <FormField label="Trạng thái"><select value={params.get('status') ?? ''} onChange={event => setFilter('status', event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></FormField>
      <FormField label="Sắp xếp"><span className="relative block"><ArrowDownUp className="absolute left-3 top-3 text-slate-400" size={16} /><select className="!pl-9" value={`${query.sortBy}:${query.sortOrder}`} onChange={event => { const [field, order] = event.target.value.split(':'); const next = new URLSearchParams(params); next.set('sortBy', field ?? 'createdAt'); next.set('sortOrder', order ?? 'DESC'); next.delete('page'); setParams(next, { replace: true }) }}>{sortFields.map(field => <option key={field} value={`${field}:${query.sortOrder}`}>{({ createdAt: 'Ngày tạo', name: 'Tên khách sạn', status: 'Trạng thái' })[field]} · {query.sortOrder === 'DESC' ? 'giảm dần' : 'tăng dần'}</option>)}</select><button type="button" className="absolute right-3 top-2.5 text-xs font-semibold text-[#1E3A5F]" aria-label="Đổi chiều sắp xếp" onClick={() => setFilter('sortOrder', query.sortOrder === 'DESC' ? 'ASC' : 'DESC', false)}>Đổi chiều</button></span></FormField>
    </div>
    {data?.data.length ? <>
      <Card className="table-scroll"><table><thead><tr><th>Khách sạn</th><th>Địa chỉ</th><th>Trạng thái</th><th>Gửi duyệt</th><th>Phản hồi</th><th>Thao tác</th></tr></thead><tbody>{data.data.map(hotel => <tr key={hotel.id}>
        <td className="font-semibold">{hotel.name}<span className="block text-xs font-normal text-slate-500">MST: {hotel.taxCode}</span></td><td>{hotel.address}</td><td><StatusBadge status={hotel.status} /><span className="sr-only">{statusLabel[hotel.status]}</span></td><td>{hotel.submittedAt ? day(hotel.submittedAt.slice(0, 10)) : 'Chưa gửi'}</td><td className="max-w-xs whitespace-normal text-sm">{hotel.rejectionReason || (hotel.reviewedAt ? `Cập nhật ${day(hotel.reviewedAt.slice(0, 10))}` : 'Chưa có phản hồi')}</td><td><Button asChild variant="secondary" size="sm"><Link to={`/partner/hotels/${hotel.id}/edit`}>Chi tiết / chỉnh sửa</Link></Button></td>
      </tr>)}</tbody></table></Card>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.meta.total} khách sạn · Trang {query.page}/{pageCount}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={query.page <= 1} onClick={() => setFilter('page', String(query.page - 1), false)}>Trước</Button><Button size="sm" variant="secondary" disabled={query.page >= pageCount} onClick={() => setFilter('page', String(query.page + 1), false)}>Sau</Button></div></div>
    </> : <EmptyState title="Chưa có khách sạn phù hợp" description="Tạo hồ sơ khách sạn để bắt đầu quy trình xét duyệt." action={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Tạo hồ sơ khách sạn</Link></Button>} />}
  </div>
}

export function PartnerHotelFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id
  const hotelQuery = useQuery({ queryKey: ['partner-hotel', id], queryFn: () => api.myHotel(id!), enabled: Boolean(id) })
  const hotel = hotelQuery.data
  const [draft, setDraft] = useState<PartnerHotelInput | null>(null)
  const form = draft ?? hotelInput(hotel)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [documentType, setDocumentType] = useState<HotelDocumentType>('BUSINESS_LICENSE')
  const [documentNumber, setDocumentNumber] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [documentBusy, setDocumentBusy] = useState(false)

  const status = hotel?.status ?? 'DRAFT'
  const isLocked = status === 'PENDING_APPROVAL'
  const canEditLegal = status !== 'ACTIVE'
  const canEditDocuments = status === 'DRAFT' || status === 'REJECTED'
  const canSubmit = status === 'DRAFT' || status === 'REJECTED'
  const hasValidBusinessLicense = hotel?.documents.some(doc => doc.documentType === 'BUSINESS_LICENSE' && (!doc.expiresAt || doc.expiresAt >= new Date().toISOString().slice(0, 10))) ?? false

  const updateField = <K extends keyof PartnerHotelInput>(key: K, value: PartnerHotelInput[K]) => setDraft(current => ({ ...(current ?? form), [key]: value }))
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const payload: PartnerHotelInput = { ...form, placeId: form.placeId || null, description: form.description?.trim() || null, starRating: form.starRating || null, checkInTime: form.checkInTime?.slice(0, 5) ?? '14:00', checkOutTime: form.checkOutTime?.slice(0, 5) ?? '12:00' }
    try {
      if (isNew) {
        const created = await api.createHotel(payload)
        await queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })
        navigate(`/partner/hotels/${created.id}/edit`, { replace: true })
      } else {
        const updatePayload = hotel?.status === 'ACTIVE'
          ? { placeId: payload.placeId, name: payload.name, description: payload.description, address: payload.address, phoneNumber: payload.phoneNumber, email: payload.email, starRating: payload.starRating, checkInTime: payload.checkInTime, checkOutTime: payload.checkOutTime }
          : payload
        await api.updateHotel(id!, updatePayload)
        setDraft(null); setMessage('Đã lưu hồ sơ khách sạn.')
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['partner-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })])
      }
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  const addDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!id) return
    setDocumentBusy(true); setError(''); setMessage('')
    try {
      await api.addHotelDocument(id, { documentType, documentNumber, fileUrl, issuedAt: issuedAt || null, expiresAt: expiresAt || null })
      setDocumentNumber(''); setFileUrl(''); setIssuedAt(''); setExpiresAt(''); setMessage('Đã thêm giấy tờ.')
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['partner-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })])
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setDocumentBusy(false) }
  }
  const deleteDocument = async (documentId: string) => {
    if (!id) return
    setError(''); setMessage('')
    try {
      await api.deleteHotelDocument(id, documentId)
      setMessage('Đã xóa giấy tờ.')
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['partner-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })])
    } catch (cause) { setError(errorMessage(cause)) }
  }
  const submit = async () => {
    if (!id) return
    setSaving(true); setError('')
    try {
      await api.submitHotel(id); setSubmitOpen(false); setMessage('Đã gửi hồ sơ để xét duyệt.')
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['partner-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })])
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }

  if (hotelQuery.isPending && !isNew) return <LoadingState />
  if (hotelQuery.isError && !isNew) return <ErrorState message={errorMessage(hotelQuery.error)} retry={() => { void hotelQuery.refetch() }} />
  return <div>
    <Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to="/partner/hotels">← Danh sách khách sạn</Link>
    <div className="mt-5"><PageHeader title={isNew ? 'Tạo hồ sơ khách sạn' : hotel?.name ?? 'Hồ sơ khách sạn'} description="Thông tin pháp lý và liên hệ dùng cho quá trình xét duyệt khách sạn." actions={hotel && <StatusBadge status={hotel.status} />} /></div>
    {isNew && <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Tài khoản cần được quản trị viên cấp hồ sơ chủ khách sạn trước khi tạo hồ sơ khách sạn.</p>}
    {!isNew && hotel && <Card className="mb-5 p-5"><h2 className="font-semibold">Tiến trình xét duyệt</h2><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><Summary label="Trạng thái" value={statusLabel[hotel.status]} /><Summary label="Gửi duyệt lúc" value={hotel.submittedAt ? day(hotel.submittedAt.slice(0, 10)) : 'Chưa gửi'} /><Summary label="Cập nhật xét duyệt" value={hotel.reviewedAt ? day(hotel.reviewedAt.slice(0, 10)) : 'Chưa có'} /></div>{hotel.rejectionReason && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Lý do từ chối:</strong> {hotel.rejectionReason}</p>}{isLocked && <p className="mt-3 text-sm text-slate-500">Hồ sơ đang chờ duyệt nên thông tin và giấy tờ tạm khóa.</p>}</Card>}

    <Card className="max-w-4xl p-6"><h2 className="mb-4 text-lg font-semibold">Thông tin khách sạn</h2><form className="grid gap-4" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2"><FormField label="Tên khách sạn"><input required maxLength={200} disabled={isLocked} value={form.name} onChange={event => updateField('name', event.target.value)} /></FormField><FormField label="Tên pháp lý"><input required maxLength={200} disabled={isLocked || !canEditLegal} value={form.legalName} onChange={event => updateField('legalName', event.target.value)} /></FormField><FormField label="Mã số thuế"><input required maxLength={50} disabled={isLocked || !canEditLegal} value={form.taxCode} onChange={event => updateField('taxCode', event.target.value)} /></FormField><FormField label="Email liên hệ"><input type="email" required maxLength={254} disabled={isLocked} value={form.email} onChange={event => updateField('email', event.target.value)} /></FormField><FormField label="Số điện thoại"><input required type="tel" pattern="\+?[0-9][0-9 .()\-]{6,28}" disabled={isLocked} value={form.phoneNumber} onChange={event => updateField('phoneNumber', event.target.value)} /></FormField><FormField label="Hạng sao"><select disabled={isLocked} value={form.starRating ?? ''} onChange={event => updateField('starRating', event.target.value ? Number(event.target.value) : null)}><option value="">Chưa xếp hạng</option>{[1, 2, 3, 4, 5].map(stars => <option key={stars} value={stars}>{stars} sao</option>)}</select></FormField><FormField label="Giờ nhận phòng"><input type="time" required disabled={isLocked} value={form.checkInTime} onChange={event => updateField('checkInTime', event.target.value)} /></FormField><FormField label="Giờ trả phòng"><input type="time" required disabled={isLocked} value={form.checkOutTime} onChange={event => updateField('checkOutTime', event.target.value)} /></FormField></div>
      <FormField label="Địa chỉ"><input required maxLength={500} disabled={isLocked} value={form.address} onChange={event => updateField('address', event.target.value)} /></FormField><FormField label="Mô tả"><textarea maxLength={5000} disabled={isLocked} value={form.description ?? ''} onChange={event => updateField('description', event.target.value)} /></FormField>
      {status === 'ACTIVE' && <p className="text-xs text-slate-500">Backend khóa tên pháp lý và mã số thuế khi khách sạn đang hoạt động.</p>}
      <Feedback message={error} kind="error" /><Feedback message={message} />
      <div className="flex flex-wrap gap-2"><Button disabled={saving || isLocked}>{saving ? 'Đang lưu...' : isNew ? 'Tạo hồ sơ nháp' : 'Lưu thay đổi'}</Button><Button asChild type="button" variant="secondary"><Link to="/partner/hotels">Quay lại danh sách</Link></Button>{hotel && canSubmit && <Button type="button" variant="secondary" disabled={!hasValidBusinessLicense} onClick={() => setSubmitOpen(true)}>Gửi xét duyệt</Button>}</div>
      {hotel && canSubmit && !hasValidBusinessLicense && <p className="text-xs text-amber-800">Cần thêm giấy phép kinh doanh còn hiệu lực trước khi gửi duyệt.</p>}
    </form></Card>

    {!isNew && hotel && <Card className="mt-5 max-w-4xl p-6"><h2 className="text-lg font-semibold">Giấy tờ pháp lý</h2>
      {hotel.documents.length ? <div className="mt-4 grid gap-3">{hotel.documents.map(document => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div className="min-w-0"><p className="font-medium">{documentLabel[document.documentType]} · {document.documentNumber}</p><a className="break-all text-sm text-[#1E3A5F] underline" href={document.fileUrl} target="_blank" rel="noreferrer">Mở giấy tờ</a><p className="mt-1 text-xs text-slate-500">Cấp: {document.issuedAt ? day(document.issuedAt) : '—'} · Hết hạn: {document.expiresAt ? day(document.expiresAt) : 'Không thời hạn'}</p></div>{canEditDocuments && <Button size="sm" variant="danger" aria-label={`Xóa ${documentLabel[document.documentType]}`} onClick={() => { void deleteDocument(document.id) }}><Trash2 size={15} />Xóa</Button>}</div>)}</div> : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có giấy tờ được khai báo.</p>}
      {canEditDocuments && <form className="mt-5 grid gap-4 border-t border-slate-200 pt-5" onSubmit={addDocument}><h3 className="font-semibold">Thêm giấy tờ</h3><div className="grid gap-4 sm:grid-cols-2"><FormField label="Loại giấy tờ"><select value={documentType} onChange={event => setDocumentType(event.target.value as HotelDocumentType)}>{Object.entries(documentLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField><FormField label="Số giấy tờ"><input required maxLength={100} value={documentNumber} onChange={event => setDocumentNumber(event.target.value)} /></FormField><FormField label="URL giấy tờ"><input required type="url" maxLength={2048} value={fileUrl} onChange={event => setFileUrl(event.target.value)} placeholder="https://..." /></FormField><FormField label="Ngày cấp"><input type="date" value={issuedAt} onChange={event => setIssuedAt(event.target.value)} /></FormField><FormField label="Ngày hết hạn"><input type="date" min={issuedAt || undefined} value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></FormField></div><Button className="w-fit" disabled={documentBusy}>{documentBusy ? 'Đang thêm...' : 'Thêm giấy tờ'}</Button></form>}
    </Card>}

    <Dialog open={submitOpen} onOpenChange={setSubmitOpen}><DialogContent title="Gửi hồ sơ xét duyệt?" description="Sau khi gửi, bạn sẽ không thể chỉnh sửa hồ sơ hoặc giấy tờ cho đến khi có kết quả."><p className="text-sm text-slate-600">Hãy kiểm tra thông tin và giấy phép kinh doanh trước khi gửi.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setSubmitOpen(false)}>Kiểm tra lại</Button><Button disabled={saving} onClick={() => { void submit() }}>{saving ? 'Đang gửi...' : 'Xác nhận gửi'}</Button></div></DialogContent></Dialog>
  </div>
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-slate-500">{label}</p><p className="mt-1 font-medium">{value}</p></div> }

