import { FC, useState, useEffect } from 'react'
import { Profile } from '../../hooks/useProfile'
import { GitHubSyncConfig, SyncStatus, CommitEntry, ConnectionTestResult, RestoreResult } from '../../hooks/useGitHubSync'
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
      <div className="settings-menu-container" style={{ position: 'relative', width: '100%' }}>
        <button
          className="settings-menu-trigger"
          aria-label="Settings"
          onClick={() => { setInitialSection('profile'); setSettingsModalOpen(true) }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem 0.75rem',
            width: '100%',
            textAlign: 'left',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: '0.45rem',
            transition: 'background 0.15s, color 0.15s',
            color: 'inherit',
          }}
        >
          Settings
        </button>
      </div>
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
