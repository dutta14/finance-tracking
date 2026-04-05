import { FC, useState, useRef, useEffect } from 'react'
import { Profile } from '../hooks/useProfile'
import ProfileModal from './ProfileModal'

interface SettingsMenuProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  profile?: Profile
  onUpdateProfile?: (updates: Partial<Profile>) => void
}

const defaultProfile: Profile = { name: '', avatarDataUrl: '', birthday: '' }

const SettingsMenu: FC<SettingsMenuProps> = ({ darkMode, onToggleDarkMode, profile = defaultProfile, onUpdateProfile = () => {} }) => {
  const [open, setOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      <div className="settings-menu-container" ref={menuRef} style={{ position: 'relative', width: '100%' }}>
        <button
          className="settings-menu-trigger"
          aria-label="Settings"
          onClick={() => setOpen((v) => !v)}
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
        {open && (
          <div className="settings-menu-dropdown" style={{
            position: 'absolute',
            left: '100%',
            bottom: 0,
            background: 'var(--settings-bg, #fff)',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            boxShadow: '0 2px 12px 0 rgba(60,80,120,0.13)',
            minWidth: 180,
            zIndex: 1000,
            padding: '0.5rem 0',
            marginLeft: 8,
            marginBottom: 12,
          }}>
            <button
              className="settings-menu-item"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: '0.7rem 1.2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 400,
              }}
              onClick={() => {
                setProfileModalOpen(true)
                setOpen(false)
              }}
            >
              Profile
            </button>
            <button
              className="settings-menu-item"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: '0.7rem 1.2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 400,
              }}
              onClick={() => {
                onToggleDarkMode()
                setOpen(false)
              }}
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        )}
      </div>
      {profileModalOpen && (
        <ProfileModal
          profile={profile}
          onSave={onUpdateProfile}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
    </>
  )
}

export default SettingsMenu
