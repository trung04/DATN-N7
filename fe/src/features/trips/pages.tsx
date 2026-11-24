import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Clock3, MapPin, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader, StatusBadge } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { repo } from '@/services'
import { currency, day, errorMessage, todayPlus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useCatalog, useMyItineraries } from '@/hooks/data'
import type { Itinerary, Stopover, TravelActivity } from '@/types/domain'
import { ItineraryMap } from './itinerary-map'

export function TripsPage() {
  const user = useSession(s => s.user)
  const { data, isLoading, error } = useMyItineraries()
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const trip = data?.trips.find(t => t.id === deleteId)
  return <div className="container-app section-pad"><PageHeader title="Chuyến đi của tôi" description="Quản lý lịch trình đã lưu, điểm dừng và hoạt động." actions={<div className="flex gap-2"><Button asChild variant="secondary"><Link to="/ai/trip-planner"><Sparkles size={16} />Gợi ý lịch trình</Link></Button><Button asChild><Link to="/trips/new"><Plus size={16} />Tạo thủ công</Link></Button></div>} /><Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} /><div className="mt-5">{data?.trips.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.trips.map(t => <Card className="p-5" key={t.id}><div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase text-[#1E3A5F]">{t.source === 'demo-planner' ? 'Lịch gợi ý' : 'Tạo thủ công'}</span><StatusBadge status={t.status} /></div><h2 className="mt-3 text-xl font-semibold">{t.name}</h2><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15} />{t.city}</p><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><CalendarDays size={15} />{day(t.startDate)} – {day(t.endDate)}</p><p className="mt-3 text-sm text-slate-600">{t.adults + t.children} khách · {currency(t.budget)}</p><div className="mt-5 flex flex-wrap gap-2"><Button asChild size="sm"><Link to={'/trips/' + t.id}>Xem chuyến đi</Link></Button><Button asChild variant="secondary" size="sm"><Link to={'/trips/' + t.id + '/edit'}>Sửa</Link></Button><Button variant="ghost" size="icon" aria-label={'Xóa ' + t.name} onClick={() => setDeleteId(t.id)}><Trash2 size={16} /></Button></div></Card>)}</div> : <EmptyState title="Chưa có chuyến đi" description="Tạo lịch trình thủ công hoặc dùng công cụ gợi ý." action={<Button asChild><Link to="/ai/trip-planner">Lập lịch trình</Link></Button>} />}</div><Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}><DialogContent title="Xóa chuyến đi?" description={trip ? 'Xóa ' + trip.name + ' sẽ xóa điểm dừng và hoạt động. Booking đã phát sinh vẫn còn hiệu lực.' : ''}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteId(null)}>Giữ lại</Button><Button variant="danger" onClick={async () => { try { await repo.deleteTrip(user?.id ?? '', deleteId ?? ''); setDeleteId(null); setMessage('Đã xóa chuyến đi.'); await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }) } catch (err) { setMessage(errorMessage(err)) } }}>Xóa chuyến đi</Button></div></DialogContent></Dialog></div>
}

const blankTrip = (city = 'Đà Nẵng', name = ''): Itinerary => ({ id: '', userId: '', name, city, startDate: todayPlus(7), endDate: todayPlus(9), adults: 2, children: 0, budget: 6000000, note: '', source: 'manual', status: 'SAVED' })
export function TripFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const user = useSession(s => s.user)
  const navigate = useNavigate()
  const { data, isLoading } = useMyItineraries()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [formDraft, setFormDraft] = useState<{ routeId?: string; form: Itinerary } | null>(null)
  const [message, setMessage] = useState('')
  const initialPlaceId = id ? null : searchParams.get('placeId')
  const initialCity = searchParams.get('city') ?? 'Đà Nẵng'
  const initialPlaceName = searchParams.get('placeName')
  const form = formDraft && formDraft.routeId === id ? formDraft.form : data?.trips.find(t => t.id === id) ?? blankTrip(initialCity, initialPlaceName ? 'Chuyến đi ' + initialPlaceName : '')
  if (isLoading) return <LoadingState />
  if (id && !data?.trips.some(t => t.id === id)) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy chuyến đi" /></div>
  const set = <K extends keyof Itinerary>(key: K, value: Itinerary[K]) => setFormDraft({ routeId: id, form: { ...form, [key]: value } })
  const cityOptions = [...new Set([form.city, ...(catalog?.destinations.map(place => place.city) ?? [])].filter(Boolean))]
  return <div className="container-app section-pad"><PageHeader title={id ? 'Chỉnh sửa chuyến đi' : 'Tạo chuyến đi thủ công'} description={initialPlaceId ? 'Lưu chuyến đi và địa điểm đã chọn vào lịch trình.' : 'Bạn có thể thêm điểm dừng và hoạt động sau khi lưu.'} /><Card className="max-w-2xl p-6"><form className="grid gap-4" onSubmit={async e => { e.preventDefault(); try { if (!form.name.trim() || !form.city.trim() || form.startDate > form.endDate || form.adults < 1 || form.budget <= 0) throw new Error('Vui lòng kiểm tra tên, điểm đến, thời gian, số khách và ngân sách.'); const selectedPlace = initialPlaceId ? catalog?.destinations.find(place => place.id === initialPlaceId) : undefined; if (initialPlaceId && !selectedPlace) throw new Error('Không tìm thấy địa điểm đã chọn. Hãy quay lại Khám phá và thử lại.'); if (selectedPlace && selectedPlace.city !== form.city) throw new Error('Thành phố chuyến đi phải trùng với thành phố của địa điểm đã chọn.'); const saved = await repo.saveTrip(user?.id ?? '', form); if (selectedPlace) { try { await repo.saveStop(user?.id ?? '', { id: '', tripId: saved.id, placeId: selectedPlace.id, name: selectedPlace.name, address: selectedPlace.region || selectedPlace.city, start: saved.startDate + 'T09:00', end: saved.startDate + 'T11:00', order: 1, note: '' }) } catch (err) { await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }); navigate('/trips/' + saved.id, { state: { notice: 'Chuyến đi đã được lưu, nhưng chưa thêm được địa điểm: ' + errorMessage(err) } }); return } } await queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] }); navigate('/trips/' + saved.id) } catch (err) { setMessage(errorMessage(err)) } }}><FormField label="Tên chuyến đi"><input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Đà Nẵng cùng gia đình" /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Điểm đến"><select required value={form.city} onChange={e => set('city', e.target.value)}>{cityOptions.map(city => <option key={city} value={city}>{city}</option>)}</select></FormField><FormField label="Ngân sách (VND)"><input type="number" min="1" value={form.budget} onChange={e => set('budget', Number(e.target.value))} /></FormField><FormField label="Bắt đầu"><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></FormField><FormField label="Kết thúc"><input type="date" min={form.startDate} value={form.endDate} onChange={e => set('endDate', e.target.value)} /></FormField><FormField label="Người lớn"><input type="number" min="1" value={form.adults} onChange={e => set('adults', Number(e.target.value))} /></FormField><FormField label="Trẻ em"><input type="number" min="0" value={form.children} onChange={e => set('children', Number(e.target.value))} /></FormField></div><FormField label="Ghi chú"><textarea value={form.note} onChange={e => set('note', e.target.value)} /></FormField><Feedback message={message} kind="error" /><div className="flex gap-2"><Button>{initialPlaceId ? 'Lưu chuyến đi và địa điểm' : 'Lưu chuyến đi'}</Button><Button asChild variant="secondary"><Link to={id ? '/trips/' + id : '/trips'}>Hủy</Link></Button></div></form></Card></div>
}

export function TripDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const user = useSession(s => s.user)
  const { data, isLoading, error } = useMyItineraries()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [stopForm, setStopForm] = useState<Stopover | null>(null)
  const [activityForm, setActivityForm] = useState<TravelActivity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'stop' | 'activity'; id: string; stopId?: string } | null>(null)
  const [message, setMessage] = useState((location.state as { notice?: string } | null)?.notice ?? '')
  const [activeStopId, setActiveStopId] = useState<string>()
  const [mapCandidate, setMapCandidate] = useState<{ place: NonNullable<typeof catalog>['destinations'][number]; distance: number } | null>(null)
  const trip = data?.trips.find(t => t.id === id)
  const stops = useMemo(() => (data?.stops.filter(s => s.tripId === trip?.id) ?? []).sort((a, b) => a.start.localeCompare(b.start)), [data?.stops, trip?.id])
  const tripPlaces = useMemo(() => (catalog?.destinations ?? []).filter(place => !place.city || place.city.toLocaleLowerCase('vi').includes((trip?.city ?? '').toLocaleLowerCase('vi'))), [catalog?.destinations, trip?.city])
  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!trip) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy chuyến đi" action={<Button asChild><Link to="/trips">Về danh sách</Link></Button>} /></div>
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] })
  const newStop = (place?: NonNullable<typeof catalog>['destinations'][number]) => setStopForm({ id: '', tripId: trip.id, placeId: place?.id ?? '', name: place?.name ?? '', address: place?.region ?? place?.city ?? '', start: trip.startDate + 'T09:00', end: trip.startDate + 'T11:00', order: stops.length + 1, note: '' })
  const newCustomStop = (name: string, point: [number, number], address?: string) => {
    setMapCandidate(null)
    setMessage('')
    setStopForm({ id: '', tripId: trip.id, name, address: address ?? '', lat: point[1], lng: point[0], start: trip.startDate + 'T09:00', end: trip.startDate + 'T11:00', order: stops.length + 1, note: '' })
  }
  const distanceKm = (a: [number, number], b: [number, number]) => {
    const radians = (value: number) => value * Math.PI / 180
    const dLat = radians(b[1] - a[1]); const dLng = radians(b[0] - a[0])
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLng / 2) ** 2
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  }
  const closestPlace = (point: [number, number]) => {
    const candidates = tripPlaces.flatMap(place => Number.isFinite(place.lat) && Number.isFinite(place.lng) ? [{ place, distance: distanceKm(point, [place.lng!, place.lat!]) }] : []).sort((a, b) => a.distance - b.distance)
    const nearest = candidates[0]
    if (!nearest || nearest.distance > 5) {
      setMapCandidate(null)
      setMessage('Không có địa điểm trong danh mục gần vị trí vừa chọn. Hãy bấm gần một ghim địa điểm trên bản đồ.')
      return
    }
    setMessage('')
    setMapCandidate(nearest)
  }
  const handleMapClick = (point: [number, number], customStopName?: string, customStopAddress?: string) => {
    if (customStopName) newCustomStop(customStopName, point, customStopAddress)
    else closestPlace(point)
  }
  const selectPlaceOnMap = (place: NonNullable<typeof catalog>['destinations'][number]) => {
    setMapCandidate({ place, distance: 0 })
    setMessage('')
  }
  return <div className="container-app section-pad">
    <Link className="text-sm text-[#1E3A5F]" to="/trips">← Chuyến đi của tôi</Link>
    <div className="mt-5"><PageHeader title={trip.name} description={trip.city + ' · ' + day(trip.startDate) + ' – ' + day(trip.endDate) + ' · ' + (trip.adults + trip.children) + ' khách'} actions={<div className="flex gap-2"><Button asChild variant="secondary"><Link to={'/trips/' + trip.id + '/edit'}>Sửa chuyến đi</Link></Button><Button onClick={() => newStop()}><Plus size={16} />Thêm điểm dừng</Button></div>} /></div>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-slate-500">Ngân sách</p><p className="mt-1 font-semibold">{currency(trip.budget)}</p></Card><Card className="p-4"><p className="text-xs text-slate-500">Điểm dừng</p><p className="mt-1 font-semibold">{stops.length}</p></Card><Card className="p-4"><p className="text-xs text-slate-500">Nguồn</p><p className="mt-1 font-semibold">{trip.source === 'demo-planner' ? 'Lịch trình gợi ý' : 'Tạo thủ công'}</p></Card></div>
    <Feedback message={message} kind={message.startsWith('Đã') ? 'success' : 'error'} />
    <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
      <section className="grid gap-4">
        {stops.length ? stops.map((stop, index) => <Card key={stop.id} className={'p-5 transition-shadow ' + (activeStopId === stop.id ? 'ring-2 ring-[#1E3A5F]' : '')}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold text-[#1E3A5F]">ĐIỂM DỪNG {index + 1}</span><h2 className="mt-1 text-xl font-semibold">{stop.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{stop.address || trip.city}</p><p className="mt-2 flex items-center gap-1 text-sm text-slate-600"><Clock3 size={14} />{stop.start.replace('T', ' ')} → {stop.end.replace('T', ' ')}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setActiveStopId(stop.id)}>Trên bản đồ</Button><Button size="sm" variant="secondary" onClick={() => setStopForm(stop)}>Sửa</Button><Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ kind: 'stop', id: stop.id })}>Xóa</Button></div></div>
          {stop.note && <p className="mt-3 text-sm text-slate-600">{stop.note}</p>}
          <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Hoạt động</h3><Button size="sm" variant="secondary" onClick={() => setActivityForm({ id: '', stopId: stop.id, name: '', start: stop.start, end: stop.end, order: (data?.activities.filter(item => item.stopId === stop.id).length ?? 0) + 1, note: '', cost: 0 })}><Plus size={15} />Thêm</Button></div><div className="mt-3 grid gap-2">{data?.activities.filter(a => a.stopId === stop.id).sort((a, b) => a.start.localeCompare(b.start)).map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><div><span className="font-medium">{a.name}</span><span className="ml-2 text-slate-500">{a.start.slice(11, 16)}–{a.end.slice(11, 16)}</span>{a.cost > 0 && <span className="ml-2 text-slate-500">{currency(a.cost)}</span>}</div><div className="flex gap-2"><button className="font-semibold text-[#1E3A5F] hover:underline" onClick={() => setActivityForm(a)}>Sửa</button><button className="text-red-700 hover:underline" onClick={() => setDeleteTarget({ kind: 'activity', id: a.id, stopId: stop.id })}>Xóa</button></div></div>)}{!data?.activities.some(a => a.stopId === stop.id) && <p className="text-sm text-slate-500">Chưa có hoạt động.</p>}</div></div>
        </Card>) : <EmptyState title="Chưa có điểm dừng" description="Thêm điểm dừng đầu tiên để xây dựng lịch trình." action={<Button onClick={() => newStop()}>Thêm điểm dừng</Button>} />}
      </section>
      <aside className="lg:sticky lg:top-5">
        <div className="mb-3"><h2 className="text-lg font-semibold text-[#1E3A5F]">Lộ trình trên bản đồ</h2><p className="mt-1 text-sm text-slate-500">Bấm lên bản đồ hoặc ghim địa điểm để chọn điểm dừng.</p></div>
        <div className="relative h-[460px] overflow-hidden rounded-2xl lg:h-[calc(100vh-220px)] lg:min-h-[520px]">
          <ItineraryMap city={trip.city} places={tripPlaces} stops={stops} activeStopId={activeStopId} onMapClick={handleMapClick} onChoosePlace={selectPlaceOnMap} onSelectStop={setActiveStopId} />
          {mapCandidate && <div className="absolute left-3 right-14 top-[4.5rem] z-20 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><div className="min-w-0"><p className="truncate font-semibold text-[#1E3A5F]">{mapCandidate.place.name}</p><p className="mt-0.5 text-xs text-slate-500">{mapCandidate.place.region || mapCandidate.place.city}{mapCandidate.distance > 0.05 ? ` · cách ${mapCandidate.distance.toFixed(1)} km` : ''}</p><Button size="sm" className="mt-2" onClick={() => { newStop(mapCandidate.place); setMapCandidate(null) }}><Plus size={14} />Thêm vào lịch trình</Button></div><button type="button" aria-label="Đóng địa điểm đang chọn" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setMapCandidate(null)}><X size={17} /></button></div>}
        </div>
        {!tripPlaces.some(place => Number.isFinite(place.lat) && Number.isFinite(place.lng)) && <p className="mt-2 text-sm text-amber-700">Các địa điểm trong thành phố này chưa có tọa độ để hiển thị trên bản đồ.</p>}
      </aside>
    </div>
    <Dialog open={!!stopForm} onOpenChange={open => !open && setStopForm(null)}><DialogContent title={stopForm?.id ? 'Sửa điểm dừng' : 'Thêm điểm dừng'}><form className="grid gap-3" onSubmit={async e => { e.preventDefault(); if (!stopForm) return; try { await repo.saveStop(user?.id ?? '', stopForm); await refresh(); setStopForm(null); setMessage('Đã lưu điểm dừng.') } catch (err) { setMessage(errorMessage(err)) } }}>{stopForm && <>{Number.isFinite(stopForm.lat) && Number.isFinite(stopForm.lng) ? <><FormField label="Tên điểm dừng"><input required value={stopForm.name} onChange={e => setStopForm({ ...stopForm, name: e.target.value })} /></FormField><FormField label="Địa chỉ"><input value={stopForm.address} onChange={e => setStopForm({ ...stopForm, address: e.target.value })} /></FormField><p className="text-xs text-slate-500">Vị trí đã ghim: {stopForm.lat?.toFixed(5)}, {stopForm.lng?.toFixed(5)}</p></> : <><FormField label="Địa điểm trong danh mục"><select required value={stopForm.placeId ?? ''} onChange={e => { const place = catalog?.destinations.find(item => item.id === e.target.value); setStopForm({ ...stopForm, placeId: place?.id, name: place?.name ?? '', address: place?.region ?? place?.city ?? '' }) }}><option value="">Chọn địa điểm</option>{tripPlaces.map(place => <option key={place.id} value={place.id}>{place.name} · {place.city}</option>)}</select></FormField></>}{!tripPlaces.length && !Number.isFinite(stopForm.lat) && <p className="text-sm text-amber-700">Chưa có địa điểm nào trong danh mục phù hợp với thành phố của chuyến đi.</p>}<div className="grid gap-3 sm:grid-cols-2"><FormField label="Thời gian đến"><input required type="datetime-local" value={stopForm.start} onChange={e => setStopForm({ ...stopForm, start: e.target.value })} /></FormField><FormField label="Thời gian rời"><input required type="datetime-local" value={stopForm.end} onChange={e => setStopForm({ ...stopForm, end: e.target.value })} /></FormField></div><FormField label="Ghi chú"><textarea value={stopForm.note} onChange={e => setStopForm({ ...stopForm, note: e.target.value })} /></FormField><Button disabled={!tripPlaces.length && !(Number.isFinite(stopForm.lat) && Number.isFinite(stopForm.lng))}>Lưu điểm dừng</Button></>}</form></DialogContent></Dialog>
    <Dialog open={!!activityForm} onOpenChange={open => !open && setActivityForm(null)}><DialogContent title={activityForm?.id ? 'Sửa hoạt động' : 'Thêm hoạt động'}><form className="grid gap-3" onSubmit={async e => { e.preventDefault(); if (!activityForm) return; try { await repo.saveActivity(user?.id ?? '', activityForm); await refresh(); setActivityForm(null); setMessage('Đã lưu hoạt động.') } catch (err) { setMessage(errorMessage(err)) } }}>{activityForm && <><FormField label="Tên hoạt động"><input required value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })} /></FormField><div className="grid gap-3 sm:grid-cols-2"><FormField label="Bắt đầu"><input type="datetime-local" value={activityForm.start} onChange={e => setActivityForm({ ...activityForm, start: e.target.value })} /></FormField><FormField label="Kết thúc"><input type="datetime-local" value={activityForm.end} onChange={e => setActivityForm({ ...activityForm, end: e.target.value })} /></FormField></div><FormField label="Chi phí ước tính (VND)"><input type="number" min="0" value={activityForm.cost} onChange={e => setActivityForm({ ...activityForm, cost: Number(e.target.value) })} /></FormField><FormField label="Ghi chú"><textarea value={activityForm.note} onChange={e => setActivityForm({ ...activityForm, note: e.target.value })} /></FormField><Button>Lưu hoạt động</Button></>}</form></DialogContent></Dialog>
    <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}><DialogContent title="Xác nhận xóa" description="Thao tác này sẽ cập nhật lịch trình."><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" onClick={async () => { if (!deleteTarget) return; try { if (deleteTarget.kind === 'stop') await repo.deleteStop(user?.id ?? '', deleteTarget.id, trip.id); else await repo.deleteActivity(user?.id ?? '', deleteTarget.id, deleteTarget.stopId); await refresh(); setDeleteTarget(null); setMessage('Đã xóa khỏi lịch trình.') } catch (err) { setMessage(errorMessage(err)) } }}>Xóa</Button></div></DialogContent></Dialog>
  </div>
}
