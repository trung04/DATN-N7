import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Feedback, FormField, LoadingState, PageHeader } from '@/components/common'
import { repo, isMock } from '@/services'
import { currency, day, errorMessage, nights, stayDays, todayPlus } from '@/lib/utils'
import { allocateGuestsToRooms, readChildAges } from '@/lib/room-occupancy'
import { useSession } from '@/stores/session'
import { useCatalog } from '@/hooks/data'
import { api } from '@/services/api/client'
import type { BookingInput, RoomGuestAllocation, RoomGuestPolicy } from '@/types/domain'

function readRoomIds(value: string | null): string[] {
  if (!value) return []
  try {
    const ids: unknown = JSON.parse(value)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
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
  const [roomGuests, setRoomGuests] = useState<Record<string, RoomGuestAllocation>>({})
  const attempt = useRef<{ payload: string; key: string } | null>(null)
  const urlRoomIds = readRoomIds(params.get('roomIds'))
  const requestedChildAges = readChildAges(params.get('childAges'), Number(params.get('children') ?? 0))
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
  const guestPoliciesQuery = useQuery({
    queryKey: ['room-guest-policies', form.hotelId],
    queryFn: () => api.roomGuestPolicies(form.hotelId),
    enabled: !isMock && Boolean(form.hotelId),
  })

  const hotel = data?.hotels.find(item => item.id === form.hotelId)

  const dates = stayIsValid ? stayDays(form.checkIn, form.checkOut) : []
  const apiAvailableIds = new Set(availabilityQuery.data?.availableRoomIds ?? [])
  const candidateRooms = (data?.rooms ?? []).filter(room => room.hotelId === (hotel?.id ?? form.hotelId) && (isMock || room.operationalStatus === 'AVAILABLE'))
  const eligibleRooms = candidateRooms.filter(room => isMock
    ? dates.length > 0 && dates.every(date => ((data?.availability ?? []).find(item => item.roomId === room.id && item.date === date)?.available ?? 0) > 0)
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
  const selectedRooms = selectedRoomIds.map((id, index) => {
    const room = candidateRooms.find(item => item.id === id)
    return room && isMock ? { ...room, id: `${room.id}::mock-${index}` } : room
  }).filter((room): room is NonNullable<typeof room> => Boolean(room))
  const guestPolicyFor = (room: (typeof selectedRooms)[number]): RoomGuestPolicy | undefined => guestPoliciesQuery.data?.find(policy => policy.hotelId === hotel?.id && policy.roomType.trim().toLocaleLowerCase('vi-VN') === room.name.trim().toLocaleLowerCase('vi-VN'))
  const guestLimitsFor = (room: (typeof selectedRooms)[number]) => {
    const policy = guestPolicyFor(room)
    return {
      maxAdults: Math.min(policy?.maxAdults ?? room.capacity, room.capacity),
      maxChildren: policy?.maxChildren ?? room.capacity,
      adultAgeFrom: policy?.adultAgeFrom ?? 12,
      freeChildMaxAge: policy?.freeChildMaxAge ?? 11,
      childSurchargePerNight: policy?.childSurchargePerNight ?? 0,
    }
  }
  useEffect(() => {
    if (!selectedRoomIds.length || (!isMock && guestPoliciesQuery.isPending)) return
    const selectedRoomKeys = selectedRooms.map(room => room.id)
    const next = Object.fromEntries(Object.entries(roomGuests).filter(([id]) => selectedRoomKeys.includes(id)))
    const roomsNeedingAllocation = selectedRooms.filter(room => !next[room.id])
    if (!roomsNeedingAllocation.length) return

    const retained = Object.values(next)
    const adultsAssigned = retained.reduce((sum, item) => sum + item.adultCount, 0)
    const remainingAges = [...requestedChildAges]
    retained.forEach(allocation => allocation.childAges.forEach(age => {
      const index = remainingAges.indexOf(age)
      if (index >= 0) remainingAges.splice(index, 1)
    }))
    const roomsToAllocate = roomsNeedingAllocation
    const remainingAdults = Math.max(0, Number(params.get('adults') ?? 2) - adultsAssigned)
    const allocations = allocateGuestsToRooms(roomsToAllocate, remainingAdults, remainingAges, guestPoliciesQuery.data ?? [])
    if (!allocations) return

    const initialized = { ...next, ...Object.fromEntries(allocations.map(allocation => [allocation.roomId, allocation])) }
    const allAllocations = selectedRooms.map(room => initialized[room.id]).filter((value): value is RoomGuestAllocation => Boolean(value))
    setRoomGuests(initialized)
    setForm(current => ({
      ...current,
      adults: allAllocations.reduce((sum, allocation) => sum + allocation.adultCount, 0),
      children: allAllocations.reduce((sum, allocation) => sum + allocation.childAges.length, 0),
    }))
  }, [selectedRoomIds.join('|'), guestPoliciesQuery.data, guestPoliciesQuery.isPending])
  const selectedGuestAllocations = selectedRooms.map(room => roomGuests[room.id]).filter((value): value is RoomGuestAllocation => Boolean(value))
  const bookingGuestAllocations = selectedGuestAllocations.map((allocation, index) => ({ ...allocation, roomId: selectedRoomIds[index] ?? allocation.roomId }))
  const allocatedAdults = selectedGuestAllocations.reduce((sum, allocation) => sum + allocation.adultCount, 0)
  const allocatedChildren = selectedGuestAllocations.reduce((sum, allocation) => sum + allocation.childAges.length, 0)
  const allocationValid = selectedRooms.length > 0 && selectedRooms.every(room => {
    const allocation = roomGuests[room.id]
    if (!allocation) return false
    const limits = guestLimitsFor(room)
    return allocation.adultCount <= limits.maxAdults && allocation.childAges.length <= limits.maxChildren
      && allocation.adultCount + allocation.childAges.length <= room.capacity
      && allocation.childAges.every(age => age >= 0 && age < limits.adultAgeFrom)
  }) && allocatedAdults === form.adults && allocatedChildren === form.children && allocatedAdults >= 1
  const selectedCount = selectedRooms.length
  const selectedGroups = [...selectedRooms.reduce((groups, room) => {
    const key = [room.name, room.capacity, room.basePrice].join('|')
    const existing = groups.get(key)
    if (existing) existing.quantity += 1
    else groups.set(key, { key, name: room.name, price: room.basePrice, quantity: 1 })
    return groups
  }, new Map<string, { key: string; name: string; price: number; quantity: number }>()).values()]
  const childSurchargePerNight = selectedRooms.reduce((sum, room) => {
    const limits = guestLimitsFor(room)
    return sum + (roomGuests[room.id]?.childAges.filter(age => age > limits.freeChildMaxAge).length ?? 0) * limits.childSurchargePerNight
  }, 0)
  const nightlyPrices = dates.map(date => selectedRooms.reduce((sum, room) => sum + ((data?.inventory ?? []).find(item => item.roomId === room.id && item.date === date)?.price ?? room.basePrice), 0) + childSurchargePerNight)
  const total = nightlyPrices.reduce((sum, price) => sum + price, 0)
  const enoughCapacity = allocationValid
  const available = stayIsValid && selectedCount > 0 && selectedCount === form.rooms && enoughCapacity
    && (isMock || (!availabilityQuery.isPending && !availabilityQuery.isError && !guestPoliciesQuery.isPending && !guestPoliciesQuery.isError))
  const policyReady = isMock || Boolean(cancellationPolicyQuery.data?.complete)
  const policyAccepted = isMock || Boolean(cancellationPolicyQuery.data?.version && acceptedPolicyVersion === cancellationPolicyQuery.data.version)
  const cancellationRule = cancellationPolicyQuery.data?.rules[0]
  const cancellationPolicySummary = cancellationRule
    ? cancellationRule.cancellationAllowed
      ? `Miễn phí hủy trong ${cancellationRule.cancelHours} giờ đầu sau khi đặt; sau đó phí hủy ${cancellationRule.penaltyPercent}%.`
      : `Không hỗ trợ hủy. ${cancellationRule.description ?? ''}`.trim()
    : ''
  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) => setForm(current => ({ ...current, [key]: value }))
  const updateRoomGuests = (roomId: string, update: (current: RoomGuestAllocation) => RoomGuestAllocation) => {
    const next = update(roomGuests[roomId] ?? { roomId, adultCount: 0, childAges: [] })
    const all = selectedRooms.map(room => room.id === roomId ? next : roomGuests[room.id] ?? { roomId: room.id, adultCount: 0, childAges: [] })
    setRoomGuests(current => ({ ...current, [roomId]: next }))
    setForm(current => ({ ...current, adults: all.reduce((sum, allocation) => sum + allocation.adultCount, 0), children: all.reduce((sum, allocation) => sum + allocation.childAges.length, 0) }))
  }

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
    const payload = JSON.stringify({ ...form, rooms: selectedCount, roomIds: selectedRoomIds, roomGuests: bookingGuestAllocations })
    const currentAttempt = attempt.current?.payload === payload ? attempt.current : { payload, key: crypto.randomUUID() }
    attempt.current = currentAttempt
    setBusy(true)
    setMessage('')
    try {
      const booking = await repo.createBooking(user?.id ?? '', {
        ...form,
        roomId: selectedRoomIds[0] ?? '',
        roomIds: selectedRoomIds,
        roomGuests: bookingGuestAllocations,
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

  if (isLoading) return <LoadingState />
  if (error) return <div className="container-app section-pad"><ErrorState message={errorMessage(error)} /></div>
  if (!hotel || !data) return <div className="container-app section-pad"><EmptyState title="Không tìm thấy khách sạn" action={<Button asChild><Link to="/hotels">Tìm khách sạn</Link></Button>} /></div>

  return <div className="container-app section-pad">
    <PageHeader title="Đặt phòng khách sạn" description={`Bước ${step}/3 · ${step === 1 ? 'Lưu trú' : step === 2 ? 'Thông tin người đặt' : 'Xác nhận'}`} />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-5 sm:p-6">
        {step === 1 && <div className="grid gap-5">
          <div><h2 className="text-lg font-semibold">{hotel.name}</h2><p className="mt-1 text-sm text-slate-500">{selectedCount} phòng · {allocatedAdults} người lớn · {allocatedChildren} trẻ em</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nhận phòng"><input type="date" min={todayPlus(0)} value={form.checkIn} onChange={event => set('checkIn', event.target.value)} /></FormField>
            <FormField label="Trả phòng"><input type="date" min={form.checkIn} value={form.checkOut} onChange={event => set('checkOut', event.target.value)} /></FormField>
          </div>
          <div className="grid gap-3">
            <h3 className="font-semibold">Khách lưu trú theo từng phòng</h3>
            {selectedRooms.map((room, index) => {
              const allocation = roomGuests[room.id] ?? { roomId: room.id, adultCount: 0, childAges: [] }
              const limits = guestLimitsFor(room)
              const canAddChild = allocation.childAges.length < limits.maxChildren && allocation.adultCount + allocation.childAges.length < room.capacity
              return <section className="rounded-xl border border-slate-200 p-4" key={room.id}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium">Phòng {index + 1}: {room.name}</h4><span className="text-sm text-slate-500">Tối đa {room.capacity} khách</span></div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <FormField label={`Người lớn (tối đa ${limits.maxAdults})`}><input type="number" min="0" max={limits.maxAdults} value={allocation.adultCount} onChange={event => updateRoomGuests(room.id, current => ({ ...current, adultCount: Math.min(limits.maxAdults, Math.max(0, Number(event.target.value) || 0)) }))} /></FormField>
                  <div><p className="mb-2 text-sm font-medium">Trẻ em ({allocation.childAges.length}/{limits.maxChildren})</p>
                    <div className="grid gap-2">{allocation.childAges.map((age, childIndex) => <div className="flex items-center gap-2" key={`${room.id}-child-${childIndex}`}><select aria-label={`Tuổi trẻ em ${childIndex + 1} phòng ${index + 1}`} value={age} onChange={event => updateRoomGuests(room.id, current => ({ ...current, childAges: current.childAges.map((value, at) => at === childIndex ? Number(event.target.value) : value) }))}>{Array.from({ length: limits.adultAgeFrom }, (_, value) => <option key={value} value={value}>{value} tuổi{value > limits.freeChildMaxAge && limits.childSurchargePerNight > 0 ? ` · +${currency(limits.childSurchargePerNight)}/đêm` : ''}</option>)}</select><Button type="button" variant="secondary" size="sm" onClick={() => updateRoomGuests(room.id, current => ({ ...current, childAges: current.childAges.filter((_, at) => at !== childIndex) }))}>Xóa</Button></div>)}</div>
                    <Button className="mt-2" type="button" variant="secondary" size="sm" disabled={!canAddChild} onClick={() => updateRoomGuests(room.id, current => ({ ...current, childAges: [...current.childAges, 0] }))}>Thêm trẻ em</Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Từ {limits.adultAgeFrom} tuổi được tính là người lớn. Trẻ đến {limits.freeChildMaxAge} tuổi miễn phụ thu; trẻ lớn hơn phụ thu {currency(limits.childSurchargePerNight)}/đêm.</p>
              </section>
            })}
          </div>
          {!selectedCount && <Feedback kind="error" message="Phòng bạn chọn không còn trống. Quay lại khách sạn để chọn phòng khác." />}
          {selectedCount > 0 && !enoughCapacity && <Feedback kind="error" message="Phân bổ khách chưa hợp lệ. Mỗi phòng có giới hạn người lớn, trẻ em và tổng sức chứa riêng." />}
          {!isMock && availabilityQuery.isError && <Feedback kind="error" message={errorMessage(availabilityQuery.error)} />}
          {!isMock && guestPoliciesQuery.isError && <Feedback kind="error" message={errorMessage(guestPoliciesQuery.error)} />}
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
            {selectedGuestAllocations.map((allocation, index) => <p className="text-slate-600" key={allocation.roomId}>Phòng {index + 1}: {allocation.adultCount} người lớn, {allocation.childAges.join(', ') || 0} tuổi trẻ em</p>)}
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
