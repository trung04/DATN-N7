import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { repo, isMock } from '@/services'
import { currency, day, errorMessage, nights, stayDays, todayPlus } from '@/lib/utils'
import { useSession } from '@/stores/session'
import { useCatalog } from '@/hooks/data'
import { api } from '@/services/api/client'
import type { BookingInput } from '@/types/domain'

function readRoomIds(value: string | null): string[] {
  if (!value) return []
  try {
    const ids: unknown = JSON.parse(value)
    return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string'))] : []
  } catch {
    return []
  }
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
  const attempt = useRef<{ payload: string; key: string } | null>(null)
  const urlRoomIds = readRoomIds(params.get('roomIds'))
  const [form, setForm] = useState<BookingInput>({
    hotelId: params.get('hotelId') ?? '',
    roomId: urlRoomIds[0] ?? params.get('roomId') ?? '',
    roomIds: urlRoomIds,
    checkIn: params.get('checkIn') ?? todayPlus(7),
    checkOut: params.get('checkOut') ?? todayPlus(9),
    rooms: urlRoomIds.length || Number(params.get('rooms') ?? 1),
    adults: Number(params.get('adults') ?? 2),
    children: Number(params.get('children') ?? 0),
    guestName: user?.name ?? '',
    guestEmail: user?.email ?? '',
    guestPhone: user?.phone ?? '',
    specialRequest: '',
  })
  const stayIsValid = nights(form.checkIn, form.checkOut) > 0
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

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  const hotel = data?.hotels.find(item => item.id === form.hotelId)
  if (!hotel || !data) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy khách sạn" action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} /></div>

  const dates = stayIsValid ? stayDays(form.checkIn, form.checkOut) : []
  const apiAvailableIds = new Set(availabilityQuery.data?.availableRoomIds ?? [])
  const candidateRooms = data.rooms.filter(room => room.hotelId === hotel.id && (isMock || room.operationalStatus === 'AVAILABLE'))
  const eligibleRooms = candidateRooms.filter(room => isMock
    ? dates.length > 0 && dates.every(date => (data.availability.find(item => item.roomId === room.id && item.date === date)?.available ?? 0) > 0)
    : apiAvailableIds.has(room.id))
  const requestedIds = urlRoomIds.length ? urlRoomIds : undefined
  const legacyRoom = candidateRooms.find(room => room.id === form.roomId)
  const legacyCandidates = legacyRoom
    ? eligibleRooms.filter(room => room.name === legacyRoom.name && room.capacity === legacyRoom.capacity && room.basePrice === legacyRoom.basePrice)
      .sort((a, b) => Number(b.id === legacyRoom.id) - Number(a.id === legacyRoom.id))
    : []
  const selectedRoomIds = requestedIds
    ? requestedIds.filter(id => eligibleRooms.some(room => room.id === id))
    : legacyCandidates.slice(0, form.rooms).map(room => room.id)
  const selectedRooms = selectedRoomIds.map(id => candidateRooms.find(room => room.id === id)).filter((room): room is NonNullable<typeof room> => Boolean(room))
  const selectedCount = selectedRooms.length
  const selectedGroups = [...selectedRooms.reduce((groups, room) => {
    const key = [room.name, room.capacity, room.basePrice].join('|')
    const existing = groups.get(key)
    if (existing) existing.quantity += 1
    else groups.set(key, { key, name: room.name, price: room.basePrice, quantity: 1 })
    return groups
  }, new Map<string, { key: string; name: string; price: number; quantity: number }>()).values()]
  const nightlyPrices = dates.map(date => selectedRooms.reduce((sum, room) => sum + (data.inventory.find(item => item.roomId === room.id && item.date === date)?.price ?? room.basePrice), 0))
  const total = nightlyPrices.reduce((sum, price) => sum + price, 0)
  const enoughCapacity = selectedRooms.reduce((sum, room) => sum + room.capacity, 0) >= form.adults + form.children
  const available = stayIsValid && selectedCount > 0 && selectedCount === form.rooms && enoughCapacity
    && (isMock || (!availabilityQuery.isPending && !availabilityQuery.isError))
  const policyReady = isMock || Boolean(cancellationPolicyQuery.data?.complete)
  const policyAccepted = isMock || Boolean(cancellationPolicyQuery.data?.version && acceptedPolicyVersion === cancellationPolicyQuery.data.version)
  const cancellationRule = cancellationPolicyQuery.data?.rules[0]
  const cancellationPolicySummary = cancellationRule
    ? cancellationRule.cancellationAllowed
      ? `Miễn phí hủy trong ${cancellationRule.cancelHours} giờ đầu sau khi đặt; sau đó phí hủy ${cancellationRule.penaltyPercent}%.`
      : `Không hỗ trợ hủy. ${cancellationRule.description ?? ''}`.trim()
    : ''
  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) => setForm(current => ({ ...current, [key]: value }))

  const next = () => {
    setMessage('')
    if (step === 1) {
      if (!isMock && availabilityQuery.isPending) { setMessage('Đang kiểm tra phòng trống.'); return }
      if (!isMock && availabilityQuery.isError) { setMessage(errorMessage(availabilityQuery.error)); return }
      if (!isMock && (cancellationPolicyQuery.isPending || cancellationPolicyQuery.isError || !cancellationPolicyQuery.data?.complete)) { setMessage(cancellationPolicyQuery.data?.issue ?? 'Chưa tải được chính sách hủy của khách sạn.'); return }
      if (form.checkIn < todayPlus(0) || !dates.length || !available || form.adults < 1) { setMessage('Kiểm tra ngày lưu trú, số khách và phòng đã chọn.'); return }
      setStep(2)
    } else if (step === 2) {
      if (form.guestName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.guestEmail) || !/^0\d{9,10}$/.test(form.guestPhone)) { setMessage('Kiểm tra họ tên, email và số điện thoại.'); return }
      setStep(3)
    }
  }

  const confirm = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const payload = JSON.stringify({ ...form, rooms: selectedCount, roomIds: selectedRoomIds })
    const currentAttempt = attempt.current?.payload === payload ? attempt.current : { payload, key: crypto.randomUUID() }
    attempt.current = currentAttempt
    setBusy(true)
    setMessage('')
    try {
      const booking = await repo.createBooking(user?.id ?? '', {
        ...form,
        roomId: selectedRoomIds[0] ?? '',
        roomIds: selectedRoomIds,
        rooms: selectedCount,
        idempotencyKey: currentAttempt.key,
        cancellationPolicyVersion: cancellationPolicyQuery.data?.version,
      })
      navigate('/bookings/' + booking.id + '/payment' + (isMock ? '' : '?auto=1'))
    } catch (err) {
      setMessage(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return <div className="container-app section-pad">
    <PageHeader title="Đặt phòng khách sạn" description={`Bước ${step}/3 · ${step === 1 ? 'Lưu trú' : step === 2 ? 'Thông tin người đặt' : 'Xác nhận'}`} />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-5 sm:p-6">
        {step === 1 && <div className="grid gap-5">
          <div><h2 className="text-lg font-semibold">{hotel.name}</h2><p className="mt-1 text-sm text-slate-500">{selectedCount} phòng · sức chứa {selectedRooms.reduce((sum, room) => sum + room.capacity, 0)} khách</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nhận phòng"><input type="date" min={todayPlus(0)} value={form.checkIn} onChange={event => set('checkIn', event.target.value)} /></FormField>
            <FormField label="Trả phòng"><input type="date" min={form.checkIn} value={form.checkOut} onChange={event => set('checkOut', event.target.value)} /></FormField>
            <FormField label="Người lớn"><input type="number" min="1" max="100" value={form.adults} onChange={event => set('adults', Number(event.target.value))} /></FormField>
            <FormField label="Trẻ em"><input type="number" min="0" max="100" value={form.children} onChange={event => set('children', Number(event.target.value))} /></FormField>
          </div>
          {!selectedCount && <Feedback kind="error" message="Phòng bạn chọn không còn trống. Quay lại khách sạn để chọn phòng khác." />}
          {selectedCount > 0 && !enoughCapacity && <Feedback kind="error" message="Sức chứa phòng đã chọn chưa đủ cho số khách." />}
          {!isMock && availabilityQuery.isError && <Feedback kind="error" message={errorMessage(availabilityQuery.error)} />}
        </div>}
        {step === 2 && <form id="guest-details" className="grid gap-4" onSubmit={event => { event.preventDefault(); next() }}>
          <h2 className="text-lg font-semibold">Thông tin người đặt</h2>
          <FormField label="Họ tên"><input required minLength={2} value={form.guestName} onChange={event => set('guestName', event.target.value)} autoComplete="name" /></FormField>
          <FormField label="Email"><input required type="email" value={form.guestEmail} onChange={event => set('guestEmail', event.target.value)} autoComplete="email" /></FormField>
          <FormField label="Số điện thoại"><input required inputMode="tel" value={form.guestPhone} onChange={event => set('guestPhone', event.target.value)} autoComplete="tel" /></FormField>
          <FormField label="Yêu cầu đặc biệt"><textarea maxLength={5000} value={form.specialRequest} onChange={event => set('specialRequest', event.target.value)} /></FormField>
        </form>}
        {step === 3 && <div className="grid gap-5">
          <h2 className="text-lg font-semibold">Xác nhận thông tin</h2>
          <div className="grid gap-3 text-sm">
            {selectedGroups.map(group => <div key={group.key} className="flex justify-between gap-4"><span>{group.quantity} × {group.name}</span><span>{currency(group.price)}/đêm</span></div>)}
            <p className="border-t border-slate-200 pt-3 text-slate-600">{day(form.checkIn)} – {day(form.checkOut)} · {form.adults} người lớn, {form.children} trẻ em</p>
            <p className="text-slate-600">{form.guestName} · {form.guestEmail} · {form.guestPhone}</p>
            {form.specialRequest && <p className="text-slate-600">Yêu cầu: {form.specialRequest}</p>}
          </div>
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold">Chính sách hủy đã áp dụng</h3>
            {isMock ? <p className="mt-2 text-sm text-slate-600">{hotel.cancellationPolicy}</p> : cancellationPolicyQuery.data?.complete ? <p className="mt-2 text-sm text-slate-700">{cancellationPolicySummary}</p> : <Feedback kind="error" message={cancellationPolicyQuery.data?.issue ?? 'Chính sách hủy chưa hoàn chỉnh; khách sạn chưa thể nhận booking.'} />}
          </section>
          {!isMock && cancellationPolicyQuery.data?.complete && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={acceptedPolicyVersion === cancellationPolicyQuery.data.version} onChange={event => setAcceptedPolicyVersion(event.target.checked ? cancellationPolicyQuery.data!.version : '')} /><span>Tôi đã đọc và đồng ý với chính sách hủy của khách sạn ở trên.</span></label>}
        </div>}
        <Feedback message={message} kind="error" />
        <div className="mt-6 flex justify-end gap-2">
          {step > 1 && <Button type="button" variant="secondary" onClick={() => { setMessage(''); setStep(step - 1) }}>Quay lại</Button>}
          {step < 3 ? <Button type={step === 2 ? 'submit' : 'button'} form={step === 2 ? 'guest-details' : undefined} onClick={step === 1 ? next : undefined}>Tiếp tục</Button> : <Button disabled={busy || !available || !policyReady || !policyAccepted} onClick={() => void confirm()}>{busy ? 'Đang đặt...' : 'Xác nhận và thanh toán'}</Button>}
        </div>
      </Card>
      <Card className="h-fit p-5">
        <h2 className="font-semibold">Chi tiết giá</h2>
        <p className="mt-1 text-sm text-slate-500">{selectedCount} phòng · {dates.length} đêm</p>
        <div className="mt-4 grid gap-3 text-sm">
          {selectedGroups.map(group => <div key={group.key} className="flex justify-between gap-3"><span>{group.quantity} × {group.name}</span><span>{currency(group.price * group.quantity)}/đêm</span></div>)}
          {nightlyPrices.map((price, index) => <div key={dates[index]} className="flex justify-between border-t border-slate-100 pt-2 text-slate-500"><span>{day(dates[index]!)}</span><span>{currency(price)}</span></div>)}
        </div>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-semibold"><span>Tổng cộng</span><span className="text-[#1E3A5F]">{currency(total)}</span></div>
      </Card>
    </div>
  </div>
}
