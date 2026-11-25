import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Destination } from '@/types/domain'

const destinations: Destination[] = Array.from({ length: 10 }, (_, index) => ({
  id: `place-${index + 1}`,
  name: `Địa điểm ${index + 1}`,
  city: 'Đà Nẵng',
  region: 'Hải Châu',
  category: 'Điểm tham quan',
  description: `Mô tả ${index + 1}`,
  tags: [],
  price: 0,
}))

const { useCatalog, usePublicPlace, usePublicPlaces, usePublicPlaceOptions } = vi.hoisted(() => ({
  useCatalog: vi.fn(),
  usePublicPlace: vi.fn(),
  usePublicPlaces: vi.fn(),
  usePublicPlaceOptions: vi.fn(),
}))

vi.mock('@/hooks/data', () => ({
  useCatalog,
  usePublicPlace,
  usePublicPlaces,
  usePublicPlaceOptions,
  useFavorites: () => ({ data: [], isLoading: false, error: null }),
  useMyItineraries: () => ({ data: { trips: [], stops: [], activities: [] }, isLoading: false, error: null }),
}))

import { DestinationDetailPage, ExplorePage } from './catalog'

describe('ExplorePage pagination', () => {
  beforeEach(() => {
    useCatalog.mockReset()
    usePublicPlace.mockReset()
    usePublicPlaces.mockReset()
    usePublicPlaceOptions.mockReset()
    useCatalog.mockReturnValue({
      data: { destinations: Array.from({ length: 25 }, (_, index) => ({ ...destinations[index % destinations.length]!, id: `legacy-${index}` })) },
      isLoading: false,
      error: null,
    })
    usePublicPlace.mockReturnValue({ data: destinations[0], isLoading: false, error: null })
    usePublicPlaces.mockReturnValue({
      data: { data: destinations, meta: { page: 1, limit: 10, total: 25 } },
      isLoading: false,
      error: null,
    })
    usePublicPlaceOptions.mockReturnValue({
      data: { cities: ['Đà Nẵng'], categories: [{ code: 'ATTRACTION', name: 'Điểm tham quan' }] },
      isLoading: false,
      error: null,
    })
  })

  it('loads and renders only the requested server page', () => {
    render(<MemoryRouter initialEntries={['/explore']}><ExplorePage /></MemoryRouter>)

    expect(usePublicPlaces).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: undefined,
      city: undefined,
      categoryCode: undefined,
      sortBy: 'name',
      sortOrder: 'ASC',
    })
    expect(screen.getAllByRole('link', { name: /Xem chi tiết/i })).toHaveLength(10)
    expect(screen.getByRole('navigation', { name: 'Phân trang' })).toBeInTheDocument()
  })

  it('requests the selected page instead of preloading every page', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/explore']}><ExplorePage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Trang 2' }))

    await waitFor(() => expect(usePublicPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })))
  })

  it('loads destination details directly instead of downloading the catalog', () => {
    render(<MemoryRouter initialEntries={['/explore/place-1']}><Routes><Route path="/explore/:id" element={<DestinationDetailPage />} /></Routes></MemoryRouter>)

    expect(usePublicPlace).toHaveBeenCalledWith('place-1')
    expect(useCatalog).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Địa điểm 1' })).toBeInTheDocument()
  })
})
