import { beforeEach, describe, expect, it } from 'vitest'
import { mock } from './logic'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

describe('mock admin user management', () => {
  it('searches and paginates users, then creates, updates, resets and deletes a user', async () => {
    const query = { page: 1, limit: 20, sortBy: 'createdAt' as const, sortOrder: 'DESC' as const }
    const initial = await mock.adminUsers(query)
    expect(initial.data.length).toBeGreaterThan(0)
    expect(initial.meta.total).toBe(initial.data.length)

    const created = await mock.createAdminUser({
      username: 'new-tourist', email: 'new-tourist@example.vn', password: 'Tourist123',
      firstName: 'Minh', lastName: 'Nguyen', displayName: 'Minh Nguyen', phoneNumber: null,
      dateOfBirth: null, gender: null, status: 'ACTIVE',
    })
    expect(created.role).toBe('TOURIST')
    expect((await mock.adminUsers({ ...query, search: 'new-tourist' })).data[0]?.id).toBe(created.id)
    await expect(mock.createAdminUser({
      username: 'new-tourist', email: 'other@example.vn', password: 'Tourist123', firstName: null,
      lastName: null, displayName: null, phoneNumber: null, dateOfBirth: null, gender: null, status: 'ACTIVE',
    })).rejects.toThrow('đã được sử dụng')

    const updated = await mock.updateAdminUser(created.id, { role: 'HOTEL_OWNER', status: 'SUSPENDED', displayName: 'Minh Updated' })
    expect(updated).toMatchObject({ role: 'HOTEL_OWNER', status: 'SUSPENDED', displayName: 'Minh Updated' })
    expect((await mock.adminUsers({ ...query, role: 'HOTEL_OWNER', status: 'SUSPENDED' })).data.map(user => user.id)).toContain(created.id)
    await mock.resetAdminUserPassword(created.id, 'Changed123')
    await mock.deleteAdminUser(created.id)
    await expect(mock.adminUser(created.id)).rejects.toThrow('Không tìm thấy')
  })
})
