import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/* ── Hoisted mocks (available to vi.mock factories) ──────────────── */

const { mockSetOverride, mockResetAllOverrides, mockSaveRolloutConfig, mockRefresh, mockContext } = vi.hoisted(() => {
  const mockSetOverride = vi.fn()
  const mockResetAllOverrides = vi.fn()
  const mockSaveRolloutConfig = vi.fn().mockResolvedValue(undefined)
  const mockRefresh = vi.fn()

  const flagDefaults: Record<string, unknown> = {
    darkMode: false,
    apiUrl: 'https://api.example.com',
    maxRetries: 3,
    featureConfig: {},
  }

  const mockContext = {
    current: {
      resolveFlag: (flag: { id: string; default: unknown }) => {
        const ov = mockContext.current.overrides[flag.id]
        if (ov !== undefined) return ov
        return flagDefaults[flag.id] ?? flag.default
      },
      overrides: {} as Record<string, unknown>,
      rolloutConfig: {
        version: 1,
        updatedAt: '',
        flags: {
          darkMode: { percentage: 50 },
          apiUrl: { value: 'https://staging.api.com' },
        },
      },
      setOverride: mockSetOverride,
      resetAllOverrides: mockResetAllOverrides,
      saveRolloutConfig: mockSaveRolloutConfig,
      refresh: mockRefresh,
      isAdmin: true,
      isLoading: false,
      error: null as string | null,
      environment: 'production' as 'production' | 'staging',
      clientId: 'test-client',
    },
  }

  return { mockSetOverride, mockResetAllOverrides, mockSaveRolloutConfig, mockRefresh, mockContext }
})

vi.mock('../../flags/flagDefinitions', () => ({
  FLAGS: {
    darkMode: { id: 'darkMode', type: 'boolean', default: false, description: 'Enable dark mode' },
    apiUrl: { id: 'apiUrl', type: 'string', default: 'https://api.example.com', description: 'API endpoint URL' },
    maxRetries: { id: 'maxRetries', type: 'number', default: 3, description: 'Max API retries' },
    featureConfig: {
      id: 'featureConfig',
      type: 'json',
      default: {},
      description: 'Feature configuration object',
    },
  },
}))

vi.mock('../../flags/FlagContext', () => ({
  useFlagContext: () => mockContext.current,
}))

import FlagAdminPane from './components/FlagAdminPane'

/* ── Setup ───────────────────────────────────────────────────────── */

const flagDefaults: Record<string, unknown> = {
  darkMode: false,
  apiUrl: 'https://api.example.com',
  maxRetries: 3,
  featureConfig: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  mockContext.current = {
    resolveFlag: (flag: { id: string; default: unknown }) => {
      const ov = mockContext.current.overrides[flag.id]
      if (ov !== undefined) return ov
      return flagDefaults[flag.id] ?? flag.default
    },
    overrides: {},
    rolloutConfig: {
      version: 1,
      updatedAt: '',
      flags: {
        darkMode: { percentage: 50 },
        apiUrl: { value: 'https://staging.api.com' },
      },
    },
    setOverride: mockSetOverride,
    resetAllOverrides: mockResetAllOverrides,
    saveRolloutConfig: mockSaveRolloutConfig,
    refresh: mockRefresh,
    isAdmin: true,
    isLoading: false,
    error: null,
    environment: 'production',
    clientId: 'test-client',
  }
})

/* ── Tests ───────────────────────────────────────────────────────── */

describe('FlagAdminPane', () => {
  it('renders all flags from FLAGS definitions', () => {
    render(<FlagAdminPane />)

    expect(screen.getAllByText('darkMode').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('apiUrl').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('maxRetries').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('featureConfig').length).toBeGreaterThanOrEqual(1)
  })

  it('renders type badges correctly per flag type', () => {
    mockContext.current.isAdmin = false
    render(<FlagAdminPane />)

    const badges = screen.getAllByText(/^(boolean|string|number|json)$/)
    expect(badges).toHaveLength(4)
    expect(screen.getByText('boolean')).toHaveClass('ff-badge--boolean')
    expect(screen.getByText('string')).toHaveClass('ff-badge--string')
    expect(screen.getByText('number')).toHaveClass('ff-badge--number')
    expect(screen.getByText('json')).toHaveClass('ff-badge--json')
  })

  it('toggle switch changes local override', async () => {
    render(<FlagAdminPane />)

    const toggleBtn = screen.getByRole('switch', { name: /toggle darkMode/i })
    await userEvent.click(toggleBtn)

    expect(mockSetOverride).toHaveBeenCalledWith('darkMode', true)
  })

  it('Reset All Overrides clears overrides and announces', async () => {
    mockContext.current.overrides = { darkMode: true }
    render(<FlagAdminPane />)

    const resetBtn = screen.getByRole('button', { name: /reset all overrides/i })
    await userEvent.click(resetBtn)

    expect(mockResetAllOverrides).toHaveBeenCalled()
  })

  it('rollout config section hidden when isAdmin is false', () => {
    mockContext.current.isAdmin = false
    render(<FlagAdminPane />)

    expect(screen.queryByText('Rollout Config')).not.toBeInTheDocument()
    expect(screen.getByText('My Overrides')).toBeInTheDocument()
  })

  it('rollout config section visible when isAdmin is true', () => {
    render(<FlagAdminPane />)

    expect(screen.getByText('Rollout Config')).toBeInTheDocument()
  })

  it('Save button disabled when no changes', () => {
    render(<FlagAdminPane />)

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Save button enabled after changing rollout value', async () => {
    render(<FlagAdminPane />)

    const percentInput = screen.getByLabelText(/rollout %/i)
    await userEvent.clear(percentInput)
    await userEvent.type(percentInput, '75')

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).not.toBeDisabled()
  })

  it('environment badge shows correct environment', () => {
    render(<FlagAdminPane />)

    expect(screen.getByText('Production')).toHaveClass('ff-env-badge--production')
  })

  it('shows staging environment badge when environment is staging', () => {
    mockContext.current.environment = 'staging'
    render(<FlagAdminPane />)

    expect(screen.getByText('Staging')).toHaveClass('ff-env-badge--staging')
  })

  it('shows loading skeletons when isLoading is true', () => {
    mockContext.current.isLoading = true
    const { container } = render(<FlagAdminPane />)

    expect(container.querySelectorAll('.ff-skeleton')).toHaveLength(3)
  })

  it('shows error state with retry button', async () => {
    mockContext.current.error = 'Network error'
    render(<FlagAdminPane />)

    expect(screen.getByText(/could not reach github/i)).toBeInTheDocument()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    await userEvent.click(retryBtn)
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows saved indicator after successful save', async () => {
    render(<FlagAdminPane />)

    const percentInput = screen.getByLabelText(/rollout %/i)
    await userEvent.clear(percentInput)
    await userEvent.type(percentInput, '80')

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Saved ✓')).toBeInTheDocument()
    })
  })

  it('shows save error message on failure', async () => {
    mockSaveRolloutConfig.mockRejectedValueOnce(new Error('Permission denied'))
    render(<FlagAdminPane />)

    const percentInput = screen.getByLabelText(/rollout %/i)
    await userEvent.clear(percentInput)
    await userEvent.type(percentInput, '80')

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    await userEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument()
    })
  })

  it('flag descriptions are rendered', () => {
    render(<FlagAdminPane />)

    expect(screen.getByText('Enable dark mode')).toBeInTheDocument()
    expect(screen.getByText('API endpoint URL')).toBeInTheDocument()
  })

  it('shows "using public config" when no override is set', () => {
    render(<FlagAdminPane />)

    const configTexts = screen.getAllByText('using public config')
    expect(configTexts.length).toBeGreaterThan(0)
  })

  it('shows override indicator when override is active', () => {
    mockContext.current.overrides = { darkMode: true }
    render(<FlagAdminPane />)

    expect(screen.getByText('Override: true')).toBeInTheDocument()
  })
})
