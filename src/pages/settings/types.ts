import { Profile } from '../../hooks/useProfile'

export type SettingsSection = 'profile' | 'folder' | 'appearance' | 'advanced' | 'labs' | 'flags'

export interface SettingsModalProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
  initialSection?: SettingsSection
  allowCsvImport?: boolean
  onToggleAllowCsvImport?: () => void
  onClose?: () => void
}

export interface ProfilePaneProps {
  profile: Profile
  onUpdateProfile: (updates: Partial<Profile>) => void
}

export interface AppearancePaneProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  accentTheme: string
  onChangeAccent: (theme: string) => void
}

export interface AdvancedPaneProps {
  allowCsvImport: boolean
  onToggleAllowCsvImport: () => void
}
