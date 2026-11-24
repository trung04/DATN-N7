import { describe, expect, it } from 'vitest'
import { mapBackendUser } from './client'

describe('mapBackendUser', () => {
  it('maps an admin response to the frontend session user', () => {
    expect(mapBackendUser({
      id: 'admin-id',
      username: 'admin',
      email: 'admin@example.test',
      firstName: 'System',
      lastName: 'Admin',
      displayName: null,
      phoneNumber: '0900000000',
      role: 'ADMIN',
      isEmailVerified: true,
    })).toEqual({
      id: 'admin-id',
      name: 'System Admin',
      email: 'admin@example.test',
      phone: '0900000000',
      role: 'admin',
      verified: true,
    })
  })

  it('falls back to the username when a user has no profile name', () => {
    expect(mapBackendUser({
      id: 'owner-id',
      username: 'hotel-owner',
      email: 'owner@example.test',
      firstName: null,
      lastName: null,
      displayName: null,
      phoneNumber: null,
      role: 'HOTEL_OWNER',
      isEmailVerified: false,
    })).toMatchObject({ name: 'hotel-owner', role: 'partner', verified: false })
  })
})
