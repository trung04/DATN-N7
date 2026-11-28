import { ManagementSearch, SearchButton } from '@/components/management-search'
import { useSearchFilters } from '@/lib/use-search-filters'
import { HotelDocuments } from '@/components/hotel-documents'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { readPage, readPageSize } from '@/lib/pagination'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, ClipboardCheck, ContactRound, FileText, Images, MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { HotelImages } from '@/components/hotel-images'
import { HotelLocationPicker } from '@/components/hotel-location-picker'
import { hasValidCoordinates, type HotelCoordinates } from '@/lib/coordinates'
import { DomainError } from '@/lib/errors'
import { api } from '@/services/api/client'
import { day, errorMessage } from '@/lib/utils'
import type { PartnerHotel, PartnerHotelInput, PartnerHotelQuery, PartnerHotelStatus } from '@/types/domain'

const statusLabel: Record<PartnerHotelStatus, string> = {
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', ACTIVE: 'Đang hoạt động',
  REJECTED: 'Bị từ chối', INACTIVE: 'Ngừng hoạt động', SUSPENDED: 'Tạm đình chỉ',
}
const sortFields: PartnerHotelQuery['sortBy'][] = ['createdAt', 'name', 'status']
const emptyHotel: PartnerHotelInput = { latitude: null, longitude: null, name: '', legalName: '', taxCode: '', description: '', address: '', phoneNumber: '', email: '', starRating: null, checkInTime: '14:00', checkOutTime: '12:00' }
const hotelFormSteps = [
  { id: 'information', label: 'Thông tin', icon: Building2 },
  { id: 'contact', label: 'Liên hệ', icon: ContactRound },
  { id: 'location', label: 'Vị trí', icon: MapPin },
  { id: 'photos', label: 'Ảnh', icon: Images },
  { id: 'documents', label: 'Giấy tờ', icon: FileText },
  { id: 'review', label: 'Nộp hồ sơ', icon: ClipboardCheck },
]

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
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, {
    q: query.search ?? '', status: query.status ?? '', sortBy: query.sortBy, sortOrder: query.sortOrder,
  })
  const hotels = useQuery({ queryKey: ['partner-hotels', query], queryFn: () => api.myHotels(query), placeholderData: keepPreviousData })
  const data = hotels.data
  const pagination = usePagination(hotels.isPlaceholderData ? undefined : data?.meta.total)
  if (hotels.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  return <div className="management-list">
    <PageHeader title="Khách sạn của tôi" description="Tạo hồ sơ, bổ sung giấy tờ và theo dõi tiến trình xét duyệt." actions={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Thêm khách sạn</Link></Button>} />
    <form aria-label="Tìm kiếm khách sạn" onSubmit={applyFilters} className="management-filters grid items-end gap-2 rounded-xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1.2fr_auto]">
      <FormField label="Tên hoặc địa chỉ"><ManagementSearch value={filters.q} onChange={event => changeFilters({ q: event.target.value })} placeholder="Tìm khách sạn" /></FormField>
      <FormField label="Trạng thái"><select value={filters.status} onChange={event => changeFilters({ status: event.target.value as typeof filters.status })}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></FormField>
      <FormField label="Sắp xếp"><span className="flex items-center gap-2"><span className="relative min-w-0 flex-1"><select value={filters.sortBy} onChange={event => changeFilters({ sortBy: event.target.value as typeof filters.sortBy })}>{sortFields.map(field => <option key={field} value={field}>{({ createdAt: 'Ngày tạo', name: 'Tên khách sạn', status: 'Trạng thái' })[field]} · {filters.sortOrder === 'DESC' ? 'giảm dần' : 'tăng dần'}</option>)}</select></span><Button type="button" variant="secondary" className="shrink-0" aria-label="Đổi chiều sắp xếp" onClick={() => changeFilters({ sortOrder: filters.sortOrder === 'DESC' ? 'ASC' : 'DESC' })}>Đổi chiều</Button></span></FormField>
      <SearchButton />
    </form>
    {data?.data.length ? <>
      <Card className="relative table-scroll"><table><thead><tr><th>Khách sạn</th><th>Địa chỉ</th><th>Trạng thái</th><th>Gửi duyệt</th><th>Phản hồi</th><th>Thao tác</th></tr></thead><tbody>{data.data.map(hotel => <tr key={hotel.id}>
        <td className="font-semibold">{hotel.name}<span className="block text-xs font-normal text-slate-500">MST: {hotel.taxCode}</span></td><td>{hotel.address}<span className="mt-1 block text-xs text-slate-500">{hasValidCoordinates(hotel.latitude, hotel.longitude) ? 'Đã có vị trí bản đồ' : 'Chưa đặt vị trí bản đồ'}</span></td><td><StatusBadge status={hotel.status} /><span className="sr-only">{statusLabel[hotel.status]}</span></td><td>{hotel.submittedAt ? day(hotel.submittedAt) : 'Chưa gửi'}</td><td className="max-w-xs whitespace-normal text-sm">{hotel.rejectionReason || (hotel.reviewedAt ? `Cập nhật ${day(hotel.reviewedAt)}` : 'Chưa có phản hồi')}</td><td><Button asChild variant="secondary" size="sm"><Link to={`/partner/hotels/${hotel.id}/edit`}>{hotel.status === 'PENDING_APPROVAL' ? 'Xem hồ sơ' : 'Chi tiết / chỉnh sửa'}</Link></Button></td>
      </tr>)}</tbody></table></Card>

    </> : <EmptyState title="Chưa có khách sạn phù hợp" description="Tạo hồ sơ khách sạn để bắt đầu quy trình xét duyệt." action={<Button asChild><Link to="/partner/hotels/new"><Plus size={16} />Tạo hồ sơ khách sạn</Link></Button>} />}
    <Pagination page={query.page} total={data?.meta.total ?? 0} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
  </div>
}

export function PartnerHotelFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const formId = useId()
  const hotelQuery = useQuery({
    queryKey: ['partner-hotel', id], queryFn: () => api.myHotel(id!), enabled: Boolean(id),
    refetchInterval: query => query.state.data?.status === 'PENDING_APPROVAL' ? 15_000 : false,
    refetchOnWindowFocus: true,
  })
  const hotel = hotelQuery.data
  const [startStep, setStartStep] = useState(0)
  const [draft, setDraft] = useState<PartnerHotelInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [filesBusy, setFilesBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [mapDraft, setMapDraft] = useState<HotelCoordinates | null>(null)

  const requestedStep = params.get('step') ?? (hotel?.status === 'PENDING_APPROVAL' ? 'review' : 'information')
  const step = id ? Math.max(0, hotelFormSteps.findIndex(item => item.id === requestedStep)) : startStep
  const form = draft ?? hotelInput(hotel)
  const status = hotel?.status ?? 'DRAFT'
  const locked = status === 'PENDING_APPROVAL'
  const busy = saving || filesBusy
  const canSubmit = status === 'DRAFT' || status === 'REJECTED'
  const hasLocation = hasValidCoordinates(form.latitude, form.longitude)
  const hasPhotos = Boolean(hotel?.images?.length)
  const today = new Date().toISOString().slice(0, 10)
  const hasLicense = hotel?.documents?.some(doc =>
    doc.documentType === 'BUSINESS_LICENSE' && Boolean(doc.documentNumber?.trim()) &&
    Boolean(doc.files?.length || doc.fileUrl?.trim()) && (!doc.expiresAt || doc.expiresAt >= today)) ?? false
  const ready = Boolean(hotel && canSubmit && !draft && hasPhotos && hasLicense)

  function changeStep(next: number) {
    setError('')
    if (id) setParams(current => {
      const updated = new URLSearchParams(current)
      updated.set('step', hotelFormSteps[next]?.id ?? 'information')
      return updated
    }, { replace: true })
    else setStartStep(next)
  }

  function updateField<K extends keyof PartnerHotelInput>(key: K, value: PartnerHotelInput[K]) {
    setDraft(current => ({ ...(current ?? form), [key]: value }))
  }

  function updateLocation(point: HotelCoordinates) {
    setDraft(current => ({ ...(current ?? form), ...point }))
    setMapDraft(null)
  }

  async function saveBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || locked) return
    if ((!id && step < 2) || (id && !draft)) {
      changeStep(step + 1)
      return
    }
    if (!(form.latitude == null && form.longitude == null) && !hasLocation) {
      changeStep(2)
      setError('Nhập đủ vĩ độ và kinh độ hợp lệ, hoặc xóa cả hai.')
      return
    }

    setSaving(true)
    setError('')
    const payload: PartnerHotelInput = {
      ...form, placeId: form.placeId || null, description: form.description?.trim() || null, starRating: form.starRating || null,
      checkInTime: form.checkInTime.slice(0, 5), checkOutTime: form.checkOutTime.slice(0, 5),
    }
    try {
      if (!id) {
        const created = await api.createHotel(payload)
        queryClient.setQueryData(['partner-hotel', created.id], created)
        setDraft(null)
        void queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })
        navigate('/partner/hotels/' + created.id + '/edit?step=photos', { replace: true })
        return
      }

      const { legalName, taxCode, ...editable } = payload
      const update = status === 'ACTIVE' ? editable : { ...editable, legalName, taxCode }
      const updated = await api.updateHotel(id, update)
      queryClient.setQueryData(['partner-hotel', id], updated)
      setDraft(null)
      changeStep(step + 1)
      void queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
    } catch (cause) {
      setError(!id && cause instanceof DomainError && cause.code === 'HOTEL_OWNER_NOT_FOUND'
        ? 'Tài khoản này chưa có hồ sơ đối tác. Hãy liên hệ quản trị viên để kiểm tra.'
        : errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!id || !ready || busy) return
    setSaving(true)
    setError('')
    try {
      const submitted = await api.submitHotel(id)
      queryClient.setQueryData(['partner-hotel', id], submitted)
      setSubmitOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['partner-hotels'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-hotels'] })
    } catch (cause) {
      setError(errorMessage(cause))
      await hotelQuery.refetch()
    } finally {
      setSaving(false)
    }
  }

  if (id && !hotel) {
    return hotelQuery.isError
      ? <ErrorState message={errorMessage(hotelQuery.error)} retry={() => { void hotelQuery.refetch() }} />
      : <LoadingState />
  }

  return <section className="hotel-profile-editor min-w-0 max-w-4xl">
    <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A5F] hover:underline" to="/partner/hotels"><ArrowLeft size={15} />Danh sách khách sạn</Link>
    <div className="mt-2"><PageHeader title={hotel?.name ?? 'Tạo hồ sơ khách sạn'} actions={hotel && <StatusBadge status={status} />} /></div>

    <Card className="overflow-hidden">
      <nav aria-label="Các phần hồ sơ khách sạn" className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 p-2 sm:grid-cols-6 sm:p-3">
        {hotelFormSteps.map(({ label, icon: Icon }, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined}
          disabled={busy || (!id && index > step)} onClick={() => changeStep(index)}
          className={'inline-flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-md px-0.5 text-xs font-medium sm:text-sm ' + (step === index ? 'bg-white font-semibold text-[#1E3A5F] shadow-sm' : 'text-slate-600 enabled:hover:bg-white disabled:text-slate-400')}>
          <Icon size={14} className="shrink-0" aria-hidden="true" />{label}
        </button>)}
      </nav>

      <div className={step < 3 ? '' : 'p-2 sm:p-3'} role="group" aria-label={hotelFormSteps[step]?.label}>
        {step < 3 && <form id={formId} onSubmit={saveBasics} className="hotel-creation-panel grid content-start gap-2.5 p-3 sm:p-5">
          {step === 0 && <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-4">
              <FormField label="Tên khách sạn"><input required pattern=".*\S.*" maxLength={200} disabled={busy || locked} value={form.name} onChange={event => updateField('name', event.target.value)} /></FormField>
              <FormField label="Tên pháp lý"><input required pattern=".*\S.*" maxLength={200} disabled={busy || locked || status === 'ACTIVE'} value={form.legalName} onChange={event => updateField('legalName', event.target.value)} /></FormField>
              <FormField label="Mã số thuế"><input required pattern=".*\S.*" maxLength={50} disabled={busy || locked || status === 'ACTIVE'} value={form.taxCode} onChange={event => updateField('taxCode', event.target.value)} /></FormField>
              <FormField label="Hạng sao"><select disabled={busy || locked} value={form.starRating ?? ''} onChange={event => updateField('starRating', event.target.value ? Number(event.target.value) : null)}><option value="">Chưa xếp hạng</option>{[1, 2, 3, 4, 5].map(stars => <option key={stars} value={stars}>{stars} sao</option>)}</select></FormField>
            </div>
            <FormField label="Mô tả"><textarea rows={3} maxLength={5000} disabled={busy || locked} value={form.description ?? ''} onChange={event => updateField('description', event.target.value)} /></FormField>
          </>}
          {step === 1 && <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-4">
            <FormField label="Địa chỉ thư điện tử liên hệ"><input type="email" required maxLength={254} disabled={busy || locked} value={form.email} onChange={event => updateField('email', event.target.value)} /></FormField>
            <FormField label="Số điện thoại"><input type="tel" required pattern="\+?[0-9][0-9 .\(\)\-]{6,28}" disabled={busy || locked} value={form.phoneNumber} onChange={event => updateField('phoneNumber', event.target.value)} /></FormField>
            <FormField label="Giờ nhận phòng"><input type="time" required disabled={busy || locked} value={form.checkInTime} onChange={event => updateField('checkInTime', event.target.value)} /></FormField>
            <FormField label="Giờ trả phòng"><input type="time" required disabled={busy || locked} value={form.checkOutTime} onChange={event => updateField('checkOutTime', event.target.value)} /></FormField>
          </div>}
          {step === 2 && <>
            <FormField label="Địa chỉ"><input required pattern=".*\S.*" maxLength={500} disabled={busy || locked} value={form.address} onChange={event => updateField('address', event.target.value)} /></FormField>
            <Dialog open={Boolean(mapDraft)} onOpenChange={open => setMapDraft(open ? { latitude: form.latitude ?? null, longitude: form.longitude ?? null } : null)}>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div><p className="text-sm font-medium text-slate-800">Vị trí trên bản đồ</p><p className="text-xs text-slate-600">{hasLocation ? form.latitude!.toFixed(5) + ', ' + form.longitude!.toFixed(5) : 'Chưa đặt ghim · Tùy chọn'}</p></div>
                <DialogTrigger asChild><Button type="button" variant="secondary" size="sm" disabled={busy || locked}><MapPin size={15} />{hasLocation ? 'Sửa vị trí' : 'Chọn vị trí'}</Button></DialogTrigger>
              </div>
              {mapDraft && <DialogContent title="Chọn vị trí khách sạn" layout="workspace" className="max-w-2xl" footer={<>
                <Button type="button" variant="secondary" onClick={() => setMapDraft(null)}>Hủy</Button>
                <Button type="button" disabled={!(mapDraft.latitude == null && mapDraft.longitude == null) && !hasValidCoordinates(mapDraft.latitude, mapDraft.longitude)} onClick={() => updateLocation(mapDraft)}>Áp dụng vị trí</Button>
              </>}>
                <HotelLocationPicker compact {...mapDraft} address={form.address} onChange={setMapDraft} />
              </DialogContent>}
            </Dialog>
          </>}
        </form>}

        {hotel && <>
          <div hidden={step !== 3}><HotelImages hotel={hotel} compact onBusyChange={setFilesBusy} /></div>
          <div hidden={step !== 4}><HotelDocuments hotel={hotel} compact onBusyChange={setFilesBusy} /></div>
          {step === 5 && <div className="grid gap-2 p-2 text-sm sm:p-3">
            <h2 className="text-lg font-semibold">Kiểm tra và nộp hồ sơ</h2>
            {status === 'PENDING_APPROVAL' ? <Feedback message="Hồ sơ đang chờ quản trị viên xét duyệt. Các thao tác quản lý sẽ mở khi khách sạn hoạt động." /> : <>
              {hotel.rejectionReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 break-words">Phản hồi xét duyệt · {hotel.rejectionReason}</p>}
              <ul className="grid gap-1.5 rounded-lg border border-slate-200 p-3">
                <ReviewItem ready={!draft} label={draft ? 'Thông tin có thay đổi chưa lưu' : 'Thông tin, liên hệ và địa chỉ đã lưu'} onClick={() => changeStep(0)} />
                <ReviewItem ready={hasPhotos} label={hasPhotos ? 'Đã có ảnh khách sạn' : 'Cần ít nhất một ảnh khách sạn'} onClick={() => changeStep(3)} />
                <ReviewItem ready={hasLicense} label={hasLicense ? 'Giấy phép kinh doanh còn hiệu lực' : 'Cần giấy phép kinh doanh còn hiệu lực kèm ảnh'} onClick={() => changeStep(4)} />
              </ul>
              {hotel.reviewedAt && <p className="text-xs text-slate-500">Xét duyệt gần nhất {day(hotel.reviewedAt)}</p>}
            </>}
          </div>}
        </>}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
        {error && <div className="mb-2"><Feedback message={error} kind="error" /></div>}
        <div className="flex items-center justify-between gap-2">
          {step > 0 ? <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => changeStep(step - 1)}><ArrowLeft size={15} />Quay lại</Button>
            : <Button asChild variant="ghost" size="sm"><Link to="/partner/hotels">{id ? 'Danh sách' : 'Hủy'}</Link></Button>}
          {step < 3 && !locked && <Button type="submit" form={formId} size="sm" disabled={busy}>{saving ? 'Đang lưu…' : id && draft ? 'Lưu và tiếp tục' : 'Tiếp tục'}<ArrowRight size={15} /></Button>}
          {step < 5 && (step >= 3 || locked) && <Button type="button" size="sm"
            disabled={busy || (canSubmit && ((step === 3 && !hasPhotos) || (step === 4 && !hasLicense)))}
            onClick={() => changeStep(step + 1)}>Tiếp tục<ArrowRight size={15} /></Button>}
          {step === 5 && canSubmit && <Button type="button" size="sm" disabled={!ready || busy} onClick={() => setSubmitOpen(true)}>Gửi xét duyệt</Button>}
        </div>
      </div>
    </Card>

    <Dialog open={submitOpen} onOpenChange={open => { if (!busy) setSubmitOpen(open) }}>
      <DialogContent title="Gửi hồ sơ xét duyệt?" description="Hồ sơ sẽ chuyển sang Chờ duyệt và tạm khóa chỉnh sửa.">
        <Feedback message={error} kind="error" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setSubmitOpen(false)}>Kiểm tra lại</Button>
          <Button disabled={busy || !ready} onClick={() => { void submit() }}>{saving ? 'Đang gửi…' : 'Xác nhận gửi'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>
}

function ReviewItem({ ready, label, onClick }: { ready: boolean; label: string; onClick: () => void }) {
  return <li>
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-slate-50">
      {ready ? <CheckCircle2 size={16} className="shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle size={16} className="shrink-0 text-amber-700" aria-hidden="true" />}
      <span className="min-w-0 flex-1">{label}</span><ArrowRight size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
    </button>
  </li>
}
