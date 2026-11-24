import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/services/api/client'
import type { ManagedBooking, Review, PartnerHotel } from '@/types/domain'
import { BookingManagementPage } from '@/features/bookings/management'
import { ReviewManagementPage } from '@/features/reviews/management'
import { PartnerRoomsPage } from './rooms'

const hotels = [1, 2].map(index => ({ id: `hotel-${index}`, name: `Khách sạn ${index}` }) as PartnerHotel)

function show(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.spyOn(api, 'myHotels').mockResolvedValue({ data: hotels, meta: { page: 1, limit: 100, total: 2 } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('booking next page works and changing hotel returns to page 1', async () => {
  const user = userEvent.setup()
  const bookings = vi.spyOn(api, 'managedBookings').mockImplementation(async query => ({
    data: [{ id: `booking-${query.page}`, hotelId: query.hotelId, bookingCode: `BK-PAGE-${query.page}`, guestName: 'Khách', guestEmail: 'a@example.org', amount: 500000, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID', refundStatus: 'NONE', checkInDate: '2026-11-19', checkOutDate: '2026-11-20', createdAt: '2026-11-01' } as ManagedBooking],
    meta: { page: query.page, limit: query.limit, total: 45 },
  }))
  show(<BookingManagementPage />)
  await screen.findByText('BK-PAGE-1')
  await user.click(screen.getByRole('button', { name: 'Sau' }))
  await screen.findByText('BK-PAGE-2')
  expect(bookings).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, hotelId: 'hotel-1' }))
  await user.selectOptions(screen.getByLabelText('Khách sạn'), 'hotel-2')
  await screen.findByText('BK-PAGE-1')
  expect(bookings).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, hotelId: 'hotel-2' }))
})

it('reviews next page works and changing stars returns to page 1', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'reviewSummary').mockResolvedValue({ hotelId: 'hotel-1', averageRating: 4.75, visibleCount: 45 })
  const reviews = vi.spyOn(api, 'reviewPage').mockImplementation(async query => ({
    data: [{ id: `review-${query.page}`, hotelId: 'hotel-1', reviewerName: 'Khách', bookingId: 'BK', stars: 5, content: `Đánh giá trang ${query.page}`, status: 'VISIBLE', createdAt: '2026-11-01' } as Review],
    meta: { page: query.page, limit: query.limit, total: 45 },
  }))
  show(<ReviewManagementPage />)
  await screen.findByText('Đánh giá trang 1')
  await user.click(screen.getByRole('button', { name: 'Sau' }))
  await screen.findByText('Đánh giá trang 2')
  await user.selectOptions(screen.getByLabelText('Số sao'), '5')
  await screen.findByText('Đánh giá trang 1')
  expect(reviews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, stars: 5 }))
})

it('rooms request one scoped page and reset pagination when selecting a hotel', async () => {
  const user = userEvent.setup()
  const rooms = vi.spyOn(api, 'managedRoomPage').mockImplementation(async query => ({ data: [], meta: { ...query, total: 45 } }))
  show(<PartnerRoomsPage />)
  await screen.findByRole('navigation', { name: 'Phân trang' })
  await user.click(screen.getByRole('button', { name: 'Sau' }))
  await waitFor(() => expect(rooms).toHaveBeenLastCalledWith({ page: 2, limit: 10 }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), '15')
  await waitFor(() => expect(rooms).toHaveBeenLastCalledWith({ page: 1, limit: 15 }))
  await user.click(await screen.findByRole('button', { name: 'Sau' }))
  await waitFor(() => expect(rooms).toHaveBeenLastCalledWith({ page: 2, limit: 15 }))
  await screen.findByLabelText('Khách sạn')
  await user.selectOptions(screen.getByLabelText('Khách sạn'), 'hotel-2')
  await waitFor(() => expect(rooms).toHaveBeenLastCalledWith({ page: 1, limit: 15, hotelId: 'hotel-2' }))
})
