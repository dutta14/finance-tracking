import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

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

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ accentTheme: 'blue', setAccentTheme: vi.fn() }),
}))

import SettingsModal from './SettingsModal'

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

describe('SettingsModal integration — real ProfilePane', () => {
  it('renders the real ProfilePane with user name from profile prop', () => {
    render(<SettingsModal {...defaultProps} />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Edit Profile')).toBeInTheDocument()
  })
})
