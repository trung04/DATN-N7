import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomImages, PublicRoomGallery } from './room-images'
import { api } from '@/services/api/client'
import type { RoomImage } from '@/types/domain'

const photos: RoomImage[] = [1, 2].map(index => ({ id: `photo-${index}`, roomId: 'room', imageOrder: index, url: `/api/v1/rooms/room/images/photo-${index}/file`, previewUrl: `/api/v1/rooms/mine/room/images/photo-${index}/file`, contentType: 'image/webp', byteSize: 1200, width: 800, height: 600, sourceUrl: null, attributionText: null, illustrative: false, createdAt: '2026-11-19T00:00:00Z' }))
function show(content: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{content}</QueryClientProvider>)
}
beforeEach(() => { vi.spyOn(api, 'roomImages').mockResolvedValue(photos) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('room image management', () => {
  it('uploads a room image and resets the selected file', async () => {
    const upload = vi.spyOn(api, 'uploadRoomImage').mockResolvedValue(photos[0]!)
    const user = userEvent.setup(); show(<RoomImages roomId="room" locked={false} />)
    const picker = screen.getByLabelText('Chọn ảnh phòng') as HTMLInputElement
    const file = new File(['png'], 'room.png', { type: 'image/png' }); await user.upload(picker, file)
    await user.click(screen.getByRole('button', { name: 'Tải ảnh phòng lên' })); await screen.findByText('Đã tải ảnh phòng lên.')
    expect(upload).toHaveBeenCalledWith('room', file); expect(picker.files).toHaveLength(0)
  })
  it('selects a cover and requires confirmation before removing a photo', async () => {
    const primary = vi.spyOn(api, 'primaryRoomImage').mockResolvedValue(photos[1]!)
    const remove = vi.spyOn(api, 'deleteRoomImage').mockResolvedValue(undefined)
    const user = userEvent.setup(); show(<RoomImages roomId="room" locked={false} />)
    await user.click(await screen.findByRole('button', { name: 'Trang sau' }))
    await user.click(screen.getByRole('button', { name: 'Đặt làm ảnh đại diện' })); await screen.findByText('Đã chọn ảnh đại diện.')
    expect(primary).toHaveBeenCalledWith('room', 'photo-2')
    await user.click(screen.getByRole('button', { name: 'Trang trước' }))
    await user.click(screen.getByRole('button', { name: 'Xóa ảnh 1' })); expect(remove).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận xóa' })); await screen.findByText('Đã xóa ảnh phòng.')
    expect(remove).toHaveBeenCalledWith('room', 'photo-1')
  })
  it('blocks oversized files and preserves the picker after a failed upload', async () => {
    const upload = vi.spyOn(api, 'uploadRoomImage').mockRejectedValue(new Error('Storage unavailable'))
    const user = userEvent.setup(); show(<RoomImages roomId="room" locked={false} />)
    const picker = screen.getByLabelText('Chọn ảnh phòng') as HTMLInputElement
    await user.upload(picker, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })); await user.click(screen.getByRole('button', { name: 'Tải ảnh phòng lên' }))
    expect(upload).not.toHaveBeenCalled(); expect(screen.getByText('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB.')).toBeInTheDocument()
    await user.upload(picker, new File(['png'], 'room.png', { type: 'image/png' })); await user.click(screen.getByRole('button', { name: 'Tải ảnh phòng lên' })); await screen.findByText('Kho lưu trữ tạm thời không khả dụng.'); expect(picker.files).toHaveLength(1)
  })
  it('locks upload, deletion and cover controls during approval', async () => {
    show(<RoomImages roomId="room" locked />); expect(screen.queryByLabelText('Chọn ảnh phòng')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Xóa ảnh 1' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(screen.getByRole('button', { name: 'Đặt làm ảnh đại diện' })).toBeDisabled()
  })
  it('switches public room photos and shows a neutral placeholder on image errors', async () => {
    const user = userEvent.setup(); show(<PublicRoomGallery roomId="room" name="Deluxe" />)
    await screen.findByRole('button', { name: 'Xem ảnh phòng 2' }); await user.click(screen.getByRole('button', { name: 'Xem ảnh phòng 2' }))
    const image = screen.getByRole('img', { name: 'Deluxe' }); expect(image).toHaveAttribute('src', expect.stringContaining('photo-2/file'))
    fireEvent.error(image); await waitFor(() => expect(screen.getByRole('img', { name: 'Chưa có ảnh Deluxe' })).not.toHaveAttribute('src'))
  })
})
