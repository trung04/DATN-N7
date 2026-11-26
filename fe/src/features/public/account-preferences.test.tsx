import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/stores/session'
import type { User } from '@/types/domain'

const tourist: User = {
  id: 'tourist-1', name: 'Nguyễn An', email: 'an@example.com', role: 'tourist', verified: true,
}
const options = {
  categories: [
    { code: 'ATTRACTION', name: 'Điểm tham quan' },
    { code: 'RESTAURANT', name: 'Nhà hàng' },
  ],
  topics: [
    { code: 'BEACH', name: 'Biển' },
    { code: 'CULTURE', name: 'Văn hóa' },
  ],
}

const { savePreference } = vi.hoisted(() => ({ savePreference: vi.fn() }))

vi.mock('@/services', () => ({
  repo: { savePreference, clearPreference: vi.fn() },
}))

vi.mock('@/hooks/data', () => ({
  useMyPreference: () => ({
    data: {
      preference: {
        userId: 'tourist-1', categories: [], topics: [], budget: 6_000_000,
        style: 'CULTURE_AND_FOOD', transport: 'WALKING', destinations: [],
      },
    },
    isLoading: false,
    error: null,
  }),
  usePreferenceOptions: () => ({ data: options, isLoading: false, error: null }),
  useMyProfile: () => ({ data: tourist, isLoading: false, error: null }),
  useCatalog: () => ({ data: undefined }),
  useFavorites: () => ({ data: [], isLoading: false, error: null }),
}))

import { PreferencesPage } from './account'

describe('PreferencesPage category and topic tags', () => {
  afterEach(cleanup)

  beforeEach(() => {
    savePreference.mockReset()
    savePreference.mockResolvedValue(undefined)
    useSession.setState({ user: tourist, authReady: true })
  })

  it('opens the editor and submits selected catalog codes', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><PreferencesPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    expect(screen.getByRole('combobox', { name: 'Phong cách' })).toHaveValue('CULTURE_AND_FOOD')
    expect(screen.getByRole('combobox', { name: 'Phương tiện' })).toHaveValue('WALKING')
    await user.click(screen.getByRole('checkbox', { name: 'Điểm tham quan' }))
    await user.click(screen.getByRole('checkbox', { name: 'Biển' }))
    await user.click(screen.getByRole('button', { name: 'Lưu sở thích' }))

    expect(savePreference).toHaveBeenCalledWith('tourist-1', expect.objectContaining({
      categoryCodes: ['ATTRACTION'],
      topicCodes: ['BEACH'],
      style: 'CULTURE_AND_FOOD',
      transport: 'WALKING',
    }))
  })
})
