import { FC, useState, useEffect } from 'react'
import type { GitHubSyncPaneProps } from '../types'
import type { ConnectionTestResult, SyncDomain } from '../../../hooks/useGitHubSync'
import { formatDate, formatRelative } from '../utils'

const GitHubSyncPane: FC<GitHubSyncPaneProps> = ({
  hasPendingChanges,
  ghConfig,
  ghIsConfigured = false,
  ghSyncStatus = 'idle',
  ghLastSyncAt = null,
  ghLastError = null,
  ghHistory = [],
  ghHasStoredToken = false,
  ghTokenUnlocked = false,
  onGhUpdateConfig = () => {},
  onGhSaveEncryptedToken = async () => ({ ok: false, message: '' }),
  onGhUnlockToken = async () => ({ ok: false, message: '' }),
  onGhLockToken = () => {},
  onGhSyncNow = async () => {},
  onGhFetchHistory = async () => {},
  onGhTestConnection = async () => ({ ok: false, message: '', warnings: [] }),
  onGhRestoreLatest = async () => ({ ok: false, message: '' }),
  onGhRestoreFromCommit = async () => ({ ok: false, message: '' }),
  onGhApplyRestore = async () => {},
  ghData = {},
  ghSyncProgress = null,
}) => {
  const [ghTab, setGhTab] = useState<'config' | 'history'>('config')
  const [ghShowToken, setGhShowToken] = useState(false)
  const [ghTokenInput, setGhTokenInput] = useState('')
  const [ghPassphrase, setGhPassphrase] = useState('')
  const [ghUnlockPassphrase, setGhUnlockPassphrase] = useState('')
  const [ghTestResult, setGhTestResult] = useState<ConnectionTestResult | null>(null)
  const [ghSaveResult, setGhSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [ghRestoreResult, setGhRestoreResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [ghTesting, setGhTesting] = useState(false)
  const [ghRestoring, setGhRestoring] = useState(false)
  const [ghRestoringCommitSha, setGhRestoringCommitSha] = useState<string | null>(null)
  const [ghSavingToken, setGhSavingToken] = useState(false)
  const [ghSyncSuccess, setGhSyncSuccess] = useState(false)
  const [ghShowTokenForm, setGhShowTokenForm] = useState(false)
  const [ghEditingRepo, setGhEditingRepo] = useState(false)
  const [ghUnlockDismissed, setGhUnlockDismissed] = useState(false)

  useEffect(() => {
    if (ghIsConfigured && ghTokenUnlocked && ghHistory.length === 0) onGhFetchHistory?.()
  }, [ghIsConfigured, ghTokenUnlocked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ghSyncSuccess) {
      const timer = setTimeout(() => setGhSyncSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [ghSyncSuccess])

  const handleGhTest = async () => {
    setGhTesting(true)
    setGhTestResult(null)
    const result = await onGhTestConnection?.()
    setGhTestResult(result)
    setGhTesting(false)
  }

  const handleGhSaveToken = async () => {
    setGhSavingToken(true)
    setGhSaveResult(null)
    const result = await onGhSaveEncryptedToken?.(ghTokenInput, ghPassphrase)
    setGhSaveResult(result)
    if (result?.ok) {
      setGhTokenInput('')
      setGhPassphrase('')
    }
    setGhSavingToken(false)
  }

  const handleGhUnlock = async () => {
    const result = await onGhUnlockToken?.(ghUnlockPassphrase)
    if (result?.ok) {
      setGhUnlockPassphrase('')
      setGhSaveResult(null)
    } else setGhSaveResult(result)
  }

  const handleGhSyncNow = async () => {
    const msg = `Synced user data on ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
    await onGhSyncNow?.(ghData, msg)
    // Only show success banner if sync actually ran (not "already up to date")
    if (!ghSyncProgress || ghSyncProgress.total > 0) setGhSyncSuccess(true)
  }

  const handleGhRestoreLatest = async () => {
    setGhRestoring(true)
    setGhRestoreResult(null)
    const result = await onGhRestoreLatest?.()
    if (result?.ok && result?.data) await onGhApplyRestore?.(result.data)
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoring(false)
  }

  const handleGhRestoreCommit = async (commitSha: string) => {
    setGhRestoringCommitSha(commitSha)
    setGhRestoreResult(null)
    const result = await onGhRestoreFromCommit?.(commitSha)
    if (result?.ok && result?.data) await onGhApplyRestore?.(result.data)
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoringCommitSha(null)
  }

  const DOMAIN_LABELS: Record<SyncDomain, string> = {
    goals: 'Goals',
    data: 'Balances',
    tools: 'Tools',
    allocation: 'Allocation',
    taxes: 'Taxes',
    budget: 'Budget',
  }
  const ALL_DOMAINS: SyncDomain[] = ['goals', 'data', 'tools', 'allocation', 'taxes', 'budget']

  return (
    <div className="settings-section">
      <div className="settings-section-content ghsync-section-scroll">
        <div className="ghsync-tabs">
          <button
            onClick={() => setGhTab('config')}
            className={`ghsync-tab-btn${ghTab === 'config' ? ' active' : ''}`}
            aria-current={ghTab === 'config' ? 'page' : undefined}
          >
            Configuration
          </button>
          <button
            onClick={() => {
              setGhTab('history')
              if (ghHistory.length === 0) onGhFetchHistory?.()
            }}
            className={`ghsync-tab-btn${ghTab === 'history' ? ' active' : ''}`}
            aria-current={ghTab === 'history' ? 'page' : undefined}
          >
            History
          </button>
        </div>

        {ghTab === 'config' && (
          <div className="ghsync-field ghsync-field--spaced">
            <div>
              <label className="ghsync-field-label">Token Security</label>
              {!ghHasStoredToken && (
                <p className="ghsync-field-hint" role="status">
                  No token saved yet. Save one encrypted with a passphrase below.
                </p>
              )}
              {ghHasStoredToken && !ghTokenUnlocked && (
                <>
                  <div className="ghsync-token-row">
                    <input
                      className="ghsync-field-input ghsync-token-input"
                      type="password"
                      value={ghUnlockPassphrase}
                      onChange={e => setGhUnlockPassphrase(e.target.value)}
                      placeholder="Passphrase to unlock token"
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleGhUnlock()
                      }}
                    />
                    <button className="ghsync-mini-btn ghsync-unlock-btn" onClick={handleGhUnlock}>
                      Unlock
                    </button>
                  </div>
                  <p className="ghsync-locked-hint">
                    Unlock your token to enable sync, test connection, and edit configuration.
                  </p>
                </>
              )}
              {ghTokenUnlocked && (
                <>
                  {!ghUnlockDismissed && (
                    <div role="status" className="ghsync-token-status">
                      <span>Token unlocked for this session</span>
                      <button
                        onClick={() => setGhUnlockDismissed(true)}
                        className="ghsync-token-dismiss"
                        aria-label="Dismiss"
                      >
                        &times;
                      </button>
                    </div>
                  )}
                  <div className="ghsync-token-actions">
                    <button
                      className="ghsync-mini-btn ghsync-mini-btn--ghost ghsync-mini-btn--sm"
                      onClick={onGhLockToken}
                    >
                      Lock
                    </button>
                    {ghHasStoredToken && !ghShowTokenForm && (
                      <button
                        className="ghsync-mini-btn ghsync-mini-btn--ghost ghsync-mini-btn--sm"
                        onClick={() => setGhShowTokenForm(true)}
                      >
                        Change token
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {ghSaveResult && (
              <p
                role={ghSaveResult.ok ? 'status' : 'alert'}
                className={ghSaveResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'}
              >
                {ghSaveResult.ok ? '✓' : '✗'} {ghSaveResult.message}
              </p>
            )}

            {(ghTokenUnlocked || !ghHasStoredToken) && (
              <>
                {!ghHasStoredToken || ghShowTokenForm ? (
                  <>
                    <div>
                      <label className="ghsync-field-label">{ghHasStoredToken ? 'Replace token' : 'New token'}</label>
                      <div className="ghsync-token-row">
                        <input
                          className="ghsync-field-input ghsync-token-input"
                          type={ghShowToken ? 'text' : 'password'}
                          value={ghTokenInput}
                          onChange={e => setGhTokenInput(e.target.value)}
                          placeholder="github_pat_..."
                          autoComplete="off"
                        />
                        <button className="ghsync-show-toggle" onClick={() => setGhShowToken(v => !v)}>
                          {ghShowToken ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <p className="ghsync-pat-hint">
                        Create a fine-grained PAT at{' '}
                        <a
                          href="https://github.com/settings/tokens?type=beta"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghsync-pat-link"
                        >
                          github.com/settings/tokens
                        </a>{' '}
                        with Contents write access
                      </p>
                    </div>
                    <div>
                      <label className="ghsync-field-label">Passphrase for encryption</label>
                      <input
                        className="ghsync-field-input ghsync-passphrase-input"
                        type="password"
                        value={ghPassphrase}
                        onChange={e => setGhPassphrase(e.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div className="ghsync-save-actions">
                      <button
                        className="ghsync-mini-btn"
                        onClick={handleGhSaveToken}
                        disabled={ghSavingToken || !ghTokenInput || !ghPassphrase}
                      >
                        {ghSavingToken ? 'Saving…' : 'Save Token'}
                      </button>
                      {ghHasStoredToken && (
                        <button
                          className="ghsync-mini-btn ghsync-cancel-btn"
                          onClick={() => {
                            setGhShowTokenForm(false)
                            setGhTokenInput('')
                            setGhPassphrase('')
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                ) : ghTokenUnlocked ? null : (
                  <button className="ghsync-mini-btn ghsync-mini-btn--ghost" onClick={() => setGhShowTokenForm(true)}>
                    Change token
                  </button>
                )}

                {ghConfig?.owner && ghConfig?.repo && !ghEditingRepo ? (
                  <div className="ghsync-repo-info">
                    <span className="ghsync-repo-info-text">
                      <span className="ghsync-repo-label">Repo:</span>
                      <strong className="ghsync-repo-value">
                        {ghConfig.owner}/{ghConfig.repo}
                      </strong>
                    </span>
                    <button
                      className="ghsync-mini-btn ghsync-mini-btn--ghost ghsync-mini-btn--sm"
                      onClick={() => setGhEditingRepo(true)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghsync-mini-btn ghsync-mini-btn--ghost ghsync-mini-btn--sm"
                      onClick={handleGhTest}
                      disabled={ghTesting || !ghTokenUnlocked}
                    >
                      {ghTesting ? 'Testing…' : 'Test'}
                    </button>
                    {ghTestResult?.ok && <span className="ghsync-connected-badge">Connected</span>}
                  </div>
                ) : (
                  <div className="ghsync-repo-grid">
                    <div className="ghsync-field">
                      <label className="ghsync-field-label">Owner</label>
                      <input
                        className="ghsync-field-input"
                        type="text"
                        value={ghConfig?.owner || ''}
                        onChange={e => {
                          onGhUpdateConfig?.({ owner: e.target.value })
                          setGhTestResult(null)
                          if (!ghEditingRepo) setGhEditingRepo(true)
                        }}
                        placeholder="your-github-username"
                      />
                    </div>
                    <div className="ghsync-field">
                      <label className="ghsync-field-label">Repository</label>
                      <input
                        className="ghsync-field-input"
                        type="text"
                        value={ghConfig?.repo || ''}
                        onChange={e => {
                          onGhUpdateConfig?.({ repo: e.target.value })
                          setGhTestResult(null)
                          if (!ghEditingRepo) setGhEditingRepo(true)
                        }}
                        placeholder="finance-backups"
                      />
                    </div>
                    {ghConfig?.owner && ghConfig?.repo && (
                      <button className="ghsync-mini-btn ghsync-repo-cancel" onClick={() => setGhEditingRepo(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                <label className="ghsync-autosync-label ghsync-autosync-label--sm">
                  <input
                    type="checkbox"
                    checked={ghConfig?.autoSync || false}
                    onChange={e => onGhUpdateConfig?.({ autoSync: e.target.checked })}
                  />
                  Auto-sync (commits ~60 seconds after any change)
                </label>

                <div className="ghsync-sync-row">
                  <div className="ghsync-status-bar ghsync-status-bar--inline">
                    {ghSyncStatus === 'syncing' && (
                      <>
                        <span className="ghsync-spinner" />
                        Syncing…
                      </>
                    )}
                    {ghSyncStatus === 'success' && ghLastSyncAt && (
                      <>
                        <span className="ghsync-status-dot ghsync-status-dot--success">●</span>
                        Last synced {formatRelative(ghLastSyncAt)} · {formatDate(ghLastSyncAt)}
                        {hasPendingChanges && <span className="ghsync-unsaved-label">unsaved changes</span>}
                      </>
                    )}
                    {ghSyncStatus === 'error' && (
                      <>
                        <span className="ghsync-status-dot ghsync-status-dot--error">●</span>
                        Sync failed: {ghLastError}
                      </>
                    )}
                    {ghSyncStatus === 'idle' && (
                      <>
                        <span className="ghsync-status-dot ghsync-status-dot--idle">●</span>
                        {ghConfig?.owner && ghConfig?.repo
                          ? hasPendingChanges
                            ? 'Unsaved changes — sync when ready'
                            : ghHasStoredToken
                              ? ghTokenUnlocked
                                ? 'Ready to sync'
                                : 'Token locked'
                              : 'Token not set up'
                          : 'Missing configuration'}
                      </>
                    )}
                  </div>
                  {hasPendingChanges && ghSyncStatus !== 'syncing' && <span className="ghsync-dirty-dot" />}
                  <button
                    className="ghsync-mini-btn ghsync-sync-btn ghsync-sync-now-btn"
                    onClick={handleGhSyncNow}
                    disabled={!ghIsConfigured || ghSyncStatus === 'syncing'}
                    title="Sync current goal data to GitHub"
                  >
                    {ghSyncStatus === 'syncing' ? 'Syncing…' : 'Sync'}
                  </button>
                </div>

                {ghSyncProgress && ghSyncProgress.total === 0 && (
                  <p className="ghsync-result-success ghsync-result-msg">✓ Already up to date</p>
                )}
                {ghSyncProgress && ghSyncProgress.total > 0 && (
                  <div className="ghsync-progress ghsync-progress--spaced" role="status" aria-label="Sync progress">
                    <ul className="ghsync-progress-list" aria-live="polite">
                      {(ghSyncProgress.domains || ALL_DOMAINS).map((domain, idx) => {
                        const isError = ghSyncProgress.errors.some(e => e.startsWith(DOMAIN_LABELS[domain]))
                        const isDone =
                          !isError && ghSyncProgress.current !== DOMAIN_LABELS[domain] && idx < ghSyncProgress.completed
                        const isActive = ghSyncProgress.current === DOMAIN_LABELS[domain]
                        const stateClass = isError ? 'error' : isDone ? 'done' : isActive ? 'active' : 'pending'
                        return (
                          <li key={domain} className={`ghsync-progress-item ghsync-progress-item--${stateClass}`}>
                            <span className="ghsync-progress-icon" aria-hidden="true">
                              {isError ? '✕' : isDone ? '✓' : isActive ? '' : '·'}
                            </span>
                            <span>{DOMAIN_LABELS[domain]}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {ghSyncProgress.completed === ghSyncProgress.total && ghSyncProgress.errors.length === 0 && (
                      <p className="ghsync-result-success ghsync-result-msg--sm">✓ All synced</p>
                    )}
                    {ghSyncProgress.errors.length > 0 && (
                      <div className="ghsync-errors-wrap">
                        {ghSyncProgress.errors.map((err, i) => (
                          <p key={i} className="ghsync-result-error ghsync-error-line">
                            ✕ {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!ghSyncProgress && ghSyncSuccess && (
                  <p className="ghsync-result-success ghsync-result-msg">✓ Sync successful</p>
                )}

                {ghTestResult && !ghTestResult.ok && (
                  <p role="alert" className="ghsync-result-error">
                    ✗ {ghTestResult.message}
                  </p>
                )}
                {ghTestResult?.warnings?.length ? (
                  <div className="ghsync-warning-box">
                    {ghTestResult.warnings.map(w => (
                      <p key={w} className="ghsync-warning-item">
                        ⚠ {w}
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {ghTab === 'history' && (
          <div>
            <button
              className="ghsync-mini-btn ghsync-restore-btn--spaced"
              onClick={handleGhRestoreLatest}
              disabled={!ghIsConfigured || ghRestoring}
            >
              {ghRestoring ? 'Restoring…' : 'Restore Latest'}
            </button>
            {ghRestoreResult && (
              <p
                role={ghRestoreResult.ok ? 'status' : 'alert'}
                className={`${ghRestoreResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'} ghsync-restore-result--spaced`}
              >
                {ghRestoreResult.ok ? '✓' : '✗'} {ghRestoreResult.message}
              </p>
            )}
            {!ghIsConfigured ? (
              <p className="ghsync-history-empty">Connect and unlock token to view history.</p>
            ) : ghHistory.length === 0 ? (
              <p className="ghsync-field-hint">No commits yet for this file.</p>
            ) : (
              <div className="ghsync-commit-list">
                {ghHistory.map(c => (
                  <div key={c.sha} className="ghsync-commit-item">
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="ghsync-commit-link">
                      <span className="ghsync-commit-date">{formatRelative(c.date)}</span>
                      <span className="ghsync-commit-message">{c.message}</span>
                    </a>
                    <button
                      className="ghsync-mini-btn ghsync-commit-restore-btn ghsync-commit-restore"
                      onClick={() => handleGhRestoreCommit(c.sha)}
                      disabled={ghRestoring || ghRestoringCommitSha === c.sha}
                    >
                      {ghRestoringCommitSha === c.sha ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GitHubSyncPane
