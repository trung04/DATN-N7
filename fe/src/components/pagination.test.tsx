import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router'
import { Pagination } from './pagination'
import { usePagination } from '@/lib/use-pagination'

afterEach(cleanup)

function Pager({ total }: { total: number }) {
  const { page, size, setPage, setSize } = usePagination(total)
  const location = useLocation()
  return <><output>{location.search}</output><Pagination page={page} size={size} total={total} onPageChange={setPage} onSizeChange={setSize} /></>
}

it('navigates to the next and last pages while preserving filters', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/?hotelId=owned&page=2&limit=20']}><Pager total={105} /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Sau' }))
  expect(screen.getByRole('status')).toHaveTextContent('?hotelId=owned&page=3')
  await user.click(screen.getByRole('button', { name: 'Trang 6' }))
  expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled()
  expect(screen.getByRole('navigation')).toHaveTextContent('Hiển thị 101–105 / 105')
})

it('clamps an obsolete last page after deleting its last record', async () => {
  const view = render(<MemoryRouter initialEntries={['/?page=3&limit=20']}><Pager total={41} /></MemoryRouter>)
  view.rerender(<MemoryRouter initialEntries={['/?page=3&limit=20']}><Pager total={40} /></MemoryRouter>)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('?page=2'))
})

it('handles empty lists without enabling navigation', () => {
  render(<Pagination page={1} total={0} onPageChange={vi.fn()} onSizeChange={vi.fn()} />)
  expect(screen.getByRole('navigation')).toHaveTextContent('0 kết quả')
  expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled()
})

it('defaults to 6 and changing page size preserves filters and resets page 1', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/?hotelId=owned&page=3']}><Pager total={50} /></MemoryRouter>)
  expect(screen.getByRole('combobox')).toHaveValue('6')
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['6', '10', '15', '20'])
  await user.selectOptions(screen.getByRole('combobox'), '15')
  expect(screen.getByRole('status')).toHaveTextContent('?hotelId=owned&page=1&limit=15')
  expect(screen.getByRole('navigation')).toHaveTextContent('Hiển thị 1–15 / 50')
  await user.click(screen.getByRole('button', { name: 'Sau' }))
  expect(screen.getByRole('navigation')).toHaveTextContent('Hiển thị 16–30 / 50')
  await user.selectOptions(screen.getByRole('combobox'), '20')
  expect(screen.getByRole('navigation')).toHaveTextContent('Hiển thị 1–20 / 50')
})
