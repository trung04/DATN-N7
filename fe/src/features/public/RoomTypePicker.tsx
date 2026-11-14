import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Picture } from '@/components/common'
import { currency, nights } from '@/lib/utils'
import { seededRoomPhoto } from '@/lib/hotel-media'
import type { Hotel, RoomInventory, RoomType } from '@/types/domain'

type Props = {
  hotel: Hotel
  rooms: RoomType[]
  data: { rooms: RoomType[]; inventory: RoomInventory[]; availability: Array<{ roomId: string; date: string; available: number }> }
  availableRoomIds?: string[]
  checkIn: string
  checkOut: string
  adults: number
  children: number
  isMock: boolean
}

type RoomGroup = { key: string; room: RoomType; physicalRooms: RoomType[] }

export function RoomTypePicker({ hotel, rooms, data, availableRoomIds, checkIn, checkOut, adults, children, isMock }: Props) {
  const navigate = useNavigate()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const stayNights = nights(checkIn, checkOut)
  const dates = Array.from({ length: Math.max(0, stayNights) }, (_, index) => {
    const date = new Date(checkIn + 'T12:00:00')
    date.setDate(date.getDate() + index)
    return date.toISOString().slice(0, 10)
  })

  const groups = useMemo(() => {
    const grouped = new Map<string, RoomGroup>()
    for (const room of rooms) {
      if (!isMock && room.operationalStatus !== 'AVAILABLE') continue
      const key = [room.name, room.capacity, room.basePrice, room.area, room.bed].join('|')
      const group = grouped.get(key)
      if (group) group.physicalRooms.push(room)
      else grouped.set(key, { key, room, physicalRooms: [room] })
    }
    return [...grouped.values()]
  }, [rooms, isMock])

  const availableIdsByGroup = (group: RoomGroup) => {
    if (isMock) {
      // Mock inventory stores a quantity per room category, while API mode
      // receives one ID per physical room. Repeat the category ID to model
      // selecting several rooms of the same type in demo mode.
      if (!dates.length) return []
      const availableCount = Math.min(...dates.map(date =>
        data.availability.find(item => item.roomId === group.room.id && item.date === date)?.available ?? 0,
      ))
      return Array.from({ length: Math.max(0, availableCount) }, () => group.room.id)
    }

    return group.physicalRooms
      .filter(room => availableRoomIds?.includes(room.id) ?? false)
      .map(room => room.id)
  }

  const selected = groups.flatMap(group => {
    const roomIds = availableIdsByGroup(group).slice(0, quantities[group.key] ?? 0)
    return roomIds.map(roomId => ({ group, roomId }))
  })
  const selectedCount = selected.length
  const totalCapacity = selected.reduce((sum, item) => sum + item.group.room.capacity, 0)
  const enoughCapacity = selectedCount > 0 && adults + children <= totalCapacity
  const nightlyTotal = selected.reduce((sum, item) => sum + item.group.room.basePrice, 0)
  const stayTotal = nightlyTotal * stayNights
  const roomLimit = 10

  const changeQuantity = (group: RoomGroup, delta: number) => {
    setQuantities(current => {
      const currentQuantity = current[group.key] ?? 0
      const maxQuantity = Math.min(availableIdsByGroup(group).length, roomLimit - (selectedCount - currentQuantity))
      const nextQuantity = Math.max(0, Math.min(maxQuantity, currentQuantity + delta))
      return { ...current, [group.key]: nextQuantity }
    })
  }

  const proceed = () => {
    if (!enoughCapacity || !selectedCount || selectedCount > roomLimit) return
    const query = new URLSearchParams({
      hotelId: hotel.id,
      roomId: selected[0]?.roomId ?? '',
      roomIds: JSON.stringify(selected.map(item => item.roomId)),
      checkIn,
      checkOut,
      rooms: String(selectedCount),
      adults: String(adults),
      children: String(children),
    })
    navigate('/bookings/new?' + query.toString())
  }

  return <div className="grid gap-5">
    {groups.map(group => {
      const availableCount = availableIdsByGroup(group).length
      const quantity = quantities[group.key] ?? 0
      const room = group.room
      return <Card key={group.key} className="grid gap-4 p-4 sm:grid-cols-[220px_1fr_auto]">
        <Picture label={room.name} src={seededRoomPhoto(hotel.id, room.name)} className="h-44 w-full rounded-lg sm:h-full" />
        <div className="min-w-0 py-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold">{room.name}</h3>
            <span className="text-sm text-slate-500">{room.capacity} khách · {room.area} m² · {room.bed}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{room.description}</p>
          <p className="mt-2 text-xs text-slate-500">{room.amenities.join(' · ')}</p>
          <p className="mt-3 text-xs font-medium text-slate-500">{availableCount ? `Còn ${availableCount} phòng` : 'Hết phòng'}</p>
        </div>
        <div className="flex min-w-36 flex-row items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-lg font-semibold text-[#1E3A5F]">{currency(room.basePrice)}<span className="ml-1 text-xs font-normal text-slate-500">/ đêm</span></p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="icon" aria-label={`Giảm ${room.name}`} disabled={!quantity} onClick={() => changeQuantity(group, -1)}><Minus size={16} /></Button>
            <span className="w-6 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
            <Button type="button" variant="secondary" size="icon" aria-label={`Tăng ${room.name}`} disabled={availableCount <= quantity || selectedCount >= roomLimit} onClick={() => changeQuantity(group, 1)}><Plus size={16} /></Button>
          </div>
        </div>
      </Card>
    })}
    <Card className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-4 border-[#cbd8e6] p-4 shadow-lg sm:p-5">
      <div>
        <p className="font-semibold">{selectedCount} phòng · {stayNights} đêm</p>
        <p className="mt-1 text-sm text-slate-500">Tạm tính {currency(stayTotal)}</p>
        {selectedCount > 0 && !enoughCapacity && <p className="mt-1 text-sm text-red-700">Chưa đủ sức chứa cho {adults + children} khách.</p>}
      </div>
      <Button disabled={!enoughCapacity || !dates.length} onClick={proceed}>Tiếp tục đặt phòng</Button>
    </Card>
  </div>
}
