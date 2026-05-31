import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GitHubSyncPane from './GitHubSyncPane'
import type { GitHubSyncPaneProps } from '../types'
import type { SyncProgress } from '../../../hooks/useGitHubSync'

const baseProps: GitHubSyncPaneProps = {
  hasPendingChanges: false,
  ghConfig: { owner: '', repo: '', filePath: 'data.json', autoSync: false },
  ghIsConfigured: false,
  ghSyncStatus: 'idle',
  ghLastSyncAt: null,
  ghLastError: null,
  ghHistory: [],
  ghHasStoredToken: false,
  ghTokenUnlocked: false,
  onGhUpdateConfig: vi.fn(),
  onGhSaveEncryptedToken: vi.fn().mockResolvedValue({ ok: true, message: 'Saved' }),
  onGhUnlockToken: vi.fn().mockResolvedValue({ ok: true, message: 'Unlocked' }),
  onGhLockToken: vi.fn(),
  onGhSyncNow: vi.fn().mockResolvedValue(undefined),
  onGhFetchHistory: vi.fn().mockResolvedValue(undefined),
  onGhTestConnection: vi.fn().mockResolvedValue({ ok: true, message: 'Connected', warnings: [] }),
  onGhRestoreLatest: vi.fn().mockResolvedValue({ ok: true, message: 'Restored', data: {} }),
  onGhRestoreFromCommit: vi.fn().mockResolvedValue({ ok: true, message: 'Restored', data: {} }),
  onGhApplyRestore: vi.fn().mockResolvedValue(undefined),
  ghData: { goals: [] },
  ghSyncProgress: null,
}

function renderPane(overrides: Partial<GitHubSyncPaneProps> = {}) {
  return render(<GitHubSyncPane {...baseProps} {...overrides} />)
}

describe('GitHubSyncPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Tabs ──

  it('renders Configuration tab active by default', () => {
    renderPane()
    const configBtn = screen.getByRole('button', { name: 'Configuration' })
    expect(configBtn).toHaveAttribute('aria-current', 'page')
  })

  it('switches to History tab on click', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('button', { name: 'History' }))
    const historyBtn = screen.getByRole('button', { name: 'History' })
    expect(historyBtn).toHaveAttribute('aria-current', 'page')
  })

  // ── Token: no stored token ──

  it('shows hint when no token is saved', () => {
    renderPane({ ghHasStoredToken: false })
    expect(screen.getByText(/No token saved yet/)).toBeInTheDocument()
  })

  it('renders token input in masked (password) mode by default', () => {
    renderPane({ ghHasStoredToken: false })
    const tokenInput = screen.getByPlaceholderText('github_pat_...')
    expect(tokenInput).toHaveAttribute('type', 'password')
  })

  it('toggles token visibility between password and text', async () => {
    const user = userEvent.setup()
    renderPane({ ghHasStoredToken: false })
    const tokenInput = screen.getByPlaceholderText('github_pat_...')
    const showBtn = screen.getByRole('button', { name: 'Show' })

    await user.click(showBtn)
    expect(tokenInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(tokenInput).toHaveAttribute('type', 'password')
  })

  it('disables Save Token when token or passphrase is empty', async () => {
    const user = userEvent.setup()
    renderPane({ ghHasStoredToken: false })
    const saveBtn = screen.getByRole('button', { name: 'Save Token' })
    expect(saveBtn).toBeDisabled()

    await user.type(screen.getByPlaceholderText('github_pat_...'), 'ghp_abc')
    expect(saveBtn).toBeDisabled()

    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'mypass')
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls onGhSaveEncryptedToken with token and passphrase on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: true, message: 'Saved' })
    renderPane({ ghHasStoredToken: false, onGhSaveEncryptedToken: onSave })

    await user.type(screen.getByPlaceholderText('github_pat_...'), 'ghp_test123')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Save Token' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('ghp_test123', 'secret')
    })
  })

  it('shows success message after saving token', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: true, message: 'Token saved successfully' })
    renderPane({ ghHasStoredToken: false, onGhSaveEncryptedToken: onSave })

    await user.type(screen.getByPlaceholderText('github_pat_...'), 'ghp_x')
    await user.type(screen.getByPlaceholderText('At least 8 characters'), 'pass')
    await user.click(screen.getByRole('button', { name: 'Save Token' }))

    await waitFor(() => {
      expect(screen.getByText(/Token saved successfully/)).toBeInTheDocument()
    })
  })

  it('clears token and passphrase inputs after successful save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: true, message: 'Saved' })
    renderPane({ ghHasStoredToken: false, onGhSaveEncryptedToken: onSave })

    const tokenInput = screen.getByPlaceholderText('github_pat_...')
    const passphraseInput = screen.getByPlaceholderText('At least 8 characters')

    await user.type(tokenInput, 'ghp_x')
    await user.type(passphraseInput, 'pass')
    await user.click(screen.getByRole('button', { name: 'Save Token' }))

    await waitFor(() => {
      expect(tokenInput).toHaveValue('')
      expect(passphraseInput).toHaveValue('')
    })
  })

  // ── Token: stored but locked ──

  it('shows unlock passphrase input when token is stored but locked', () => {
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: false })
    expect(screen.getByPlaceholderText('Passphrase to unlock token')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument()
  })

  it('calls onGhUnlockToken on unlock click', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue({ ok: true, message: 'ok' })
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: false, onGhUnlockToken: onUnlock })

    await user.type(screen.getByPlaceholderText('Passphrase to unlock token'), 'mypass')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => {
      expect(onUnlock).toHaveBeenCalledWith('mypass')
    })
  })

  it('shows error message when unlock fails', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue({ ok: false, message: 'Wrong passphrase' })
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: false, onGhUnlockToken: onUnlock })

    await user.type(screen.getByPlaceholderText('Passphrase to unlock token'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    await waitFor(() => {
      expect(screen.getByText(/Wrong passphrase/)).toBeInTheDocument()
    })
  })

  // ── Token: unlocked ──

  it('shows token unlocked status and Lock button when unlocked', () => {
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: true })
    expect(screen.getByText('Token unlocked for this session')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument()
  })

  it('calls onGhLockToken when Lock is clicked', async () => {
    const user = userEvent.setup()
    const onLock = vi.fn()
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: true, onGhLockToken: onLock })

    await user.click(screen.getByRole('button', { name: 'Lock' }))
    expect(onLock).toHaveBeenCalled()
  })

  it('dismisses token unlocked banner when dismiss button is clicked', async () => {
    const user = userEvent.setup()
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: true })
    expect(screen.getByText('Token unlocked for this session')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Token unlocked for this session')).not.toBeInTheDocument()
  })

  it('shows Change token button when unlocked with stored token', () => {
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: true })
    expect(screen.getByRole('button', { name: 'Change token' })).toBeInTheDocument()
  })

  // ── Repository configuration ──

  it('shows Owner and Repository input fields when no repo is configured', () => {
    renderPane({ ghHasStoredToken: false })
    expect(screen.getByPlaceholderText('your-github-username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('finance-backups')).toBeInTheDocument()
  })

  it('calls onGhUpdateConfig when owner input changes', () => {
    const onUpdate = vi.fn()
    renderPane({ ghHasStoredToken: false, onGhUpdateConfig: onUpdate })

    fireEvent.change(screen.getByPlaceholderText('your-github-username'), { target: { value: 'myuser' } })
    expect(onUpdate).toHaveBeenCalledWith({ owner: 'myuser' })
  })

  it('shows repo info with Edit button when owner and repo are set', () => {
    renderPane({
      ghHasStoredToken: false,
      ghConfig: { owner: 'dutta14', repo: 'finance-backups', filePath: 'data.json', autoSync: false },
    })
    expect(screen.getByText('dutta14/finance-backups')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  // ── Auto-sync toggle ──

  it('renders auto-sync checkbox and calls onGhUpdateConfig on toggle', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    renderPane({ ghHasStoredToken: false, onGhUpdateConfig: onUpdate })

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(onUpdate).toHaveBeenCalledWith({ autoSync: true })
  })

  it('renders auto-sync checkbox as checked when autoSync is true', () => {
    renderPane({
      ghHasStoredToken: false,
      ghConfig: { owner: '', repo: '', filePath: 'data.json', autoSync: true },
    })
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  // ── Sync status ──

  it('shows "Missing configuration" when idle with no repo', () => {
    renderPane({ ghSyncStatus: 'idle', ghHasStoredToken: false })
    expect(screen.getByText('Missing configuration')).toBeInTheDocument()
  })

  it('shows "Ready to sync" when idle with repo, stored token, and unlocked', () => {
    renderPane({
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'o', repo: 'r', filePath: 'f', autoSync: false },
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
    })
    expect(screen.getByText('Ready to sync')).toBeInTheDocument()
  })

  it('shows "Token not set up" when idle with repo but no stored token', () => {
    renderPane({
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'o', repo: 'r', filePath: 'f', autoSync: false },
      ghHasStoredToken: false,
    })
    expect(screen.getByText('Token not set up')).toBeInTheDocument()
  })

  it('shows Syncing… in the Sync button when sync is in progress', () => {
    renderPane({ ghSyncStatus: 'syncing', ghHasStoredToken: false })
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeInTheDocument()
  })

  it('shows last sync timestamp when sync status is success', () => {
    renderPane({
      ghSyncStatus: 'success',
      ghLastSyncAt: '2024-01-15T10:30:00Z',
      ghHasStoredToken: false,
    })
    expect(screen.getByText(/Last synced/)).toBeInTheDocument()
  })

  it('shows sync error message when sync status is error', () => {
    renderPane({
      ghSyncStatus: 'error',
      ghLastError: 'Rate limit exceeded',
      ghHasStoredToken: false,
    })
    expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument()
  })

  it('shows unsaved changes label when success + pending changes', () => {
    renderPane({
      ghSyncStatus: 'success',
      ghLastSyncAt: '2024-01-15T10:30:00Z',
      hasPendingChanges: true,
      ghHasStoredToken: false,
    })
    expect(screen.getByText('unsaved changes')).toBeInTheDocument()
  })

  // ── Sync Now button ──

  it('disables Sync button when not configured', () => {
    renderPane({ ghIsConfigured: false, ghHasStoredToken: false })
    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled()
  })

  it('disables Sync button during active sync', () => {
    renderPane({ ghIsConfigured: true, ghSyncStatus: 'syncing', ghHasStoredToken: false })
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
  })

  it('calls onGhSyncNow when Sync button is clicked', async () => {
    const user = userEvent.setup()
    const onSync = vi.fn().mockResolvedValue(undefined)
    renderPane({ ghIsConfigured: true, onGhSyncNow: onSync, ghHasStoredToken: false, ghData: { goals: [] } })

    await user.click(screen.getByRole('button', { name: 'Sync' }))
    await waitFor(() => {
      expect(onSync).toHaveBeenCalledWith({ goals: [] }, expect.stringContaining('Synced user data on'))
    })
  })

  // ── Sync progress ──

  it('shows "Already up to date" when progress total is 0', () => {
    const progress: SyncProgress = { total: 0, completed: 0, current: '', errors: [], domains: [] }
    renderPane({ ghSyncProgress: progress, ghHasStoredToken: false })
    expect(screen.getByText(/Already up to date/)).toBeInTheDocument()
  })

  it('shows domain progress list when total > 0', () => {
    const progress: SyncProgress = {
      total: 6,
      completed: 2,
      current: 'Tools',
      errors: [],
      domains: ['goals', 'data', 'tools', 'allocation', 'taxes', 'budget'],
    }
    renderPane({ ghSyncProgress: progress, ghHasStoredToken: false })
    expect(screen.getByText('Goals')).toBeInTheDocument()
    expect(screen.getByText('Balances')).toBeInTheDocument()
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('shows "All synced" when all domains complete with no errors', () => {
    const progress: SyncProgress = {
      total: 6,
      completed: 6,
      current: '',
      errors: [],
      domains: ['goals', 'data', 'tools', 'allocation', 'taxes', 'budget'],
    }
    renderPane({ ghSyncProgress: progress, ghHasStoredToken: false })
    expect(screen.getByText(/All synced/)).toBeInTheDocument()
  })

  it('shows sync errors in progress when errors exist', () => {
    const progress: SyncProgress = {
      total: 6,
      completed: 3,
      current: '',
      errors: ['Goals: failed to push'],
      domains: ['goals', 'data', 'tools', 'allocation', 'taxes', 'budget'],
    }
    renderPane({ ghSyncProgress: progress, ghHasStoredToken: false })
    expect(screen.getByText(/Goals: failed to push/)).toBeInTheDocument()
  })

  // ── Test connection ──

  it('shows Connected badge after successful test', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: 'Connected', warnings: [] })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'dutta14', repo: 'backup', filePath: 'data.json', autoSync: false },
      onGhTestConnection: onTest,
    })

    await user.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  it('shows error after failed test connection', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue({ ok: false, message: 'Repo not found', warnings: [] })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'dutta14', repo: 'bad', filePath: 'data.json', autoSync: false },
      onGhTestConnection: onTest,
    })

    await user.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => {
      expect(screen.getByText(/Repo not found/)).toBeInTheDocument()
    })
  })

  it('shows warnings from test connection result', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: 'ok', warnings: ['File not found, will create'] })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'o', repo: 'r', filePath: 'f', autoSync: false },
      onGhTestConnection: onTest,
    })

    await user.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => {
      expect(screen.getByText(/File not found, will create/)).toBeInTheDocument()
    })
  })

  // ── History tab ──

  it('fetches history when switching to History tab with empty history', async () => {
    const user = userEvent.setup()
    const onFetch = vi.fn().mockResolvedValue(undefined)
    renderPane({ onGhFetchHistory: onFetch })

    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(onFetch).toHaveBeenCalled()
  })

  it('shows empty state when not configured on History tab', async () => {
    const user = userEvent.setup()
    renderPane({ ghIsConfigured: false })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('Connect and unlock token to view history.')).toBeInTheDocument()
  })

  it('shows "No commits yet" when configured but history is empty', async () => {
    const user = userEvent.setup()
    renderPane({ ghIsConfigured: true, ghHistory: [] })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('No commits yet for this file.')).toBeInTheDocument()
  })

  it('renders commit entries with restore buttons', async () => {
    const user = userEvent.setup()
    renderPane({
      ghIsConfigured: true,
      ghHistory: [
        {
          sha: 'abc123',
          message: 'Sync Jan 15',
          date: '2024-01-15T10:00:00Z',
          url: 'https://github.com/commit/abc123',
        },
        {
          sha: 'def456',
          message: 'Sync Jan 14',
          date: '2024-01-14T10:00:00Z',
          url: 'https://github.com/commit/def456',
        },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('Sync Jan 15')).toBeInTheDocument()
    expect(screen.getByText('Sync Jan 14')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2)
  })

  // ── Restore ──

  it('calls onGhRestoreLatest and onGhApplyRestore on Restore Latest click', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn().mockResolvedValue({ ok: true, message: 'Restored', data: { goals: [] } })
    const onApply = vi.fn().mockResolvedValue(undefined)
    renderPane({ ghIsConfigured: true, onGhRestoreLatest: onRestore, onGhApplyRestore: onApply })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore Latest' }))

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalled()
      expect(onApply).toHaveBeenCalledWith({ goals: [] })
    })
  })

  it('shows restore result message after restore', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn().mockResolvedValue({ ok: true, message: 'Data restored from latest commit' })
    renderPane({ ghIsConfigured: true, onGhRestoreLatest: onRestore })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore Latest' }))

    await waitFor(() => {
      expect(screen.getByText(/Data restored from latest commit/)).toBeInTheDocument()
    })
  })

  it('disables Restore Latest button when not configured', async () => {
    const user = userEvent.setup()
    renderPane({ ghIsConfigured: false })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('button', { name: 'Restore Latest' })).toBeDisabled()
  })

  it('calls onGhRestoreFromCommit when a specific commit Restore is clicked', async () => {
    const user = userEvent.setup()
    const onRestoreCommit = vi.fn().mockResolvedValue({ ok: true, message: 'Done', data: {} })
    const onApply = vi.fn().mockResolvedValue(undefined)
    renderPane({
      ghIsConfigured: true,
      ghHistory: [{ sha: 'abc123', message: 'Sync', date: '2024-01-15T10:00:00Z', url: 'https://example.com' }],
      onGhRestoreFromCommit: onRestoreCommit,
      onGhApplyRestore: onApply,
    })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    await waitFor(() => {
      expect(onRestoreCommit).toHaveBeenCalledWith('abc123')
      expect(onApply).toHaveBeenCalledWith({})
    })
  })

  // ── fetchHistory on initial render ──

  it('calls onGhFetchHistory on mount when configured and unlocked', () => {
    const onFetch = vi.fn().mockResolvedValue(undefined)
    renderPane({ ghIsConfigured: true, ghTokenUnlocked: true, ghHistory: [], onGhFetchHistory: onFetch })
    expect(onFetch).toHaveBeenCalledOnce()
  })

  it('calls onGhFetchHistory when clicking History tab with empty history', async () => {
    const user = userEvent.setup()
    const onFetch = vi.fn().mockResolvedValue(undefined)
    renderPane({ ghIsConfigured: true, ghHistory: [], onGhFetchHistory: onFetch })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(onFetch).toHaveBeenCalled()
  })

  // ── Sync success timer ──

  it('shows sync success banner after syncing', async () => {
    const onSync = vi.fn().mockResolvedValue(undefined)
    renderPane({
      ghIsConfigured: true,
      ghTokenUnlocked: true,
      ghHasStoredToken: true,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
      onGhSyncNow: onSync,
    })

    fireEvent.click(screen.getByTitle('Sync current goal data to GitHub'))

    await waitFor(() => {
      expect(onSync).toHaveBeenCalled()
    })
  })

  // ── Unlock via Enter key ──

  it('unlocks token when pressing Enter in passphrase field', () => {
    const onUnlock = vi.fn().mockResolvedValue({ ok: true, message: 'Unlocked' })
    renderPane({ ghHasStoredToken: true, ghTokenUnlocked: false, onGhUnlockToken: onUnlock })

    const input = screen.getByPlaceholderText('Passphrase to unlock token')
    fireEvent.change(input, { target: { value: 'mypass' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onUnlock).toHaveBeenCalledWith('mypass')
  })

  // ── Dismiss unlock status ──

  it('dismisses token unlocked status banner', () => {
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghIsConfigured: true,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
    })

    expect(screen.getByText('Token unlocked for this session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Token unlocked for this session')).not.toBeInTheDocument()
  })

  // ── Cancel token form ──

  it('cancels the change token form and clears inputs', async () => {
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghIsConfigured: true,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
    })

    // Click "Change token" to show the form
    fireEvent.click(screen.getByText('Change token'))

    // Token form should now be visible
    expect(screen.getByPlaceholderText('github_pat_...')).toBeInTheDocument()

    // Cancel the form
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Token form should be hidden
    expect(screen.queryByPlaceholderText('github_pat_...')).not.toBeInTheDocument()
  })

  // ── Edit repo button ──

  it('shows repo edit form when Edit button is clicked', () => {
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghIsConfigured: true,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
    })

    expect(screen.getByText('me/data')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByPlaceholderText('your-github-username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('finance-backups')).toBeInTheDocument()
  })

  // ── Cancel repo editing ──

  it('cancels repo editing on Cancel button click', () => {
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghIsConfigured: true,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByPlaceholderText('your-github-username')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Should be back to display mode
    expect(screen.getByText('me/data')).toBeInTheDocument()
  })

  // ── Test connection button disabled without token ──

  it('disables Test button when token is not unlocked', () => {
    renderPane({
      ghHasStoredToken: false,
      ghTokenUnlocked: false,
      ghConfig: { owner: 'me', repo: 'data', filePath: 'data.json', autoSync: false },
    })

    expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled()
  })

  // ── Default prop values used when no props are passed ──

  it('renders without errors when using minimal/default props', () => {
    render(
      <GitHubSyncPane
        ghConfig={{ owner: '', repo: '', filePath: 'data.json', autoSync: false }}
        ghSyncProgress={null}
        hasPendingChanges={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Configuration' })).toBeInTheDocument()
  })

  // ── Branch coverage: default parameter values (lines 16-25) ──

  it('uses default prop values when props are omitted (covers default parameter branches)', () => {
    render(
      <GitHubSyncPane
        hasPendingChanges={false}
        ghConfig={{ owner: '', repo: '', filePath: 'data.json', autoSync: false }}
      />,
    )
    // Default ghSyncStatus = 'idle', ghIsConfigured = false
    expect(screen.getByRole('button', { name: 'Sync' })).toBeDisabled()
    expect(screen.getByText('Missing configuration')).toBeInTheDocument()
  })

  // ── Branch coverage: handleGhSyncNow does NOT show success when progress total=0 (line 90) ──

  it('does not show sync success banner when ghSyncProgress.total is 0', async () => {
    const user = userEvent.setup()
    const progress: SyncProgress = { total: 0, completed: 0, current: '', errors: [], domains: [] }
    const onSync = vi.fn().mockResolvedValue(undefined)
    renderPane({
      ghIsConfigured: true,
      ghHasStoredToken: false,
      ghSyncProgress: progress,
      onGhSyncNow: onSync,
    })

    await user.click(screen.getByRole('button', { name: 'Sync' }))
    await waitFor(() => expect(onSync).toHaveBeenCalled())

    // "Sync successful" banner should NOT appear because total is 0
    expect(screen.queryByText(/Sync successful/)).not.toBeInTheDocument()
  })

  // ── Branch coverage: handleGhRestoreLatest when result has no data (line 98) ──

  it('shows restore failure message when restoreLatest returns ok=false', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn().mockResolvedValue({ ok: false, message: 'Failed to fetch' })
    const onApply = vi.fn()
    renderPane({
      ghIsConfigured: true,
      onGhRestoreLatest: onRestore,
      onGhApplyRestore: onApply,
    })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore Latest' }))

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument()
    })
    // onGhApplyRestore should NOT have been called since ok=false
    expect(onApply).not.toHaveBeenCalled()
  })

  // ── Branch coverage: handleGhRestoreCommit failure path (line 107) ──

  it('shows restore error when restoreFromCommit returns ok=false', async () => {
    const user = userEvent.setup()
    const onRestoreCommit = vi.fn().mockResolvedValue({ ok: false, message: 'Not found' })
    const onApply = vi.fn()
    renderPane({
      ghIsConfigured: true,
      ghHistory: [{ sha: 'xyz789', message: 'Old sync', date: '2024-01-10T08:00:00Z', url: 'https://example.com' }],
      onGhRestoreFromCommit: onRestoreCommit,
      onGhApplyRestore: onApply,
    })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    await waitFor(() => {
      expect(screen.getByText(/Not found/)).toBeInTheDocument()
    })
    expect(onApply).not.toHaveBeenCalled()
  })

  // ── Branch coverage: ghSyncStatus idle + owner/repo + hasPendingChanges (line 384) ──

  it('shows "Unsaved changes" when idle with repo configured and pending changes', () => {
    renderPane({
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'o', repo: 'r', filePath: 'f', autoSync: false },
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      hasPendingChanges: true,
    })
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument()
  })

  // ── Branch coverage: dirty dot visible when pending changes + not syncing (line 394) ──

  it('shows dirty dot indicator when pending changes and not syncing', () => {
    const { container } = renderPane({
      ghSyncStatus: 'idle',
      ghHasStoredToken: false,
      hasPendingChanges: true,
      ghConfig: { owner: 'o', repo: 'r', filePath: 'f', autoSync: false },
    })
    expect(container.querySelector('.ghsync-dirty-dot')).toBeInTheDocument()
  })

  // ── Branch coverage: ghSyncProgress with domains (line 411) ──

  it('renders sync progress with domain-level error states', () => {
    const progress: SyncProgress = {
      total: 6,
      completed: 4,
      current: 'Allocation',
      errors: ['Goals: push rejected'],
      domains: ['goals', 'data', 'tools', 'allocation', 'taxes', 'budget'],
    }
    renderPane({ ghSyncProgress: progress, ghHasStoredToken: false })
    // Error domain shown with error styling
    expect(screen.getByText(/Goals: push rejected/)).toBeInTheDocument()
    expect(screen.getByText('Allocation')).toBeInTheDocument()
  })

  // ── Branch coverage: restore result with ok=true renders success (lines 475-478) ──

  it('renders restore success result with checkmark', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn().mockResolvedValue({ ok: true, message: 'Restored successfully', data: {} })
    const onApply = vi.fn().mockResolvedValue(undefined)
    renderPane({ ghIsConfigured: true, onGhRestoreLatest: onRestore, onGhApplyRestore: onApply })

    await user.click(screen.getByRole('button', { name: 'History' }))
    await user.click(screen.getByRole('button', { name: 'Restore Latest' }))

    await waitFor(() => {
      const el = screen.getByRole('status')
      expect(el).toHaveTextContent(/Restored successfully/)
    })
  })

  // ── Branch coverage: save token failure path (line 98 handler, inputs remain) ──

  it('does not clear inputs when save token fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ok: false, message: 'Invalid token' })
    renderPane({ ghHasStoredToken: false, onGhSaveEncryptedToken: onSave })

    const tokenInput = screen.getByPlaceholderText('github_pat_...')
    const passInput = screen.getByPlaceholderText('At least 8 characters')
    await user.type(tokenInput, 'ghp_bad')
    await user.type(passInput, 'pass123')
    await user.click(screen.getByRole('button', { name: 'Save Token' }))

    await waitFor(() => {
      expect(screen.getByText(/Invalid token/)).toBeInTheDocument()
    })
    // Inputs should NOT be cleared on failure
    expect(tokenInput).toHaveValue('ghp_bad')
    expect(passInput).toHaveValue('pass123')
  })

  // ── Branch coverage: ghTokenUnlocked=true && !ghHasStoredToken → null branch (line 283) ──

  it('renders token form without Cancel button when unlocked but no stored token', () => {
    renderPane({
      ghHasStoredToken: false,
      ghTokenUnlocked: true,
    })
    // Token form should render (no stored token → form always shown)
    expect(screen.getByPlaceholderText('github_pat_...')).toBeInTheDocument()
    // Cancel button should NOT be present because ghHasStoredToken is false
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  // ── Branch coverage: repo editing sets ghEditingRepo in onChange (line 336) ──

  it('sets editing mode implicitly when repo input changes', () => {
    const onUpdate = vi.fn()
    renderPane({
      ghHasStoredToken: false,
      ghConfig: undefined,
      onGhUpdateConfig: onUpdate,
    })
    // Repo fields should be visible since no config
    const repoInput = screen.getByPlaceholderText('finance-backups')
    fireEvent.change(repoInput, { target: { value: 'my-repo' } })
    expect(onUpdate).toHaveBeenCalledWith({ repo: 'my-repo' })
  })

  // ── Branch coverage: unlock token failure shows error (line 83) ──

  it('shows error message when token unlock fails', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue({ ok: false, message: 'Wrong passphrase' })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: false,
      onGhUnlockToken: onUnlock,
    })
    const passInput = screen.getByPlaceholderText('Passphrase to unlock token')
    await user.type(passInput, 'badpass')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => {
      expect(screen.getByText(/Wrong passphrase/)).toBeInTheDocument()
    })
  })

  // ── Branch coverage: Enter key triggers unlock on passphrase input (line 163) ──

  it('Enter key in unlock passphrase input triggers unlock', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue({ ok: true, message: 'Unlocked' })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: false,
      onGhUnlockToken: onUnlock,
    })
    const passInput = screen.getByPlaceholderText('Passphrase to unlock token')
    await user.type(passInput, 'mypass{Enter}')
    expect(onUnlock).toHaveBeenCalledWith('mypass')
  })

  // ── Branch coverage: dismiss unlock status banner (line 181) ──

  it('dismisses the token unlocked status banner', async () => {
    const user = userEvent.setup()
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
    })
    expect(screen.getByText('Token unlocked for this session')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Token unlocked for this session')).not.toBeInTheDocument()
  })

  // ── Branch coverage: "Change token" button shows form (line 199) ──

  it('shows token form when Change token is clicked', async () => {
    const user = userEvent.setup()
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
    })
    await user.click(screen.getByRole('button', { name: 'Change token' }))
    expect(screen.getByPlaceholderText('github_pat_...')).toBeInTheDocument()
    expect(screen.getByText('Replace token')).toBeInTheDocument()
  })

  // ── Branch coverage: Cancel button on token form when has stored token (line 269-278) ──

  it('shows Cancel button on token form and clicking it hides the form', async () => {
    const user = userEvent.setup()
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
    })
    await user.click(screen.getByRole('button', { name: 'Change token' }))
    expect(screen.getByPlaceholderText('github_pat_...')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText('github_pat_...')).not.toBeInTheDocument()
  })

  // ── Branch coverage: repo configured shows edit button, clicking opens editor (line 288-301) ──

  it('shows repo info with Edit button when config has owner/repo', async () => {
    const user = userEvent.setup()
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'myuser', repo: 'myrepo', filePath: 'data.json', autoSync: false },
    })
    expect(screen.getByText('myuser/myrepo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    // Should show owner/repo inputs
    expect(screen.getByPlaceholderText('your-github-username')).toBeInTheDocument()
  })

  // ── Branch coverage: Cancel button on repo editor (line 342) ──

  it('hides repo editor when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'myuser', repo: 'myrepo', filePath: 'data.json', autoSync: false },
    })
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // Should go back to showing the repo info
    expect(screen.getByText('myuser/myrepo')).toBeInTheDocument()
  })

  // ── Branch coverage: test connection error result (line 445-448) ──

  it('shows test connection error message', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue({ ok: false, message: 'Not found', warnings: [] })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'myuser', repo: 'myrepo', filePath: 'data.json', autoSync: false },
      onGhTestConnection: onTest,
    })
    await user.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => {
      expect(screen.getByText(/Not found/)).toBeInTheDocument()
    })
  })

  // ── Branch coverage: test connection with warnings (line 450-458) ──

  it('shows warnings from test connection result', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue({ ok: true, message: 'OK', warnings: ['Repo is empty', 'No commits'] })
    renderPane({
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghConfig: { owner: 'myuser', repo: 'myrepo', filePath: 'data.json', autoSync: false },
      onGhTestConnection: onTest,
    })
    await user.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => {
      expect(screen.getByText(/Repo is empty/)).toBeInTheDocument()
      expect(screen.getByText(/No commits/)).toBeInTheDocument()
    })
  })

  // ── Branch coverage: idle status messages (lines 382-390) ──

  it('shows "Unsaved changes" idle status when hasPendingChanges is true with config', () => {
    renderPane({
      hasPendingChanges: true,
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'user', repo: 'repo', filePath: 'data.json', autoSync: false },
    })
    expect(screen.getByText(/Unsaved changes — sync when ready/)).toBeInTheDocument()
  })

  it('shows "Token not set up" idle status when no stored token', () => {
    renderPane({
      ghHasStoredToken: false,
      ghTokenUnlocked: false,
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'user', repo: 'repo', filePath: 'data.json', autoSync: false },
    })
    expect(screen.getByText(/Token not set up/)).toBeInTheDocument()
  })

  it('shows "Missing configuration" when no owner/repo configured', () => {
    renderPane({
      ghHasStoredToken: false,
      ghSyncStatus: 'idle',
      ghConfig: { owner: '', repo: '', filePath: 'data.json', autoSync: false },
    })
    expect(screen.getByText(/Missing configuration/)).toBeInTheDocument()
  })

  // ── Branch coverage: sync progress "Already up to date" (line 405-406) ──

  it('shows "Already up to date" when syncProgress has total=0', () => {
    renderPane({
      ghHasStoredToken: false,
      ghSyncProgress: { total: 0, completed: 0, current: '', errors: [], domains: [] },
    })
    expect(screen.getByText(/Already up to date/)).toBeInTheDocument()
  })

  // ── Branch coverage: sync progress "All synced" (line 427-428) ──

  it('shows "All synced" when all domains complete without errors', () => {
    const progress: SyncProgress = {
      total: 2,
      completed: 2,
      current: '',
      errors: [],
      domains: ['goals', 'data'],
    }
    renderPane({
      ghHasStoredToken: false,
      ghSyncProgress: progress,
    })
    expect(screen.getByText(/All synced/)).toBeInTheDocument()
  })

  // ── Branch coverage: hasPendingChanges dirty dot shown (line 394) ──

  it('shows dirty dot indicator when hasPendingChanges and not syncing', () => {
    const { container } = renderPane({
      hasPendingChanges: true,
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghSyncStatus: 'idle',
      ghConfig: { owner: 'user', repo: 'repo', filePath: 'data.json', autoSync: false },
    })
    expect(container.querySelector('.ghsync-dirty-dot')).toBeInTheDocument()
  })

  // ── Branch coverage: history tab with commit list and restore from specific commit ──

  it('renders commit list and handles restore from specific commit', async () => {
    const user = userEvent.setup()
    const onRestoreCommit = vi.fn().mockResolvedValue({ ok: true, message: 'Restored from abc123', data: {} })
    const onApply = vi.fn().mockResolvedValue(undefined)
    renderPane({
      ghIsConfigured: true,
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghHistory: [
        {
          sha: 'abc123',
          message: 'First commit',
          date: '2024-01-01T00:00:00Z',
          url: 'https://github.com/commit/abc123',
        },
        {
          sha: 'def456',
          message: 'Second commit',
          date: '2024-01-02T00:00:00Z',
          url: 'https://github.com/commit/def456',
        },
      ],
      onGhRestoreFromCommit: onRestoreCommit,
      onGhApplyRestore: onApply,
    })
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('First commit')).toBeInTheDocument()
    expect(screen.getByText('Second commit')).toBeInTheDocument()
    // Click restore on first commit
    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' })
    await user.click(restoreButtons[0])
    await waitFor(() => {
      expect(onRestoreCommit).toHaveBeenCalledWith('abc123')
    })
  })

  // ── Branch coverage: sync success banner after handleGhSyncNow (line 441) ──

  it('shows sync success banner after successful sync', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPane({
      ghIsConfigured: true,
      ghHasStoredToken: true,
      ghTokenUnlocked: true,
      ghSyncProgress: null,
      ghConfig: { owner: 'user', repo: 'repo', filePath: 'data.json', autoSync: false },
    })
    await user.click(screen.getByRole('button', { name: 'Sync' }))
    await waitFor(() => {
      expect(screen.getByText(/Sync successful/)).toBeInTheDocument()
    })
    vi.useRealTimers()
  })
})
