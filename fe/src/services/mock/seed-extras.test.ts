import { beforeEach, expect, it } from 'vitest'
import { todayPlus } from '@/lib/utils'
import { seedData } from './seed'
import { readData } from './store'

beforeEach(() => localStorage.clear())

it('seed bổ sung có đủ quan hệ và tồn phòng cho các khách sạn mới', () => {
  const data = seedData()
  expect(data.version).toBe(3)
  expect(data.destinations.length).toBeGreaterThanOrEqual(20)
  expect(data.hotels.length).toBeGreaterThanOrEqual(8)
  expect(data.restaurants.length).toBeGreaterThanOrEqual(10)
  for (const collection of [data.destinations, data.hotels, data.rooms, data.restaurants, data.trips, data.bookings, data.partners, data.services, data.settlements]) {
    expect(new Set(collection.map(item => item.id)).size).toBe(collection.length)
  }
  for (const hotel of data.hotels) expect(data.partners.some(partner => partner.id === hotel.partnerId && partner.hotelIds.includes(hotel.id))).toBe(true)
  for (const room of data.rooms) {
    expect(data.hotels.some(hotel => hotel.id === room.hotelId)).toBe(true)
    expect(data.inventory.some(row => row.roomId === room.id && row.date === todayPlus(7) && row.offered > 0 && row.price > 0)).toBe(true)
  }
  for (const booking of data.bookings) {
    expect(data.rooms.some(room => room.id === booking.roomId && room.hotelId === booking.hotelId)).toBe(true)
    expect(booking.nightlyPrices.reduce((sum, price) => sum + price * booking.rooms, 0)).toBe(booking.total)
    if (booking.status === 'COMPLETED' || booking.status === 'CONFIRMED' || booking.status === 'CANCELLED') {
      expect(data.payments.some(payment => payment.bookingId === booking.id && payment.status === 'PAID')).toBe(true)
    }
  }
  for (const review of data.reviews) expect(data.bookings.some(booking => booking.id === review.bookingId && booking.userId === review.userId && booking.status === 'COMPLETED')).toBe(true)
  for (const settlement of data.settlements) {
    expect(settlement.bookingIds.every(id => data.bookings.some(booking => booking.id === id && booking.hotelId === settlement.hotelId))).toBe(true)
    expect(settlement.gross - settlement.commission + settlement.adjustment).toBe(settlement.net)
  }
})

it('nâng cấp dữ liệu v2, giữ bản ghi đã sửa và không thêm trùng khi tải lại', () => {
  const prior = seedData()
  prior.version = 2
  prior.hotels = prior.hotels.filter(hotel => hotel.id !== 'lotus-hue')
  prior.rooms = prior.rooms.filter(room => room.id !== 'room-lotus-classic')
  prior.inventory = prior.inventory.filter(row => row.roomId !== 'room-lotus-classic')
  prior.trips = prior.trips.filter(trip => trip.id !== 'trip-demo')
  prior.hotels.find(hotel => hotel.id === 'sea-garden')!.name = 'Tên do người dùng sửa'
  localStorage.setItem('smarttravel.demo.v2', JSON.stringify(prior))

  const upgraded = readData()
  expect(upgraded.version).toBe(3)
  expect(upgraded.hotels.find(hotel => hotel.id === 'sea-garden')?.name).toBe('Tên do người dùng sửa')
  expect(upgraded.trips.some(trip => trip.id === 'trip-demo')).toBe(false)
  expect(upgraded.hotels.filter(hotel => hotel.id === 'lotus-hue')).toHaveLength(1)
  expect(upgraded.rooms.filter(room => room.id === 'room-lotus-classic')).toHaveLength(1)
  expect(upgraded.inventory.some(row => row.roomId === 'room-lotus-classic' && row.date === todayPlus(7))).toBe(true)
  expect(readData().hotels.length).toBe(upgraded.hotels.length)
})
