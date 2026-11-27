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
import { useMyItineraries, usePublicPlace } from '@/hooks/data'
import { useSession } from '@/stores/session'
import type { Destination, Stopover, TravelActivity } from '@/types/domain'
import { ItineraryMap } from './itinerary-map-adapter'
import { ItineraryTray, type DeleteTarget } from './itinerary-tray'
import { defaultActivityTimes, defaultStopTimes, stopOverlapsDay, validateActivitySchedule, validateStopSchedule } from './trip-schedule'

export function TripDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const user = useSession(state => state.user)
  const { data, isLoading, error } = useMyItineraries()
  const queryClient = useQueryClient()
  const [activeDay, setActiveDay] = useState('')
  const [activeStopId, setActiveStopId] = useState<string>()
  const [stopForm, setStopForm] = useState<Stopover | null>(null)
  const [activityForm, setActivityForm] = useState<TravelActivity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>()
  const selectedPlace = usePublicPlace(selectedPlaceId)
  const initialNotice = (location.state as { notice?: string } | null)?.notice
  const [toast, setToast] = useState<{ id: number; message: string; kind: 'success' | 'error' } | null>(() => initialNotice ? { id: 0, message: initialNotice, kind: initialNotice.startsWith('Đã') ? 'success' : 'error' } : null)
  const toastId = useRef(0)
  const closeToast = useCallback(() => setToast(null), [])
  const showToast = (message: string, kind: 'success' | 'error') => setToast({ id: ++toastId.current, message, kind })
  const trip = data?.trips.find(item => item.id === id)
  const stops = useMemo(() => [...(data?.stops.filter(stop => stop.tripId === trip?.id) ?? [])].sort((a, b) => a.start.localeCompare(b.start)), [data?.stops, trip?.id])
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
    setSelectedPlaceId(undefined)
    setStopForm({ id: '', tripId: trip.id, placeId: place?.id, name: place?.name ?? '', address: place?.region || place?.city || '', lat: place?.lat, lng: place?.lng, ...times, order: stops.length + 1, note: '' })
  }

  const openCustomStopForm = (name: string, point: [number, number], address?: string) => {
    const times = defaultStopTimes(activeDayKey, stops, activities)
    setActiveStopId(undefined)
    setActivityForm(null)
    setSelectedPlaceId(undefined)
    setStopForm({ id: '', tripId: trip.id, name, address: address ?? '', lat: point[1], lng: point[0], ...times, order: stops.length + 1, note: '' })
  }

  const selectPlaceById = (placeId: string) => {
    const stop = stops.find(item => item.placeId === placeId)
    if (stop) {
      selectStop(stop.id)
      return
    }
    setActiveStopId(undefined)
    setSelectedPlaceId(placeId)
  }

  const handleMapClick = (point: [number, number], customStopName?: string, customStopAddress?: string) => {
    if (customStopName) {
      openCustomStopForm(customStopName, point, customStopAddress)
      return
    }
    openCustomStopForm('Điểm dừng tùy chỉnh', point)
  }

  const saveStop = async () => {
    if (!stopForm) return
    const validationError = validateStopSchedule(trip, stopForm, stops)
    if (validationError) return showToast(validationError, 'error')
    const creating = !stopForm.id
    try {
      await repo.saveStop(user?.id ?? '', stopForm)
      await refresh()
      setActiveDay(stopOverlapsDay(stopForm, activeDayKey) ? activeDayKey : stopForm.start.slice(0, 10))
      setStopForm(null)
      showToast(creating ? 'Đã thêm điểm dừng.' : 'Đã lưu thay đổi điểm dừng.', 'success')
    } catch (saveError) {
      showToast(errorMessage(saveError), 'error')
    }
  }

  const addActivity = (stop: Stopover, date: string) => {
    const times = defaultActivityTimes(stop, activities, date)
    setActiveDay(date)
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

  const selectStop = (stopId: string, preferredDay?: string) => {
    const stop = stops.find(item => item.id === stopId)
    if (stop) setActiveDay(preferredDay && stopOverlapsDay(stop, preferredDay) ? preferredDay : stop.start.slice(0, 10))
    setSelectedPlaceId(undefined)
    setActiveStopId(stopId)
  }

  return <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
    {toast && <Toast key={toast.id} message={toast.message} kind={toast.kind} placement="bottom" onClose={closeToast} />}
    <div className="grid min-h-0 gap-3 bg-slate-100 p-3 lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16 lg:z-30 lg:grid-cols-[clamp(420px,36vw,520px)_minmax(0,1fr)]">
      <ItineraryTray trip={trip} stops={stops} activities={activities} days={days} activeDay={activeDayKey} activeStopId={activeStopId} stopForm={stopForm} activityForm={activityForm} onChangeDay={setActiveDay} onAddStop={openStopForm} onEditStop={(stop, date) => { setActiveDay(date); setActivityForm(null); setStopForm(stop) }} onChangeStop={setStopForm} onSaveStop={saveStop} onCancelStop={() => setStopForm(null)} onAddActivity={addActivity} onEditActivity={setActivityForm} onChangeActivity={setActivityForm} onSaveActivity={saveActivity} onCancelActivity={() => setActivityForm(null)} onLocateStop={(stop, date) => selectStop(stop.id, date)} onDelete={setDeleteTarget} />

      <section className="relative min-h-[560px] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-full lg:min-h-0">
        <ItineraryMap city={trip.city} stops={stops} activeDay={activeDayKey} activeStopId={activeStopId} onMapClick={handleMapClick} onChoosePlaceId={selectPlaceById} onSelectStop={selectStop} />
        {selectedPlace.isFetching && <div role="status" className="absolute left-3 right-14 top-[4.5rem] z-20 max-w-lg rounded-xl border border-slate-200 bg-white/95 p-3 text-sm text-slate-600 shadow-lg">Đang tải chi tiết địa điểm…</div>}
        {selectedPlace.error && <div role="alert" className="absolute left-3 right-14 top-[4.5rem] z-20 max-w-lg rounded-xl border border-red-200 bg-white/95 p-3 text-sm text-red-700 shadow-lg">{errorMessage(selectedPlace.error)}</div>}
        {selectedPlace.data && <section aria-label="Địa điểm đang chọn" className="absolute left-3 right-14 top-[4.5rem] z-20 max-w-lg rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[#1E3A5F]">{selectedPlace.data.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{selectedPlace.data.region || selectedPlace.data.city}</p><Button size="sm" className="mt-2" onClick={() => { if (selectedPlace.data) openStopForm(activeDayKey, selectedPlace.data) }}><Plus size={14} />Thêm vào lịch trình · Ngày {days.indexOf(activeDayKey) + 1}</Button></div><Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Đóng địa điểm đang chọn" onClick={() => setSelectedPlaceId(undefined)}><X size={15} /></Button></div></section>}
      </section>
    </div>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}><DialogContent title="Xác nhận xóa" description={`Bạn có chắc muốn xóa ${deleteTarget?.kind === 'stop' ? 'điểm dừng' : 'hoạt động'} này?`}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Hủy</Button><Button variant="danger" onClick={async () => { if (!deleteTarget) return; try { if (deleteTarget.kind === 'stop') await repo.deleteStop(user?.id ?? '', deleteTarget.id, trip.id); else await repo.deleteActivity(user?.id ?? '', deleteTarget.id, deleteTarget.stopId); await refresh(); setDeleteTarget(null); setActiveStopId(undefined); showToast('Đã xóa khỏi lịch trình.', 'success') } catch (deleteError) { showToast(errorMessage(deleteError), 'error') } }}>Xóa</Button></div></DialogContent></Dialog>
  </div>
}

