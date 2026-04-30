import { Profile } from '../../hooks/useProfile'
import {
  GitHubSyncConfig,
  SyncStatus,
  SyncDomain,
  SyncProgress,
  CommitEntry,
  ConnectionTestResult,
  RestoreResult,
} from '../../hooks/useGitHubSync'

export type SettingsSection = 'profile' | 'github' | 'appearance' | 'advanced' | 'labs' | 'flags'

export interface SettingsModalProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
  hasPendingChanges: boolean
  initialSection?: SettingsSection
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
  ghSyncProgress?: SyncProgress | null
  ghDirtyFlags?: Record<SyncDomain, boolean>
  onFactoryReset?: () => void
  allowCsvImport?: boolean
  onToggleAllowCsvImport?: () => void
  onExport?: () => void
  onImport?: (file: File) => void
  onClose?: () => void
}

export interface ProfilePaneProps {
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
}

export interface GitHubSyncPaneProps {
  hasPendingChanges: boolean
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
  ghSyncProgress?: SyncProgress | null
  ghDirtyFlags?: Record<SyncDomain, boolean>
}

export interface AppearancePaneProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  fiTheme: string
  onFiThemeChange: (theme: string) => void
}

export interface AdvancedPaneProps {
  allowCsvImport: boolean
  onToggleAllowCsvImport: () => void
  onExport: () => void
  onImport: (file: File) => void
  onFactoryReset: () => void
  onClose: () => void
}
