import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DateField } from './date-input'
import { dateTime, day } from '@/lib/utils'

afterEach(cleanup)

function Example({ withTime = false }: { withTime?: boolean }) {
  const [value, setValue] = useState(withTime ? '2026-11-01T14:30' : '2026-11-01')
  return <form>
    <DateField label="Ngày" withTime={withTime} value={value} onChange={setValue} min={withTime ? undefined : '2026-11-01'} />
    <output aria-label="Giá trị ISO">{value}</output>
  </form>
}

describe('Vietnamese date fields', () => {
  it('shows day first while keeping the value submitted by callers in ISO order', () => {
    const { container } = render(<Example />)
    const input = screen.getByRole('textbox', { name: 'Ngày' })
    expect(input).toHaveValue('01/11/2026')
    fireEvent.change(input, { target: { value: '28112026' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('28/11/2026')
    expect(screen.getByLabelText('Giá trị ISO')).toHaveTextContent('2026-11-28')
    fireEvent.change(container.querySelector('input[type=date]')!, { target: { value: '2026-12-05' } })
    expect(input).toHaveValue('05/12/2026')
  })

  it('blocks impossible dates, incomplete dates and dates outside the range', () => {
    render(<Example />)
    const input = screen.getByRole('textbox', { name: 'Ngày' })
    for (const value of ['31/02/2026', '28/11', '31/10/2026']) {
      fireEvent.change(input, { target: { value } })
      expect(input).toBeInvalid()
    }
    fireEvent.change(input, { target: { value: '05/11/2026' } })
    expect(input).toBeValid()
    expect(screen.getByLabelText('Giá trị ISO')).toHaveTextContent('2026-11-05')
  })

  it('preserves the local time when the date in a trip changes', () => {
    render(<Example withTime />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Ngày' }), { target: { value: '02/11/2026' } })
    expect(screen.getByLabelText('Giá trị ISO')).toHaveTextContent('2026-11-02T14:30')
    fireEvent.change(screen.getByLabelText('Ngày giờ'), { target: { value: '09:05' } })
    expect(screen.getByLabelText('Giá trị ISO')).toHaveTextContent('2026-11-02T09:05')
  })

  it('shows Vietnam dates for instants and keeps calendar dates and local trip times as entered', () => {
    expect(day('2026-11-01')).toBe('01/11/2026')
    expect(day('2026-11-27T19:05:00Z')).toBe('28/11/2026')
    expect(dateTime('2026-11-27T19:05:00Z')).toBe('28/11/2026 02:05')
    expect(dateTime('2026-11-28T09:05')).toBe('28/11/2026 09:05')
  })
})
