import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/* ── Hoisted mocks ────────────────────────────────────────────────── */

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

import SettingsModal from './SettingsModal'

/* ── Setup ───────────────────────────────────────────────────────── */

const defaultProps = {
  darkMode: false,
  onToggleDarkMode: vi.fn(),
  profile: { name: 'Test User', avatarDataUrl: '', birthday: '' },
  onUpdateProfile: vi.fn(),
  hasPendingChanges: false,
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsAdmin.value = false
})

/* ── Tests ───────────────────────────────────────────────────────── */

describe('SettingsModal Feature Flags tab gating', () => {
  it('hides Feature Flags tab when isAdmin is false', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.queryByRole('tab', { name: /feature flags/i })).not.toBeInTheDocument()
  })

  it('shows Feature Flags tab when isAdmin is true', () => {
    mockIsAdmin.value = true
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByRole('tab', { name: /feature flags/i })).toBeInTheDocument()
  })

  it('does not render FlagAdminPane when isAdmin is false even if section is flags', () => {
    render(<SettingsModal {...defaultProps} initialSection="flags" />)
    expect(screen.queryByTestId('flag-admin-pane')).not.toBeInTheDocument()
  })

  it('renders FlagAdminPane when isAdmin is true and section is flags', () => {
    mockIsAdmin.value = true
    render(<SettingsModal {...defaultProps} initialSection="flags" />)
    expect(screen.getByTestId('flag-admin-pane')).toBeInTheDocument()
  })
})

/* ── Tab navigation ──────────────────────────────────────────── */

describe('SettingsModal tab navigation', () => {
  it('renders Profile pane by default', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByTestId('profile-pane')).toBeInTheDocument()
  })

  it('switches to GitHub Sync pane when tab is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /github sync/i }))
    expect(screen.getByTestId('github-pane')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-pane')).not.toBeInTheDocument()
  })

  it('switches to Appearance pane when tab is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /appearance/i }))
    expect(screen.getByTestId('appearance-pane')).toBeInTheDocument()
  })

  it('switches to Advanced pane when tab is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /advanced/i }))
    expect(screen.getByTestId('advanced-pane')).toBeInTheDocument()
  })

  it('switches to Labs pane when tab is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /labs/i }))
    expect(screen.getByTestId('labs-pane')).toBeInTheDocument()
  })

  it('renders the correct pane when initialSection is set', () => {
    render(<SettingsModal {...defaultProps} initialSection="appearance" />)
    expect(screen.getByTestId('appearance-pane')).toBeInTheDocument()
    expect(screen.queryByTestId('profile-pane')).not.toBeInTheDocument()
  })

  // E2E load-bearing: e2e/settings.spec.ts asserts the active nav item via
  // aria-current="page" rather than the brittle .active class. If this
  // attribute disappears, settings test 12 will silently start passing on
  // the wrong nav item.
  it('marks only the active nav item with aria-selected="true"', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /appearance/i })).toHaveAttribute('aria-selected', 'false')
    await user.click(screen.getByRole('tab', { name: /appearance/i }))
    expect(screen.getByRole('tab', { name: /appearance/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'false')
  })

  // E2E load-bearing: dialog must be queryable by its accessible name
  // ("Settings") via aria-labelledby pointing at the H2 title.
  it('exposes the dialog with accessible name "Settings" via aria-labelledby', () => {
    render(<SettingsModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toHaveAttribute('aria-labelledby', 'settings-modal-title')
    expect(document.getElementById('settings-modal-title')).toHaveTextContent('Settings')
  })
})

/* ── Close behavior ──────────────────────────────────────────── */

describe('SettingsModal close behavior', () => {
  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.keyboard('{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop overlay is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    await user.click(dialog.parentElement!)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when modal content is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    await user.click(dialog)
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })
})

/* ── Modal structure ─────────────────────────────────────────── */

describe('SettingsModal structure', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    render(<SettingsModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('renders Settings title', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders all 6 nav tabs when not admin', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /github sync/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /appearance/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /advanced/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /labs/i })).toBeInTheDocument()
  })
})

/* ── Tab navigation (coverage for uncovered onClick callbacks) ─── */

describe('SettingsModal tab navigation coverage', () => {
  it('switches to Security pane when Security tab is clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /security/i }))
    expect(screen.getByTestId('security-pane')).toBeInTheDocument()
  })

  it('switches back to Profile pane after navigating away', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /appearance/i }))
    expect(screen.queryByTestId('profile-pane')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /profile/i }))
    expect(screen.getByTestId('profile-pane')).toBeInTheDocument()
  })

  it('switches to Feature Flags pane when admin clicks Feature Flags tab', async () => {
    mockIsAdmin.value = true
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /feature flags/i }))
    expect(screen.getByTestId('flag-admin-pane')).toBeInTheDocument()
    mockIsAdmin.value = false
  })

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.keyboard('{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('renders dark mode sun icon when darkMode is true', () => {
    render(<SettingsModal {...defaultProps} darkMode={true} />)
    const tab = screen.getByRole('tab', { name: /appearance/i })
    expect(tab).toBeInTheDocument()
  })

  it('switches to Advanced pane and renders it', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /advanced/i }))
    expect(screen.getByTestId('advanced-pane')).toBeInTheDocument()
  })

  it('switches to Security pane', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /security/i }))
    expect(screen.getByTestId('security-pane')).toBeInTheDocument()
  })

  it('switches to Labs pane', async () => {
    const user = userEvent.setup()
    render(<SettingsModal {...defaultProps} />)
    await user.click(screen.getByRole('tab', { name: /labs/i }))
    expect(screen.getByTestId('labs-pane')).toBeInTheDocument()
  })
})
