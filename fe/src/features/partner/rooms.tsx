import { SearchButton } from '@/components/management-search'
import { useSearchFilters } from '@/lib/use-search-filters'
import { useRef, useState, type FormEvent } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { RoomImages } from '@/components/room-images'
import { HotelManagementLocked } from '@/components/hotel-management-locked'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BedDouble, Hotel, Images, Plus, Save, Sparkles, Trash2, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { DialogList } from '@/components/ui/dialog-sections'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { loadHotelOptions } from '@/services/api/management-options'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/lib/use-pagination'
import { fetchAllPages, readPage, readPageSize } from '@/lib/pagination'
import { errorMessage } from '@/lib/utils'
import type { ManagedRoom, ManagedRoomInput, PartnerHotel, RoomOperationalStatus, RoomGuestPolicyInput } from '@/types/domain'

const statusLabels: Record<RoomOperationalStatus, string> = {
  AVAILABLE: 'Đang kinh doanh', MAINTENANCE: 'Đang bảo trì', OUT_OF_SERVICE: 'Ngừng khai thác',
}
const statuses = Object.keys(statusLabels) as RoomOperationalStatus[]

function usePartnerHotels() {
  return useQuery({ queryKey: ['partner-hotels', 'room-picker'], queryFn: () => loadHotelOptions() })
}

export function PartnerOverviewPage() {
  const [params] = useSearchParams()
  const page = readPage(params)
  const size = readPageSize(params)
  const hotels = useQuery({ queryKey: ['partner-hotels', 'overview', page, size], queryFn: () => api.myHotels({ page, limit: size, sortBy: 'name', sortOrder: 'ASC' }) })
  const rooms = useQuery({ queryKey: ['partner-managed-rooms', 'overview'], queryFn: () => api.managedRoomPage({ page: 1, limit: 1 }) })
  const pending = useQuery({ queryKey: ['partner-hotels', 'pending-count'], queryFn: () => api.myHotels({ page: 1, limit: 1, status: 'PENDING_APPROVAL', sortBy: 'name', sortOrder: 'ASC' }) })
  const pagination = usePagination(hotels.data?.meta.total)
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (hotels.isPending || rooms.isPending) return <LoadingState />
  if (rooms.isError) return <ErrorState message={errorMessage(rooms.error)} retry={() => { void rooms.refetch() }} />
  return <div className="management-list"><PageHeader title="Tổng quan đối tác" description="Theo dõi khách sạn, phòng và tình trạng xét duyệt của bạn." />
    <div className="grid gap-4 sm:grid-cols-2"><Card className="p-5"><div className="flex items-center justify-between text-slate-500"><span>Khách sạn</span><Hotel size={20} /></div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{hotels.data.meta.total}</p></Card><Card className="p-5"><div className="flex items-center justify-between text-slate-500"><span>Phòng</span><BedDouble size={20} /></div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{rooms.data.meta.total}</p></Card></div>
    <Card className="management-results p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Khách sạn của tôi</h2><p className="text-sm text-slate-500">Theo dõi duyệt và mở nhanh quản lý phòng.</p></div><Button asChild size="sm" variant="secondary"><Link to="/partner/hotels">Quản lý khách sạn</Link></Button></div>
      {hotels.data.data.length ? <div className="mt-4 divide-y divide-slate-100">{hotels.data.data.map(hotel => <div key={hotel.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{hotel.name}</p><p className="text-sm text-slate-500">{hotel.address}{hotel.rejectionReason ? ` · Lý do: ${hotel.rejectionReason}` : ''}</p></div><div className="flex items-center gap-3"><StatusBadge status={hotel.status} /><Link className="text-sm font-semibold text-[#1E3A5F]" to={`/partner/hotels/${hotel.id}/edit`}>Chi tiết</Link></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Chưa có hồ sơ khách sạn.</p>}
    </Card>
    <Pagination page={page} total={hotels.data.meta.total} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
    {pending.isError && <ErrorState message={errorMessage(pending.error)} retry={() => { void pending.refetch() }} />}
    {(pending.data?.meta.total ?? 0) > 0 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Có {pending.data!.meta.total} hồ sơ đang chờ duyệt. Bạn có thể theo dõi trạng thái tại danh sách khách sạn.</p>}
  </div>
}

export function PartnerRoomsPage() {
  const [params, setParams] = useSearchParams()
  const selectedHotel = params.get('hotelId') ?? ''
  const { filters, changeFilters, applyFilters } = useSearchFilters(params, setParams, { hotelId: selectedHotel })
  const page = readPage(params)
  const size = readPageSize(params)
  const hotels = usePartnerHotels()
  const rooms = useQuery({
    queryKey: ['partner-managed-rooms', 'list', selectedHotel, page, size],
    enabled: Boolean(hotels.data),
    queryFn: () => api.managedRoomPage({ page, limit: size, ...(selectedHotel ? { hotelId: selectedHotel } : {}) }),
  })
  const pagination = usePagination(rooms.data?.meta.total)
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (hotels.isPending || rooms.isPending) return <LoadingState />
  if (rooms.isError) return <ErrorState message={errorMessage(rooms.error)} retry={() => { void rooms.refetch() }} />
  const hotelOptions = hotels.data ?? []
  const selected = hotelOptions.find(hotel => hotel.id === selectedHotel)
  const canAddRoom = selectedHotel ? selected?.status === 'ACTIVE' : hotelOptions.some(hotel => hotel.status === 'ACTIVE')
  const addRoom = canAddRoom && <Button asChild><Link to={selectedHotel ? `/partner/rooms/new?hotelId=${selectedHotel}` : '/partner/rooms/new'}><Plus size={16} />Thêm phòng</Link></Button>
  const hotelName = (id: string) => hotelOptions.find(hotel => hotel.id === id)?.name ?? 'Khách sạn'
  return <div className="management-list">
    <PageHeader title="Quản lý phòng" description="Tạo và cập nhật phòng theo khách sạn, sức chứa, giá và trạng thái khai thác." actions={addRoom} />
    <form onSubmit={applyFilters} aria-label="Tìm kiếm phòng" className="management-filters grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl border border-slate-200 bg-white"><FormField label="Khách sạn"><select value={filters.hotelId} onChange={event => changeFilters({ hotelId: event.target.value })}><option value="">Tất cả khách sạn</option>{hotels.data?.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField><SearchButton /></form>
    {!canAddRoom && <HotelManagementLocked hotel={selected ?? (hotelOptions.length === 1 ? hotelOptions[0] : undefined)} />}
    {rooms.data?.data.length ? <Card className="table-scroll"><table><thead><tr><th>Phòng</th><th>Khách sạn</th><th>Sức chứa</th><th>Giá / đêm</th><th>Tiện nghi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rooms.data.data.map(room => <tr key={room.id}>
      <td><strong>{room.roomNumber}</strong><span className="block text-xs text-slate-500">{room.roomType}</span></td><td>{hotelName(room.hotelId)}</td><td>{room.maxOccupancy} khách</td><td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: room.currency }).format(room.pricePerNight)}</td><td>{room.amenities.map(item => item.name).join(', ') || '—'}</td><td><StatusBadge status={room.operationalStatus} /><span className="sr-only">{statusLabels[room.operationalStatus]}</span></td><td>{hotelOptions.find(hotel => hotel.id === room.hotelId)?.status === 'ACTIVE' ? <Link className="font-semibold text-[#1E3A5F] hover:underline" to={`/partner/rooms/${room.id}/edit`}>Chi tiết / sửa</Link> : <Link className="font-semibold text-[#1E3A5F] hover:underline" to={`/partner/hotels/${room.hotelId}/edit?step=review`}>Xem hồ sơ</Link>}</td>
    </tr>)}</tbody></table></Card> : canAddRoom && <EmptyState title="Chưa có phòng" description="Thêm phòng cho khách sạn để bắt đầu quản lý." action={addRoom} />}
    <Pagination page={page} total={rooms.data.meta.total} onPageChange={pagination.setPage} size={pagination.size} onSizeChange={pagination.setSize} />
  </div>
}

function initialRoom(room?: ManagedRoom, hotels: PartnerHotel[] = [], hotelId?: string): ManagedRoomInput {
  return {
    hotelId: room?.hotelId ?? hotelId ?? hotels.find(hotel => hotel.status === 'ACTIVE')?.id ?? '',
    roomNumber: room?.roomNumber ?? '', maxOccupancy: room?.maxOccupancy ?? 2,
    pricePerNight: room?.pricePerNight ?? 0, currency: room?.currency ?? 'VND',
    description: room?.description ?? '', operationalStatus: room?.operationalStatus ?? 'AVAILABLE',
    roomType: room?.roomType ?? '', amenityIds: room?.amenities.map(item => item.id) ?? [],
  }
}

export function PartnerRoomFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hotels = usePartnerHotels()
  const room = useQuery({ queryKey: ['partner-managed-room', id], queryFn: () => api.managedRoom(id!), enabled: Boolean(id) })
  const amenities = useQuery({ queryKey: ['amenity-options'], queryFn: () => fetchAllPages(page => api.amenities(page)) })
  const [draft, setDraft] = useState<ManagedRoomInput | null>(null)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [section, setSection] = useState(params.get('section') === 'images' && id ? 'images' : 'room')
  const savedRoomId = useRef(id)
  const [guestPolicyDraft, setGuestPolicyDraft] = useState<RoomGuestPolicyInput | null>(null)
  const availableHotels = hotels.data ?? []
  const selectableHotels = availableHotels.filter(hotel => hotel.status === 'ACTIVE')
  const initialHotelId = room.data?.hotelId ?? (!id ? params.get('hotelId') || undefined : undefined)
  const initialHotel = availableHotels.find(hotel => hotel.id === initialHotelId)
  const form = draft ?? initialRoom(room.data, selectableHotels, initialHotelId)
  const canOperate = (!initialHotelId || initialHotel?.status === 'ACTIVE') && selectableHotels.some(hotel => hotel.id === form.hotelId)
  const hotelAmenities = useQuery({ queryKey: ['partner-hotel-amenity-options', form.hotelId], queryFn: () => fetchAllPages(page => api.hotelAmenities(form.hotelId, page)), enabled: canOperate && (!id || Boolean(room.data)) })
  const guestPolicies = useQuery({ queryKey: ['room-guest-policies', form.hotelId], queryFn: () => api.roomGuestPolicies(form.hotelId), enabled: canOperate && (!id || Boolean(room.data)) })
  const normalizeRoomType = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN')
  const persistedPolicy = guestPolicies.data?.find(policy => policy.roomType && normalizeRoomType(policy.roomType) === normalizeRoomType(form.roomType))
  const guestPolicy: RoomGuestPolicyInput = guestPolicyDraft ?? {
    hotelId: form.hotelId,
    roomType: form.roomType,
    maxAdults: Math.min(form.maxOccupancy, 2),
    maxChildren: form.maxOccupancy,
    freeChildMaxAge: 11,
    childSurchargePerNight: 0,
    ...(persistedPolicy ? { maxAdults: persistedPolicy.maxAdults, maxChildren: persistedPolicy.maxChildren, freeChildMaxAge: persistedPolicy.freeChildMaxAge, childSurchargePerNight: persistedPolicy.childSurchargePerNight } : {}),
  }
  const update = <K extends keyof ManagedRoomInput>(key: K, value: ManagedRoomInput[K]) => {
    if (key === 'hotelId' || key === 'roomType') setGuestPolicyDraft(null)
    setDraft(current => ({ ...(current ?? form), [key]: value }))
  }
  const updateGuestPolicy = <K extends keyof RoomGuestPolicyInput>(key: K, value: RoomGuestPolicyInput[K]) => setGuestPolicyDraft(current => ({ ...(current ?? guestPolicy), [key]: value, hotelId: form.hotelId, roomType: form.roomType }))

  if (hotels.isPending || (id && room.isPending)) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (amenities.isError) return <ErrorState message={errorMessage(amenities.error)} retry={() => { void amenities.refetch() }} />
  if (hotelAmenities.isError) return <ErrorState message={errorMessage(hotelAmenities.error)} retry={() => { void hotelAmenities.refetch() }} />
  if (guestPolicies.isError) return <ErrorState message={errorMessage(guestPolicies.error)} retry={() => { void guestPolicies.refetch() }} />
  if (id && room.isError) return <ErrorState message={errorMessage(room.error)} retry={() => { void room.refetch() }} />
  if (id && !room.data) return <EmptyState title="Không tìm thấy phòng" />
  if (!canOperate) return <HotelManagementLocked hotel={initialHotel ?? availableHotels.find(hotel => hotel.id === form.hotelId) ?? (availableHotels.length === 1 ? availableHotels[0] : undefined)} />
  if (amenities.isPending || hotelAmenities.isPending || guestPolicies.isPending) return <LoadingState />

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !canOperate) return
    const invalidField = Array.from(event.currentTarget.elements).find((field): field is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) &&
      field.willValidate && !field.validity.valid,
    )
    if (invalidField) {
      setError('')
      const panel = invalidField.closest<HTMLElement>('[data-room-section]')
      if (panel?.dataset.roomSection) setSection(panel.dataset.roomSection)
      requestAnimationFrame(() => invalidField.reportValidity())
      return
    }
    const openImages = !id && section === 'images'
    setBusy(true); setError('')
    try {
      const payload = { ...form, description: form.description?.trim() || null }
      const saved = savedRoomId.current
        ? await api.updateManagedRoom(savedRoomId.current, payload)
        : await api.createManagedRoom(payload)
      savedRoomId.current = saved.id
      await api.saveRoomGuestPolicy({ ...guestPolicy, hotelId: form.hotelId, roomType: form.roomType })
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-rooms'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-room', saved.id] })
      await queryClient.invalidateQueries({ queryKey: ['room-guest-policies', form.hotelId] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      navigate(openImages ? `/partner/rooms/${saved.id}/edit?section=images` : '/partner/rooms')
    } catch (cause) {
      setError(!id && savedRoomId.current ? `Phòng đã được tạo. ${errorMessage(cause)}` : errorMessage(cause))
    }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!id || !canOperate) return
    setBusy(true); setError('')
    try {
      await api.deleteManagedRoom(id)
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-rooms'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      navigate('/partner/rooms')
    } catch (cause) { setError(errorMessage(cause)); setDeleteOpen(false) }
    finally { setBusy(false) }
  }
  const tabs = [
    { id: 'room', label: 'Thông tin', icon: BedDouble },
    { id: 'guests', label: 'Quy định khách', icon: UsersRound },
    { id: 'amenities', label: 'Tiện nghi', icon: Sparkles },
    { id: 'images', label: 'Ảnh phòng', icon: Images },
  ]
  const amenityOptions = [
    ...(amenities.data ?? []).map(item => ({ ...item, custom: false })),
    ...(hotelAmenities.data ?? []).map(item => ({ ...item, custom: true })),
  ]
  const panelClass = 'min-w-0 p-3 data-[state=inactive]:hidden sm:p-4'
  const title = room.data ? 'Sửa phòng ' + room.data.roomNumber : 'Thêm phòng'
  return <section className="room-editor min-w-0 max-w-4xl">
    <div className="flex min-h-6 flex-wrap items-center justify-between gap-1">
      <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A5F] hover:underline" to="/partner/rooms"><ArrowLeft size={15} />Danh sách phòng</Link>
      {room.data && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${room.data.operationalStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{statusLabels[room.data.operationalStatus]}</span>}
    </div>
    <div className="mt-1.5" title={title}><PageHeader title={title} /></div>
    <Card>
      <Tabs.Root value={section} onValueChange={setSection}>
        <Tabs.List aria-label="Các phần thông tin phòng" className="grid grid-cols-4 gap-1 rounded-t-xl border-b border-slate-200 bg-slate-50 p-1.5 sm:p-2">
          {tabs.map(({ id: tabId, label, icon: Icon }) => <Tabs.Trigger key={tabId} value={tabId} disabled={busy}
            className="flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-1 text-xs! font-medium leading-tight text-slate-600 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#1E3A5F] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#1E3A5F] data-[state=active]:shadow-sm sm:text-sm!">
            <Icon size={16} className="hidden shrink-0 sm:block" aria-hidden="true" />{label}
          </Tabs.Trigger>)}
        </Tabs.List>

        <form className="room-editor-form" noValidate onSubmit={save}>
          <Tabs.Content forceMount value="room" data-room-section="room" className={panelClass}>
            <fieldset disabled={busy} className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-x-4">
              <FormField label="Khách sạn"><select required value={form.hotelId} onChange={event => update('hotelId', event.target.value)}>{selectableHotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
              <FormField label="Số / mã phòng"><input required maxLength={30} value={form.roomNumber} onChange={event => update('roomNumber', event.target.value)} /></FormField>
              <FormField label="Loại phòng"><input required maxLength={60} value={form.roomType} onChange={event => update('roomType', event.target.value)} placeholder="Ví dụ Deluxe" /></FormField>
              <FormField label="Sức chứa tối đa"><input required type="number" min="1" max="100" value={form.maxOccupancy} onChange={event => update('maxOccupancy', Number(event.target.value))} /></FormField>
              <FormField label="Giá / đêm"><input required type="number" min="0" step="1000" value={form.pricePerNight} onChange={event => update('pricePerNight', Number(event.target.value))} /></FormField>
              <FormField label="Tiền tệ"><select value={form.currency} onChange={event => update('currency', event.target.value)}><option value="VND">VND</option><option value="USD">USD</option></select></FormField>
              <FormField label="Trạng thái khai thác"><select value={form.operationalStatus} onChange={event => update('operationalStatus', event.target.value as RoomOperationalStatus)}>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></FormField>
            </fieldset>
          </Tabs.Content>

          <Tabs.Content forceMount value="guests" data-room-section="guests" className={panelClass}>
            <p className="mb-2.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Quy định dùng chung cho các phòng cùng loại. Khách từ 12 tuổi được tính là người lớn. Nếu vượt sức chứa, khách cần đặt thêm phòng.
            </p>
            <fieldset disabled={busy} className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-x-4">
              <FormField label="Số người lớn tối đa"><input required type="number" min="1" max="100" value={guestPolicy.maxAdults} onChange={event => updateGuestPolicy('maxAdults', Number(event.target.value))} /></FormField>
              <FormField label="Số trẻ em tối đa"><input required type="number" min="0" max="100" value={guestPolicy.maxChildren} onChange={event => updateGuestPolicy('maxChildren', Number(event.target.value))} /></FormField>
              <FormField label="Miễn phụ thu đến tuổi"><input required type="number" min="0" max="11" value={guestPolicy.freeChildMaxAge} onChange={event => updateGuestPolicy('freeChildMaxAge', Number(event.target.value))} /></FormField>
              <FormField label="Phụ thu mỗi trẻ / đêm"><input required type="number" min="0" step="1000" value={guestPolicy.childSurchargePerNight} onChange={event => updateGuestPolicy('childSurchargePerNight', Number(event.target.value))} /></FormField>
            </fieldset>
          </Tabs.Content>

          <Tabs.Content forceMount value="amenities" data-room-section="amenities" className={panelClass}>
            <fieldset disabled={busy} className="grid min-w-0 gap-2.5">
              <FormField label="Mô tả"><textarea rows={2} maxLength={5000} value={form.description ?? ''} onChange={event => update('description', event.target.value)} /></FormField>
              <div className="grid min-w-0 gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold">Đã chọn {form.amenityIds.length} tiện nghi</p>
                  <Link className="text-xs font-semibold text-[#1E3A5F] hover:underline" to="/partner/amenities">Quản lý tiện nghi</Link>
                </div>
                {amenityOptions.length ? <DialogList key={form.hotelId} label="Phân trang tiện nghi phòng" pageSize={3}
                  items={amenityOptions.map(item => <li key={item.id}>
                    <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-1.5 text-sm hover:bg-slate-50">
                      <input type="checkbox" className="m-0! h-4! w-4! min-h-0! shrink-0 accent-[#1E3A5F]" checked={form.amenityIds.includes(item.id)}
                        onChange={event => update('amenityIds', event.target.checked ? [...form.amenityIds, item.id] : form.amenityIds.filter(value => value !== item.id))} />
                      <span className="min-w-0 truncate" title={item.name}>{item.name}</span>
                      {item.custom && <span className="shrink-0 text-xs text-slate-500">Riêng khách sạn</span>}
                    </label>
                  </li>)} /> : <p className="text-sm text-slate-500">Chưa có tiện nghi trong danh mục.</p>}
              </div>
            </fieldset>
          </Tabs.Content>

          <Tabs.Content forceMount value="images" className={panelClass}>
            {room.data ? <RoomImages roomId={room.data.id} locked={false} />
              : <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">Lưu phòng để tải ảnh lên và chọn ảnh đại diện.</p>}
          </Tabs.Content>

          <div className="rounded-b-xl border-t border-slate-200 bg-slate-50 px-2.5 py-2 sm:px-4 sm:py-2.5">
            {error && <div className="mb-2"><Feedback message={error} kind="error" /></div>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={busy} className="whitespace-nowrap px-2.5 text-sm! sm:px-3"><Save size={15} className="hidden sm:block" />{busy ? 'Đang lưu…' : !id && section === 'images' ? 'Lưu và thêm ảnh' : 'Lưu phòng'}</Button>
              <Button asChild size="sm" variant="secondary" className="px-2.5 sm:px-3"><Link to="/partner/rooms">Hủy</Link></Button>
              {id && <Button type="button" size="sm" variant="ghost" className="ml-auto whitespace-nowrap px-2.5 text-sm! text-red-700 hover:bg-red-50 sm:px-3" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 size={15} className="hidden sm:block" />Xóa phòng</Button>}
            </div>
          </div>
        </form>
      </Tabs.Root>
    </Card>

    <Dialog open={deleteOpen} onOpenChange={open => { if (!busy) setDeleteOpen(open) }}>
      <DialogContent title="Xóa phòng?" description={'Phòng ' + room.data?.roomNumber + ' sẽ bị xóa khỏi khách sạn.'}>
        <p className="text-sm text-slate-600">Các phòng đã có giao dịch có thể không xóa được.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}>Xác nhận xóa</Button></div>
      </DialogContent>
    </Dialog>
  </section>
}
