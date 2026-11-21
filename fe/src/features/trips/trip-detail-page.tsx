import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Toast } from '@/components/ui/toast'
import { EmptyState, ErrorState, LoadingState } from '@/components/common'
import { addDay, errorMessage, nights } from '@/lib/utils'
import { repo } from '@/services'
import { useCatalog, useMyItineraries } from '@/hooks/data'
import { useSession } from '@/stores/session'
import type { Destination, Stopover, TravelActivity } from '@/types/domain'
import { ItineraryMap } from './itinerary-map-adapter'
import { ItineraryTray, type DeleteTarget } from './itinerary-tray'
import { defaultActivityTimes, defaultStopTimes, validateActivitySchedule, validateStopSchedule } from './trip-schedule'

export function TripDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const user = useSession(state => state.user)
  const { data, isLoading, error } = useMyItineraries()
  const { data: catalog } = useCatalog()
  const queryClient = useQueryClient()
  const [activeDay, setActiveDay] = useState('')
  const [activeStopId, setActiveStopId] = useState<string>()
  const [stopForm, setStopForm] = useState<Stopover | null>(null)
  const [activityForm, setActivityForm] = useState<TravelActivity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [mapCandidate, setMapCandidate] = useState<{ place: Destination; distance: number } | null>(null)
  const initialNotice = (location.state as { notice?: string } | null)?.notice
  const [toast, setToast] = useState<{ id: number; message: string; kind: 'success' | 'error' } | null>(() => initialNotice ? { id: 0, message: initialNotice, kind: initialNotice.startsWith('Đã') ? 'success' : 'error' } : null)
  const toastId = useRef(0)
  const closeToast = useCallback(() => setToast(null), [])
  const showToast = (message: string, kind: 'success' | 'error') => setToast({ id: ++toastId.current, message, kind })
  const trip = data?.trips.find(item => item.id === id)
  const stops = useMemo(() => [...(data?.stops.filter(stop => stop.tripId === trip?.id) ?? [])].sort((a, b) => a.start.localeCompare(b.start)), [data?.stops, trip?.id])
  const places = useMemo(() => (catalog?.destinations ?? []).filter(place => !place.city || place.city.toLocaleLowerCase('vi').includes((trip?.city ?? '').toLocaleLowerCase('vi'))), [catalog?.destinations, trip?.city])

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!trip) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy chuyến đi" /></div>

  const activities = data?.activities ?? []
  const days = Array.from({ length: Math.max(1, nights(trip.startDate, trip.endDate) + 1) }, (_, index) => addDay(trip.startDate, index))
  const activeDayKey = days.includes(activeDay) ? activeDay : (days[0] ?? trip.startDate)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-itineraries', user?.id] })

  const openStopForm = (date: string, place?: Destination) => {
    const times = defaultStopTimes(date, stops, activities)
    setActiveDay(date)
    setActiveStopId(undefined)
    setActivityForm(null)
    setMapCandidate(null)
    setStopForm({ id: '', tripId: trip.id, placeId: place?.id, name: place?.name ?? '', address: place?.region || place?.city || '', lat: place?.lat, lng: place?.lng, ...times, order: stops.length + 1, note: '' })
  }

  const openCustomStopForm = (name: string, point: [number, number], address?: string) => {
    const times = defaultStopTimes(activeDayKey, stops, activities)
    setActiveStopId(undefined)
    setActivityForm(null)
    setMapCandidate(null)
    setStopForm({ id: '', tripId: trip.id, name, address: address ?? '', lat: point[1], lng: point[0], ...times, order: stops.length + 1, note: '' })
  }

  const selectPlace = (place: Destination) => {
    if (stopForm && !stopForm.id) {
      setStopForm({ ...stopForm, placeId: place.id, name: place.name, address: place.region || place.city, lat: place.lat, lng: place.lng })
      return
    }
    setActiveStopId(undefined)
    setMapCandidate({ place, distance: 0 })
  }

  const handleMapClick = (point: [number, number], customStopName?: string, customStopAddress?: string) => {
    if (customStopName) {
      openCustomStopForm(customStopName, point, customStopAddress)
      return
    }
    const nearest = places.flatMap(place => Number.isFinite(place.lat) && Number.isFinite(place.lng) ? [{ place, distance: distanceKm(point, [place.lng!, place.lat!]) }] : []).sort((a, b) => a.distance - b.distance)[0]
    if (!nearest || nearest.distance > 5) {
      setMapCandidate(null)
      showToast('Không có địa điểm trong danh mục gần vị trí vừa chọn.', 'error')
      return
    }
    selectPlace(nearest.place)
    setMapCandidate({ place: nearest.place, distance: nearest.distance })
  }

  const saveStop = async () => {
    if (!stopForm) return
    const validationError = validateStopSchedule(trip, stopForm, stops)
    if (validationError) return showToast(validationError, 'error')
    const creating = !stopForm.id
    try {
      await repo.saveStop(user?.id ?? '', stopForm)
      await refresh()
      setActiveDay(stopForm.start.slice(0, 10))
      setStopForm(null)
      showToast(creating ? 'Đã thêm điểm dừng.' : 'Đã lưu thay đổi điểm dừng.', 'success')
    } catch (saveError) {
      showToast(errorMessage(saveError), 'error')
    }
  }

  const addActivity = (stop: Stopover) => {
    const times = defaultActivityTimes(stop, activities)
    setActiveDay(stop.start.slice(0, 10))
    setStopForm(null)
    setActivityForm({ id: '', stopId: stop.id, name: '', ...times, order: activities.filter(item => item.stopId === stop.id).length + 1, note: '', cost: 0 })
  }

  const saveActivity = async () => {
    if (!activityForm) return
    const stop = stops.find(item => item.id === activityForm.stopId)
    const validationError = stop ? validateActivitySchedule(stop, activityForm, activities) : 'Không tìm thấy điểm dừng của hoạt động.'
    if (validationError) return showToast(validationError, 'error')
    const creating = !activityForm.id
    try {
      await repo.saveActivity(user?.id ?? '', activityForm)
      await refresh()
      setActivityForm(null)
      showToast(creating ? 'Đã thêm hoạt động.' : 'Đã lưu thay đổi hoạt động.', 'success')
    } catch (saveError) {
      showToast(errorMessage(saveError), 'error')
    }
  }

  const selectStop = (stopId: string) => {
    const stop = stops.find(item => item.id === stopId)
    if (stop) setActiveDay(stop.start.slice(0, 10))
    setMapCandidate(null)
    setActiveStopId(stopId)
  }

  return <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
    {toast && <Toast key={toast.id} message={toast.message} kind={toast.kind} onClose={closeToast} />}
    <div className="grid min-h-0 gap-3 bg-slate-100 p-3 lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16 lg:z-30 lg:grid-cols-[clamp(420px,36vw,520px)_minmax(0,1fr)]">
      <ItineraryTray trip={trip} stops={stops} activities={activities} places={places} days={days} activeDay={activeDayKey} activeStopId={activeStopId} stopForm={stopForm} activityForm={activityForm} onChangeDay={setActiveDay} onAddStop={openStopForm} onEditStop={stop => { setActiveDay(stop.start.slice(0, 10)); setActivityForm(null); setStopForm(stop) }} onChangeStop={setStopForm} onSaveStop={saveStop} onCancelStop={() => setStopForm(null)} onAddActivity={addActivity} onEditActivity={setActivityForm} onChangeActivity={setActivityForm} onSaveActivity={saveActivity} onCancelActivity={() => setActivityForm(null)} onLocateStop={stop => selectStop(stop.id)} onDelete={setDeleteTarget} />

      <section className="relative min-h-[560px] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-full lg:min-h-0">
        <ItineraryMap city={trip.city} places={places} stops={stops} activeStopId={activeStopId} onMapClick={handleMapClick} onChoosePlace={selectPlace} onSelectStop={selectStop} />
        {mapCandidate && <section aria-label="Địa điểm đang chọn" className="absolute left-3 right-14 top-[4.5rem] z-20 max-w-lg rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[#1E3A5F]">{mapCandidate.place.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{mapCandidate.place.region || mapCandidate.place.city}{mapCandidate.distance > 0.05 ? ` · cách ${mapCandidate.distance.toFixed(1)} km` : ''}</p><Button size="sm" className="mt-2" onClick={() => openStopForm(activeDayKey, mapCandidate.place)}><Plus size={14} />Thêm vào lịch trình · Ngày {days.indexOf(activeDayKey) + 1}</Button></div><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Đóng địa điểm đang chọn" onClick={() => setMapCandidate(null)}><X size={15} /></Button></div></section>}
      </section>
    </div>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}><DialogContent title="Xác nhận xóa" description={`Bạn có chắc muốn xóa ${deleteTarget?.kind === 'stop' ? 'điểm dừng' : 'hoạt động'} này?`}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" onClick={async () => { if (!deleteTarget) return; try { if (deleteTarget.kind === 'stop') await repo.deleteStop(user?.id ?? '', deleteTarget.id, trip.id); else await repo.deleteActivity(user?.id ?? '', deleteTarget.id, deleteTarget.stopId); await refresh(); setDeleteTarget(null); setActiveStopId(undefined); showToast('Đã xóa khỏi lịch trình.', 'success') } catch (deleteError) { showToast(errorMessage(deleteError), 'error') } }}>Xóa</Button></div></DialogContent></Dialog>
  </div>
}

function distanceKm(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180
  const latitude = radians(b[1] - a[1])
  const longitude = radians(b[0] - a[0])
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(longitude / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
