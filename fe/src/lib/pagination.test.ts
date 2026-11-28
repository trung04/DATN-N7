import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages, lastPage, pageItems, readPage, readPageSize } from './pagination'
import { loginDestination } from './auth-navigation'

describe('management pagination', () => {
  it.each(['0', '-1', '1.2', 'NaN', 'Infinity', '1000001', ''])('normalizes invalid page %s', value => {
    expect(readPage(new URLSearchParams({ page: value }))).toBe(1)
  })
  it('keeps valid pages and clamps sliced data after deletion', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3)
    expect(lastPage(0)).toBe(1)
    expect(pageItems(Array.from({ length: 41 }, (_, i) => i), 3, 20)).toEqual([40])
    expect(pageItems(Array.from({ length: 40 }, (_, i) => i), 3, 20)).toEqual(Array.from({ length: 20 }, (_, i) => i + 20))
  })
  it.each(['', '0', '-1', '12', '100', '15.5', 'NaN'])('uses 6 for missing or invalid size %s', value => {
    expect(readPageSize(new URLSearchParams({ limit: value }))).toBe(6)
  })
  it.each([6, 10, 15, 20])('uses the selected size %s for slices and page counts', size => {
    expect(readPageSize(new URLSearchParams({ limit: String(size) }))).toBe(size)
    expect(pageItems(Array.from({ length: 50 }, (_, i) => i), 2, size)).toEqual(Array.from({ length: size }, (_, i) => i + size))
    expect(lastPage(50, size)).toBe(Math.ceil(50 / size))
  })
  it('loads options beyond 100 without overlaps or omissions', async () => {
    const rows = Array.from({ length: 251 }, (_, i) => i)
    const fetchPage = vi.fn(async (page: number) => ({ data: rows.slice((page - 1) * 100, page * 100), meta: { page, limit: 100, total: rows.length } }))
    expect(await fetchAllPages(fetchPage)).toEqual(rows)
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3])
  })
  it('propagates later page failures instead of returning incomplete options', async () => {
    await expect(fetchAllPages(async page => {
      if (page > 1) throw new Error('Unavailable')
      return { data: [1], meta: { page, limit: 1, total: 2 } }
    })).rejects.toThrow('Unavailable')
  })
})

describe('login destination', () => {
  it.each([null, '/partner/reports', '/partner/rooms?page=3', '/'])('always opens partner dashboard for %s', target => {
    expect(loginDestination('partner', target)).toBe('/partner')
  })
  it('preserves valid tourist and admin return locations', () => {
    expect(loginDestination('tourist', '/bookings?tab=current')).toBe('/bookings?tab=current')
    expect(loginDestination('admin', '/admin/reports')).toBe('/admin/reports')
  })
  it.each(['https://example.org', '//example.org', '/\\example.org'])('rejects unsafe return location %s', target => {
    expect(loginDestination('admin', target)).toBe('/admin')
  })
})
