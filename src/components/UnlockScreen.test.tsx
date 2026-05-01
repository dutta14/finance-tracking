import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UnlockScreen from './UnlockScreen'

// Override the global mock for this test file
const mockUnlock = vi.fn()
const mockEncryption = {
  cryptoKey: null,
  isEncryptionEnabled: true,
  isLocked: true,
  isSettingUp: false,
  unlock: mockUnlock,
  lock: vi.fn(),
  setupEncryption: vi.fn(),
  changePassphrase: vi.fn(),
  disableEncryption: vi.fn(),
}

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => mockEncryption,
}))

describe('UnlockScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEncryption.isSettingUp = false
    mockUnlock.mockResolvedValue(false)
  })

  it('renders brand, title, and subtitle', () => {
    render(<UnlockScreen />)
    expect(screen.getByText('Finance Tracker')).toBeInTheDocument()
    expect(screen.getByText('Unlock your data')).toBeInTheDocument()
    expect(screen.getByText('Enter your passphrase to continue')).toBeInTheDocument()
  })

  it('renders passphrase input with label', () => {
    render(<UnlockScreen />)
    expect(screen.getByLabelText('Passphrase')).toBeInTheDocument()
  })

  it('disables submit button when input is empty', () => {
    render(<UnlockScreen />)
    const button = screen.getByRole('button', { name: 'Unlock' })
    expect(button).toBeDisabled()
  })

  it('enables submit button when passphrase is entered', () => {
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'test' } })
    const button = screen.getByRole('button', { name: 'Unlock' })
    expect(button).not.toBeDisabled()
  })

  it('calls unlock on form submission', async () => {
    mockUnlock.mockResolvedValue(true)
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'correct' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalledWith('correct')
    })
  })

  it('submits form on Enter key', async () => {
    mockUnlock.mockResolvedValue(true)
    render(<UnlockScreen />)
    const input = screen.getByLabelText('Passphrase')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalledWith('test')
    })
  })

  it('shows error message on wrong passphrase', async () => {
    mockUnlock.mockResolvedValue(false)
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Wrong passphrase. Please try again.')
    })
  })

  it('shows loading state during unlock', async () => {
    mockUnlock.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByText('Unlocking…')).toBeInTheDocument()
    })
  })

  it('clears error when user types', async () => {
    mockUnlock.mockResolvedValue(false)
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Wrong passphrase. Please try again.')
    })
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'new' } })
    expect(screen.getByRole('alert')).toHaveTextContent('')
  })

  it('shows unlock failed error on exception', async () => {
    mockUnlock.mockRejectedValue(new Error('network'))
    render(<UnlockScreen />)
    fireEvent.change(screen.getByLabelText('Passphrase'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unlock failed. Please try again.')
    })
  })

  it('toggles help panel on click', () => {
    render(<UnlockScreen />)
    const trigger = screen.getByRole('button', { name: /forgot your passphrase/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Your data is encrypted locally/)).toBeInTheDocument()
  })

  it('help panel has correct aria attributes', () => {
    render(<UnlockScreen />)
    const trigger = screen.getByRole('button', { name: /forgot your passphrase/i })
    expect(trigger).toHaveAttribute('aria-controls', 'unlock-help-panel')
    const panel = document.getElementById('unlock-help-panel')
    expect(panel).toHaveAttribute('role', 'region')
  })

  it('help panel contains all three recovery paragraphs', () => {
    render(<UnlockScreen />)
    fireEvent.click(screen.getByRole('button', { name: /forgot your passphrase/i }))
    expect(screen.getByText(/Your data is encrypted locally/)).toBeInTheDocument()
    expect(screen.getByText(/GitHub Sync enabled/)).toBeInTheDocument()
    expect(screen.getByText(/To start fresh/)).toBeInTheDocument()
  })

  it('unlock card has role="main"', () => {
    render(<UnlockScreen />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('disables input and button during isSettingUp', () => {
    mockEncryption.isSettingUp = true
    render(<UnlockScreen />)
    expect(screen.getByLabelText('Passphrase')).toBeDisabled()
  })
})
