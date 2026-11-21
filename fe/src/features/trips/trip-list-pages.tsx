import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo } from '@/services'
import { currency, day, errorMessage, todayPlus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useCatalog, useMyItineraries } from '@/hooks/data'
import type { Itinerary } from '@/types/domain'

export function TripsPage() {
  const user = useSession(state => state.user)
  const { data, isLoading, error } = useMyItineraries()
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const trip = data?.trips.find(item => item.id === deleteId)
  return <div className="container-app section-pad">
    <PageHeader title="Chuyến đi của tôi" description="Quản lý lịch trình đã lưu, điểm dừng và hoạt động." actions={<div className="flex gap-2"><Button asChild variant="secondary"><Link to="/ai/trip-planner"><Sparkles size={16} />Tạo bằng demo</Link></Button><Button asChild><Link to="/trips/new"><Plus size={16} />Tạo thủ công</Link></Button></div>} />
    <Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} />
    <div className="mt-5">{data?.trips.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.trips.map(item => <Card className="p-5" key={item.id}><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase text-[#1E3A5F]">{item.source === 'demo-planner' ? 'Lịch demo' : 'Tạo thủ công'}</span><StatusBadge status={item.status} /></div><h2 className="mt-3 text-xl font-semibold">{item.name}</h2><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15} />{item.city}</p><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><CalendarDays size={15} />{day(item.startDate)} – {day(item.endDate)}</p><p className="mt-3 text-sm text-slate-600">{item.adults + item.children} khách · {currency(item.budget)}</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={`/trips/${item.id}`}>Xem chuyến đi</Link></Button><Button asChild variant="secondary" size="sm"><Link to={`/trips/${item.id}/edit`}>Sửa</Link></Button><Button variant="ghost" size="icon" aria-label={`Xóa ${item.name}`} onClick={() => setDeleteId(item.id)}><Trash2 size={16} /></Button></div></Card>)}</div> : <EmptyState title="Chưa có chuyến đi" description="Tạo lịch trình thủ công hoặc dùng công cụ gợi ý demo." action={<Button asChild><Link to="/ai/trip-planner">Lập lịch trình</Link></Button>} />}</div>
    <Dialog open={Boolean(deleteId)} onOpenChange={open => !open && setDeleteId(null)}><DialogContent title="Xóa chuyến đi?" description={trip ? `Xóa ${trip.name} sẽ xóa điểm dừng và hoạt động. Booking đã phát sinh vẫn còn hiệu lực.` : ''}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteId(null)}>Giữ lại</Button><Button variant="danger" onClick={async () => { try { await repo.deleteTrip(user?.id ?? '', deleteId ?? ''); setDeleteId(null); setMessage('Đã xóa chuyến đi.'); await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }) } catch (deleteError) { setMessage(errorMessage(deleteError)) } }}>Xóa chuyến đi</Button></div></DialogContent></Dialog>
  </div>
}

const blankTrip = (city = 'Đà Nẵng', name = ''): Itinerary => ({ id: '', userId: '', name, city, startDate: todayPlus(7), endDate: todayPlus(9), adults: 2, children: 0, budget: 6000000, note: '', source: 'manual', status: 'SAVED' })

export function TripFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const user = useSession(state => state.user)
  const navigate = useNavigate()
  const { data, isLoading } = useMyItineraries()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [formDraft, setFormDraft] = useState<{ routeId?: string; form: Itinerary } | null>(null)
  const [message, setMessage] = useState('')
  const initialPlaceId = id ? null : searchParams.get('placeId')
  const initialCity = searchParams.get('city') ?? 'Đà Nẵng'
  const initialPlaceName = searchParams.get('placeName')
  const form = formDraft && formDraft.routeId === id ? formDraft.form : data?.trips.find(item => item.id === id) ?? blankTrip(initialCity, initialPlaceName ? `Chuyến đi ${initialPlaceName}` : '')
  if (isLoading) return <LoadingState />
  if (id && !data?.trips.some(item => item.id === id)) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy chuyến đi" /></div>
  const set = <K extends keyof Itinerary>(key: K, value: Itinerary[K]) => setFormDraft({ routeId: id, form: { ...form, [key]: value } })
  const cityOptions = [...new Set([form.city, ...(catalog?.destinations.map(place => place.city) ?? [])].filter(Boolean))]
  return <div className="container-app section-pad"><PageHeader title={id ? 'Chỉnh sửa chuyến đi' : 'Tạo chuyến đi thủ công'} description={initialPlaceId ? 'Lưu chuyến đi và địa điểm đã chọn vào lịch trình.' : 'Bạn có thể thêm điểm dừng và hoạt động sau khi lưu.'} /><Card className="max-w-2xl p-6"><form className="grid gap-4" onSubmit={async event => { event.preventDefault(); try { if (!form.name.trim() || !form.city.trim() || form.startDate > form.endDate || form.adults < 1 || form.budget <= 0) throw new Error('Vui lòng kiểm tra tên, điểm đến, thời gian, số khách và ngân sách.'); const selectedPlace = initialPlaceId ? catalog?.destinations.find(place => place.id === initialPlaceId) : undefined; if (initialPlaceId && !selectedPlace) throw new Error('Không tìm thấy địa điểm đã chọn. Hãy quay lại Khám phá và thử lại.'); if (selectedPlace && selectedPlace.city !== form.city) throw new Error('Thành phố chuyến đi phải trùng với thành phố của địa điểm đã chọn.'); const saved = await repo.saveTrip(user?.id ?? '', form); if (selectedPlace) { try { await repo.saveStop(user?.id ?? '', { id: '', tripId: saved.id, placeId: selectedPlace.id, name: selectedPlace.name, address: selectedPlace.region || selectedPlace.city, start: `${saved.startDate}T09:00`, end: `${saved.startDate}T11:00`, order: 1, note: '' }) } catch (savePlaceError) { await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }); navigate(`/trips/${saved.id}`, { state: { notice: `Chuyến đi đã được lưu, nhưng chưa thêm được địa điểm: ${errorMessage(savePlaceError)}` } }); return } } await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }); navigate(`/trips/${saved.id}`) } catch (saveError) { setMessage(errorMessage(saveError)) } }}><FormField label="Tên chuyến đi"><input required value={form.name} onChange={event => set('name', event.target.value)} placeholder="Ví dụ: Đà Nẵng cùng gia đình" /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Điểm đến"><select required value={form.city} onChange={event => set('city', event.target.value)}>{cityOptions.map(city => <option key={city} value={city}>{city}</option>)}</select></FormField><FormField label="Ngân sách (VND)"><input type="number" min="1" value={form.budget} onChange={event => set('budget', Number(event.target.value))} /></FormField><FormField label="Bắt đầu"><input type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} /></FormField><FormField label="Kết thúc"><input type="date" min={form.startDate} value={form.endDate} onChange={event => set('endDate', event.target.value)} /></FormField><FormField label="Người lớn"><input type="number" min="1" value={form.adults} onChange={event => set('adults', Number(event.target.value))} /></FormField><FormField label="Trẻ em"><input type="number" min="0" value={form.children} onChange={event => set('children', Number(event.target.value))} /></FormField></div><FormField label="Ghi chú"><textarea value={form.note} onChange={event => set('note', event.target.value)} /></FormField><Feedback message={message} kind="error" /><div className="flex gap-2"><Button>{initialPlaceId ? 'Lưu chuyến đi và địa điểm' : 'Lưu chuyến đi'}</Button><Button asChild variant="secondary"><Link to={id ? `/trips/${id}` : '/trips'}>Hủy</Link></Button></div></form></Card></div>
}
