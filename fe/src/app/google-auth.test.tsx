import { StrictMode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/stores/session'
import type { User } from '@/types/domain'
import { AppRouter } from './router'
import { SessionBootstrap } from './session-bootstrap'

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }))
vi.mock('@/services', () => ({ isMock: false, repo: { currentUser } }))

const user: User = { id: 'traveler', name: 'Traveler', email: 'traveler@example.com', role: 'tourist', verified: true }

function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <output aria-label="Current location">{pathname + search}</output>
}

function renderAuth(path: string) {
  render(<StrictMode>
    <MemoryRouter initialEntries={[path]}>
      <CurrentLocation />
      <SessionBootstrap><AppRouter /></SessionBootstrap>
    </MemoryRouter>
  </StrictMode>)
}

describe('Google sign-in callback', () => {
  afterEach(cleanup)

  beforeEach(() => {
    currentUser.mockReset()
    useSession.setState({ user: null, authReady: false })
  })

  it('checks the session once and forwards the authenticated user to the requested page', async () => {
    currentUser.mockResolvedValue(user)
    renderAuth('/auth/google/complete?returnTo=%2Fauth%2Fregister%3Fsource%3Dgoogle')

    await waitFor(() => expect(screen.getByLabelText('Current location')).toHaveTextContent('/auth/register?source=google'))
    expect(currentUser).toHaveBeenCalledTimes(1)
    expect(useSession.getState().user).toEqual(user)
  })

  it('returns to sign-in with feedback when the session is rejected', async () => {
    useSession.setState({ user })
    currentUser.mockRejectedValue(new Error('Unauthorized'))
    renderAuth('/auth/google/complete?returnTo=%2Ftrips')

    expect(await screen.findByText(/Không thể khôi phục phiên đăng nhập Google/)).toHaveAttribute('role', 'status')
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/auth/login?error=google_session_failed&returnTo=%2Ftrips')
    expect(useSession.getState().user).toBeNull()
  })

  it('explains when the existing email requires a different sign-in method', async () => {
    currentUser.mockResolvedValue(null)
    renderAuth('/auth/login?error=account_link_required')

    expect(await screen.findByText(/Email này đã được đăng ký/)).toHaveAttribute('role', 'status')
  })
})
