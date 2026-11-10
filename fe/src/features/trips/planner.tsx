import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, MapPin, PencilLine, Sparkles, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, ErrorState, Feedback, FormField, LoadingState } from '@/components/common'
import { useCatalog, useTourist } from '@/hooks/data'
import { travelImage } from '@/lib/travel-images'
import { addDay, currency, day, errorMessage, nights, todayPlus } from '@/lib/utils'
import { repo, isMock } from '@/services'
import { useSession } from '@/stores/session'
import type { PlannerInput } from '@/types/domain'

const interests = ['Biển', 'Thiên nhiên', 'Ẩm thực', 'Văn hóa', 'Mua sắm', 'Nghỉ dưỡng', 'Khám phá']
const suggestedRefinements = ['Lịch thư giãn, ít hoạt động', 'Ưu tiên biển', 'Ưu tiên văn hóa', 'Ưu tiên thiên nhiên']
const defaultInput: PlannerInput = { city: 'Đà Nẵng', startDate: todayPlus(7), endDate: todayPlus(9), adults: 2, children: 0, budget: 6000000, interests: ['Biển', 'Ẩm thực'], style: 'Cân bằng', note: '' }

export function PlannerPage() {
  const [params] = useSearchParams()
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useCatalog()
  const { data: tourist } = useTourist()
  const user = useSession(s => s.user)
  const draft = useSession(s => s.draft)
  const setDraft = useSession(s => s.setDraft)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PlannerInput>(() => ({
    ...defaultInput,
    ...(draft?.input ?? (draft ? { city: draft.trip.city, startDate: draft.trip.startDate, endDate: draft.trip.endDate, adults: draft.trip.adults, children: draft.trip.children, budget: draft.trip.budget, note: draft.trip.note } : {})),
    ...(params.get('city') ? { city: params.get('city')! } : {}),
  }))
  const [activeDay, setActiveDay] = useState(0)
  const [refinement, setRefinement] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error')
  const cityOptions = [...new Set(catalog?.destinations.map(place => place.city) ?? [form.city])]
  const set = <K extends keyof PlannerInput>(key: K, value: PlannerInput[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const tell = (value: string, kind: 'error' | 'success' = 'error') => { setMessage(value); setMessageKind(kind) }

  const generate = async (note = form.note) => {
    const duration = nights(form.startDate, form.endDate) + 1
    if (!form.city.trim() || form.startDate < todayPlus(0) || duration < 1 || duration > 10 || form.adults < 1 || form.children < 0 || form.budget <= 0) {
      tell('Kiểm tra điểm đến, ngày đi (tối đa 10 ngày), số khách và ngân sách.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await repo.plan({ ...form, note })
      setDraft(result)
      setActiveDay(0)
      setRefinement('')
      if (result.totalCost > form.budget) tell('Chi phí ước tính vượt ngân sách. Hãy giảm hoạt động hoặc điều chỉnh ngân sách.', 'error')
      else tell('Đã tạo bản nháp. Bạn có thể tinh chỉnh, sửa tên hoạt động hoặc lưu chuyến đi.', 'success')
    } catch (error) { tell(errorMessage(error)) } finally { setBusy(false) }
  }

  const save = async () => {
    if (!draft) return
    if (!user || user.role !== 'tourist') { navigate('/auth/login?returnTo=' + encodeURIComponent('/ai/trip-planner')); return }
    setBusy(true)
    try {
      const trip = await repo.savePlannedTrip(user.id, draft)
      setDraft(null)
      await queryClient.invalidateQueries({ queryKey: ['tourist'] })
      navigate('/trips/' + trip.id)
    } catch (error) { tell(errorMessage(error)) } finally { setBusy(false) }
  }

  const days = draft ? Array.from({ length: Math.max(0, nights(draft.trip.startDate, draft.trip.endDate) + 1) }, (_, index) => addDay(draft.trip.startDate, index)) : []
  const selectedDate = days[Math.min(activeDay, days.length - 1)]
  const dayStops = draft?.stops.filter(stop => stop.start.startsWith(selectedDate ?? '')).sort((a, b) => a.start.localeCompare(b.start)) ?? []

  return <div className="bg-white">
    <section className="container-app pt-8 md:pt-12"><div className="relative overflow-hidden rounded-[28px] bg-[#1E3A5F] text-white">
      {travelImage(form.city) && <img src={travelImage(form.city)} alt={'Ảnh minh họa ' + form.city} className="absolute inset-0 h-full w-full object-cover opacity-50" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#102947]/95 via-[#173858]/85 to-[#173858]/30" />
      <div className="relative max-w-3xl px-6 py-12 sm:px-10 md:py-16 lg:px-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold"><Sparkles size={15} />Trợ lý lập lịch trình · demo</span>
        <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Chuyến đi của bạn, theo cách bạn thích</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-white/90">Cho chúng tôi biết bạn muốn đi đâu. Công cụ demo sẽ chọn địa điểm trong danh mục, sắp xếp theo giờ mở cửa và giải thích từng gợi ý.</p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/90"><span className="rounded-full bg-white/15 px-3 py-1.5">01 · Chọn nhu cầu</span><span className="rounded-full bg-white/15 px-3 py-1.5">02 · Xem lịch từng ngày</span><span className="rounded-full bg-white/15 px-3 py-1.5">03 · Tinh chỉnh & lưu</span></div>
      </div>
    </div></section>

    <div className="container-app section-pad grid items-start gap-7 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <section aria-labelledby="planner-form-title" className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3EDF4] text-[#1E3A5F]"><MapPin size={19} /></div><div><h2 id="planner-form-title" className="text-xl font-semibold text-[#1E3A5F]">Thiết kế chuyến đi</h2><p className="mt-1 text-sm text-slate-500">Bắt đầu từ những điều quan trọng với bạn.</p></div></div>
        {catalogLoading ? <LoadingState /> : catalogError ? <div className="mt-6"><ErrorState message={errorMessage(catalogError)} /></div> : <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <FormField label="Điểm đến"><select value={form.city} onChange={e => set('city', e.target.value)}>{cityOptions.map(city => <option key={city}>{city}</option>)}</select></FormField>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-1"><FormField label="Ngày bắt đầu"><input type="date" min={todayPlus(0)} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></FormField><FormField label="Ngày kết thúc"><input type="date" min={form.startDate} value={form.endDate} onChange={e => set('endDate', e.target.value)} /></FormField></div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-1"><FormField label="Người lớn"><input type="number" min="1" max="12" value={form.adults} onChange={e => set('adults', Number(e.target.value))} /></FormField><FormField label="Trẻ em"><input type="number" min="0" max="10" value={form.children} onChange={e => set('children', Number(e.target.value))} /></FormField></div>
            <FormField label="Ngân sách dự kiến (VND)"><input type="number" min="1" step="100000" value={form.budget} onChange={e => set('budget', Number(e.target.value))} /></FormField>
            <FormField label="Phong cách"><select value={form.style} onChange={e => set('style', e.target.value)}><option>Tiết kiệm</option><option>Cân bằng</option><option>Thoải mái</option><option>Nghỉ dưỡng</option></select></FormField>
          </div>
          <fieldset className="mt-6"><legend className="text-sm font-semibold text-slate-700">Bạn thích trải nghiệm nào?</legend><div className="mt-3 flex flex-wrap gap-2">{interests.map(value => <label key={value} className={'cursor-pointer rounded-full border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#1E3A5F] ' + (form.interests.includes(value) ? 'border-[#1E3A5F] bg-[#EAF0F6] font-semibold text-[#1E3A5F]' : 'border-slate-200 bg-white text-slate-600 hover:border-[#8AA6BB]')}><input className="sr-only" type="checkbox" checked={form.interests.includes(value)} onChange={() => set('interests', form.interests.includes(value) ? form.interests.filter(x => x !== value) : [...form.interests, value])} />{value}</label>)}</div></fieldset>
          {tourist?.preference && <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => setForm(prev => ({ ...prev, interests: tourist.preference!.interests, budget: tourist.preference!.budget, style: tourist.preference!.style }))}>Dùng sở thích đã lưu</Button>}
          <div className="mt-5"><FormField label="Mong muốn thêm" hint="Ví dụ: lịch thư giãn, ít hoạt động mỗi ngày."><textarea value={form.note} onChange={e => set('note', e.target.value)} placeholder="Bạn muốn chuyến đi có điều gì đặc biệt?" /></FormField></div>
          <Button className="mt-6 w-full" size="lg" disabled={busy} onClick={() => generate()}><Sparkles size={18} />{busy ? 'Đang sắp xếp lịch demo...' : 'Tạo lịch trình demo'}</Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">Dữ liệu và chi phí chỉ để minh họa. Không gọi AI thật hoặc đặt dịch vụ khi tạo lịch.</p>
        </>}
      </section>

      <section aria-live="polite" className="min-w-0">
        {message && <div className="mb-5"><Feedback message={message} kind={messageKind} /></div>}
        {busy && !draft ? <LoadingState label="Đang chọn địa điểm và sắp xếp theo giờ mở cửa..." /> : draft ? <>
          <Card className="overflow-hidden">
            <div className={travelImage(draft.trip.city) ? 'grid md:grid-cols-[minmax(0,1fr)_210px]' : ''}><div className="p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5D8BA5]">Lịch trình của bạn · bản nháp demo</p><h2 className="mt-2 text-2xl font-semibold text-[#1E3A5F]">{draft.trip.name}</h2><p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} />{day(draft.trip.startDate)} – {day(draft.trip.endDate)}<span>· {draft.trip.adults + draft.trip.children} khách</span></p><p className="mt-4 text-sm leading-6 text-slate-600">{draft.explanation}</p></div>{travelImage(draft.trip.city) && <img src={travelImage(draft.trip.city)} alt={'Ảnh minh họa ' + draft.trip.city} className="hidden h-full min-h-52 w-full object-cover md:block" />}</div>
            <div className="grid gap-4 border-t border-slate-100 bg-[#FBFCFE] p-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><span className="text-sm text-slate-500">Tổng chi phí ước tính</span><p className="mt-1 text-2xl font-semibold text-[#1E3A5F]">{currency(draft.totalCost)}</p><p className={'mt-1 text-xs ' + (draft.totalCost > draft.trip.budget ? 'text-amber-800' : 'text-emerald-700')}>{draft.totalCost > draft.trip.budget ? 'Vượt ngân sách ' + currency(draft.totalCost - draft.trip.budget) : 'Trong ngân sách dự kiến ' + currency(draft.trip.budget)}</p></div><Button disabled={busy} onClick={save}>Lưu lịch trình<ArrowRight size={17} /></Button></div>
            {draft.costBreakdown && <div className="grid gap-3 border-t border-slate-100 px-6 py-5 text-sm sm:grid-cols-3"><CostPart label="Lưu trú" value={draft.costBreakdown.lodging} /><CostPart label="Ăn uống" value={draft.costBreakdown.food} /><CostPart label="Vé tham quan" value={draft.costBreakdown.activities} /></div>}
          </Card>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#5D8BA5]">Khám phá theo ngày</p><h2 className="mt-1 text-2xl font-semibold text-[#1E3A5F]">Lịch trình từng ngày</h2></div><Button size="sm" variant="secondary" disabled={busy} onClick={() => generate()}><Sparkles size={16} />Tạo lại</Button></div>
          <div role="tablist" aria-label="Chọn ngày trong lịch trình" className="mt-4 flex gap-2 overflow-x-auto pb-2">{days.map((date, index) => <button key={date} role="tab" aria-selected={index === activeDay} className={'shrink-0 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] ' + (index === activeDay ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-[#EAF0F6]')} onClick={() => setActiveDay(index)}><strong className="block">Ngày {index + 1}</strong><span className="text-xs opacity-80">{day(date)}</span></button>)}</div>
          <div role="tabpanel" className="mt-3 grid gap-3">{dayStops.length ? dayStops.map(stop => {
            const activity = draft.activities.find(item => item.stopId === stop.id)
            return <Card key={stop.id} className="overflow-hidden"><div className="grid sm:grid-cols-[88px_minmax(0,1fr)]"><div className="flex items-center gap-2 bg-[#EAF0F6] px-5 py-3 text-sm font-semibold text-[#1E3A5F] sm:flex-col sm:justify-center sm:gap-0"><Clock3 size={16} className="sm:mb-2" /><span>{stop.start.slice(11, 16)}</span><span className="text-xs font-normal">đến {stop.end.slice(11, 16)}</span></div><div className="min-w-0 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-semibold text-[#1E3A5F]">{stop.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} />{stop.address}</p></div>{activity && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{activity.cost ? currency(activity.cost) + '/khách' : 'Miễn phí'}</span>}</div><p className="mt-3 text-sm leading-6 text-slate-600">{draft.reasons?.[stop.id] ?? stop.note}</p>{activity && <label className="mt-4 flex items-center gap-2 text-sm text-slate-600"><PencilLine size={15} className="shrink-0" /><span className="sr-only">Tên hoạt động tại {stop.name}</span><input aria-label={'Tên hoạt động tại ' + stop.name} value={activity.name} onChange={event => setDraft({ ...draft, activities: draft.activities.map(item => item.id === activity.id ? { ...item, name: event.target.value } : item) })} /></label>}</div></div></Card>
          }) : <Card className="p-6 text-sm text-slate-500">Chưa có địa điểm phù hợp giờ mở cửa trong ngày này.</Card>}</div>
          <Card className="mt-7 p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#1E3A5F]">Tinh chỉnh lịch trình</h2><p className="mt-1 text-sm text-slate-500">Chọn một gợi ý hoặc ghi rõ mong muốn để tạo bản nháp mới.</p><div className="mt-4 flex flex-wrap gap-2">{suggestedRefinements.map(value => <button key={value} type="button" onClick={() => setRefinement(value)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-[#1E3A5F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]">{value}</button>)}</div><div className="mt-4"><FormField label="Điều chỉnh của bạn"><input value={refinement} onChange={e => setRefinement(e.target.value)} placeholder="Ví dụ: ưu tiên thiên nhiên, ít hoạt động" /></FormField></div><Button className="mt-4" variant="secondary" disabled={busy || !refinement.trim()} onClick={() => generate([form.note, refinement].filter(Boolean).join('; '))}>Tinh chỉnh demo<ArrowRight size={16} /></Button></Card>
          <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><Wallet size={15} className="mt-0.5 shrink-0" /><p>Giá lưu trú và ăn uống là giả định demo; vé tham quan lấy từ danh mục. Chưa tính vận chuyển và biến động giá thực tế. {isMock && 'Bản nháp được giữ trong phiên trình duyệt khi bạn đăng nhập.'}</p></div>
        </> : <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF0F6] text-[#1E3A5F]"><CalendarDays size={28} /></div><h2 className="mt-5 text-xl font-semibold text-[#1E3A5F]">Lịch trình của bạn sẽ xuất hiện ở đây</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Chọn điểm đến, thời gian và sở thích. Sau khi tạo, bạn sẽ xem từng ngày, tinh chỉnh và lưu chuyến đi.</p><Link to="/explore" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#1E3A5F] hover:underline">Xem địa điểm trong danh mục <ArrowRight size={15} /></Link></Card>}
      </section>
    </div>
  </div>
}

function CostPart({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between gap-3 sm:block"><span className="text-slate-500">{label}</span><strong className="font-semibold text-[#1E3A5F] sm:mt-1 sm:block">{currency(value)}</strong></div>
}
