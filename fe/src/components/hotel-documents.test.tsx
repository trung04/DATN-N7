import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HotelDocuments } from './hotel-documents'
import { api } from '@/services/api/client'
import type { PartnerHotel, PartnerHotelDocument } from '@/types/domain'

const document: PartnerHotelDocument = { id: 'doc', documentType: 'BUSINESS_LICENSE', documentNumber: 'LIC-1', fileUrl: '/api/v1/doc/1', files: [{ id: 'image', url: '/api/v1/doc/1', contentType: 'image/webp', byteSize: 10, width: 16, height: 16 }], issuedAt: '2026-01-01', expiresAt: null, createdAt: '', updatedAt: '' }
const hotel = { id: 'hotel', status: 'DRAFT', documents: [] } as unknown as PartnerHotel
const files = () => [1, 2, 3].map(index => new File(['png'], `page-${index}.png`, { type: 'image/png' }))
const show = (value = hotel) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HotelDocuments hotel={value} /></QueryClientProvider>)
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('uploads three images together and clears the picker only after success', async () => {
  const user = userEvent.setup()
  const upload = vi.spyOn(api, 'uploadHotelDocument').mockResolvedValue(document)
  show()
  expect(screen.queryByLabelText('URL giấy tờ')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Số giấy tờ'), 'LIC-1')
  const selected = files()
  const picker = screen.getByLabelText('Ảnh giấy tờ') as HTMLInputElement
  await user.upload(picker, selected)
  expect(screen.getAllByRole('img')).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Tải ảnh và thêm giấy tờ' }))
  await screen.findByText('Đã tải ảnh và thêm giấy tờ.')
  expect(upload).toHaveBeenCalledWith('hotel', { documentType: 'BUSINESS_LICENSE', documentNumber: 'LIC-1', issuedAt: null, expiresAt: null }, selected, undefined)
  expect(picker.files).toHaveLength(0)
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
})

it('rejects more than three files and oversized images before calling the backend', async () => {
  const user = userEvent.setup()
  const upload = vi.spyOn(api, 'uploadHotelDocument')
  show()
  await user.upload(screen.getByLabelText('Ảnh giấy tờ'), [...files(), new File(['png'], 'fourth.png', { type: 'image/png' })])
  expect(screen.getByRole('status')).toHaveTextContent('tối đa 3 ảnh')
  expect(screen.queryAllByRole('img')).toHaveLength(0)
  await user.upload(screen.getByLabelText('Ảnh giấy tờ'), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
  expect(screen.getByRole('status')).toHaveTextContent('5 MiB')
  expect(upload).not.toHaveBeenCalled()
})

it('keeps the selected batch and metadata after upload failure for retry', async () => {
  const user = userEvent.setup()
  vi.spyOn(api, 'uploadHotelDocument').mockRejectedValue(new Error('Storage unavailable'))
  show()
  await user.type(screen.getByLabelText('Số giấy tờ'), 'LIC-RETRY')
  await user.upload(screen.getByLabelText('Ảnh giấy tờ'), files())
  await user.click(screen.getByRole('button', { name: 'Tải ảnh và thêm giấy tờ' }))
  await screen.findByText('Kho lưu trữ tạm thời không khả dụng.')
  expect(screen.getAllByRole('img')).toHaveLength(3)
  expect(screen.getByLabelText('Số giấy tờ')).toHaveValue('LIC-RETRY')
})

it('edits metadata without replacing images and can replace up to three images', async () => {
  const user = userEvent.setup()
  const upload = vi.spyOn(api, 'uploadHotelDocument').mockResolvedValue(document)
  show({ ...hotel, documents: [document] })
  await user.click(screen.getByRole('button', { name: 'Sửa giấy tờ LIC-1' }))
  await user.clear(screen.getByLabelText('Số giấy tờ'))
  await user.type(screen.getByLabelText('Số giấy tờ'), 'LIC-EDIT')
  await user.click(screen.getByRole('button', { name: 'Lưu giấy tờ' }))
  await screen.findByText('Đã cập nhật giấy tờ.')
  expect(upload).toHaveBeenLastCalledWith('hotel', expect.objectContaining({ documentNumber: 'LIC-EDIT' }), [], 'doc')
  await user.click(screen.getByRole('button', { name: 'Sửa giấy tờ LIC-1' }))
  const selected = files()
  await user.upload(screen.getByLabelText('Ảnh giấy tờ'), selected)
  await user.click(screen.getByRole('button', { name: 'Lưu giấy tờ' }))
  await waitFor(() => expect(upload).toHaveBeenLastCalledWith('hotel', expect.objectContaining({ documentNumber: 'LIC-1' }), selected, 'doc'))
})

it('requires confirmation before deletion and locks all editing during approval', async () => {
  const user = userEvent.setup()
  const remove = vi.spyOn(api, 'deleteHotelDocument').mockResolvedValue(undefined)
  const view = show({ ...hotel, documents: [document] })
  await user.click(screen.getByRole('button', { name: 'Xóa giấy tờ LIC-1' }))
  expect(remove).not.toHaveBeenCalled()
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận xóa' }))
  await screen.findByText('Đã xóa giấy tờ.')
  expect(remove).toHaveBeenCalledWith('hotel', 'doc')
  view.unmount()
  show({ ...hotel, status: 'PENDING_APPROVAL', documents: [document] })
  expect(screen.queryByLabelText('Ảnh giấy tờ')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Sửa giấy tờ/ })).not.toBeInTheDocument()
  expect(screen.getByRole('img')).toBeVisible()
})
