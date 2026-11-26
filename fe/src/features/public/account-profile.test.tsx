import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/stores/session'
import type { User } from '@/types/domain'

const profile: User = {
  id: 'tourist-1',
  name: 'Nguyễn An',
  email: 'an@example.com',
  role: 'tourist',
  verified: true,
  bio: 'Bio cũ',
  googleAccountLinked: false,
}

const { saveProfile, setupTwoFactor, confirmTwoFactor } = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  setupTwoFactor: vi.fn(),
  confirmTwoFactor: vi.fn(),
}))

vi.mock('@/services', () => ({
  repo: {
    saveProfile,
    setupTwoFactor,
    confirmTwoFactor,
    requestDeletion: vi.fn(),
    clearPreference: vi.fn(),
    savePreference: vi.fn(),
  },
}))

vi.mock('@/hooks/data', () => ({
  useMyProfile: () => ({ data: profile, isLoading: false, error: null }),
  useMyPreference: () => ({ data: { preference: null }, isLoading: false, error: null }),
  useCatalog: () => ({ data: undefined }),
  useFavorites: () => ({ data: [], isLoading: false, error: null }),
}))

import { ProfilePage } from './account'

describe('ProfilePage tourist bio', () => {
  afterEach(cleanup)

  beforeEach(() => {
    saveProfile.mockReset()
    saveProfile.mockResolvedValue({ ...profile, bio: 'Bio mới' })
    setupTwoFactor.mockResolvedValue({ secret: 'BASE32SECRET', otpauthUri: 'otpauth://totp/HanhTrinhViet' })
    confirmTwoFactor.mockResolvedValue({ recoveryCodes: ['ABCD-EFGH', 'IJKL-MNOP'] })
    useSession.setState({ user: profile, authReady: true })
  })

  it('edits and submits bio with the rest of the account profile', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><ProfilePage /></MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('link', { name: 'Liên kết Google' }))
      .toHaveAttribute('href', '/api/v1/auth/google/link/start?returnTo=%2Fprofile%3FgoogleLinked%3D1')

    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa' }))
    const bio = screen.getByRole('textbox', { name: /Giới thiệu bản thân/ })
    await user.clear(bio)
    await user.type(bio, 'Bio mới')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(saveProfile).toHaveBeenCalledWith('tourist-1', expect.objectContaining({ bio: 'Bio mới' }))
  })

  it('enables 2FA only after confirming an authenticator code and shows recovery codes', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><ProfilePage /></MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Bật xác thực 2 bước' }))
    expect(await screen.findByText('BASE32SECRET')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mã QR thiết lập xác thực 2 bước' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Mã xác thực/ }), '123456')
    await user.click(screen.getByRole('button', { name: 'Xác nhận bật 2FA' }))

    expect(confirmTwoFactor).toHaveBeenCalledWith('123456')
    expect(await screen.findByText('ABCD-EFGH')).toBeInTheDocument()
    expect(screen.getByText(/chỉ hiển thị một lần/i)).toBeInTheDocument()
  })
})
