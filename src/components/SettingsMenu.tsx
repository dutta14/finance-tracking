import { FC, useState } from 'react'
import { Profile } from '../hooks/useProfile'
import SettingsModal from './SettingsModal'

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
}

const defaultProfile: Profile = { name: '', avatarDataUrl: '', birthday: '' }

const SettingsMenu: FC<SettingsMenuProps> = ({ darkMode, onToggleDarkMode, profile = defaultProfile, onUpdateProfile = () => {}, fiTheme = 'blue', onFiThemeChange = () => {}, gwTheme = 'green', onGwThemeChange = () => {}, homeTheme = 'blue', onHomeThemeChange = () => {} }) => {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  return (
    <>
      <div className="settings-menu-container" style={{ position: 'relative', width: '100%' }}>
        <button
          className="settings-menu-trigger"
          aria-label="Settings"
          onClick={() => setSettingsModalOpen(true)}
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
      </div>
      {settingsModalOpen && (
        <SettingsModal
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          hasPendingChanges={false}
          fiTheme={fiTheme}
          onFiThemeChange={onFiThemeChange}
          gwTheme={gwTheme}
          onGwThemeChange={onGwThemeChange}
          homeTheme={homeTheme}
          onHomeThemeChange={onHomeThemeChange}
          onClose={() => setSettingsModalOpen(false)}
        />
      )}
    </>
  )
}

export default SettingsMenu
