import { HotelDocuments } from '@/components/hotel-documents'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { readPage, readPageSize } from '@/lib/pagination'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { HotelImages } from '@/components/hotel-images'
import { HotelLocationPicker } from '@/components/hotel-location-picker'
import { hasValidCoordinates } from '@/lib/coordinates'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { PartnerHotel, PartnerHotelInput, PartnerHotelQuery, PartnerHotelStatus } from '@/types/domain'

const statusLabel: Record<PartnerHotelStatus, string> = {
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm đình chỉ',
}
const sortFields: PartnerHotelQuery['sortBy'][] = ['createdAt', 'name', 'status']
const emptyHotel: PartnerHotelInput = { latitude: null, longitude: null, name: '', legalName: '', taxCode: '', description: '', address: '', phoneNumber: '', email: '', starRating: null, checkInTime: '14:00', checkOutTime: '12:00' }

type HotelFilters = {
  search: string
  status: PartnerHotelStatus | ''
  sortBy: PartnerHotelQuery['sortBy']
  sortOrder: PartnerHotelQuery['sortOrder']
}

function readQuery(params: URLSearchParams): PartnerHotelQuery {
  const status = params.get('status') as PartnerHotelStatus | null
  const sortBy = params.get('sortBy') as PartnerHotelQuery['sortBy'] | null
  const query: PartnerHotelQuery = {
    page: readPage(params), limit: readPageSize(params),
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
  return { latitude: hotel.latitude ?? null, longitude: hotel.longitude ?? null, placeId: hotel.placeId, name: hotel.name, legalName: hotel.legalName, taxCode: hotel.taxCode, description: hotel.description, address: hotel.address, phoneNumber: hotel.phoneNumber, email: hotel.email, starRating: hotel.starRating, checkInTime: hotel.checkInTime.slice(0, 5), checkOutTime: hotel.checkOutTime.slice(0, 5) }
}

export function PartnerHotelsPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => readQuery(params), [params])
  const filterKey = JSON.stringify([query.search ?? '', query.status ?? '', query.sortBy, query.sortOrder])
  const [filterDraft, setFilterDraft] = useState<{ source: string; values: HotelFilters } | null>(null)
  const filters: HotelFilters = filterDraft?.source === filterKey ? filterDraft.values : {
    search: query.search ?? '', status: query.status ?? '', sortBy: query.sortBy, sortOrder: query.sortOrder,
  }
  const changeFilters = (values: Partial<HotelFilters>) => setFilterDraft({ source: filterKey, values: { ...filters, ...values } })
  const hotels = useQuery({ queryKey: ['partner-hotels', query], queryFn: () => api.myHotels(query) })
  const data = hotels.data
  const pagination = usePagination(data?.meta.total)
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams(params)
    const search = filters.search.trim()
    if (search) next.set('q', search); else next.delete('q')
    if (filters.status) next.set('status', filters.status); else next.delete('status')
    next.set('sortBy', filters.sortBy)
    next.set('sortOrder', filters.sortOrder)
    next.delete('page')
    setFilterDraft(null)
    setParams(next)
  }
  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  return <div>
    <PageHeader title="Khách sạn của tôi" description="Tạo hồ sơ, bổ sung giấy tờ và theo dõi tiến trình xét duyệt." actions={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Thêm khách sạn</Link></Button>} />
    <form aria-label="Tìm kiếm khách sạn" onSubmit={applyFilters} className="mb-5 grid items-end gap-3 sm:grid-cols-3 xl:grid-cols-[1fr_1fr_1.3fr_auto]">
      <FormField label="Tên hoặc địa chỉ"><input value={filters.search} onChange={event => changeFilters({ search: event.target.value })} placeholder="Tìm khách sạn" /></FormField>
      <FormField label="Trạng thái"><select value={filters.status} onChange={event => changeFilters({ status: event.target.value as HotelFilters['status'] })}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></FormField>
      <FormField label="Sắp xếp"><span className="flex items-center gap-2"><span className="relative min-w-0 flex-1"><ArrowDownUp className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} /><select className="!pl-9" value={filters.sortBy} onChange={event => changeFilters({ sortBy: event.target.value as HotelFilters['sortBy'] })}>{sortFields.map(field => <option key={field} value={field}>{({ createdAt: 'Ngày tạo', name: 'Tên khách sạn', status: 'Trạng thái' })[field]} · {filters.sortOrder === 'DESC' ? 'giảm dần' : 'tăng dần'}</option>)}</select></span><Button type="button" variant="secondary" className="shrink-0" aria-label="Đổi chiều sắp xếp" onClick={() => changeFilters({ sortOrder: filters.sortOrder === 'DESC' ? 'ASC' : 'DESC' })}>Đổi chiều</Button></span></FormField>
      <Button type="submit"><Search size={16} />Tìm kiếm</Button>
    </form>
    {data?.data.length ? <>
      <Card className="relative table-scroll"><table><thead><tr><th>Khách sạn</th><th>Địa chỉ</th><th>Trạng thái</th><th>Gửi duyệt</th><th>Phản hồi</th><th>Thao tác</th></tr></thead><tbody>{data.data.map(hotel => <tr key={hotel.id}>
        <td className="font-semibold">{hotel.name}<span className="block text-xs font-normal text-slate-500">MST: {hotel.taxCode}</span></td><td>{hotel.address}<span className="mt-1 block text-xs text-slate-500">{hasValidCoordinates(hotel.latitude, hotel.longitude) ? 'Đã có vị trí bản đồ' : 'Chưa đặt vị trí bản đồ'}</span></td><td><StatusBadge status={hotel.status} /><span className="sr-only">{statusLabel[hotel.status]}</span></td><td>{hotel.submittedAt ? day(hotel.submittedAt.slice(0, 10)) : 'Chưa gửi'}</td><td className="max-w-xs whitespace-normal text-sm">{hotel.rejectionReason || (hotel.reviewedAt ? `Cập nhật ${day(hotel.reviewedAt.slice(0, 10))}` : 'Chưa có phản hồi')}</td><td><Button asChild variant="secondary" size="sm"><Link to={`/partner/hotels/${hotel.id}/edit`}>Chi tiết / chỉnh sửa</Link></Button></td>
      </tr>)}</tbody></table></Card>

    </> : <EmptyState title="Chưa có khách sạn phù hợp" description="Tạo hồ sơ khách sạn để bắt đầu quy trình xét duyệt." action={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Tạo hồ sơ khách sạn</Link></Button>} />}
    <Pagination page={query.page} total={data?.meta.total ?? 0} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
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


  const status = hotel?.status ?? 'DRAFT'
  const isLocked = status === 'PENDING_APPROVAL'
  const canEditLegal = status !== 'ACTIVE'
  const canSubmit = status === 'DRAFT' || status === 'REJECTED'
  const hasValidBusinessLicense = hotel?.documents.some(doc => doc.documentType === 'BUSINESS_LICENSE' && (!doc.expiresAt || doc.expiresAt >= new Date().toISOString().slice(0, 10))) ?? false

  const updateField = <K extends keyof PartnerHotelInput>(key: K, value: PartnerHotelInput[K]) => setDraft(current => ({ ...(current ?? form), [key]: value }))
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!(form.latitude == null && form.longitude == null) && !hasValidCoordinates(form.latitude, form.longitude)) { setError('Nhập đủ vĩ độ và kinh độ hợp lệ, hoặc xóa cả hai.'); return }
    setSaving(true); setError(''); setMessage('')
    const payload: PartnerHotelInput = { ...form, placeId: form.placeId || null, description: form.description?.trim() || null, starRating: form.starRating || null, checkInTime: form.checkInTime?.slice(0, 5) ?? '14:00', checkOutTime: form.checkOutTime?.slice(0, 5) ?? '12:00' }
    try {
      if (isNew) {
        const created = await api.createHotel(payload)
        await queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })
        navigate(`/partner/hotels/${created.id}/edit`, { replace: true })
      } else {
        const updatePayload = hotel?.status === 'ACTIVE'
          ? { latitude: payload.latitude, longitude: payload.longitude, placeId: payload.placeId, name: payload.name, description: payload.description, address: payload.address, phoneNumber: payload.phoneNumber, email: payload.email, starRating: payload.starRating, checkInTime: payload.checkInTime, checkOutTime: payload.checkOutTime }
          : payload
        await api.updateHotel(id!, updatePayload)
        setDraft(null); setMessage('Đã lưu hồ sơ khách sạn.')
        await queryClient.invalidateQueries({ queryKey: ['catalog'] })
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['partner-hotel', id] }), queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })])
      }
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
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
      <HotelLocationPicker latitude={form.latitude} longitude={form.longitude} address={form.address} disabled={isLocked} onChange={point => setDraft(current => ({ ...(current ?? form), ...point }))} />
      <div className="flex flex-wrap gap-2"><Button disabled={saving || isLocked}>{saving ? 'Đang lưu...' : isNew ? 'Tạo hồ sơ nháp' : 'Lưu thay đổi'}</Button><Button asChild type="button" variant="secondary"><Link to="/partner/hotels">Quay lại danh sách</Link></Button>{hotel && canSubmit && <Button type="button" variant="secondary" disabled={!hasValidBusinessLicense} onClick={() => setSubmitOpen(true)}>Gửi xét duyệt</Button>}</div>
      {hotel && canSubmit && !hasValidBusinessLicense && <p className="text-xs text-amber-800">Cần thêm giấy phép kinh doanh còn hiệu lực trước khi gửi duyệt.</p>}
    </form></Card>

    {!isNew && hotel && <div className="mt-5 max-w-4xl"><HotelImages key={hotel.id} hotel={hotel} /></div>}

    {!isNew && hotel && <HotelDocuments key={hotel.id} hotel={hotel} />}

    <Dialog open={submitOpen} onOpenChange={setSubmitOpen}><DialogContent title="Gửi hồ sơ xét duyệt?" description="Sau khi gửi, bạn sẽ không thể chỉnh sửa hồ sơ hoặc giấy tờ cho đến khi có kết quả."><p className="text-sm text-slate-600">Hãy kiểm tra thông tin và giấy phép kinh doanh trước khi gửi.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setSubmitOpen(false)}>Kiểm tra lại</Button><Button disabled={saving} onClick={() => { void submit() }}>{saving ? 'Đang gửi...' : 'Xác nhận gửi'}</Button></div></DialogContent></Dialog>
  </div>
}

function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-slate-500">{label}</p><p className="mt-1 font-medium">{value}</p></div> }

