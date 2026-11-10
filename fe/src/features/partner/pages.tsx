import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BedDouble, CalendarDays, Hotel, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { repo } from '@/services'
import { addDay, currency, day, errorMessage, todayPlus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { usePartnerData } from '@/hooks/data'
import type { RoomType } from '@/types/domain'

export function PartnerDashboard() {
  const { data, isLoading, error } = usePartnerData()
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  const today = todayPlus(0)
  const offered = data?.inventory.filter(i => data.rooms.some(r => r.id === i.roomId) && i.date === today).reduce((n, i) => n + i.offered, 0) ?? 0
  const held = data?.bookings.filter(b => data.rooms.some(r => r.id === b.roomId) && b.status === 'PENDING_PAYMENT' && b.holdExpiresAt > new Date().toISOString() && b.checkIn <= today && today < b.checkOut).reduce((n, b) => n + b.rooms, 0) ?? 0
  const sold = data?.bookings.filter(b => data.rooms.some(r => r.id === b.roomId) && (b.status === 'CONFIRMED' || b.status === 'COMPLETED') && b.checkIn <= today && today < b.checkOut).reduce((n, b) => n + b.rooms, 0) ?? 0
  return <div><PageHeader title="Tổng quan đối tác" description="Thông tin khách sạn và tồn phòng từ dữ liệu demo hiện có." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Khách sạn quản lý" value={String(data?.hotels.length ?? 0)} icon={<Hotel size={19} />} /><Stat label="Loại phòng" value={String(data?.rooms.length ?? 0)} icon={<BedDouble size={19} />} /><Stat label="Phòng bán hôm nay" value={String(offered)} icon={<CalendarDays size={19} />} /><Stat label="Còn nhận đặt hôm nay" value={String(Math.max(0, offered - held - sold))} icon={<BedDouble size={19} />} /></div><Card className="mt-6 p-6"><h2 className="text-lg font-semibold">Khách sạn được phân quyền</h2><div className="mt-4 grid gap-3">{data?.hotels.map(h => <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div><p className="font-semibold">{h.name}</p><p className="text-sm text-slate-500">{h.address}</p></div><Button asChild variant="secondary" size="sm"><Link to="/partner/rooms">Quản lý phòng</Link></Button></div>)}</div></Card></div>
}
function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <Card className="p-5"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{label}</span>{icon}</div><p className="mt-4 text-3xl font-semibold text-[#1E3A5F]">{value}</p></Card> }
export function PartnerRoomsPage() {
  const { data, isLoading, error } = usePartnerData()
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  return <div><PageHeader title="Loại phòng" description="Quản lý thông tin phòng theo loại, không theo từng phòng vật lý." actions={<Button asChild><Link to="/partner/rooms/new"><Plus size={16} />Thêm loại phòng</Link></Button>} />{data?.rooms.length ? <Card className="table-scroll"><table><thead><tr><th>Loại phòng</th><th>Khách sạn</th><th>Sức chứa</th><th>Giá cơ bản</th><th>Thao tác</th></tr></thead><tbody>{data.rooms.map(room => <tr key={room.id}><td><strong>{room.name}</strong><div className="mt-1 text-xs text-slate-500">{room.bed} · {room.area} m²</div></td><td>{data.hotels.find(h => h.id === room.hotelId)?.name}</td><td>{room.capacity} khách</td><td>{currency(room.basePrice)}</td><td><div className="flex gap-3"><Link className="font-semibold text-[#1E3A5F] hover:underline" to={'/partner/rooms/' + room.id + '/edit'}>Sửa</Link><Link className="font-semibold text-[#1E3A5F] hover:underline" to={'/partner/rooms/' + room.id + '/inventory'}>Lịch phòng</Link></div></td></tr>)}</tbody></table></Card> : <EmptyState title="Chưa có loại phòng" action={<Button asChild><Link to="/partner/rooms/new">Thêm loại phòng</Link></Button>} />}</div>
}
export function PartnerRoomFormPage() {
  const { id } = useParams()
  const user = useSession(s => s.user)
  const { data, isLoading } = usePartnerData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formDraft, setFormDraft] = useState<{ routeId?: string; form: RoomType } | null>(null)
  const [amenitiesDraft, setAmenitiesDraft] = useState<{ routeId?: string; value: string } | null>(null)
  const [message, setMessage] = useState('')
  const initial = data?.rooms.find(r => r.id === id) ?? { id: '', hotelId: data?.hotels[0]?.id ?? '', name: '', description: '', capacity: 2, area: 25, bed: '1 giường đôi', basePrice: 1000000, amenities: [] }
  const form = formDraft && formDraft.routeId === id ? formDraft.form : initial
  const amenities = amenitiesDraft && amenitiesDraft.routeId === id ? amenitiesDraft.value : initial.amenities.join(', ')
  if (isLoading) return <LoadingState />
  if (id && !data?.rooms.some(r => r.id === id)) return <EmptyState title="Không tìm thấy loại phòng" />
  const set = <K extends keyof RoomType>(key: K, value: RoomType[K]) => setFormDraft({ routeId: id, form: { ...form, [key]: value } })
  return <div><PageHeader title={id ? 'Chỉnh sửa loại phòng' : 'Thêm loại phòng'} description="Giá cơ bản dùng làm tham khảo; giá bán theo ngày có thể chỉnh trong lịch phòng." /><Card className="max-w-3xl p-6"><form className="grid gap-4" onSubmit={async e => { e.preventDefault(); try { await repo.saveRoom(user?.id ?? '', { ...form, amenities: amenities.split(',').map(x => x.trim()).filter(Boolean) }); await queryClient.invalidateQueries({ queryKey: ['partner'] }); navigate('/partner/rooms') } catch (err) { setMessage(errorMessage(err)) } }}><div className="grid gap-4 sm:grid-cols-2"><FormField label="Khách sạn"><select value={form.hotelId} onChange={e => set('hotelId', e.target.value)}>{data?.hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></FormField><FormField label="Tên loại phòng"><input required value={form.name} onChange={e => set('name', e.target.value)} /></FormField><FormField label="Sức chứa tối đa"><input type="number" min="1" value={form.capacity} onChange={e => set('capacity', Number(e.target.value))} /></FormField><FormField label="Giá cơ bản / đêm (VND)"><input type="number" min="1" value={form.basePrice} onChange={e => set('basePrice', Number(e.target.value))} /></FormField><FormField label="Diện tích (m²)"><input type="number" min="1" value={form.area} onChange={e => set('area', Number(e.target.value))} /></FormField><FormField label="Loại giường"><input value={form.bed} onChange={e => set('bed', e.target.value)} /></FormField></div><FormField label="Mô tả"><textarea value={form.description} onChange={e => set('description', e.target.value)} /></FormField><FormField label="Tiện nghi" hint="Ngăn cách bằng dấu phẩy"><input value={amenities} onChange={e => setAmenitiesDraft({ routeId: id, value: e.target.value })} /></FormField><Feedback message={message} kind="error" /><div className="flex gap-2"><Button>Lưu loại phòng</Button><Button asChild variant="secondary"><Link to="/partner/rooms">Hủy</Link></Button></div></form></Card></div>
}
type InventoryDraft = { date: string; offered: number; price: number; revision: number }
export function PartnerInventoryPage() {
  const { id } = useParams()
  const user = useSession(s => s.user)
  const { data, isLoading, error } = usePartnerData()
  const queryClient = useQueryClient()
  const [start, setStart] = useState(todayPlus(0))
  const [edits, setEdits] = useState<Record<string, Partial<InventoryDraft>>>({})
  const [message, setMessage] = useState('')
  const room = data?.rooms.find(r => r.id === id)
  const draft: InventoryDraft[] = data && id && room
    ? Array.from({ length: 7 }, (_, i) => {
      const dayText = addDay(start, i)
      const current = data.inventory.find(row => row.roomId === id && row.date === dayText)
      return { date: dayText, offered: current?.offered ?? 0, price: current?.price ?? room.basePrice, revision: current?.revision ?? 0, ...edits[dayText] }
    })
    : []
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message={errorMessage(error)} />
  if (!room) return <EmptyState title="Không tìm thấy loại phòng" />
  const bookings = data?.bookings.filter(b => b.roomId === id) ?? []
  const counts = (date: string) => {
    const sold = bookings.filter(b => (b.status === 'CONFIRMED' || b.status === 'COMPLETED') && b.checkIn <= date && date < b.checkOut).reduce((n, b) => n + b.rooms, 0)
    const held = bookings.filter(b => b.status === 'PENDING_PAYMENT' && b.holdExpiresAt > new Date().toISOString() && b.checkIn <= date && date < b.checkOut).reduce((n, b) => n + b.rooms, 0)
    return { sold, held }
  }
  return <div><Link className="text-sm text-[#1E3A5F]" to="/partner/rooms">← Loại phòng</Link><div className="mt-5"><PageHeader title={'Lịch phòng · ' + room.name} description="Chỉ chỉnh phòng đưa lên bán và giá. Các số liệu đặt/giữ được hệ thống tính." /></div><div className="mb-5 max-w-xs"><FormField label="Bắt đầu từ ngày"><input type="date" value={start} onChange={e => setStart(e.target.value)} /></FormField></div><Card className="table-scroll"><table><thead><tr><th>Ngày</th><th>Phòng đưa lên bán</th><th>Đã đặt</th><th>Đang giữ</th><th>Còn nhận đặt</th><th>Giá / đêm (VND)</th></tr></thead><tbody>{draft.map(row => { const { sold, held } = counts(row.date); return <tr key={row.date}><td>{day(row.date)}</td><td><input aria-label={'Phòng bán ngày ' + day(row.date)} className="!mt-0 !w-28" type="number" min={sold + held} value={row.offered} onChange={e => setEdits(prev => ({ ...prev, [row.date]: { ...prev[row.date], offered: Number(e.target.value) } }))} /></td><td>{sold}</td><td>{held}</td><td className={row.offered < sold + held ? 'text-red-700' : 'font-semibold text-emerald-700'}>{row.offered - sold - held}</td><td><input aria-label={'Giá ngày ' + day(row.date)} className="!mt-0 !w-36" type="number" min="1" value={row.price} onChange={e => setEdits(prev => ({ ...prev, [row.date]: { ...prev[row.date], price: Number(e.target.value) } }))} /></td></tr> })}</tbody></table></Card><div className="mt-5 flex flex-wrap items-center gap-3"><Button onClick={async () => { try { await repo.saveInventory(user?.id ?? '', room.id, draft); await queryClient.invalidateQueries({ queryKey: ['partner'] }); await queryClient.invalidateQueries({ queryKey: ['catalog'] }); setMessage('Đã lưu lịch phòng và giá.') } catch (err) { setMessage(errorMessage(err)) } }}>Lưu thay đổi</Button><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /></div></div>
}
