import { FC, useState } from 'react'
import { Profile } from '../hooks/useProfile'
import { GitHubSyncConfig, SyncStatus, CommitEntry, ConnectionTestResult, RestoreResult } from '../hooks/useGitHubSync'
import SettingsModal from './SettingsModal'

interface SettingsMenuProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile?: Profile
  onUpdateProfile?: (updates: Partial<Profile>) => void
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
  onGhApplyRestore?: (data: unknown) => Promise<void>
  ghData?: object
  onFactoryReset?: () => void
  onExport?: () => void
  onImport?: (file: File) => void
}

const defaultProfile: Profile = { name: '', avatarDataUrl: '', birthday: '' }

const SettingsMenu: FC<SettingsMenuProps> = ({ darkMode, onToggleDarkMode, profile = defaultProfile, onUpdateProfile = () => {}, hasPendingChanges = false, ghConfig, ghIsConfigured = false, ghSyncStatus = 'idle', ghLastSyncAt, ghLastError, ghHistory = [], ghHasStoredToken = false, ghTokenUnlocked = false, ghUsingLegacyToken = false, onGhUpdateConfig, onGhSaveEncryptedToken, onGhMigrateLegacyToken, onGhUnlockToken, onGhLockToken, onGhSyncNow, onGhFetchHistory, onGhTestConnection, onGhRestoreLatest, onGhRestoreFromCommit, onGhApplyRestore, ghData, onFactoryReset = () => {}, onExport = () => {}, onImport = () => {} }) => {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        className="settings-menu-trigger"
        aria-label="Settings"
        onClick={() => setModalOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.7rem 1.2rem',
          width: '100%',
          textAlign: 'left',
          fontSize: '1rem',
          fontWeight: 500,
          color: 'inherit',
        }}
      >
        Settings
      </button>
      {modalOpen && (
        <SettingsModal
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          hasPendingChanges={hasPendingChanges}
          ghConfig={ghConfig}
          ghIsConfigured={ghIsConfigured}
          ghSyncStatus={ghSyncStatus}
          ghLastSyncAt={ghLastSyncAt}
          ghLastError={ghLastError}
          ghHistory={ghHistory}
          ghHasStoredToken={ghHasStoredToken}
          ghTokenUnlocked={ghTokenUnlocked}
          ghUsingLegacyToken={ghUsingLegacyToken}
          onGhUpdateConfig={onGhUpdateConfig}
          onGhSaveEncryptedToken={onGhSaveEncryptedToken}
          onGhMigrateLegacyToken={onGhMigrateLegacyToken}
          onGhUnlockToken={onGhUnlockToken}
          onGhLockToken={onGhLockToken}
          onGhSyncNow={onGhSyncNow}
          onGhFetchHistory={onGhFetchHistory}
          onGhTestConnection={onGhTestConnection}
          onGhRestoreLatest={onGhRestoreLatest}
          onGhRestoreFromCommit={onGhRestoreFromCommit}
          onGhApplyRestore={onGhApplyRestore}
          ghData={ghData}
          onFactoryReset={onFactoryReset}
          onExport={onExport}
          onImport={onImport}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

export default SettingsMenu

