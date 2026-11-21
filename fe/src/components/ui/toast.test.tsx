import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast } from './toast'

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('announces errors and dismisses itself', () => {
    vi.useFakeTimers()
    const close = vi.fn()
    render(<Toast message="Không thể lưu" kind="error" duration={1000} onClose={close} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể lưu')
    act(() => vi.advanceTimersByTime(1000))
    expect(close).toHaveBeenCalledOnce()
  })
})
