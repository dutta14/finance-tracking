import { FC, useState, useEffect } from 'react'
import { Profile } from '../../hooks/useProfile'
import { GitHubSyncConfig, SyncStatus, SyncDomain, SyncProgress, CommitEntry, ConnectionTestResult, RestoreResult } from '../../hooks/useGitHubSync'
import SettingsModal from './SettingsModal'
import type { SettingsSection } from './types'

interface SettingsMenuProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile?: Profile
  onUpdateProfile?: (updates: Partial<Profile>) => void
  fiTheme?: string
  onFiThemeChange?: (theme: string) => void
  gwTheme?: string
  onGwThemeChange?: (theme: string) => void
  homeTheme?: string
  onHomeThemeChange?: (theme: string) => void
  hasPendingChanges?: boolean
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
  ghData?: object
  onGhApplyRestore?: (data: unknown) => Promise<void>
  ghSyncProgress?: SyncProgress | null
  ghDirtyFlags?: Record<SyncDomain, boolean>
  onFactoryReset?: () => void
  allowCsvImport?: boolean
  onToggleAllowCsvImport?: () => void
  onExport?: () => void
  onImport?: (file: File) => void
  externalOpen?: boolean
  externalSection?: SettingsSection
  onExternalClose?: () => void
}

const defaultProfile: Profile = { name: '', avatarDataUrl: '', birthday: '' }

const SettingsMenu: FC<SettingsMenuProps> = ({ darkMode, onToggleDarkMode, profile = defaultProfile, onUpdateProfile = () => {}, fiTheme = 'blue', onFiThemeChange = () => {}, gwTheme = 'green', onGwThemeChange = () => {}, homeTheme = 'blue', onHomeThemeChange = () => {}, externalOpen, externalSection, onExternalClose, ...rest }) => {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [initialSection, setInitialSection] = useState<SettingsSection>('profile')

  useEffect(() => {
    if (externalOpen) {
      setInitialSection(externalSection || 'profile')
      setSettingsModalOpen(true)
    }
  }, [externalOpen, externalSection])

  const handleClose = () => {
    setSettingsModalOpen(false)
    onExternalClose?.()
  }

  return (
    <>
      <button
        className="sidebar-footer-btn"
        aria-label="Settings"
        aria-haspopup="dialog"
        onClick={() => { setInitialSection('profile'); setSettingsModalOpen(true) }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
          <path d="M8.3 4.5L8.2 2.2h3.6l-.1 2.3 2.3 1.3 1.9-1.3 1.8 3.2-2 1-.0 2.6 2 1-1.8 3.2-1.9-1.3-2.3 1.3.1 2.3H8.2l.1-2.3-2.3-1.3-1.8 1.3-1.8-3.2 2-1-.0-2.6-2-1 1.8-3.2 1.8 1.3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="sidebar-footer-label">Settings</span>
      </button>
      {settingsModalOpen && (
        <SettingsModal
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          fiTheme={fiTheme}
          onFiThemeChange={onFiThemeChange}
          gwTheme={gwTheme}
          onGwThemeChange={onGwThemeChange}
          homeTheme={homeTheme}
          onHomeThemeChange={onHomeThemeChange}
          hasPendingChanges={rest.hasPendingChanges ?? false}
          ghConfig={rest.ghConfig}
          ghIsConfigured={rest.ghIsConfigured}
          ghSyncStatus={rest.ghSyncStatus}
          ghLastSyncAt={rest.ghLastSyncAt}
          ghLastError={rest.ghLastError}
          ghHistory={rest.ghHistory}
          ghHasStoredToken={rest.ghHasStoredToken}
          ghTokenUnlocked={rest.ghTokenUnlocked}
          ghUsingLegacyToken={rest.ghUsingLegacyToken}
          onGhUpdateConfig={rest.onGhUpdateConfig}
          onGhSaveEncryptedToken={rest.onGhSaveEncryptedToken}
          onGhMigrateLegacyToken={rest.onGhMigrateLegacyToken}
          onGhUnlockToken={rest.onGhUnlockToken}
          onGhLockToken={rest.onGhLockToken}
          onGhSyncNow={rest.onGhSyncNow}
          onGhFetchHistory={rest.onGhFetchHistory}
          onGhTestConnection={rest.onGhTestConnection}
          onGhRestoreLatest={rest.onGhRestoreLatest}
          onGhRestoreFromCommit={rest.onGhRestoreFromCommit}
          ghData={rest.ghData}
          onGhApplyRestore={rest.onGhApplyRestore}
          ghSyncProgress={rest.ghSyncProgress}
          ghDirtyFlags={rest.ghDirtyFlags}
          onFactoryReset={rest.onFactoryReset}
          allowCsvImport={rest.allowCsvImport}
          onToggleAllowCsvImport={rest.onToggleAllowCsvImport}
          onExport={rest.onExport}
          onImport={rest.onImport}
          initialSection={initialSection}
          onClose={handleClose}
        />
      )}
    </>
  )
}

export default SettingsMenu
