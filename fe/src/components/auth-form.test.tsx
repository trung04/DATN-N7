import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FormField, PasswordInput } from './common'

describe('PasswordInput and FormField', () => {
  it('toggles password visibility between text and password on button click', async () => {
    const user = userEvent.setup()
    render(<PasswordInput placeholder="Nhập mật khẩu" data-testid="pwd-input" />)

    const input = screen.getByTestId('pwd-input') as HTMLInputElement
    expect(input.type).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: 'Hiện mật khẩu' })
    await user.click(toggleBtn)

    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }))
    expect(input.type).toBe('password')
  })

  it('renders FormField with label, hint, and alert error', () => {
    const { rerender } = render(
      <FormField label="Email" hint="Nhập email của bạn">
        <input type="email" />
      </FormField>
    )
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Nhập email của bạn')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    rerender(
      <FormField label="Email" error="Email không hợp lệ">
        <input type="email" />
      </FormField>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ')
    // When error is present, hint is not shown
    expect(screen.queryByText('Nhập email của bạn')).not.toBeInTheDocument()
  })
})
