import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/stores/session'
import type { User } from '@/types/domain'

const { loginRequest, verifyTwoFactor } = vi.hoisted(() => ({
  loginRequest: vi.fn(),
  verifyTwoFactor: vi.fn(),
}))

vi.mock('@/services', () => ({
  isMock: false,
  repo: {
    login: loginRequest,
    verifyTwoFactor,
  },
}))

import { LoginPage, TwoFactorLoginPage } from './pages'

const traveler: User = {
  id: 'traveler-1',
  name: 'Traveler',
  email: 'traveler@example.com',
  role: 'tourist',
  verified: true,
  isTwoFactorEnabled: true,
}

function Location() {
  const location = useLocation()
  return <output aria-label="location">{location.pathname + location.search}</output>
}

describe('two-factor sign-in', () => {
  afterEach(cleanup)

  beforeEach(() => {
    loginRequest.mockReset()
    verifyTwoFactor.mockReset()
    useSession.setState({ user: null, authReady: true })
  })

  it('routes a password login challenge to the 2FA form without creating a session', async () => {
    loginRequest.mockResolvedValue({ requiresTwoFactor: true })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/dang-nhap?returnTo=%2Ftrips']}>
        <Location />
        <Routes><Route path="/dang-nhap" element={<LoginPage expectedRole="tourist" />} /></Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('textbox', { name: /Tên đăng nhập/ }), 'traveler@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Password123')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(screen.getByLabelText('location')).toHaveTextContent('/auth/two-factor?returnTo=%2Ftrips')
    expect(useSession.getState().user).toBeNull()
  })

  it('accepts an authenticator or recovery code and restores the requested destination', async () => {
    verifyTwoFactor.mockResolvedValue({ user: traveler, returnTo: '/trips' })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/auth/two-factor?returnTo=%2Ftrips']}>
        <Location />
        <Routes><Route path="/auth/two-factor" element={<TwoFactorLoginPage />} /></Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('textbox', { name: /Mã xác thực/ }), '123456')
    await user.click(screen.getByRole('button', { name: 'Xác minh' }))

    expect(verifyTwoFactor).toHaveBeenCalledWith('123456')
    expect(useSession.getState().user).toEqual(traveler)
    expect(screen.getByLabelText('location')).toHaveTextContent('/trips')
  })
})
