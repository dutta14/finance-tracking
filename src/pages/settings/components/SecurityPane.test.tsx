import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows setup form when Enable Encryption is clicked', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()
    expect(screen.getByLabelText('New passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm passphrase')).toBeInTheDocument()
  })

  it('setup form shows mismatch error when passphrases differ', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    await user.type(screen.getByLabelText('New passphrase'), 'abc')
    await user.type(screen.getByLabelText('Confirm passphrase'), 'xyz')
    expect(screen.getByText("Passphrases don't match")).toBeInTheDocument()
  })

  it('setup form enable button is disabled until passphrases match', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    // Find submit within the form
    const submitBtn = screen.getAllByRole('button', { name: 'Enable Encryption' })
    const formSubmit = submitBtn.find(b => b.getAttribute('type') === 'submit')!
    expect(formSubmit).toBeDisabled()

    await user.type(screen.getByLabelText('New passphrase'), 'abc')
    await user.type(screen.getByLabelText('Confirm passphrase'), 'abc')
    expect(formSubmit).not.toBeDisabled()
  })

  it('calls setupEncryption on valid setup form submission', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    await user.type(screen.getByLabelText('New passphrase'), 'pass123')
    await user.type(screen.getByLabelText('Confirm passphrase'), 'pass123')

    const submitBtn = screen.getAllByRole('button', { name: 'Enable Encryption' })
    const formSubmit = submitBtn.find(b => b.getAttribute('type') === 'submit')!
    await user.click(formSubmit)

    await waitFor(() => {
      expect(mockEncryption.setupEncryption).toHaveBeenCalledWith('pass123')
    })
  })

  it('shows warning about recovery in setup form', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText(/your data cannot be recovered/)).toBeInTheDocument()
  })

  it('closes setup form on Cancel click', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
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

  it('opens change passphrase form', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    expect(screen.getByText('Change passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Current passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('New passphrase')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new passphrase')).toBeInTheDocument()
  })

  it('change form shows mismatch error', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    await user.type(screen.getByLabelText('New passphrase'), 'new1')
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'new2')
    expect(screen.getByText("Passphrases don't match")).toBeInTheDocument()
  })

  it('calls changePassphrase on valid change form submission', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    await user.type(screen.getByLabelText('Current passphrase'), 'old')
    await user.type(screen.getByLabelText('New passphrase'), 'new')
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'new')
    await user.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      expect(mockEncryption.changePassphrase).toHaveBeenCalledWith('old', 'new')
    })
  })

  it('shows error when current passphrase is incorrect', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.changePassphrase.mockResolvedValue(false)
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    await user.type(screen.getByLabelText('Current passphrase'), 'wrong')
    await user.type(screen.getByLabelText('New passphrase'), 'new')
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'new')
    await user.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const errorAlert = alerts.find(a => a.textContent === 'Incorrect passphrase')
      expect(errorAlert).toBeTruthy()
    })
  })

  it('shows success flash after passphrase change', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.changePassphrase.mockResolvedValue(true)
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    await user.type(screen.getByLabelText('Current passphrase'), 'old')
    await user.type(screen.getByLabelText('New passphrase'), 'new')
    await user.type(screen.getByLabelText('Confirm new passphrase'), 'new')
    await user.click(screen.getByRole('button', { name: 'Update Passphrase' }))

    await waitFor(() => {
      expect(screen.getByText('Passphrase updated ✓')).toBeInTheDocument()
    })
  })

  it('closes change form on Cancel', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Change Passphrase' }))
    expect(screen.getByText('Change passphrase')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Change passphrase')).not.toBeInTheDocument()
  })

  // ── Disable encryption ──

  it('opens disable confirmation panel', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    expect(screen.getByText('Disable encryption?')).toBeInTheDocument()
    expect(screen.getByText(/decrypted and stored in plain text/)).toBeInTheDocument()
    expect(screen.getByLabelText('Enter passphrase to confirm')).toBeInTheDocument()
  })

  it('calls disableEncryption on valid submission', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    await user.type(screen.getByLabelText('Enter passphrase to confirm'), 'pass')

    // Find the danger submit button inside the disable form
    const dangerBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent === 'Disable Encryption' && b.getAttribute('type') === 'submit')!
    await user.click(dangerBtn)

    await waitFor(() => {
      expect(mockEncryption.disableEncryption).toHaveBeenCalledWith('pass')
    })
  })

  it('shows error on incorrect passphrase during disable', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    mockEncryption.disableEncryption.mockResolvedValue(false)
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    await user.type(screen.getByLabelText('Enter passphrase to confirm'), 'wrong')

    const dangerBtn = screen
      .getAllByRole('button')
      .find(b => b.textContent === 'Disable Encryption' && b.getAttribute('type') === 'submit')!
    await user.click(dangerBtn)

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      const errorAlert = alerts.find(a => a.textContent === 'Incorrect passphrase')
      expect(errorAlert).toBeTruthy()
    })
  })

  it('closes disable form on Cancel', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    expect(screen.getByText('Disable encryption?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Disable encryption?')).not.toBeInTheDocument()
  })

  // ── Accessibility ──

  it('status label has role="status" and aria-live', () => {
    render(<SecurityPane />)
    const statusEl = screen.getByRole('status')
    expect(statusEl).toHaveAttribute('aria-live', 'polite')
  })

  it('disable form passphrase has aria-describedby linking to warning', async () => {
    const user = userEvent.setup()
    mockEncryption.isEncryptionEnabled = true
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Disable Encryption' }))
    const input = screen.getByLabelText('Enter passphrase to confirm')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('disable-warning-message')
  })

  // ── Escape key ──

  it('closes active form on Escape key', async () => {
    const user = userEvent.setup()
    render(<SecurityPane />)
    await user.click(screen.getByRole('button', { name: 'Enable Encryption' }))
    expect(screen.getByText('Set up encryption')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Set up encryption')).not.toBeInTheDocument()
  })
})
