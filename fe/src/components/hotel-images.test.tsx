import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HotelImages } from './hotel-images'
import { api } from '@/services/api/client'
import type { PartnerHotel } from '@/types/domain'

const photo = { id: 'image-id', hotelId: 'hotel-id', url: '/api/v1/hotels/hotel-id/images/image-id/file', previewUrl: '/api/v1/hotels/mine/hotel-id/images/image-id/file', contentType: 'image/webp', byteSize: 1200, width: 800, height: 600, createdAt: '2026-11-11T00:00:00Z' }
const hotel = { id: 'hotel-id', name: 'Test Hotel', status: 'DRAFT', images: [photo] } as PartnerHotel
function show(value = hotel) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><HotelImages hotel={value} /></QueryClientProvider>)
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('hotel image management', () => {
  it('uploads a selected file and resets the file picker after success', async () => {
    const upload = vi.spyOn(api, 'uploadHotelImage').mockResolvedValue(photo)
    const user = userEvent.setup()
    show()
    const picker = screen.getByLabelText('Chọn ảnh khách sạn') as HTMLInputElement
    const file = new File(['png'], 'hotel.png', { type: 'image/png' })
    await user.upload(picker, file)
    await user.click(screen.getByRole('button', { name: 'Tải ảnh lên' }))
    await screen.findByText('Đã tải ảnh lên.')
    expect(upload).toHaveBeenCalledWith('hotel-id', file)
    expect(picker.files).toHaveLength(0)
  })
  it('rejects oversized files before sending and preserves a file after a failed upload', async () => {
    const upload = vi.spyOn(api, 'uploadHotelImage').mockRejectedValue(new Error('Storage unavailable'))
    const user = userEvent.setup()
    show()
    const picker = screen.getByLabelText('Chọn ảnh khách sạn') as HTMLInputElement
    await user.upload(picker, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Tải ảnh lên' }))
    expect(screen.getByText('Ảnh phải có dung lượng từ 1 byte đến 5 MiB.')).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
    await user.upload(picker, new File(['png'], 'hotel.png', { type: 'image/png' }))
    await user.click(screen.getByRole('button', { name: 'Tải ảnh lên' }))
    await screen.findByText('Storage unavailable')
    expect(picker.files).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Tải ảnh lên' })).toBeEnabled()
  })
  it('previews stored photos and confirms deletion before calling the backend', async () => {
    const remove = vi.spyOn(api, 'deleteHotelImage').mockResolvedValue(undefined)
    const user = userEvent.setup()
    show()
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(photo.previewUrl))
    await user.click(screen.getByRole('button', { name: 'Xóa ảnh 1' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa ảnh' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('hotel-id', 'image-id'))
    await screen.findByText('Đã xóa ảnh.')
  })
  it('locks mutation controls while the hotel awaits approval', () => {
    show({ ...hotel, status: 'PENDING_APPROVAL' })
    expect(screen.queryByLabelText('Chọn ảnh khách sạn')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa ảnh 1' })).toBeDisabled()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
