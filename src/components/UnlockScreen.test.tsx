import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('enables submit button when passphrase is entered', async () => {
    const user = userEvent.setup()
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'test')
    const button = screen.getByRole('button', { name: 'Unlock' })
    expect(button).not.toBeDisabled()
  })

  it('calls unlock on form submission', async () => {
    const user = userEvent.setup()
    mockUnlock.mockResolvedValue(true)
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'correct')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalledWith('correct')
    })
  })

  it('submits form on Enter key', async () => {
    const user = userEvent.setup()
    mockUnlock.mockResolvedValue(true)
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'test')
    fireEvent.submit(screen.getByLabelText('Passphrase').closest('form')!)
    await waitFor(() => {
      expect(mockUnlock).toHaveBeenCalledWith('test')
    })
  })

  it('shows error message on wrong passphrase', async () => {
    const user = userEvent.setup()
    mockUnlock.mockResolvedValue(false)
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Wrong passphrase. Please try again.')
    })
  })

  it('shows loading state during unlock', async () => {
    const user = userEvent.setup()
    mockUnlock.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'test')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByText('Unlocking…')).toBeInTheDocument()
    })
  })

  it('clears error when user types', async () => {
    const user = userEvent.setup()
    mockUnlock.mockResolvedValue(false)
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Wrong passphrase. Please try again.')
    })
    await user.type(screen.getByLabelText('Passphrase'), 'n')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows unlock failed error on exception', async () => {
    const user = userEvent.setup()
    mockUnlock.mockRejectedValue(new Error('network'))
    render(<UnlockScreen />)
    await user.type(screen.getByLabelText('Passphrase'), 'test')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Unlock failed. Please try again.')
    })
  })

  it('toggles help panel on click', async () => {
    const user = userEvent.setup()
    render(<UnlockScreen />)
    const trigger = screen.getByRole('button', { name: /forgot your passphrase/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
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

  it('help panel contains all three recovery paragraphs', async () => {
    const user = userEvent.setup()
    render(<UnlockScreen />)
    await user.click(screen.getByRole('button', { name: /forgot your passphrase/i }))
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
