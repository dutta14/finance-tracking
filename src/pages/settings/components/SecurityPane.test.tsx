import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SecurityPane from './SecurityPane'

const mockEncryption = {
  cryptoKey: null,
  isEncryptionEnabled: false,
  isLocked: false,
  isSettingUp: false,
  unlock: vi.fn(),
  lock: vi.fn(),
  setupEncryption: vi.fn(),
  changePassphrase: vi.fn(),
  disableEncryption: vi.fn(),
}

vi.mock('../../../contexts/EncryptionContext', () => ({
  useEncryption: () => mockEncryption,
}))

describe('SecurityPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEncryption.isEncryptionEnabled = false
    mockEncryption.isSettingUp = false
    mockEncryption.setupEncryption.mockResolvedValue(undefined)
    mockEncryption.changePassphrase.mockResolvedValue(true)
    mockEncryption.disableEncryption.mockResolvedValue(true)
  })

  // ── OFF state ──

  it('renders encryption disabled status when OFF', () => {
    render(<SecurityPane />)
    expect(screen.getByText('Encryption disabled')).toBeInTheDocument()
    expect(screen.getByText(/Encrypt your financial data/)).toBeInTheDocument()
  })

  it('shows Enable Encryption button when OFF', () => {
    render(<SecurityPane />)
    expect(screen.getByRole('button', { name: 'Enable Encryption' })).toBeInTheDocument()
  })

  // ── Setup form ──

  it('shows setup form when Enable Encryption is clicked', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()
    expect(screen.getByLabelText('New passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm passphrase')).toBeInTheDocument()
  })

  it('setup form shows mismatch error when passphrases differ', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'xyz' } })
    expect(screen.getByText("Passphrases don't match")).toBeInTheDocument()
  })

  it('setup form enable button is disabled until passphrases match', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    // Find submit within the form
    const submitBtn = screen.getAllByRole('button', { name: 'Enable Encryption' })
    const formSubmit = submitBtn.find(b => b.getAttribute('type') === 'submit')!
    expect(formSubmit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'abc' } })
    expect(formSubmit).not.toBeDisabled()
  })

  it('calls setupEncryption on valid setup form submission', async () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'pass123' } })
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'pass123' } })

    const submitBtn = screen.getAllByRole('button', { name: 'Enable Encryption' })
    const formSubmit = submitBtn.find(b => b.getAttribute('type') === 'submit')!
    fireEvent.click(formSubmit)

    await waitFor(() => {
      expect(mockEncryption.setupEncryption).toHaveBeenCalledWith('pass123')
    })
  })

  it('shows warning about recovery in setup form', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText(/your data cannot be recovered/)).toBeInTheDocument()
  })

  it('closes setup form on Cancel click', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Set up encryption')).not.toBeInTheDocument()
  })

  // ── ON state ──

  it('renders encryption enabled status when ON', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    expect(screen.getByText(/Encryption enabled/)).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText(/Your financial data is encrypted/)).toBeInTheDocument()
  })

  it('shows Change Passphrase and Disable Encryption buttons when ON', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    expect(screen.getByRole('button', { name: 'Change Passphrase' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable Encryption' })).toBeInTheDocument()
  })

  it('shows persistent warning when encryption is ON', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    expect(screen.getByText(/Keep your passphrase safe/)).toBeInTheDocument()
  })

  // ── Change passphrase form ──

  it('opens change passphrase form', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    expect(screen.getByText('Change passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Current passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('New passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new passphrase')).toBeInTheDocument()
  })

  it('change form shows mismatch error', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'new1' } })
    fireEvent.change(screen.getByLabelText('Confirm new passphrase'), { target: { value: 'new2' } })
    expect(screen.getByText("Passphrases don't match")).toBeInTheDocument()
  })

  it('calls changePassphrase on valid change form submission', async () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    fireEvent.change(screen.getByLabelText('Current passphrase'), { target: { value: 'old' } })
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'new' } })
    fireEvent.change(screen.getByLabelText('Confirm new passphrase'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      expect(mockEncryption.changePassphrase).toHaveBeenCalledWith('old', 'new')
    })
  })

  it('shows error when current passphrase is incorrect', async () => {
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.changePassphrase.mockResolvedValue(false)
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    fireEvent.change(screen.getByLabelText('Current passphrase'), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'new' } })
    fireEvent.change(screen.getByLabelText('Confirm new passphrase'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const errorAlert = alerts.find(a => a.textContent === 'Incorrect passphrase')
      expect(errorAlert).toBeTruthy()
    })
  })

  it('shows success flash after passphrase change', async () => {
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.changePassphrase.mockResolvedValue(true)
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    fireEvent.change(screen.getByLabelText('Current passphrase'), { target: { value: 'old' } })
    fireEvent.change(screen.getByLabelText('New passphrase'), { target: { value: 'new' } })
    fireEvent.change(screen.getByLabelText('Confirm new passphrase'), { target: { value: 'new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      expect(screen.getByText('Passphrase updated ✓')).toBeInTheDocument()
    })
  })

  it('closes change form on Cancel', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    expect(screen.getByText('Change passphrase')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Change passphrase')).not.toBeInTheDocument()
  })

  // ── Disable encryption ──

  it('opens disable confirmation panel', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    expect(screen.getByText('Disable encryption?')).toBeInTheDocument()
    expect(screen.getByText(/decrypted and stored in plain text/)).toBeInTheDocument()
    expect(screen.getByLabelText('Enter passphrase to confirm')).toBeInTheDocument()
  })

  it('calls disableEncryption on valid submission', async () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    fireEvent.change(screen.getByLabelText('Enter passphrase to confirm'), { target: { value: 'pass' } })

    // Find the danger submit button inside the disable form
    const dangerBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent === 'Disable Encryption' && b.getAttribute('type') === 'submit')!
    fireEvent.click(dangerBtn)

    await waitFor(() => {
      expect(mockEncryption.disableEncryption).toHaveBeenCalledWith('pass')
    })
  })

  it('shows error on incorrect passphrase during disable', async () => {
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.disableEncryption.mockResolvedValue(false)
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    fireEvent.change(screen.getByLabelText('Enter passphrase to confirm'), { target: { value: 'wrong' } })

    const dangerBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent === 'Disable Encryption' && b.getAttribute('type') === 'submit')!
    fireEvent.click(dangerBtn)

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const errorAlert = alerts.find(a => a.textContent === 'Incorrect passphrase')
      expect(errorAlert).toBeTruthy()
    })
  })

  it('closes disable form on Cancel', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    expect(screen.getByText('Disable encryption?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Disable encryption?')).not.toBeInTheDocument()
  })

  // ── Accessibility ──

  it('status label has role="status" and aria-live', () => {
    render(<SecurityPane />)
    const statusEl = screen.getByRole('status')
    expect(statusEl).toHaveAttribute('aria-live', 'polite')
  })

  it('disable form passphrase has aria-describedby linking to warning', () => {
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    const input = screen.getByLabelText('Enter passphrase to confirm')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('disable-warning-message')
  })

  // ── Escape key ──

  it('closes active form on Escape key', () => {
    render(<SecurityPane />)
    fireEvent.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Set up encryption')).not.toBeInTheDocument()
  })
})
