import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/services/api/client'
import type { PartnerHotel } from '@/types/domain'
import { PartnerHotelsPage } from './hotels'

function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output data-testid="location">{location.search}</output><button onClick={() => navigate(-1)}>Back</button></>
}
function show(path = '/partner/hotels?page=2&limit=15') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><PartnerHotelsPage /><Location /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  vi.spyOn(api, 'myHotels').mockImplementation(async query => ({
    data: [{ id: 'owned', name: `Kết quả ${query.search ?? 'tất cả'}`, taxCode: '123', status: 'ACTIVE', address: 'Đà Nẵng' } as PartnerHotel],
    meta: { page: query.page, limit: query.limit, total: 45 },
  }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('does not change results or request data until the search button is clicked', async () => {
  const user = userEvent.setup()
  show()
  await screen.findByText('Kết quả tất cả')
  const calls = vi.mocked(api.myHotels).mock.calls.length
  await user.type(screen.getByLabelText('Tên hoặc địa chỉ'), '  Azure  ')
  await user.selectOptions(screen.getByRole('combobox', { name: /Trạng thái/ }), 'ACTIVE')
  await user.selectOptions(screen.getByRole('combobox', { name: /Sắp xếp/ }), 'name')
  await user.click(screen.getByRole('button', { name: 'Đổi chiều sắp xếp' }))
  expect(api.myHotels).toHaveBeenCalledTimes(calls)
  expect(screen.getByTestId('location')).toHaveTextContent('?page=2&limit=15')
  expect(screen.getByText('Kết quả tất cả')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
  await screen.findByText('Kết quả Azure')
  expect(api.myHotels).toHaveBeenLastCalledWith({ page: 1, limit: 15, search: 'Azure', status: 'ACTIVE', sortBy: 'name', sortOrder: 'ASC' })
  expect(screen.getByLabelText('Tên hoặc địa chỉ')).toHaveValue('Azure')
})

it('Enter submits the pending search and empty fields remove the applied filters', async () => {
  const user = userEvent.setup()
  show('/partner/hotels?q=Azure&status=ACTIVE&limit=20&page=2')
  await screen.findByText('Kết quả Azure')
  const calls = vi.mocked(api.myHotels).mock.calls.length
  await user.clear(screen.getByLabelText('Tên hoặc địa chỉ'))
  await user.selectOptions(screen.getByRole('combobox', { name: /Trạng thái/ }), '')
  expect(api.myHotels).toHaveBeenCalledTimes(calls)
  await user.type(screen.getByLabelText('Tên hoặc địa chỉ'), '{Enter}')
  await screen.findByText('Kết quả tất cả')
  expect(api.myHotels).toHaveBeenLastCalledWith({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' })
})

it('changing page size uses the applied filters and retains the unsubmitted draft', async () => {
  const user = userEvent.setup()
  show('/partner/hotels?q=Applied&limit=15&page=2')
  await screen.findByText('Kết quả Applied')
  await user.clear(screen.getByLabelText('Tên hoặc địa chỉ'))
  await user.type(screen.getByLabelText('Tên hoặc địa chỉ'), 'Pending')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), '20')
  await waitFor(() => expect(api.myHotels).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 20, search: 'Applied' })))
  expect(await screen.findByLabelText('Tên hoặc địa chỉ')).toHaveValue('Pending')
  expect(screen.getByText('Kết quả Applied')).toBeVisible()
})

it('restores applied inputs and results when navigating back', async () => {
  const user = userEvent.setup()
  show('/partner/hotels?q=Azure&limit=10')
  await screen.findByText('Kết quả Azure')
  await user.clear(screen.getByLabelText('Tên hoặc địa chỉ'))
  await user.type(screen.getByLabelText('Tên hoặc địa chỉ'), 'Silver')
  await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
  await screen.findByText('Kết quả Silver')
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByText('Kết quả Azure')
  expect(screen.getByLabelText('Tên hoặc địa chỉ')).toHaveValue('Azure')
})
