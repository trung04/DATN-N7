import type { RoomGuestAllocation, RoomGuestPolicy, RoomType } from '@/types/domain'

type GuestPolicyLimits = Pick<RoomGuestPolicy, 'maxAdults' | 'maxChildren' | 'adultAgeFrom'>

export function readChildAges(value: string | null, count: number, defaultAge = 5): number[] {
  const ages = (value ?? '').split(',').map(item => item.trim() ? Number(item) : Number.NaN)
  return Array.from({ length: Math.max(0, Math.min(10, count)) }, (_, index) => {
    const age = ages[index]
    return Number.isInteger(age) && age! >= 0 && age! <= 17 ? age! : defaultAge
  })
}

function limitsFor(room: RoomType, policies: RoomGuestPolicy[]): GuestPolicyLimits {
  const policy = policies.find(item => item.hotelId === room.hotelId && item.roomType.trim().toLocaleLowerCase('vi-VN') === room.name.trim().toLocaleLowerCase('vi-VN'))
  return {
    maxAdults: Math.min(policy?.maxAdults ?? room.capacity, room.capacity),
    maxChildren: Math.min(policy?.maxChildren ?? room.capacity, room.capacity),
    adultAgeFrom: policy?.adultAgeFrom ?? 12,
  }
}

/** Allocate the requested guests to the selected rooms using each room type's age rules. */
export function allocateGuestsToRooms(
  rooms: RoomType[],
  adults: number,
  childAges: number[],
  policies: RoomGuestPolicy[] = [],
): RoomGuestAllocation[] | null {
  if (!rooms.length || adults < 0 || childAges.some(age => !Number.isInteger(age) || age < 0 || age > 17)) return null

  const states = rooms.map(room => ({
    room,
    limits: limitsFor(room, policies),
    adults: 0,
    children: [] as number[],
  }))
  const guests = [
    ...Array.from({ length: adults }, () => ({ age: null as number | null })),
    ...childAges.map(age => ({ age })),
  ].sort((a, b) => {
    const choices = (guest: { age: number | null }) => states.filter(state => {
      const isAdult = guest.age === null || guest.age >= state.limits.adultAgeFrom
      return state.room.capacity > 0 && (isAdult ? state.limits.maxAdults > 0 : state.limits.maxChildren > 0)
    }).length
    return choices(a) - choices(b) || (b.age ?? 99) - (a.age ?? 99)
  })

  const placeGuest = (index: number): boolean => {
    if (index >= guests.length) return true
    const guest = guests[index]
    if (!guest) return false
    const tried = new Set<string>()
    for (const state of states) {
      const isAdult = guest.age === null || guest.age >= state.limits.adultAgeFrom
      const signature = [state.room.capacity, state.limits.maxAdults, state.limits.maxChildren, state.limits.adultAgeFrom, state.adults, state.children.length].join(':')
      if (tried.has(signature)) continue
      tried.add(signature)
      if (state.adults + state.children.length >= state.room.capacity) continue
      if (isAdult && state.adults >= state.limits.maxAdults) continue
      if (!isAdult && state.children.length >= state.limits.maxChildren) continue

      if (isAdult) state.adults += 1
      else state.children.push(guest.age!)
      if (placeGuest(index + 1)) return true
      if (isAdult) state.adults -= 1
      else state.children.pop()
    }
    return false
  }

  if (!placeGuest(0)) return null
  return states.map(({ room, adults: adultCount, children }) => ({ roomId: room.id, adultCount, childAges: children }))
}

/** Return the lowest per-room nightly price among available room combinations that fit the party. */
export function lowestBookableRoomPrice(
  roomOptions: Array<{ room: RoomType; count: number }>,
  requestedRooms: number,
  adults: number,
  childAges: number[],
  policies: RoomGuestPolicy[] = [],
): number | null {
  if (requestedRooms < 1 || requestedRooms > 5) return null

  const grouped = new Map<string, { room: RoomType; count: number }>()
  for (const option of roomOptions) {
    if (option.count < 1) continue
    const limits = limitsFor(option.room, policies)
    const policy = policies.find(item => item.hotelId === option.room.hotelId && item.roomType.trim().toLocaleLowerCase('vi-VN') === option.room.name.trim().toLocaleLowerCase('vi-VN'))
    const key = [option.room.capacity, option.room.basePrice, limits.maxAdults, limits.maxChildren, limits.adultAgeFrom, policy?.freeChildMaxAge ?? 11, policy?.childSurchargePerNight ?? 0].join('|')
    const current = grouped.get(key)
    if (current) current.count += option.count
    else grouped.set(key, { ...option })
  }
  const groups = [...grouped.values()].sort((a, b) => a.room.basePrice - b.room.basePrice)
  if (groups.reduce((sum, item) => sum + item.count, 0) < requestedRooms) return null

  let lowestPrice = Number.POSITIVE_INFINITY
  const selected: RoomType[] = []
  const choose = (index: number, remaining: number): void => {
    if (remaining === 0) {
      const allocations = allocateGuestsToRooms(selected, adults, childAges, policies)
      if (allocations) {
        const nightlyPrices = selected.map((room, roomIndex) => {
          const policy = policies.find(item => item.hotelId === room.hotelId && item.roomType.trim().toLocaleLowerCase('vi-VN') === room.name.trim().toLocaleLowerCase('vi-VN'))
          const surcharge = allocations[roomIndex]?.childAges.filter(age => age > (policy?.freeChildMaxAge ?? 11)).length ?? 0
          return room.basePrice + surcharge * (policy?.childSurchargePerNight ?? 0)
        })
        lowestPrice = Math.min(lowestPrice, ...nightlyPrices)
      }
      return
    }
    if (index >= groups.length) return
    const possible = groups.slice(index).reduce((sum, item) => sum + item.count, 0)
    if (possible < remaining) return

    for (let groupIndex = index; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]
      if (!group) continue
      const maxTake = Math.min(group.count, remaining)
      for (let take = maxTake; take >= 1; take -= 1) {
        selected.push(...Array.from({ length: take }, () => group.room))
        group.count -= take
        choose(groupIndex + 1, remaining - take)
        group.count += take
        selected.length -= take
      }
    }
  }
  choose(0, requestedRooms)
  return Number.isFinite(lowestPrice) ? lowestPrice : null
}
