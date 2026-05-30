import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PassphraseInput from './PassphraseInput'

describe('PassphraseInput', () => {
  const defaultProps = {
    id: 'test-pass',
    label: 'Passphrase',
    value: '',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders label and input', () => {
    render(<PassphraseInput {...defaultProps} />)
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your passphrase')).toBeInTheDocument()
  })

  it('renders with password type by default', () => {
    render(<PassphraseInput {...defaultProps} />)
    const input = screen.getByLabelText('Passphrase')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('toggles visibility on button click', async () => {
    const user = userEvent.setup()
    render(<PassphraseInput {...defaultProps} value="secret" />)
    const toggle = screen.getByRole('button', { name: 'Show passphrase' })
    await user.click(toggle)
    expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide passphrase' })).toBeInTheDocument()
  })

  it('calls onChange with new value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PassphraseInput {...defaultProps} onChange={onChange} />)
    await user.type(screen.getByLabelText('Passphrase'), 'abc')
    expect(onChange).toHaveBeenCalledWith('a')
    expect(onChange).toHaveBeenCalledWith('b')
    expect(onChange).toHaveBeenCalledWith('c')
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('displays error message with role="alert"', () => {
    render(<PassphraseInput {...defaultProps} error="Wrong passphrase" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Wrong passphrase')
  })

  it('adds error class to input when error is present', () => {
    render(<PassphraseInput {...defaultProps} error="Error" />)
    const input = screen.getByLabelText('Passphrase')
    expect(input.className).toContain('unlock-input--error')
  })

  it('sets aria-invalid when error is present', () => {
    render(<PassphraseInput {...defaultProps} error="Error" />)
    const input = screen.getByLabelText('Passphrase')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('disables input and toggle when disabled prop is true', () => {
    render(<PassphraseInput {...defaultProps} disabled />)
    expect(screen.getByLabelText('Passphrase')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Show passphrase' })).toBeDisabled()
  })

  it('uses custom placeholder', () => {
    render(<PassphraseInput {...defaultProps} placeholder="Custom placeholder" />)
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })

  it('applies shake class when shake prop is true', () => {
    const { container } = render(<PassphraseInput {...defaultProps} shake />)
    const wrapper = container.querySelector('.unlock-input-wrapper')
    expect(wrapper?.className).toContain('unlock-input-wrapper--shake')
  })

  it('removes shake class when onShakeEnd would be called', () => {
    // onAnimationEnd doesn't fire in jsdom — verify the shake class applies correctly
    const { container, rerender } = render(<PassphraseInput {...defaultProps} shake />)
    const wrapper = container.querySelector('.unlock-input-wrapper')!
    expect(wrapper.className).toContain('unlock-input-wrapper--shake')

    // After parent removes shake prop (equivalent to onShakeEnd callback)
    rerender(<PassphraseInput {...defaultProps} shake={false} />)
    expect(wrapper.className).not.toContain('unlock-input-wrapper--shake')
  })

  it('reserves space for error message even when no error', () => {
    const { container } = render(<PassphraseInput {...defaultProps} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const errorEl = container.querySelector('.unlock-error')
    expect(errorEl).toBeInTheDocument()
    expect(errorEl).toHaveTextContent('')
    expect(errorEl).not.toHaveAttribute('role')
    expect(errorEl).not.toHaveAttribute('aria-live')
  })

  it('exposes role="alert" only when error becomes non-empty', () => {
    const { rerender } = render(<PassphraseInput {...defaultProps} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    rerender(<PassphraseInput {...defaultProps} error="Wrong passphrase" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong passphrase')
  })

  it('links aria-describedby to error and external description', () => {
    render(<PassphraseInput {...defaultProps} error="Bad" ariaDescribedBy="extra-desc" />)
    const input = screen.getByLabelText('Passphrase')
    expect(input.getAttribute('aria-describedby')).toContain('test-pass-error')
    expect(input.getAttribute('aria-describedby')).toContain('extra-desc')
  })
})
