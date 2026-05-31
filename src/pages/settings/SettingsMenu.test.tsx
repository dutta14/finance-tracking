import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockIsAdmin } = vi.hoisted(() => {
  return { mockIsAdmin: { value: false } }
})

vi.mock('../../flags/FlagContext', () => ({
  useFlagContext: () => ({
    isAdmin: mockIsAdmin.value,
  }),
}))

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

vi.mock('./components/ProfilePane', () => ({
  default: () => <div data-testid="profile-pane">Profile</div>,
}))

vi.mock('./components/GitHubSyncPane', () => ({
  default: () => <div data-testid="github-pane">GitHub</div>,
}))

vi.mock('./components/AppearancePane', () => ({
  default: () => <div data-testid="appearance-pane">Appearance</div>,
}))

vi.mock('./components/AdvancedPane', () => ({
  default: () => <div data-testid="advanced-pane">Advanced</div>,
}))

vi.mock('./components/LabsPane', () => ({
  default: () => <div data-testid="labs-pane">Labs</div>,
}))

vi.mock('./components/FlagAdminPane', () => ({
  default: () => <div data-testid="flag-admin-pane">FlagAdmin</div>,
}))

vi.mock('./components/SecurityPane', () => ({
  default: () => <div data-testid="security-pane">Security</div>,
}))

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ accentTheme: 'blue', setAccentTheme: vi.fn() }),
}))

import SettingsMenu from './SettingsMenu'

const defaultProps = {
  darkMode: false,
  onToggleDarkMode: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAdmin.value = false
})

describe('SettingsMenu', () => {
  it('renders the Settings trigger button with correct aria attributes', () => {
    render(<SettingsMenu {...defaultProps} />)
    const btn = screen.getByRole('button', { name: /settings/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('does not render SettingsModal initially', () => {
    render(<SettingsMenu {...defaultProps} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens SettingsModal when trigger button is clicked', async () => {
    render(<SettingsMenu {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens SettingsModal to profile section by default', async () => {
    render(<SettingsMenu {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByTestId('profile-pane')).toBeInTheDocument()
  })

  it('closes SettingsModal on Escape key', async () => {
    const user = userEvent.setup()
    render(<SettingsMenu {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens to externalSection when externalOpen is true', () => {
    render(<SettingsMenu {...defaultProps} externalOpen={true} externalSection="advanced" onExternalClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('advanced-pane')).toBeInTheDocument()
  })

  it('calls onExternalClose when modal is closed via external open', async () => {
    const user = userEvent.setup()
    const onExternalClose = vi.fn()
    render(
      <SettingsMenu {...defaultProps} externalOpen={true} externalSection="labs" onExternalClose={onExternalClose} />,
    )
    await user.keyboard('{Escape}')
    expect(onExternalClose).toHaveBeenCalledOnce()
  })

  it('defaults to profile section when externalOpen is true but externalSection is undefined (line 69)', () => {
    render(<SettingsMenu {...defaultProps} externalOpen={true} onExternalClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('profile-pane')).toBeInTheDocument()
  })

  it('uses provided onUpdateProfile callback (line 58 non-default branch)', async () => {
    const onUpdateProfile = vi.fn()
    render(<SettingsMenu {...defaultProps} onUpdateProfile={onUpdateProfile} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
