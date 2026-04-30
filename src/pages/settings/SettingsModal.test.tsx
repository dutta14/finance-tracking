import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import SettingsModal from './SettingsModal'

/* ── Setup ───────────────────────────────────────────────────────── */

const defaultProps = {
  darkMode: false,
  onToggleDarkMode: vi.fn(),
  profile: { name: 'Test User', email: 'test@example.com', currency: 'USD' },
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
    expect(screen.queryByRole('button', { name: /feature flags/i })).not.toBeInTheDocument()
  })

  it('shows Feature Flags tab when isAdmin is true', () => {
    mockIsAdmin.value = true
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /feature flags/i })).toBeInTheDocument()
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
