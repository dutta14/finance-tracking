import { FC, useState, useEffect } from 'react'
import { Profile } from '../../hooks/useProfile'
import SettingsModal from './SettingsModal'
import type { SettingsSection } from './types'

interface SettingsMenuProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile?: Profile
  onUpdateProfile?: (updates: Partial<Profile>) => void
  allowCsvImport?: boolean
  onToggleAllowCsvImport?: () => void
  externalOpen?: boolean
  externalSection?: SettingsSection
  onExternalClose?: () => void
}

const defaultProfile: Profile = { name: '', avatarDataUrl: '', birthday: '' }

const SettingsMenu: FC<SettingsMenuProps> = ({
  darkMode,
  onToggleDarkMode,
  profile = defaultProfile,
  onUpdateProfile = () => {},
  externalOpen,
  externalSection,
  onExternalClose,
  ...rest
}) => {
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
        className="sidebar-link"
        aria-label="Settings"
        aria-haspopup="dialog"
        onClick={() => {
          setInitialSection('profile')
          setSettingsModalOpen(true)
        }}
      >
        Settings
      </button>
      {settingsModalOpen && (
        <SettingsModal
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          allowCsvImport={rest.allowCsvImport}
          onToggleAllowCsvImport={rest.onToggleAllowCsvImport}
          initialSection={initialSection}
          onClose={handleClose}
        />
      )}
    </>
  )
}

export default SettingsMenu
