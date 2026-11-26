import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createPlaceCategory, placeCategories, placeTopics } = vi.hoisted(() => ({
  createPlaceCategory: vi.fn(),
  placeCategories: vi.fn(),
  placeTopics: vi.fn(),
}))

vi.mock('@/services/api/client', () => ({
  api: {
    placeCategories,
    placeTopics,
    createPlaceCategory,
    updatePlaceCategory: vi.fn(),
    deletePlaceCategory: vi.fn(),
    createPlaceTopic: vi.fn(),
    updatePlaceTopic: vi.fn(),
    deletePlaceTopic: vi.fn(),
  },
}))

import { AdminPlaceTaxonomiesPage } from './place-taxonomies'

describe('AdminPlaceTaxonomiesPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    placeCategories.mockResolvedValue([])
    placeTopics.mockResolvedValue([])
    createPlaceCategory.mockReset()
    createPlaceCategory.mockResolvedValue({ id: 'category-1', code: 'MUSEUM', name: 'Bảo tàng', description: null })
  })

  it('opens the create form and submits only after Save', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><AdminPlaceTaxonomiesPage /></QueryClientProvider>)

    await screen.findByRole('heading', { name: 'Phân loại địa điểm' })
    await user.click(screen.getByRole('button', { name: 'Thêm category' }))
    expect(createPlaceCategory).not.toHaveBeenCalled()

    await user.type(screen.getByRole('textbox', { name: 'Mã' }), 'museum')
    await user.type(screen.getByRole('textbox', { name: 'Tên' }), 'Bảo tàng')
    await user.click(screen.getByRole('button', { name: 'Lưu category' }))

    expect(createPlaceCategory).toHaveBeenCalledWith({
      code: 'museum', name: 'Bảo tàng', description: null,
    })
  })
})
