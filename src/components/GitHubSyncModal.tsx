import { FC, useState, useEffect, useCallback } from 'react'
import { GitHubSyncConfig, CommitEntry, SyncStatus, ConnectionTestResult, RestoreResult } from '../hooks/useGitHubSync'
import '../styles/GitHubSyncModal.css'

interface GitHubSyncModalProps {
  config: GitHubSyncConfig
  syncStatus: SyncStatus
  lastSyncAt: string | null
  lastError: string | null
  hasPendingChanges: boolean
  history: CommitEntry[]
  isConfigured: boolean
  hasStoredToken: boolean
  tokenUnlocked: boolean
  usingLegacyToken: boolean
  onUpdateConfig: (updates: Partial<GitHubSyncConfig>) => void
  onSaveEncryptedToken: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>
  onMigrateLegacyToken: (passphrase: string) => Promise<{ ok: boolean; message: string }>
  onUnlockToken: (passphrase: string) => Promise<{ ok: boolean; message: string }>
  onLockToken: () => void
  onSyncNow: (data: object, message?: string) => Promise<void>
  onFetchHistory: () => Promise<void>
  onTestConnection: () => Promise<ConnectionTestResult>
  onRestoreLatest: () => Promise<RestoreResult>
  onClose: () => void
  data: object
  onApplyRestore: (data: unknown) => void
}

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const GitHubSyncModal: FC<GitHubSyncModalProps> = ({
  config, syncStatus, lastSyncAt, lastError, hasPendingChanges, history,
  isConfigured, hasStoredToken, tokenUnlocked, usingLegacyToken,
  onUpdateConfig, onSaveEncryptedToken, onMigrateLegacyToken,
  onUnlockToken, onLockToken, onSyncNow, onFetchHistory,
  onTestConnection, onRestoreLatest, onClose, data, onApplyRestore,
}) => {
  const [tab, setTab] = useState<'config' | 'history'>('config')
  const [showToken, setShowToken] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [unlockPassphrase, setUnlockPassphrase] = useState('')
  const [commitMsg, setCommitMsg] = useState('')
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [savingToken, setSavingToken] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    if (tab === 'history' && isConfigured) onFetchHistory()
  }, [tab, isConfigured, onFetchHistory])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await onTestConnection()
    setTestResult(result)
    setTesting(false)
  }

  const handleSaveToken = async () => {
    setSavingToken(true)
    setSaveResult(null)
    const result = await onSaveEncryptedToken(tokenInput, passphrase)
    setSaveResult(result)
    if (result.ok) {
      setTokenInput('')
      setPassphrase('')
    }
    setSavingToken(false)
  }

  const handleMigrateLegacy = async () => {
    setSavingToken(true)
    setSaveResult(null)
    const result = await onMigrateLegacyToken(passphrase)
    setSaveResult(result)
    if (result.ok) setPassphrase('')
    setSavingToken(false)
  }

  const handleUnlock = async () => {
    const result = await onUnlockToken(unlockPassphrase)
    setSaveResult(result)
    if (result.ok) setUnlockPassphrase('')
  }

  const handleSyncNow = useCallback(async () => {
    await onSyncNow(data, commitMsg.trim() || undefined)
    setCommitMsg('')
  }, [onSyncNow, data, commitMsg])

  const handleRestoreLatest = async () => {
    setRestoring(true)
    setRestoreResult(null)
    const result = await onRestoreLatest()
    if (result.ok && result.data) {
      onApplyRestore(result.data)
    }
    setRestoreResult({ ok: result.ok, message: result.message })
    setRestoring(false)
  }

  const syncing = syncStatus === 'syncing'

  return (
    <div className="ghsync-backdrop" onClick={onClose}>
      <div className="ghsync-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ghsync-header">
          <div className="ghsync-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>GitHub Sync</span>
          </div>
          <button className="ghsync-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={`ghsync-status-bar ghsync-status-bar--${syncStatus}`}>
          {syncStatus === 'syncing' && <><span className="ghsync-spinner" />Syncing…</>}
          {syncStatus === 'success' && lastSyncAt && <>
            <span className="ghsync-dot ghsync-dot--green" />
            Last synced {formatRelative(lastSyncAt)} · {formatDate(lastSyncAt)}
            {hasPendingChanges && <span className="ghsync-pending-badge">unsaved changes</span>}
          </>}
          {syncStatus === 'error' && <>
            <span className="ghsync-dot ghsync-dot--red" />
            Sync failed: {lastError}
          </>}
          {syncStatus === 'idle' && <>
            <span className="ghsync-dot ghsync-dot--gray" />
            {isConfigured ? (hasPendingChanges ? 'Unsaved changes — sync when ready' : 'Ready to sync') : 'Not configured'}
          </>}
        </div>

        <div className="ghsync-tabs">
          <button className={`ghsync-tab${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>Configuration</button>
          <button className={`ghsync-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>

        <div className="ghsync-body">
          {tab === 'config' && (
            <div className="ghsync-config">
              <div className="ghsync-notice">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="7.25" y="7" width="1.5" height="5" rx=".75" fill="currentColor"/>
                  <rect x="7.25" y="4" width="1.5" height="1.5" rx=".75" fill="currentColor"/>
                </svg>
                <span>Requires a <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer">fine-grained PAT</a> with <strong>Contents: Read &amp; Write</strong> scoped to this repo only.</span>
              </div>

              <div className="ghsync-field">
                <label className="ghsync-label">Token Security</label>
                {!hasStoredToken && <p className="ghsync-hint">No token saved yet. Save one encrypted with a passphrase.</p>}
                {hasStoredToken && !tokenUnlocked && (
                  <div className="ghsync-unlock-row">
                    <input
                      className="ghsync-input"
                      type="password"
                      value={unlockPassphrase}
                      onChange={e => setUnlockPassphrase(e.target.value)}
                      placeholder="Passphrase to unlock token"
                    />
                    <button className="ghsync-btn ghsync-btn--outline" onClick={handleUnlock}>Unlock</button>
                  </div>
                )}
                {tokenUnlocked && (
                  <div className="ghsync-unlocked-pill">
                    Token unlocked for this session
                    {!usingLegacyToken && <button className="ghsync-link-btn" onClick={onLockToken}>Lock</button>}
                  </div>
                )}
              </div>

              <div className="ghsync-field">
                <label className="ghsync-label">New / replacement token</label>
                <div className="ghsync-token-row">
                  <input
                    className="ghsync-input"
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="github_pat_..."
                    autoComplete="off"
                  />
                  <button className="ghsync-token-toggle" onClick={() => setShowToken(v => !v)} type="button">
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="ghsync-field">
                <label className="ghsync-label">Passphrase for encryption</label>
                <input
                  className="ghsync-input"
                  type="password"
                  value={passphrase}
                  onChange={e => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="ghsync-test-row">
                <button className="ghsync-btn ghsync-btn--outline" onClick={handleSaveToken} disabled={savingToken || !tokenInput || !passphrase}>
                  {savingToken ? 'Saving…' : 'Save Encrypted Token'}
                </button>
                {usingLegacyToken && (
                  <button className="ghsync-btn ghsync-btn--outline" onClick={handleMigrateLegacy} disabled={savingToken || !passphrase}>
                    Encrypt Legacy Token
                  </button>
                )}
              </div>

              {saveResult && (
                <p className={`ghsync-test-result ${saveResult.ok ? 'ghsync-test-result--ok' : 'ghsync-test-result--err'}`}>
                  {saveResult.ok ? '✓' : '✗'} {saveResult.message}
                </p>
              )}

              <div className="ghsync-row">
                <div className="ghsync-field">
                  <label className="ghsync-label">Owner (username or org)</label>
                  <input className="ghsync-input" type="text" value={config.owner} onChange={e => { onUpdateConfig({ owner: e.target.value }); setTestResult(null) }} placeholder="your-github-username" />
                </div>
                <div className="ghsync-field">
                  <label className="ghsync-label">Repository</label>
                  <input className="ghsync-input" type="text" value={config.repo} onChange={e => { onUpdateConfig({ repo: e.target.value }); setTestResult(null) }} placeholder="finance-backups" />
                </div>
              </div>

              <div className="ghsync-field">
                <label className="ghsync-label">File path in repo</label>
                <input className="ghsync-input" type="text" value={config.filePath} onChange={e => onUpdateConfig({ filePath: e.target.value })} placeholder="finance-plans.json" />
              </div>

              <div className="ghsync-autosync-row">
                <label className="ghsync-autosync-label">
                  <input type="checkbox" checked={config.autoSync} onChange={e => onUpdateConfig({ autoSync: e.target.checked })} />
                  Auto-sync (commits ~60 seconds after any change)
                </label>
              </div>

              <div className="ghsync-test-row">
                <button className="ghsync-btn ghsync-btn--outline" onClick={handleTest} disabled={testing}>{testing ? 'Testing…' : 'Test Connection'}</button>
                {testResult && (
                  <span className={`ghsync-test-result ${testResult.ok ? 'ghsync-test-result--ok' : 'ghsync-test-result--err'}`}>
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                  </span>
                )}
              </div>

              {testResult?.warnings?.length ? (
                <div className="ghsync-warning-list">
                  {testResult.warnings.map(w => <p key={w} className="ghsync-warning-item">⚠ {w}</p>)}
                </div>
              ) : null}

              <div className="ghsync-divider" />

              <div className="ghsync-sync-section">
                <p className="ghsync-sync-label">Commit message (optional)</p>
                <div className="ghsync-sync-row">
                  <input
                    className="ghsync-input ghsync-input--grow"
                    type="text"
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    placeholder="e.g. Updated retirement age"
                    onKeyDown={e => { if (e.key === 'Enter' && isConfigured && !syncing) handleSyncNow() }}
                  />
                  <button className="ghsync-btn ghsync-btn--primary" onClick={handleSyncNow} disabled={!isConfigured || syncing}>
                    {syncing ? <><span className="ghsync-spinner ghsync-spinner--sm" />Syncing</> : 'Sync Now'}
                  </button>
                </div>
                {!isConfigured && <p className="ghsync-hint">Unlock token and configure repository first.</p>}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="ghsync-history">
              <div className="ghsync-restore-row">
                <button className="ghsync-btn ghsync-btn--outline" onClick={handleRestoreLatest} disabled={!isConfigured || restoring}>
                  {restoring ? 'Restoring…' : 'Restore Latest From GitHub'}
                </button>
              </div>
              {restoreResult && (
                <p className={`ghsync-test-result ${restoreResult.ok ? 'ghsync-test-result--ok' : 'ghsync-test-result--err'}`}>
                  {restoreResult.ok ? '✓' : '✗'} {restoreResult.message}
                </p>
              )}
              {!isConfigured ? (
                <p className="ghsync-hint">Connect and unlock token to view history.</p>
              ) : history.length === 0 ? (
                <p className="ghsync-hint">No commits yet for this file.</p>
              ) : (
                <div className="ghsync-commits">
                  {history.map(c => (
                    <a key={c.sha} href={c.url} target="_blank" rel="noopener noreferrer" className="ghsync-commit">
                      <div className="ghsync-commit-top">
                        <span className="ghsync-commit-sha">{c.sha}</span>
                        <span className="ghsync-commit-date">{formatDate(c.date)}</span>
                      </div>
                      <div className="ghsync-commit-msg">{c.message}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GitHubSyncModal
