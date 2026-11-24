import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BedDouble, CalendarDays, ChevronDown, Hotel, Minus, Plus, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CancellationPolicyTerms } from '@/components/cancellation-policy-terms'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { repo, isMock } from '@/services'
import { addDay, currency, day, errorMessage, nights, stayDays, todayPlus } from '@/lib/utils'
import { allocateGuestsToRooms, readChildAges } from '@/lib/room-occupancy'
import { useSession } from '@/stores/session'
import { useCatalog } from '@/hooks/data'
import { api } from '@/services/api/client'
import type { BookingInput, RoomType } from '@/types/domain'

const maxGuestsPerCategory = 100

function readRoomIds(value: string | null): string[] {
  if (!value) return []
  try {
    const ids: unknown = JSON.parse(value)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function GuestCounter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white py-2 pr-2 pl-3">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <div className="flex shrink-0 items-center gap-0.5">
      <Button type="button" variant="secondary" size="icon" className="size-8 rounded-lg" aria-label={`Giảm ${label.toLocaleLowerCase('vi-VN')}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={15} aria-hidden="true" /></Button>
      <output className="min-w-7 text-center text-sm font-semibold tabular-nums text-slate-900" aria-label={`Số ${label.toLocaleLowerCase('vi-VN')}`}>{value}</output>
      <Button type="button" variant="secondary" size="icon" className="size-8 rounded-lg" aria-label={`Tăng ${label.toLocaleLowerCase('vi-VN')}`} disabled={value >= maxGuestsPerCategory} onClick={() => onChange(value + 1)}><Plus size={15} aria-hidden="true" /></Button>
    </div>
  </div>
}

export function BookingCheckoutPage() {
  const user = useSession(state => state.user)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useCatalog()
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [acceptedPolicyVersion, setAcceptedPolicyVersion] = useState('')
  const [childAges, setChildAges] = useState(() => readChildAges(params.get('childAges'), Number(params.get('children') ?? 0)))
  const attempt = useRef<{ payload: string; key: string } | null>(null)
  const urlRoomIds = readRoomIds(params.get('roomIds'))
  const [form, setForm] = useState<Omit<BookingInput, 'children'>>({
    hotelId: params.get('hotelId') ?? '',
    roomId: urlRoomIds[0] ?? params.get('roomId') ?? '',
    roomIds: urlRoomIds,
    checkIn: params.get('checkIn') ?? todayPlus(7),
    checkOut: params.get('checkOut') ?? todayPlus(9),
    rooms: urlRoomIds.length || Number(params.get('rooms') ?? 1),
    adults: Math.max(1, Math.min(maxGuestsPerCategory, Math.trunc(Number(params.get('adults') ?? 2)) || 2)),
    guestName: user?.name ?? '',
    guestEmail: user?.email ?? '',
    guestPhone: user?.phone ?? '',
    specialRequest: '',
  })
  const firstBookableDay = todayPlus(0)
  const earliestCheckout = addDay(Number.isFinite(nights(form.checkIn, form.checkIn)) ? form.checkIn : firstBookableDay, 1)
  const stayIsValid = form.checkIn >= firstBookableDay && nights(form.checkIn, form.checkOut) > 0
  const availabilityQuery = useQuery({
    queryKey: ['room-availability', form.hotelId, form.checkIn, form.checkOut],
    queryFn: () => api.searchRoomAvailability({ hotelId: form.hotelId, checkInDate: form.checkIn, checkOutDate: form.checkOut }),
    enabled: !isMock && Boolean(form.hotelId) && stayIsValid,
  })
  const cancellationPolicyQuery = useQuery({
    queryKey: ['cancellation-policy-schedule', form.hotelId],
    queryFn: () => api.cancellationPolicySchedule(form.hotelId),
    enabled: !isMock && Boolean(form.hotelId),
  })
  const guestPoliciesQuery = useQuery({
    queryKey: ['room-guest-policies', form.hotelId],
    queryFn: () => api.roomGuestPolicies(form.hotelId),
    enabled: !isMock && Boolean(form.hotelId),
  })

  const hotel = data?.hotels.find(item => item.id === form.hotelId)

  const dates = stayIsValid ? stayDays(form.checkIn, form.checkOut) : []
  const apiAvailableIds = new Set(availabilityQuery.data?.availableRoomIds ?? [])
  const hotelRooms = (data?.rooms ?? []).filter(room => room.hotelId === form.hotelId)
  const roomsById = new Map(hotelRooms.map(room => [room.id, room]))
  const availableQuantity = (room: RoomType) => isMock
    ? dates.length && Math.min(...dates.map(date => data?.availability.find(item => item.roomId === room.id && item.date === date)?.available ?? 0))
    : Number(room.operationalStatus === 'AVAILABLE' && apiAvailableIds.has(room.id))
  const legacyRoom = roomsById.get(form.roomId)
  const legacyChoices = legacyRoom ? hotelRooms
    .filter(room => room.name === legacyRoom.name && room.capacity === legacyRoom.capacity && room.basePrice === legacyRoom.basePrice)
    .sort((a, b) => Number(b.id === legacyRoom.id) - Number(a.id === legacyRoom.id)) : []
  const legacyAvailable = legacyChoices.filter(room => availableQuantity(room) > 0)
  const requestedRooms = form.roomIds?.length
    ? form.roomIds.flatMap(id => { const room = roomsById.get(id); return room ? [room] : [] })
    : (legacyAvailable.length >= form.rooms ? legacyAvailable : legacyChoices).slice(0, form.rooms)
  const requestedCounts = new Map<RoomType, number>()
  for (const room of requestedRooms) requestedCounts.set(room, (requestedCounts.get(room) ?? 0) + 1)
  const checkingRooms = !isMock && stayIsValid && availabilityQuery.isPending
  const checkingGuestPolicies = !isMock && guestPoliciesQuery.isPending
  const roomsAvailable = stayIsValid && !checkingRooms && (isMock || !availabilityQuery.isError)
    && form.rooms > 0 && form.rooms <= 10 && requestedRooms.length === form.rooms
    && [...requestedCounts].every(([room, quantity]) => availableQuantity(room) >= quantity)
  const guestPolicies = guestPoliciesQuery.data ?? []
  const guestPolicyFor = (room: RoomType) => guestPolicies.find(policy => policy.hotelId === room.hotelId
    && policy.roomType.trim().toLocaleLowerCase('vi-VN') === room.name.trim().toLocaleLowerCase('vi-VN'))
  const ageThresholds = requestedRooms.map(room => guestPolicyFor(room)?.adultAgeFrom ?? 12)
  const adultAge = ageThresholds[0] ?? 12
  const childAgeOptions = Array.from({ length: Math.min(18, Math.max(adultAge, ...ageThresholds)) }, (_, age) => age)
  const totalCapacity = requestedRooms.reduce((sum, room) => sum + room.capacity, 0)
  const allocation = roomsAvailable && !checkingGuestPolicies && (isMock || !guestPoliciesQuery.isError)
    && form.adults + childAges.length <= totalCapacity
    ? allocateGuestsToRooms(requestedRooms, form.adults, childAges, guestPolicies) : null
  const bookedAdults = allocation?.reduce((sum, room) => sum + room.adultCount, 0) ?? form.adults
  const bookedChildAges = allocation?.flatMap(room => room.childAges).sort((a, b) => a - b) ?? childAges
  const available = Boolean(allocation && bookedAdults <= maxGuestsPerCategory)
  const priceGroups = new Map<string, { quantity: number; rates: Set<number>; amount: number }>()
  const byNight = dates.map(() => 0)
  let surchargePerNight = 0
  requestedRooms.forEach((room, index) => {
    const group = priceGroups.get(room.name) ?? { quantity: 0, rates: new Set<number>(), amount: 0 }
    group.quantity++
    if (roomsAvailable) dates.forEach((date, i) => {
      const price = data?.inventory.find(item => item.roomId === room.id && item.date === date)?.price ?? room.basePrice
      group.rates.add(price)
      group.amount += price
      byNight[i] = (byNight[i] ?? 0) + price
    })
    priceGroups.set(room.name, group)
    const policy = guestPolicyFor(room)
    if (policy) surchargePerNight += (allocation?.[index]?.childAges.filter(age => age > policy.freeChildMaxAge).length ?? 0) * policy.childSurchargePerNight
  })
  const childSurcharge = surchargePerNight * dates.length
  const total = byNight.reduce((sum, price) => sum + price, childSurcharge)
  const cancellationPolicy = cancellationPolicyQuery.data
  const policyReady = isMock || Boolean(cancellationPolicy?.complete)
  const policyAccepted = isMock || Boolean(cancellationPolicy?.version && acceptedPolicyVersion === cancellationPolicy.version)
  const cancellationRule = cancellationPolicy?.rules[0]
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setMessage('')
  }

  const next = () => {
    setMessage('')
    if (step === 1) {
      if (!isMock && availabilityQuery.isPending) { setMessage('Đang kiểm tra phòng trống.'); return }
      if (!isMock && availabilityQuery.isError) { setMessage(errorMessage(availabilityQuery.error)); return }
      if (!isMock && (cancellationPolicyQuery.isPending || cancellationPolicyQuery.isError || !cancellationPolicy?.complete)) {
        setMessage(cancellationPolicy?.complete === false
          ? 'Khách sạn chưa thiết lập chính sách hủy nên hiện chưa thể nhận đặt phòng.'
          : 'Chưa tải được chính sách hủy của khách sạn.')
        return
      }
      if (!stayIsValid || !available) return
      setStep(2)
    } else if (step === 2) {
      if (form.guestName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.guestEmail) || !/^0\d{9,10}$/.test(form.guestPhone)) { setMessage('Kiểm tra họ tên, email và số điện thoại.'); return }
      setStep(3)
    }
  }

  const confirm = async () => {
    if (!allocation || !available || !policyReady || !policyAccepted || busy) return
    const roomIds = requestedRooms.map(room => room.id)
    const bookingInput = { ...form, adults: bookedAdults, children: bookedChildAges.length,
      roomId: roomIds[0] ?? '', roomIds, roomGuests: allocation, rooms: requestedRooms.length,
      cancellationPolicyVersion: cancellationPolicyQuery.data?.version }
    const payload = JSON.stringify(bookingInput)
    const currentAttempt = attempt.current?.payload === payload ? attempt.current : { payload, key: crypto.randomUUID() }
    attempt.current = currentAttempt
    setBusy(true)
    setMessage('')
    try {
      const booking = await repo.createBooking(user?.id ?? '', {
        ...bookingInput,
        idempotencyKey: currentAttempt.key,
      })
      navigate('/bookings/' + booking.id + '/payment' + (isMock ? '' : '?auto=1'))
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!hotel || !data) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy khách sạn" action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} /></div>

  const roomPickerUrl = `/hotels/${hotel.id}?${new URLSearchParams({
    checkIn: form.checkIn, checkOut: form.checkOut, adults: String(form.adults),
    children: String(childAges.length), childAges: childAges.join(','), rooms: String(form.rooms),
  })}`

  return <div className="container-app section-pad">
    <PageHeader title="Đặt phòng khách sạn" description={`Bước ${step}/3 · ${step === 1 ? 'Lưu trú' : step === 2 ? 'Thông tin người đặt' : 'Xác nhận'}`} />
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] lg:gap-7">
      <Card className={step === 2 ? 'min-w-0 rounded-2xl p-5 sm:p-6' : 'min-w-0 overflow-hidden rounded-2xl'}>
        {step === 1 && <div>
          <header className="flex items-center gap-4 border-b border-slate-200 bg-[#F2F7FB] px-4 py-5 sm:px-6 sm:py-6">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#DBE8F3] bg-white text-[#1E3A5F]"><Hotel size={23} aria-hidden="true" /></div>
            <div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{hotel.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{form.rooms} phòng · {form.adults} người lớn{childAges.length > 0 && ` · ${childAges.length} trẻ em`}</p>
            </div>
          </header>
          <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
            <section aria-labelledby="stay-dates" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="stay-dates" className="flex items-center gap-2.5 font-semibold text-slate-900"><CalendarDays size={19} className="text-[#1E3A5F]" aria-hidden="true" />Kỳ lưu trú</h3>
                {stayIsValid && <span className="rounded-full bg-[#E9F1F9] px-2.5 py-1 text-xs font-semibold text-[#1E3A5F]">{dates.length} đêm</span>}
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4">
                <FormField label="Nhận phòng"><input type="date" lang="vi" min={firstBookableDay} value={form.checkIn} onChange={event => set('checkIn', event.target.value)} /></FormField>
                <FormField label="Trả phòng"><input type="date" lang="vi" min={earliestCheckout} value={form.checkOut} onChange={event => set('checkOut', event.target.value)} /></FormField>
              </div>
              {!stayIsValid && <Feedback kind="error" message="Chọn ngày nhận phòng từ hôm nay và ngày trả phòng sau ngày nhận." />}
            </section>

            <section aria-labelledby="stay-guests" className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
              <h3 id="stay-guests" className="flex items-center gap-2.5 font-semibold text-slate-900"><UsersRound size={19} className="text-[#1E3A5F]" aria-hidden="true" />Khách lưu trú</h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <GuestCounter label="Người lớn" value={form.adults} min={1} onChange={value => set('adults', value)} />
                <GuestCounter label="Trẻ em" value={childAges.length} min={0} onChange={value => {
                  setChildAges(current => value < current.length ? current.slice(0, value) : [...current, 5])
                  setMessage('')
                }} />
              </div>
              {childAges.length > 0 && <>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {childAges.map((age, index) => <FormField key={index} label={`Tuổi trẻ ${index + 1}`}>
                    <select value={age} onChange={event => {
                      setChildAges(current => current.map((value, i) => i === index ? Number(event.target.value) : value))
                      setMessage('')
                    }}>
                      {childAgeOptions.map(value => <option key={value} value={value}>{value} tuổi</option>)}
                      {age >= childAgeOptions.length && <option value={age}>{age} tuổi</option>}
                    </select>
                  </FormField>)}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{ageThresholds.every(age => age === adultAge) ? `Từ ${adultAge} tuổi được tính là người lớn.` : 'Độ tuổi tính là người lớn tùy theo loại phòng.'}{bookedAdults > form.adults && ` Đơn này tính ${bookedAdults} người lớn và ${bookedChildAges.length} trẻ em.`}</p>
              </>}
              {roomsAvailable && !checkingGuestPolicies && (isMock || !guestPoliciesQuery.isError) && !available && <div className="mt-3">
                <Feedback kind="error" message="Các phòng đã chọn chưa phù hợp với số khách hoặc độ tuổi. Hãy điều chỉnh số khách hoặc đổi phòng." />
              </div>}
            </section>

            <section aria-labelledby="stay-rooms" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="stay-rooms" className="flex items-center gap-2.5 font-semibold text-slate-900"><BedDouble size={19} className="text-[#1E3A5F]" aria-hidden="true" />Phòng đã chọn</h3>
                <Link className="rounded text-sm font-semibold text-[#1E3A5F] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4" to={roomPickerUrl}>Đổi phòng</Link>
              </div>
              {priceGroups.size > 0 && <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 px-3.5 sm:px-4">
                {[...priceGroups].map(([name, group]) => <li key={name} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 font-medium text-slate-800">{name}</span><span className="shrink-0 text-slate-600">{group.quantity} phòng</span></li>)}
              </ul>}
              {stayIsValid && !checkingRooms && (isMock || !availabilityQuery.isError) && !roomsAvailable && <Feedback kind="error" message="Các phòng đã chọn không còn đủ cho kỳ lưu trú này. Hãy chọn kỳ khác hoặc đổi phòng." />}
              {!isMock && availabilityQuery.isError && <Feedback kind="error" message={errorMessage(availabilityQuery.error)} />}
              {!isMock && guestPoliciesQuery.isError && <Feedback kind="error" message={errorMessage(guestPoliciesQuery.error)} />}
            </section>
          </div>
        </div>}
        {step === 2 && <form id="guest-details" className="grid gap-4" onSubmit={event => { event.preventDefault(); next() }}>
          <h2 className="text-lg font-semibold">Thông tin người đặt</h2>
          <FormField label="Họ tên"><input required minLength={2} value={form.guestName} onChange={event => set('guestName', event.target.value)} autoComplete="name" /></FormField>
          <FormField label="Email"><input required type="email" value={form.guestEmail} onChange={event => set('guestEmail', event.target.value)} autoComplete="email" /></FormField>
          <FormField label="Số điện thoại"><input required inputMode="tel" value={form.guestPhone} onChange={event => set('guestPhone', event.target.value)} autoComplete="tel" /></FormField>
          <FormField label="Yêu cầu đặc biệt"><textarea maxLength={5000} value={form.specialRequest} onChange={event => set('specialRequest', event.target.value)} /></FormField>
        </form>}
        {step === 3 && <>
          <header className="flex items-center gap-4 border-b border-slate-200 bg-[#F2F7FB] px-4 py-5 sm:px-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#DBE8F3] bg-white text-[#1E3A5F]"><Hotel size={23} aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Xác nhận thông tin</h2>
              <p className="mt-1 text-sm font-medium wrap-anywhere text-slate-700">{hotel.name}</p>
            </div>
          </header>
          <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <section aria-labelledby="confirmation-stay" className="overflow-hidden rounded-xl border border-slate-200">
              <h3 id="confirmation-stay" className="flex items-center gap-2.5 px-4 pt-4 font-semibold text-slate-900"><CalendarDays size={18} className="text-[#1E3A5F]" aria-hidden="true" />Thông tin lưu trú</h3>
              <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-3 sm:gap-4">
                <div><dt className="text-slate-600">Nhận phòng</dt><dd className="mt-1 font-medium tabular-nums text-slate-900"><time dateTime={form.checkIn}>{day(form.checkIn)}</time></dd></div>
                <div><dt className="text-slate-600">Trả phòng</dt><dd className="mt-1 font-medium tabular-nums text-slate-900"><time dateTime={form.checkOut}>{day(form.checkOut)}</time></dd></div>
                <div><dt className="text-slate-600">Khách lưu trú</dt><dd className="mt-1 font-medium text-slate-900">{bookedAdults} người lớn{bookedChildAges.length > 0 && <>
                  {` · ${bookedChildAges.length} trẻ em`}
                  <span className="block text-xs font-normal text-slate-600">{bookedChildAges.map(age => `${age} tuổi`).join(', ')}</span>
                </>}</dd></div>
              </dl>
              <ul aria-label="Phòng đã chọn" className="divide-y divide-slate-200 border-t border-slate-200 bg-slate-50/70 px-4">
                {[...priceGroups].map(([name, group]) => <li key={name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium wrap-anywhere text-slate-800"><BedDouble size={16} className="shrink-0 text-[#1E3A5F]" aria-hidden="true" />{name}</span>
                  <span className="shrink-0 text-slate-600">{group.quantity} phòng</span>
                </li>)}
              </ul>
            </section>
            <section aria-labelledby="confirmation-guest" className="rounded-xl border border-slate-200 p-4">
              <h3 id="confirmation-guest" className="flex items-center gap-2.5 font-semibold text-slate-900"><UsersRound size={18} className="text-[#1E3A5F]" aria-hidden="true" />Thông tin người đặt</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3 sm:gap-4">
                <div><dt className="text-slate-600">Họ tên</dt><dd className="mt-1 font-medium wrap-anywhere text-slate-900">{form.guestName}</dd></div>
                <div><dt className="text-slate-600">Email</dt><dd className="mt-1 font-medium wrap-anywhere text-slate-900">{form.guestEmail}</dd></div>
                <div><dt className="text-slate-600">Số điện thoại</dt><dd className="mt-1 font-medium wrap-anywhere text-slate-900">{form.guestPhone}</dd></div>
                {form.specialRequest && <div className="border-t border-slate-200 pt-3 sm:col-span-3"><dt className="text-slate-600">Yêu cầu đặc biệt</dt><dd className="mt-1 wrap-anywhere whitespace-pre-wrap text-slate-900">{form.specialRequest}</dd></div>}
              </dl>
            </section>
            <section aria-labelledby="confirmation-policy" className="space-y-2 rounded-xl border border-[#DBE8F3] bg-[#F2F7FB] p-4">
              <h3 id="confirmation-policy" className="flex items-center gap-2.5 font-semibold text-slate-900"><ShieldCheck size={18} className="text-[#1E3A5F]" aria-hidden="true" />Chính sách hủy</h3>
              {isMock || cancellationPolicy?.complete
                ? <div id="confirmation-policy-summary" className="text-sm leading-relaxed text-slate-700">
                  {isMock ? hotel.cancellationPolicy : cancellationRule && <CancellationPolicyTerms {...cancellationRule} />}
                </div>
                : <Feedback kind="error" message={cancellationPolicy?.issue ?? 'Chính sách hủy chưa hoàn chỉnh; khách sạn chưa thể nhận booking.'} />}
              {!isMock && cancellationPolicy?.complete && <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#DBE8F3] bg-white px-3 py-2.5 text-sm leading-5 text-slate-800 hover:border-slate-400">
                <input type="checkbox" className="mt-0.5! size-4! min-h-0! shrink-0 p-0! accent-[#1E3A5F] focus-visible:outline-2! focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]" aria-describedby="confirmation-policy-summary" checked={policyAccepted} onChange={event => setAcceptedPolicyVersion(event.target.checked ? cancellationPolicy.version : '')} />
                <span>Tôi đã đọc và đồng ý với chính sách hủy của khách sạn.</span>
              </label>}
            </section>
          </div>
        </>}
        {step === 2 && <>
          {message && <div className="mt-4"><Feedback message={message} kind="error" /></div>}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setMessage(''); setStep(1) }}>Quay lại</Button>
            <Button type="submit" form="guest-details">Tiếp tục</Button>
          </div>
        </>}
      </Card>
      <aside aria-labelledby="checkout-pricing" className="min-w-0 lg:sticky lg:top-24">
        <Card className="overflow-hidden rounded-2xl">
          <header className="flex items-center gap-3 px-4 pt-5 sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#E9F1F9] text-[#1E3A5F]"><ReceiptText size={21} aria-hidden="true" /></span>
            <div><h2 id="checkout-pricing" className="text-lg font-semibold tracking-tight text-slate-900">Chi tiết giá</h2><p className="mt-0.5 text-sm text-slate-600">{form.rooms} phòng{stayIsValid && ` · ${dates.length} đêm`}</p></div>
          </header>
          <dl className="px-4 pt-2 text-sm sm:px-5">
            {[...priceGroups].map(([name, group]) => <div key={name} className="flex items-start justify-between gap-3 border-b border-slate-100 py-3">
              <dt className="min-w-0"><span className="block font-medium text-slate-900">{name}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">{group.quantity} phòng{stayIsValid && ` × ${dates.length} đêm`}{group.rates.size === 1 && ` × ${currency([...group.rates][0]!)}`}</span>
              </dt>
              <dd className="shrink-0 text-right font-semibold tabular-nums text-slate-900">{roomsAvailable ? currency(group.amount) : '—'}</dd>
            </div>)}
            {available && childSurcharge > 0 && <div className="flex justify-between gap-3 border-b border-slate-100 py-3"><dt className="text-slate-700">Phụ thu trẻ em</dt><dd className="shrink-0 font-semibold tabular-nums">{currency(childSurcharge)}</dd></div>}
          </dl>
          {available && <details className="group mx-4 my-3 sm:mx-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-1.5 text-sm font-medium text-[#1E3A5F] focus-visible:outline-2 focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
              Xem giá theo từng đêm <ChevronDown size={16} className="shrink-0 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <dl className="mt-1 max-h-60 divide-y divide-slate-100 overflow-y-auto text-sm text-slate-600">
              {dates.map((date, index) => <div key={date} className="flex justify-between gap-3 py-2"><dt>{day(date)}</dt><dd className="shrink-0 tabular-nums">{currency((byNight[index] ?? 0) + surchargePerNight)}</dd></div>)}
            </dl>
          </details>}
          <div className="mt-3 bg-[#EAF2FA] px-4 py-4 sm:px-5">
            <dl aria-live="polite" aria-atomic="true" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[#173759]"><dt className="font-semibold">Tổng cộng</dt><dd className="text-lg font-bold tracking-tight tabular-nums sm:text-xl">{available ? currency(total) : '—'}</dd></dl>
            {step === 1 && <div className="mt-3 space-y-2">
              {message && <Feedback message={message} kind="error" />}
              <Button className="h-11 w-full justify-between rounded-xl px-4" type="button" disabled={!available} onClick={next}>
                {checkingRooms || checkingGuestPolicies ? 'Đang kiểm tra phòng…' : 'Tiếp tục'}<ArrowRight size={18} aria-hidden="true" />
              </Button>
            </div>}
            {step === 3 && <div className="mt-3 space-y-2">
              {message && <Feedback message={message} kind="error" />}
              <Button className="h-11 w-full justify-between rounded-xl px-4" type="button" disabled={busy || !available || !policyReady || !policyAccepted} onClick={() => void confirm()}>
                {busy ? 'Đang đặt…' : 'Xác nhận và thanh toán'}<ArrowRight size={18} aria-hidden="true" />
              </Button>
              <Button className="w-full rounded-xl" type="button" variant="secondary" disabled={busy} onClick={() => { setMessage(''); setStep(2) }}>Quay lại</Button>
            </div>}
          </div>
        </Card>
      </aside>
    </div>
  </div>
}
