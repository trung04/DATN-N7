import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Clock3, LocateFixed, MapPin, Pencil, Plus, Route, Trash2, X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, FormField } from '@/components/common'
import { currency, day } from '@/lib/utils'
import type { Destination, Itinerary, Stopover, TravelActivity } from '@/types/domain'

export type DeleteTarget = { kind: 'stop' | 'activity'; id: string; stopId?: string }

type Props = {
  trip: Itinerary
  stops: Stopover[]
  activities: TravelActivity[]
  places: Destination[]
  days: string[]
  activeDay: string
  activeStopId?: string
  stopForm: Stopover | null
  activityForm: TravelActivity | null
  onChangeDay: (date: string) => void
  onAddStop: (date: string) => void
  onEditStop: (stop: Stopover) => void
  onChangeStop: (stop: Stopover) => void
  onSaveStop: () => Promise<void>
  onCancelStop: () => void
  onAddActivity: (stop: Stopover) => void
  onEditActivity: (activity: TravelActivity) => void
  onChangeActivity: (activity: TravelActivity) => void
  onSaveActivity: () => Promise<void>
  onCancelActivity: () => void
  onLocateStop: (stop: Stopover) => void
  onDelete: (target: DeleteTarget) => void
}

export function ItineraryTray({ trip, stops, activities, places, days, activeDay, activeStopId, stopForm, activityForm, onChangeDay, onAddStop, onEditStop, onChangeStop, onSaveStop, onCancelStop, onAddActivity, onEditActivity, onChangeActivity, onSaveActivity, onCancelActivity, onLocateStop, onDelete }: Props) {
  const visibleStops = stops.filter(stop => stop.start.slice(0, 10) === activeDay)
  const activityFormDay = stops.find(stop => stop.id === activityForm?.stopId)?.start.slice(0, 10)
  const editorOpen = Boolean(stopForm || (activityForm && !activityForm.id))
  const activityCount = activities.filter(activity => stops.some(stop => stop.id === activity.stopId)).length

  return <aside className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#C5C5D3] bg-[#FAF8FF] shadow-sm lg:h-full lg:min-h-0">
    {editorOpen ? <EditorHeader title={stopForm ? (stopForm.id ? 'Sửa điểm dừng' : 'Thêm điểm dừng') : 'Thêm hoạt động'} subtitle={`Ngày ${Math.max(0, days.indexOf(stopForm?.start.slice(0, 10) ?? activityFormDay ?? activeDay)) + 1} · ${trip.name}`} onClose={stopForm ? onCancelStop : onCancelActivity} /> : <TrayHeader trip={trip} stops={stops.length} activities={activityCount} />}

    {!editorOpen && <DayTabs days={days} activeDay={activeDay} stops={stops} onChange={onChangeDay} />}

    {stopForm ? <StopEditor value={stopForm} places={places} onChange={onChangeStop} onSave={onSaveStop} onCancel={onCancelStop} /> : activityForm && !activityForm.id ? <ActivityEditor value={activityForm} panel onChange={onChangeActivity} onSave={onSaveActivity} onCancel={onCancelActivity} /> : <>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-gutter:stable]">
        {visibleStops.length ? <div className="relative grid min-w-0 gap-3 pl-9 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-0.5 before:bg-[#DAE2FD]">
          {visibleStops.map((stop, index) => {
            const stopActivities = activities.filter(activity => activity.stopId === stop.id).sort((a, b) => a.start.localeCompare(b.start))
            return <article key={stop.id} className={'relative min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm ' + (activeStopId === stop.id ? 'border-[#4059AA] ring-1 ring-[#4059AA]' : 'border-[#DAE2FD]')}>
              <span className="absolute -left-9 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#00236F] text-xs font-bold text-white ring-4 ring-[#FAF8FF]">{index + 1}</span>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 p-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-[#131B2E]">{stop.name}</h2>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-[#5B5D68]"><MapPin size={12} />{stop.address || trip.city}</p>
                  {stop.note && <p className="mt-1 line-clamp-2 break-words text-xs leading-4 text-[#444651]">{stop.note}</p>}
                  <div className="mt-2"><TimeRange start={stop.start} end={stop.end} /></div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton label={`Định vị ${stop.name}`} title="Định vị trên bản đồ" onClick={() => onLocateStop(stop)}><LocateFixed size={14} /></IconButton>
                  <IconButton label={`Sửa điểm dừng ${stop.name}`} title="Sửa điểm dừng" onClick={() => onEditStop(stop)}><Pencil size={14} /></IconButton>
                  <Button type="button" size="icon" variant="danger" className="h-8 w-8" aria-label={`Xóa điểm dừng ${stop.name}`} title="Xóa điểm dừng" onClick={() => onDelete({ kind: 'stop', id: stop.id })}><Trash2 size={14} /></Button>
                </div>
              </div>
              <div className="border-t border-[#EAEDFF] px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between text-xs text-[#444651]"><span>{stopActivities.length} hoạt động</span><IconButton label={`Thêm hoạt động tại ${stop.name}`} title="Thêm hoạt động" onClick={() => onAddActivity(stop)}><Plus size={14} /></IconButton></div>
                <div className="grid min-w-0 gap-2">
                  {stopActivities.map(activity => activityForm?.id === activity.id ? <ActivityEditor key={activity.id} value={activityForm} onChange={onChangeActivity} onSave={onSaveActivity} onCancel={onCancelActivity} /> : <div key={activity.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-lg border-l-4 border-[#006C4A] bg-[#F2F3FF] px-2.5 py-2 text-xs">
                    <div className="min-w-0"><strong className="block truncate text-[#131B2E]">{activity.name}</strong><div className="mt-1"><TimeRange start={activity.start} end={activity.end} compact /></div>{activity.note && <p className="mt-1 line-clamp-2 break-words leading-4 text-[#444651] [overflow-wrap:anywhere]">{activity.note}</p>}{activity.cost > 0 && <p className="mt-1 text-[#4059AA]">{currency(activity.cost)}</p>}</div>
                    <div className="flex shrink-0 flex-col gap-1"><IconButton label={`Sửa hoạt động ${activity.name}`} title="Sửa hoạt động" onClick={() => onEditActivity(activity)}><Pencil size={13} /></IconButton><Button type="button" size="icon" variant="danger" className="h-7 w-7" aria-label={`Xóa hoạt động ${activity.name}`} title="Xóa hoạt động" onClick={() => onDelete({ kind: 'activity', id: activity.id, stopId: stop.id })}><Trash2 size={13} /></Button></div>
                  </div>)}
                </div>
              </div>
            </article>
          })}
        </div> : <EmptyState title="Chưa có điểm dừng" description="Ngày này chưa có địa điểm. Hãy dùng nút bên dưới để thêm điểm đầu tiên." />}
      </div>
      {!activityForm && <div className="shrink-0 border-t border-[#DAE2FD] bg-white p-3"><Button className="w-full bg-[#00236F] hover:bg-[#1E3A8A]" onClick={() => onAddStop(activeDay)}><Plus size={15} />Thêm điểm dừng vào ngày {days.indexOf(activeDay) + 1}</Button></div>}
    </>}
  </aside>
}

function TrayHeader({ trip, stops, activities }: { trip: Itinerary; stops: number; activities: number }) {
  return <header className="shrink-0 border-b border-[#DAE2FD] bg-white p-3">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link className="text-xs font-semibold text-[#4059AA] hover:underline" to="/trips">← Chuyến đi của tôi</Link><h1 className="mt-1 flex items-center gap-2 truncate text-lg font-bold text-[#131B2E]"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{trip.name}</h1></div><Button asChild size="icon" variant="ghost" className="h-8 w-8"><Link to={`/trips/${trip.id}/edit`} aria-label="Sửa thông tin chuyến đi" title="Sửa chuyến đi"><Pencil size={15} /></Link></Button></div>
    <p className="mt-1 truncate text-xs text-[#444651]">{trip.city} · {day(trip.startDate)}–{day(trip.endDate)}</p>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#F2F3FF] px-2.5 py-2 text-xs text-[#00236F]"><span><MapPin className="inline" size={12} /> {stops} điểm</span><span><Route className="inline" size={12} /> {activities} hoạt động</span><span>{trip.adults} NL · {trip.children} TE</span><span>— km</span></div>
  </header>
}

function EditorHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return <header className="flex shrink-0 items-center gap-2 border-b border-[#DAE2FD] bg-white px-3 py-2.5"><IconButton label="Đóng trình chỉnh sửa" onClick={onClose}><X size={16} /></IconButton><div className="min-w-0"><h1 className="truncate text-sm font-bold text-[#131B2E]">{title}</h1><p className="truncate text-xs text-[#444651]">{subtitle}</p></div></header>
}

function DayTabs({ days, activeDay, stops, onChange }: { days: string[]; activeDay: string; stops: Stopover[]; onChange: (date: string) => void }) {
  const activeIndex = days.indexOf(activeDay)
  return <div className="flex shrink-0 items-center gap-1 border-b border-[#DAE2FD] bg-white px-3 py-2"><IconButton label="Ngày trước" disabled={activeIndex <= 0} onClick={() => onChange(days[activeIndex - 1] ?? activeDay)}><ChevronLeft size={15} /></IconButton><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-lg bg-[#EAEDFF] p-1 [scrollbar-width:none]">{days.map((date, index) => { const count = stops.filter(stop => stop.start.startsWith(date)).length; const active = date === activeDay; return <button type="button" key={date} aria-pressed={active} onClick={() => onChange(date)} className={'shrink-0 rounded-md px-3 py-2 text-sm transition-colors ' + (active ? 'bg-white font-semibold text-[#00236F] shadow-sm' : 'text-[#444651] hover:bg-white/70')}>Ngày {index + 1} · <span className="text-[#757682]">{count}</span></button> })}</div><IconButton label="Ngày sau" disabled={activeIndex >= days.length - 1} onClick={() => onChange(days[activeIndex + 1] ?? activeDay)}><ChevronRight size={15} /></IconButton></div>
}

function StopEditor({ value, places, onChange, onSave, onCancel }: { value: Stopover; places: Destination[]; onChange: (value: Stopover) => void; onSave: () => Promise<void>; onCancel: () => void }) {
  const custom = Number.isFinite(value.lat) && Number.isFinite(value.lng) && !value.placeId
  return <form className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white" onSubmit={event => { event.preventDefault(); void onSave() }}><div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overflow-x-hidden p-4">
    {custom ? <><FormField label="Tên điểm dừng"><input required value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></FormField><FormField label="Địa chỉ"><input value={value.address} onChange={event => onChange({ ...value, address: event.target.value })} /></FormField><p className="text-xs text-slate-500">Vị trí Mapbox: {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}</p></> : <FormField label="Địa điểm"><select required value={value.placeId ?? ''} onChange={event => { const place = places.find(item => item.id === event.target.value); onChange({ ...value, placeId: place?.id, name: place?.name ?? '', address: place?.region || place?.city || '', lat: place?.lat, lng: place?.lng }) }}><option value="">Chọn địa điểm</option>{places.map(place => <option key={place.id} value={place.id}>{place.name} · {place.city}</option>)}</select></FormField>}
    <div className="grid min-w-0 grid-cols-2 gap-2"><FormField label="Bắt đầu"><input className="min-w-0" required type="datetime-local" value={value.start} onChange={event => onChange({ ...value, start: event.target.value })} /></FormField><FormField label="Kết thúc"><input className="min-w-0" required type="datetime-local" value={value.end} onChange={event => onChange({ ...value, end: event.target.value })} /></FormField></div>
    <FormField label="Ghi chú"><textarea className="min-h-24" value={value.note} onChange={event => onChange({ ...value, note: event.target.value })} /></FormField>
  </div><div className="flex shrink-0 justify-end gap-2 border-t border-[#DAE2FD] p-3"><Button type="button" size="sm" variant="secondary" onClick={onCancel}>Hủy</Button><Button size="sm">{value.id ? 'Lưu thay đổi' : 'Thêm điểm dừng'}</Button></div></form>
}

function ActivityEditor({ value, onChange, onSave, onCancel, panel = false }: { value: TravelActivity; onChange: (value: TravelActivity) => void; onSave: () => Promise<void>; onCancel: () => void; panel?: boolean }) {
  return <form className={panel ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-white' : 'grid gap-3 rounded-lg border border-[#DAE2FD] bg-white p-3'} onSubmit={event => { event.preventDefault(); void onSave() }}><div className={panel ? 'grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4' : 'contents'}><FormField label="Tên hoạt động"><input required value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></FormField><div className="grid min-w-0 grid-cols-2 gap-2"><FormField label="Bắt đầu"><input className="min-w-0" required type="datetime-local" value={value.start} onChange={event => onChange({ ...value, start: event.target.value })} /></FormField><FormField label="Kết thúc"><input className="min-w-0" required type="datetime-local" value={value.end} onChange={event => onChange({ ...value, end: event.target.value })} /></FormField></div><FormField label="Chi phí"><input type="number" min="0" value={value.cost} onChange={event => onChange({ ...value, cost: Number(event.target.value) })} /></FormField><FormField label="Ghi chú"><textarea className="min-h-20" value={value.note} onChange={event => onChange({ ...value, note: event.target.value })} /></FormField></div><div className={panel ? 'flex shrink-0 justify-end gap-2 border-t border-[#DAE2FD] p-3' : 'flex justify-end gap-2'}><Button type="button" size="sm" variant="secondary" onClick={onCancel}>Hủy</Button><Button size="sm">{value.id ? 'Lưu thay đổi' : 'Thêm hoạt động'}</Button></div></form>
}

function TimeRange({ start, end, compact = false }: { start: string; end: string; compact?: boolean }) {
  return <span className={'inline-flex items-center gap-1.5 rounded-lg bg-[#EAEDFF] px-2 py-1 text-[11px] font-semibold text-[#00236F] ' + (compact ? 'whitespace-nowrap' : '')}><Clock3 size={compact ? 11 : 12} /><span>{formatTime(start)}</span><span className="text-[#757682]">→</span><span>{formatTime(end)}</span></span>
}

function IconButton({ label, title, disabled, onClick, children }: { label: string; title?: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-[#00236F] hover:bg-[#EAEDFF]" aria-label={label} title={title} disabled={disabled} onClick={onClick}>{children}</Button>
}

function formatTime(value: string) {
  const [hourText = '0', minuteText = '0'] = value.slice(11, 16).split(':')
  const hours = Number(hourText)
  return `${hours % 12 || 12}:${minuteText} ${hours >= 12 ? 'PM' : 'AM'}`
}
