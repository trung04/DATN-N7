import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Hotel, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { api } from '@/services/api/client'
import { errorMessage } from '@/lib/utils'
import type { ManagedRoom, ManagedRoomInput, PartnerHotel, RoomOperationalStatus } from '@/types/domain'

const statusLabels: Record<RoomOperationalStatus, string> = {
  AVAILABLE: 'Đang kinh doanh', MAINTENANCE: 'Đang bảo trì', OUT_OF_SERVICE: 'Ngừng khai thác',
}
const statuses = Object.keys(statusLabels) as RoomOperationalStatus[]
const hotelQuery = { page: 1, limit: 100, sortBy: 'name' as const, sortOrder: 'ASC' as const }

function usePartnerHotels() {
  return useQuery({ queryKey: ['partner-hotels', 'room-picker'], queryFn: () => api.myHotels(hotelQuery) })
}

export function PartnerOverviewPage() {
  const hotels = usePartnerHotels()
  const rooms = useQuery({ queryKey: ['partner-managed-rooms', 'overview'], enabled: Boolean(hotels.data), queryFn: async () => Promise.all(hotels.data!.data.map(hotel => api.managedRooms(hotel.id))) })
  if (hotels.isPending || rooms.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (rooms.isError) return <ErrorState message={errorMessage(rooms.error)} retry={() => { void rooms.refetch() }} />
  const roomRows = rooms.data?.flatMap(page => page.data) ?? []
  const pending = hotels.data.data.filter(hotel => hotel.status === 'PENDING_APPROVAL')
  return <div><PageHeader title="Tổng quan chủ khách sạn" description="Tình trạng hồ sơ khách sạn và phòng được tải trực tiếp từ backend." />
    <div className="grid gap-4 sm:grid-cols-2"><Card className="p-5"><div className="flex items-center justify-between text-slate-500"><span>Khách sạn</span><Hotel size={20} /></div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{hotels.data.meta.total}</p></Card><Card className="p-5"><div className="flex items-center justify-between text-slate-500"><span>Phòng</span><BedDouble size={20} /></div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{roomRows.length}</p></Card></div>
    <Card className="mt-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Khách sạn của tôi</h2><p className="text-sm text-slate-500">Theo dõi duyệt và mở nhanh quản lý phòng.</p></div><Button asChild size="sm" variant="secondary"><Link to="/partner/hotels">Quản lý khách sạn</Link></Button></div>
      {hotels.data.data.length ? <div className="mt-4 divide-y divide-slate-100">{hotels.data.data.map(hotel => <div key={hotel.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{hotel.name}</p><p className="text-sm text-slate-500">{hotel.address}{hotel.rejectionReason ? ` · Lý do: ${hotel.rejectionReason}` : ''}</p></div><div className="flex items-center gap-3"><StatusBadge status={hotel.status} /><Link className="text-sm font-semibold text-[#1E3A5F]" to={`/partner/hotels/${hotel.id}/edit`}>Chi tiết</Link></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Chưa có hồ sơ khách sạn.</p>}
    </Card>
    {pending.length > 0 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Có {pending.length} hồ sơ đang chờ duyệt. Bạn có thể theo dõi trạng thái tại danh sách khách sạn.</p>}
  </div>
}

export function PartnerRoomsPage() {
  const [params, setParams] = useSearchParams()
  const selectedHotel = params.get('hotelId') ?? ''
  const hotels = usePartnerHotels()
  const rooms = useQuery({
    queryKey: ['partner-managed-rooms', selectedHotel],
    enabled: Boolean(hotels.data),
    queryFn: async () => {
      const owned = hotels.data!.data.filter(hotel => !selectedHotel || hotel.id === selectedHotel)
      const pages = await Promise.all(owned.map(hotel => api.managedRooms(hotel.id)))
      return pages.flatMap(page => page.data)
    },
  })
  const setHotel = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('hotelId', value); else next.delete('hotelId')
    setParams(next, { replace: true })
  }
  if (hotels.isPending || rooms.isPending) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (rooms.isError) return <ErrorState message={errorMessage(rooms.error)} retry={() => { void rooms.refetch() }} />
  const hotelName = (id: string) => hotels.data?.data.find(hotel => hotel.id === id)?.name ?? 'Khách sạn'
  return <div>
    <PageHeader title="Quản lý phòng" description="Tạo và cập nhật phòng theo khách sạn, sức chứa, giá và trạng thái khai thác." actions={<Button asChild><Link to="/partner/rooms/new"><Plus size={16} />Thêm phòng</Link></Button>} />
    <div className="mb-5 max-w-sm"><FormField label="Khách sạn"><select value={selectedHotel} onChange={event => setHotel(event.target.value)}><option value="">Tất cả khách sạn</option>{hotels.data?.data.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField></div>
    {rooms.data?.length ? <Card className="table-scroll"><table><thead><tr><th>Phòng</th><th>Khách sạn</th><th>Sức chứa</th><th>Giá / đêm</th><th>Tiện nghi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rooms.data.map(room => <tr key={room.id}>
      <td><strong>{room.roomNumber}</strong><span className="block text-xs text-slate-500">{room.roomType}</span></td><td>{hotelName(room.hotelId)}</td><td>{room.maxOccupancy} khách</td><td>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: room.currency }).format(room.pricePerNight)}</td><td>{room.amenities.map(item => item.name).join(', ') || '—'}</td><td><StatusBadge status={room.operationalStatus} /><span className="sr-only">{statusLabels[room.operationalStatus]}</span></td><td><Link className="font-semibold text-[#1E3A5F] hover:underline" to={`/partner/rooms/${room.id}/edit`}>Chi tiết / sửa</Link></td>
    </tr>)}</tbody></table></Card> : <EmptyState title="Chưa có phòng" description="Thêm phòng cho khách sạn đã được kích hoạt để bắt đầu quản lý." action={<Button asChild><Link to="/partner/rooms/new"><Plus size={16} />Thêm phòng</Link></Button>} />}
  </div>
}

function initialRoom(room?: ManagedRoom, hotels: PartnerHotel[] = []): ManagedRoomInput {
  return {
    hotelId: room?.hotelId ?? hotels.find(hotel => hotel.status === 'ACTIVE')?.id ?? hotels[0]?.id ?? '',
    roomNumber: room?.roomNumber ?? '', maxOccupancy: room?.maxOccupancy ?? 2,
    pricePerNight: room?.pricePerNight ?? 0, currency: room?.currency ?? 'VND',
    description: room?.description ?? '', operationalStatus: room?.operationalStatus ?? 'AVAILABLE',
    roomType: room?.roomType ?? '', amenityIds: room?.amenities.map(item => item.id) ?? [],
  }
}

export function PartnerRoomFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hotels = usePartnerHotels()
  const room = useQuery({ queryKey: ['partner-managed-room', id], queryFn: () => api.managedRoom(id!), enabled: Boolean(id) })
  const amenities = useQuery({ queryKey: ['amenities'], queryFn: api.amenities })
  const [draft, setDraft] = useState<ManagedRoomInput | null>(null)
  const [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const form = draft ?? initialRoom(room.data, hotels.data?.data)
  const hotelAmenities = useQuery({ queryKey: ['partner-hotel-amenities', form.hotelId], queryFn: () => api.hotelAmenities(form.hotelId), enabled: Boolean(form.hotelId) })
  const availableHotels = hotels.data?.data ?? []
  const selectableHotels = id ? availableHotels : availableHotels.filter(hotel => hotel.status === 'ACTIVE')
  const update = <K extends keyof ManagedRoomInput>(key: K, value: ManagedRoomInput[K]) => setDraft(current => ({ ...(current ?? form), [key]: value }))

  if (hotels.isPending || amenities.isPending || hotelAmenities.isPending || (id && room.isPending)) return <LoadingState />
  if (hotels.isError) return <ErrorState message={errorMessage(hotels.error)} retry={() => { void hotels.refetch() }} />
  if (amenities.isError) return <ErrorState message={errorMessage(amenities.error)} retry={() => { void amenities.refetch() }} />
  if (hotelAmenities.isError) return <ErrorState message={errorMessage(hotelAmenities.error)} retry={() => { void hotelAmenities.refetch() }} />
  if (id && room.isError) return <ErrorState message={errorMessage(room.error)} retry={() => { void room.refetch() }} />
  if (id && !room.data) return <EmptyState title="Không tìm thấy phòng" />
  if (!selectableHotels.length) return <EmptyState title="Chưa có khách sạn hoạt động" description="Khách sạn cần được duyệt và kích hoạt trước khi thêm phòng." action={<Button asChild variant="secondary"><Link to="/partner/hotels">Đến quản lý khách sạn</Link></Button>} />

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = { ...form, description: form.description?.trim() || null }
      if (id) await api.updateManagedRoom(id, payload)
      else await api.createManagedRoom(payload)
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-rooms'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-room', id] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      navigate('/partner/rooms')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!id) return
    setBusy(true); setError('')
    try {
      await api.deleteManagedRoom(id)
      await queryClient.invalidateQueries({ queryKey: ['partner-managed-rooms'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      navigate('/partner/rooms')
    } catch (cause) { setError(errorMessage(cause)); setDeleteOpen(false) }
    finally { setBusy(false) }
  }
  return <div>
    <Link className="text-sm font-semibold text-[#1E3A5F] hover:underline" to="/partner/rooms">← Danh sách phòng</Link>
    <div className="mt-5"><PageHeader title={id ? `Phòng ${room.data?.roomNumber}` : 'Thêm phòng'} description="Thông tin phòng được lưu trực tiếp vào hệ thống." actions={room.data && <StatusBadge status={room.data.operationalStatus} />} /></div>
    <Card className="max-w-4xl p-6"><form className="grid gap-4" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Khách sạn"><select required value={form.hotelId} onChange={event => update('hotelId', event.target.value)}>{selectableHotels.map(hotel => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></FormField>
        <FormField label="Số / mã phòng"><input required maxLength={30} value={form.roomNumber} onChange={event => update('roomNumber', event.target.value)} /></FormField>
        <FormField label="Loại phòng"><input required maxLength={60} value={form.roomType} onChange={event => update('roomType', event.target.value)} placeholder="Phòng Deluxe, Suite..." /></FormField>
        <FormField label="Sức chứa tối đa"><input required type="number" min="1" max="100" value={form.maxOccupancy} onChange={event => update('maxOccupancy', Number(event.target.value))} /></FormField>
        <FormField label="Giá / đêm"><input required type="number" min="0" step="1000" value={form.pricePerNight} onChange={event => update('pricePerNight', Number(event.target.value))} /></FormField>
        <FormField label="Tiền tệ"><select value={form.currency} onChange={event => update('currency', event.target.value)}><option value="VND">VND</option><option value="USD">USD</option></select></FormField>
        <FormField label="Trạng thái khai thác"><select value={form.operationalStatus} onChange={event => update('operationalStatus', event.target.value as RoomOperationalStatus)}>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></FormField>
      </div>
      <FormField label="Mô tả"><textarea maxLength={5000} value={form.description ?? ''} onChange={event => update('description', event.target.value)} /></FormField>
      <fieldset className="rounded-lg border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">Tiện nghi</legend><div className="grid gap-2 sm:grid-cols-2">{[...(amenities.data?.data ?? []), ...(hotelAmenities.data?.data ?? [])].map(item => <label key={item.id} className="flex items-center gap-2 text-sm"><input className="!m-0 !h-4 !w-4 !min-h-0" type="checkbox" checked={form.amenityIds.includes(item.id)} onChange={event => update('amenityIds', event.target.checked ? [...form.amenityIds, item.id] : form.amenityIds.filter(value => value !== item.id))} />{item.name}{hotelAmenities.data?.data.some(custom => custom.id === item.id) && <span className="text-xs text-slate-500">(riêng khách sạn)</span>}</label>)}</div>{!(amenities.data?.data.length || hotelAmenities.data?.data.length) && <p className="text-sm text-slate-500">Chưa có tiện nghi trong danh mục.</p>}<Link className="mt-3 inline-block text-sm font-semibold text-[#1E3A5F] hover:underline" to="/partner/amenities">Quản lý tiện nghi khách sạn</Link></fieldset>
      <Feedback message={error} kind="error" />
      <div className="flex flex-wrap gap-2"><Button disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu phòng'}</Button><Button asChild type="button" variant="secondary"><Link to="/partner/rooms">Hủy</Link></Button>{id && <Button type="button" variant="danger" className="sm:ml-auto" onClick={() => setDeleteOpen(true)}><Trash2 size={16} />Xóa phòng</Button>}</div>
    </form></Card>
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent title="Xóa phòng?" description={`Phòng ${room.data?.roomNumber} sẽ bị xóa khỏi khách sạn.`}><p className="text-sm text-slate-600">Xác nhận xóa phòng này. Thao tác có thể bị backend từ chối nếu phòng đã có giao dịch liên quan.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>Hủy</Button><Button variant="danger" disabled={busy} onClick={() => { void remove() }}>{busy ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></div></DialogContent></Dialog>
  </div>
}
