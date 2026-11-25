import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
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

function renderAt(children: ReactNode, initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter></QueryClientProvider>)
}

describe('ExplorePage pagination', () => {
  afterEach(cleanup)

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
    renderAt(<ExplorePage />, '/explore')

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
    renderAt(<ExplorePage />, '/explore')

    await user.click(screen.getByRole('button', { name: 'Trang 2' }))

    await waitFor(() => expect(usePublicPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 10 })))
  })

  it('loads destination details directly instead of downloading the catalog', () => {
    renderAt(<Routes><Route path="/explore/:id" element={<DestinationDetailPage />} /></Routes>, '/explore/place-1')

    expect(usePublicPlace).toHaveBeenCalledWith('place-1')
    expect(useCatalog).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Địa điểm 1' })).toBeInTheDocument()
  })
})
