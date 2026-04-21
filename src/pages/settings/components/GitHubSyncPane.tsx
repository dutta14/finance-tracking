import { FC, useState, useEffect } from 'react'
import type { GitHubSyncPaneProps } from '../types'
import type { ConnectionTestResult } from '../../../hooks/useGitHubSync'
import { formatDate, formatRelative } from '../utils'

const GitHubSyncPane: FC<GitHubSyncPaneProps> = ({
  hasPendingChanges,
  ghConfig, ghIsConfigured = false,
  ghSyncStatus = 'idle', ghLastSyncAt = null, ghLastError = null, ghHistory = [],
  ghHasStoredToken = false, ghTokenUnlocked = false, ghUsingLegacyToken = false,
  onGhUpdateConfig = () => {}, onGhSaveEncryptedToken = async () => ({ ok: false, message: '' }),
  onGhMigrateLegacyToken = async () => ({ ok: false, message: '' }),
  onGhUnlockToken = async () => ({ ok: false, message: '' }), onGhLockToken = () => {},
  onGhSyncNow = async () => {}, onGhFetchHistory = async () => {},
  onGhTestConnection = async () => ({ ok: false, message: '', warnings: [] }),
  onGhRestoreLatest = async () => ({ ok: false, message: '' }),
  onGhRestoreFromCommit = async () => ({ ok: false, message: '' }),
  onGhApplyRestore = async () => {}, ghData = {},
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
    setGhTesting(true); setGhTestResult(null)
    const result = await onGhTestConnection?.()
    setGhTestResult(result); setGhTesting(false)
  }

  const handleGhSaveToken = async () => {
    setGhSavingToken(true); setGhSaveResult(null)
    const result = await onGhSaveEncryptedToken?.(ghTokenInput, ghPassphrase)
    setGhSaveResult(result)
    if (result?.ok) { setGhTokenInput(''); setGhPassphrase('') }
    setGhSavingToken(false)
  }

  const handleGhMigrateLegacy = async () => {
    setGhSavingToken(true); setGhSaveResult(null)
    const result = await onGhMigrateLegacyToken?.(ghPassphrase)
    setGhSaveResult(result); setGhSavingToken(false)
  }

  const handleGhUnlock = async () => {
    const result = await onGhUnlockToken?.(ghUnlockPassphrase)
    if (result?.ok) { setGhUnlockPassphrase(''); setGhSaveResult(null) }
    else setGhSaveResult(result)
  }

  const handleGhSyncNow = async () => {
    const msg = `Synced user data on ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
    await onGhSyncNow?.(ghData, msg)
    setGhSyncSuccess(true)
  }

  const handleGhRestoreLatest = async () => {
    setGhRestoring(true); setGhRestoreResult(null)
    const result = await onGhRestoreLatest?.()
    if (result?.ok && result?.data) await onGhApplyRestore?.(result.data)
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoring(false)
  }

  const handleGhRestoreCommit = async (commitSha: string) => {
    setGhRestoringCommitSha(commitSha); setGhRestoreResult(null)
    const result = await onGhRestoreFromCommit?.(commitSha)
    if (result?.ok && result?.data) await onGhApplyRestore?.(result.data)
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoringCommitSha(null)
  }

  return (
    <div className="settings-section">
      <div className="settings-section-content" style={{ overflow: 'auto', maxHeight: '60vh' }}>        {ghSyncSuccess && (
          <p className="ghsync-result-success" style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>✓ Sync successful</p>
        )}

        <div className="ghsync-tabs">
          <button onClick={() => setGhTab('config')} className={`ghsync-tab-btn${ghTab === 'config' ? ' active' : ''}`}>Configuration</button>
          <button onClick={() => { setGhTab('history'); if (ghHistory.length === 0) onGhFetchHistory?.() }} className={`ghsync-tab-btn${ghTab === 'history' ? ' active' : ''}`}>History</button>
        </div>

        {ghTab === 'config' && (
          <div className="ghsync-field" style={{ gap: '1rem' }}>
            <div>
              <label className="ghsync-field-label">Token Security</label>
              {!ghHasStoredToken && <p className="ghsync-field-hint">No token saved yet. Save one encrypted with a passphrase below.</p>}
              {ghHasStoredToken && !ghTokenUnlocked && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="ghsync-field-input" style={{ flex: 1 }} type="password" value={ghUnlockPassphrase} onChange={e => setGhUnlockPassphrase(e.target.value)} placeholder="Passphrase to unlock token" onKeyDown={e => { if (e.key === 'Enter') handleGhUnlock() }} />
                    <button className="ghsync-mini-btn" onClick={handleGhUnlock} style={{ minWidth: '80px' }}>Unlock</button>
                  </div>
                  <p className="ghsync-locked-hint">Unlock your token to enable sync, test connection, and edit configuration.</p>
                </>
              )}
              {ghTokenUnlocked && (
                <>
                  {!ghUnlockDismissed && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.4rem', padding: '0.35rem 0.65rem', fontSize: '0.85rem', color: 'var(--color-positive)' }}>
                      <span>Token unlocked for this session</span>
                      <button onClick={() => setGhUnlockDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-positive)', opacity: 0.7, padding: '0 0.15rem', fontSize: '1rem', lineHeight: 1 }} aria-label="Dismiss">&times;</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {!ghUsingLegacyToken && <button className="ghsync-mini-btn ghsync-mini-btn--ghost" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }} onClick={onGhLockToken}>Lock</button>}
                    {ghHasStoredToken && !ghShowTokenForm && <button className="ghsync-mini-btn ghsync-mini-btn--ghost" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }} onClick={() => setGhShowTokenForm(true)}>Change token</button>}
                  </div>
                </>
              )}
            </div>

            {ghSaveResult && (
              <p className={ghSaveResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'}>{ghSaveResult.ok ? '✓' : '✗'} {ghSaveResult.message}</p>
            )}

            {(ghTokenUnlocked || !ghHasStoredToken) && (
              <>
                {(!ghHasStoredToken || ghShowTokenForm) ? (
                  <>
                    <div>
                      <label className="ghsync-field-label">{ghHasStoredToken ? 'Replace token' : 'New token'}</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input className="ghsync-field-input" style={{ flex: 1 }} type={ghShowToken ? 'text' : 'password'} value={ghTokenInput} onChange={e => setGhTokenInput(e.target.value)} placeholder="github_pat_..." autoComplete="off" />
                        <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setGhShowToken(v => !v)}>{ghShowToken ? 'Hide' : 'Show'}</button>
                      </div>
                      <p className="ghsync-pat-hint">Create a fine-grained PAT at <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>github.com/settings/tokens</a> with Contents write access</p>
                    </div>
                    <div>
                      <label className="ghsync-field-label">Passphrase for encryption</label>
                      <input className="ghsync-field-input" style={{ width: '100%' }} type="password" value={ghPassphrase} onChange={e => setGhPassphrase(e.target.value)} placeholder="At least 8 characters" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="ghsync-mini-btn" onClick={handleGhSaveToken} disabled={ghSavingToken || !ghTokenInput || !ghPassphrase}>{ghSavingToken ? 'Saving…' : 'Save Token'}</button>
                      {ghHasStoredToken && (
                        <button className="ghsync-mini-btn" style={{ background: 'transparent', color: '#6b7280' }} onClick={() => { setGhShowTokenForm(false); setGhTokenInput(''); setGhPassphrase('') }}>Cancel</button>
                      )}
                      {ghUsingLegacyToken && (
                        <button className="ghsync-mini-btn" onClick={handleGhMigrateLegacy} disabled={ghSavingToken || !ghPassphrase}>Encrypt Legacy</button>
                      )}
                    </div>
                  </>
                ) : ghTokenUnlocked ? null : (
                  <button className="ghsync-mini-btn ghsync-mini-btn--ghost" onClick={() => setGhShowTokenForm(true)}>Change token</button>
                )}

                {ghConfig?.owner && ghConfig?.repo && !ghEditingRepo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: '#6b7280', marginRight: '0.25rem' }}>Repo:</span>
                      <strong style={{ color: 'var(--color-text)' }}>{ghConfig.owner}/{ghConfig.repo}</strong>
                    </span>
                    <button className="ghsync-mini-btn ghsync-mini-btn--ghost" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }} onClick={() => setGhEditingRepo(true)}>Edit</button>
                    <button className="ghsync-mini-btn ghsync-mini-btn--ghost" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }} onClick={handleGhTest} disabled={ghTesting || !ghTokenUnlocked}>{ghTesting ? 'Testing…' : 'Test'}</button>
                    {ghTestResult?.ok && <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(34,197,94,0.15)', color: 'var(--color-positive)', fontWeight: 600 }}>Connected</span>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="ghsync-field">
                      <label className="ghsync-field-label">Owner</label>
                      <input className="ghsync-field-input" type="text" value={ghConfig?.owner || ''} onChange={e => { onGhUpdateConfig?.({ owner: e.target.value }); setGhTestResult(null); if (!ghEditingRepo) setGhEditingRepo(true) }} placeholder="your-github-username" />
                    </div>
                    <div className="ghsync-field">
                      <label className="ghsync-field-label">Repository</label>
                      <input className="ghsync-field-input" type="text" value={ghConfig?.repo || ''} onChange={e => { onGhUpdateConfig?.({ repo: e.target.value }); setGhTestResult(null); if (!ghEditingRepo) setGhEditingRepo(true) }} placeholder="finance-backups" />
                    </div>
                    {ghConfig?.owner && ghConfig?.repo && (
                      <button className="ghsync-mini-btn" style={{ background: 'transparent', color: '#6b7280', gridColumn: 'span 2', justifySelf: 'start' }} onClick={() => setGhEditingRepo(false)}>Cancel</button>
                    )}
                  </div>
                )}

                <label className="ghsync-autosync-label" style={{ fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={ghConfig?.autoSync || false} onChange={e => onGhUpdateConfig?.({ autoSync: e.target.checked })} />
                  Auto-sync (commits ~60 seconds after any change)
                </label>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <div className="ghsync-status-bar" style={{ margin: 0, flex: 1, fontSize: '0.8rem' }}>
                    {ghSyncStatus === 'syncing' && <><span className="ghsync-spinner" />Syncing…</>}
                    {ghSyncStatus === 'success' && ghLastSyncAt && <>
                      <span style={{ color: '#10b981', marginRight: '0.5rem' }}>●</span>
                      Last synced {formatRelative(ghLastSyncAt)} · {formatDate(ghLastSyncAt)}
                      {hasPendingChanges && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>unsaved changes</span>}
                    </>}
                    {ghSyncStatus === 'error' && <>
                      <span style={{ color: '#ef4444', marginRight: '0.5rem' }}>●</span>
                      Sync failed: {ghLastError}
                    </>}
                    {ghSyncStatus === 'idle' && <>
                      <span style={{ color: '#9ca3af', marginRight: '0.5rem' }}>●</span>
                      {ghConfig?.owner && ghConfig?.repo ? (hasPendingChanges ? 'Unsaved changes — sync when ready' : (ghHasStoredToken ? (ghTokenUnlocked ? 'Ready to sync' : 'Token locked') : 'Token not set up')) : 'Missing configuration'}
                    </>}
                  </div>
                  <button
                    className="ghsync-mini-btn"
                    onClick={handleGhSyncNow}
                    disabled={!ghIsConfigured || ghSyncStatus === 'syncing'}
                    style={{ minWidth: '70px', flexShrink: 0, marginLeft: '0.75rem' }}
                    title="Sync current goal data to GitHub"
                  >
                    {ghSyncStatus === 'syncing' ? 'Syncing…' : 'Sync'}
                  </button>
                </div>

                {ghTestResult && !ghTestResult.ok && (
                  <p className="ghsync-result-error">✗ {ghTestResult.message}</p>
                )}
                {ghTestResult?.warnings?.length ? (
                  <div className="ghsync-warning-box">{ghTestResult.warnings.map(w => <p key={w} className="ghsync-warning-item">⚠ {w}</p>)}</div>
                ) : null}
              </>
            )}
          </div>
        )}

        {ghTab === 'history' && (
          <div>
            <button className="ghsync-mini-btn" onClick={handleGhRestoreLatest} disabled={!ghIsConfigured || ghRestoring} style={{ marginBottom: '1rem' }}>{ghRestoring ? 'Restoring…' : 'Restore Latest'}</button>
            {ghRestoreResult && (
              <p className={ghRestoreResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'} style={{ marginBottom: '1rem' }}>{ghRestoreResult.ok ? '✓' : '✗'} {ghRestoreResult.message}</p>
            )}
            {!ghIsConfigured ? (
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Connect and unlock token to view history.</p>
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
                    <button className="ghsync-mini-btn ghsync-commit-restore-btn" onClick={() => handleGhRestoreCommit(c.sha)} disabled={ghRestoring || ghRestoringCommitSha === c.sha} style={{ minWidth: '70px' }}>
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
