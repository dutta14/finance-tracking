import { FC, useState, useRef, useEffect } from 'react'
import { Profile } from '../hooks/useProfile'
import { GitHubSyncConfig, SyncStatus, CommitEntry, ConnectionTestResult, RestoreResult } from '../hooks/useGitHubSync'
import '../styles/SettingsModal.css'

interface SettingsModalProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
  hasPendingChanges: boolean
  fiTheme?: string
  onFiThemeChange?: (theme: string) => void
  gwTheme?: string
  onGwThemeChange?: (theme: string) => void
  homeTheme?: string
  onHomeThemeChange?: (theme: string) => void
  ghConfig?: GitHubSyncConfig
  ghIsConfigured?: boolean
  ghSyncStatus?: SyncStatus
  ghLastSyncAt?: string | null
  ghLastError?: string | null
  ghHistory?: CommitEntry[]
  ghHasStoredToken?: boolean
  ghTokenUnlocked?: boolean
  ghUsingLegacyToken?: boolean
  onGhUpdateConfig?: (updates: Partial<GitHubSyncConfig>) => void
  onGhSaveEncryptedToken?: (token: string, passphrase: string) => Promise<{ ok: boolean; message: string }>
  onGhMigrateLegacyToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>
  onGhUnlockToken?: (passphrase: string) => Promise<{ ok: boolean; message: string }>
  onGhLockToken?: () => void
  onGhSyncNow?: (data: object, message?: string) => Promise<void>
  onGhFetchHistory?: () => Promise<void>
  onGhTestConnection?: () => Promise<ConnectionTestResult>
  onGhRestoreLatest?: () => Promise<RestoreResult>
  onGhRestoreFromCommit?: (commitSha: string) => Promise<RestoreResult>
  onGhApplyRestore?: (data: unknown) => Promise<void>
  ghData?: object
  onFactoryReset?: () => void
  allowCsvImport?: boolean
  onToggleAllowCsvImport?: () => void
  onExport?: () => void
  onImport?: (file: File) => void
  onClose?: () => void
}

type SettingsSection = 'profile' | 'github' | 'appearance' | 'advanced'

const COLOR_PALETTES = [
  { id: 'blue',   label: 'Blue',   color: '#3b82f6' },
  { id: 'green',  label: 'Green',  color: '#22c55e' },
  { id: 'red',    label: 'Red',    color: '#ef4444' },
  { id: 'amber',  label: 'Amber',  color: '#f59e0b' },
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'orange', label: 'Orange', color: '#f97316' },
  { id: 'teal',   label: 'Teal',   color: '#14b8a6' },
  { id: 'rose',   label: 'Rose',   color: '#f43f5e' },
  { id: 'slate',  label: 'Slate',  color: '#64748b' },
]

const SettingsModal: FC<SettingsModalProps> = ({
  darkMode, onToggleDarkMode, profile, onUpdateProfile,
  hasPendingChanges = false, fiTheme = 'blue', onFiThemeChange = () => {}, gwTheme = 'green', onGwThemeChange = () => {}, homeTheme = 'blue', onHomeThemeChange = () => {},
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
  onGhApplyRestore = async () => {}, ghData = {}, onFactoryReset = () => {}, allowCsvImport = false, onToggleAllowCsvImport = () => {}, onExport = () => {}, onImport = () => {}, onClose = () => {},
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [accentTarget, setAccentTarget] = useState<'home' | 'fi' | 'gw'>('home')
  const [name, setName] = useState(profile.name || '')
  const [birthday, setBirthday] = useState(profile.birthday || '')
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarDataUrl || '')
  const [hasPartner, setHasPartner] = useState(!!profile.partner)
  const [partnerName, setPartnerName] = useState(profile.partner?.name || '')
  const [partnerBirthday, setPartnerBirthday] = useState(profile.partner?.birthday || '')
  const [partnerAvatarPreview, setPartnerAvatarPreview] = useState(profile.partner?.avatarDataUrl || '')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileEditing, setProfileEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const partnerFileInputRef = useRef<HTMLInputElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)
  
  // GitHub Sync state
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

  useEffect(() => {
    if (activeSection === 'github' && ghHistory.length === 0) {
      onGhFetchHistory?.()
    }
  }, [activeSection, ghHistory.length, onGhFetchHistory])

  useEffect(() => {
    if (ghSyncSuccess) {
      const timer = setTimeout(() => setGhSyncSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [ghSyncSuccess])

  const handleProfileSave = () => {
    onUpdateProfile({
      name: name.trim(),
      birthday,
      avatarDataUrl: avatarPreview,
      partner: hasPartner ? { name: partnerName.trim(), birthday: partnerBirthday, avatarDataUrl: partnerAvatarPreview } : null,
    })
    setProfileEditing(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const handleProfileCancel = () => {
    setName(profile.name || '')
    setBirthday(profile.birthday || '')
    setAvatarPreview(profile.avatarDataUrl || '')
    setHasPartner(!!profile.partner)
    setPartnerName(profile.partner?.name || '')
    setPartnerBirthday(profile.partner?.birthday || '')
    setPartnerAvatarPreview(profile.partner?.avatarDataUrl || '')
    setProfileEditing(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setAvatarPreview(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePartnerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setPartnerAvatarPreview(dataUrl)
      }
      reader.readAsDataURL(file)
    }
  }

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

  const handleGhMigrateLegacy = async () => {
    setGhSavingToken(true)
    setGhSaveResult(null)
    const result = await onGhMigrateLegacyToken?.(ghPassphrase)
    setGhSaveResult(result)
    setGhSavingToken(false)
  }

  const handleGhUnlock = async () => {
    const result = await onGhUnlockToken?.(ghUnlockPassphrase)
    setGhSaveResult(result)
    if (result?.ok) setGhUnlockPassphrase('')
  }

  const handleGhSyncNow = async () => {
    await onGhSyncNow?.(ghData)
    setGhSyncSuccess(true)
  }

  const handleGhRestoreLatest = async () => {
    setGhRestoring(true)
    setGhRestoreResult(null)
    const result = await onGhRestoreLatest?.()
    if (result?.ok && result?.data) {
      await onGhApplyRestore?.(result.data)
    }
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoring(false)
  }

  const handleGhRestoreCommit = async (commitSha: string) => {
    setGhRestoringCommitSha(commitSha)
    setGhRestoreResult(null)
    const result = await onGhRestoreFromCommit?.(commitSha)
    if (result?.ok && result?.data) {
      await onGhApplyRestore?.(result.data)
    }
    setGhRestoreResult({ ok: result?.ok || false, message: result?.message || '' })
    setGhRestoringCommitSha(null)
  }

  const formatDate = (iso: string): string =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const handleGitHubClick = () => {
    setActiveSection('github')
  }

  const handleImportClick = () => {
    importFileInputRef.current?.click()
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImport?.(file)
      // Reset the input
      if (importFileInputRef.current) {
        importFileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="settings-modal-container">
          {/* Master list */}
          <nav className="settings-modal-nav">
            <button
              className={`settings-modal-nav-item${activeSection === 'profile' ? ' active' : ''}`}
              onClick={() => setActiveSection('profile')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="5" r="2.5" />
                <path d="M 2 14 Q 2 10 8 10 Q 14 10 14 14" />
              </svg>
              Profile
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'github' ? ' active' : ''}`}
              onClick={() => setActiveSection('github')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub Sync
              {hasPendingChanges && <span className="settings-modal-badge" />}
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'appearance' ? ' active' : ''}`}
              onClick={() => setActiveSection('appearance')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                {darkMode ? (
                  <path d="M8.5 3a5.5 5.5 0 0 0 4.384 8.624A5.5 5.5 0 1 1 8.5 3z" />
                ) : (
                  <>
                    <circle cx="8" cy="8" r="3" />
                    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </>
                )}
              </svg>
              Appearance
            </button>
            <button
              className={`settings-modal-nav-item${activeSection === 'advanced' ? ' active' : ''}`}
              onClick={() => setActiveSection('advanced')}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a1 1 0 0 1 1 1v1.5h2a1 1 0 0 1 1 1v1h1.5a1 1 0 0 1 0 2H13v3h1.5a1 1 0 0 1 0 2H13v1a1 1 0 0 1-1 1h-2v1.5a1 1 0 0 1-2 0V14H6v1.5a1 1 0 0 1-2 0V14H2a1 1 0 0 1-1-1v-2H.5a1 1 0 0 1 0-2H1V7H.5a1 1 0 0 1 0-2H1V4a1 1 0 0 1 1-1h2V1.5a1 1 0 0 1 2 0V3h2V1.5a1 1 0 0 1 1-1z"/>
              </svg>
              Advanced
            </button>
          </nav>

          {/* Detail panel */}
          <div className="settings-modal-detail">
            {activeSection === 'profile' && (
              <div className="settings-section">
                <h3>Profile</h3>
                <div className="settings-section-content">
                  {!profileEditing ? (
                    /* ── View mode ── */
                    <>
                      <div className="settings-profile-columns">
                        <div className="settings-profile-card settings-profile-card--view">
                          <div className="settings-profile-view-avatar">
                            {avatarPreview ? (
                              <img src={avatarPreview} alt="Profile" className="settings-avatar-img" />
                            ) : (
                              <div className="settings-avatar-placeholder">
                                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                  <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                                  <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="settings-profile-view-info">
                            <span className="settings-profile-view-name">{name || 'No name set'}</span>
                            <span className="settings-profile-view-role">Primary</span>
                          </div>
                        </div>

                        {hasPartner && (
                          <div className="settings-profile-card settings-profile-card--view">
                            <div className="settings-profile-view-avatar">
                              {partnerAvatarPreview ? (
                                <img src={partnerAvatarPreview} alt="Partner" className="settings-avatar-img" />
                              ) : (
                                <div className="settings-avatar-placeholder">
                                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                    <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="settings-profile-view-info">
                              <span className="settings-profile-view-name">{partnerName || 'No name set'}</span>
                              <span className="settings-profile-view-role">Partner</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="settings-save-row">
                        <button className="settings-btn" onClick={() => setProfileEditing(true)}>
                          Edit Profile
                        </button>
                        {profileSaved && <span className="settings-save-flash">Profile saved!</span>}
                      </div>
                    </>
                  ) : (
                    /* ── Edit mode ── */
                    <>
                      <div className="settings-profile-columns">
                        {/* You column */}
                        <div className="settings-profile-card">
                          <h4 className="settings-profile-card-title">You</h4>
                          <div className="settings-avatar-section">
                            <button
                              className="settings-avatar-btn"
                              onClick={() => fileInputRef.current?.click()}
                              title="Click to upload a photo"
                              aria-label="Upload profile picture"
                            >
                              {avatarPreview ? (
                                <img src={avatarPreview} alt="Profile" className="settings-avatar-img" />
                              ) : (
                                <div className="settings-avatar-placeholder">
                                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                    <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  </svg>
                                </div>
                              )}
                              <div className="settings-avatar-overlay">
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                  <path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleFileChange}
                            />
                          </div>
                          <div className="settings-field">
                            <label className="settings-label">Name</label>
                            <input
                              type="text"
                              className="settings-input"
                              value={name}
                              onChange={e => setName(e.target.value)}
                              placeholder="Your name"
                            />
                          </div>
                          <div className="settings-field">
                            <label className="settings-label">Birthday</label>
                            <input
                              type="date"
                              className="settings-input"
                              value={birthday}
                              onChange={e => setBirthday(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Partner column */}
                        {hasPartner && (
                        <div className="settings-profile-card">
                              <div className="settings-partner-header">
                                <h4 className="settings-profile-card-title">Partner</h4>
                                <button className="settings-partner-remove" onClick={() => { setHasPartner(false); setPartnerName(''); setPartnerBirthday(''); setPartnerAvatarPreview('') }}>Remove</button>
                              </div>
                              <div className="settings-avatar-section">
                                <button
                                  className="settings-avatar-btn"
                                  onClick={() => partnerFileInputRef.current?.click()}
                                  title="Upload partner photo"
                                  aria-label="Upload partner picture"
                                >
                                  {partnerAvatarPreview ? (
                                    <img src={partnerAvatarPreview} alt="Partner" className="settings-avatar-img" />
                                  ) : (
                                    <div className="settings-avatar-placeholder">
                                      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                        <circle cx="18" cy="14" r="7" stroke="currentColor" strokeWidth="2"/>
                                        <path d="M4 32c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                      </svg>
                                    </div>
                                  )}
                                  <div className="settings-avatar-overlay">
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                      <path d="M3 17h14M10 3l4 4-7 7H3v-4l7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </div>
                                </button>
                                <input
                                  ref={partnerFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={handlePartnerFileChange}
                                />
                              </div>
                              <div className="settings-field">
                                <label className="settings-label">Name</label>
                                <input
                                  type="text"
                                  className="settings-input"
                                  value={partnerName}
                                  onChange={e => setPartnerName(e.target.value)}
                                  placeholder="Partner's name"
                                />
                              </div>
                              <div className="settings-field">
                                <label className="settings-label">Birthday</label>
                                <input
                                  type="date"
                                  className="settings-input"
                                  value={partnerBirthday}
                                  onChange={e => setPartnerBirthday(e.target.value)}
                                />
                              </div>
                        </div>
                        )}
                      </div>

                      {!hasPartner && (
                        <button className="settings-add-partner-btn" onClick={() => setHasPartner(true)}>
                          + Add Partner
                        </button>
                      )}

                      {/* Save / Cancel */}
                      <div className="settings-save-row">
                        <button className="settings-btn" onClick={handleProfileSave}>
                          Save Profile
                        </button>
                        <button className="settings-btn settings-btn--secondary" onClick={handleProfileCancel}>
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'github' && (
              <div className="settings-section">
                <div  className="settings-section-content" style={{ overflow: 'auto', maxHeight: '60vh' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div className="ghsync-status-bar" style={{ margin: 0, flex: 1 }}>
                      {ghSyncStatus === 'syncing' && <><span className="ghsync-spinner" />Syncing…</>}
                      {ghSyncStatus === 'success' && ghLastSyncAt && <>
                        <span style={{ color: '#10b981', marginRight: '0.5rem' }}>●</span>
                        Last synced {new Date(ghLastSyncAt).toLocaleString()}
                      </>}
                      {ghSyncStatus === 'error' && <>
                        <span style={{ color: '#ef4444', marginRight: '0.5rem' }}>●</span>
                        Sync failed: {ghLastError}
                      </>}
                      {ghSyncStatus === 'idle' && <>
                        <span style={{ color: '#9ca3af', marginRight: '0.5rem' }}>●</span>
                        {ghConfig?.owner && ghConfig?.repo && ghConfig?.filePath ? (ghHasStoredToken ? (ghTokenUnlocked ? 'Ready to sync' : 'Token locked') : 'Token not set up') : 'Missing configuration'}
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
                  {ghSyncSuccess && (
                    <p className="ghsync-result-success" style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>✓ Sync successful</p>
                  )}

                  <div className="ghsync-tabs">
                    <button 
                      onClick={() => setGhTab('config')}
                      className={`ghsync-tab-btn${ghTab === 'config' ? ' active' : ''}`}
                    >
                      Configuration
                    </button>
                    <button 
                      onClick={() => setGhTab('history')}
                      className={`ghsync-tab-btn${ghTab === 'history' ? ' active' : ''}`}
                    >
                      History
                    </button>
                  </div>

                  {ghTab === 'config' && (
                    <div className="ghsync-field" style={{ gap: '1rem' }}>
                      <div>
                        <label className="ghsync-field-label">Token Security</label>
                        {!ghHasStoredToken && <p className="ghsync-field-hint">No token saved yet. Save one encrypted with a passphrase.</p>}
                        {ghHasStoredToken && !ghTokenUnlocked && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              className="ghsync-field-input"
                              style={{ flex: 1 }}
                              type="password"
                              value={ghUnlockPassphrase}
                              onChange={e => setGhUnlockPassphrase(e.target.value)}
                              placeholder="Passphrase to unlock token"
                            />
                            <button className="ghsync-mini-btn" onClick={handleGhUnlock} style={{ minWidth: '80px' }}>Unlock</button>
                          </div>
                        )}
                        {ghTokenUnlocked && (
                          <p className="ghsync-result-success">✓ Token unlocked for this session {!ghUsingLegacyToken && <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }} onClick={onGhLockToken}>Lock</button>}</p>
                        )}
                      </div>

                      <div>
                        <label className="ghsync-field-label">New / replacement token</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="ghsync-field-input"
                            style={{ flex: 1 }}
                            type={ghShowToken ? 'text' : 'password'}
                            value={ghTokenInput}
                            onChange={e => setGhTokenInput(e.target.value)}
                            placeholder="github_pat_..."
                            autoComplete="off"
                          />
                          <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setGhShowToken(v => !v)}>{ghShowToken ? 'Hide' : 'Show'}</button>
                        </div>
                        <p className="ghsync-pat-hint">Create a fine-grained PAT at <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>github.com/settings/tokens</a> with Contents write access</p>
                      </div>

                      <div>
                        <label className="ghsync-field-label">Passphrase for encryption</label>
                        <input
                          className="ghsync-field-input"
                          style={{ width: '100%' }}
                          type="password"
                          value={ghPassphrase}
                          onChange={e => setGhPassphrase(e.target.value)}
                          placeholder="At least 8 characters"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="ghsync-mini-btn"
                          onClick={handleGhSaveToken}
                          disabled={ghSavingToken || !ghTokenInput || !ghPassphrase}
                        >
                          {ghSavingToken ? 'Saving…' : 'Save Token'}
                        </button>
                        {ghUsingLegacyToken && (
                          <button 
                            className="ghsync-mini-btn"
                            onClick={handleGhMigrateLegacy}
                            disabled={ghSavingToken || !ghPassphrase}
                          >
                            Encrypt Legacy
                          </button>
                        )}
                      </div>

                      {ghSaveResult && (
                        <p className={ghSaveResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'}>
                          {ghSaveResult.ok ? '✓' : '✗'} {ghSaveResult.message}
                        </p>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="ghsync-field">
                          <label className="ghsync-field-label">Owner</label>
                          <input 
                            className="ghsync-field-input"
                            type="text"
                            value={ghConfig?.owner || ''} 
                            onChange={e => { onGhUpdateConfig?.({ owner: e.target.value }); setGhTestResult(null) }}
                            placeholder="your-github-username"
                          />
                        </div>
                        <div className="ghsync-field">
                          <label className="ghsync-field-label">Repository</label>
                          <input 
                            className="ghsync-field-input"
                            type="text"
                            value={ghConfig?.repo || ''}
                            onChange={e => { onGhUpdateConfig?.({ repo: e.target.value }); setGhTestResult(null) }}
                            placeholder="finance-backups"
                          />
                        </div>
                      </div>

                      <div className="ghsync-field">
                        <label className="ghsync-field-label">File path in repo</label>
                        <input 
                          className="ghsync-field-input"
                          type="text"
                          value={ghConfig?.filePath || ''}
                          onChange={e => onGhUpdateConfig?.({ filePath: e.target.value })}
                          placeholder="finance-goals.json"
                        />
                      </div>

                      <label>
                        <input 
                          type="checkbox"
                          checked={ghConfig?.autoSync || false}
                          onChange={e => onGhUpdateConfig?.({ autoSync: e.target.checked })}
                          style={{ marginRight: '0.5rem' }}
                        />
                        Auto-sync (commits ~60 seconds after any change)
                      </label>

                      <button 
                        className="ghsync-mini-btn"
                        onClick={handleGhTest}
                        disabled={ghTesting}
                      >
                        {ghTesting ? 'Testing…' : 'Test Connection'}
                      </button>

                      {ghTestResult && (
                        <p className={ghTestResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'}>
                          {ghTestResult.ok ? '✓' : '✗'} {ghTestResult.message}
                        </p>
                      )}

                      {ghTestResult?.warnings?.length ? (
                        <div className="ghsync-warning-box">
                          {ghTestResult.warnings.map(w => <p key={w} className="ghsync-warning-item">⚠ {w}</p>)}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {ghTab === 'history' && (
                    <div>
                      <button 
                        className="ghsync-mini-btn"
                        onClick={handleGhRestoreLatest}
                        disabled={!ghIsConfigured || ghRestoring}
                        style={{ marginBottom: '1rem' }}
                      >
                        {ghRestoring ? 'Restoring…' : 'Restore Latest'}
                      </button>
                      {ghRestoreResult && (
                        <p className={ghRestoreResult.ok ? 'ghsync-result-success' : 'ghsync-result-error'} style={{ marginBottom: '1rem' }}>
                          {ghRestoreResult.ok ? '✓' : '✗'} {ghRestoreResult.message}
                        </p>
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
                                <div className="ghsync-commit-meta">
                                  <span className="ghsync-commit-sha">{c.sha}</span>
                                  <span className="ghsync-commit-date">{formatDate(c.date)}</span>
                                </div>
                                <div className="ghsync-commit-message">{c.message}</div>
                              </a>
                              <button
                                className="ghsync-mini-btn ghsync-commit-restore-btn"
                                onClick={() => handleGhRestoreCommit(c.sha)}
                                disabled={ghRestoring || ghRestoringCommitSha === c.sha}
                                style={{ minWidth: '70px' }}
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
            )}

            {activeSection === 'appearance' && (
              <div className="settings-section">
                <h3>Appearance</h3>
                <div className="settings-section-content">
                  <p className="settings-description">Choose your preferred theme</p>
                  <div className="settings-theme-selector">
                    <button
                      className={`settings-theme-option${!darkMode ? ' active' : ''}`}
                      onClick={() => darkMode && onToggleDarkMode()}
                      aria-pressed={!darkMode}
                    >
                      <div className="settings-theme-preview settings-theme-light">
                        <div className="settings-theme-toolbar" />
                        <div className="settings-theme-content">
                          <div className="settings-theme-bar" />
                          <div className="settings-theme-bar" />
                          <div className="settings-theme-bar short" />
                        </div>
                      </div>
                      <span className="settings-theme-name">Light</span>
                    </button>
                    <button
                      className={`settings-theme-option${darkMode ? ' active' : ''}`}
                      onClick={() => !darkMode && onToggleDarkMode()}
                      aria-pressed={darkMode}
                    >
                      <div className="settings-theme-preview settings-theme-dark">
                        <div className="settings-theme-toolbar" />
                        <div className="settings-theme-content">
                          <div className="settings-theme-bar" />
                          <div className="settings-theme-bar" />
                          <div className="settings-theme-bar short" />
                        </div>
                      </div>
                      <span className="settings-theme-name">Dark</span>
                    </button>
                  </div>

                  {/* Accent colors — unified picker */}
                  <div className="settings-palette-group">
                    <p className="settings-palette-label">Accent colors</p>
                    <p className="settings-palette-hint">Click a label to assign that accent to a color. Active assignments shown below each swatch.</p>
                    <div className="settings-accent-tabs">
                      {([['home', 'Home page', homeTheme], ['fi', 'FI goals', fiTheme], ['gw', 'GW goals', gwTheme]] as const).map(([key, label, value]) => (
                        <button
                          key={key}
                          className={`settings-accent-tab${accentTarget === key ? ' active' : ''}`}
                          style={{ '--tab-color': COLOR_PALETTES.find(p => p.id === value)?.color } as React.CSSProperties}
                          onClick={() => setAccentTarget(key)}
                        >
                          <span className="settings-accent-tab-dot" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="settings-palette-swatches">
                      {COLOR_PALETTES.map(p => {
                        const activeFor: string[] = []
                        if (homeTheme === p.id) activeFor.push('H')
                        if (fiTheme === p.id) activeFor.push('FI')
                        if (gwTheme === p.id) activeFor.push('GW')
                        const isSelected = accentTarget === 'home' ? homeTheme === p.id : accentTarget === 'fi' ? fiTheme === p.id : gwTheme === p.id
                        const handleClick = accentTarget === 'home' ? onHomeThemeChange : accentTarget === 'fi' ? onFiThemeChange : onGwThemeChange
                        return (
                          <div key={p.id} className="settings-swatch-col">
                            <button
                              className={`settings-palette-swatch${isSelected ? ' active' : ''}`}
                              style={{ '--swatch-color': p.color } as React.CSSProperties}
                              onClick={() => handleClick(p.id)}
                              title={p.label}
                              aria-label={`${p.label}${isSelected ? ' (selected)' : ''}`}
                              aria-pressed={isSelected}
                            >
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                            {activeFor.length > 0 && (
                              <span className="settings-swatch-tags">
                                {activeFor.join(' · ')}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'advanced' && (
              <div className="settings-section">
                <h3>Advanced</h3>
                <div className="settings-section-content">
                  <p className="settings-description">Manage app data and reset your application</p>

                  <div className="settings-toggle-row" style={{ marginBottom: '1rem' }}>
                    <div>
                      <span className="settings-toggle-label">Allow CSV imports &amp; resets</span>
                      <span className="settings-toggle-hint">Show import and reset buttons on the Data page</span>
                    </div>
                    <button
                      className={`settings-toggle-switch${allowCsvImport ? ' on' : ''}`}
                      onClick={onToggleAllowCsvImport}
                      role="switch"
                      aria-checked={allowCsvImport}
                    >
                      <span className="settings-toggle-knob" />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button 
                      className="settings-btn settings-btn--secondary" 
                      onClick={() => onExport?.()}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor"/>
                      </svg>
                      Export
                    </button>
                    <button 
                      className="settings-btn settings-btn--secondary" 
                      onClick={handleImportClick}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M8 11V2M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor"/>
                      </svg>
                      Import
                    </button>
                    <input 
                      ref={importFileInputRef} 
                      type="file" 
                      accept=".json" 
                      onChange={handleImportFileChange} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                  
                  {!resetConfirmOpen ? (
                    <button className="settings-btn settings-btn--danger" onClick={() => setResetConfirmOpen(true)}>
                      Factory Reset App
                    </button>
                  ) : (
                    <div className="settings-reset-confirm">
                      <div className="settings-reset-warning">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#dc2626">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        <div>
                          <p className="settings-reset-title">Permanently reset the app?</p>
                          <p className="settings-reset-message">This will erase all goals, data, and settings. This action cannot be undone.</p>
                        </div>
                      </div>
                      <div className="settings-reset-actions">
                        <button className="settings-btn settings-btn--outline" onClick={() => setResetConfirmOpen(false)}>
                          Cancel
                        </button>
                        <button className="settings-btn settings-btn--danger" onClick={() => {
                          onFactoryReset()
                          onClose()
                        }}>
                          Yes, Reset Everything
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal

