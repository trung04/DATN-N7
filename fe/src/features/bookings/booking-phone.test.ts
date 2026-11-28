import { describe, expect, it } from 'vitest'
import { normalizeVietnamesePhone } from './booking-phone'

describe('normalizeVietnamesePhone', () => {
  it.each([
    '0912345678',
    ' 0912 345 678 ',
    '0912-345-678',
    '0912.345.678',
    '+84912345678',
    '+84 912 345 678',
    '84912345678',
    '0084 912 345 678',
  ])('normalizes mobile input %s', value => {
    expect(normalizeVietnamesePhone(value)).toBe('0912345678')
  })

  it.each(['(024) 3822 8888', '+84 (24) 3822-8888'])('normalizes landline input %s', value => {
    expect(normalizeVietnamesePhone(value)).toBe('02438228888')
  })

  it.each(['', '09123', '09123456789', '091A345678', '+66 912 345 678', '+84 0912 345 678', '0900+123456'])('rejects invalid input %s', value => {
    expect(normalizeVietnamesePhone(value)).toBeNull()
  })
})
