import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useBooking } from '@/hooks/data'
import { api } from '@/services/api/client'
import { BookingDetailPage, PaymentPage, PaymentResultPage } from './pages'

vi.mock('@/hooks/data', () => ({ useBooking: vi.fn(), useCatalog: () => ({}) }))
vi.mock('@/services', () => ({ isMock: false, repo: {} }))

const start = Date.parse('2026-11-27T03:00:00Z')

function renderPayment(path = '/bookings/booking-1/payment') {
  const client = new QueryClient()
  return render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/bookings/:id/payment" element={<PaymentPage />} />
        <Route path="/bookings/:id/payment-result" element={<PaymentResultPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(start)
  vi.mocked(useBooking).mockReturnValue({
    data: {
      booking: {
        id: 'booking-1',
        status: 'PENDING_PAYMENT',
        total: 500_000,
        holdExpiresAt: new Date(start + 3_000).toISOString(),
      },
    },
    dataUpdatedAt: start,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useBooking>)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('counts down on the payment page and hides the payment action at expiry', () => {
  renderPayment()
  expect(screen.getByRole('timer')).toHaveTextContent('Còn 00:03 để thanh toán')
  act(() => { vi.advanceTimersByTime(1_000) })
  expect(screen.getByRole('timer')).toHaveTextContent('Còn 00:02 để thanh toán')
  act(() => { vi.advanceTimersByTime(2_000) })
  expect(screen.getByRole('status')).toHaveTextContent('Đã hết hạn thanh toán')
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thanh toán qua payOS' })).not.toBeInTheDocument()
})

it('starts checkout once on entry and shows retry only after a failure', async () => {
  let rejectCheckout!: (error: Error) => void
  const startCheckout = vi.spyOn(api, 'createPayosPayment').mockImplementationOnce(() => new Promise((_, reject) => {
    rejectCheckout = reject
  })).mockResolvedValue({
    bookingId: 'booking-1',
    paymentUrl: 'https://pay.payos.vn/web/00000000000000000000000000000001',
    expiresAt: new Date(start - 1_000).toISOString(),
  })

  renderPayment('/bookings/booking-1/payment?auto=1')
  expect(startCheckout).toHaveBeenCalledExactlyOnceWith('booking-1')
  expect(screen.getByRole('status')).toHaveTextContent('Đang chuyển đến payOS…')
  expect(screen.queryByRole('button', { name: 'Thanh toán qua payOS' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Mở cổng thanh toán payOS' })).not.toBeInTheDocument()

  await act(async () => { rejectCheckout(new Error('Không tạo được phiên thanh toán.')) })
  expect(screen.getByText('Không tạo được phiên thanh toán.')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  })
  expect(startCheckout).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Phiên thanh toán đã hết hạn.')).toBeInTheDocument()
})

it('shows that confirmation is pending when the result page opens before IPN', () => {
  renderPayment('/bookings/booking-1/payment-result')
  expect(screen.getByRole('heading', { name: 'Đang xác nhận thanh toán…' })).toBeInTheDocument()
  expect(screen.getByText('Trạng thái sẽ tự cập nhật khi có kết quả.')).toBeInTheDocument()
})

it('retries confirmation after a temporary error and stops after payment succeeds', async () => {
  const refresh = vi.spyOn(api, 'refreshPayosPayment')
    .mockRejectedValueOnce(new Error('Gateway unavailable'))
    .mockResolvedValueOnce({ paymentStatus: 'PAYMENT_PENDING' } as Awaited<ReturnType<typeof api.refreshPayosPayment>>)
    .mockResolvedValue({ bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' } as Awaited<ReturnType<typeof api.refreshPayosPayment>>)

  vi.mocked(useBooking).mockImplementation(function useBookingStub() {
    const [paid, setPaid] = useState(false)
    return {
      data: {
        booking: {
          id: 'booking-1', status: paid ? 'CONFIRMED' : 'PENDING_PAYMENT',
          total: 2000, holdExpiresAt: new Date(start + 60000).toISOString(),
        },
        payment: { status: paid ? 'PAID' : 'PROCESSING', amount: 2000 },
      },
      dataUpdatedAt: start,
      refetch: async () => setPaid(true),
    } as unknown as ReturnType<typeof useBooking>
  })

  renderPayment('/bookings/booking-1/payment-result')
  await act(async () => {})
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('heading', { name: 'Đang xác nhận thanh toán…' })).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(screen.getByRole('heading', { name: 'Thanh toán thành công' })).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(refresh).toHaveBeenCalledTimes(3)
})

it('rechecks a failed payment and updates the booking details when payOS confirms cancellation', async () => {
  const refresh = vi.spyOn(api, 'refreshPayosPayment').mockResolvedValue({ bookingStatus: 'CANCELLED' } as Awaited<ReturnType<typeof api.refreshPayosPayment>>)
  vi.mocked(useBooking).mockImplementation(function useBookingStub() {
    const [cancelled, setCancelled] = useState(false)
    return {
      data: {
        booking: {
          id: 'booking-1', hotelId: 'hotel-1', roomId: 'room-1', rooms: 1, adults: 2, children: 0,
          status: cancelled ? 'CANCELLED' : 'PENDING_PAYMENT', total: 500_000, nightlyPrices: [500_000],
          checkIn: '2026-12-01', checkOut: '2026-12-02', holdExpiresAt: new Date(start + 3_000).toISOString(),
        },
        payment: { status: 'FAILED' },
      },
      dataUpdatedAt: start,
      refetch: async () => setCancelled(true),
    } as unknown as ReturnType<typeof useBooking>
  })

  renderPayment('/bookings/booking-1')
  expect(screen.getByText(/Giữ phòng đến/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hủy đơn' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Tiếp tục thanh toán' })).not.toBeInTheDocument()

  await act(async () => {})
  expect(refresh).toHaveBeenCalledExactlyOnceWith('booking-1')
  expect(screen.getByText('Đã hủy')).toBeInTheDocument()
  expect(screen.queryByText(/Giữ phòng đến/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Đặt lại' })).toHaveAttribute('href', '/hotels/hotel-1')
})
